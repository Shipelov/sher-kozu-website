import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for three new features:
 * 1. Compare button in AnimalProfile with pre-selection via query param
 * 2. CSV/PDF analytics export for admin
 * 3. Automatic badge triggers on purchase and rating update
 */

const ANIMAL_PROFILE_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/AnimalProfile.tsx"),
  "utf-8",
);
const ANIMAL_COMPARE_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/AnimalCompare.tsx"),
  "utf-8",
);
const ADMIN_ANALYTICS_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/AdminAnalytics.tsx"),
  "utf-8",
);
const GAMIFICATION_ROUTER_SRC = fs.readFileSync(
  path.resolve(__dirname, "routers/gamification.ts"),
  "utf-8",
);
const GAMIFICATION_SRC = fs.readFileSync(
  path.resolve(__dirname, "gamification.ts"),
  "utf-8",
);
const ANALYTICS_EXPORT_SRC = fs.readFileSync(
  path.resolve(__dirname, "analyticsExport.ts"),
  "utf-8",
);
const APP_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/App.tsx"),
  "utf-8",
);

// ═══════════════════════════════════════════════════════════
// 1. Compare Button in AnimalProfile
// ═══════════════════════════════════════════════════════════

describe("Compare button in AnimalProfile", () => {
  it("imports ArrowLeftRight icon", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("ArrowLeftRight");
  });

  it("has a Link to /compare with animal slug query param", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("/compare?animal=${animalSlug}");
  });

  it("displays the compare card with proper title", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("Сравнить");
  });

  it("shows tooltip text for the compare button", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("Сравните метрики с другим животным");
  });

  it("uses 3-column grid for navigation links (Compare moved to top)", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("sm:grid-cols-3");
  });

  it("applies accent styling for owners with hasOwnerAccess", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("border-primary/60 bg-primary/10");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. AnimalCompare pre-selection from query param
// ═══════════════════════════════════════════════════════════

describe("AnimalCompare query parameter pre-selection", () => {
  it("imports useSearch from wouter", () => {
    expect(ANIMAL_COMPARE_SRC).toContain("useSearch");
  });

  it("imports useEffect", () => {
    expect(ANIMAL_COMPARE_SRC).toContain("useEffect");
  });

  it("reads ?animal= query parameter", () => {
    expect(ANIMAL_COMPARE_SRC).toContain('params.get("animal")');
  });

  it("has preselected state to prevent re-selection", () => {
    expect(ANIMAL_COMPARE_SRC).toContain("preselected");
    expect(ANIMAL_COMPARE_SRC).toContain("setPreselected(true)");
  });

  it("matches by slug or id", () => {
    expect(ANIMAL_COMPARE_SRC).toContain("a.slug === preselectedSlug");
    expect(ANIMAL_COMPARE_SRC).toContain('String(a.id) === preselectedSlug');
  });

  it("sets animalIdA when match is found", () => {
    expect(ANIMAL_COMPARE_SRC).toContain("setAnimalIdA(match.id)");
  });
});

// ═══════════════════════════════════════════════════════════
// 3. CSV/PDF Analytics Export — Server
// ═══════════════════════════════════════════════════════════

describe("Analytics Export module (analyticsExport.ts)", () => {
  it("exports exportOwnerRatingsCsv function", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("export async function exportOwnerRatingsCsv");
  });

  it("exports exportHerdWellnessCsv function", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("export async function exportHerdWellnessCsv");
  });

  it("exports exportMarketplaceSalesCsv function", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("export async function exportMarketplaceSalesCsv");
  });

  it("exports generateAnalyticsPdfHtml function", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("export async function generateAnalyticsPdfHtml");
  });

  it("uses BOM for Excel UTF-8 compatibility", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("\\ufeff");
  });

  it("escapes CSV fields with commas and quotes", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("escapeCsvField");
    expect(ANALYTICS_EXPORT_SRC).toContain('str.replace(/"/g, \'""\'');
  });

  it("uses COUNT(DISTINCT animalId) in owner ratings CSV", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("count(DISTINCT animalId)");
  });

  it("generates HTML report with proper styling", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain("Аналитика Шерь Козу");
    expect(ANALYTICS_EXPORT_SRC).toContain("Рейтинг владельцев");
    expect(ANALYTICS_EXPORT_SRC).toContain("Метрики стада");
  });

  it("includes owner rating columns in CSV", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain('"rank"');
    expect(ANALYTICS_EXPORT_SRC).toContain('"totalScore"');
    expect(ANALYTICS_EXPORT_SRC).toContain('"animalCount"');
  });

  it("includes herd wellness columns in CSV", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain('"happiness"');
    expect(ANALYTICS_EXPORT_SRC).toContain('"health"');
    expect(ANALYTICS_EXPORT_SRC).toContain('"overallRating"');
  });

  it("limits marketplace sales export to 500 rows", () => {
    expect(ANALYTICS_EXPORT_SRC).toContain(".limit(500)");
  });
});

