import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { compareStats } from "../scripts/ci/restore-check.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const workflow = read(".github/workflows/backup-mysql-offsite.yml");
const backupScript = read("scripts/ops/backup-mysql.sh");

describe("backup-mysql-offsite workflow", () => {
  it("ежедневно в 03:30 UTC и вручную, без деплоя и без записи на VDS", () => {
    expect(workflow).toContain('- cron: "30 3 * * *"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).toContain("permissions:\n  contents: read");
    for (const forbidden of ["pm2", "rsync", "git push", "wrangler", "DROP DATABASE"]) {
      expect(workflow).not.toContain(forbidden);
    }
    // На VDS выполняется только скрипт бэкапа, переданный по stdin
    expect(workflow).toContain('"bash -s -- $mode" < scripts/ops/backup-mysql.sh');
    expect(workflow).toContain('"bash -s -- --latest" < scripts/ops/backup-mysql.sh');
    expect(workflow).not.toMatch(/ssh .*['"](?:rm|mv|mkdir|touch|tee|systemctl)/);
  });

  it("использует VDS_*, BACKUP_PASSPHRASE и REHEARSAL_DATABASE_URL, не трогает production DATABASE_URL", () => {
    for (const secret of ["secrets.VDS_HOST", "secrets.VDS_USER", "secrets.VDS_SSH_KEY", "secrets.BACKUP_PASSPHRASE", "secrets.REHEARSAL_DATABASE_URL"]) {
      expect(workflow).toContain(secret);
    }
    expect(workflow).not.toContain("secrets.DATABASE_URL");
    expect(workflow).not.toContain("secrets.MANAGED_DUMP_PASSPHRASE");
    expect(workflow).not.toMatch(/mysql:\/\/[^$\s]+/);
  });

  it("шифрует AES-256, хранит копию 90 дней и результаты restore-test 30 дней", () => {
    expect(workflow).toContain("gpg --symmetric --cipher-algo AES256");
    expect(workflow).toContain("--passphrase-file \"$RUNNER_TEMP/backup-passphrase\"");
    expect(workflow).toContain("name: mysql-backup-encrypted-${{ github.run_id }}");
    expect(workflow).toContain("retention-days: 90");
    expect(workflow).toContain("name: restore-test-results-${{ github.run_id }}");
    expect(workflow).toContain("retention-days: 30");
    expect(workflow).toContain("scripts/ci/verify-owner-dump.mjs");
  });

  it("restore-test пишет только в базу test: фильтр, DROP через reset-rehearsal-db, сверка COUNT(*)", () => {
    expect(workflow).toContain("sed -E -f scripts/ops/tidb-compat-filter.sed");
    expect(workflow).toContain("scripts/ci/reset-rehearsal-db.mjs");
    expect(workflow).toContain('[ "${REHEARSAL_DB_NAME:-}" = "test" ]');
    expect(workflow).toContain("scripts/ci/restore-check.mjs");
    expect(workflow).toContain("--top 10 --tolerance-percent 1");
    expect(workflow).toContain("timeout-minutes: 45");
    const cleanup = workflow.slice(workflow.indexOf("Cleanup plaintext and credentials"));
    expect(cleanup).toContain("if: always()");
    expect(cleanup).toContain("backup_key");
    expect(cleanup).toContain("backup-passphrase");
    expect(cleanup).toContain("rehearsal.cnf");
    expect(cleanup).toContain("backup-output/private");
  });

  it("устаревший сценарий managed-дампа удалён", () => {
    expect(existsSync(path.join(root, ".github/workflows/owner-dump-and-rehearsal.yml"))).toBe(false);
    expect(existsSync(path.join(root, "scripts/ci/run-owner-dump-rehearsal.mjs"))).toBe(false);
    expect(existsSync(path.join(root, "scripts/ci/run-managed-tidb-rehearsal.mjs"))).toBe(false);
  });
});

describe("scripts/ops/backup-mysql.sh", () => {
  it("mysqldump с нужными флагами, доступ только через option-файл, ротация 14/8", () => {
    for (const flag of ["--single-transaction", "--routines", "--triggers", "--hex-blob", "--set-gtid-purged=OFF", "--no-tablespaces"]) {
      expect(backupScript).toContain(flag);
    }
    expect(backupScript).toContain('--defaults-file="$DEFAULTS_FILE"');
    expect(backupScript).not.toContain("--password");
    expect(backupScript).not.toMatch(/mysqldump[^\n]* -p/);
    expect(backupScript).toContain('KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"');
    expect(backupScript).toContain('KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"');
    expect(backupScript).toContain("/var/log/sherkozu-backup.log");
    expect(backupScript).toContain("/var/backups/sherkozu");
    expect(backupScript).toContain("'^-- Dump completed'");
  });

  it("self-test на фикстурах проходит (дамп, проверка, stats, ротация, повторный запуск)", () => {
    const run = spawnSync("bash", ["scripts/ops/backup-mysql.sh", "--self-test"], { cwd: root, encoding: "utf8" });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain("backup-mysql self-test: ok");
    expect(run.stdout).not.toContain("FAIL");
  });
});

describe("scripts/ops/tidb-compat-filter.sed", () => {
  it("удаляет GTID, SQL_LOG_BIN, rocksdb, MariaDB-комментарии и триггеры/процедуры, оставляя схему и данные", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tidb-filter-"));
    try {
      const fixture = [
        "-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)",
        "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;",
        "SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;",
        "SET @@SESSION.SQL_LOG_BIN= 0;",
        "SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ 'aaaa-bbbb:1-100';",
        "/*!50717 SELECT COUNT(*) INTO @rocksdb_has_p_s_session_variables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'performance_schema' */;",
        "/*!50717 PREPARE s FROM @rocksdb_get_is_supported */;",
        "/*!50717 EXECUTE s */;",
        "/*!50717 DEALLOCATE PREPARE s */;",
        "/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;",
        "/*!999999\\- enable the sandbox mode */",
        "DROP TABLE IF EXISTS `users`;",
        "CREATE TABLE `users` (`id` int NOT NULL AUTO_INCREMENT, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;",
        "LOCK TABLES `users` WRITE;",
        "INSERT INTO `users` VALUES (1),(2);",
        "UNLOCK TABLES;",
        "DELIMITER ;;",
        "/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg` BEFORE INSERT ON `users` FOR EACH ROW BEGIN SET NEW.id = NEW.id; END */;;",
        "DELIMITER ;",
        "DELIMITER ;;",
        "CREATE DEFINER=`root`@`localhost` PROCEDURE `p`() BEGIN SELECT 1; END ;;",
        "DELIMITER ;",
        "/*!50112 SET @disable_bulk_load = IF (@is_rocksdb_supported, 'SET SESSION rocksdb_bulk_load = @old_rocksdb_bulk_load', 'SET @dummy_rocksdb_bulk_load = 0') */;",
        "SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;",
        "-- Dump completed on 2026-09-08  3:00:00",
        "",
      ].join("\n");
      const input = path.join(dir, "dump.sql");
      writeFileSync(input, fixture);
      const run = spawnSync("sed", ["-E", "-f", "scripts/ops/tidb-compat-filter.sed", input], { cwd: root, encoding: "utf8" });
      expect(run.status, run.stderr).toBe(0);
      const out = run.stdout;
      for (const kept of ["DROP TABLE IF EXISTS `users`;", "CREATE TABLE `users`", "INSERT INTO `users` VALUES (1),(2);", "LOCK TABLES `users` WRITE;", "-- Dump completed", "/*!40101 SET @OLD_CHARACTER_SET_CLIENT"]) {
        expect(out).toContain(kept);
      }
      for (const removed of ["GTID_PURGED", "SQL_LOG_BIN", "rocksdb", "DELIMITER", "TRIGGER", "PROCEDURE", "/*M!", "999999", "disable_bulk_load", "PREPARE s"]) {
        expect(out).not.toContain(removed);
      }
      expect(out.split("\n").filter(Boolean)).toHaveLength(8);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("restore-check: compareStats", () => {
  const source = [
    { tableName: "siteEvents", rowCount: 10_000 },
    { tableName: "users", rowCount: 500 },
    { tableName: "animals", rowCount: 40 },
    { tableName: "__drizzle_migrations", rowCount: 66 },
  ];

  it("ok при полном совпадении и в пределах допуска 1 %", () => {
    const target = source.map((t) => (t.tableName === "siteEvents" ? { ...t, rowCount: 10_050 } : { ...t }));
    const report = compareStats({ source, target, expectedTables: 4, top: 10, tolerancePercent: 1 });
    expect(report.ok, report.problems.join("; ")).toBe(true);
    expect(report.largestTables[0]).toMatchObject({ tableName: "siteEvents", difference: 50, allowedDifference: 100, ok: true });
    expect(report.largestTables.map((t) => t.tableName)).toEqual(["siteEvents", "users", "__drizzle_migrations", "animals"]);
  });

  it("падает при расхождении сверх допуска, недостающей таблице и не том числе таблиц", () => {
    const target = [
      { tableName: "siteEvents", rowCount: 9_000 },
      { tableName: "users", rowCount: 500 },
      { tableName: "__drizzle_migrations", rowCount: 66 },
    ];
    const report = compareStats({ source, target, expectedTables: 5, top: 10, tolerancePercent: 1 });
    expect(report.ok).toBe(false);
    expect(report.problems.join("\n")).toContain("таблиц в источнике 4, ожидалось 5");
    expect(report.problems.join("\n")).toContain("нет в test: animals");
    expect(report.problems.join("\n")).toContain("siteEvents: источник 10000, test 9000");
  });

  it("сверяет только top-N крупнейших", () => {
    const target = source.map((t) => (t.tableName === "animals" ? { ...t, rowCount: 0 } : { ...t }));
    const report = compareStats({ source, target, top: 2, tolerancePercent: 0 });
    expect(report.ok).toBe(true);
    expect(report.largestTables).toHaveLength(2);
  });
});
