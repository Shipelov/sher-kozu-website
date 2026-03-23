import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for the Gamification Ecosystem "Забота".
 *
 * Covers:
 * 1. Database schema (new tables)
 * 2. Server logic (gamification.ts db helpers)
 * 3. tRPC router (gamification router procedures)
 * 4. Admin UI pages (Marketplace, Tokens, Analytics)
 * 5. Owner UI pages (Marketplace, Leaderboard, Dashboard balance, AnimalProfile wellness)
 * 6. WellnessRadarChart component
 */

const SCHEMA_SRC = fs.readFileSync(path.resolve(__dirname, "../drizzle/schema.ts"), "utf-8");
const GAMIFICATION_SRC = fs.readFileSync(path.resolve(__dirname, "gamification.ts"), "utf-8");
const ROUTER_SRC = fs.readFileSync(path.resolve(__dirname, "routers/gamification.ts"), "utf-8");
const ADMIN_MARKETPLACE_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/AdminMarketplace.tsx"), "utf-8");
const ADMIN_TOKENS_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/AdminTokens.tsx"), "utf-8");
const ADMIN_ANALYTICS_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/AdminAnalytics.tsx"), "utf-8");
const MARKETPLACE_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Marketplace.tsx"), "utf-8");
const LEADERBOARD_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Leaderboard.tsx"), "utf-8");
const DASHBOARD_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"), "utf-8");
const ANIMAL_PROFILE_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/AnimalProfile.tsx"), "utf-8");
const RADAR_CHART_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/components/WellnessRadarChart.tsx"), "utf-8");
const APP_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/App.tsx"), "utf-8");

// ═══════════════════════════════════════════════════════════
// 0. BANK BALANCE ADJUSTMENT
// ═══════════════════════════════════════════════════════════

