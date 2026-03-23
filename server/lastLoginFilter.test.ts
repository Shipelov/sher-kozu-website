import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const routersSrc = readFileSync(
  path.resolve(__dirname, "routers.ts"),
  "utf-8"
);
const dbSrc = readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const adminUsersSrc = readFileSync(
  path.resolve(__dirname, "../client/src/pages/AdminUsers.tsx"),
  "utf-8"
);

describe("Last Login Filter Feature", () => {
  describe("ListUsersParams type", () => {
    it("should include lastLogin field in ListUsersParams", () => {
      const typeBlock = dbSrc.slice(
        dbSrc.indexOf("export type ListUsersParams"),
        dbSrc.indexOf("export type ListUsersParams") + 500
      );
      expect(typeBlock).toContain("lastLogin?:");
      expect(typeBlock).toContain('"today"');
      expect(typeBlock).toContain('"week"');
      expect(typeBlock).toContain('"month"');
      expect(typeBlock).toContain('"inactive"');
      expect(typeBlock).toContain('"never"');
    });
  });

  describe("listUsersAdmin — lastLogin filter logic", () => {
    const fnStart = dbSrc.indexOf("export async function listUsersAdmin");
    const fnBody = dbSrc.slice(fnStart, fnStart + 3000);

    it("should have a lastLogin filter block", () => {
      expect(fnBody).toContain("// Last login filter");
      expect(fnBody).toContain("params.lastLogin");
    });

    it("should filter 'today' using start of day", () => {
      expect(fnBody).toContain('params.lastLogin === "today"');
      expect(fnBody).toContain("startOfDay");
      expect(fnBody).toContain("gte(users.lastSignedIn, startOfDay)");
    });

    it("should filter 'week' using 7-day window", () => {
      expect(fnBody).toContain('params.lastLogin === "week"');
      expect(fnBody).toContain("7 * 24 * 60 * 60 * 1000");
      expect(fnBody).toContain("gte(users.lastSignedIn, weekAgo)");
    });

    it("should filter 'month' using 30-day window", () => {
      expect(fnBody).toContain('params.lastLogin === "month"');
      expect(fnBody).toContain("30 * 24 * 60 * 60 * 1000");
      expect(fnBody).toContain("gte(users.lastSignedIn, monthAgo)");
    });

    it("should filter 'inactive' as logged in but >30 days ago", () => {
      expect(fnBody).toContain('params.lastLogin === "inactive"');
      expect(fnBody).toContain("isNotNull(users.lastSignedIn)");
      expect(fnBody).toContain("lte(users.lastSignedIn, monthAgo)");
    });

    it("should filter 'never' as null lastSignedIn", () => {
      expect(fnBody).toContain('params.lastLogin === "never"');
      expect(fnBody).toContain("isNull(users.lastSignedIn)");
    });
  });

  describe("exportUsersAdmin — lastLogin filter logic", () => {
    const fnStart = dbSrc.indexOf("export async function exportUsersAdmin");
    const fnBody = dbSrc.slice(fnStart, fnStart + 3000);

    it("should have lastLogin filter in export function", () => {
      expect(fnBody).toContain("// Last login filter");
      expect(fnBody).toContain("params.lastLogin");
    });

    it("should support all five filter values in export", () => {
      expect(fnBody).toContain('params.lastLogin === "today"');
      expect(fnBody).toContain('params.lastLogin === "week"');
      expect(fnBody).toContain('params.lastLogin === "month"');
      expect(fnBody).toContain('params.lastLogin === "inactive"');
      expect(fnBody).toContain('params.lastLogin === "never"');
    });
  });

  describe("Router: listUsers input schema", () => {
    const listUsersBlock = routersSrc.slice(
      routersSrc.indexOf("listUsers: adminProcedure"),
      routersSrc.indexOf("listUsers: adminProcedure") + 600
    );

    it("should accept lastLogin enum in listUsers input", () => {
      expect(listUsersBlock).toContain("lastLogin:");
      expect(listUsersBlock).toContain('"today"');
      expect(listUsersBlock).toContain('"week"');
      expect(listUsersBlock).toContain('"month"');
      expect(listUsersBlock).toContain('"inactive"');
      expect(listUsersBlock).toContain('"never"');
    });
  });

  describe("Router: exportUsers input schema", () => {
    const exportBlock = routersSrc.slice(
      routersSrc.indexOf("exportUsers: adminProcedure"),
      routersSrc.indexOf("exportUsers: adminProcedure") + 600
    );

    it("should accept lastLogin enum in exportUsers input", () => {
      expect(exportBlock).toContain("lastLogin:");
      expect(exportBlock).toContain('"today"');
      expect(exportBlock).toContain('"inactive"');
      expect(exportBlock).toContain('"never"');
    });
  });

  describe("AdminUsers UI integration", () => {
    it("should have lastLoginFilter state", () => {
      expect(adminUsersSrc).toContain("lastLoginFilter");
      expect(adminUsersSrc).toContain("setLastLoginFilter");
    });

    it("should include lastLogin in queryInput", () => {
      expect(adminUsersSrc).toContain("lastLogin:");
      expect(adminUsersSrc).toContain("lastLoginFilter");
    });

    it("should include lastLoginFilter in hasActiveFilters check", () => {
      const hasActiveBlock = adminUsersSrc.slice(
        adminUsersSrc.indexOf("const hasActiveFilters"),
        adminUsersSrc.indexOf("const hasActiveFilters") + 300
      );
      expect(hasActiveBlock).toContain('lastLoginFilter !== "all"');
    });

    it("should reset lastLoginFilter in clearFilters", () => {
      const clearBlock = adminUsersSrc.slice(
        adminUsersSrc.indexOf("const clearFilters"),
        adminUsersSrc.indexOf("const clearFilters") + 300
      );
      expect(clearBlock).toContain('setLastLoginFilter("all")');
    });

    it("should render Select dropdown for lastLogin filter", () => {
      expect(adminUsersSrc).toContain("handleFilterChange(setLastLoginFilter)");
      expect(adminUsersSrc).toContain("Последний вход");
    });

    it("should have all filter options in the dropdown", () => {
      expect(adminUsersSrc).toContain('value="today"');
      expect(adminUsersSrc).toContain("Сегодня");
      expect(adminUsersSrc).toContain('value="week"');
      expect(adminUsersSrc).toContain("За неделю");
      expect(adminUsersSrc).toContain('value="month"');
      expect(adminUsersSrc).toContain("За месяц");
      expect(adminUsersSrc).toContain('value="inactive"');
      expect(adminUsersSrc).toContain("Неактивные");
      expect(adminUsersSrc).toContain('value="never"');
      expect(adminUsersSrc).toContain("Никогда не входили");
    });

    it("should include lastLogin in exportFilters", () => {
      const exportBlock = adminUsersSrc.slice(
        adminUsersSrc.indexOf("const exportFilters"),
        adminUsersSrc.indexOf("const exportFilters") + 900
      );
      expect(exportBlock).toContain("lastLogin:");
      expect(exportBlock).toContain("lastLoginFilter");
    });

    it("should include lastLoginFilter in exportFilters dependency array", () => {
      const exportBlock = adminUsersSrc.slice(
        adminUsersSrc.indexOf("const exportFilters"),
        adminUsersSrc.indexOf("const exportFilters") + 900
      );
      expect(exportBlock).toContain("lastLoginFilter");
    });
  });
});
