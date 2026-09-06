import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

type DeployVersionEnv = {
  [key: string]: string | undefined;
  GIT_COMMIT?: string;
  BUILD_TIME?: string;
};

export type DeployVersion = {
  commit: string;
  buildTime: string;
};

export function getDeployVersion(
  env: DeployVersionEnv = process.env,
  cwd = process.cwd(),
): DeployVersion {
  const versionFile = resolve(cwd, ".deploy_version");
  let fileCommit = "";
  let fileBuildTime = "";

  try {
    fileCommit = readFileSync(versionFile, "utf8").trim().split(/\s+/)[0] ?? "";
    fileBuildTime = statSync(versionFile).mtime.toISOString();
  } catch {
    // The managed Manus runtime does not create this VDS-specific marker.
  }

  return {
    commit: env.GIT_COMMIT?.trim() || fileCommit || "unknown",
    buildTime: env.BUILD_TIME?.trim() || fileBuildTime || "unknown",
  };
}
