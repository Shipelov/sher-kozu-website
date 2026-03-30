import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const dbSrc = fs.readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const routersSrc = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf-8");

describe("Admin ↔ Catalog sync (single-owner farm model)", () => {
  it("listAdminAnimals filters by ENV.ownerOpenId to exclude test/buyer animals", () => {
    // The function should filter by the farm owner's openId to prevent test animals from appearing
    expect(dbSrc).toContain("export async function listAdminAnimals(_ownerOpenId");
    const fnStart = dbSrc.indexOf("export async function listAdminAnimals");
    const fnEnd = dbSrc.indexOf("return Promise.all(rows.map", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("ENV.ownerOpenId");
    expect(fnBody).toContain("eq(animals.ownerOpenId, farmOwner)");
  });

  it("listPublicAnimals filters by ENV.ownerOpenId to exclude test animals", () => {
    expect(dbSrc).toContain("ENV.ownerOpenId");
    const fnStart = dbSrc.indexOf("export async function listPublicAnimals");
    const fnEnd = dbSrc.indexOf("return Promise.all(rows.map", fnStart + 1);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("farmOwner");
    expect(fnBody).toContain("eq(animals.ownerOpenId, farmOwner)");
  });

  it("updateAnimalWithMedia does NOT filter by ownerOpenId", () => {
    expect(dbSrc).toContain("export async function updateAnimalWithMedia");
    const fnStart = dbSrc.indexOf("export async function updateAnimalWithMedia");
    const fnEnd = dbSrc.indexOf("await recalculateAnimalStatus", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("_ownerOpenId");
    expect(fnBody).not.toContain("eq(animals.ownerOpenId");
  });

  it("archiveAnimalProfile does NOT filter by ownerOpenId", () => {
    const fnStart = dbSrc.indexOf("export async function archiveAnimalProfile");
    const fnEnd = dbSrc.indexOf("return {", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("_ownerOpenId");
    expect(fnBody).not.toContain("eq(animals.ownerOpenId");
  });

  it("restoreAnimalProfile does NOT filter by ownerOpenId", () => {
    const fnStart = dbSrc.indexOf("export async function restoreAnimalProfile");
    const fnEnd = dbSrc.indexOf("const rows = await db.select({ slug: animals.slug })", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("_ownerOpenId");
    expect(fnBody).not.toContain("eq(animals.ownerOpenId");
  });

  it("setAnimalVisibility does NOT filter by ownerOpenId", () => {
    const fnStart = dbSrc.indexOf("export async function setAnimalVisibility");
    const fnEnd = dbSrc.indexOf("if (mode === \"public\")", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("_ownerOpenId");
    expect(fnBody).not.toContain("eq(animals.ownerOpenId");
  });

  it("ensureSprintOneSeed no longer creates demo animals", () => {
    const fnStart = dbSrc.indexOf("export async function ensureSprintOneSeed");
    const fnEnd = dbSrc.indexOf("async function ensurePlanDurationsExist", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    // Demo animal creation has been removed — only plan/duration seeding remains
    expect(fnBody).not.toContain('createAnimalWithMedia');
    expect(fnBody).toContain("ensurePlanDurationsExist");
  });

  it("ensureSprintOneSeed skips seeding for non-farm-owner accounts", () => {
    const fnStart = dbSrc.indexOf("export async function ensureSprintOneSeed");
    const fnEnd = dbSrc.indexOf("const db = await getDb()", fnStart);
    const fnBody = dbSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain("ENV.ownerOpenId");
    expect(fnBody).toContain("ownerOpenId !== farmOwner");
  });

  it("adminAnimals.list router calls listAdminAnimals", () => {
    expect(routersSrc).toContain("listAdminAnimals");
  });

  it("adminAnimals.create assigns ownerOpenId from ctx.user.openId", () => {
    expect(routersSrc).toContain("ownerOpenId: ctx.user.openId");
  });
});
