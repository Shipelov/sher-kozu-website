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
});
