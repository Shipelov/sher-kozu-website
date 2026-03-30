import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readClientFile(relPath: string) {
  return readFileSync(resolve(__dirname, "..", "client", "src", relPath), "utf-8");
}

describe("Visual Audit: Protected queries have auth guards on public pages", () => {
  const DASHBOARD_SRC = readClientFile("pages/Dashboard.tsx");
  const TRACKER_SRC = readClientFile("pages/ProductTracker.tsx");
  const LEADERBOARD_SRC = readClientFile("pages/Leaderboard.tsx");
  const COMPARE_SRC = readClientFile("pages/AnimalCompare.tsx");
  const CLUB_SRC = readClientFile("pages/ClubFeed.tsx");
  const MARKETPLACE_SRC = readClientFile("pages/Marketplace.tsx");

  it("Dashboard: ownerDashboard query has enabled: isAuthenticated guard", () => {
    // ownerDashboard should have enabled guard
    const queryMatch = DASHBOARD_SRC.match(
      /ownerDashboard\.useQuery\(undefined,\s*\{[\s\S]*?enabled:\s*isAuthenticated/
    );
    expect(queryMatch).not.toBeNull();
  });

  it("Dashboard: imports useAuth", () => {
    expect(DASHBOARD_SRC).toContain('import { useAuth }');
  });

  it("ProductTracker: ownerDashboard query has enabled: isAuthenticated guard", () => {
    const queryMatch = TRACKER_SRC.match(
      /ownerDashboard\.useQuery\(undefined,\s*\{[\s\S]*?enabled:\s*isAuthenticated/
    );
    expect(queryMatch).not.toBeNull();
  });

  it("ProductTracker: getByAnimal query works without auth (public)", () => {
    expect(TRACKER_SRC).toContain("enabled: Boolean(fallbackAnimalSlug)");
  });

  it("Leaderboard: all queries have enabled: isAuthenticated guard", () => {
    expect(LEADERBOARD_SRC).toContain("herd.useQuery({ limit: 20 }, { enabled: isAuthenticated })");
    expect(LEADERBOARD_SRC).toContain("owners.useQuery({ limit: 20 }, { enabled: isAuthenticated })");
    expect(LEADERBOARD_SRC).toContain("myRating.useQuery(undefined, { enabled: isAuthenticated })");
    expect(LEADERBOARD_SRC).toContain("ratingHistory.useQuery({ days: 30 }, { enabled: isAuthenticated })");
  });

  it("Leaderboard: shows guest prompt when not authenticated", () => {
    expect(LEADERBOARD_SRC).toContain("Войдите, чтобы увидеть рейтинг");
  });

  it("AnimalCompare: herd query has enabled: isAuthenticated guard", () => {
    expect(COMPARE_SRC).toContain("{ enabled: isAuthenticated }");
  });

  it("ClubFeed: ownerDashboard query has enabled: isAuthenticated guard", () => {
    const queryMatch = CLUB_SRC.match(
      /ownerDashboard\.useQuery\(undefined,\s*\{[\s\S]*?enabled:\s*isAuthenticated/
    );
    expect(queryMatch).not.toBeNull();
  });

  it("Marketplace: ownerDashboard query has enabled: isAuthenticated guard", () => {
    const queryMatch = MARKETPLACE_SRC.match(
      /ownerDashboard\.useQuery\(undefined,\s*\{[\s\S]*?enabled:\s*isAuthenticated/
    );
    expect(queryMatch).not.toBeNull();
  });
});

describe("Visual Audit: DashboardLayout Russian localization", () => {
  const LAYOUT_SRC = readClientFile("components/DashboardLayout.tsx");

  it("auth screen shows Russian text instead of English", () => {
    expect(LAYOUT_SRC).toContain("Войдите для продолжения");
    expect(LAYOUT_SRC).not.toContain("Sign in to continue");
  });

  it("auth button shows Russian text", () => {
    expect(LAYOUT_SRC).toContain("Войти");
    expect(LAYOUT_SRC).not.toContain("Sign in");
  });
});

describe("Visual Audit: AnimalCompare alt text", () => {
  const COMPARE_SRC = readClientFile("pages/AnimalCompare.tsx");

  it("animal images have meaningful alt text instead of empty string", () => {
    expect(COMPARE_SRC).not.toContain('alt=""');
    // Should use animal name for alt
    expect(COMPARE_SRC).toContain("alt={selected.name}");
    expect(COMPARE_SRC).toContain("alt={animal.name}");
  });
});
