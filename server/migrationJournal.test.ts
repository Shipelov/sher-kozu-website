import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Офлайн-страховка целостности цепочки миграций. Полная проверка на пустой
 * базе — scripts/check-migrations-fresh.mjs (нужен MySQL/TiDB).
 */

type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };
type Journal = { version: string; dialect: string; entries: JournalEntry[] };

const drizzleDir = path.resolve(__dirname, "..", "drizzle");
const journal = JSON.parse(
  readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"),
) as Journal;
const migrationSql = (tag: string) => readFileSync(path.join(drizzleDir, `${tag}.sql`), "utf8");

const BASELINE_TAG = "0060a_milk_module_baseline";
const BASELINE_TABLES = [
  "farmWorkers",
  "milkAuditLog",
  "milkProcessingBatches",
  "milkReceptions",
  "milkSessionAnimals",
  "milkSessions",
  "milkTankMovements",
  "milkTanks",
  "productPlanSetupRequests",
];

describe("drizzle migration journal", () => {
  it("has strictly increasing timestamps and idx", () => {
    for (let i = 1; i < journal.entries.length; i += 1) {
      const prev = journal.entries[i - 1];
      const cur = journal.entries[i];
      expect(cur.when, `${cur.tag} when`).toBeGreaterThan(prev.when);
      expect(cur.idx, `${cur.tag} idx`).toBe(prev.idx + 1);
    }
  });

  it("has a SQL file for every entry and an entry for every SQL file", () => {
    const tags = new Set(journal.entries.map((e) => e.tag));
    for (const tag of tags) {
      expect(existsSync(path.join(drizzleDir, `${tag}.sql`)), `${tag}.sql`).toBe(true);
    }
    const files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
    for (const file of files) {
      expect(tags.has(file.replace(/\.sql$/, "")), `journal entry for ${file}`).toBe(true);
    }
  });

  it("places the milk-module baseline between 0060 and 0061", () => {
    const tags = journal.entries.map((e) => e.tag);
    const baseline = tags.indexOf(BASELINE_TAG);
    expect(baseline).toBeGreaterThan(-1);
    expect(tags[baseline - 1]).toBe("0060_jazzy_wolfsbane");
    expect(tags[baseline + 1]).toBe("0061_slimy_fixer");
  });

  it("fills the historic idx 21 gap with the users columns baseline", () => {
    const entry = journal.entries.find((e) => e.tag === "0021_users_columns_baseline");
    expect(entry?.idx).toBe(21);
    const sql = migrationSql("0021_users_columns_baseline");
    expect(sql).toContain("ALTER TABLE `users` ADD `primaryAnimalId` int");
    expect(sql).toContain("ALTER TABLE `users` DROP COLUMN `plainPassword`");
    // 0017 закомментирована и колонку не добавляет — иначе baseline был бы дублем
    expect(migrationSql("0017_fantastic_radioactive_man").trim().startsWith("--")).toBe(true);
  });

  it("baseline creates every table that was pushed without a migration", () => {
    const sql = migrationSql(BASELINE_TAG);
    for (const table of BASELINE_TABLES) {
      expect(sql, table).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
    }
    // Колонки, добавленные в 0048–0060 к существующим таблицам
    expect(sql).toContain("ALTER TABLE `animalOwnerships` ADD `bitrixDealId`");
    expect(sql).toContain("ALTER TABLE `animalOwnerships` ADD `bitrixStageId`");
    expect(sql).toContain("ALTER TABLE `cmsBlocks` ADD `mobileImageUrl`");
    expect(sql).toContain("ALTER TABLE `cmsBlockHistory` ADD `prevMobileImageUrl`");
    expect(sql).toContain("ALTER TABLE `cmsBlockHistory` ADD `newMobileImageUrl`");
  });

  it("baseline matches the 0060 snapshot state, not a later one", () => {
    const sql = migrationSql(BASELINE_TAG);
    const snapshot0060 = JSON.parse(
      readFileSync(path.join(drizzleDir, "meta", "0060_snapshot.json"), "utf8"),
    ) as { tables: Record<string, { columns: Record<string, { name: string; type: string }> }> };
    // 0061 расширяет enum milkAuditAction — в baseline должен быть старый вариант из 0060
    const auditType = snapshot0060.tables.milkAuditLog.columns.milkAuditAction.type;
    expect(sql).toContain(`\`milkAuditAction\` ${auditType} NOT NULL`);
    expect(auditType).not.toContain("processing_session_created");
  });

  it("every table altered by a migration is created earlier in the chain", () => {
    const created = new Set<string>();
    for (const entry of journal.entries) {
      const sql = migrationSql(entry.tag);
      for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/g)) {
        created.add(match[1]);
      }
      for (const match of sql.matchAll(/ALTER TABLE `([^`]+)`/g)) {
        expect(created.has(match[1]), `${entry.tag} alters ${match[1]} before it is created`).toBe(true);
      }
      for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX `[^`]+` ON `([^`]+)`/g)) {
        expect(created.has(match[1]), `${entry.tag} indexes ${match[1]} before it is created`).toBe(true);
      }
    }
  });
});
