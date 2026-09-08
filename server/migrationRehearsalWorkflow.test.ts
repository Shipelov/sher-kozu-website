import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const workflow = readFileSync(path.join(root, "docs/ops/readonly-audit.workflow.yml"), "utf8");
const assets = readFileSync(path.join(root, "scripts/ci/archive-cloudfront-assets.mjs"), "utf8");
const vds = readFileSync(path.join(root, "scripts/ci/run-vds-readonly-audit.sh"), "utf8");

// 2026-09-08: шаги импорта managed-dump'а удалены (production — MySQL на VDS, см. docs/ops/BACKUP.md);
// workflow оставлен для read-only аудита VDS и CloudFront-ассетов.
describe("one-time VDS audit workflow", () => {
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
    expect(workflow).toContain("secrets.VDS_SSH_KEY");
    expect(workflow).toContain("secrets.VDS_HOST");
    expect(workflow).toContain("secrets.VDS_USER");
    expect(workflow).toContain("secrets.MANAGED_DUMP_PASSPHRASE");
    expect(workflow).toContain("inputs.expected_cloudfront_occurrences");
    expect(workflow).not.toMatch(/mysql:\/\/[^$\s]+/);
  });

  it("no longer copies or imports the managed dump", () => {
    expect(workflow).not.toContain("managed_dump_vds_path");
    expect(workflow).not.toContain("managed-dump.tar.gz.gpg");
    expect(workflow).not.toContain("run-managed-tidb-rehearsal");
    expect(workflow).not.toContain("Import dump and run TiDB rehearsal");
    expect(existsSync(path.join(root, "scripts/ci/run-managed-tidb-rehearsal.mjs"))).toBe(false);
    expect(workflow).toContain("--passphrase-file");
  });

  it("retains encrypted VDS and CloudFront artifacts for seven days", () => {
    expect(workflow.match(/retention-days: 7/g)?.length).toBe(3);
    expect(workflow).toContain("vds-uploads.tar.gz.gpg");
    expect(workflow).toContain("cloudfront-assets.tar.gz.gpg");
    expect(workflow).toContain("gpg --symmetric --cipher-algo AES256");
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