describe("Bank Balance Adjustment", () => {
  describe("Server: adjustBankBalance function", () => {
    it("exports adjustBankBalance from gamification.ts", () => {
      expect(GAMIFICATION_SRC).toContain("export async function adjustBankBalance");
    });

    it("accepts newBalanceSKC, memo, and initiatedByOpenId parameters", () => {
      expect(GAMIFICATION_SRC).toContain("newBalanceSKC: number");
      expect(GAMIFICATION_SRC).toContain("memo: string");
      expect(GAMIFICATION_SRC).toContain("initiatedByOpenId: string");
    });

    it("calculates diff between old and new balance", () => {
      expect(GAMIFICATION_SRC).toContain("const diff = newBalanceSKC - oldBalance");
    });

    it("returns unchanged result when diff is 0", () => {
      expect(GAMIFICATION_SRC).toContain("if (diff === 0) return { bank, changed: false }");
    });

    it("updates bank balanceSKC in database", () => {
      expect(GAMIFICATION_SRC).toContain("balanceSKC: newBalanceSKC");
    });

    it("records adjustment transaction with correct txType", () => {
      expect(GAMIFICATION_SRC).toContain('txType: "adjustment"');
    });

    it("sets direction to credit when increasing and debit when decreasing", () => {
      expect(GAMIFICATION_SRC).toContain('direction: diff > 0 ? "credit" : "debit"');
    });

    it("uses Math.abs for amountSKC in transaction", () => {
      expect(GAMIFICATION_SRC).toContain("amountSKC: Math.abs(diff)");
    });

    it("returns changed: true with oldBalance, newBalance, and diff", () => {
      expect(GAMIFICATION_SRC).toContain("changed: true, oldBalance, newBalance: newBalanceSKC, diff");
    });
  });

  describe("Router: adjustBank procedure", () => {
    it("has adjustBank procedure in farmAccounts router", () => {
      expect(ROUTER_SRC).toContain("adjustBank: adminProcedure");
    });

    it("imports adjustBankBalance from gamification", () => {
      expect(ROUTER_SRC).toContain("adjustBankBalance");
    });

    it("validates newBalanceSKC as non-negative integer up to 10M", () => {
      expect(ROUTER_SRC).toContain("newBalanceSKC: z.number().int().min(0).max(10000000)");
    });

    it("validates memo with max 500 chars", () => {
      expect(ROUTER_SRC).toContain('memo: z.string().max(500)');
    });
  });

  describe("UI: AdminTokens bank adjustment", () => {
    it("has Pencil icon for bank adjustment button", () => {
      expect(ADMIN_TOKENS_SRC).toContain("Pencil");
    });

    it("has bank adjustment dialog state", () => {
      expect(ADMIN_TOKENS_SRC).toContain("bankAdjustOpen");
      expect(ADMIN_TOKENS_SRC).toContain("bankNewBalance");
      expect(ADMIN_TOKENS_SRC).toContain("bankAdjustMemo");
    });

    it("uses adjustBank mutation", () => {
      expect(ADMIN_TOKENS_SRC).toContain("gamification.farmAccounts.adjustBank.useMutation");
    });

    it("shows current balance in dialog", () => {
      expect(ADMIN_TOKENS_SRC).toContain("Текущий баланс");
    });

    it("shows diff indicator when balance changes", () => {
      expect(ADMIN_TOKENS_SRC).toContain("bankNewBalance - overview.bank");
    });

    it("has reason input field", () => {
      expect(ADMIN_TOKENS_SRC).toContain("Причина корректировки");
    });

    it("disables submit when balance unchanged", () => {
      expect(ADMIN_TOKENS_SRC).toContain("bankNewBalance === (overview?.bank ?? 0)");
    });

    it("invalidates farm accounts and transactions on success", () => {
      expect(ADMIN_TOKENS_SRC).toContain("utils.gamification.farmAccounts.get.invalidate");
      expect(ADMIN_TOKENS_SRC).toContain("utils.gamification.farmAccounts.transactions.invalidate");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 0b. AUTO-WALLET CREATION & OWNER WALLETS LIST
// ═══════════════════════════════════════════════════════════

const LOCAL_AUTH_SRC = fs.readFileSync(path.resolve(__dirname, "localAuth.ts"), "utf-8");
const DB_SRC = fs.readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");

describe("Auto-Wallet Creation & Owner Wallets List", () => {
  describe("Server: ensureWallet function", () => {
    it("exports ensureWallet from gamification.ts", () => {
      expect(GAMIFICATION_SRC).toContain("export async function ensureWallet");
    });

    it("is idempotent — checks for existing wallet before creating", () => {
      expect(GAMIFICATION_SRC).toContain("if (existing) return");
    });

    it("creates wallet with status active and 0 balance", () => {
      expect(GAMIFICATION_SRC).toContain('status: "active"');
      expect(GAMIFICATION_SRC).toContain("balanceMinor: 0");
    });
  });

  describe("Server: backfillWallets function", () => {
    it("exports backfillWallets from gamification.ts", () => {
      expect(GAMIFICATION_SRC).toContain("export async function backfillWallets");
    });

    it("creates wallets for users who don't have one", () => {
      expect(GAMIFICATION_SRC).toContain("existingSet.has(user.openId)");
    });
  });

  describe("Auto-wallet on user registration", () => {
    it("calls ensureWallet in ensureUserRecord (OAuth flow)", () => {
      expect(DB_SRC).toContain("ensureWallet(saved.openId)");
    });

    it("calls ensureWallet in getUserByOpenId (login flow)", () => {
      expect(DB_SRC).toContain("ensureWallet(user.openId)");
    });

    it("calls ensureWallet in registerLocalUser (local auth)", () => {
      expect(LOCAL_AUTH_SRC).toContain("ensureWallet(openId)");
    });
  });

  describe("Server: listOwnerWallets (simplified)", () => {
    it("exports listOwnerWallets from gamification.ts", () => {
      expect(GAMIFICATION_SRC).toContain("export async function listOwnerWallets");
    });

    it("joins wallets with users table for names", () => {
      expect(GAMIFICATION_SRC).toContain("leftJoin(users, eq(wallets.ownerOpenId, users.openId))");
    });

    it("checks which users have active ownerships", () => {
      expect(GAMIFICATION_SRC).toContain("ownersWithActiveAnimals");
      expect(GAMIFICATION_SRC).toContain('eq(animalOwnerships.status, "active")');
      expect(GAMIFICATION_SRC).toContain("activeOwnerIds");
    });

    it("returns hasActiveOwnership field", () => {
      expect(GAMIFICATION_SRC).toContain("hasActiveOwnership: activeOwnerIds.has(w.ownerOpenId)");
    });

    it("returns openId, name, balance, walletId fields", () => {
      expect(GAMIFICATION_SRC).toContain("openId: w.ownerOpenId");
      expect(GAMIFICATION_SRC).toContain("name: w.name || w.ownerOpenId");
      expect(GAMIFICATION_SRC).toContain("balance: w.balance");
      expect(GAMIFICATION_SRC).toContain("walletId: w.walletId");
    });

    it("no longer has hasWallet field (all users have wallets)", () => {
      // The simplified version doesn't need hasWallet since backfill guarantees wallets
      expect(GAMIFICATION_SRC).not.toContain("hasWallet: false");
    });
  });

  describe("Router: ownerWallets with auto-backfill", () => {
    it("has ownerWallets procedure in farmAccounts router", () => {
      expect(ROUTER_SRC).toContain("ownerWallets: adminProcedure");
    });

    it("auto-backfills wallets before listing", () => {
      expect(ROUTER_SRC).toContain("await backfillWallets()");
    });

    it("imports backfillWallets from gamification", () => {
      expect(ROUTER_SRC).toContain("backfillWallets");
    });

    it("has a separate backfillWallets mutation endpoint", () => {
      expect(ROUTER_SRC).toContain("backfillWallets: adminProcedure");
    });
  });

  describe("UI: AdminTokens (simplified)", () => {
    it("queries ownerWallets from server", () => {
      expect(ADMIN_TOKENS_SRC).toContain("gamification.farmAccounts.ownerWallets.useQuery");
    });

    it("does NOT use hardcoded empty wallets array", () => {
      expect(ADMIN_TOKENS_SRC).not.toContain("const wallets: any[] = []");
    });

    it("no longer shows 'wallet not created' indicator", () => {
      expect(ADMIN_TOKENS_SRC).not.toContain("Кошелёк не создан");
    });

    it("shows 'Owner' badge for users with active ownerships", () => {
      expect(ADMIN_TOKENS_SRC).toContain("Владелец");
      expect(ADMIN_TOKENS_SRC).toContain("hasActiveOwnership");
    });

    it("shows auto-creation message in empty state", () => {
      expect(ADMIN_TOKENS_SRC).toContain("создаются автоматически при регистрации");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 1. DATABASE SCHEMA
// ═══════════════════════════════════════════════════════════

describe("Gamification Schema: tables exist", () => {
  it("has wallets table with balanceMinor and ownerOpenId", () => {
    expect(SCHEMA_SRC).toContain("export const wallets");
    expect(SCHEMA_SRC).toContain("balanceMinor");
    expect(SCHEMA_SRC).toContain("ownerOpenId");
  });

  it("has walletTransactions table with amountMinor", () => {
    expect(SCHEMA_SRC).toContain("export const walletTransactions");
    expect(SCHEMA_SRC).toContain("amountMinor");
  });

  it("has farmAccounts table with accountType", () => {
    expect(SCHEMA_SRC).toContain("export const farmAccounts");
    expect(SCHEMA_SRC).toContain("accountType");
  });

  it("has farmAccountTransactions table", () => {
    expect(SCHEMA_SRC).toContain("export const farmAccountTransactions");
  });

  it("has marketplaceCategories table with sortOrder and isVisible", () => {
    expect(SCHEMA_SRC).toContain("export const marketplaceCategories");
    expect(SCHEMA_SRC).toContain("sortOrder");
    expect(SCHEMA_SRC).toContain("isVisible");
  });

  it("has marketplaceItems table with priceSKC, stock, and metricEffectsJson", () => {
    expect(SCHEMA_SRC).toContain("export const marketplaceItems");
    expect(SCHEMA_SRC).toContain("priceSKC");
    expect(SCHEMA_SRC).toContain("stock");
    expect(SCHEMA_SRC).toContain("metricEffectsJson");
  });

  it("has marketplacePurchases table with pricePaidSKC", () => {
    expect(SCHEMA_SRC).toContain("export const marketplacePurchases");
    expect(SCHEMA_SRC).toContain("pricePaidSKC");
  });

  it("has animalWellnessMetrics table with 5 metrics and overallRating", () => {
    expect(SCHEMA_SRC).toContain("export const animalWellnessMetrics");
    expect(SCHEMA_SRC).toContain("happiness");
    expect(SCHEMA_SRC).toContain("health");
    expect(SCHEMA_SRC).toContain("attachment");
    expect(SCHEMA_SRC).toContain("mood");
    expect(SCHEMA_SRC).toContain("obedience");
    expect(SCHEMA_SRC).toContain("overallRating");
  });

  it("has ownerRatings table with totalScore and title", () => {
    expect(SCHEMA_SRC).toContain("export const ownerRatings");
    expect(SCHEMA_SRC).toContain("totalScore");
    expect(SCHEMA_SRC).toContain("title");
  });

  it("has farmerChecklists table with tasksJson", () => {
    expect(SCHEMA_SRC).toContain("export const farmerChecklists");
    expect(SCHEMA_SRC).toContain("tasksJson");
  });

  it("has animalFeedbackMessages table with message field", () => {
    expect(SCHEMA_SRC).toContain("export const animalFeedbackMessages");
    expect(SCHEMA_SRC).toContain("message");
    expect(SCHEMA_SRC).toContain("isRead");
  });

  it("has autoAllocationSettings table with amountSKC", () => {
    expect(SCHEMA_SRC).toContain("export const autoAllocationSettings");
    expect(SCHEMA_SRC).toContain("amountSKC");
    expect(SCHEMA_SRC).toContain("dayOfMonth");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. SERVER LOGIC (gamification.ts)
// ═══════════════════════════════════════════════════════════

describe("Gamification Server: farm accounts", () => {
  it("exports ensureFarmAccounts", () => {
    expect(GAMIFICATION_SRC).toContain("export async function ensureFarmAccounts");
  });

  it("exports grantTokensToOwner (Bank → Owner)", () => {
    expect(GAMIFICATION_SRC).toContain("export async function grantTokensToOwner");
  });

  it("exports bulkGrantTokens", () => {
    expect(GAMIFICATION_SRC).toContain("export async function bulkGrantTokens");
  });

  it("exports getFarmAccounts", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getFarmAccounts");
  });

  it("exports refundTokensToOwner", () => {
    expect(GAMIFICATION_SRC).toContain("export async function refundTokensToOwner");
  });
});

describe("Gamification Server: marketplace", () => {
  it("exports listMarketplaceCategories", () => {
    expect(GAMIFICATION_SRC).toContain("export async function listMarketplaceCategories");
  });

  it("exports createMarketplaceCategory", () => {
    expect(GAMIFICATION_SRC).toContain("export async function createMarketplaceCategory");
  });

  it("exports listMarketplaceItems", () => {
    expect(GAMIFICATION_SRC).toContain("export async function listMarketplaceItems");
  });

  it("exports createMarketplaceItem", () => {
    expect(GAMIFICATION_SRC).toContain("export async function createMarketplaceItem");
  });

  it("exports updateMarketplaceItem", () => {
    expect(GAMIFICATION_SRC).toContain("export async function updateMarketplaceItem");
  });
});

describe("Gamification Server: purchase flow", () => {
  it("exports purchaseMarketplaceItem", () => {
    expect(GAMIFICATION_SRC).toContain("export async function purchaseMarketplaceItem");
  });

  it("purchase function checks balance (Недостаточно SKC)", () => {
    expect(GAMIFICATION_SRC).toContain("Недостаточно SKC");
  });

  it("purchase function applies metric effects", () => {
    expect(GAMIFICATION_SRC).toContain("applyMetricEffects");
  });

  it("purchase function records transaction to revenue", () => {
    expect(GAMIFICATION_SRC).toContain("revenue");
  });
});

describe("Gamification Server: wellness metrics", () => {
  it("exports getAnimalWellness", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getAnimalWellness");
  });

  it("exports applyDailyDecay", () => {
    expect(GAMIFICATION_SRC).toContain("export async function applyDailyDecay");
  });

  it("exports ensureAnimalMetrics", () => {
    expect(GAMIFICATION_SRC).toContain("export async function ensureAnimalMetrics");
  });

  it("exports applyMetricEffects", () => {
    expect(GAMIFICATION_SRC).toContain("export async function applyMetricEffects");
  });
});

describe("Gamification Server: ratings", () => {
  it("exports getHerdLeaderboard", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getHerdLeaderboard");
  });

  it("exports getOwnerLeaderboard", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getOwnerLeaderboard");
  });

  it("exports updateOwnerRating", () => {
    expect(GAMIFICATION_SRC).toContain("export async function updateOwnerRating");
  });

  it("has title calculation logic with titles", () => {
    expect(GAMIFICATION_SRC).toContain("Легенда фермы");
    expect(GAMIFICATION_SRC).toContain("Заботливый хранитель");
    expect(GAMIFICATION_SRC).toContain("Новичок");
  });
});

describe("Gamification Server: checklists", () => {
  it("exports listFarmerChecklists", () => {
    expect(GAMIFICATION_SRC).toContain("export async function listFarmerChecklists");
  });

  it("exports completeFarmerChecklist", () => {
    expect(GAMIFICATION_SRC).toContain("export async function completeFarmerChecklist");
  });
});

describe("Gamification Server: analytics", () => {
  it("exports getTokenAnalytics", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getTokenAnalytics");
  });

  it("exports getMarketplaceAnalytics", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getMarketplaceAnalytics");
  });

  it("exports getHerdWellnessOverview", () => {
    expect(GAMIFICATION_SRC).toContain("export async function getHerdWellnessOverview");
  });
});

// ═══════════════════════════════════════════════════════════
// 3. tRPC ROUTER
// ═══════════════════════════════════════════════════════════

describe("Gamification Router: structure", () => {
  it("has farmAccounts sub-router", () => {
    expect(ROUTER_SRC).toContain("farmAccounts:");
  });

  it("has categories and items sub-routers", () => {
    expect(ROUTER_SRC).toContain("categories:");
    expect(ROUTER_SRC).toContain("items:");
  });

  it("has purchase mutation", () => {
    expect(ROUTER_SRC).toContain("purchase:");
  });

  it("has wallet sub-router with balance and transactions", () => {
    expect(ROUTER_SRC).toContain("wallet:");
    expect(ROUTER_SRC).toContain("balance:");
    expect(ROUTER_SRC).toContain("transactions:");
    expect(ROUTER_SRC).toContain("purchaseHistory:");
  });

  it("has wellness sub-router", () => {
    expect(ROUTER_SRC).toContain("wellness:");
  });

  it("has leaderboard sub-router with herd, owners, myRating", () => {
    expect(ROUTER_SRC).toContain("leaderboard:");
    expect(ROUTER_SRC).toContain("herd:");
    expect(ROUTER_SRC).toContain("owners:");
    expect(ROUTER_SRC).toContain("myRating:");
  });

  it("has checklists sub-router", () => {
    expect(ROUTER_SRC).toContain("checklists:");
  });

  it("has analytics sub-router", () => {
    expect(ROUTER_SRC).toContain("analytics:");
  });

  it("uses adminProcedure for admin-only operations", () => {
    expect(ROUTER_SRC).toContain("adminProcedure");
  });

  it("uses protectedProcedure for owner operations", () => {
    expect(ROUTER_SRC).toContain("protectedProcedure");
  });
});

// ═══════════════════════════════════════════════════════════
// 4. ADMIN UI PAGES
// ═══════════════════════════════════════════════════════════

describe("Admin Marketplace Page", () => {
  it("queries gamification.categories.list", () => {
    expect(ADMIN_MARKETPLACE_SRC).toContain("gamification.categories.list");
  });

  it("queries gamification.items.list", () => {
    expect(ADMIN_MARKETPLACE_SRC).toContain("gamification.items.list");
  });

  it("has create category mutation", () => {
    expect(ADMIN_MARKETPLACE_SRC).toContain("categories.create");
  });

  it("has create item mutation", () => {
    expect(ADMIN_MARKETPLACE_SRC).toContain("items.create");
  });

  it("shows wellness effect fields (Счастье, Здоровье)", () => {
    expect(ADMIN_MARKETPLACE_SRC).toContain("Счастье");
    expect(ADMIN_MARKETPLACE_SRC).toContain("Здоровье");
  });
});

describe("Admin Tokens Page", () => {
  it("renders Bank and Revenue overview", () => {
    expect(ADMIN_TOKENS_SRC).toContain("Банк");
    expect(ADMIN_TOKENS_SRC).toContain("Выручка");
  });

  it("has grantTokens mutation", () => {
    expect(ADMIN_TOKENS_SRC).toContain("grantTokens");
  });

  it("has bulkGrant mutation", () => {
    expect(ADMIN_TOKENS_SRC).toContain("bulkGrant");
  });

  it("shows transaction journal (Журнал)", () => {
    expect(ADMIN_TOKENS_SRC).toContain("Журнал");
  });

  it("has auto-allocation settings", () => {
    expect(ADMIN_TOKENS_SRC).toContain("autoAllocation");
  });
});

describe("Admin Analytics Page", () => {
  it("queries analytics.tokens", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("analytics.tokens");
  });

  it("queries analytics.marketplace", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("analytics.marketplace");
  });

  it("queries analytics.herdWellness", () => {
    expect(ADMIN_ANALYTICS_SRC).toContain("analytics.herdWellness");
  });
});

// ═══════════════════════════════════════════════════════════
// 5. OWNER UI PAGES
// ═══════════════════════════════════════════════════════════

describe("Owner Marketplace Page", () => {
  it("queries gamification.categories.list", () => {
    expect(MARKETPLACE_SRC).toContain("gamification.categories.list");
  });

  it("queries gamification.items.list", () => {
    expect(MARKETPLACE_SRC).toContain("gamification.items.list");
  });

  it("has purchase mutation", () => {
    expect(MARKETPLACE_SRC).toContain("gamification.purchase");
  });

  it("shows SKC balance via wallet.balance", () => {
    expect(MARKETPLACE_SRC).toContain("wallet.balance");
  });

  it("has animal selector for purchase target (animalId)", () => {
    expect(MARKETPLACE_SRC).toContain("animalId");
  });

  it("shows wellness effect preview (Счастье)", () => {
    expect(MARKETPLACE_SRC).toContain("Счастье");
  });
});

describe("Leaderboard Page", () => {
  it("has herd rating tab", () => {
    expect(LEADERBOARD_SRC).toContain("Рейтинг стада");
    expect(LEADERBOARD_SRC).toContain("leaderboard.herd");
  });

  it("has owners rating tab", () => {
    expect(LEADERBOARD_SRC).toContain("Рейтинг владельцев");
    expect(LEADERBOARD_SRC).toContain("leaderboard.owners");
  });

  it("shows my rating card", () => {
    expect(LEADERBOARD_SRC).toContain("leaderboard.myRating");
    expect(LEADERBOARD_SRC).toContain("Ваш рейтинг");
  });

  it("displays all 5 titles", () => {
    expect(LEADERBOARD_SRC).toContain("Легенда фермы");
    expect(LEADERBOARD_SRC).toContain("Мастер заботы");
    expect(LEADERBOARD_SRC).toContain("Эксперт фермы");
    expect(LEADERBOARD_SRC).toContain("Заботливый хозяин");
    expect(LEADERBOARD_SRC).toContain("Новичок");
  });

  it("shows rank icons for top 3 (Crown, Medal)", () => {
    expect(LEADERBOARD_SRC).toContain("Crown");
    expect(LEADERBOARD_SRC).toContain("Medal");
  });

  it("uses WellnessRadarChart for herd entries", () => {
    expect(LEADERBOARD_SRC).toContain("WellnessRadarChart");
  });
});

describe("Dashboard: SKC Balance Widget", () => {
  it("queries gamification.wallet.balance", () => {
    expect(DASHBOARD_SRC).toContain("gamification.wallet.balance");
  });

  it("shows balance in SKC (Баланс SKC)", () => {
    expect(DASHBOARD_SRC).toContain("Баланс SKC");
    expect(DASHBOARD_SRC).toContain("balanceSKC");
  });

  it("has link to marketplace", () => {
    expect(DASHBOARD_SRC).toContain("/marketplace");
    expect(DASHBOARD_SRC).toContain("Маркетплейс");
  });

  it("has link to leaderboard", () => {
    expect(DASHBOARD_SRC).toContain("/leaderboard");
    expect(DASHBOARD_SRC).toContain("Рейтинг");
  });

  it("has data-testid for balance widget", () => {
    expect(DASHBOARD_SRC).toContain("dashboardBalanceWidget");
  });
});

describe("AnimalProfile: Wellness Metrics Section", () => {
  it("queries gamification.wellness.get", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("gamification.wellness.get");
  });

  it("renders WellnessRadarChart", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("WellnessRadarChart");
  });

  it("shows section title Благополучие", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("Благополучие");
  });

  it("has link to marketplace for care (Позаботиться)", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("Позаботиться");
    expect(ANIMAL_PROFILE_SRC).toContain("/marketplace");
  });

  it("only shows for owners (hasOwnerAccess)", () => {
    expect(ANIMAL_PROFILE_SRC).toContain("hasOwnerAccess");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. WELLNESS RADAR CHART COMPONENT
// ═══════════════════════════════════════════════════════════

describe("WellnessRadarChart Component", () => {
  it("renders all 5 metrics in Russian", () => {
    expect(RADAR_CHART_SRC).toContain("Счастье");
    expect(RADAR_CHART_SRC).toContain("Здоровье");
    expect(RADAR_CHART_SRC).toContain("Привязанность");
    expect(RADAR_CHART_SRC).toContain("Настроение");
    expect(RADAR_CHART_SRC).toContain("Послушание");
  });

  it("uses SVG for rendering", () => {
    expect(RADAR_CHART_SRC).toContain("<svg");
  });

  it("shows overall score in center (ОБЩИЙ)", () => {
    expect(RADAR_CHART_SRC).toContain("ОБЩИЙ");
  });

  it("accepts metrics and size props", () => {
    expect(RADAR_CHART_SRC).toContain("metrics:");
    expect(RADAR_CHART_SRC).toContain("size");
  });

  it("has color coding for values (green/amber/red)", () => {
    expect(RADAR_CHART_SRC).toContain("#16a34a");
    expect(RADAR_CHART_SRC).toContain("#d97706");
    expect(RADAR_CHART_SRC).toContain("#dc2626");
  });
});

// ═══════════════════════════════════════════════════════════
// 7. ROUTING
// ═══════════════════════════════════════════════════════════

describe("App Routing: gamification pages", () => {
  it("has /marketplace route", () => {
    expect(APP_SRC).toContain("/marketplace");
    expect(APP_SRC).toContain("Marketplace");
  });

  it("has /leaderboard route", () => {
    expect(APP_SRC).toContain("/leaderboard");
    expect(APP_SRC).toContain("Leaderboard");
  });

  it("has /admin/marketplace route", () => {
    expect(APP_SRC).toContain("/admin/marketplace");
    expect(APP_SRC).toContain("AdminMarketplace");
  });

  it("has /admin/tokens route", () => {
    expect(APP_SRC).toContain("/admin/tokens");
    expect(APP_SRC).toContain("AdminTokens");
  });

  it("has /admin/analytics route", () => {
    expect(APP_SRC).toContain("/admin/analytics");
    expect(APP_SRC).toContain("AdminAnalytics");
  });
});
