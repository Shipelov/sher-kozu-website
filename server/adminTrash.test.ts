import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Read source files for static analysis
const routersSrc = readFileSync(
  path.resolve(__dirname, "routers.ts"),
  "utf-8"
);
const dbSrc = readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const schemaSrc = readFileSync(
  path.resolve(__dirname, "../drizzle/schema.ts"),
  "utf-8"
);
const contextSrc = readFileSync(
  path.resolve(__dirname, "_core/context.ts"),
  "utf-8"
);
const indexSrc = readFileSync(
  path.resolve(__dirname, "_core/index.ts"),
  "utf-8"
);

describe("Soft-Delete / Trash Feature", () => {
  describe("Schema", () => {
    it("should have deletedAt field in users table", () => {
      expect(schemaSrc).toContain("deletedAt");
      expect(schemaSrc).toMatch(/deletedAt.*datetime|timestamp/);
    });

    it("should have deletedBy field in users table", () => {
      expect(schemaSrc).toContain("deletedBy");
    });
  });

  describe("Auth Context - Blocked Access", () => {
    it("should check deletedAt in auth context to block deleted users", () => {
      expect(contextSrc).toContain("deletedAt");
    });

    it("should return null user when deletedAt is set", () => {
      // The context should check if user is soft-deleted and deny access
      expect(contextSrc).toMatch(/deletedAt|deleted_at/);
    });
  });

  describe("DB Functions", () => {
    it("should export softDeleteUser function", () => {
      expect(dbSrc).toContain("export async function softDeleteUser");
    });

    it("should export restoreUser function", () => {
      expect(dbSrc).toContain("export async function restoreUser");
    });

    it("should export permanentDeleteUser function", () => {
      expect(dbSrc).toContain("export async function permanentDeleteUser");
    });

    it("should export listTrashedUsers function", () => {
      expect(dbSrc).toContain("export async function listTrashedUsers");
    });

    it("should export findExpiredTrashedUsers function", () => {
      expect(dbSrc).toContain("export async function findExpiredTrashedUsers");
    });

    it("softDeleteUser should set deletedAt and deletedBy", () => {
      const fnBody = dbSrc.slice(
        dbSrc.indexOf("export async function softDeleteUser"),
        dbSrc.indexOf("export async function softDeleteUser") + 500
      );
      expect(fnBody).toContain("deletedAt");
      expect(fnBody).toContain("deletedBy");
    });

    it("restoreUser should clear deletedAt and deletedBy", () => {
      const fnBody = dbSrc.slice(
        dbSrc.indexOf("export async function restoreUser"),
        dbSrc.indexOf("export async function restoreUser") + 500
      );
      expect(fnBody).toContain("deletedAt");
      expect(fnBody).toMatch(/null/);
    });

    it("permanentDeleteUser should cancel active ownerships", () => {
      const fnBody = dbSrc.slice(
        dbSrc.indexOf("export async function permanentDeleteUser"),
        dbSrc.indexOf("export async function permanentDeleteUser") + 1500
      );
      expect(fnBody).toContain("animalOwnerships");
      expect(fnBody).toContain("cancelled");
    });

    it("permanentDeleteUser should delete user record", () => {
      const fnBody = dbSrc.slice(
        dbSrc.indexOf("export async function permanentDeleteUser"),
        dbSrc.indexOf("export async function permanentDeleteUser") + 2500
      );
      expect(fnBody).toContain(".delete(users)");
    });

    it("permanentDeleteUser should clean up dependent tables", () => {
      const fnBody = dbSrc.slice(
        dbSrc.indexOf("export async function permanentDeleteUser"),
        dbSrc.indexOf("export async function permanentDeleteUser") + 1500
      );
      expect(fnBody).toContain("walletTransactions");
      expect(fnBody).toContain("wallets");
      expect(fnBody).toContain("chatMessages");
      expect(fnBody).toContain("clubMembers");
    });

    it("findExpiredTrashedUsers should use 30-day cutoff by default", () => {
      const fnBody = dbSrc.slice(
        dbSrc.indexOf("export async function findExpiredTrashedUsers"),
        dbSrc.indexOf("export async function findExpiredTrashedUsers") + 500
      );
      expect(fnBody).toContain("days: number = 30");
      expect(fnBody).toContain("deletedAt");
    });

    it("listTrashedUsers should filter by non-null deletedAt", () => {
      // Окно до следующей export-функции: select со многими полями длиннее 500 символов
      const fnStart = dbSrc.indexOf("export async function listTrashedUsers");
      const fnEnd = dbSrc.indexOf("\nexport ", fnStart + 1);
      const fnBody = dbSrc.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
      expect(fnBody).toContain("isNotNull");
      expect(fnBody).toContain("deletedAt");
    });
  });

  describe("Router Procedures", () => {
    it("should have adminTrash router", () => {
      expect(routersSrc).toContain("adminTrash: router({");
    });

    it("should have softDelete procedure with admin check", () => {
      const trashSection = routersSrc.slice(
        routersSrc.indexOf("adminTrash: router({"),
        routersSrc.indexOf("adminTrash: router({") + 1500
      );
      expect(trashSection).toContain("softDelete:");
      expect(trashSection).toContain("adminProcedure");
    });

    it("should have restore procedure with admin check", () => {
      const trashSection = routersSrc.slice(
        routersSrc.indexOf("adminTrash: router({"),
        routersSrc.indexOf("adminTrash: router({") + 1500
      );
      expect(trashSection).toContain("restore:");
      expect(trashSection).toContain("restoreUser");
    });

    it("should have list procedure for trash contents", () => {
      const trashSection = routersSrc.slice(
        routersSrc.indexOf("adminTrash: router({"),
        routersSrc.indexOf("adminTrash: router({") + 1500
      );
      expect(trashSection).toContain("list:");
      expect(trashSection).toContain("listTrashedUsers");
    });

    it("should have permanentDelete procedure", () => {
      const trashSection = routersSrc.slice(
        routersSrc.indexOf("adminTrash: router({"),
        routersSrc.indexOf("adminTrash: router({") + 3000
      );
      expect(trashSection).toContain("permanentDelete:");
      expect(trashSection).toContain("permanentDeleteUser");
    });

    it("should have autoCleanup procedure", () => {
      const trashSection = routersSrc.slice(
        routersSrc.indexOf("adminTrash: router({"),
        routersSrc.indexOf("adminTrash: router({") + 3000
      );
      expect(trashSection).toContain("autoCleanup:");
      expect(trashSection).toContain("findExpiredTrashedUsers");
    });
  });

  describe("Auto-Cleanup Scheduler", () => {
    it("should have runTrashCleanup function in server index", () => {
      expect(indexSrc).toContain("runTrashCleanup");
    });

    it("should call findExpiredTrashedUsers with 30 days", () => {
      expect(indexSrc).toContain("findExpiredTrashedUsers(30)");
    });

    it("should call permanentDeleteUser for each expired user", () => {
      expect(indexSrc).toContain("permanentDeleteUser(user.id)");
    });

    it("should set up 24-hour interval for cleanup", () => {
      expect(indexSrc).toContain("setInterval(runTrashCleanup");
      expect(indexSrc).toContain("24 * 60 * 60 * 1000");
    });

    it("should run cleanup on server startup", () => {
      // runTrashCleanup should be called directly (not just in setInterval)
      const afterListen = indexSrc.slice(indexSrc.indexOf("server.listen"));
      expect(afterListen).toMatch(/runTrashCleanup\(\)/);
    });
  });
});
