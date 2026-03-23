/**
 * Gamification — "Забота" Ecosystem
 * Token economy, marketplace, wellness metrics, checklists, feedback, ratings.
 */
import { eq, and, desc, asc, sql, gte, lte, inArray, isNull } from "drizzle-orm";
import {
  farmAccounts,
  farmAccountTransactions,
  marketplaceCategories,
  marketplaceItems,
  marketplacePurchases,
  animalWellnessMetrics,
  ownerRatings,
  farmerChecklists,
  animalFeedbackMessages,
  autoAllocationSettings,
  ratingSnapshots,
  wallets,
  walletTransactions,
  animals,
  animalOwnerships,
  users,
  type InsertMarketplaceCategory,
  type InsertMarketplaceItem,
  type MarketplaceCategory,
  type MarketplaceItem,
  type MarketplacePurchase,
  type FarmAccount,
  type FarmAccountTransaction,
  type AnimalWellnessMetric,
  type OwnerRating,
  type FarmerChecklist,
  type AnimalFeedbackMessage,
  type AutoAllocationSetting,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Constants ───────────────────────────────────────────

const METRIC_MIN = 10;
const METRIC_MAX = 100;
const INITIAL_METRIC = 50;
const INITIAL_OWNER_BALANCE = 50; // 50 SKC for new owners

/** Decay rates per day for each metric */
const DECAY_RATES: Record<string, number> = {
  happiness: 1,
  health: 0.5,
  attachment: 0.8,
  mood: 1.2,
  obedience: 0.3,
};

/** Weights for overall rating calculation */
const METRIC_WEIGHTS: Record<string, number> = {
  happiness: 0.25,
  health: 0.25,
  attachment: 0.20,
  mood: 0.15,
  obedience: 0.15,
};

/** Owner titles based on total score */
const OWNER_TITLES: Array<{ minScore: number; title: string }> = [
  { minScore: 90, title: "Легенда фермы" },
  { minScore: 75, title: "Заботливый хранитель" },
  { minScore: 60, title: "Опытный владелец" },
  { minScore: 40, title: "Начинающий фермер" },
  { minScore: 0, title: "Новичок" },
];

function clampMetric(value: number): number {
  return Math.max(METRIC_MIN, Math.min(METRIC_MAX, Math.round(value)));
}

function getOwnerTitle(score: number): string {
  for (const t of OWNER_TITLES) {
    if (score >= t.minScore) return t.title;
  }
  return "Новичок";
}

// ─── Wallet Auto-Creation ────────────────────────────────

/**
 * Ensure a wallet exists for the given user.
 * Called automatically on user registration / login.
 * Idempotent — safe to call multiple times.
 */
export async function ensureWallet(ownerOpenId: string): Promise<void> {
  const db = await getDb();
  if (!db || !ownerOpenId) return;

  const [existing] = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.ownerOpenId, ownerOpenId)).limit(1);
  if (existing) return; // wallet already exists

  await db.insert(wallets).values({
    ownerOpenId,
    familyId: 0,
    status: "active",
    balanceMinor: 0,
    currencyCode: "SKC",
  });
}

/**
 * Backfill: create wallets for all registered users who don't have one yet.
 * Safe to run multiple times.
 */
export async function backfillWallets(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const allUsers = await db.select({ openId: users.openId }).from(users);
  const existingWallets = await db.select({ ownerOpenId: wallets.ownerOpenId }).from(wallets);
  const existingSet = new Set(existingWallets.map((w: { ownerOpenId: string }) => w.ownerOpenId));

  let created = 0;
  for (const user of allUsers) {
    if (!existingSet.has(user.openId)) {
      await db.insert(wallets).values({
        ownerOpenId: user.openId,
        familyId: 0,
        status: "active",
        balanceMinor: 0,
        currencyCode: "SKC",
      });
      created++;
    }
  }
  return created;
}

// ─── Farm Accounts ───────────────────────────────────────

/** Ensure Bank and Revenue accounts exist. Called on first admin access. */
export async function ensureFarmAccounts(): Promise<{ bank: FarmAccount; revenue: FarmAccount }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db.select().from(farmAccounts);
  let bank = existing.find((a: FarmAccount) => a.accountType === "bank");
  let revenue = existing.find((a: FarmAccount) => a.accountType === "revenue");

  if (!bank) {
    await db.insert(farmAccounts).values({ accountType: "bank", balanceSKC: 10000, totalLifetimeSKC: 10000 });
    const [inserted] = await db.select().from(farmAccounts).where(eq(farmAccounts.accountType, "bank"));
    bank = inserted;
  }
  if (!revenue) {
    await db.insert(farmAccounts).values({ accountType: "revenue", balanceSKC: 0, totalLifetimeSKC: 0 });
    const [inserted] = await db.select().from(farmAccounts).where(eq(farmAccounts.accountType, "revenue"));
    revenue = inserted;
  }

  return { bank: bank!, revenue: revenue! };
}

export async function getFarmAccounts() {
  const db = await getDb();
  if (!db) return null;
  return ensureFarmAccounts();
}

/** Admin adjusts the Bank balance directly (top-up or correction) */
export async function adjustBankBalance(
  newBalanceSKC: number,
  memo: string,
  initiatedByOpenId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const { bank } = await ensureFarmAccounts();
  const oldBalance = bank.balanceSKC;
  const diff = newBalanceSKC - oldBalance;

  if (diff === 0) return { bank, changed: false };

  // Update bank balance
  await db.update(farmAccounts)
    .set({
      balanceSKC: newBalanceSKC,
      totalLifetimeSKC: diff > 0 ? bank.totalLifetimeSKC + diff : bank.totalLifetimeSKC,
    })
    .where(eq(farmAccounts.id, bank.id));

  // Record adjustment transaction
  await db.insert(farmAccountTransactions).values({
    farmAccountId: bank.id,
    walletId: null,
    ownerOpenId: null,
    txType: "adjustment",
    direction: diff > 0 ? "credit" : "debit",
    amountSKC: Math.abs(diff),
    farmBalanceAfterSKC: newBalanceSKC,
    walletBalanceAfterSKC: null,
    memo: memo || `Корректировка баланса Банка: ${oldBalance} → ${newBalanceSKC}`,
    initiatedByOpenId,
  });

  const [updated] = await db.select().from(farmAccounts).where(eq(farmAccounts.id, bank.id));
  return { bank: updated, changed: true, oldBalance, newBalance: newBalanceSKC, diff };
}

