#!/usr/bin/env node
/**
 * Проверка воспроизводимости цепочки миграций на пустой базе.
 *
 * 1. Создаёт временную схему `migration_check_<id>` на сервере из
 *    MIGRATION_CHECK_DATABASE_URL | TEST_DATABASE_URL | DATABASE_URL.
 * 2. Прогоняет drizzle-migrator по всей цепочке из drizzle/meta/_journal.json.
 * 3. Сравнивает результат с последним drizzle/meta/NNNN_snapshot.json:
 *    таблицы, колонки, nullable, индексы и unique-констрейнты должны совпасть.
 * 4. Удаляет временную схему (флаг --keep оставляет её для разбора).
 *
 * Существующие схемы на сервере не читаются и не изменяются.
 * Нужна привилегия CREATE DATABASE / DROP DATABASE.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = path.join(repoRoot, "drizzle");
const keepSchema = process.argv.includes("--keep");

function pickDatabaseUrl() {
  for (const name of ["MIGRATION_CHECK_DATABASE_URL", "TEST_DATABASE_URL", "DATABASE_URL"]) {
    const value = process.env[name]?.trim();
    if (value) return { name, value };
  }
  throw new Error(
    "Не задан адрес базы: укажите MIGRATION_CHECK_DATABASE_URL, TEST_DATABASE_URL или DATABASE_URL",
  );
}

function connectionOptions(urlString, database) {
  const url = new URL(urlString);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const sslParam = url.searchParams.get("ssl") ?? url.searchParams.get("sslaccept");
  const useSsl = sslParam ? sslParam !== "false" && sslParam !== "disable" : !isLocal;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    timezone: "Z",
    connectTimeout: 15_000,
    ...(useSsl ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false } } : {}),
  };
}

function loadLatestSnapshot() {
  const metaDir = path.join(migrationsFolder, "meta");
  const files = readdirSync(metaDir)
    .filter((f) => /^\d+_snapshot\.json$/.test(f))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  const latest = files.at(-1);
  if (!latest) throw new Error("В drizzle/meta нет snapshot-файлов");
  return { name: latest, snapshot: JSON.parse(readFileSync(path.join(metaDir, latest), "utf8")) };
}

function loadJournal() {
  return JSON.parse(readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
}

/** Тип из snapshot → COLUMN_TYPE MySQL для мягкого сравнения (только предупреждения). */
function normalizeType(type) {
  return String(type)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^boolean$/, "tinyint(1)")
    .replace(/^int\(\d+\)$/, "int")
    .replace(/^bigint\(\d+\)$/, "bigint")
    .replace(/^tinyint\(1\)$/, "tinyint(1)");
}