// ═══════════════════════════════════════════════════════════
// 4. CSV/PDF Analytics Export — tRPC Routes
// ═══════════════════════════════════════════════════════════

describe("Analytics export tRPC routes (gamification router)", () => {
  it("has exportCsv mutation", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain("exportCsv:");
  });

  it("accepts type enum: owners, herd, sales", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain('z.enum(["owners", "herd", "sales"])');
  });

  it("has exportPdf mutation", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain("exportPdf:");
  });

  it("uses adminProcedure for export routes", () => {
    const exportCsvIdx = GAMIFICATION_ROUTER_SRC.indexOf("exportCsv:");
    const exportPdfIdx = GAMIFICATION_ROUTER_SRC.indexOf("exportPdf:");
    // Both should be within the analytics router which uses adminProcedure
    expect(exportCsvIdx).toBeGreaterThan(0);
    expect(exportPdfIdx).toBeGreaterThan(0);
    // Check they use adminProcedure
    const csvSection = GAMIFICATION_ROUTER_SRC.slice(exportCsvIdx, exportCsvIdx + 100);
    const pdfSection = GAMIFICATION_ROUTER_SRC.slice(exportPdfIdx, exportPdfIdx + 100);
    expect(csvSection).toContain("adminProcedure");
    expect(pdfSection).toContain("adminProcedure");
  });

  it("returns csv and filename for CSV export", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain("return { csv, filename }");
  });

  it("returns html and filename for PDF export", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain("return { html, filename");
  });
});

// ═══════════════════════════════════════════════════════════
// 5. CSV/PDF Analytics Export — AdminAnalytics UI
// ═══════════════════════════════════════════════════════════

