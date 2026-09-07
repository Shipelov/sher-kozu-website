#!/usr/bin/env node
/**
 * Разогрев базы перед тестами: TiDB Starter после простоя поднимается 5–10 с,
 * и первые соединения получают ETIMEDOUT. Делаем SELECT 1 до первого успеха,
 * не дольше WARM_UP_TIMEOUT_MS (по умолчанию 60 с).
 * Адрес: DATABASE_URL, иначе TEST_DATABASE_URL.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[warm-up] Не задан DATABASE_URL / TEST_DATABASE_URL");
  process.exit(1);
}

const totalTimeoutMs = Number(process.env.WARM_UP_TIMEOUT_MS) || 60_000;
const attemptTimeoutMs = 15_000;
const retryDelayMs = 3_000;

function connectionOptions(urlString) {
  const url = new URL(urlString);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
    connectTimeout: attemptTimeoutMs,
    ...(isLocal ? {} : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false } }),
  };
}

const startedAt = Date.now();
let attempt = 0;
let lastError = null;

while (Date.now() - startedAt < totalTimeoutMs) {
  attempt += 1;
  let conn = null;
  try {
    conn = await mysql.createConnection(connectionOptions(databaseUrl));
    await conn.query("SELECT 1");
    console.log(`[warm-up] база отвечает (попытка ${attempt}, ${Date.now() - startedAt} мс)`);
    await conn.end();
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(`[warm-up] попытка ${attempt}: ${error?.code ?? error?.message ?? error}`);
    await conn?.destroy?.();
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

console.error(`[warm-up] база не ответила за ${totalTimeoutMs} мс:`, lastError?.message ?? lastError);
process.exit(1);
