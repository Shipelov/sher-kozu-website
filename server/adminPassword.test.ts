import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(import.meta.dirname, "..", relPath), "utf-8");
}

describe("Admin: plainPassword field and Bitrix24 sync button", () => {
  const schemaSrc = readSource("drizzle/schema.ts");
  const localAuthSrc = readSource("server/localAuth.ts");
  const dbSrc = readSource("server/db.ts");
  const adminHubSrc = readSource("client/src/pages/AdminHub.tsx");
  const routersSrc = readSource("server/routers.ts");

  describe("plainPassword field in schema", () => {
    it("defines plainPassword column in users table", () => {
      expect(schemaSrc).toContain("plainPassword");
      expect(schemaSrc).toContain('varchar("plainPassword"');
    });
  });

  describe("plainPassword saved during registration", () => {
    it("sets plainPassword in registerLocalUser insert", () => {
      const registerSection = localAuthSrc.slice(
        localAuthSrc.indexOf("async function registerLocalUser"),
        localAuthSrc.indexOf("async function registerLocalUser") + 800,
      );
      expect(registerSection).toContain("plainPassword: data.password");
    });
  });

  describe("plainPassword updated on password change", () => {
    it("sets plainPassword in updateUserPassword", () => {
      const updateSection = localAuthSrc.slice(
        localAuthSrc.indexOf("async function updateUserPassword"),
        localAuthSrc.indexOf("async function updateUserPassword") + 400,
      );
      expect(updateSection).toContain("plainPassword: newPassword");
    });
  });

  describe("plainPassword returned in funnel analytics", () => {
    it("selects plainPassword in getUserFunnelAnalytics recentUsers", () => {
      const funnelSection = dbSrc.slice(
        dbSrc.indexOf("async function getUserFunnelAnalytics"),
        dbSrc.indexOf("async function getUserFunnelAnalytics") + 2000,
      );
      expect(funnelSection).toContain("plainPassword: users.plainPassword");
    });
  });

  describe("AdminHub displays password column", () => {
    it("renders Пароль table header", () => {
      expect(adminHubSrc).toContain("Пароль");
    });

    it("uses PasswordCell component", () => {
      expect(adminHubSrc).toContain("PasswordCell");
      expect(adminHubSrc).toContain("u.plainPassword");
    });

    it("has show/hide toggle with Eye icons", () => {
      expect(adminHubSrc).toContain("Eye");
      expect(adminHubSrc).toContain("EyeOff");
      expect(adminHubSrc).toContain("Показать пароль");
      expect(adminHubSrc).toContain("Скрыть пароль");
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
      expect(routersSrc).toContain("syncBitrixContacts: protectedProcedure.mutation");
    });

    it("checks admin role before sync", () => {
      const syncSection = routersSrc.slice(
        routersSrc.indexOf("syncBitrixContacts: protectedProcedure"),
        routersSrc.indexOf("syncBitrixContacts: protectedProcedure") + 300,
      );
      expect(syncSection).toContain('ctx.user.role !== "admin"');
    });
  });

  describe("Sync optimization: pre-loaded Maps and batch operations", () => {
    // Get the full sync procedure source
    const syncStart = routersSrc.indexOf("syncBitrixContacts: protectedProcedure");
    const syncEnd = routersSrc.indexOf("resetUserPassword: protectedProcedure");
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
      expect(routersSrc).toContain("resetUserPassword: protectedProcedure");
    });

    it("accepts userId input", () => {
      const resetSection = routersSrc.slice(
        routersSrc.indexOf("resetUserPassword: protectedProcedure"),
        routersSrc.indexOf("resetUserPassword: protectedProcedure") + 200,
      );
      expect(resetSection).toContain("userId: z.number()");
    });

    it("checks admin role before reset", () => {
      const resetSection = routersSrc.slice(
        routersSrc.indexOf("resetUserPassword: protectedProcedure"),
        routersSrc.indexOf("resetUserPassword: protectedProcedure") + 400,
      );
      expect(resetSection).toContain('ctx.user.role !== "admin"');
    });

    it("generates new password and hashes it", () => {
      const resetSection = routersSrc.slice(
        routersSrc.indexOf("resetUserPassword: protectedProcedure"),
        routersSrc.indexOf("resetUserPassword: protectedProcedure") + 1200,
      );
      expect(resetSection).toContain("crypto.randomBytes");
      expect(resetSection).toContain("hashPassword(newPassword)");
    });

    it("saves both passwordHash and plainPassword", () => {
      const resetSection = routersSrc.slice(
        routersSrc.indexOf("resetUserPassword: protectedProcedure"),
        routersSrc.indexOf("resetUserPassword: protectedProcedure") + 1800,
      );
      expect(resetSection).toContain("passwordHash: newHash");
      expect(resetSection).toContain("plainPassword: newPassword");
    });

    it("returns newPassword in response", () => {
      const resetSection = routersSrc.slice(
        routersSrc.indexOf("resetUserPassword: protectedProcedure"),
        routersSrc.indexOf("resetUserPassword: protectedProcedure") + 1800,
      );
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
