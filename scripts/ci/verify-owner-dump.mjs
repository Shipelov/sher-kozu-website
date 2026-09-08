#!/usr/bin/env node
/**
 * Проверка логического дампа перед шифрованием и импортом:
 *   - число `CREATE TABLE` равно ожидаемому (--expected-tables);
 *   - файл завершён корректно: mysqldump заканчивает строкой `-- Dump completed`,
 *     Dumpling — последним statement с `;`;
 *   - в данных нет артефактов самописных экспортов: '[object Object]', ',,,'.
 *
 * node scripts/ci/verify-owner-dump.mjs --file dump.sql --expected-tables 96 --tool mysqldump [--summary out.json]
 * node scripts/ci/verify-owner-dump.mjs --self-test
 */
import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";

const BAD_MARKERS = ["[object Object]", ",,,"];

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

export async function verifyDump({ file, expectedTables, tool }) {
  const problems = [];
  let createTableCount = 0;
  let lines = 0;
  let bytes = 0;
  let lastNonEmpty = "";
  const markerHits = Object.fromEntries(BAD_MARKERS.map((m) => [m, 0]));

  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    lines += 1;
    bytes += Buffer.byteLength(line) + 1;
    if (/^CREATE TABLE /.test(line)) createTableCount += 1;
    if (line.trim() !== "") lastNonEmpty = line;
    for (const marker of BAD_MARKERS) {
      if (line.includes(marker)) markerHits[marker] += 1;
    }
  }

  if (createTableCount !== expectedTables) {
    problems.push(`CREATE TABLE: ${createTableCount}, ожидалось ${expectedTables}`);
  }
  if (tool === "mysqldump") {
    if (!/^-- Dump completed/.test(lastNonEmpty)) {
      problems.push("файл не заканчивается строкой '-- Dump completed' — дамп оборван");
    }
  } else if (!/;\s*$/.test(lastNonEmpty)) {
    problems.push("последний statement не завершён ';' — дамп оборван");
  }
  for (const marker of BAD_MARKERS) {
    if (markerHits[marker] > 0) problems.push(`найден артефакт '${marker}': ${markerHits[marker]} строк`);
  }
  if (lines === 0) problems.push("файл пуст");

  return { file: path.basename(file), tool, lines, bytes, createTableCount, expectedTables, markerHits, ok: problems.length === 0, problems };
}

async function selfTest() {
  const dir = await mkdtemp(path.join(tmpdir(), "verify-dump-"));
  const good = [
    "-- MySQL dump 10.13  Distrib 8.0.40",
    "/*!40101 SET NAMES utf8mb4 */;",
    "DROP TABLE IF EXISTS `a`;",
    "CREATE TABLE `a` (`id` int NOT NULL, `payload` json DEFAULT NULL) ENGINE=InnoDB;",
    "INSERT INTO `a` VALUES (1,'{\"k\":[1,2]}'),(2,NULL);",
    "CREATE TABLE `b` (`id` int NOT NULL) ENGINE=InnoDB;",
    "INSERT INTO `b` VALUES (1);",
    "",
    "-- Dump completed on 2026-09-08 10:00:00",
    "",
  ].join("\n");
  const cases = [
    { name: "корректный mysqldump", body: good, tool: "mysqldump", expected: 2, ok: true },
    { name: "оборванный mysqldump", body: good.replace(/-- Dump completed[^\n]*\n/, ""), tool: "mysqldump", expected: 2, ok: false },
    { name: "не то число таблиц", body: good, tool: "mysqldump", expected: 3, ok: false },
    { name: "'[object Object]' в данных", body: good.replace("(2,NULL)", "(2,'[object Object]')"), tool: "mysqldump", expected: 2, ok: false },
    { name: "',,,' вместо NULL", body: good.replace("(2,NULL)", "(2,',,,')"), tool: "mysqldump", expected: 2, ok: false },
    { name: "Dumpling без completion-строки", body: good.replace(/-- Dump completed[^\n]*\n/, ""), tool: "dumpling", expected: 2, ok: true },
    { name: "Dumpling с оборванным statement", body: "CREATE TABLE `a` (`id` int);\nINSERT INTO `a` VALUES (1),(2", tool: "dumpling", expected: 1, ok: false },
    { name: "пустой файл", body: "", tool: "mysqldump", expected: 0, ok: false },
  ];
  let failures = 0;
  try {
    for (const [index, item] of cases.entries()) {
      const file = path.join(dir, `case-${index}.sql`);
      await writeFile(file, item.body);
      const result = await verifyDump({ file, expectedTables: item.expected, tool: item.tool });
      const pass = result.ok === item.ok;
      if (!pass) failures += 1;
      console.log(`${pass ? "ok  " : "FAIL"} ${item.name}${pass ? "" : `: ${JSON.stringify(result.problems)}`}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  if (failures > 0) throw new Error(`verify-owner-dump self-test: ${failures} ошибок`);
  console.log(JSON.stringify({ selfTest: "ok", cases: cases.length }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["self-test"]) return selfTest();
  const file = args.file;
  const expectedTables = Number(args["expected-tables"]);
  const tool = args.tool ?? "mysqldump";
  if (!file || !Number.isInteger(expectedTables) || expectedTables < 0) {
    throw new Error("Нужны --file <dump.sql> и --expected-tables <N>");
  }
  if (!["mysqldump", "dumpling"].includes(tool)) throw new Error(`Неизвестный --tool: ${tool}`);
  const result = await verifyDump({ file, expectedTables, tool });
  const summary = `${JSON.stringify(result, null, 2)}\n`;
  if (args.summary) await writeFile(args.summary, summary);
  console.log(summary);
  if (!result.ok) {
    console.error(`[verify-owner-dump] дамп непригоден: ${result.problems.join("; ")}`);
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[verify-owner-dump] ${error?.message ?? error}`);
    process.exit(1);
  });
}