/** Grant tokens from Bank to an owner's wallet */
export async function grantTokensToOwner(
  ownerOpenId: string,
  amountSKC: number,
  memo: string,
  initiatedByOpenId: string,
  txType: "emission" | "bulk_emission" | "auto_emission" | "bonus" = "emission"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const { bank } = await ensureFarmAccounts();

  // Find or create owner wallet
  let [wallet] = await db.select().from(wallets).where(eq(wallets.ownerOpenId, ownerOpenId)).limit(1);
  if (wallet && wallet.status === "frozen") {
    throw new Error("Счёт пользователя заблокирован. Разблокируйте счёт перед начислением.");
  }
  if (!wallet) {
    // Auto-create wallet for this owner
    const [family] = await db.select().from(animalOwnerships).where(eq(animalOwnerships.ownerOpenId, ownerOpenId)).limit(1);
    const familyId = family?.familyId ?? 0;
    await db.insert(wallets).values({
      ownerOpenId,
      familyId,
      status: "active",
      balanceMinor: 0,
      currencyCode: "SKC",
    });
    [wallet] = await db.select().from(wallets).where(eq(wallets.ownerOpenId, ownerOpenId)).limit(1);
  }

  const newBankBalance = bank.balanceSKC - amountSKC;
  const newWalletBalance = wallet.balanceMinor + amountSKC;

  // Update bank
  await db.update(farmAccounts)
    .set({ balanceSKC: newBankBalance })
    .where(eq(farmAccounts.id, bank.id));

  // Update wallet
  await db.update(wallets)
    .set({ balanceMinor: newWalletBalance })
    .where(eq(wallets.id, wallet.id));

  // Record farm transaction
  await db.insert(farmAccountTransactions).values({
    farmAccountId: bank.id,
    walletId: wallet.id,
    ownerOpenId,
    txType,
    direction: "debit",
    amountSKC,
    farmBalanceAfterSKC: newBankBalance,
    walletBalanceAfterSKC: newWalletBalance,
    memo,
    initiatedByOpenId,
  });

  // Record wallet transaction
  await db.insert(walletTransactions).values({
    ownerOpenId,
    walletId: wallet.id,
    familyId: wallet.familyId,
    transactionType: "admin_grant",
    direction: "credit",
    amountMinor: amountSKC,
    balanceAfterMinor: newWalletBalance,
    memo,
    referenceType: "farm_grant",
    emittedByOpenId: initiatedByOpenId,
  });

  return { newBankBalance, newWalletBalance, walletId: wallet.id };
}

/** Bulk grant tokens to multiple owners */
export async function bulkGrantTokens(
  ownerOpenIds: string[],
  amountSKC: number,
  memo: string,
  initiatedByOpenId: string
) {
  const results: Array<{ ownerOpenId: string; success: boolean; newBalance?: number; error?: string }> = [];
  for (const openId of ownerOpenIds) {
    try {
      const result = await grantTokensToOwner(openId, amountSKC, memo, initiatedByOpenId, "bulk_emission");
      results.push({ ownerOpenId: openId, success: true, newBalance: result.newWalletBalance });
    } catch (e: any) {
      results.push({ ownerOpenId: openId, success: false, error: e.message });
    }
  }
  return results;
}

/** Refund tokens from Revenue back to owner */
export async function refundTokensToOwner(
  ownerOpenId: string,
  amountSKC: number,
  memo: string,
  initiatedByOpenId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const { revenue } = await ensureFarmAccounts();
  if (revenue.balanceSKC < amountSKC) {
    throw new Error("Недостаточно средств в Выручке для возврата");
  }

  const [wallet] = await db.select().from(wallets).where(eq(wallets.ownerOpenId, ownerOpenId)).limit(1);
  if (!wallet) throw new Error("Кошелёк владельца не найден");

  const newRevenueBalance = revenue.balanceSKC - amountSKC;
  const newWalletBalance = wallet.balanceMinor + amountSKC;

  await db.update(farmAccounts)
    .set({ balanceSKC: newRevenueBalance })
    .where(eq(farmAccounts.id, revenue.id));

  await db.update(wallets)
    .set({ balanceMinor: newWalletBalance })
    .where(eq(wallets.id, wallet.id));

  await db.insert(farmAccountTransactions).values({
    farmAccountId: revenue.id,
    walletId: wallet.id,
    ownerOpenId,
    txType: "refund",
    direction: "debit",
    amountSKC,
    farmBalanceAfterSKC: newRevenueBalance,
    walletBalanceAfterSKC: newWalletBalance,
    memo,
    initiatedByOpenId,
  });

  await db.insert(walletTransactions).values({
    ownerOpenId,
    walletId: wallet.id,
    familyId: wallet.familyId,
    transactionType: "refund",
    direction: "credit",
    amountMinor: amountSKC,
    balanceAfterMinor: newWalletBalance,
    memo,
    referenceType: "refund",
    emittedByOpenId: initiatedByOpenId,
  });

  return { newRevenueBalance, newWalletBalance };
}

