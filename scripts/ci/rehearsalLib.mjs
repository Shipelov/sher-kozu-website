/**
 * Общая логика репетиции миграции на managed TiDB. Извлечена из
 * run-managed-tidb-rehearsal.mjs (сценарий Manus остаётся нетронутым и живёт до
 * завершения аудита); run-owner-dump-rehearsal.mjs использует эти функции после
 * импорта дампа владельца.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const journalPath = path.join(repoRoot, "drizzle/meta/_journal.json");

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

export function migrationMetadata(journal, tag) {
  const entry = journal.entries.find((item) => item.tag === tag);
  if (!entry) throw new Error(`Missing migration journal entry: ${tag}`);
  return entry;
}

export async function readJournalBaselines() {
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  const baseline0021 = migrationMetadata(journal, "0021_users_columns_baseline");
  const baseline0022 = migrationMetadata(journal, "0022_jazzy_naoko");
  const baseline0060a = migrationMetadata(journal, "0060a_milk_module_baseline");
  const baseline0061 = migrationMetadata(journal, "0061_slimy_fixer");
  const baseline0066 = migrationMetadata(journal, "0066_low_whiplash");
  if (!(baseline0021.when < baseline0022.when && baseline0060a.when < baseline0061.when)) {
    throw new Error("Baseline migration timestamps do not precede their successors");
  }
  if (journal.entries.at(-1)?.tag !== baseline0066.tag) {
    throw new Error("Safety stop: 0066 is not the last migration");
  }
  return { journal, baseline0021, baseline0060a, baseline0066 };
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

export async function schemaFingerprint(connection) {
  const definitions = [];
  for (const tableName of await listBaseTables(connection)) {
    if (tableName === "__drizzle_migrations") continue;
    const [[row]] = await connection.query(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`);
    definitions.push(
      String(row["Create Table"])
        .replace(/AUTO_INCREMENT=\d+\s*/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return sha256(definitions.join("\n"));
}

