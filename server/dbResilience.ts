import type { Pool, PoolConnection } from "mysql2/promise";
import { isTransientDbError, withRetry } from "./retryUtils";

/**
 * Обёртка над пулом mysql2 для drizzle: один повтор с паузой 500 мс.
 *
 * Правила повтора:
 * - ошибка при получении соединения из пула (connect ETIMEDOUT, ECONNREFUSED,
 *   обрыв handshake) — запрос ещё не отправлен, повтор безопасен для любого SQL;
 * - ошибка уже на выполнении (ECONNRESET, PROTOCOL_CONNECTION_LOST) — повтор
 *   только для read-only запросов: INSERT/UPDATE мог дойти до сервера, повтор
 *   даст дубль;
 * - SQL-ошибки (ER_DUP_ENTRY, constraint, синтаксис) не повторяются никогда.
 */

const RETRY_DELAY_MS = 500;

const CONNECTION_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_SEQUENCE_TIMEOUT",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "HANDSHAKE_SSL_ERROR",
  "HANDSHAKE_NO_SSL_SUPPORT",
  "ER_CON_COUNT_ERROR",
]);

function errorCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** Ошибка транспорта/подключения, а не SQL. */
export function isConnectionError(err: unknown): boolean {
  const code = errorCode(err);
  if (code !== null) return CONNECTION_ERROR_CODES.has(code);
  return isTransientDbError(err);
}

/** SELECT/SHOW/EXPLAIN/DESCRIBE — повтор не создаст побочных эффектов. */
export function isReadOnlyStatement(sql: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*)*(?:select|show|explain|describe|desc)\b/i.test(sql);
}

type QueryArgs = Parameters<PoolConnection["query"]>;
type ExecuteArgs = Parameters<PoolConnection["execute"]>;

function extractSql(first: unknown): string {
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null) {
    const sql = (first as { sql?: unknown }).sql;
    if (typeof sql === "string") return sql;
  }
  return "";
}

const retryOnce = { maxAttempts: 2, baseDelayMs: RETRY_DELAY_MS, exponential: false } as const;

function acquireConnection(pool: Pool): Promise<PoolConnection> {
  return withRetry(() => pool.getConnection(), {
    ...retryOnce,
    label: "DB connect",
    isRetryable: isConnectionError,
  });
}

async function runOnConnection<T>(
  pool: Pool,
  readOnly: boolean,
  run: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  if (!readOnly) {
    const conn = await acquireConnection(pool);
    try {
      return await run(conn);
    } finally {
      conn.release();
    }
  }
  // Для чтения повтор охватывает и подключение, и выполнение — но ровно один раз
  return withRetry(
    async () => {
      const conn = await pool.getConnection();
      try {
        return await run(conn);
      } finally {
        conn.release();
      }
    },
    { ...retryOnce, label: "DB query", isRetryable: isConnectionError },
  );
}

/**
 * Возвращает объект с интерфейсом Pool, у которого query/execute/getConnection
 * защищены повтором. Остальные методы (end, on, …) проксируются в исходный пул.
 */
export function createResilientPool(pool: Pool): Pool {
  const query = (...args: QueryArgs) =>
    runOnConnection(pool, isReadOnlyStatement(extractSql(args[0])), (conn) =>
      (conn.query as (...a: QueryArgs) => Promise<unknown>)(...args),
    );
  const execute = (...args: ExecuteArgs) =>
    runOnConnection(pool, isReadOnlyStatement(extractSql(args[0])), (conn) =>
      (conn.execute as (...a: ExecuteArgs) => Promise<unknown>)(...args),
    );
  const getConnection = () => acquireConnection(pool);

  return new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === "query") return query;
      if (prop === "execute") return execute;
      if (prop === "getConnection") return getConnection;
      const value = Reflect.get(target, prop, receiver) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
