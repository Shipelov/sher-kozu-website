import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests for the admin user export feature:
 * 1. exportUsersAdmin function exists in db.ts
 * 2. exportUsers procedure exists in routers.ts
 * 3. Export returns all fields needed for CSV/Excel
 * 4. No pagination in export (returns all matching rows)
 */

const dbSrc = readFileSync(resolve(__dirname, "db.ts"), "utf-8");
const routersSrc = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");

describe("exportUsersAdmin — server-side export function", () => {
  it("exports function from db.ts", () => {
    expect(dbSrc).toContain("export async function exportUsersAdmin");
  });

  it("accepts filters without pagination params", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).toContain('Omit<ListUsersParams, "page" | "pageSize">');
  });

  it("does NOT use limit or offset (returns all rows)", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).not.toContain(".limit(");
    expect(exportSection).not.toContain(".offset(");
  });

  it("selects key fields for export", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).toContain("users.id");
    expect(exportSection).toContain("users.name");
    expect(exportSection).toContain("users.email");
    expect(exportSection).toContain("users.phone");
    expect(exportSection).toContain("users.role");
    expect(exportSection).toContain("users.loginMethod");
    expect(exportSection).toContain("users.bitrix24ContactId");
    expect(exportSection).toContain("users.createdAt");
    expect(exportSection).toContain("users.lastSignedIn");
  });

  it("supports search filter", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).toContain("params.search");
    expect(exportSection).toContain("like(users.name, term)");
  });

  it("supports role filter", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).toContain("params.role");
  });

  it("supports hasBitrix filter", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).toContain("params.hasBitrix");
  });

  it("excludes soft-deleted users from export", () => {
    const exportSection = dbSrc.slice(
      dbSrc.indexOf("export async function exportUsersAdmin"),
      dbSrc.indexOf("export async function exportUsersAdmin") + 3000,
    );
    expect(exportSection).toContain("isNull(users.deletedAt)");
    expect(exportSection).toContain("Exclude soft-deleted users from export");
  });
});

describe("exportUsers — tRPC procedure", () => {
  it("defines exportUsers procedure in routers.ts", () => {
    expect(routersSrc).toContain("exportUsers: protectedProcedure");
  });

  it("is imported from db.ts", () => {
    expect(routersSrc).toContain("exportUsersAdmin");
  });

  it("requires admin role", () => {
    const exportProcSection = routersSrc.slice(
      routersSrc.indexOf("exportUsers: protectedProcedure"),
      routersSrc.indexOf("exportUsers: protectedProcedure") + 800,
    );
    expect(exportProcSection).toContain('role !== "admin"');
    expect(exportProcSection).toContain("FORBIDDEN");
  });

  it("accepts filter inputs without pagination", () => {
    const exportProcSection = routersSrc.slice(
      routersSrc.indexOf("exportUsers: protectedProcedure"),
      routersSrc.indexOf("exportUsers: protectedProcedure") + 800,
    );
    expect(exportProcSection).toContain("search: z.string().optional()");
    expect(exportProcSection).toContain('role: z.enum(["user", "admin"]).optional()');
    expect(exportProcSection).not.toContain("page:");
    expect(exportProcSection).not.toContain("pageSize:");
  });
});

describe("AdminUsers.tsx — export UI", () => {
  const adminUsersSrc = readFileSync(
    resolve(__dirname, "../client/src/pages/AdminUsers.tsx"),
    "utf-8",
  );

  it("imports Download and FileSpreadsheet icons", () => {
    expect(adminUsersSrc).toContain("Download");
    expect(adminUsersSrc).toContain("FileSpreadsheet");
  });

  it("has CSV export handler", () => {
    expect(adminUsersSrc).toContain("handleExportCSV");
    expect(adminUsersSrc).toContain("text/csv");
  });

  it("has Excel export handler using xlsx library", () => {
    expect(adminUsersSrc).toContain("handleExportExcel");
    expect(adminUsersSrc).toContain('import("xlsx")');
  });

  it("uses BOM for CSV encoding (Excel compatibility)", () => {
    expect(adminUsersSrc).toContain("\\uFEFF");
  });

  it("uses semicolon delimiter for CSV (Russian locale compatibility)", () => {
    expect(adminUsersSrc).toContain('.join(";")');
  });

  it("calls exportUsers tRPC procedure", () => {
    expect(adminUsersSrc).toContain("adminAnalytics.exportUsers.fetch");
  });

  it("shows loading state during export", () => {
    expect(adminUsersSrc).toContain('exporting === "csv"');
    expect(adminUsersSrc).toContain('exporting === "xlsx"');
  });

  it("exports with current filters applied", () => {
    expect(adminUsersSrc).toContain("exportFilters");
  });
});