/** Get transaction history for farm accounts (enriched with user names, paginated) */
export async function getFarmTransactions(limit = 50, offset = 0, txTypeFilter?: string) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (txTypeFilter && txTypeFilter !== "all") {
    conditions.push(eq(farmAccountTransactions.txType, txTypeFilter as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db.select({
      id: farmAccountTransactions.id,
      farmAccountId: farmAccountTransactions.farmAccountId,
      walletId: farmAccountTransactions.walletId,
      ownerOpenId: farmAccountTransactions.ownerOpenId,
      txType: farmAccountTransactions.txType,
      direction: farmAccountTransactions.direction,
      amountSKC: farmAccountTransactions.amountSKC,
      farmBalanceAfterSKC: farmAccountTransactions.farmBalanceAfterSKC,
      walletBalanceAfterSKC: farmAccountTransactions.walletBalanceAfterSKC,
      purchaseId: farmAccountTransactions.purchaseId,
      memo: farmAccountTransactions.memo,
      initiatedByOpenId: farmAccountTransactions.initiatedByOpenId,
      createdAt: farmAccountTransactions.createdAt,
      userName: users.name,
    })
      .from(farmAccountTransactions)
      .leftJoin(users, eq(farmAccountTransactions.ownerOpenId, users.openId))
      .where(whereClause)
      .orderBy(desc(farmAccountTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(farmAccountTransactions)
      .where(whereClause),
  ]);

  return {
    items: rows,
    total: Number(countResult[0]?.count ?? 0),
  };
}

/** Get owner's wallet balance */
export async function getOwnerBalance(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return null;
  const [wallet] = await db.select().from(wallets).where(eq(wallets.ownerOpenId, ownerOpenId)).limit(1);
  return wallet ? { balanceSKC: wallet.balanceMinor, walletId: wallet.id } : null;
}

/**
 * List all owner wallets with user info (for admin token allocation UI).
 * Since wallets are auto-created for every user, this simply joins wallets + users.
 */
export async function listOwnerWallets() {
  const db = await getDb();
  if (!db) return [];

  // All users should have wallets (auto-created on registration, backfilled on admin access)
  const walletRows = await db.select({
    walletId: wallets.id,
    ownerOpenId: wallets.ownerOpenId,
    balance: wallets.balanceMinor,
    status: wallets.status,
    name: users.name,
  })
    .from(wallets)
    .leftJoin(users, eq(wallets.ownerOpenId, users.openId))
    .orderBy(desc(wallets.balanceMinor));

  // Check which users have active ownerships
  const ownersWithActiveAnimals = await db.selectDistinct({
    ownerOpenId: animalOwnerships.ownerOpenId,
  })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.status, "active"));
  const activeOwnerIds = new Set(ownersWithActiveAnimals.map((o: { ownerOpenId: string }) => o.ownerOpenId));

  return walletRows.map((w: typeof walletRows[number]) => ({
    openId: w.ownerOpenId,
    name: w.name || w.ownerOpenId,
    balance: w.balance,
    walletId: w.walletId,
    hasActiveOwnership: activeOwnerIds.has(w.ownerOpenId),
  }));
}

/** Get owner's transaction history */
export async function getOwnerTransactions(ownerOpenId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletTransactions)
    .where(eq(walletTransactions.ownerOpenId, ownerOpenId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
}

// ─── Marketplace Categories ──────────────────────────────

export async function listMarketplaceCategories(includeHidden = false) {
  const db = await getDb();
  if (!db) return [];
  if (includeHidden) {
    return db.select().from(marketplaceCategories).orderBy(asc(marketplaceCategories.sortOrder));
  }
  return db.select().from(marketplaceCategories)
    .where(eq(marketplaceCategories.isVisible, 1))
    .orderBy(asc(marketplaceCategories.sortOrder));
}

export async function createMarketplaceCategory(data: Omit<InsertMarketplaceCategory, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(marketplaceCategories).values(data);
  const [created] = await db.select().from(marketplaceCategories).where(eq(marketplaceCategories.slug, data.slug));
  return created;
}

export async function updateMarketplaceCategory(id: number, data: Partial<InsertMarketplaceCategory>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(marketplaceCategories).set(data).where(eq(marketplaceCategories.id, id));
  const [updated] = await db.select().from(marketplaceCategories).where(eq(marketplaceCategories.id, id));
  return updated;
}

export async function deleteMarketplaceCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if category has items
  const items = await db.select({ id: marketplaceItems.id }).from(marketplaceItems).where(eq(marketplaceItems.categoryId, id));
  if (items.length > 0) {
    throw new Error("Нельзя удалить категорию с товарами. Сначала переместите или удалите товары.");
  }
  await db.delete(marketplaceCategories).where(eq(marketplaceCategories.id, id));
  return { deleted: true };
}

// ─── Marketplace Items ───────────────────────────────────

export async function listMarketplaceItems(categoryId?: number, includeHidden = false) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (!includeHidden) conditions.push(eq(marketplaceItems.isVisible, 1));
  if (categoryId) conditions.push(eq(marketplaceItems.categoryId, categoryId));

  if (conditions.length === 0) {
    return db.select().from(marketplaceItems).orderBy(asc(marketplaceItems.sortOrder));
  }
  if (conditions.length === 1) {
    return db.select().from(marketplaceItems).where(conditions[0]).orderBy(asc(marketplaceItems.sortOrder));
  }
  return db.select().from(marketplaceItems).where(and(...conditions)).orderBy(asc(marketplaceItems.sortOrder));
}

export async function getMarketplaceItem(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [item] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
  return item ?? null;
}

export async function createMarketplaceItem(data: Omit<InsertMarketplaceItem, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(marketplaceItems).values(data);
  const [created] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.slug, data.slug));
  return created;
}

export async function updateMarketplaceItem(id: number, data: Partial<InsertMarketplaceItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(marketplaceItems).set(data).where(eq(marketplaceItems.id, id));
  const [updated] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
  return updated;
}

export async function deleteMarketplaceItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(marketplaceItems).where(eq(marketplaceItems.id, id));
  return { deleted: true };
}

// ─── Purchase Flow ───────────────────────────────────────

