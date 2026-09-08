import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createResilientPool, isConnectionError, isReadOnlyStatement } from "./dbResilience";

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
  const connection = { query, execute, release } as unknown as PoolConnection;
  const getConnection = vi.fn(async () => {
    const err = connectErrors.shift();
    if (err) throw err;
    return connection;
  });
  const end = vi.fn(async () => undefined);
  const pool = { getConnection, end } as unknown as Pool;
  return { pool, getConnection, query, execute, release, end };
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
    expect(fake.release).toHaveBeenCalledTimes(1);
  });

  it("повторяет чтение один раз при обрыве на выполнении", async () => {
    const fake = fakePool({ queryErrors: [errorWithCode("ECONNRESET")] });
    const client = createResilientPool(fake.pool);

    const result = await client.query({ sql: "select 1", rowsAsArray: true });

    expect(result).toEqual([[{ ok: 1 }], []]);
    expect(fake.getConnection).toHaveBeenCalledTimes(2);
    expect(fake.query).toHaveBeenCalledTimes(2);
    expect(fake.release).toHaveBeenCalledTimes(2);
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
