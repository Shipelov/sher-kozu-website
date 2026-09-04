import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("Farm Controller unauthenticated state", () => {
  const source = readFileSync(
    resolve(projectRoot, "client", "src", "pages", "FarmControllerArm.tsx"),
    "utf-8",
  );

  it("redirects to the farm login after an empty auth response", () => {
    expect(source).toContain(
      'if (!meQuery.isLoading && !meQuery.data) navigate("/farm")',
    );
  });

  it("keeps the loading guard before the empty-data render guard", () => {
    expect(source.indexOf("if (meQuery.isLoading)")).toBeGreaterThan(-1);
    expect(source.indexOf("if (!meQuery.data || meQuery.data.role")).toBeGreaterThan(
      source.indexOf("if (meQuery.isLoading)"),
    );
  });
});

describe("Robots policy during the closed development period", () => {
  const robots = readFileSync(
    resolve(projectRoot, "client", "public", "robots.txt"),
    "utf-8",
  );

  it("is served from public assets and blocks indexing while the gate is active", () => {
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("<!doctype html>");
  });
});
