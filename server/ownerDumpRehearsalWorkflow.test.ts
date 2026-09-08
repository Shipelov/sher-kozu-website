import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const workflow = read(".github/workflows/owner-dump-and-rehearsal.yml");
const parseScript = read("scripts/ci/parse-database-url.sh");
const resetScript = read("scripts/ci/reset-rehearsal-db.mjs");
const rehearsalScript = read("scripts/ci/run-owner-dump-rehearsal.mjs");
const lib = read("scripts/ci/rehearsalLib.mjs");

describe("owner dump and rehearsal workflow", () => {
  it("запускается только вручную и не деплоит", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).not.toMatch(/\n\s+pull_request:/);
    expect(workflow).toContain("if: inputs.confirm == 'RUN'");
    expect(workflow).toContain("permissions:\n  contents: read");
    for (const forbidden of ["pm2", "rsync", "git push", "wrangler", "secrets.VDS_", "secrets.SSH_"]) {
      expect(workflow).not.toContain(forbidden);
    }
  });

  it("читает только нужные секреты и ни одного production-адреса в открытом виде", () => {
    expect(workflow).toContain("secrets.DATABASE_URL");
    expect(workflow).toContain("secrets.REHEARSAL_DATABASE_URL");
    expect(workflow).toContain("secrets.MANAGED_DUMP_PASSPHRASE");
    expect(workflow).not.toMatch(/mysql:\/\/[^$\s]+/);
    expect(workflow).toContain("::add-mask::$DB_PASSWORD");
  });

  it("снимает дамп Dumpling с проверкой sha256, mysqldump только как fallback без savepoints", () => {
    expect(workflow).toContain("download.pingcap.com/tidb-community-toolkit-");
    expect(workflow).not.toContain("pingcap.org");
    expect(workflow).toContain("TOOLKIT_SHA256");
    expect(workflow).toContain("--wildcards \"*dumpling-${DUMPLING_VERSION}-linux-amd64.tar.gz\"");
    expect(workflow).toContain('[ "$published_sha" = "$actual_sha" ]');
    expect(workflow).toContain("--consistency \"$DUMPLING_CONSISTENCY\"");
    expect(workflow).toContain("--ca /etc/ssl/certs/ca-certificates.crt");
    expect(workflow).toContain("options: [auto, dumpling, mysqldump]");
    // mysqldump 8 с --single-transaction падает на ROLLBACK TO SAVEPOINT в TiDB
    expect(workflow).not.toContain("--single-transaction");
    for (const flag of [
      "--skip-add-locks",
      "--skip-lock-tables",
      "--set-gtid-purged=OFF",
      "--hex-blob",
      "--default-character-set=utf8mb4",
      "--column-statistics=0",
      "--no-tablespaces",
      "--defaults-extra-file=",
    ]) {
      expect(workflow).toContain(flag);
    }
    expect(parseScript).toContain("ssl-mode=REQUIRED");
  });

  it("проверяет дамп, шифрует его и хранит артефакты 7 дней", () => {
    expect(workflow).toContain("scripts/ci/verify-owner-dump.mjs");
    expect(workflow).toContain("gpg --symmetric --cipher-algo AES256");
    expect(workflow).toContain("name: owner-managed-dump-encrypted");
    expect(workflow).toContain("name: migration-rehearsal-results");
    expect(workflow.match(/retention-days: 7/g)?.length).toBe(2);
    expect(workflow).toContain("rehearsal-output/rehearsal-result.json");
    expect(workflow).toContain("rehearsal-output/row-diff.json");
  });

  it("пишет только в базу test и чистит секреты в always()", () => {
    expect(workflow).toContain("scripts/ci/reset-rehearsal-db.mjs");
    expect(resetScript).toContain('options.database !== "test"');
    expect(resetScript).toContain("REHEARSAL_DATABASE_URL совпадает с");
    expect(rehearsalScript).toContain("Safety stop: source and rehearsal URLs are identical");
    expect(rehearsalScript).toContain('targetOptions.database !== "test"');
    expect(rehearsalScript).not.toMatch(/INSERT|UPDATE|DELETE/);
    expect(lib).toContain("SELECT COUNT(*) AS n FROM");
    const cleanup = workflow.slice(workflow.indexOf("Cleanup plaintext and credentials"));
    expect(cleanup).toContain("if: always()");
    expect(cleanup).toContain("managed-dump-passphrase");
    expect(cleanup).toContain("source.cnf");
    expect(cleanup).toContain("rehearsal-output/private");
  });

  it("переиспользует логику репетиции: baseline 0066, пропуск 0021/0060a, no-op migrate", () => {
    expect(lib).toContain('migrationMetadata(journal, "0021_users_columns_baseline")');
    expect(lib).toContain('migrationMetadata(journal, "0060a_milk_module_baseline")');
    expect(lib).toContain("schemaBeforeMigrate === schemaAfterMigrate");
    expect(lib).toContain('["exec", "drizzle-kit", "migrate"]');
    expect(lib).toContain('["exec", "drizzle-kit", "check"]');
    expect(rehearsalScript).toContain("runPostImportRehearsal");
    // Сценарий Manus остаётся нетронутым
    expect(existsSync(path.join(root, ".github/workflows/one-time-migration-rehearsal.yml"))).toBe(true);
    expect(existsSync(path.join(root, "scripts/ci/run-managed-tidb-rehearsal.mjs"))).toBe(true);
  });

  it("self-test разбора URL проходит", () => {
    const run = spawnSync("bash", ["scripts/ci/parse-database-url.sh", "--self-test"], { cwd: root, encoding: "utf8" });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain("parse-database-url self-test: ok");
  });

  it("self-test проверки дампа проходит на фикстурах", () => {
    const run = spawnSync(process.execPath, ["scripts/ci/verify-owner-dump.mjs", "--self-test"], { cwd: root, encoding: "utf8" });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain('"selfTest":"ok"');
  });

  it("сброс базы отказывается работать не на test", () => {
    const run = spawnSync(process.execPath, ["scripts/ci/reset-rehearsal-db.mjs", "--dry-run"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, REHEARSAL_DATABASE_URL: "mysql://u:p@db.example.invalid:4000/koza" },
    });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('должна называться "test"');
  });
});