describe("AdminAnalytics export buttons", () => {
  it("imports Download and FileText icons", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("Download");
    expect(ADMIN_ANALYTICS_SRC).toContain("FileText");
  });

  it("imports toast for notifications", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain('import { toast } from "sonner"');
  });

  it("has downloadFile helper function", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("function downloadFile");
    expect(ADMIN_ANALYTICS_SRC).toContain("Blob");
    expect(ADMIN_ANALYTICS_SRC).toContain("createObjectURL");
  });

  it("uses exportCsv mutation", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("trpc.gamification.analytics.exportCsv.useMutation");
  });

  it("uses exportPdf mutation", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("trpc.gamification.analytics.exportPdf.useMutation");
  });

  it("maps active tab to export type", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("typeMap[activeTab]");
  });

  it("shows loading state during export", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("isExporting");
    expect(ADMIN_ANALYTICS_SRC).toContain("exportCsv.isPending");
    expect(ADMIN_ANALYTICS_SRC).toContain("exportPdf.isPending");
  });

  it("has CSV button", () => {
    // Button text is rendered as JSX child
    expect(ADMIN_ANALYTICS_SRC).toMatch(/CSV/);
    expect(ADMIN_ANALYTICS_SRC).toContain("exportCsv.mutate");
  });

  it("has Отчёт (Report) button", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("Отчёт");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Automatic Badge Triggers — Marketplace Purchase
// ═══════════════════════════════════════════════════════════

describe("Auto badge trigger on marketplace purchase", () => {
  it("calls checkAndAwardBadges after purchase in purchaseMarketplaceItem", () => {
    const purchaseStart = GAMIFICATION_SRC.indexOf("purchaseMarketplaceItem");
    const purchaseEnd = GAMIFICATION_SRC.indexOf("// ─── Wellness Metrics");
    const purchaseSection = GAMIFICATION_SRC.slice(purchaseStart, purchaseEnd);
    expect(purchaseSection).toContain("checkAndAwardBadges");
  });

  it("imports badges module dynamically", () => {
    const purchaseStart = GAMIFICATION_SRC.indexOf("// 18. Auto-check badges after purchase");
    const purchaseEnd = GAMIFICATION_SRC.indexOf("return { purchase, checklist, metricsAfter }");
    const section = GAMIFICATION_SRC.slice(purchaseStart, purchaseEnd);
    expect(section).toContain('import("./badges")');
  });

  it("passes hasPurchases: true to badge check", () => {
    expect(GAMIFICATION_SRC).toContain("hasPurchases: true");
  });

  it("wraps badge check in try-catch to not break purchase flow", () => {
    const purchaseStart = GAMIFICATION_SRC.indexOf("// 18. Auto-check badges after purchase");
    const purchaseEnd = GAMIFICATION_SRC.indexOf("return { purchase, checklist, metricsAfter }");
    const section = GAMIFICATION_SRC.slice(purchaseStart, purchaseEnd);
    expect(section).toContain("try {");
    expect(section).toContain("} catch (e) {");
    expect(section).toContain("[Badges] Auto-check after purchase failed:");
  });

  it("uses COUNT(DISTINCT animalId) for animal count in badge trigger", () => {
    const purchaseStart = GAMIFICATION_SRC.indexOf("// 18. Auto-check badges after purchase");
    const purchaseEnd = GAMIFICATION_SRC.indexOf("return { purchase, checklist, metricsAfter }");
    const section = GAMIFICATION_SRC.slice(purchaseStart, purchaseEnd);
    expect(section).toContain("count(DISTINCT animalId)");
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Automatic Badge Triggers — Rating Update
// ═══════════════════════════════════════════════════════════

describe("Auto badge trigger on rating update", () => {
  it("calls checkAndAwardBadges in updateOwnerRating", () => {
    const ratingStart = GAMIFICATION_SRC.indexOf("// Auto-check badges after rating update");
    expect(ratingStart).toBeGreaterThan(0);
    const ratingEnd = GAMIFICATION_SRC.indexOf("// Record daily snapshot for history chart");
    const section = GAMIFICATION_SRC.slice(ratingStart, ratingEnd);
    expect(section).toContain("checkAndAwardBadges");
  });

  it("passes rank and totalScore to badge check", () => {
    const ratingStart = GAMIFICATION_SRC.indexOf("// Auto-check badges after rating update");
    const ratingEnd = GAMIFICATION_SRC.indexOf("// Record daily snapshot for history chart");
    const section = GAMIFICATION_SRC.slice(ratingStart, ratingEnd);
    expect(section).toContain("rank:");
    expect(section).toContain("totalScore");
  });

  it("passes animalHealthScores and animalHappinessScores", () => {
    const ratingStart = GAMIFICATION_SRC.indexOf("// Auto-check badges after rating update");
    const ratingEnd = GAMIFICATION_SRC.indexOf("// Record daily snapshot for history chart");
    const section = GAMIFICATION_SRC.slice(ratingStart, ratingEnd);
    expect(section).toContain("animalHealthScores:");
    expect(section).toContain("animalHappinessScores:");
  });

  it("wraps badge check in try-catch to not break rating flow", () => {
    const ratingStart = GAMIFICATION_SRC.indexOf("// Auto-check badges after rating update");
    const ratingEnd = GAMIFICATION_SRC.indexOf("// Record daily snapshot for history chart");
    const section = GAMIFICATION_SRC.slice(ratingStart, ratingEnd);
    expect(section).toContain("try {");
    expect(section).toContain("} catch (e) {");
    expect(section).toContain("[Badges] Auto-check after rating update failed:");
  });
});

// ═══════════════════════════════════════════════════════════
// 8. Route registration
// ═══════════════════════════════════════════════════════════

describe("Route registration for /compare", () => {
  it("has /compare route in App.tsx", () => {
    expect(APP_SRC).toContain("/compare");
  });
});
