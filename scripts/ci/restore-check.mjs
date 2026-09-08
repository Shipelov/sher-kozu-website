#!/usr/bin/env node
/**
 * Проверка восстановления бэкапа в базу test (koza-rehearsal): число таблиц и COUNT(*)
 * по N крупнейшим таблицам сверяются со stats.json, снятым на VDS сразу после дампа.
 *
 * node scripts/ci/restore-check.mjs --stats sherkozu-2026-09-08.stats.json \
 *   [--expected-tables 96] [--top 10] [--tolerance-percent 1] [--output restore-check.json]
 * Env: REHEARSAL_DATABASE_URL (имя базы обязано быть test). Только чтение.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { collectTableRows, parseDatabaseUrl } from "./rehearsalLib.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key.slice(2)] = true;
    } else {
      args[key.slice(2)] = next;
      i += 1;
    }
  }
  return args;
}

/**
 * Чистая сверка: source/target — [{ tableName, rowCount }]. Возвращает отчёт и список
 * проблем. Допуск нужен, потому что живые таблицы (аналитика, уведомления) меняются
 * между mysqldump и COUNT(*) на VDS.
 */
export function compareStats({ source, target, expectedTables, top = 10, tolerancePercent = 1 }) {
  const problems = [];
  const sourceMap = new Map(source.map((t) => [t.tableName, t.rowCount]));
  const targetMap = new Map(target.map((t) => [t.tableName, t.rowCount]));
  if (expectedTables !== undefined && source.length !== expectedTables) {
    problems.push(`таблиц в источнике ${source.length}, ожидалось ${expectedTables}`);
  }
  if (target.length !== source.length) problems.push(`таблиц в test ${target.length}, в источнике ${source.length}`);
  const missing = source.filter((t) => !targetMap.has(t.tableName)).map((t) => t.tableName);
  const extra = target.filter((t) => !sourceMap.has(t.tableName)).map((t) => t.tableName);
  if (missing.length) problems.push(`нет в test: ${missing.join(", ")}`);
  if (extra.length) problems.push(`лишние в test: ${extra.join(", ")}`);

  const largest = [...source].sort((a, b) => b.rowCount - a.rowCount || a.tableName.localeCompare(b.tableName)).slice(0, top);
  const rows = largest.map((t) => {
    const targetRows = targetMap.get(t.tableName) ?? null;
    const diff = targetRows === null ? null : targetRows - t.rowCount;
    const allowed = Math.ceil((t.rowCount * tolerancePercent) / 100);
    const ok = diff !== null && Math.abs(diff) <= allowed;
    return { tableName: t.tableName, sourceRows: t.rowCount, targetRows, difference: diff, allowedDifference: allowed, ok };
  });
  for (const row of rows) {
    if (!row.ok) problems.push(`${row.tableName}: источник ${row.sourceRows}, test ${row.targetRows ?? "нет"}, допуск ±${row.allowedDifference}`);
  }
  return {
    ok: problems.length === 0,
    tableCount: { source: source.length, target: target.length, expected: expectedTables ?? null },
    missingInTarget: missing,
    extraInTarget: extra,
    largestTables: rows,
    tolerancePercent,
    problems,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stats) throw new Error("нужен --stats <file.json>");
  const targetUrl = process.env.REHEARSAL_DATABASE_URL;
  if (!targetUrl) throw new Error("переменная REHEARSAL_DATABASE_URL не задана или пуста");
  const options = parseDatabaseUrl(targetUrl);
  if (options.database !== "test") throw new Error(`Safety stop: база репетиции должна называться test, получено ${options.database || "(пусто)"}`);

  const stats = JSON.parse(await readFile(path.resolve(args.stats), "utf8"));
  if (!Array.isArray(stats.tables)) throw new Error("stats.json без поля tables");
  const expectedTables = args["expected-tables"] !== undefined ? Number(args["expected-tables"]) : undefined;
  const top = Number(args.top ?? 10);
  const tolerancePercent = Number(args["tolerance-percent"] ?? 1);

  const conn = await mysql.createConnection(options);
  let target;
  try {
    target = await collectTableRows(conn);
  } finally {
    await conn.end();
  }
  const report = {
    createdAt: new Date().toISOString(),
    sourceDatabase: stats.database ?? null,
    sourceStatsAt: stats.createdAt ?? null,
    ...compareStats({ source: stats.tables, target, expectedTables, top, tolerancePercent }),
  };
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) await writeFile(path.resolve(args.output), text);
  console.log(text);
  if (!report.ok) {
    console.error(`[restore-check] восстановление не прошло проверку: ${report.problems.join("; ")}`);
    process.exit(1);
  }
  console.log(`[restore-check] ok: таблиц ${report.tableCount.target}, крупнейших сверено ${report.largestTables.length}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[restore-check] ${error?.message ?? error}`);
    process.exit(1);
  });
}