export async function verifyPhysical0066(connection, migrationSql) {
  const columns = [...migrationSql.matchAll(/ALTER TABLE `([^`]+)` ADD `([^`]+)`/g)].map((match) => ({
    tableName: match[1],
    columnName: match[2],
  }));
  const indexes = [...migrationSql.matchAll(/CREATE INDEX `([^`]+)` ON `([^`]+)`/g)].map((match) => ({
    indexName: match[1],
    tableName: match[2],
  }));
  if (columns.length !== 22 || indexes.length !== 4) {
    throw new Error(`Unexpected 0066 shape: ${columns.length} columns, ${indexes.length} indexes`);
  }
  for (const item of columns) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [item.tableName, item.columnName],
    );
    if (Number(row.n) !== 1) throw new Error(`0066 column is absent: ${item.tableName}.${item.columnName}`);
  }
  for (const item of indexes) {
    const [[row]] = await connection.query(
      `SELECT COUNT(DISTINCT index_name) AS n FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [item.tableName, item.indexName],
    );
    if (Number(row.n) !== 1) throw new Error(`0066 index is absent: ${item.tableName}.${item.indexName}`);
  }
  return { columnCount: columns.length, indexCount: indexes.length };
}

export async function readLedger(connection, { baseline0021, baseline0060a, baseline0066 }) {
  const [[ledger]] = await connection.query(
    `SELECT COUNT(*) AS rowCount, MAX(created_at) AS maxCreatedAt,
            SUM(created_at = ?) AS has0021,
            SUM(created_at = ?) AS has0060a,
            SUM(created_at = ?) AS has0066
       FROM __drizzle_migrations`,
    [baseline0021.when, baseline0060a.when, baseline0066.when],
  );
  return {
    rowCount: Number(ledger.rowCount),
    maxCreatedAt: Number(ledger.maxCreatedAt),
    has0021: Number(ledger.has0021),
    has0060a: Number(ledger.has0060a),
    has0066: Number(ledger.has0066),
  };
}

/** pnpm exec … с DATABASE_URL цели; лог без URL и пароля */
export async function runCommand(label, args, databaseUrl, logPath) {
  const started = performance.now();
  const result = spawnSync("pnpm", args, {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  const elapsedMs = Math.round(performance.now() - started);
  const password = decodeURIComponent(new URL(databaseUrl).password);
  let sanitized = `${result.stdout ?? ""}${result.stderr ?? ""}`.replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]");
  if (password) sanitized = sanitized.replaceAll(password, "[REDACTED_PASSWORD]");
  await writeFile(logPath, sanitized, { mode: 0o600 });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
  return elapsedMs;
}

/**
 * Всё, что происходит после импорта дампа в базу test:
 * physical 0066 → baseline в ledger → drizzle-kit migrate (no-op) → drizzle-kit check →
 * сверка строк с источником. Пишет row-diff.json и rehearsal-result.json.
 *
 * sourceStats: [{ tableName, rowCount }] — COUNT(*) источника (manifest дампа или
 * прямой SELECT COUNT). strictRowParity: падать при расхождении строк; иначе
 * расхождение только фиксируется (живая база могла измениться между dump и COUNT).
 */
export async function runPostImportRehearsal({
  targetUrl,
  expectedTableCount,
  sourceStats,
  sourceInfo,
  outputDir,
  extraTimings = {},
  strictRowParity = false,
}) {
  const targetOptions = parseDatabaseUrl(targetUrl);
  if (targetOptions.database !== "test") {
    throw new Error(`Safety stop: rehearsal database must be named test, got ${targetOptions.database || "empty"}`);
  }
  const baselines = await readJournalBaselines();
  const { baseline0021, baseline0060a, baseline0066 } = baselines;
  const timings = { ...extraTimings };

  const target = await mysql.createConnection(targetOptions);
  let schemaBeforeMigrate;
  let ledgerAfterBaseline;
  let physical0066;
  let importedTableCount;
  try {
    importedTableCount = (await listBaseTables(target)).length;
    if (importedTableCount !== expectedTableCount) {
      throw new Error(`Imported table count mismatch: expected ${expectedTableCount}, got ${importedTableCount}`);
    }
    const migration0066Sql = await readFile(path.join(repoRoot, "drizzle/0066_low_whiplash.sql"), "utf8");
    physical0066 = await verifyPhysical0066(target, migration0066Sql);

    const baselineStarted = performance.now();
    await target.query(
      `INSERT INTO __drizzle_migrations (hash, created_at)
       SELECT ?, ? WHERE NOT EXISTS (
         SELECT 1 FROM __drizzle_migrations WHERE created_at = ?
       )`,
      [sha256(migration0066Sql), baseline0066.when, baseline0066.when],
    );
    timings.baseline0066Ms = Math.round(performance.now() - baselineStarted);
    ledgerAfterBaseline = await readLedger(target, baselines);
    if (ledgerAfterBaseline.maxCreatedAt !== baseline0066.when || ledgerAfterBaseline.has0066 !== 1) {
      throw new Error("0066 baseline is not the unique latest ledger row");
    }
    if (!(baseline0021.when < baseline0066.when && baseline0060a.when < baseline0066.when)) {
      throw new Error("0021/0060a are not older than 0066");
    }
    schemaBeforeMigrate = await schemaFingerprint(target);
  } finally {
    await target.end();
  }

  timings.drizzleMigrateMs = await runCommand(
    "drizzle-kit migrate",
    ["exec", "drizzle-kit", "migrate"],
    targetUrl,
    path.join(outputDir, "migration-output.log"),
  );
  timings.drizzleCheckMs = await runCommand(
    "drizzle-kit check",
    ["exec", "drizzle-kit", "check"],
    targetUrl,
    path.join(outputDir, "drizzle-check-output.log"),
  );

  const verifyStarted = performance.now();
  const verified = await mysql.createConnection(parseDatabaseUrl(targetUrl));
  let targetStats;
  let schemaAfterMigrate;
  let ledgerAfterMigrate;
  try {
    targetStats = await collectTableRows(verified);
    schemaAfterMigrate = await schemaFingerprint(verified);
    ledgerAfterMigrate = await readLedger(verified, baselines);
  } finally {
    await verified.end();
  }
  timings.validationMs = Math.round(performance.now() - verifyStarted);

  const targetMap = new Map(targetStats.map((item) => [item.tableName, item.rowCount]));
  const sourceMap = new Map(sourceStats.map((item) => [item.tableName, item.rowCount]));
  const rowDiff = sourceStats.map((item) => {
    const expectedDelta = item.tableName === "__drizzle_migrations" ? 1 : 0;
    const targetRows = targetMap.get(item.tableName) ?? null;
    const rawDifference = targetRows === null ? null : targetRows - item.rowCount;
    return {
      tableName: item.tableName,
      sourceRows: item.rowCount,
      targetRows,
      expectedDeltaAfter0066Baseline: expectedDelta,
      rawDifference,
      normalizedDifference: rawDifference === null ? null : rawDifference - expectedDelta,
    };
  });
  const missingInTarget = rowDiff.filter((item) => item.targetRows === null).map((item) => item.tableName);
  const extraInTarget = targetStats.filter((item) => !sourceMap.has(item.tableName)).map((item) => item.tableName);
  const mismatchCount = rowDiff.filter((item) => item.normalizedDifference !== 0).length;

  const baselineSkipped = {
    migration0021: ledgerAfterMigrate.has0021 === 0 && baseline0021.when < ledgerAfterMigrate.maxCreatedAt,
    migration0060a: ledgerAfterMigrate.has0060a === 0 && baseline0060a.when < ledgerAfterMigrate.maxCreatedAt,
    proof:
      "Both baseline timestamps are absent and older than the unique latest 0066 ledger row; Drizzle migrate made no schema or ledger changes.",
  };
  const noOpMigrate =
    schemaBeforeMigrate === schemaAfterMigrate &&
    ledgerAfterBaseline.rowCount === ledgerAfterMigrate.rowCount &&
    ledgerAfterBaseline.maxCreatedAt === ledgerAfterMigrate.maxCreatedAt;

  const result = {
    createdAt: new Date().toISOString(),
    source: sourceInfo,
    target: {
      database: "test",
      tableCount: targetStats.length,
      exactRows: targetStats.reduce((sum, item) => sum + item.rowCount, 0),
    },
    physical0066,
    ledgerAfterBaseline,
    ledgerAfterMigrate,
    baselineSkipped,
    noOpMigrate,
    schemaFingerprintBeforeMigrate: schemaBeforeMigrate,
    schemaFingerprintAfterMigrate: schemaAfterMigrate,
    rowParity: { tableCount: rowDiff.length, mismatchCount, missingInTarget, extraInTarget, strict: strictRowParity },
    drizzleKitCheck: "passed",
    timingsMs: timings,
    productionMutations: 0,
  };
  await writeFile(path.join(outputDir, "row-diff.json"), `${JSON.stringify(rowDiff, null, 2)}\n`);
  await writeFile(path.join(outputDir, "rehearsal-result.json"), `${JSON.stringify(result, null, 2)}\n`);

  const structuralProblems = [];
  if (targetStats.length !== expectedTableCount) structuralProblems.push("table count");
  if (!noOpMigrate) structuralProblems.push("drizzle-kit migrate was not a no-op");
  if (!baselineSkipped.migration0021 || !baselineSkipped.migration0060a) structuralProblems.push("0021/0060a not skipped");
  if (missingInTarget.length || extraInTarget.length) structuralProblems.push("table set differs from source");
  if (structuralProblems.length) {
    throw new Error(`Rehearsal validation failed: ${structuralProblems.join(", ")}; inspect safe result files`);
  }
  if (mismatchCount > 0) {
    const message = `Row parity: ${mismatchCount} of ${rowDiff.length} tables differ from source COUNT(*)`;
    if (strictRowParity) throw new Error(`${message} (strict mode)`);
    console.warn(`[rehearsal] ${message}; see row-diff.json`);
  }
  return { result, rowDiff };
}
