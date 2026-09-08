import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createResilientPool, endPoolWithTimeout, isConnectionError, isReadOnlyStatement, queryTimeoutMs } from "./dbResilience";

function errorWithCode(code: string): Error {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

/** Пул-заглушка: ошибки по порядку вызовов getConnection и query. */
function fakePool(options: { connectErrors?: (Error | null)[]; queryErrors?: (Error | null)[] } = {}) {
  const connectErrors = [...(options.connectErrors ?? [])];
  const queryErrors = [...(options.queryErrors ?? [])];
  const release = vi.fn();
  const destroy = vi.fn();
  const query = vi.fn(async () => {
    const err = queryErrors.shift();
    if (err) throw err;
    return [[{ ok: 1 }], []];
  });
  const execute = vi.fn(async () => {
    const err = queryErrors.shift();
    if (err) throw err;
    return [[{ ok: 1 }], []];
  });
  const connection = { query, execute, release, destroy } as unknown as PoolConnection;
  const getConnection = vi.fn(async () => {
    const err = connectErrors.shift();
    if (err) throw err;
    return connection;
  });
  const end = vi.fn(async () => undefined);
  const pool = { getConnection, end } as unknown as Pool;
  return { pool, getConnection, query, execute, release, destroy, end };
}

describe("isReadOnlyStatement", () => {
  it("распознаёт SELECT/SHOW/EXPLAIN с пробелами и комментариями", () => {
    expect(isReadOnlyStatement("select 1")).toBe(true);
    expect(isReadOnlyStatement("  SELECT `id` FROM `users`")).toBe(true);
    expect(isReadOnlyStatement("/* hint */ select 1")).toBe(true);
    expect(isReadOnlyStatement("SHOW TABLES")).toBe(true);
    expect(isReadOnlyStatement("explain select 1")).toBe(true);
  });

  it("считает записью INSERT/UPDATE/DELETE и CTE", () => {
    expect(isReadOnlyStatement("insert into `users` values (1)")).toBe(false);
    expect(isReadOnlyStatement("UPDATE users SET name = 'x'")).toBe(false);
    expect(isReadOnlyStatement("delete from users")).toBe(false);
    expect(isReadOnlyStatement("with t as (select 1) delete from users")).toBe(false);
    expect(isReadOnlyStatement("")).toBe(false);
  });
});

describe("isConnectionError", () => {
  it("возвращает true для кодов транспорта", () => {
    for (const code of ["ECONNRESET", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ECONNREFUSED", "ER_CON_COUNT_ERROR"]) {
      expect(isConnectionError(errorWithCode(code))).toBe(true);
    }
  });

  it("возвращает false для SQL-ошибок", () => {
    expect(isConnectionError(errorWithCode("ER_DUP_ENTRY"))).toBe(false);
    expect(isConnectionError(errorWithCode("ER_NO_REFERENCED_ROW_2"))).toBe(false);
    expect(isConnectionError(errorWithCode("ER_PARSE_ERROR"))).toBe(false);
    expect(isConnectionError(new Error("Unknown column 'x'"))).toBe(false);
  });

  it("без кода ориентируется на текст сообщения", () => {
    expect(isConnectionError(new Error("read ECONNRESET"))).toBe(true);
    expect(isConnectionError(new Error("socket hang up"))).toBe(true);
  });
});

describe("createResilientPool", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("повторяет любой запрос один раз, если не удалось получить соединение", async () => {
    const fake = fakePool({ connectErrors: [errorWithCode("ETIMEDOUT")] });
    const client = createResilientPool(fake.pool);

    const result = await client.query("insert into `t` values (1)");

    expect(result).toEqual([[{ ok: 1 }], []]);
    expect(fake.getConnection).toHaveBeenCalledTimes(2);
    expect(fake.query).toHaveBeenCalledTimes(1);
    expect(fake.release).toHaveBeenCalledTimes(1);
  });

  it("не повторяет запись, если соединение оборвалось уже на выполнении", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("PROTOCOL_CONNECTION_LOST")] });
    const client = createResilientPool(fake.pool);

    await expect(client.query({ sql: "update `t` set a = 1" })).rejects.toMatchObject({
      code: "PROTOCOL_CONNECTION_LOST",
    });
    expect(fake.getConnection).toHaveBeenCalledTimes(1);
    expect(fake.query).toHaveBeenCalledTimes(1);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(fake.release).not.toHaveBeenCalled();
  });

  it("повторяет чтение один раз при обрыве на выполнении", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("ECONNRESET")] });
    const client = createResilientPool(fake.pool);

    const result = await client.query({ sql: "select 1", rowsAsArray: true });

    expect(result).toEqual([[{ ok: 1 }], []]);
    expect(fake.getConnection).toHaveBeenCalledTimes(2);
    expect(fake.query).toHaveBeenCalledTimes(2);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(fake.release).toHaveBeenCalledTimes(1);
  });

  it("не повторяет SQL-ошибки", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("ER_DUP_ENTRY")] });
    const client = createResilientPool(fake.pool);

    await expect(client.query("select 1")).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    expect(fake.query).toHaveBeenCalledTimes(1);
    expect(fake.getConnection).toHaveBeenCalledTimes(1);
  });

  it("делает ровно одну повторную попытку", async () => {
    const fake = fakePool({ connectErrors: [errorWithCode("ECONNREFUSED"), errorWithCode("ECONNREFUSED")] });
    const client = createResilientPool(fake.pool);

    await expect(client.query("select 1")).rejects.toMatchObject({ code: "ECONNREFUSED" });
    expect(fake.getConnection).toHaveBeenCalledTimes(2);
    expect(fake.query).not.toHaveBeenCalled();
  });

  it("ждёт около 500 мс перед повтором", async () => {
    const fake = fakePool({ connectErrors: [errorWithCode("ETIMEDOUT")] });
    const client = createResilientPool(fake.pool);
    const started = Date.now();

    await client.query("select 1");

    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
  });

  it("передаёт таймаут бездействия в каждый запрос", async () => {
    const fake = fakePool();
    const client = createResilientPool(fake.pool);

    await client.query("select 1");
    await client.query({ sql: "select 2", rowsAsArray: true });
    await client.execute("select 3", []);

    expect(fake.query).toHaveBeenNthCalledWith(1, { sql: "select 1", timeout: queryTimeoutMs() });
    expect(fake.query).toHaveBeenNthCalledWith(2, { sql: "select 2", rowsAsArray: true, timeout: queryTimeoutMs() });
    expect(fake.execute).toHaveBeenCalledWith({ sql: "select 3", timeout: queryTimeoutMs() }, []);
    expect(queryTimeoutMs()).toBe(10_000);
  });

  it("зависший SELECT: соединение уничтожается, чтение повторяется на новом", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("PROTOCOL_SEQUENCE_TIMEOUT")] });
    const client = createResilientPool(fake.pool);

    await expect(client.query("select 1")).resolves.toEqual([[{ ok: 1 }], []]);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(fake.release).toHaveBeenCalledTimes(1);
    expect(fake.query).toHaveBeenCalledTimes(2);
  });

  it("зависшая запись: соединение уничтожается, повтора нет", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("PROTOCOL_SEQUENCE_TIMEOUT")] });
    const client = createResilientPool(fake.pool);

    await expect(client.query("update `t` set a = 1")).rejects.toMatchObject({ code: "PROTOCOL_SEQUENCE_TIMEOUT" });
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(fake.release).not.toHaveBeenCalled();
    expect(fake.query).toHaveBeenCalledTimes(1);
  });

  it("SQL-ошибка возвращает соединение в пул, а не уничтожает", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("ER_DUP_ENTRY")] });
    const client = createResilientPool(fake.pool);

    await expect(client.query("insert into `t` values (1)")).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    expect(fake.destroy).not.toHaveBeenCalled();
    expect(fake.release).toHaveBeenCalledTimes(1);
  });

  it("execute подчиняется тем же правилам", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("ECONNRESET")] });
    const client = createResilientPool(fake.pool);

    await expect(client.execute("insert into `t` values (1)", [])).rejects.toMatchObject({ code: "ECONNRESET" });
    expect(fake.execute).toHaveBeenCalledTimes(1);
  });

  it("getConnection повторяет получение соединения и проксирует остальное", async () => {
    const fake = fakePool({ connectErrors: [errorWithCode("PROTOCOL_SEQUENCE_TIMEOUT")] });
    const client = createResilientPool(fake.pool);

    const conn = await client.getConnection();
    expect(conn).toBeDefined();
    expect(fake.getConnection).toHaveBeenCalledTimes(2);

    await client.end();
    expect(fake.end).toHaveBeenCalledTimes(1);
  });
});

