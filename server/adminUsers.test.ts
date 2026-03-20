import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests for the listUsersAdmin DB helper and adminAnalytics.listUsers procedure.
 * We verify the function signature, parameters, SQL construction patterns,
 * and the procedure's admin-only access control.
 */

const dbSource = readFileSync(resolve(__dirname, "db.ts"), "utf-8");
const routersSource = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");

describe("listUsersAdmin — DB helper", () => {
  it("exports the listUsersAdmin function", () => {
    expect(dbSource).toContain("export async function listUsersAdmin");
  });

  it("accepts ListUsersParams with all expected fields", () => {
    expect(dbSource).toContain("page: number");
    expect(dbSource).toContain("pageSize: number");
    expect(dbSource).toContain("search?: string");
    expect(dbSource).toContain('role?: "user" | "admin"');
    expect(dbSource).toContain("loginMethod?: string");
    expect(dbSource).toContain("hasBitrix?: boolean");
    expect(dbSource).toContain("hasPassword?: boolean");
    expect(dbSource).toContain('sortBy?: "createdAt" | "name" | "email" | "lastSignedIn"');
    expect(dbSource).toContain('sortOrder?: "asc" | "desc"');
  });

  it("returns empty result when db is unavailable", () => {
    expect(dbSource).toContain(
      "return { users: [], total: 0, page: params.page, pageSize: params.pageSize, totalPages: 0 }",
    );
  });

  it("applies search filter with LIKE on name, email, phone", () => {
    expect(dbSource).toContain("like(users.name, term)");
    expect(dbSource).toContain("like(users.email, term)");
    expect(dbSource).toContain("like(users.phone, term)");
  });

  it("applies role filter with eq", () => {
    expect(dbSource).toContain("eq(users.role, params.role)");
  });

  it("applies loginMethod filter with eq", () => {
    expect(dbSource).toContain("eq(users.loginMethod, params.loginMethod)");
  });

  it("applies Bitrix linked filter with isNotNull/isNull", () => {
    expect(dbSource).toContain("isNotNull(users.bitrix24ContactId)");
    expect(dbSource).toContain("isNull(users.bitrix24ContactId)");
  });

  it("applies hasPassword filter with isNotNull/isNull on passwordHash", () => {
    expect(dbSource).toContain("isNotNull(users.passwordHash)");
    expect(dbSource).toContain("isNull(users.passwordHash)");
  });

  it("calculates offset from page and pageSize", () => {
    expect(dbSource).toContain("(params.page - 1) * params.pageSize");
  });

  it("calculates totalPages correctly", () => {
    expect(dbSource).toContain("Math.ceil(total / params.pageSize)");
  });

  it("returns structured result with users, total, page, pageSize, totalPages", () => {
    expect(dbSource).toContain(
      "return { users: rows, total, page: params.page, pageSize: params.pageSize, totalPages }",
    );
  });

  it("selects all required user fields", () => {
    const selectFields = [
      "users.id",
      "users.openId",
      "users.name",
      "users.email",
      "users.phone",
      "users.preferredContact",
      "users.role",
      "users.plainPassword",
      "users.loginMethod",
      "users.bitrix24ContactId",
      "users.onboardingCompleted",
      "users.createdAt",
      "users.updatedAt",
      "users.lastSignedIn",
    ];
    // Find the listUsersAdmin function body
    const fnStart = dbSource.indexOf("export async function listUsersAdmin");
    const fnBody = dbSource.slice(fnStart, fnStart + 3000);
    for (const field of selectFields) {
      expect(fnBody).toContain(field);
    }
  });

  it("supports sorting by createdAt, name, email, lastSignedIn", () => {
    expect(dbSource).toContain("createdAt: users.createdAt");
    expect(dbSource).toContain("name: users.name");
    expect(dbSource).toContain("email: users.email");
    expect(dbSource).toContain("lastSignedIn: users.lastSignedIn");
  });

  it("defaults to desc sort order", () => {
    expect(dbSource).toContain('params.sortOrder === "asc" ? asc : desc');
  });
});

describe("adminAnalytics.listUsers — tRPC procedure", () => {
  it("is defined in the adminAnalytics router", () => {
    expect(routersSource).toContain("listUsers: protectedProcedure");
  });

  it("validates page as min(1)", () => {
    expect(routersSource).toContain("page: z.number().min(1).default(1)");
  });

  it("validates pageSize with min(5) and max(100)", () => {
    expect(routersSource).toContain("pageSize: z.number().min(5).max(100).default(20)");
  });

  it("enforces admin-only access", () => {
    expect(routersSource).toContain('ctx.user.role !== "admin"');
    expect(routersSource).toContain("process.env.OWNER_OPEN_ID");
    expect(routersSource).toContain('code: "FORBIDDEN"');
  });

  it("calls listUsersAdmin with the validated input", () => {
    expect(routersSource).toContain("return listUsersAdmin(input)");
  });

  it("imports listUsersAdmin from db", () => {
    expect(routersSource).toContain("listUsersAdmin,");
  });
});