/** Check purchase limits for an owner on a specific item */
async function checkPurchaseLimits(ownerOpenId: string, itemId: number, item: MarketplaceItem): Promise<string | null> {
  const db = await getDb();
  if (!db) return "DB not available";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (item.dailyLimitPerOwner > 0) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplacePurchases)
      .where(and(
        eq(marketplacePurchases.ownerOpenId, ownerOpenId),
        eq(marketplacePurchases.itemId, itemId),
        gte(marketplacePurchases.createdAt, todayStart)
      ));
    if (result.count >= item.dailyLimitPerOwner) {
      return `Дневной лимит (${item.dailyLimitPerOwner}) исчерпан`;
    }
  }

  if (item.weeklyLimitPerOwner > 0) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplacePurchases)
      .where(and(
        eq(marketplacePurchases.ownerOpenId, ownerOpenId),
        eq(marketplacePurchases.itemId, itemId),
        gte(marketplacePurchases.createdAt, weekStart)
      ));
    if (result.count >= item.weeklyLimitPerOwner) {
      return `Недельный лимит (${item.weeklyLimitPerOwner}) исчерпан`;
    }
  }

  if (item.monthlyLimitPerOwner > 0) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplacePurchases)
      .where(and(
        eq(marketplacePurchases.ownerOpenId, ownerOpenId),
        eq(marketplacePurchases.itemId, itemId),
        gte(marketplacePurchases.createdAt, monthStart)
      ));
    if (result.count >= item.monthlyLimitPerOwner) {
      return `Месячный лимит (${item.monthlyLimitPerOwner}) исчерпан`;
    }
  }

  return null;
}

/** Check seasonal availability */
function checkSeason(item: MarketplaceItem): boolean {
  if (item.season === "all") return true;
  const month = new Date().getMonth(); // 0-11
  switch (item.season) {
    case "spring": return month >= 2 && month <= 4;
    case "summer": return month >= 5 && month <= 7;
    case "autumn": return month >= 8 && month <= 10;
    case "winter": return month === 11 || month <= 1;
    default: return true;
  }
}

/** Main purchase flow: deduct SKC, apply metrics, create checklist */
export async function purchaseMarketplaceItem(
  ownerOpenId: string,
  animalId: number,
  itemId: number
): Promise<{ purchase: MarketplacePurchase; checklist?: FarmerChecklist; metricsAfter: AnimalWellnessMetric }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 1. Get the item
  const item = await getMarketplaceItem(itemId);
  if (!item) throw new Error("Товар не найден");
  if (!item.isVisible) throw new Error("Товар недоступен");

  // 2. Check season
  if (!checkSeason(item)) throw new Error("Товар доступен только в определённый сезон");

  // 3. Check stock
  if (item.stock !== -1 && item.stock <= 0) throw new Error("Товар закончился");

  // 4. Check species compatibility
  if (item.applicableSpecies) {
    const [animal] = await db.select({ species: animals.species }).from(animals).where(eq(animals.id, animalId));
    if (animal && animal.species !== item.applicableSpecies) {
      throw new Error("Этот товар не подходит для данного вида животного");
    }
  }

  // 5. Check ownership
  const [ownership] = await db.select().from(animalOwnerships)
    .where(and(
      eq(animalOwnerships.ownerOpenId, ownerOpenId),
      eq(animalOwnerships.animalId, animalId),
      eq(animalOwnerships.status, "active")
    )).limit(1);
  if (!ownership) throw new Error("У вас нет активного участия в этом животном");

  // 6. Check purchase limits
  const limitError = await checkPurchaseLimits(ownerOpenId, itemId, item);
  if (limitError) throw new Error(limitError);

  // 7. Check balance & wallet status
  const [wallet] = await db.select().from(wallets).where(eq(wallets.ownerOpenId, ownerOpenId)).limit(1);
  if (!wallet) throw new Error("Кошелёк не найден");
  if (wallet.status === "frozen") throw new Error("Ваш счёт заблокирован. Обратитесь к администратору.");
  if (wallet.balanceMinor < item.priceSKC) throw new Error("Недостаточно SKC на балансе");

  // 8. Deduct from wallet
  const newWalletBalance = wallet.balanceMinor - item.priceSKC;
  await db.update(wallets).set({ balanceMinor: newWalletBalance }).where(eq(wallets.id, wallet.id));

  // 9. Credit to Revenue
  const { revenue } = await ensureFarmAccounts();
  const newRevenueBalance = revenue.balanceSKC + item.priceSKC;
  await db.update(farmAccounts)
    .set({
      balanceSKC: newRevenueBalance,
      totalLifetimeSKC: revenue.totalLifetimeSKC + item.priceSKC,
    })
    .where(eq(farmAccounts.id, revenue.id));

  // 10. Decrease stock if limited
  if (item.stock !== -1) {
    await db.update(marketplaceItems)
      .set({ stock: item.stock - 1 })
      .where(eq(marketplaceItems.id, item.id));
  }

  // 11. Parse metric effects
  const effects = JSON.parse(item.metricEffectsJson || "{}") as Record<string, number>;

  // 12. Apply metrics
  const metricsAfter = await applyMetricEffects(animalId, effects);

  // 13. Create purchase record
  await db.insert(marketplacePurchases).values({
    ownerOpenId,
    animalId,
    itemId,
    walletId: wallet.id,
    pricePaidSKC: item.priceSKC,
    metricEffectsAppliedJson: JSON.stringify(effects),
    checklistCompleted: item.requiresChecklist ? 0 : 1,
    feedbackSent: 0,
  });

  const [purchase] = await db.select().from(marketplacePurchases)
    .where(and(
      eq(marketplacePurchases.ownerOpenId, ownerOpenId),
      eq(marketplacePurchases.itemId, itemId),
    ))
    .orderBy(desc(marketplacePurchases.createdAt))
    .limit(1);

  // 14. Record farm transaction
  await db.insert(farmAccountTransactions).values({
    farmAccountId: revenue.id,
    walletId: wallet.id,
    ownerOpenId,
    txType: "purchase",
    direction: "credit",
    amountSKC: item.priceSKC,
    farmBalanceAfterSKC: newRevenueBalance,
    walletBalanceAfterSKC: newWalletBalance,
    purchaseId: purchase.id,
    memo: `Покупка: ${item.name}`,
    initiatedByOpenId: ownerOpenId,
  });

  // 15. Record wallet transaction
  await db.insert(walletTransactions).values({
    ownerOpenId,
    walletId: wallet.id,
    familyId: wallet.familyId,
    transactionType: "spend",
    direction: "debit",
    amountMinor: item.priceSKC,
    balanceAfterMinor: newWalletBalance,
    memo: `Покупка: ${item.name}`,
    referenceType: "marketplace_purchase",
    referenceId: String(purchase.id),
    emittedByOpenId: ownerOpenId,
  });

  // 16. Create farmer checklist if required
  let checklist: FarmerChecklist | undefined;
  if (item.requiresChecklist) {
    const tasks = item.checklistTemplateJson
      ? JSON.parse(item.checklistTemplateJson)
      : [{ task: item.name, description: `Выполнить: ${item.name}`, completed: false }];

    await db.insert(farmerChecklists).values({
      purchaseId: purchase.id,
      animalId,
      ownerOpenId,
      itemName: item.name,
      status: "pending",
      tasksJson: JSON.stringify(tasks),
    });

    const [created] = await db.select().from(farmerChecklists)
      .where(eq(farmerChecklists.purchaseId, purchase.id));
    checklist = created;
  }

  // 17. Update owner rating
  await updateOwnerRating(ownerOpenId);

  return { purchase, checklist, metricsAfter };
}