async function collectActualSchema(conn, schemaName) {
  const [columns] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [schemaName],
  );
  const [indexes] = await conn.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND INDEX_NAME <> 'PRIMARY'
      GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE`,
    [schemaName],
  );
  const tables = new Map();
  for (const row of columns) {
    const table = tables.get(row.TABLE_NAME) ?? { columns: new Map(), indexes: new Set() };
    table.columns.set(row.COLUMN_NAME, {
      nullable: row.IS_NULLABLE === "YES",
      type: String(row.COLUMN_TYPE),
    });
    tables.set(row.TABLE_NAME, table);
  }
  for (const row of indexes) {
    tables.get(row.TABLE_NAME)?.indexes.add(row.INDEX_NAME);
  }
  return tables;
}

function compareWithSnapshot(actual, snapshot) {
  const errors = [];
  const warnings = [];
  const expectedTables = Object.values(snapshot.tables);
  const expectedNames = new Set(expectedTables.map((t) => t.name));

  for (const name of actual.keys()) {
    if (name === "__drizzle_migrations") continue;
    if (!expectedNames.has(name)) errors.push(`лишняя таблица в базе: ${name}`);
  }

  for (const table of expectedTables) {
    const real = actual.get(table.name);
    if (!real) {
      errors.push(`таблица отсутствует после миграций: ${table.name}`);
      continue;
    }
    for (const column of Object.values(table.columns)) {
      const realColumn = real.columns.get(column.name);
      if (!realColumn) {
        errors.push(`колонка отсутствует: ${table.name}.${column.name}`);
        continue;
      }
      if (realColumn.nullable === Boolean(column.notNull)) {
        errors.push(
          `nullable не совпадает: ${table.name}.${column.name} (snapshot notNull=${Boolean(column.notNull)})`,
        );
      }
      if (normalizeType(realColumn.type) !== normalizeType(column.type)) {
        warnings.push(
          `тип отличается: ${table.name}.${column.name} snapshot=${column.type} db=${realColumn.type}`,
        );
      }
    }
    for (const name of real.columns.keys()) {
      if (!table.columns[name]) errors.push(`лишняя колонка в базе: ${table.name}.${name}`);
    }

    const expectedIndexes = new Set([
      ...Object.keys(table.indexes ?? {}),
      ...Object.keys(table.uniqueConstraints ?? {}),
    ]);
    for (const name of expectedIndexes) {
      if (!real.indexes.has(name)) errors.push(`индекс отсутствует: ${table.name}.${name}`);
    }
    for (const name of real.indexes) {
      if (!expectedIndexes.has(name)) errors.push(`лишний индекс в базе: ${table.name}.${name}`);
    }
  }
  return { errors, warnings };
}

async function main() {
  const { name: urlSource, value: baseUrl } = pickDatabaseUrl();
  const schemaName = `migration_check_${randomBytes(4).toString("hex")}`;
  const journal = loadJournal();
  const { name: snapshotName, snapshot } = loadLatestSnapshot();

  console.log(`[migrations] источник адреса: ${urlSource}, временная схема: ${schemaName}`);
  console.log(`[migrations] записей в журнале: ${journal.entries.length}, эталон: ${snapshotName}`);

  const admin = await mysql.createConnection(connectionOptions(baseUrl, undefined));
  let target = null;
  let exitCode = 1;
  try {
    await admin.query(`CREATE DATABASE \`${schemaName}\``);
    target = await mysql.createConnection(connectionOptions(baseUrl, schemaName));

    const startedAt = Date.now();
    await migrate(drizzle(target), { migrationsFolder });
    console.log(`[migrations] цепочка применена за ${Date.now() - startedAt} мс`);

    const [rows] = await target.query("SELECT COUNT(*) AS n FROM `__drizzle_migrations`");
    const applied = Number(rows[0]?.n ?? 0);
    if (applied !== journal.entries.length) {
      throw new Error(
        `в __drizzle_migrations ${applied} записей, а в журнале ${journal.entries.length}`,
      );
    }

    const actual = await collectActualSchema(target, schemaName);
    const { errors, warnings } = compareWithSnapshot(actual, snapshot);
    for (const warning of warnings) console.warn(`[migrations] warn: ${warning}`);
    if (errors.length > 0) {
      for (const error of errors) console.error(`[migrations] FAIL: ${error}`);
      console.error(`[migrations] расхождений со snapshot: ${errors.length}`);
    } else {
      console.log(
        `[migrations] OK: ${Object.keys(snapshot.tables).length} таблиц совпадают со snapshot ${snapshotName}`,
      );
      exitCode = 0;
    }
  } finally {
    await target?.end().catch(() => undefined);
    if (keepSchema) {
      console.log(`[migrations] схема ${schemaName} оставлена (--keep)`);
    } else {
      await admin.query(`DROP DATABASE IF EXISTS \`${schemaName}\``).catch((error) => {
        console.error(`[migrations] не удалось удалить ${schemaName}:`, error?.message ?? error);
      });
    }
    await admin.end().catch(() => undefined);
  }
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("[migrations] ошибка:", error?.message ?? error);
  process.exit(1);
});
