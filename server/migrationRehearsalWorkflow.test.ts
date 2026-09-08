import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const workflow = readFileSync(
  path.join(root, "docs/ops/readonly-audit.workflow.yml"),
  "utf8",
);
const rehearsal = readFileSync(
  path.join(root, "scripts/ci/run-managed-tidb-rehearsal.mjs"),
  "utf8",
);
const assets = readFileSync(
  path.join(root, "scripts/ci/archive-cloudfront-assets.mjs"),
  "utf8",
);
const vds = readFileSync(path.join(root, "scripts/ci/run-vds-readonly-audit.sh"), "utf8");

describe("one-time migration rehearsal workflow", () => {
  it("is an exact copy of the handoff template, manual-only, and cannot deploy production", () => {
    expect(
      readFileSync(path.join(root, ".github/workflows/one-time-migration-rehearsal.yml")),
    ).toEqual(readFileSync(path.join(root, "docs/ops/readonly-audit.workflow.yml")));
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).not.toContain("pm2 restart");
    expect(workflow).not.toContain("rsync");
    expect(workflow).not.toContain("git push");
  });

  it("uses explicit inputs plus secrets without embedding DB/VDS credentials", () => {
    expect(workflow).toContain("secrets.REHEARSAL_DATABASE_URL");
    expect(workflow).toContain("secrets.DATABASE_URL");
    expect(workflow).toContain("secrets.SSH_PRIVATE_KEY");
    expect(workflow).toContain("secrets.SSH_HOST");
    expect(workflow).toContain("secrets.SSH_USER");
    expect(workflow).toContain("secrets.MANAGED_DUMP_PASSPHRASE");
    expect(workflow).toContain("inputs.managed_dump_vds_path");
    expect(workflow).toContain("inputs.managed_dump_sha256");
    expect(workflow).not.toMatch(/mysql:\/\/[^$\s]+/);
  });

  it("downloads and verifies the encrypted dump instead of storing it in a secret", () => {
    expect(workflow).toContain("scp -i ~/.ssh/rehearsal_audit_key");
    expect(workflow).toContain("managed-dump.tar.gz.gpg");
    expect(workflow).toContain('actual_sha=$(sha256sum');
    expect(workflow).toContain("sha256sum -c SHA256SUMS");
    expect(workflow).toContain("--passphrase-file");
    expect(rehearsal).toContain("MANAGED_DUMP_SQL");
    expect(rehearsal).toContain("MANAGED_DUMP_MANIFEST");
    expect(rehearsal).toContain("sourceDatabaseQueries: 0");
    expect(rehearsal).not.toContain("mysql.createConnection(parseDatabaseUrl(sourceUrl))");
  });

  it("retains encrypted VDS and CloudFront artifacts for seven days", () => {
    expect(workflow.match(/retention-days: 7/g)?.length).toBe(3);
    expect(workflow).toContain("vds-uploads.tar.gz.gpg");
    expect(workflow).toContain("cloudfront-assets.tar.gz.gpg");
    expect(workflow).toContain("gpg --symmetric --cipher-algo AES256");
  });

  it("guards target DB and proves baseline skip plus no-op migration", () => {
    expect(rehearsal).toContain('targetOptions.database !== "test"');
    expect(rehearsal).toContain("Safety stop: rehearsal database is not empty");
    expect(rehearsal).toContain('migrationMetadata(journal, "0021_users_columns_baseline")');
    expect(rehearsal).toContain('migrationMetadata(journal, "0060a_milk_module_baseline")');
    expect(rehearsal).toContain("schemaBeforeMigrate === schemaAfterMigrate");
    expect(rehearsal).toContain("mismatchCount !== 0");
  });

  it("prepares but never executes CloudFront URL replacements", () => {
    expect(assets).toContain("EXPECTED_CLOUDFRONT_OCCURRENCES");
    expect(assets).toContain("PREPARED ONLY. DO NOT EXECUTE");
    expect(assets).toContain("replacementStatementsExecuted: 0");
  });

  it("limits VDS work to hashes, public key fingerprints and streamed upload copy", () => {
    expect(vds).toContain("sha256sum");
    expect(vds).toContain("ssh-keygen -lf - -E sha256");
    expect(vds).toContain('tar -C /var/www/sherkozu -czf - uploads');
    expect(vds).not.toContain("rm -rf /var/www");
    expect(vds).not.toContain("sudo ");
    expect(vds).not.toMatch(/ssh .*['"](?:rm|mv|cp|mkdir|touch|tee|install|systemctl restart)/);
  });
});