// ─── Wellness Metrics ────────────────────────────────────

/** Ensure wellness metrics exist for an animal */
export async function ensureAnimalMetrics(animalId: number): Promise<AnimalWellnessMetric> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [existing] = await db.select().from(animalWellnessMetrics).where(eq(animalWellnessMetrics.animalId, animalId));
  if (existing) return existing;

  await db.insert(animalWellnessMetrics).values({
    animalId,
    happiness: INITIAL_METRIC,
    health: INITIAL_METRIC,
    attachment: INITIAL_METRIC,
    mood: INITIAL_METRIC,
    obedience: INITIAL_METRIC,
    overallRating: INITIAL_METRIC,
    herdRank: 0,
  });

  const [created] = await db.select().from(animalWellnessMetrics).where(eq(animalWellnessMetrics.animalId, animalId));
  return created;
}

/** Apply metric effects from a purchase */
export async function applyMetricEffects(animalId: number, effects: Record<string, number>): Promise<AnimalWellnessMetric> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const metrics = await ensureAnimalMetrics(animalId);

  const newHappiness = clampMetric(metrics.happiness + (effects.happiness || 0));
  const newHealth = clampMetric(metrics.health + (effects.health || 0));
  const newAttachment = clampMetric(metrics.attachment + (effects.attachment || 0));
  const newMood = clampMetric(metrics.mood + (effects.mood || 0));
  const newObedience = clampMetric(metrics.obedience + (effects.obedience || 0));

  const overallRating = Math.round(
    newHappiness * METRIC_WEIGHTS.happiness +
    newHealth * METRIC_WEIGHTS.health +
    newAttachment * METRIC_WEIGHTS.attachment +
    newMood * METRIC_WEIGHTS.mood +
    newObedience * METRIC_WEIGHTS.obedience
  );

  await db.update(animalWellnessMetrics).set({
    happiness: newHappiness,
    health: newHealth,
    attachment: newAttachment,
    mood: newMood,
    obedience: newObedience,
    overallRating,
  }).where(eq(animalWellnessMetrics.animalId, animalId));

  const [updated] = await db.select().from(animalWellnessMetrics).where(eq(animalWellnessMetrics.animalId, animalId));
  return updated;
}

/** Apply daily decay to all animal metrics */
export async function applyDailyDecay() {
  const db = await getDb();
  if (!db) return;

  const allMetrics = await db.select().from(animalWellnessMetrics);

  for (const m of allMetrics) {
    const newHappiness = clampMetric(m.happiness - DECAY_RATES.happiness);
    const newHealth = clampMetric(m.health - DECAY_RATES.health);
    const newAttachment = clampMetric(m.attachment - DECAY_RATES.attachment);
    const newMood = clampMetric(m.mood - DECAY_RATES.mood);
    const newObedience = clampMetric(m.obedience - DECAY_RATES.obedience);

    const overallRating = Math.round(
      newHappiness * METRIC_WEIGHTS.happiness +
      newHealth * METRIC_WEIGHTS.health +
      newAttachment * METRIC_WEIGHTS.attachment +
      newMood * METRIC_WEIGHTS.mood +
      newObedience * METRIC_WEIGHTS.obedience
    );

    await db.update(animalWellnessMetrics).set({
      happiness: newHappiness,
      health: newHealth,
      attachment: newAttachment,
      mood: newMood,
      obedience: newObedience,
      overallRating,
      lastDecayAt: new Date(),
    }).where(eq(animalWellnessMetrics.id, m.id));
  }

  // Recalculate herd ranks
  await recalculateHerdRanks();
}

/** Get wellness metrics for an animal */
export async function getAnimalWellness(animalId: number) {
  const db = await getDb();
  if (!db) return null;
  return ensureAnimalMetrics(animalId);
}

// ─── Ratings & Leaderboard ───────────────────────────────

/** Recalculate herd ranks based on overall rating */
export async function recalculateHerdRanks() {
  const db = await getDb();
  if (!db) return;

  const allMetrics = await db.select().from(animalWellnessMetrics)
    .orderBy(desc(animalWellnessMetrics.overallRating));

  for (let i = 0; i < allMetrics.length; i++) {
    await db.update(animalWellnessMetrics)
      .set({ herdRank: i + 1 })
      .where(eq(animalWellnessMetrics.id, allMetrics[i].id));
  }
}