describe("endPoolWithTimeout", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function poolWithConnections(end: () => Promise<void>) {
    const destroy = vi.fn();
    const connections = [{ destroy }, { destroy }];
    const pool = {
      end: vi.fn(end),
      pool: { _allConnections: { length: connections.length, get: (i: number) => connections[i] } },
    } as unknown as Pool;
    return { pool, destroy };
  }

  it("возвращает closed, если end() успел", async () => {
    const { pool, destroy } = poolWithConnections(async () => undefined);
    await expect(endPoolWithTimeout(pool, 200)).resolves.toBe("closed");
    expect(destroy).not.toHaveBeenCalled();
  });

  it("по таймауту рвёт соединения и не виснет", async () => {
    const { pool, destroy } = poolWithConnections(() => new Promise(() => undefined));
    const started = Date.now();
    await expect(endPoolWithTimeout(pool, 100)).resolves.toBe("forced");
    expect(Date.now() - started).toBeLessThan(2000);
    expect(destroy).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalled();
  });

  it("при ошибке end() тоже рвёт соединения", async () => {
    const { pool, destroy } = poolWithConnections(async () => {
      throw new Error("boom");
    });
    await expect(endPoolWithTimeout(pool, 200)).resolves.toBe("forced");
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it("переживает пул без внутреннего списка соединений", async () => {
    const pool = { end: () => new Promise<void>(() => undefined) } as unknown as Pool;
    await expect(endPoolWithTimeout(pool, 50)).resolves.toBe("forced");
  });
});
