/**
 * Общие функции для скриптов, работающих с базой test кластера koza-rehearsal
 * (reset-rehearsal-db.mjs, restore-check.mjs). Только чтение, кроме DROP в reset.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

export function parseDatabaseUrl(value, multipleStatements = false) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements,
    connectTimeout: 30_000,
  };
}

export async function listBaseTables(connection) {
  const [rows] = await connection.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  return rows.map((row) => row.tableName);
}

/** COUNT(*) по каждой базовой таблице — только чтение */
export async function collectTableRows(connection) {
  const stats = [];
  for (const tableName of await listBaseTables(connection)) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS n FROM ${quoteIdentifier(tableName)}`);
    stats.push({ tableName, rowCount: Number(row.n) });
  }
  return stats;
}