/** Update or create owner rating */
export async function updateOwnerRating(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return;

  // Get all animals owned by this user
  const ownedAnimalIds = await db.select({ animalId: animalOwnerships.animalId })
    .from(animalOwnerships)
    .where(and(
      eq(animalOwnerships.ownerOpenId, ownerOpenId),
      eq(animalOwnerships.status, "active")
    ));

  if (ownedAnimalIds.length === 0) return;

  const animalIds = ownedAnimalIds.map((a: { animalId: number }) => a.animalId);
  const metrics = await db.select().from(animalWellnessMetrics)
    .where(inArray(animalWellnessMetrics.animalId, animalIds));

  const avgRating = metrics.length > 0
    ? Math.round(metrics.reduce((sum: number, m: AnimalWellnessMetric) => sum + m.overallRating, 0) / metrics.length)
    : 50;

  // Calculate activity bonus (based on purchases in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [purchaseCount] = await db.select({ count: sql<number>`count(*)` })
    .from(marketplacePurchases)
    .where(and(
      eq(marketplacePurchases.ownerOpenId, ownerOpenId),
      gte(marketplacePurchases.createdAt, thirtyDaysAgo)
    ));

  // Activity bonus: 1 point per purchase, max 20
  const activityBonus = Math.min(20, purchaseCount.count);
  const totalScore = Math.min(100, avgRating + activityBonus);
  const title = getOwnerTitle(totalScore);

  // Total spent and purchases
  const [spentResult] = await db.select({
    totalSpent: sql<number>`COALESCE(SUM(pricePaidSKC), 0)`,
    totalPurchases: sql<number>`count(*)`,
  }).from(marketplacePurchases).where(eq(marketplacePurchases.ownerOpenId, ownerOpenId));

  const [existing] = await db.select().from(ownerRatings).where(eq(ownerRatings.ownerOpenId, ownerOpenId));

  if (existing) {
    await db.update(ownerRatings).set({
      averageAnimalRating: avgRating,
      activityBonus,
      totalScore,
      title,
      totalSpentSKC: spentResult.totalSpent,
      totalPurchases: spentResult.totalPurchases,
    }).where(eq(ownerRatings.ownerOpenId, ownerOpenId));
  } else {
    await db.insert(ownerRatings).values({
      ownerOpenId,
      averageAnimalRating: avgRating,
      activityBonus,
      totalScore,
      title,
      totalSpentSKC: spentResult.totalSpent,
      totalPurchases: spentResult.totalPurchases,
    });
  }

  // Recalculate owner ranks
  await recalculateOwnerRanks();

  // Record daily snapshot for history chart
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [existingSnap] = await db.select().from(ratingSnapshots)
    .where(and(
      eq(ratingSnapshots.ownerOpenId, ownerOpenId),
      eq(ratingSnapshots.snapshotDate, today)
    ));
  // Get latest rank
  const [latestRating] = await db.select().from(ownerRatings)
    .where(eq(ownerRatings.ownerOpenId, ownerOpenId));
  const currentRank = latestRating?.rank ?? 0;
  if (existingSnap) {
    await db.update(ratingSnapshots).set({
      totalScore,
      averageAnimalRating: avgRating,
      activityBonus,
      rank: currentRank,
    }).where(eq(ratingSnapshots.id, existingSnap.id));
  } else {
    await db.insert(ratingSnapshots).values({
      ownerOpenId,
      snapshotDate: today,
      totalScore,
      averageAnimalRating: avgRating,
      activityBonus,
      rank: currentRank,
    });
  }
}

/** Recalculate owner ranks */
export async function recalculateOwnerRanks() {
  const db = await getDb();
  if (!db) return;

  const allRatings = await db.select().from(ownerRatings)
    .orderBy(desc(ownerRatings.totalScore));

  for (let i = 0; i < allRatings.length; i++) {
    await db.update(ownerRatings)
      .set({ rank: i + 1 })
      .where(eq(ownerRatings.id, allRatings[i].id));
  }
}

/** Get herd leaderboard */
export async function getHerdLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const metrics = await db.select().from(animalWellnessMetrics)
    .orderBy(asc(animalWellnessMetrics.herdRank))
    .limit(limit);

  // Enrich with animal names
  const result = [];
  for (const m of metrics) {
    const [animal] = await db.select({ name: animals.name, slug: animals.slug, species: animals.species, coverImageUrl: animals.coverImageUrl })
      .from(animals).where(eq(animals.id, m.animalId));
    result.push({ ...m, animal: animal ?? null });
  }
  return result;
}

/** Get owner leaderboard */
export async function getOwnerLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const ratings = await db.select().from(ownerRatings)
    .orderBy(asc(ownerRatings.rank))
    .limit(limit);

  // Enrich with user names and animal count
  const result = [];
  for (const r of ratings) {
    const [user] = await db.select({ name: users.name, openId: users.openId })
      .from(users).where(eq(users.openId, r.ownerOpenId));
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(animalOwnerships)
      .where(and(
        eq(animalOwnerships.ownerOpenId, r.ownerOpenId),
        eq(animalOwnerships.status, "active")
      ));
    result.push({ ...r, user: user ?? null, animalCount: countResult?.count ?? 0 });
  }
  return result;
}

// ─── Farmer Checklists ───────────────────────────────────

/** List pending checklists for the farmer (admin) */
export async function listFarmerChecklists(status?: string) {
  const db = await getDb();
  if (!db) return [];

  if (status) {
    return db.select().from(farmerChecklists)
      .where(eq(farmerChecklists.status, status as any))
      .orderBy(desc(farmerChecklists.createdAt));
  }
  return db.select().from(farmerChecklists)
    .orderBy(desc(farmerChecklists.createdAt));
}

