import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(import.meta.dirname, "..", relPath), "utf-8");
}

describe("Admin: password security and Bitrix24 sync button", () => {
  const schemaSrc = readSource("drizzle/schema.ts");
  const localAuthSrc = readSource("server/localAuth.ts");
  const dbSrc = readSource("server/db.ts");
  const adminHubSrc = readSource("client/src/pages/AdminHub.tsx");
  const routersSrc = readSource("server/routers.ts");

  describe("plainPassword column REMOVED from schema", () => {
    it("does NOT define plainPassword column in users table", () => {
      expect(schemaSrc).not.toContain("plainPassword");
    });

    it("still has passwordHash for secure storage", () => {
      expect(schemaSrc).toContain("passwordHash");
    });
  });

  describe("plainPassword removed from registration", () => {
    it("does NOT set plainPassword in registerLocalUser", () => {
      expect(localAuthSrc).not.toContain("plainPassword");
    });
  });

  describe("plainPassword removed from db helpers", () => {
    it("does NOT reference plainPassword in db.ts", () => {
      expect(dbSrc).not.toContain("plainPassword");
    });
  });

  describe("AdminHub does NOT display password column", () => {
    it("does NOT use PasswordCell component", () => {
      expect(adminHubSrc).not.toContain("PasswordCell");
      expect(adminHubSrc).not.toContain("u.plainPassword");
    });
  });

  describe("Bitrix24 sync button in AdminHub", () => {
    it("renders sync button with Bitrix24 label", () => {
      expect(adminHubSrc).toContain("Синхронизация с Bitrix24");
    });

    it("uses adminSync.syncBitrixContacts mutation", () => {
      expect(adminHubSrc).toContain("trpc.adminSync.syncBitrixContacts.useMutation");
    });

    it("shows loading state during sync", () => {
      expect(adminHubSrc).toContain("syncBitrixMutation.isPending");
      expect(adminHubSrc).toContain("Синхронизация…");
    });

    it("displays success toast with sync stats", () => {
      expect(adminHubSrc).toContain("Синхронизация завершена");
      expect(adminHubSrc).toContain("data.synced");
      expect(adminHubSrc).toContain("data.created");
      expect(adminHubSrc).toContain("data.updated");
    });

    it("invalidates funnel query after successful sync", () => {
      expect(adminHubSrc).toContain("utils.adminAnalytics.userFunnel.invalidate");
    });

    it("uses RefreshCw icon with spin animation", () => {
      expect(adminHubSrc).toContain("RefreshCw");
      expect(adminHubSrc).toContain("animate-spin");
    });
  });

  describe("Server-side sync procedure exists", () => {
    it("defines syncBitrixContacts in adminSync router", () => {
      expect(routersSrc).toContain("adminSync: router({");
      expect(routersSrc).toContain("syncBitrixContacts:");
    });

    it("uses adminProcedure for sync", () => {
      const syncStart = routersSrc.indexOf("syncBitrixContacts:");
      const chunk = routersSrc.slice(Math.max(0, syncStart - 50), syncStart + 200);
      expect(chunk).toContain("adminProcedure");
    });
  });

  describe("Sync optimization: pre-loaded Maps and batch operations", () => {
    // Get the full sync procedure source
    const syncStart = routersSrc.indexOf("syncBitrixContacts:");
    const syncEnd = routersSrc.indexOf("resetUserPassword:");
    const syncSrc = routersSrc.slice(syncStart, syncEnd);

    it("pre-loads all users into lookup Maps", () => {
      expect(syncSrc).toContain("new Map");
      expect(syncSrc).toContain("byBitrixId");
      expect(syncSrc).toContain("byEmail");
      expect(syncSrc).toContain("byPhone");
    });

    it("uses O(1) Map lookups instead of DB queries inside loop", () => {
      expect(syncSrc).toContain("byBitrixId.get(bitrixId)");
      expect(syncSrc).toContain("byEmail.get(email.toLowerCase())");
    });

    it("collects batch operations instead of immediate writes", () => {
      expect(syncSrc).toContain("pendingUpdates");
      expect(syncSrc).toContain("pendingInserts");
    });

    it("flushes updates in parallel batches", () => {
      expect(syncSrc).toContain("Promise.all");
      expect(syncSrc).toContain("BATCH_SIZE");
    });

    it("uses bulk insert for new users", () => {
      expect(syncSrc).toContain("dbSync.insert(usersT).values(chunk)");
    });

    it("moves dynamic imports outside the processing loop", () => {
      // crypto import should be before the while loop, not inside for loop
      const cryptoImportPos = syncSrc.indexOf('await import("crypto")');
      const whileLoopPos = syncSrc.indexOf("while (nextStart !== null)");
      expect(cryptoImportPos).toBeLessThan(whileLoopPos);
    });

    it("updates Maps during processing for deduplication", () => {
      expect(syncSrc).toContain("byBitrixId.set(bitrixId");
      expect(syncSrc).toContain("byEmail.set(email.toLowerCase()");
    });

    it("tracks skipped contacts", () => {
      expect(syncSrc).toContain("skipped");
    });

    it("returns skipped count in response", () => {
      expect(syncSrc).toContain("skipped");
    });
  });

  describe("Admin password reset procedure", () => {
    it("defines resetUserPassword in adminSync router", () => {
      expect(routersSrc).toContain("resetUserPassword:");
    });

    it("accepts userId input", () => {
      const resetStart = routersSrc.indexOf("resetUserPassword:");
      const resetSection = routersSrc.slice(resetStart, resetStart + 200);
      expect(resetSection).toContain("userId: z.number()");
    });

    it("uses adminProcedure for reset", () => {
      const resetStart = routersSrc.indexOf("resetUserPassword:");
      const chunk = routersSrc.slice(resetStart, resetStart + 100);
      expect(chunk).toContain("adminProcedure");
    });

    it("generates new password and hashes it", () => {
      const resetStart = routersSrc.indexOf("resetUserPassword:");
      const resetSection = routersSrc.slice(resetStart, resetStart + 1200);
      expect(resetSection).toContain("crypto.randomBytes");
      expect(resetSection).toContain("hashPassword(newPassword)");
    });

    it("does NOT save plainPassword during reset", () => {
      const resetStart = routersSrc.indexOf("resetUserPassword:");
      const resetSection = routersSrc.slice(resetStart, resetStart + 1800);
      expect(resetSection).not.toContain("plainPassword");
    });

    it("returns newPassword in response", () => {
      const resetStart = routersSrc.indexOf("resetUserPassword:");
      const resetSection = routersSrc.slice(resetStart, resetStart + 1800);
      expect(resetSection).toContain("newPassword");
      expect(resetSection).toContain("userName");
    });
  });

  describe("Admin password reset button in AdminHub", () => {
    it("renders reset button with KeyRound icon", () => {
      expect(adminHubSrc).toContain("KeyRound");
      expect(adminHubSrc).toContain("Сбросить");
    });

    it("uses adminSync.resetUserPassword mutation", () => {
      expect(adminHubSrc).toContain("trpc.adminSync.resetUserPassword.useMutation");
    });

    it("shows loading state during reset", () => {
      expect(adminHubSrc).toContain("resetPendingId");
    });

    it("displays success toast with new password", () => {
      expect(adminHubSrc).toContain("Пароль сброшен");
      expect(adminHubSrc).toContain("data.newPassword");
    });

    it("has Actions column header", () => {
      expect(adminHubSrc).toContain("Действия");
    });

    it("invalidates funnel after reset", () => {
      // The reset mutation onSuccess also invalidates the funnel
      expect(adminHubSrc).toContain("utils.adminAnalytics.userFunnel.invalidate");
    });
  });
});
