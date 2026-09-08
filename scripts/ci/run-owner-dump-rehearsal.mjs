#!/usr/bin/env node
/**
 * Репетиция миграции на дампе владельца, снятом mysqldump/Dumpling прямо с
 * managed-базы. Запускается после импорта дампа в базу test (REHEARSAL_DATABASE_URL).
 *
 * Источник (SOURCE_DATABASE_URL) читается только через SELECT COUNT(*) по таблицам —
 * ни одной записи. Всё остальное делает runPostImportRehearsal из rehearsalLib.mjs.
 *
 * Env: SOURCE_DATABASE_URL, REHEARSAL_DATABASE_URL, EXPECTED_TABLE_COUNT (96),
 *      OUTPUT_DIR (rehearsal-output), STEP_TIMINGS_FILE (key=ms по строкам),
 *      DUMP_TOOL (mysqldump|dumpling), STRICT_ROW_PARITY (1 — падать при расхождении).
 * node scripts/ci/run-owner-dump-rehearsal.mjs --self-test — проверка журнала миграций.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import {
  collectTableRows,
  parseDatabaseUrl,
  readJournalBaselines,
  repoRoot,
  runPostImportRehearsal,
} from "./rehearsalLib.mjs";

const outputDir = path.resolve(repoRoot, process.env.OUTPUT_DIR ?? "rehearsal-output");
const expectedTableCount = Number(process.env.EXPECTED_TABLE_COUNT ?? 96);

async function readStepTimings(file) {
  if (!file) return {};
  try {
    const text = await readFile(file, "utf8");
    const timings = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_]+)=(\d+)$/);
      if (match) timings[match[1]] = Number(match[2]);
    }
    return timings;
  } catch {
    return {};
  }
}

async function selfTest() {
  const { baseline0021, baseline0060a, baseline0066 } = await readJournalBaselines();
  if (!Number.isInteger(expectedTableCount) || expectedTableCount <= 0) {
    throw new Error("EXPECTED_TABLE_COUNT must be a positive integer");
  }
  console.log(JSON.stringify({ selfTest: "ok", baseline0021, baseline0060a, baseline0066, expectedTableCount }));
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.REHEARSAL_DATABASE_URL;
  if (!sourceUrl || !targetUrl) throw new Error("SOURCE_DATABASE_URL and REHEARSAL_DATABASE_URL are required");
  if (sourceUrl === targetUrl) throw new Error("Safety stop: source and rehearsal URLs are identical");
  const sourceOptions = parseDatabaseUrl(sourceUrl);
  const targetOptions = parseDatabaseUrl(targetUrl);
  if (targetOptions.database !== "test") {
    throw new Error(`Safety stop: rehearsal database must be named test, got ${targetOptions.database || "empty"}`);
  }
  if (sourceOptions.host === targetOptions.host && sourceOptions.database === targetOptions.database && sourceOptions.user === targetOptions.user) {
    throw new Error("Safety stop: source and rehearsal point to the same database");
  }
  await mkdir(outputDir, { recursive: true });

  // Источник: только COUNT(*) по базовым таблицам
  const countStarted = performance.now();
  const source = await mysql.createConnection(sourceOptions);
  let sourceStats;
  let serverVersion;
  try {
    const [[versionRow]] = await source.query("SELECT VERSION() AS v");
    serverVersion = String(versionRow.v);
    sourceStats = await collectTableRows(source);
  } finally {
    await source.end();
  }
  const sourceCountMs = Math.round(performance.now() - countStarted);
  if (sourceStats.length !== expectedTableCount) {
    throw new Error(`Source table count mismatch: expected ${expectedTableCount}, got ${sourceStats.length}`);
  }

  const stepTimings = await readStepTimings(process.env.STEP_TIMINGS_FILE);
  const { result } = await runPostImportRehearsal({
    targetUrl,
    expectedTableCount,
    sourceStats,
    sourceInfo: {
      dumpTool: process.env.DUMP_TOOL ?? "unknown",
      serverVersion,
      tableCount: sourceStats.length,
      exactRows: sourceStats.reduce((sum, item) => sum + item.rowCount, 0),
      countedAt: new Date().toISOString(),
      sourceDatabaseQueries: sourceStats.length + 2,
      sourceDatabaseWrites: 0,
    },
    outputDir,
    extraTimings: { ...stepTimings, sourceCountMs },
    strictRowParity: process.env.STRICT_ROW_PARITY === "1",
  });

  console.log(
    JSON.stringify({
      status: "ok",
      tables: result.rowParity.tableCount,
      rowMismatches: result.rowParity.mismatchCount,
      noOpMigrate: result.noOpMigrate,
      baselineSkipped: result.baselineSkipped,
      timingsMs: result.timingsMs,
    }),
  );
}

main().catch((error) => {
  console.error(`[owner-rehearsal] ${error?.message ?? error}`);
  process.exit(1);
});