/** Complete a farmer checklist and trigger feedback */
export async function completeFarmerChecklist(
  checklistId: number,
  tasksJson: string,
  farmerNotes: string,
  photoUrlsJson: string | null,
  completedByOpenId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [checklist] = await db.select().from(farmerChecklists).where(eq(farmerChecklists.id, checklistId));
  if (!checklist) throw new Error("Чек-лист не найден");

  await db.update(farmerChecklists).set({
    status: "completed",
    tasksJson,
    farmerNotes,
    photoUrlsJson,
    completedAt: new Date(),
    completedByOpenId,
  }).where(eq(farmerChecklists.id, checklistId));

  // Mark purchase checklist as completed
  await db.update(marketplacePurchases)
    .set({ checklistCompleted: 1 })
    .where(eq(marketplacePurchases.id, checklist.purchaseId));

  // Generate animal feedback
  const [item] = await db.select().from(marketplaceItems)
    .innerJoin(marketplacePurchases, eq(marketplacePurchases.itemId, marketplaceItems.id))
    .where(eq(marketplacePurchases.id, checklist.purchaseId));

  const [animal] = await db.select({ name: animals.name }).from(animals).where(eq(animals.id, checklist.animalId));
  const animalName = animal?.name ?? "Я";

  let feedbackMessage = item?.marketplaceItems?.feedbackTemplate
    ?? `${animalName} очень рад(а)! Спасибо за заботу! 🐾`;

  // Replace placeholders in template
  feedbackMessage = feedbackMessage
    .replace(/\{animalName\}/g, animalName)
    .replace(/\{itemName\}/g, checklist.itemName);

  const photoUrl = photoUrlsJson ? JSON.parse(photoUrlsJson)?.[0] ?? null : null;

  await db.insert(animalFeedbackMessages).values({
    purchaseId: checklist.purchaseId,
    animalId: checklist.animalId,
    ownerOpenId: checklist.ownerOpenId,
    message: feedbackMessage,
    photoUrl,
  });

  // Mark purchase feedback as sent
  await db.update(marketplacePurchases)
    .set({ feedbackSent: 1 })
    .where(eq(marketplacePurchases.id, checklist.purchaseId));

  return { success: true, feedbackMessage };
}

/** Get unread feedback messages for an owner */
export async function getUnreadFeedback(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(animalFeedbackMessages)
    .where(and(
      eq(animalFeedbackMessages.ownerOpenId, ownerOpenId),
      eq(animalFeedbackMessages.isRead, 0)
    ))
    .orderBy(desc(animalFeedbackMessages.createdAt));
}

/** Get all feedback messages for an animal */
export async function getAnimalFeedback(animalId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(animalFeedbackMessages)
    .where(and(
      eq(animalFeedbackMessages.animalId, animalId),
      eq(animalFeedbackMessages.ownerOpenId, ownerOpenId)
    ))
    .orderBy(desc(animalFeedbackMessages.createdAt));
}

/** Mark feedback as read */
export async function markFeedbackRead(feedbackId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(animalFeedbackMessages)
    .set({ isRead: 1 })
    .where(eq(animalFeedbackMessages.id, feedbackId));
}

// ─── Auto-Allocation Settings ────────────────────────────

export async function getAutoAllocationSettings(): Promise<AutoAllocationSetting> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [existing] = await db.select().from(autoAllocationSettings);
  if (existing) return existing;

  await db.insert(autoAllocationSettings).values({
    isEnabled: 0,
    amountSKC: INITIAL_OWNER_BALANCE,
    manualAllocationEnabled: 1,
    dayOfMonth: 1,
  });
  const [created] = await db.select().from(autoAllocationSettings);
  return created;
}

export async function updateAutoAllocationSettings(data: {
  isEnabled?: number;
  amountSKC?: number;
  manualAllocationEnabled?: number;
  dayOfMonth?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await getAutoAllocationSettings(); // ensure exists
  const [existing] = await db.select().from(autoAllocationSettings);
  await db.update(autoAllocationSettings).set(data).where(eq(autoAllocationSettings.id, existing.id));
  const [updated] = await db.select().from(autoAllocationSettings);
  return updated;
}

// ─── Analytics ───────────────────────────────────────────

/** Get token economy analytics for admin */
export async function getTokenAnalytics() {
  const db = await getDb();
  if (!db) return null;

  const { bank, revenue } = await ensureFarmAccounts();

  // Total tokens in circulation (all wallet balances)
  const [circulation] = await db.select({
    total: sql<number>`COALESCE(SUM(balanceMinor), 0)`,
  }).from(wallets);

  // Transactions in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [recentTx] = await db.select({
    count: sql<number>`count(*)`,
    volume: sql<number>`COALESCE(SUM(amountSKC), 0)`,
  }).from(farmAccountTransactions)
    .where(gte(farmAccountTransactions.createdAt, thirtyDaysAgo));

  return {
    bankBalance: bank.balanceSKC,
    revenueBalance: revenue.balanceSKC,
    bankLifetime: bank.totalLifetimeSKC,
    revenueLifetime: revenue.totalLifetimeSKC,
    tokensInCirculation: circulation.total,
    recentTransactions: recentTx.count,
    recentVolume: recentTx.volume,
  };
}

/** Get marketplace sales analytics */
export async function getMarketplaceAnalytics() {
  const db = await getDb();
  if (!db) return null;

  // Top selling items
  const topItems = await db.select({
    itemId: marketplacePurchases.itemId,
    count: sql<number>`count(*)`,
    totalSKC: sql<number>`SUM(pricePaidSKC)`,
  }).from(marketplacePurchases)
    .groupBy(marketplacePurchases.itemId)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  // Enrich with item names
  const enrichedItems = [];
  for (const t of topItems) {
    const [item] = await db.select({ name: marketplaceItems.name, categoryId: marketplaceItems.categoryId })
      .from(marketplaceItems).where(eq(marketplaceItems.id, t.itemId));
    enrichedItems.push({ ...t, itemName: item?.name ?? "Unknown", categoryId: item?.categoryId ?? 0 });
  }

  // Sales by category
  const categorySales = await db.select({
    categoryId: marketplaceItems.categoryId,
    count: sql<number>`count(*)`,
    totalSKC: sql<number>`SUM(${marketplacePurchases.pricePaidSKC})`,
  }).from(marketplacePurchases)
    .innerJoin(marketplaceItems, eq(marketplacePurchases.itemId, marketplaceItems.id))
    .groupBy(marketplaceItems.categoryId);

  // Enrich with category names
  const enrichedCategories = [];
  for (const c of categorySales) {
    const [cat] = await db.select({ name: marketplaceCategories.name })
      .from(marketplaceCategories).where(eq(marketplaceCategories.id, c.categoryId));
    enrichedCategories.push({ ...c, categoryName: cat?.name ?? "Unknown" });
  }

  // Most active owners
  const topOwners = await db.select({
    ownerOpenId: marketplacePurchases.ownerOpenId,
    count: sql<number>`count(*)`,
    totalSKC: sql<number>`SUM(pricePaidSKC)`,
  }).from(marketplacePurchases)
    .groupBy(marketplacePurchases.ownerOpenId)
    .orderBy(sql`SUM(pricePaidSKC) DESC`)
    .limit(10);

  const enrichedOwners = [];
  for (const o of topOwners) {
    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.openId, o.ownerOpenId));
    enrichedOwners.push({ ...o, ownerName: user?.name ?? "Unknown" });
  }

  // Total stats
  const [totalStats] = await db.select({
    totalPurchases: sql<number>`count(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(pricePaidSKC), 0)`,
  }).from(marketplacePurchases);

  return {
    topItems: enrichedItems,
    categorySales: enrichedCategories,
    topOwners: enrichedOwners,
    totalPurchases: totalStats.totalPurchases,
    totalRevenue: totalStats.totalRevenue,
  };
}

