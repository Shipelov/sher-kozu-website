import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── 1. plainPassword Removal ───────────────────────────────

describe("Security: plainPassword removal", () => {
  it("schema.ts should not contain plainPassword column", () => {
    const schema = readFile("drizzle/schema.ts");
    expect(schema).not.toContain("plainPassword");
  });

  it("db.ts should not reference plainPassword", () => {
    const db = readFile("server/db.ts");
    expect(db).not.toContain("plainPassword");
  });

  it("localAuth.ts should not store plainPassword", () => {
    const localAuth = readFile("server/localAuth.ts");
    expect(localAuth).not.toContain("plainPassword");
  });

  it("routers.ts should not reference plainPassword", () => {
    const routers = readFile("server/routers.ts");
    expect(routers).not.toContain("plainPassword");
  });

  it("no client-side file should reference plainPassword", () => {
    const clientDir = path.join(ROOT, "client/src");
    const files = getAllTsxFiles(clientDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content, `Found plainPassword in ${file}`).not.toContain("plainPassword");
    }
  });
});

// ─── 2. Database Transactions ───────────────────────────────

describe("Security: financial operations use transactions", () => {
  const gamification = readFile("server/gamification.ts");

  it("adjustBankBalance should use db.transaction", () => {
    const funcStart = gamification.indexOf("export async function adjustBankBalance");
    const funcEnd = gamification.indexOf("\nexport ", funcStart + 1);
    const funcBody = gamification.slice(funcStart, funcEnd > -1 ? funcEnd : undefined);
    expect(funcBody).toContain("db.transaction");
  });

  it("grantTokensToOwner should use db.transaction", () => {
    const funcStart = gamification.indexOf("export async function grantTokensToOwner");
    const funcEnd = gamification.indexOf("\nexport ", funcStart + 1);
    const funcBody = gamification.slice(funcStart, funcEnd > -1 ? funcEnd : undefined);
    expect(funcBody).toContain("db.transaction");
  });

  it("refundTokensToOwner should use db.transaction", () => {
    const funcStart = gamification.indexOf("export async function refundTokensToOwner");
    const funcEnd = gamification.indexOf("\nexport ", funcStart + 1);
    const funcBody = gamification.slice(funcStart, funcEnd > -1 ? funcEnd : undefined);
    expect(funcBody).toContain("db.transaction");
  });

  it("purchaseMarketplaceItem should use db.transaction", () => {
    const funcStart = gamification.indexOf("export async function purchaseMarketplaceItem");
    const funcEnd = gamification.indexOf("\nexport ", funcStart + 1);
    const funcBody = gamification.slice(funcStart, funcEnd > -1 ? funcEnd : undefined);
    expect(funcBody).toContain("db.transaction");
  });

  it("should have exactly 4 transaction blocks", () => {
    const matches = gamification.match(/db\.transaction/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(4);
  });
});

// ─── 3. Admin Procedure Protection ─────────────────────────

describe("Security: admin routers use adminProcedure", () => {
  const routers = readFile("server/routers.ts");

  it("routers.ts should import adminProcedure", () => {
    expect(routers).toContain("adminProcedure");
  });

  const adminRouterNames = [
    "adminAnimals",
    "adminClub",
    "adminOwnerships",
    "adminSync",
    "adminAnalytics",
    "adminUserDetails",
    "adminTrash",
    "bitrixAdmin",
  ];

  for (const routerName of adminRouterNames) {
    it(`${routerName} router should use adminProcedure`, () => {
      const routerPattern = `${routerName}:`;
      const routerStart = routers.indexOf(routerPattern);
      if (routerStart === -1) return; // Skip if router not found
      const chunk = routers.slice(routerStart, routerStart + 3000);
      expect(chunk, `${routerName} should use adminProcedure`).toContain("adminProcedure");
    });
  }

  it("adminProcedure should check for admin role or owner", () => {
    const trpcFile = readFile("server/_core/trpc.ts");
    expect(trpcFile).toContain("adminProcedure");
    expect(trpcFile).toMatch(/role.*admin|admin.*role/);
  });
});

// ─── 4. Body Parser Limit ───────────────────────────────────

describe("Security: body parser limit", () => {
  const serverIndex = readFile("server/_core/index.ts");

  it("JSON body limit should be 10mb or less", () => {
    const jsonLimitMatch = serverIndex.match(/express\.json\(\s*\{[^}]*limit:\s*["'](\d+)mb["']/);
    expect(jsonLimitMatch).not.toBeNull();
    const limitMb = parseInt(jsonLimitMatch![1]);
    expect(limitMb).toBeLessThanOrEqual(10);
  });

  it("URL-encoded body limit should be 10mb or less", () => {
    const urlLimitMatch = serverIndex.match(/express\.urlencoded\(\s*\{[^}]*limit:\s*["'](\d+)mb["']/);
    expect(urlLimitMatch).not.toBeNull();
    const limitMb = parseInt(urlLimitMatch![1]);
    expect(limitMb).toBeLessThanOrEqual(10);
  });
});

// ─── 5. Rate Limiting ───────────────────────────────────────

describe("Security: rate limiting on auth endpoints", () => {
  const localAuth = readFile("server/localAuth.ts");

  it("login should have rate limiting", () => {
    const loginStart = localAuth.indexOf("login:");
    if (loginStart === -1) return;
    const chunk = localAuth.slice(loginStart, loginStart + 2000);
    expect(chunk).toContain("checkRateLimit");
  });

  it("register should have rate limiting", () => {
    const registerStart = localAuth.indexOf("register:");
    if (registerStart === -1) return;
    const chunk = localAuth.slice(registerStart, registerStart + 2000);
    expect(chunk).toContain("checkRateLimit");
  });
});

// ─── 6. Dead Code Removal ───────────────────────────────────

describe("Cleanup: dead code removed", () => {
  it("AnimalDetails.tsx should not exist (unused)", () => {
    const exists = fs.existsSync(path.join(ROOT, "client/src/pages/AnimalDetails.tsx"));
    expect(exists).toBe(false);
  });

  it("OwnerProductPlanSection.tsx should not exist (unused)", () => {
    const exists = fs.existsSync(path.join(ROOT, "client/src/components/OwnerProductPlanSection.tsx"));
    expect(exists).toBe(false);
  });
});

// ─── 7. Breadcrumbs DOM Fix ─────────────────────────────────

describe("Breadcrumbs: no nested li elements", () => {
  const breadcrumbs = readFile("client/src/components/PageBreadcrumbs.tsx");

  it("BreadcrumbSeparator should not be inside BreadcrumbItem", () => {
    const lines = breadcrumbs.split("\n");
    let insideBreadcrumbItem = 0;
    for (const line of lines) {
      if (line.includes("<BreadcrumbItem")) insideBreadcrumbItem++;
      if (line.includes("</BreadcrumbItem>")) insideBreadcrumbItem--;
      if (insideBreadcrumbItem > 0 && line.includes("<BreadcrumbSeparator")) {
        throw new Error("BreadcrumbSeparator found inside BreadcrumbItem — this causes nested <li>");
      }
    }
  });

  it("should use React.Fragment for separator placement", () => {
    expect(breadcrumbs).toContain("React.Fragment");
  });
});
