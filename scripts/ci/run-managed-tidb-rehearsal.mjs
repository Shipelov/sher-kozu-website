#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = path.resolve(repoRoot, process.env.OUTPUT_DIR ?? "rehearsal-output");
const journalPath = path.join(repoRoot, "drizzle/meta/_journal.json");
const expectedTableCount = Number(process.env.EXPECTED_TABLE_COUNT ?? 96);

const sha256 = value => createHash("sha256").update(value).digest("hex");
const quoteIdentifier = value => `\`${String(value).replaceAll("`", "``")}\``;

function parseDatabaseUrl(value, multipleStatements = false) {
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

function migrationMetadata(journal, tag) {
  const entry = journal.entries.find(item => item.tag === tag);
  if (!entry) throw new Error(`Missing migration journal entry: ${tag}`);
  return entry;
}

async function collectTableRows(connection) {
  const [tableRows] = await connection.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  const stats = [];
  for (const { tableName } of tableRows) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS n FROM ${quoteIdentifier(tableName)}`,
    );
    stats.push({ tableName, rowCount: Number(row.n) });
  }
  return stats;
}

async function schemaFingerprint(connection) {
  const [tables] = await connection.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
        AND table_name <> '__drizzle_migrations'
      ORDER BY table_name`,
  );
  const definitions = [];
  for (const { tableName } of tables) {
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

async function verifyPhysical0066(connection, migrationSql) {
  const columns = [...migrationSql.matchAll(/ALTER TABLE `([^`]+)` ADD `([^`]+)`/g)].map(
    match => ({ tableName: match[1], columnName: match[2] }),
  );
  const indexes = [...migrationSql.matchAll(/CREATE INDEX `([^`]+)` ON `([^`]+)`/g)].map(
    match => ({ indexName: match[1], tableName: match[2] }),
  );
  if (columns.length !== 22 || indexes.length !== 4) {
    throw new Error(`Unexpected 0066 shape: ${columns.length} columns, ${indexes.length} indexes`);
  }
  for (const item of columns) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [item.tableName, item.columnName],
    );
    if (Number(row.n) !== 1) {
      throw new Error(`0066 column is absent: ${item.tableName}.${item.columnName}`);
    }
  }
  for (const item of indexes) {
    const [[row]] = await connection.query(
      `SELECT COUNT(DISTINCT index_name) AS n FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [item.tableName, item.indexName],
    );
    if (Number(row.n) !== 1) {
      throw new Error(`0066 index is absent: ${item.tableName}.${item.indexName}`);
    }
  }
  return { columnCount: columns.length, indexCount: indexes.length };
}

async function runCommand(label, args, databaseUrl, logPath) {
  const started = performance.now();
  const result = spawnSync("pnpm", args, {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const elapsedMs = Math.round(performance.now() - started);
  const password = decodeURIComponent(new URL(databaseUrl).password);
  const sanitized = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]")
    .replaceAll(password, "[REDACTED_PASSWORD]");
  await writeFile(logPath, sanitized, { mode: 0o600 });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
  return elapsedMs;
}

async function selfTest() {
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  const m0021 = migrationMetadata(journal, "0021_users_columns_baseline");
  const m0022 = migrationMetadata(journal, "0022_jazzy_naoko");
  const m0060a = migrationMetadata(journal, "0060a_milk_module_baseline");
  const m0061 = migrationMetadata(journal, "0061_slimy_fixer");
  const m0066 = migrationMetadata(journal, "0066_low_whiplash");
  if (!(m0021.when < m0022.when && m0060a.when < m0061.when)) {
    throw new Error("Baseline migration timestamps do not precede their successors");
  }
  if (journal.entries.at(-1)?.tag !== m0066.tag) {
    throw new Error("0066 is not the last migration");
  }
  console.log(JSON.stringify({ selfTest: "ok", m0021, m0060a, m0066 }));
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const targetUrl = process.env.REHEARSAL_DATABASE_URL;
  const dumpSqlPath = process.env.MANAGED_DUMP_SQL;
  const dumpManifestPath = process.env.MANAGED_DUMP_MANIFEST;
  if (!targetUrl || !dumpSqlPath || !dumpManifestPath) {
    throw new Error(
      "REHEARSAL_DATABASE_URL, MANAGED_DUMP_SQL and MANAGED_DUMP_MANIFEST are required",
    );
  }
  const targetOptions = parseDatabaseUrl(targetUrl, true);
  if (targetOptions.database !== "test") {
    throw new Error(
      `Safety stop: rehearsal database must be named test, got ${targetOptions.database || "empty"}`,
    );
  }

  await mkdir(outputDir, { recursive: true });
  const manifest = JSON.parse(await readFile(path.resolve(repoRoot, dumpManifestPath), "utf8"));
  const dumpSql = await readFile(path.resolve(repoRoot, dumpSqlPath), "utf8");
  const expectedDumpHash = manifest.files?.["managed-tidb-full.sql"]?.sha256;
  if (manifest.tableCount !== expectedTableCount || manifest.tableStats?.length !== expectedTableCount) {
    throw new Error(
      `Dump manifest table count mismatch: expected ${expectedTableCount}, got ${manifest.tableCount}`,
    );
  }
  if (!expectedDumpHash || sha256(dumpSql) !== expectedDumpHash) {
    throw new Error("Decrypted managed-tidb-full.sql does not match dump manifest SHA-256");
  }

  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  const baseline0021 = migrationMetadata(journal, "0021_users_columns_baseline");
  const baseline0060a = migrationMetadata(journal, "0060a_milk_module_baseline");
  const baseline0066 = migrationMetadata(journal, "0066_low_whiplash");
  if (journal.entries.at(-1)?.tag !== baseline0066.tag) {
    throw new Error("Safety stop: 0066 is not the last migration");
  }

  const timings = {};
  const target = await mysql.createConnection(targetOptions);
  let schemaBeforeMigrate;
  let ledgerAfterBaseline;
  let physical0066;
  try {
    const [[existing]] = await target.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
    );
    if (Number(existing.n) !== 0) {
      throw new Error(`Safety stop: rehearsal database is not empty (${existing.n} tables)`);
    }
    const importStarted = performance.now();
    await target.query(dumpSql);
    timings.importMs = Math.round(performance.now() - importStarted);

    const migration0066Sql = await readFile(
      path.join(repoRoot, "drizzle/0066_low_whiplash.sql"),
      "utf8",
    );
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
    const [[ledger]] = await target.query(
      `SELECT COUNT(*) AS rowCount, MAX(created_at) AS maxCreatedAt,
              SUM(created_at = ?) AS has0021,
              SUM(created_at = ?) AS has0060a,
              SUM(created_at = ?) AS has0066
         FROM __drizzle_migrations`,
      [baseline0021.when, baseline0060a.when, baseline0066.when],
    );
    ledgerAfterBaseline = {
      rowCount: Number(ledger.rowCount),
      maxCreatedAt: Number(ledger.maxCreatedAt),
      has0021: Number(ledger.has0021),
      has0060a: Number(ledger.has0060a),
      has0066: Number(ledger.has0066),
    };
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
    const [[ledger]] = await verified.query(
      `SELECT COUNT(*) AS rowCount, MAX(created_at) AS maxCreatedAt,
              SUM(created_at = ?) AS has0021,
              SUM(created_at = ?) AS has0060a,
              SUM(created_at = ?) AS has0066
         FROM __drizzle_migrations`,
      [baseline0021.when, baseline0060a.when, baseline0066.when],
    );
    ledgerAfterMigrate = {
      rowCount: Number(ledger.rowCount),
      maxCreatedAt: Number(ledger.maxCreatedAt),
      has0021: Number(ledger.has0021),
      has0060a: Number(ledger.has0060a),
      has0066: Number(ledger.has0066),
    };
  } finally {
    await verified.end();
  }
  timings.validationMs = Math.round(performance.now() - verifyStarted);

  const targetMap = new Map(targetStats.map(item => [item.tableName, item.rowCount]));
  const rowDiff = manifest.tableStats.map(item => {
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
  const mismatchCount = rowDiff.filter(item => item.normalizedDifference !== 0).length;
  const baselineSkipped = {
    migration0021:
      ledgerAfterMigrate.has0021 === 0 && baseline0021.when < ledgerAfterMigrate.maxCreatedAt,
    migration0060a:
      ledgerAfterMigrate.has0060a === 0 && baseline0060a.when < ledgerAfterMigrate.maxCreatedAt,
    proof:
      "Both baseline timestamps are absent and older than the unique latest 0066 ledger row; Drizzle migrate made no schema or ledger changes.",
  };
  const noOpMigrate =
    schemaBeforeMigrate === schemaAfterMigrate &&
    ledgerAfterBaseline.rowCount === ledgerAfterMigrate.rowCount &&
    ledgerAfterBaseline.maxCreatedAt === ledgerAfterMigrate.maxCreatedAt;
  const result = {
    createdAt: new Date().toISOString(),
    sourceDump: {
      createdAt: manifest.createdAt,
      serverVersion: manifest.serverVersion,
      snapshotPosition: manifest.snapshotPosition,
      tableCount: manifest.tableCount,
      exactRows: manifest.exactRows,
      fullSqlSha256: expectedDumpHash,
    },
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
    rowParity: { tableCount: rowDiff.length, mismatchCount },
    drizzleKitCheck: "passed",
    knownSourceSchemaDrift: [
      "notificationPreferences.productPlanUpdate exists in dump but not latest Drizzle snapshot",
    ],
    timingsMs: timings,
    sourceDatabaseQueries: 0,
    productionMutations: 0,
  };
  await writeFile(path.join(outputDir, "row-diff.json"), `${JSON.stringify(rowDiff, null, 2)}\n`);
  await writeFile(
    path.join(outputDir, "rehearsal-result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  if (
    targetStats.length !== expectedTableCount ||
    !noOpMigrate ||
    mismatchCount !== 0 ||
    !baselineSkipped.migration0021 ||
    !baselineSkipped.migration0060a
  ) {
    throw new Error("Rehearsal validation failed; inspect safe result files");
  }
  console.log(
    JSON.stringify({
      status: "ok",
      tables: rowDiff.length,
      rowMismatches: mismatchCount,
      noOpMigrate,
      baselineSkipped,
      timingsMs: timings,
    }),
  );
}

main().catch(error => {
  console.error(`[rehearsal] ${error?.message ?? error}`);
  process.exit(1);
});
