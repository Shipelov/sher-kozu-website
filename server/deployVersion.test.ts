import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDeployVersion } from "./deployVersion";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "deploy-version-"));
  tempDirs.push(dir);
  return dir;
}

describe("getDeployVersion", () => {
  it("uses explicit runtime metadata when it is available", () => {
    expect(getDeployVersion({ GIT_COMMIT: "abc123", BUILD_TIME: "2026-09-06T12:00:00Z" }, makeTempDir())).toEqual({
      commit: "abc123",
      buildTime: "2026-09-06T12:00:00Z",
    });
  });

  it("reads the VDS marker written by the existing deploy workflow", () => {
    const dir = makeTempDir();
    const marker = join(dir, ".deploy_version");
    writeFileSync(marker, "855fb31ccf8edb04e5b161e757fcd613ced61342\n");
    const timestamp = new Date("2026-09-06T12:34:56.000Z");
    utimesSync(marker, timestamp, timestamp);

    expect(getDeployVersion({}, dir)).toEqual({
      commit: "855fb31ccf8edb04e5b161e757fcd613ced61342",
      buildTime: "2026-09-06T12:34:56.000Z",
    });
  });

  it("returns explicit unknown values when neither source exists", () => {
    expect(getDeployVersion({}, makeTempDir())).toEqual({
      commit: "unknown",
      buildTime: "unknown",
    });
  });
});
