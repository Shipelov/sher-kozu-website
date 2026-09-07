import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for the "Set Primary Animal" feature.
 *
 * Covers:
 * 1. Database function (setPrimaryAnimal in db.ts)
 * 2. tRPC mutation (setPrimaryAnimal in routers.ts)
 * 3. Dashboard data (primaryAnimalId + isPrimary in getOwnerDashboardData)
 * 4. Dashboard UI (Crown icon, "Сделать основным" button)
 */

const DB_SRC = fs.readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const ROUTERS_SRC = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf-8");
// CRLF на Windows-чекауте раздувает 300-символьное окно вокруг isPrimary — нормализуем
const DASHBOARD_SRC = fs
  .readFileSync(path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"), "utf-8")
  .replace(/\r\n/g, "\n");
const SCHEMA_SRC = fs.readFileSync(
  path.resolve(__dirname, "../drizzle/schema.ts"),
  "utf-8",
);

describe("setPrimaryAnimal: database schema", () => {
  it("users table has primaryAnimalId column", () => {
    expect(SCHEMA_SRC).toContain("primaryAnimalId");
  });
});

describe("setPrimaryAnimal: db.ts function", () => {
  it("exports setPrimaryAnimal function", () => {
    expect(DB_SRC).toContain("export async function setPrimaryAnimal");
  });

  it("accepts ownerOpenId and animalId parameters", () => {
    expect(DB_SRC).toMatch(/setPrimaryAnimal\(ownerOpenId:\s*string,\s*animalId:\s*number\s*\|\s*null\)/);
  });

  it("verifies ownership before setting primary animal", () => {
    // Should check animalOwnerships table
    expect(DB_SRC).toContain("animalOwnerships.ownerOpenId");
    expect(DB_SRC).toContain("animalOwnerships.animalId");
  });

  it("throws error when user does not own the animal", () => {
    expect(DB_SRC).toContain("У вас нет доли в этом животном");
  });

  it("updates users table with primaryAnimalId", () => {
    // The function should update users.primaryAnimalId
    expect(DB_SRC).toContain(".update(users)");
    expect(DB_SRC).toContain("primaryAnimalId: animalId");
  });

  it("returns success with primaryAnimalId", () => {
    expect(DB_SRC).toContain("success: true");
    expect(DB_SRC).toContain("primaryAnimalId: animalId");
  });

  it("allows null animalId to reset to auto-select", () => {
    // The function should handle null animalId (skip ownership check)
    expect(DB_SRC).toContain("animalId !== null");
  });
});

describe("setPrimaryAnimal: tRPC mutation in routers.ts", () => {
  it("defines setPrimaryAnimal procedure", () => {
    expect(ROUTERS_SRC).toContain("setPrimaryAnimal:");
  });

  it("uses protectedProcedure (requires authentication)", () => {
    // The mutation should be protected
    const mutationBlock = ROUTERS_SRC.substring(
      ROUTERS_SRC.indexOf("setPrimaryAnimal:"),
      ROUTERS_SRC.indexOf("setPrimaryAnimal:") + 400,
    );
    expect(mutationBlock).toContain("protectedProcedure");
  });

  it("accepts animalId input as nullable positive integer", () => {
    const mutationBlock = ROUTERS_SRC.substring(
      ROUTERS_SRC.indexOf("setPrimaryAnimal:"),
      ROUTERS_SRC.indexOf("setPrimaryAnimal:") + 400,
    );
    expect(mutationBlock).toContain("z.number().int().positive().nullable()");
  });

  it("calls setPrimaryAnimal from db.ts", () => {
    expect(ROUTERS_SRC).toContain("setPrimaryAnimal(ctx.user.openId");
  });

  it("imports setPrimaryAnimal from db module", () => {
    expect(ROUTERS_SRC).toContain("setPrimaryAnimal,");
  });
});

describe("setPrimaryAnimal: getOwnerDashboardData integration", () => {
  it("reads user primaryAnimalId preference from users table", () => {
    expect(DB_SRC).toContain("users.primaryAnimalId");
    expect(DB_SRC).toContain("preferredAnimalId");
  });

  it("uses preferredAnimalId to select primaryOwnershipGroup", () => {
    expect(DB_SRC).toContain("preferredAnimalId && groupedByAnimal.has(preferredAnimalId)");
  });

  it("returns primaryAnimalId in dashboard response", () => {
    expect(DB_SRC).toContain("primaryAnimalId: preferredAnimalId");
  });

  it("returns isPrimary flag on each allOwnerships entry", () => {
    expect(DB_SRC).toContain("isPrimary:");
  });
});

describe("setPrimaryAnimal: Dashboard UI", () => {
  it("imports Crown icon for primary animal badge", () => {
    expect(DASHBOARD_SRC).toContain("Crown");
  });

  it("imports Loader2 icon for loading state", () => {
    expect(DASHBOARD_SRC).toContain("Loader2");
  });

  it("creates setPrimaryAnimal mutation", () => {
    expect(DASHBOARD_SRC).toContain("trpc.animals.setPrimaryAnimal.useMutation");
  });

  it("shows 'Сделать основным' button on non-primary animals", () => {
    expect(DASHBOARD_SRC).toContain("Сделать основным");
  });

  it("button has data-testid for each animal", () => {
    expect(DASHBOARD_SRC).toContain("set-primary-${item.animalId}");
  });

  it("button is disabled while mutation is pending", () => {
    expect(DASHBOARD_SRC).toContain("setPrimaryMutation.isPending");
    expect(DASHBOARD_SRC).toContain("disabled={isSettingPrimary}");
  });

  it("shows spinner while mutation is in progress", () => {
    expect(DASHBOARD_SRC).toContain("animate-spin");
  });

  it("does not show button on primary animal card", () => {
    expect(DASHBOARD_SRC).toContain("!isPrimary &&");
  });

  it("shows Crown icon on primary animal badge", () => {
    // The primary badge should contain Crown icon
    const badgeSection = DASHBOARD_SRC.substring(
      DASHBOARD_SRC.indexOf("isPrimary && ("),
      DASHBOARD_SRC.indexOf("isPrimary && (") + 300,
    );
    expect(badgeSection).toContain("Crown");
    expect(badgeSection).toContain("Основное");
  });

  it("invalidates dashboard query on success", () => {
    expect(DASHBOARD_SRC).toContain("utils.animals.ownerDashboard.invalidate");
  });

  it("shows success toast on mutation success", () => {
    expect(DASHBOARD_SRC).toContain("toast.success");
    expect(DASHBOARD_SRC).toContain("Основное животное обновлено");
  });

  it("shows error toast on mutation failure", () => {
    expect(DASHBOARD_SRC).toContain("toast.error");
    expect(DASHBOARD_SRC).toContain("Не удалось сменить основное животное");
  });
});
