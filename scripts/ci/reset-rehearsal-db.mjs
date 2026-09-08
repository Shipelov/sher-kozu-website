#!/usr/bin/env node
/**
 * Сбрасывает базу репетиции перед импортом дампа: DROP всех таблиц и view.
 *
 * Защита: адрес берётся только из REHEARSAL_DATABASE_URL, имя базы обязано быть
 * `test`, и адрес не должен совпадать с SOURCE_DATABASE_URL/DATABASE_URL, если те
 * заданы. --dry-run только перечисляет, что было бы удалено.
 */
import mysql from "mysql2/promise";
import { listBaseTables, parseDatabaseUrl, quoteIdentifier } from "./rehearsalLib.mjs";

const dryRun = process.argv.includes("--dry-run");

function fail(message) {
  console.error(`[reset-rehearsal-db] ${message}`);
  process.exit(2);
}

export function guardRehearsalUrl(env = process.env) {
  const target = env.REHEARSAL_DATABASE_URL?.trim();
  if (!target) fail("Не задан REHEARSAL_DATABASE_URL");
  let options;
  try {
    options = parseDatabaseUrl(target);
  } catch {
    fail("REHEARSAL_DATABASE_URL не разбирается как URL");
  }
  if (options.database !== "test") {
    fail(`Отказ: база репетиции должна называться "test", получено "${options.database || "(пусто)"}"`);
  }
  for (const name of ["SOURCE_DATABASE_URL", "DATABASE_URL"]) {
    const other = env[name]?.trim();
    if (other && other === target) fail(`Отказ: REHEARSAL_DATABASE_URL совпадает с ${name}`);
    if (other) {
      try {
        const o = parseDatabaseUrl(other);
        if (o.host === options.host && o.database === options.database && o.user === options.user) {
          fail(`Отказ: REHEARSAL_DATABASE_URL указывает на ту же базу, что ${name}`);
        }
      } catch {
        // чужой URL не разбирается — не наша проблема
      }
    }
  }
  return options;
}

async function main() {
  const options = guardRehearsalUrl();
  const conn = await mysql.createConnection(options);
  try {
    const tables = await listBaseTables(conn);
    const [viewRows] = await conn.query(
      `SELECT table_name AS tableName FROM information_schema.views WHERE table_schema = DATABASE() ORDER BY table_name`,
    );
    const views = viewRows.map((row) => row.tableName);
    console.log(`[reset-rehearsal-db] база test: таблиц ${tables.length}, view ${views.length}${dryRun ? " (dry-run)" : ""}`);
    if (dryRun) return;
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const view of views) await conn.query(`DROP VIEW IF EXISTS ${quoteIdentifier(view)}`);
    for (const table of tables) await conn.query(`DROP TABLE IF EXISTS ${quoteIdentifier(table)}`);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    const remaining = await listBaseTables(conn);
    if (remaining.length !== 0) throw new Error(`После сброса остались таблицы: ${remaining.join(", ")}`);
    console.log(`[reset-rehearsal-db] удалено таблиц ${tables.length}, view ${views.length}; база пуста`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`[reset-rehearsal-db] ${error?.message ?? error}`);
  process.exit(1);
});