/** Get herd wellness overview */
export async function getHerdWellnessOverview() {
  const db = await getDb();
  if (!db) return null;

  const allMetrics = await db.select().from(animalWellnessMetrics);
  if (allMetrics.length === 0) return { count: 0, avgHappiness: 0, avgHealth: 0, avgAttachment: 0, avgMood: 0, avgObedience: 0, avgOverall: 0 };

  const count = allMetrics.length;
  return {
    count,
    avgHappiness: Math.round(allMetrics.reduce((s: number, m: AnimalWellnessMetric) => s + m.happiness, 0) / count),
    avgHealth: Math.round(allMetrics.reduce((s: number, m: AnimalWellnessMetric) => s + m.health, 0) / count),
    avgAttachment: Math.round(allMetrics.reduce((s: number, m: AnimalWellnessMetric) => s + m.attachment, 0) / count),
    avgMood: Math.round(allMetrics.reduce((s: number, m: AnimalWellnessMetric) => s + m.mood, 0) / count),
    avgObedience: Math.round(allMetrics.reduce((s: number, m: AnimalWellnessMetric) => s + m.obedience, 0) / count),
    avgOverall: Math.round(allMetrics.reduce((s: number, m: AnimalWellnessMetric) => s + m.overallRating, 0) / count),
  };
}

/** Get purchase history for an owner */
export async function getOwnerPurchaseHistory(ownerOpenId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const purchases = await db.select().from(marketplacePurchases)
    .where(eq(marketplacePurchases.ownerOpenId, ownerOpenId))
    .orderBy(desc(marketplacePurchases.createdAt))
    .limit(limit);

  // Enrich with item and animal names
  const result = [];
  for (const p of purchases) {
    const [item] = await db.select({ name: marketplaceItems.name, imageUrl: marketplaceItems.imageUrl })
      .from(marketplaceItems).where(eq(marketplaceItems.id, p.itemId));
    const [animal] = await db.select({ name: animals.name, slug: animals.slug })
      .from(animals).where(eq(animals.id, p.animalId));
    result.push({
      ...p,
      itemName: item?.name ?? "Unknown",
      itemImageUrl: item?.imageUrl ?? null,
      animalName: animal?.name ?? "Unknown",
      animalSlug: animal?.slug ?? "",
    });
  }
  return result;
}


/**
 * Freeze (block) a user's wallet. Prevents spending and receiving tokens.
 */
export async function freezeWallet(ownerOpenId: string, memo: string, adminOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.ownerOpenId, ownerOpenId))
    .limit(1);
  if (!wallet) throw new Error("Кошелёк не найден");
  if (wallet.status === "frozen") throw new Error("Кошелёк уже заблокирован");
  await db
    .update(wallets)
    .set({ status: "frozen" })
    .where(eq(wallets.id, wallet.id));
  // Log the action as a transaction memo
  await db.insert(walletTransactions).values({
    ownerOpenId,
    walletId: wallet.id,
    amountMinor: 0,
    direction: "debit",
    transactionType: "admin_adjustment",
    memo: `[БЛОКИРОВКА] ${memo}`,
    adminOpenId,
  });
  return { success: true, status: "frozen" as const };
}

/**
 * Unfreeze (unblock) a user's wallet. Restores normal operations.
 */
export async function unfreezeWallet(ownerOpenId: string, memo: string, adminOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.ownerOpenId, ownerOpenId))
    .limit(1);
  if (!wallet) throw new Error("Кошелёк не найден");
  if (wallet.status === "active") throw new Error("Кошелёк уже активен");
  await db
    .update(wallets)
    .set({ status: "active" })
    .where(eq(wallets.id, wallet.id));
  // Log the action
  await db.insert(walletTransactions).values({
    ownerOpenId,
    walletId: wallet.id,
    amountMinor: 0,
    direction: "credit",
    transactionType: "admin_adjustment",
    memo: `[РАЗБЛОКИРОВКА] ${memo}`,
    adminOpenId,
  });
  return { success: true, status: "active" as const };
}

/**
 * Get wallet status for a specific user.
 */
export async function getWalletStatus(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return null;
  const [wallet] = await db
    .select({ status: wallets.status, balanceMinor: wallets.balanceMinor })
    .from(wallets)
    .where(eq(wallets.ownerOpenId, ownerOpenId))
    .limit(1);
  return wallet ?? null;
}

/** Get rating history snapshots for the last N days */
export async function getRatingHistory(ownerOpenId: string, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const since = sinceDate.toISOString().slice(0, 10);
  return db.select().from(ratingSnapshots)
    .where(and(
      eq(ratingSnapshots.ownerOpenId, ownerOpenId),
      gte(ratingSnapshots.snapshotDate, since)
    ))
    .orderBy(asc(ratingSnapshots.snapshotDate));
}
