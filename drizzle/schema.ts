import { boolean, double, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  preferredContact: mysqlEnum("preferredContact", ["email", "phone", "messenger"]),
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Plain-text password stored for admin visibility. Only set during local registration. */
  bitrix24ContactId: varchar("bitrix24ContactId", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  /** User's preferred primary animal for the dashboard. Nullable — when null, auto-select by ownership priority. */
  primaryAnimalId: int("primaryAnimalId"),
  /** Telegram chat ID for bot notifications. Set when user links their Telegram account. */
  telegramChatId: varchar("telegramChatId", { length: 20 }),
  /** Soft-delete timestamp. When set, user is in trash and access is blocked. */
  deletedAt: timestamp("deletedAt"),
  /** Admin openId who moved the user to trash. */
  deletedBy: varchar("deletedBy", { length: 64 }),
}, (t) => ([
  index("idx_users_email").on(t.email),
  index("idx_users_role").on(t.role),
  index("idx_users_deletedAt").on(t.deletedAt),
]));

export const animalSpeciesEnum = mysqlEnum("animalSpecies", ["goat", "sheep"]);
export const animalStatusEnum = mysqlEnum("animalStatus", ["public_available", "public_limited", "fully_booked", "hidden", "archived"]);
export const familyStatusEnum = mysqlEnum("familyStatus", ["active", "paused", "archived"]);
export const ownershipStatusEnum = mysqlEnum("ownershipStatus", ["pending_payment", "active", "expired", "cancelled", "frozen"]);
export const planStatusEnum = mysqlEnum("planStatus", ["draft", "active", "archived"]);
export const walletStatusEnum = mysqlEnum("walletStatus", ["active", "frozen", "archived"]);
export const walletTransactionTypeEnum = mysqlEnum("walletTransactionType", ["topup", "spend", "reward", "admin_grant", "admin_adjustment", "refund", "expiry"]);
export const walletTransactionDirectionEnum = mysqlEnum("walletTransactionDirection", ["credit", "debit"]);

export const families = mysqlTable("families", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  status: familyStatusEnum.default("active").notNull(),
  maxAnimals: int("maxAnimals").default(10).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_families_ownerOpenId").on(t.ownerOpenId),
]));

export const animals = mysqlTable("animals", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  species: animalSpeciesEnum.notNull(),
  breed: varchar("breed", { length: 160 }),
  birthDate: timestamp("birthDate"),
  shortDescription: varchar("shortDescription", { length: 255 }),
  story: text("story"),
  coverImageUrl: text("coverImageUrl"),
  galleryIntro: text("galleryIntro"),
  status: animalStatusEnum.default("public_available").notNull(),
  totalOwnershipSlots: int("totalOwnershipSlots").default(2).notNull(),
  baseMonthlyPriceMinor: int("baseMonthlyPriceMinor").default(0).notNull(),
  healthScore: int("healthScore").default(50).notNull(),
  happinessScore: int("happinessScore").default(50).notNull(),
  milkPotentialScore: int("milkPotentialScore").default(50).notNull(),
  careLevelScore: int("careLevelScore").default(0).notNull(),
  isFeatured: int("isFeatured").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_animals_ownerOpenId").on(t.ownerOpenId),
  index("idx_animals_status").on(t.status),
]));

export const animalMedia = mysqlTable("animalMedia", {
  id: int("id").autoincrement().primaryKey(),
  animalId: int("animalId").notNull(),
  kind: mysqlEnum("animalMediaKind", ["image", "video", "document"]).default("image").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  alt: varchar("alt", { length: 255 }),
  fileKey: varchar("fileKey", { length: 255 }),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 120 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isCover: int("isCover").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_animalMedia_animalId").on(t.animalId),
]));

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  status: planStatusEnum.default("draft").notNull(),
  basePriceMinor: int("basePriceMinor").default(0).notNull(),
  maxOwnersPerAnimal: int("maxOwnersPerAnimal").default(3).notNull(),
  benefitsSummary: text("benefitsSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const planDurations = mysqlTable("planDurations", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  months: int("months").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  priceMinor: int("priceMinor").notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const animalOwnerships = mysqlTable("animalOwnerships", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  animalId: int("animalId").notNull(),
  familyId: int("familyId").notNull(),
  planId: int("planId").notNull(),
  planDurationId: int("planDurationId").notNull(),
  slotIndex: int("slotIndex").notNull(),
  status: ownershipStatusEnum.default("pending_payment").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  priceMinor: int("priceMinor").default(0).notNull(),
  paidAt: timestamp("paidAt"),
  cancelledAt: timestamp("cancelledAt"),
  notes: text("notes"),
  /** Bitrix24 deal ID linked to this ownership */
  bitrixDealId: varchar("bitrixDealId", { length: 64 }),
  /** Current Bitrix24 stage ID */
  bitrixStageId: varchar("bitrixStageId", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_ownerships_ownerOpenId").on(t.ownerOpenId),
  index("idx_ownerships_animalId").on(t.animalId),
  index("idx_ownerships_status").on(t.status),
]));

export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  familyId: int("familyId").notNull(),
  status: walletStatusEnum.default("active").notNull(),
  balanceMinor: int("balanceMinor").default(0).notNull(),
  currencyCode: varchar("currencyCode", { length: 12 }).default("SKC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_wallets_ownerOpenId").on(t.ownerOpenId),
  index("idx_wallets_familyId").on(t.familyId),
]));

export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  walletId: int("walletId").notNull(),
  familyId: int("familyId").notNull(),
  transactionType: walletTransactionTypeEnum.notNull(),
  direction: walletTransactionDirectionEnum.notNull(),
  amountMinor: int("amountMinor").notNull(),
  balanceAfterMinor: int("balanceAfterMinor").default(0).notNull(),
  memo: varchar("memo", { length: 255 }),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: varchar("referenceId", { length: 64 }),
  emittedByOpenId: varchar("emittedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_walletTx_ownerOpenId").on(t.ownerOpenId),
  index("idx_walletTx_walletId").on(t.walletId),
]));

export const photoModerationStatusEnum = mysqlEnum("photoModerationStatus", ["pending", "approved", "rejected"]);

export const animalPhotos = mysqlTable("animalPhotos", {
  id: int("id").autoincrement().primaryKey(),
  animalSlug: varchar("animalSlug", { length: 64 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  meta: varchar("meta", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isCover: int("isCover").default(0).notNull(),
  moderationStatus: photoModerationStatusEnum.default("approved").notNull(),
  moderatedBy: varchar("moderatedBy", { length: 64 }),
  moderatedAt: timestamp("moderatedAt"),
  rejectionReason: varchar("rejectionReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_animalPhotos_animalSlug").on(t.animalSlug),
  index("idx_animalPhotos_moderationStatus").on(t.moderationStatus),
]));

export const productBatches = mysqlTable("productBatches", {
  id: int("id").autoincrement().primaryKey(),
  animalSlug: varchar("animalSlug", { length: 64 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  productName: varchar("productName", { length: 160 }).notNull(),
  productType: varchar("productType", { length: 80 }).notNull(),
  stage: varchar("stage", { length: 80 }).notNull(),
  routeLabel: varchar("routeLabel", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  badge: varchar("badge", { length: 80 }).notNull(),
  batchCode: varchar("batchCode", { length: 80 }).notNull(),
  producedAt: timestamp("producedAt").notNull(),
  deliveryWindow: varchar("deliveryWindow", { length: 120 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_productBatches_animalSlug").on(t.animalSlug),
]));

export const productCompositionSnapshots = mysqlTable("productCompositionSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  animalSlug: varchar("animalSlug", { length: 64 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  value: varchar("value", { length: 120 }).notNull(),
  note: varchar("note", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productMonthlyMetrics = mysqlTable("productMonthlyMetrics", {
  id: int("id").autoincrement().primaryKey(),
  animalSlug: varchar("animalSlug", { length: 64 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  monthLabel: varchar("monthLabel", { length: 32 }).notNull(),
  milkVolumeLiters: int("milkVolumeLiters").notNull(),
  proteinPercentTenth: int("proteinPercentTenth").notNull(),
  fatPercentTenth: int("fatPercentTenth").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productDeliveries = mysqlTable("productDeliveries", {
  id: int("id").autoincrement().primaryKey(),
  animalSlug: varchar("animalSlug", { length: 64 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  status: varchar("status", { length: 80 }).notNull(),
  etaLabel: varchar("etaLabel", { length: 120 }).notNull(),
  destination: varchar("destination", { length: 160 }).notNull(),
  courierNote: varchar("courierNote", { length: 255 }).notNull(),
  isActive: int("isActive").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clubPosts = mysqlTable("clubPosts", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  author: varchar("author", { length: 160 }).notNull(),
  avatar: varchar("avatar", { length: 8 }).notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  timeLabel: varchar("timeLabel", { length: 80 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  text: text("text").notNull(),
  imageUrl: text("imageUrl").notNull(),
  likes: int("likes").default(0).notNull(),
  comments: int("comments").default(0).notNull(),
  tagsCsv: varchar("tagsCsv", { length: 255 }).notNull(),
  pinned: int("pinned").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_clubPosts_ownerOpenId").on(t.ownerOpenId),
  index("idx_clubPosts_category").on(t.category),
  index("idx_clubPosts_hidden").on(t.hidden),
]));

export const clubEvents = mysqlTable("clubEvents", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  dateLabel: varchar("dateLabel", { length: 80 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 120 }).notNull(),
  tone: varchar("tone", { length: 32 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  /** Max number of registrations allowed. 0 = unlimited. */
  maxCapacity: int("maxCapacity").default(0).notNull(),
  /** Denormalized count of confirmed registrations */
  registrationCount: int("registrationCount").default(0).notNull(),
  /** Whether registration is open for this event */
  registrationOpen: boolean("registrationOpen").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clubMembers = mysqlTable("clubMembers", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  animal: varchar("animal", { length: 120 }).notNull(),
  sinceLabel: varchar("sinceLabel", { length: 120 }).notNull(),
  badge: varchar("badge", { length: 80 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clubAdminPresets = mysqlTable("clubAdminPresets", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  tab: mysqlEnum("tab", ["posts", "events", "members"]).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  configJson: text("configJson").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const partnerLeads = mysqlTable("partnerLeads", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  companyName: varchar("companyName", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  telegram: varchar("telegram", { length: 80 }),
  region: varchar("region", { length: 160 }),
  source: mysqlEnum("source", ["website", "club", "referral", "manual"]).default("website").notNull(),
  interestType: mysqlEnum("interestType", ["retail", "horeca", "distribution", "collaboration", "other"]).default("other").notNull(),
  preferredContactMethod: mysqlEnum("preferredContactMethod", ["email", "phone", "whatsapp", "telegram", "any"]).default("any").notNull(),
  interestProducts: text("interestProducts"),
  notes: text("notes"),
  attachmentsJson: text("attachmentsJson"),
  syncStatus: mysqlEnum("syncStatus", ["pending", "success", "failed", "retried"]).default("pending").notNull(),
  syncAttemptCount: int("syncAttemptCount").default(0).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastSyncError: text("lastSyncError"),
  bitrixContactId: varchar("bitrixContactId", { length: 64 }),
  bitrixCompanyId: varchar("bitrixCompanyId", { length: 64 }),
  bitrixDealId: varchar("bitrixDealId", { length: 64 }),
  bitrixLeadId: varchar("bitrixLeadId", { length: 64 }),
  bitrixStageId: varchar("bitrixStageId", { length: 120 }),
  assignedManagerId: varchar("assignedManagerId", { length: 64 }),
  assignedManagerName: varchar("assignedManagerName", { length: 160 }),
  nextActivityAt: timestamp("nextActivityAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const integrationAudits = mysqlTable("integrationAudits", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  integration: mysqlEnum("integration", ["bitrix24"]).default("bitrix24").notNull(),
  entityType: mysqlEnum("entityType", ["partnerLead", "contact", "company", "deal", "webhook"]).notNull(),
  entityId: int("entityId").notNull(),
  operation: mysqlEnum("operation", ["create", "sync", "retry", "pull", "webhook"]).notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed"]).default("pending").notNull(),
  requestPayload: text("requestPayload"),
  responsePayload: text("responsePayload"),
  errorMessage: text("errorMessage"),
  externalId: varchar("externalId", { length: 120 }),
  retryOfAuditId: int("retryOfAuditId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Family = typeof families.$inferSelect;
export type InsertFamily = typeof families.$inferInsert;

export type Animal = typeof animals.$inferSelect;
export type InsertAnimal = typeof animals.$inferInsert;

export type AnimalMedium = typeof animalMedia.$inferSelect;
export type InsertAnimalMedium = typeof animalMedia.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

export type PlanDuration = typeof planDurations.$inferSelect;
export type InsertPlanDuration = typeof planDurations.$inferInsert;

export type AnimalOwnership = typeof animalOwnerships.$inferSelect;
export type InsertAnimalOwnership = typeof animalOwnerships.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

export type AnimalPhoto = typeof animalPhotos.$inferSelect;
export type InsertAnimalPhoto = typeof animalPhotos.$inferInsert;

export type ProductBatch = typeof productBatches.$inferSelect;
export type InsertProductBatch = typeof productBatches.$inferInsert;

export type ProductCompositionSnapshot = typeof productCompositionSnapshots.$inferSelect;
export type InsertProductCompositionSnapshot = typeof productCompositionSnapshots.$inferInsert;

export type ProductMonthlyMetric = typeof productMonthlyMetrics.$inferSelect;
export type InsertProductMonthlyMetric = typeof productMonthlyMetrics.$inferInsert;

export type ProductDelivery = typeof productDeliveries.$inferSelect;
export type InsertProductDelivery = typeof productDeliveries.$inferInsert;

export type ClubPost = typeof clubPosts.$inferSelect;
export type InsertClubPost = typeof clubPosts.$inferInsert;

export type ClubEvent = typeof clubEvents.$inferSelect;
export type InsertClubEvent = typeof clubEvents.$inferInsert;

export type ClubMember = typeof clubMembers.$inferSelect;
export type InsertClubMember = typeof clubMembers.$inferInsert;

export type ClubAdminPreset = typeof clubAdminPresets.$inferSelect;
export type InsertClubAdminPreset = typeof clubAdminPresets.$inferInsert;

export type PartnerLead = typeof partnerLeads.$inferSelect;
export type InsertPartnerLead = typeof partnerLeads.$inferInsert;

export type IntegrationAudit = typeof integrationAudits.$inferSelect;
export type InsertIntegrationAudit = typeof integrationAudits.$inferInsert;

/* ───────────────────────────────────────────────
   Product Track — production profiles, product options,
   owner product plans, delivery schedule, chat
   ─────────────────────────────────────────────── */

export const productTypeEnum = mysqlEnum("productType", [
  "milk", "smetana", "yogurt", "kefir",
  "brynza", "kachotta", "halumi", "ricotta", "camembert",
  "aged_cheese", "blue_cheese", "smoked_cheese",
  "butter", "condensed_milk", "fermented_drink", "custom", "cheese"
]);
export const ownerProductPlanStatusEnum = mysqlEnum("ownerProductPlanStatus", [
  "draft", "pending_admin_setup", "pending_owner_config", "pending_approval", "confirmed", "modified_by_admin"
]);
export const planChangeActionEnum = mysqlEnum("planChangeAction", [
  "created", "submitted", "approved", "modified", "reset",
  "tier_changed", "admin_verified", "owner_configured"
]);
export const ownerTierSlugEnum = mysqlEnum("ownerTierSlug", ["basic", "standard", "professional"]);
export const minTierEnum = mysqlEnum("minTier", ["basic", "standard", "professional"]);
export const deliveryStatusEnum = mysqlEnum("deliveryStatus", ["planned", "ready", "delivered"]);
export const chatMessageSenderEnum = mysqlEnum("chatMessageSender", ["owner", "admin"]);

/**
 * Per-animal production profile set by admin.
 * Defines annual milk yield and available product conversions.
 */
export const animalProductionProfiles = mysqlTable("animalProductionProfiles", {
  id: int("id").autoincrement().primaryKey(),
  animalId: int("animalId").notNull(),
  /** Total annual milk yield in liters for this animal */
  annualMilkLiters: int("annualMilkLiters").notNull(),
  /** JSON notes from admin (optional) */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Available product options for an animal.
 * Each row = one product type the admin has enabled.
 * conversionRatio: how many liters of milk to produce 1 unit (liter or kg) of product.
 * maxAnnualUnits: admin-set cap on annual production for this product.
 */
export const productOptions = mysqlTable("productOptions", {
  id: int("id").autoincrement().primaryKey(),
  animalId: int("animalId").notNull(),
  productType: productTypeEnum.notNull(),
  /** Human-readable label, e.g. "Козий сыр", "Кефир из козьего молока" */
  label: varchar("label", { length: 160 }).notNull(),
  /** Liters of milk needed to produce 1 unit (liter or kg) */
  conversionRatio: int("conversionRatio").notNull(),
  /** Unit of measurement for the product: "л" or "кг" */
  unit: varchar("unit", { length: 16 }).default("л").notNull(),
  /** Max annual production in units */
  maxAnnualUnits: int("maxAnnualUnits").notNull(),
  /** Is this option currently enabled for selection? */
  isEnabled: int("isEnabled").default(1).notNull(),
  /** Admin verification status: 0=pending, 1=verified */
  isAdminVerified: int("isAdminVerified").default(0).notNull(),
  /** When admin verified this product option */
  adminVerifiedAt: timestamp("adminVerifiedAt"),
  /** Reference to the tier catalog item this was generated from (null if manually created) */
  catalogItemId: int("catalogItemId"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Owner's tier status — auto-determined from their active ownerships.
 * One row per owner. Updated on every ownership change.
 */
export const ownerTierStatus = mysqlTable("ownerTierStatus", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull().unique(),
  tierSlug: ownerTierSlugEnum.notNull(),
  /** Total distinct animals with active ownership */
  totalAnimals: int("totalAnimals").default(0).notNull(),
  /** Total active ownership rows */
  totalActiveOwnerships: int("totalActiveOwnerships").default(0).notNull(),
  /** When tier was last computed */
  determinedAt: timestamp("determinedAt").defaultNow().notNull(),
  /** Previous tier (for change tracking) */
  previousTierSlug: varchar("previousTierSlug", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_ownerTier_openId").on(t.ownerOpenId),
]));

/**
 * Tier product catalog — master list of products available per tier.
 * Admin-managed globally. Products are unlocked by minTier.
 * E.g. milk has minTier=basic, brynza has minTier=standard, aged_cheese has minTier=professional.
 */
export const tierProductCatalog = mysqlTable("tierProductCatalog", {
  id: int("id").autoincrement().primaryKey(),
  /** Which tier unlocks this product (basic/standard/professional) */
  minTier: minTierEnum.notNull(),
  /** Product type from expanded enum */
  productType: productTypeEnum.notNull(),
  /** Human-readable label, e.g. "Козья сметана", "Брынза из козьего молока" */
  label: varchar("label", { length: 160 }).notNull(),
  /** Animal species this product applies to */
  species: mysqlEnum("tpc_species", ["goat", "sheep", "both"]).default("both").notNull(),
  /** Liters of milk needed to produce 1 unit */
  conversionRatio: double("conversionRatio").notNull(),
  /** Unit of measurement: л or кг */
  unit: varchar("unit", { length: 16 }).default("л").notNull(),
  /** Description for the owner */
  description: text("description"),
  /** Is this product currently enabled? */
  isEnabled: int("isEnabled").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_tpc_minTier").on(t.minTier),
  index("idx_tpc_species").on(t.species),
]));

/**
 * Owner's chosen product plan for a specific animal ownership.
 * Tier-driven: products available are determined by owner's tier.
 * Flow: purchase → pending_admin_setup → admin verifies → pending_owner_config → owner configures → pending_approval → confirmed
 */
export const ownerProductPlans = mysqlTable("ownerProductPlans", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  animalId: int("animalId").notNull(),
  ownershipId: int("ownershipId").notNull(),
  /** Owner's tier at time of plan creation */
  tierSlug: varchar("tierSlug", { length: 32 }),
  status: ownerProductPlanStatusEnum.default("pending_admin_setup").notNull(),
  /** JSON array of selections: [{catalogItemId, annualUnits, label, unit}] */
  selectionsJson: text("selectionsJson").notNull(),
  /** Total milk liters consumed by this plan */
  totalMilkUsed: int("totalMilkUsed").default(0).notNull(),
  /** Admin notes when modifying */
  adminNotes: text("adminNotes"),
  /** When admin verified the product set */
  adminVerifiedAt: timestamp("adminVerifiedAt"),
  /** When owner last changed their plan */
  lastChangedAt: timestamp("lastChangedAt"),
  /** When the next plan change is allowed (computed from tier frequency) */
  nextChangeAllowedAt: timestamp("nextChangeAllowedAt"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Monthly delivery schedule entries.
 * Auto-generated from ownerProductPlans with equal monthly distribution.
 */
export const deliverySchedule = mysqlTable("deliverySchedule", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  animalId: int("animalId").notNull(),
  ownershipId: int("ownershipId").notNull(),
  productPlanId: int("productPlanId").notNull(),
  /** 1-12 */
  month: int("month").notNull(),
  /** Calendar year */
  year: int("year").notNull(),
  /** JSON array of items: [{productType, label, quantity, unit}] */
  itemsJson: text("itemsJson").notNull(),
  status: deliveryStatusEnum.default("planned").notNull(),
  deliveredAt: timestamp("deliveredAt"),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Chat messages between owner and admin about a specific animal.
 * Supports text and photo messages.
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  animalId: int("animalId").notNull(),
  /** The owner's openId (conversation is always owner ↔ admin for a specific animal) */
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  sender: chatMessageSenderEnum.notNull(),
  /** Text content of the message */
  text: text("text"),
  /** Photo URL (uploaded to S3) */
  photoUrl: text("photoUrl"),
  /** Photo S3 key for reference */
  photoKey: varchar("photoKey", { length: 255 }),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_chatMessages_animalId").on(t.animalId),
  index("idx_chatMessages_ownerOpenId").on(t.ownerOpenId),
]));

export type AnimalProductionProfile = typeof animalProductionProfiles.$inferSelect;
export type InsertAnimalProductionProfile = typeof animalProductionProfiles.$inferInsert;

export type ProductOption = typeof productOptions.$inferSelect;
export type InsertProductOption = typeof productOptions.$inferInsert;

export type OwnerProductPlan = typeof ownerProductPlans.$inferSelect;
export type InsertOwnerProductPlan = typeof ownerProductPlans.$inferInsert;

export type DeliveryScheduleEntry = typeof deliverySchedule.$inferSelect;
export type InsertDeliveryScheduleEntry = typeof deliverySchedule.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Log of all plan changes for audit trail.
 * Records every status transition with before/after snapshots.
 */
export const planChangeLog = mysqlTable("planChangeLog", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  animalId: int("animalId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  /** Who performed the action: owner openId or 'admin' */
  actorId: varchar("actorId", { length: 64 }).notNull(),
  action: planChangeActionEnum.notNull(),
  /** Previous status before this change */
  previousStatus: varchar("previousStatus", { length: 32 }),
  /** New status after this change */
  newStatus: varchar("newStatus", { length: 32 }).notNull(),
  /** Snapshot of selectionsJson at this point */
  selectionsSnapshot: text("selectionsSnapshot"),
  /** Optional note */
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlanChangeLogEntry = typeof planChangeLog.$inferSelect;
export type InsertPlanChangeLogEntry = typeof planChangeLog.$inferInsert;

export type OwnerTierStatus = typeof ownerTierStatus.$inferSelect;
export type InsertOwnerTierStatus = typeof ownerTierStatus.$inferInsert;

export type TierProductCatalogItem = typeof tierProductCatalog.$inferSelect;
export type InsertTierProductCatalogItem = typeof tierProductCatalog.$inferInsert;

/* ───────────────────────────────────────────────
   Local Auth — OTP codes and password reset tokens
   ─────────────────────────────────────────────── */

export const otpPurposeEnum = mysqlEnum("otpPurpose", ["registration", "password_reset"]);
export const otpChannelEnum = mysqlEnum("otpChannel", ["email", "phone"]);

/**
 * One-time verification codes for registration and password reset.
 * Codes expire after 3 minutes. Max 5 attempts per code.
 */
export const otpCodes = mysqlTable("otpCodes", {
  id: int("id").autoincrement().primaryKey(),
  /** Email or phone the code was sent to */
  target: varchar("target", { length: 320 }).notNull(),
  /** 6-digit code */
  code: varchar("code", { length: 6 }).notNull(),
  purpose: otpPurposeEnum.notNull(),
  channel: otpChannelEnum.notNull(),
  /** Number of verification attempts */
  attempts: int("attempts").default(0).notNull(),
  /** Whether the code has been successfully verified */
  verified: boolean("verified").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Password reset tokens sent via email.
 * Token is a random UUID, expires after 30 minutes.
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Rate limiting for auth operations (login attempts, OTP sends).
 * Tracks attempts per IP/identifier within time windows.
 */
export const authRateLimits = mysqlTable("authRateLimits", {
  id: int("id").autoincrement().primaryKey(),
  /** IP address or identifier being rate-limited */
  identifier: varchar("identifier", { length: 320 }).notNull(),
  /** Type of action being limited */
  action: varchar("action", { length: 32 }).notNull(),
  /** Number of attempts in current window */
  attempts: int("attempts").default(1).notNull(),
  /** When this rate limit window expires */
  windowExpiresAt: timestamp("windowExpiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type AuthRateLimit = typeof authRateLimits.$inferSelect;
export type InsertAuthRateLimit = typeof authRateLimits.$inferInsert;

/* ───────────────────────────────────────────────
   Gamification — "Забота" Ecosystem
   Token economy, marketplace, wellness metrics,
   farmer checklists, animal feedback
   ─────────────────────────────────────────────── */

export const farmAccountTypeEnum = mysqlEnum("farmAccountType", ["bank", "revenue"]);
export const farmTxTypeEnum = mysqlEnum("farmTxType", [
  "emission",           // Bank → Owner (admin grants tokens)
  "bulk_emission",      // Bank → multiple Owners
  "auto_emission",      // Bank → Owner (monthly auto)
  "purchase",           // Owner → Revenue (marketplace buy)
  "refund",             // Revenue → Owner (admin refund)
  "adjustment",         // Manual correction
  "bonus",              // Bank → Owner (achievement reward)
]);
export const farmTxDirectionEnum = mysqlEnum("farmTxDirection", ["credit", "debit"]);
export const checklistStatusEnum = mysqlEnum("checklistStatus", ["pending", "in_progress", "completed"]);
export const marketplaceItemSeasonEnum = mysqlEnum("marketplaceItemSeason", ["all", "spring", "summer", "autumn", "winter"]);

/**
 * Farm-level accounts: Bank (token emission source) and Revenue (collects purchase payments).
 * Only two rows should exist: one for "bank" and one for "revenue".
 */
export const farmAccounts = mysqlTable("farmAccounts", {
  id: int("id").autoincrement().primaryKey(),
  accountType: farmAccountTypeEnum.notNull().unique(),
  /** Balance in SKC tokens (1 SKC = 100 RUB) */
  balanceSKC: int("balanceSKC").default(0).notNull(),
  /** Total tokens ever emitted (bank) or collected (revenue) */
  totalLifetimeSKC: int("totalLifetimeSKC").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Every token movement between farm accounts and owner wallets.
 * Full audit trail for the entire token economy.
 */
export const farmAccountTransactions = mysqlTable("farmAccountTransactions", {
  id: int("id").autoincrement().primaryKey(),
  /** Which farm account is affected (bank or revenue) */
  farmAccountId: int("farmAccountId").notNull(),
  /** Owner wallet affected (null for inter-farm transfers) */
  walletId: int("walletId"),
  /** Owner who receives/sends tokens */
  ownerOpenId: varchar("ownerOpenId", { length: 64 }),
  txType: farmTxTypeEnum.notNull(),
  direction: farmTxDirectionEnum.notNull(),
  /** Amount in SKC tokens */
  amountSKC: int("amountSKC").notNull(),
  /** Farm account balance after this transaction */
  farmBalanceAfterSKC: int("farmBalanceAfterSKC").notNull(),
  /** Owner wallet balance after this transaction (null if no wallet involved) */
  walletBalanceAfterSKC: int("walletBalanceAfterSKC"),
  /** Reference to marketplace purchase if applicable */
  purchaseId: int("purchaseId"),
  memo: varchar("memo", { length: 500 }),
  /** Admin who initiated the transaction */
  initiatedByOpenId: varchar("initiatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Marketplace categories managed by admin.
 * Each category groups related care items.
 */
export const marketplaceCategories = mysqlTable("marketplaceCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  emoji: varchar("emoji", { length: 8 }),
  iconUrl: text("iconUrl"),
  isVisible: int("isVisible").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Marketplace items (care actions) that owners can purchase for their animals.
 * Each item has a price in SKC and affects specific wellness metrics.
 */
export const marketplaceItems = mysqlTable("marketplaceItems", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  /** Price in SKC tokens */
  priceSKC: int("priceSKC").notNull(),
  /** Available stock (-1 = unlimited) */
  stock: int("stock").default(-1).notNull(),
  /** Max purchases per owner per day (0 = no limit) */
  dailyLimitPerOwner: int("dailyLimitPerOwner").default(0).notNull(),
  /** Max purchases per owner per week (0 = no limit) */
  weeklyLimitPerOwner: int("weeklyLimitPerOwner").default(0).notNull(),
  /** Max purchases per owner per month (0 = no limit) */
  monthlyLimitPerOwner: int("monthlyLimitPerOwner").default(0).notNull(),
  /** Seasonal availability */
  season: marketplaceItemSeasonEnum.default("all").notNull(),
  /** Wellness metric effects as JSON: {happiness: 5, health: 3, attachment: 2, mood: 4, obedience: 1} */
  metricEffectsJson: text("metricEffectsJson").notNull(),
  /** Whether this item requires a farmer checklist */
  requiresChecklist: int("requiresChecklist").default(1).notNull(),
  /** Checklist template as JSON array: [{task: "Дать морковку", description: "..."}] */
  checklistTemplateJson: text("checklistTemplateJson"),
  /** Animal feedback message template (from animal's perspective) */
  feedbackTemplate: text("feedbackTemplate"),
  isVisible: int("isVisible").default(1).notNull(),
  /** Applicable species: null = all, "goat", "sheep" */
  applicableSpecies: varchar("applicableSpecies", { length: 16 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_marketplaceItems_categoryId").on(t.categoryId),
]));

/**
 * Record of each marketplace purchase by an owner for their animal.
 */
export const marketplacePurchases = mysqlTable("marketplacePurchases", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  animalId: int("animalId").notNull(),
  itemId: int("itemId").notNull(),
  walletId: int("walletId").notNull(),
  /** Price paid in SKC at time of purchase */
  pricePaidSKC: int("pricePaidSKC").notNull(),
  /** Snapshot of metric effects applied */
  metricEffectsAppliedJson: text("metricEffectsAppliedJson").notNull(),
  /** Whether the farmer checklist is completed */
  checklistCompleted: int("checklistCompleted").default(0).notNull(),
  /** Whether the animal feedback has been sent */
  feedbackSent: int("feedbackSent").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_purchases_ownerOpenId").on(t.ownerOpenId),
  index("idx_purchases_animalId").on(t.animalId),
  index("idx_purchases_itemId").on(t.itemId),
]));

/**
 * Farmer checklists generated after a marketplace purchase.
 * The farmer fills these out to confirm the care action was performed.
 */
export const farmerChecklists = mysqlTable("farmerChecklists", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull(),
  animalId: int("animalId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  /** Item name for quick reference */
  itemName: varchar("itemName", { length: 160 }).notNull(),
  status: checklistStatusEnum.default("pending").notNull(),
  /** Checklist tasks as JSON: [{task, description, completed, completedAt}] */
  tasksJson: text("tasksJson").notNull(),
  /** Farmer's notes/report */
  farmerNotes: text("farmerNotes"),
  /** Photo proof URLs as JSON array */
  photoUrlsJson: text("photoUrlsJson"),
  completedAt: timestamp("completedAt"),
  /** Farmer who completed the checklist */
  completedByOpenId: varchar("completedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_checklists_purchaseId").on(t.purchaseId),
  index("idx_checklists_animalId").on(t.animalId),
  index("idx_checklists_ownerOpenId").on(t.ownerOpenId),
]));

/**
 * Messages from the animal's perspective after a care action is completed.
 * Generated when farmer completes a checklist.
 */
export const animalFeedbackMessages = mysqlTable("animalFeedbackMessages", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull(),
  animalId: int("animalId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  /** Message text from the animal's perspective */
  message: text("message").notNull(),
  /** Photo URL from the farmer's checklist */
  photoUrl: text("photoUrl"),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_feedback_purchaseId").on(t.purchaseId),
  index("idx_feedback_animalId").on(t.animalId),
  index("idx_feedback_ownerOpenId").on(t.ownerOpenId),
]));

/**
 * Wellness metrics for each animal. Updated on purchases and decayed daily.
 * Each metric ranges from 0-100 with a minimum floor of 10.
 */
export const animalWellnessMetrics = mysqlTable("animalWellnessMetrics", {
  id: int("id").autoincrement().primaryKey(),
  animalId: int("animalId").notNull().unique(),
  happiness: int("happiness").default(50).notNull(),
  health: int("health").default(50).notNull(),
  attachment: int("attachment").default(50).notNull(),
  mood: int("mood").default(50).notNull(),
  obedience: int("obedience").default(50).notNull(),
  /** Weighted average of all metrics (auto-calculated) */
  overallRating: int("overallRating").default(50).notNull(),
  /** Rank position in the herd (1 = best) */
  herdRank: int("herdRank").default(0).notNull(),
  /** Last time decay was applied */
  lastDecayAt: timestamp("lastDecayAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Owner rating and title based on their animals' wellness.
 * Updated whenever animal metrics change.
 */
export const ownerRatings = mysqlTable("ownerRatings", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull().unique(),
  /** Average overall rating across all owned animals */
  averageAnimalRating: int("averageAnimalRating").default(50).notNull(),
  /** Activity bonus (0-20 points based on purchase frequency) */
  activityBonus: int("activityBonus").default(0).notNull(),
  /** Final composite score */
  totalScore: int("totalScore").default(50).notNull(),
  /** Current title based on score */
  title: varchar("title", { length: 80 }).default("Новичок").notNull(),
  /** Rank position among all owners (1 = best) */
  rank: int("rank").default(0).notNull(),
  /** Total SKC ever spent */
  totalSpentSKC: int("totalSpentSKC").default(0).notNull(),
  /** Total purchases made */
  totalPurchases: int("totalPurchases").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Auto-allocation settings for monthly token distribution.
 * Admin can enable/disable and set the amount.
 */
export const autoAllocationSettings = mysqlTable("autoAllocationSettings", {
  id: int("id").autoincrement().primaryKey(),
  /** Whether auto-allocation is enabled */
  isEnabled: int("isEnabled").default(0).notNull(),
  /** Amount of SKC to allocate per owner per month */
  amountSKC: int("amountSKC").default(50).notNull(),
  /** Whether manual allocation is also allowed */
  manualAllocationEnabled: int("manualAllocationEnabled").default(1).notNull(),
  /** Day of month to run auto-allocation (1-28) */
  dayOfMonth: int("dayOfMonth").default(1).notNull(),
  /** Last time auto-allocation was executed */
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Type exports for gamification tables
export type FarmAccount = typeof farmAccounts.$inferSelect;
export type InsertFarmAccount = typeof farmAccounts.$inferInsert;

export type FarmAccountTransaction = typeof farmAccountTransactions.$inferSelect;
export type InsertFarmAccountTransaction = typeof farmAccountTransactions.$inferInsert;

export type MarketplaceCategory = typeof marketplaceCategories.$inferSelect;
export type InsertMarketplaceCategory = typeof marketplaceCategories.$inferInsert;

export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type InsertMarketplaceItem = typeof marketplaceItems.$inferInsert;

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type InsertMarketplacePurchase = typeof marketplacePurchases.$inferInsert;

export type FarmerChecklist = typeof farmerChecklists.$inferSelect;
export type InsertFarmerChecklist = typeof farmerChecklists.$inferInsert;

export type AnimalFeedbackMessage = typeof animalFeedbackMessages.$inferSelect;
export type InsertAnimalFeedbackMessage = typeof animalFeedbackMessages.$inferInsert;

export type AnimalWellnessMetric = typeof animalWellnessMetrics.$inferSelect;
export type InsertAnimalWellnessMetric = typeof animalWellnessMetrics.$inferInsert;

export type OwnerRating = typeof ownerRatings.$inferSelect;
export type InsertOwnerRating = typeof ownerRatings.$inferInsert;

export type AutoAllocationSetting = typeof autoAllocationSettings.$inferSelect;
export type InsertAutoAllocationSetting = typeof autoAllocationSettings.$inferInsert;

/**
 * Daily snapshots of owner rating for history chart.
 * One row per owner per day, recording their totalScore at that point.
 */
export const ratingSnapshots = mysqlTable("ratingSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  /** The date this snapshot represents (YYYY-MM-DD stored as varchar for easy querying) */
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  averageAnimalRating: int("averageAnimalRating").default(0).notNull(),
  activityBonus: int("activityBonus").default(0).notNull(),
  rank: int("rank").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_ratingSnapshots_ownerOpenId").on(t.ownerOpenId),
  index("idx_ratingSnapshots_date").on(t.snapshotDate),
]));

export type RatingSnapshot = typeof ratingSnapshots.$inferSelect;
export type InsertRatingSnapshot = typeof ratingSnapshots.$inferInsert;


/**
 * Achievement badges awarded to owners for milestones and accomplishments.
 * Each badge is unique per owner per badgeType.
 */
export const achievementBadges = mysqlTable("achievementBadges", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  badgeType: varchar("badgeType", { length: 64 }).notNull(),
  /** Optional JSON metadata (e.g. month for best_rating_month, animalId for first_animal) */
  metadata: text("metadata"),
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_badges_ownerOpenId").on(t.ownerOpenId),
  index("idx_badges_type").on(t.badgeType),
]));
export type AchievementBadge = typeof achievementBadges.$inferSelect;
export type InsertAchievementBadge = typeof achievementBadges.$inferInsert;

/**
 * FAQ analytics — tracks every question asked to Masha AI assistant.
 * Used to identify popular topics and improve the knowledge base.
 */
export const faqQuestions = mysqlTable("faqQuestions", {
  id: int("id").autoincrement().primaryKey(),
  /** The user's question text */
  question: text("question").notNull(),
  /** Masha's response text */
  answer: text("answer").notNull(),
  /** Anonymous session identifier to group conversations */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Source page where the question was asked */
  source: varchar("source", { length: 32 }).default("faq").notNull(),
  /** Authenticated user openId (nullable — anonymous users can also ask) */
  userOpenId: varchar("userOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_faqQuestions_sessionId").on(t.sessionId),
  index("idx_faqQuestions_source").on(t.source),
  index("idx_faqQuestions_createdAt").on(t.createdAt),
  index("idx_faqQuestions_userOpenId").on(t.userOpenId),
]));
export type FaqQuestion = typeof faqQuestions.$inferSelect;
export type InsertFaqQuestion = typeof faqQuestions.$inferInsert;

/**
 * A/B testing — greeting variants for Masha chat.
 * Each variant has a unique key and greeting text.
 * Active variants are randomly assigned to new sessions.
 */
export const greetingVariants = mysqlTable("greetingVariants", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique variant key, e.g. "warm_v1", "formal_v2" */
  variantKey: varchar("variantKey", { length: 64 }).notNull().unique(),
  /** The greeting text Masha uses for this variant */
  greetingText: text("greetingText").notNull(),
  /** Short description for admin dashboard */
  description: varchar("description", { length: 255 }),
  /** Whether this variant is active in the rotation */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GreetingVariant = typeof greetingVariants.$inferSelect;
export type InsertGreetingVariant = typeof greetingVariants.$inferInsert;

/**
 * A/B testing — session assignments.
 * Tracks which greeting variant was shown to each session,
 * plus engagement metrics for that session.
 */
export const abTestSessions = mysqlTable("abTestSessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Chat session identifier (same as faqQuestions.sessionId) */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Assigned greeting variant key */
  variantKey: varchar("variantKey", { length: 64 }).notNull(),
  /** Source where the chat was opened */
  source: varchar("source", { length: 32 }).default("floating").notNull(),
  /** Whether the user responded after seeing the greeting */
  didRespond: boolean("didRespond").default(false).notNull(),
  /** Total number of messages in the conversation */
  messageCount: int("messageCount").default(0).notNull(),
  /** Conversation duration in seconds (from first to last message) */
  durationSeconds: int("durationSeconds").default(0).notNull(),
  /** Authenticated user openId (nullable) */
  userOpenId: varchar("userOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_abTestSessions_sessionId").on(t.sessionId),
  index("idx_abTestSessions_variantKey").on(t.variantKey),
  index("idx_abTestSessions_createdAt").on(t.createdAt),
]));
export type AbTestSession = typeof abTestSessions.$inferSelect;
export type InsertAbTestSession = typeof abTestSessions.$inferInsert;

/**
 * Uncertain answers log.
 * Stores questions where Masha was not confident in her answer,
 * allowing admins to review and enrich the knowledge base.
 */
export const uncertainAnswers = mysqlTable("uncertainAnswers", {
  id: int("id").autoincrement().primaryKey(),
  /** The user's question text */
  question: text("question").notNull(),
  /** Masha's uncertain response text */
  answer: text("answer").notNull(),
  /** Source page where the question was asked */
  source: varchar("source", { length: 32 }).default("faq").notNull(),
  /** Anonymous session identifier */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Whether the admin has reviewed and resolved this entry */
  resolved: boolean("resolved").default(false).notNull(),
  /** Admin note about how the issue was resolved */
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
}, (t) => ([
  index("idx_uncertainAnswers_resolved").on(t.resolved),
  index("idx_uncertainAnswers_createdAt").on(t.createdAt),
  index("idx_uncertainAnswers_sessionId").on(t.sessionId),
]));
export type UncertainAnswer = typeof uncertainAnswers.$inferSelect;
export type InsertUncertainAnswer = typeof uncertainAnswers.$inferInsert;


/* ─── CMS Content Blocks ─── */

export const cmsBlocks = mysqlTable("cmsBlocks", {
  id: int("id").autoincrement().primaryKey(),
  /** Page identifier: 'home', 'catalog', etc. */
  page: varchar("page", { length: 64 }).notNull(),
  /** Unique block key within the page, e.g. 'hero_title', 'steps' */
  blockKey: varchar("blockKey", { length: 128 }).notNull(),
  /** Human-readable label for the admin UI */
  label: varchar("label", { length: 255 }).notNull(),
  /** Content type: 'text' for simple strings, 'richtext' for multiline, 'image' for URLs, 'json' for arrays/objects */
  contentType: mysqlEnum("contentType", ["text", "richtext", "image", "json"]).notNull().default("text"),
  /** The actual content — plain text or JSON-serialized */
  content: text("content"),
  /** Image URL if contentType is 'image' */
  imageUrl: text("imageUrl"),
  /** Mobile-optimized image URL (800px wide WebP) — auto-generated on upload */
  mobileImageUrl: text("mobileImageUrl"),
  /** Section grouping for admin UI navigation */
  section: varchar("section", { length: 128 }),
  /** Focal point X coordinate (0-100, percentage from left). Default 50 = center */
  focalX: int("focalX").default(50).notNull(),
  /** Focal point Y coordinate (0-100, percentage from top). Default 50 = center */
  focalY: int("focalY").default(50).notNull(),
  /** Display order within section */
  sortOrder: int("sortOrder").default(0).notNull(),
  /** Whether this block is visible on the public site */
  visible: boolean("visible").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("cms_page_key_idx").on(table.page, table.blockKey),
]);

/**
 * CMS Block History — audit trail for content changes.
 * Records the previous state of a block before each modification,
 * enabling rollback to any previous version.
 */
export const cmsBlockHistory = mysqlTable("cmsBlockHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to the CMS block that was changed */
  blockId: int("blockId").notNull(),
  /** Page identifier (denormalized for query convenience) */
  page: varchar("page", { length: 64 }).notNull(),
  /** Block key (denormalized for query convenience) */
  blockKey: varchar("blockKey", { length: 128 }).notNull(),
  /** Type of change: 'update_content', 'upload_image', 'toggle_visibility', 'delete', 'rollback' */
  action: varchar("action", { length: 64 }).notNull(),
  /** Previous content value before the change (null if unchanged) */
  prevContent: text("prevContent"),
  /** Previous imageUrl value before the change (null if unchanged) */
  prevImageUrl: text("prevImageUrl"),
  /** Previous mobileImageUrl value before the change (null if unchanged) */
  prevMobileImageUrl: text("prevMobileImageUrl"),
  /** Previous visibility value before the change */
  prevVisible: boolean("prevVisible"),
  /** New content value after the change */
  newContent: text("newContent"),
  /** New imageUrl value after the change */
  newImageUrl: text("newImageUrl"),
  /** New mobileImageUrl value after the change */
  newMobileImageUrl: text("newMobileImageUrl"),
  /** New visibility value after the change */
  newVisible: boolean("newVisible"),
  /** OpenId of the admin who made the change */
  changedByOpenId: varchar("changedByOpenId", { length: 64 }).notNull(),
  /** Name of the admin who made the change */
  changedByName: varchar("changedByName", { length: 255 }),
  /** When the change was made */
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => [
  index("cms_history_blockId_idx").on(table.blockId),
  index("cms_history_page_idx").on(table.page),
  index("cms_history_changedAt_idx").on(table.changedAt),
]);


/** User-facing in-app notifications (photo moderation results, etc.) */
export const userNotifications = mysqlTable("userNotifications", {
  id: int("id").autoincrement().primaryKey(),
  /** Recipient user openId */
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  /** Notification type for filtering/grouping */
  type: varchar("type", { length: 64 }).notNull(),
  /** Short title shown in the notification list */
  title: varchar("title", { length: 512 }).notNull(),
  /** Longer body text with details */
  body: text("body"),
  /** Optional link to navigate to when notification is clicked */
  link: varchar("link", { length: 512 }),
  /** Whether the user has read this notification */
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notif_userOpenId_idx").on(table.userOpenId),
  index("notif_isRead_idx").on(table.isRead),
  index("notif_createdAt_idx").on(table.createdAt),
]);


/**
 * User notification preferences — controls which notification types a user wants to receive.
 * All types are enabled by default (true). Users can disable specific types.
 */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull().unique(),
  /** Receive notifications when photo is approved */
  photoApproved: boolean("photoApproved").default(true).notNull(),
  /** Receive notifications when photo is rejected */
  photoRejected: boolean("photoRejected").default(true).notNull(),
  /** Receive notifications about new club posts */
  clubPost: boolean("clubPost").default(true).notNull(),
  /** Receive notifications about new club events */
  clubEvent: boolean("clubEvent").default(true).notNull(),
  /** Receive notifications when milk composition is updated for your animal */
  compositionUpdate: boolean("compositionUpdate").default(true).notNull(),
  /** Receive notifications when monthly metrics (seasonal rhythm) are updated for your animal */
  metricsUpdate: boolean("metricsUpdate").default(true).notNull(),
  /** Receive notifications when delivery status changes (ready / delivered) */
  deliveryStatus: boolean("deliveryStatus").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;


/* ─── Site Analytics ─── */

/**
 * Site Visits — tracks every page view with device, referrer, UTM and session info.
 * Used for traffic analysis, conversion funnels, and device breakdown.
 */
export const siteVisits = mysqlTable("siteVisits", {
  id: int("id").autoincrement().primaryKey(),
  /** Anonymous visitor fingerprint (hashed IP + UA, no PII stored) */
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  /** Session identifier (generated per browser session via cookie) */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Authenticated user openId (null for anonymous visitors) */
  userOpenId: varchar("userOpenId", { length: 64 }),
  /** Page path visited, e.g. '/animals', '/tracker?animal=mira' */
  pagePath: varchar("pagePath", { length: 512 }).notNull(),
  /** Referrer URL (external source that brought the visitor) */
  referrer: varchar("referrer", { length: 1024 }),
  /** UTM source parameter */
  utmSource: varchar("utmSource", { length: 128 }),
  /** UTM medium parameter */
  utmMedium: varchar("utmMedium", { length: 128 }),
  /** UTM campaign parameter */
  utmCampaign: varchar("utmCampaign", { length: 256 }),
  /** Device type: 'desktop', 'tablet', 'mobile' */
  deviceType: varchar("deviceType", { length: 16 }),
  /** Browser name: 'Chrome', 'Safari', 'Firefox', etc. */
  browser: varchar("browser", { length: 64 }),
  /** Operating system: 'Windows', 'macOS', 'iOS', 'Android', etc. */
  os: varchar("os", { length: 64 }),
  /** Screen width in pixels */
  screenWidth: int("screenWidth"),
  /** Country code (ISO 3166-1 alpha-2, derived from IP if available) */
  country: varchar("country", { length: 8 }),
  /** City name (derived from IP via GeoIP service) */
  city: varchar("city", { length: 128 }),
  /** Region/state name (derived from IP via GeoIP service) */
  region: varchar("region", { length: 128 }),
  /** Latitude coordinate (derived from IP via GeoIP service) */
  latitude: double("latitude"),
  /** Longitude coordinate (derived from IP via GeoIP service) */
  longitude: double("longitude"),
  /** Time spent on page in seconds (updated on next navigation or unload) */
  timeOnPage: int("timeOnPage"),
  /** Whether this is the first visit in the session (entry page) */
  isEntry: boolean("isEntry").default(false).notNull(),
  /** Whether this is the last visit in the session (exit page) */
  isExit: boolean("isExit").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("sv_visitorId_idx").on(t.visitorId),
  index("sv_sessionId_idx").on(t.sessionId),
  index("sv_pagePath_idx").on(t.pagePath),
  index("sv_createdAt_idx").on(t.createdAt),
  index("sv_userOpenId_idx").on(t.userOpenId),
]);
export type SiteVisit = typeof siteVisits.$inferSelect;
export type InsertSiteVisit = typeof siteVisits.$inferInsert;

/**
 * Site Events — tracks specific user interactions (CTA clicks, form submissions, etc.).
 * Used for conversion tracking and engagement analysis.
 */
export const siteEvents = mysqlTable("siteEvents", {
  id: int("id").autoincrement().primaryKey(),
  /** Anonymous visitor fingerprint */
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  /** Session identifier */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Authenticated user openId (null for anonymous) */
  userOpenId: varchar("userOpenId", { length: 64 }),
  /** Event category: 'cta', 'navigation', 'engagement', 'conversion', 'error' */
  category: varchar("category", { length: 64 }).notNull(),
  /** Event action: 'click', 'submit', 'scroll', 'view', 'share' */
  action: varchar("action", { length: 64 }).notNull(),
  /** Event label for specifics: 'hero_cta', 'catalog_filter', 'animal_share_buy' */
  label: varchar("label", { length: 256 }),
  /** Numeric value associated with the event (e.g. scroll depth %) */
  value: int("value"),
  /** Page where the event occurred */
  pagePath: varchar("pagePath", { length: 512 }),
  /** Additional JSON metadata */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("se_visitorId_idx").on(t.visitorId),
  index("se_sessionId_idx").on(t.sessionId),
  index("se_category_idx").on(t.category),
  index("se_action_idx").on(t.action),
  index("se_createdAt_idx").on(t.createdAt),
]);
export type SiteEvent = typeof siteEvents.$inferSelect;
export type InsertSiteEvent = typeof siteEvents.$inferInsert;

/**
 * Page Performance Metrics — tracks page load times from Navigation Timing API.
 * Used for performance monitoring and slow page detection.
 */
export const pagePerformance = mysqlTable("pagePerformance", {
  id: int("id").autoincrement().primaryKey(),
  /** Anonymous visitor fingerprint */
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  /** Session identifier */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Authenticated user openId (null for anonymous) */
  userOpenId: varchar("userOpenId", { length: 64 }),
  /** Page path */
  pagePath: varchar("pagePath", { length: 512 }).notNull(),
  /** DNS lookup time (ms) */
  dnsMs: int("dnsMs"),
  /** TCP connection time (ms) */
  tcpMs: int("tcpMs"),
  /** TLS handshake time (ms) */
  tlsMs: int("tlsMs"),
  /** Time to first byte (ms) */
  ttfbMs: int("ttfbMs"),
  /** Content download time (ms) */
  downloadMs: int("downloadMs"),
  /** DOM interactive time (ms) — when HTML is parsed */
  domInteractiveMs: int("domInteractiveMs"),
  /** DOM content loaded time (ms) */
  domContentLoadedMs: int("domContentLoadedMs"),
  /** Full page load time (ms) — loadEventEnd */
  pageLoadMs: int("pageLoadMs"),
  /** First Contentful Paint (ms) */
  fcpMs: int("fcpMs"),
  /** Largest Contentful Paint (ms) */
  lcpMs: int("lcpMs"),
  /** First Input Delay (ms) */
  fidMs: int("fidMs"),
  /** Cumulative Layout Shift (x1000 for integer storage) */
  clsX1000: int("clsX1000"),
  /** Transfer size in bytes */
  transferSizeBytes: int("transferSizeBytes"),
  /** Number of resources loaded */
  resourceCount: int("resourceCount"),
  /** Device type: desktop, mobile, tablet */
  deviceType: varchar("deviceType", { length: 16 }),
  /** Connection effective type: 4g, 3g, 2g, slow-2g */
  connectionType: varchar("connectionType", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("pp_pagePath_idx").on(t.pagePath),
  index("pp_createdAt_idx").on(t.createdAt),
  index("pp_pageLoadMs_idx").on(t.pageLoadMs),
  index("pp_sessionId_idx").on(t.sessionId),
]);
export type PagePerformance = typeof pagePerformance.$inferSelect;
export type InsertPagePerformance = typeof pagePerformance.$inferInsert;

/**
 * Analytics Alerts — rules and history for anomaly detection.
 * Each rule defines a metric, threshold, and comparison method.
 * When triggered, a notification is sent to the owner.
 */
export const analyticsAlertRules = mysqlTable("analyticsAlertRules", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable name for the rule */
  name: varchar("name", { length: 256 }).notNull(),
  /** Metric to monitor: 'page_views', 'unique_visitors', 'sessions', 'bounce_rate', 'avg_time' */
  metric: varchar("metric", { length: 64 }).notNull(),
  /** Comparison operator: 'gt' (greater than), 'lt' (less than), 'change_pct_up', 'change_pct_down' */
  operator: varchar("operator", { length: 32 }).notNull(),
  /** Threshold value (absolute number or percentage depending on operator) */
  threshold: double("threshold").notNull(),
  /** Time window for comparison in hours (e.g. 24 = compare today vs yesterday) */
  windowHours: int("windowHours").default(24).notNull(),
  /** Whether this rule is currently active */
  enabled: boolean("enabled").default(true).notNull(),
  /** Admin openId who created the rule */
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AnalyticsAlertRule = typeof analyticsAlertRules.$inferSelect;
export type InsertAnalyticsAlertRule = typeof analyticsAlertRules.$inferInsert;

/**
 * Analytics Alert History — log of triggered alerts.
 */
export const analyticsAlertHistory = mysqlTable("analyticsAlertHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to the rule that triggered */
  ruleId: int("ruleId").notNull(),
  /** Rule name at time of trigger (denormalized for history) */
  ruleName: varchar("ruleName", { length: 256 }).notNull(),
  /** Metric that triggered */
  metric: varchar("metric", { length: 64 }).notNull(),
  /** Current value of the metric */
  currentValue: double("currentValue").notNull(),
  /** Previous/comparison value */
  previousValue: double("previousValue"),
  /** Change percentage (if applicable) */
  changePct: double("changePct"),
  /** Human-readable message describing the anomaly */
  message: text("message").notNull(),
  /** Whether notification was successfully sent */
  notified: boolean("notified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("aah_ruleId_idx").on(t.ruleId),
  index("aah_createdAt_idx").on(t.createdAt),
]);
export type AnalyticsAlertHistoryRow = typeof analyticsAlertHistory.$inferSelect;
export type InsertAnalyticsAlertHistory = typeof analyticsAlertHistory.$inferInsert;

/**
 * A/B Experiments — defines experiments with multiple variants.
 */
export const abExperiments = mysqlTable("abExperiments", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable experiment name */
  name: varchar("name", { length: 256 }).notNull(),
  /** Description of what is being tested */
  description: text("description"),
  /** Status: 'draft', 'running', 'paused', 'completed' */
  status: varchar("status", { length: 32 }).default("draft").notNull(),
  /** Target page path pattern (e.g. '/', '/animals', '/animals/*') */
  targetPage: varchar("targetPage", { length: 512 }).notNull(),
  /** Conversion goal event label (e.g. 'share_purchase', 'registration') */
  goalEvent: varchar("goalEvent", { length: 256 }).notNull(),
  /** Start date of the experiment */
  startDate: timestamp("startDate"),
  /** End date of the experiment */
  endDate: timestamp("endDate"),
  /** Admin openId who created */
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AbExperiment = typeof abExperiments.$inferSelect;
export type InsertAbExperiment = typeof abExperiments.$inferInsert;

/**
 * A/B Experiment Variants — each experiment has 2+ variants.
 */
export const abExperimentVariants = mysqlTable("abExperimentVariants", {
  id: int("id").autoincrement().primaryKey(),
  /** Parent experiment */
  experimentId: int("experimentId").notNull(),
  /** Variant key (e.g. 'control', 'variant_a', 'variant_b') */
  variantKey: varchar("variantKey", { length: 64 }).notNull(),
  /** Human-readable label */
  label: varchar("label", { length: 256 }).notNull(),
  /** Traffic weight (percentage, 0-100). All variants in an experiment should sum to 100. */
  weight: int("weight").default(50).notNull(),
  /** JSON configuration for this variant (e.g. different CTA text, color, layout) */
  config: text("config"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("aev_experimentId_idx").on(t.experimentId),
]);
export type AbExperimentVariant = typeof abExperimentVariants.$inferSelect;
export type InsertAbExperimentVariant = typeof abExperimentVariants.$inferInsert;

/**
 * A/B Experiment Assignments — tracks which visitor got which variant.
 */
export const abExperimentAssignments = mysqlTable("abExperimentAssignments", {
  id: int("id").autoincrement().primaryKey(),
  /** Parent experiment */
  experimentId: int("experimentId").notNull(),
  /** Assigned variant ID */
  variantId: int("variantId").notNull(),
  /** Visitor fingerprint */
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  /** Session ID */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Whether this visitor completed the conversion goal */
  converted: boolean("converted").default(false).notNull(),
  /** Timestamp of conversion (if any) */
  convertedAt: timestamp("convertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("aea_experimentId_idx").on(t.experimentId),
  index("aea_variantId_idx").on(t.variantId),
  index("aea_visitorId_idx").on(t.visitorId),
]);
export type AbExperimentAssignment = typeof abExperimentAssignments.$inferSelect;
export type InsertAbExperimentAssignment = typeof abExperimentAssignments.$inferInsert;


// ─── Pricing Section ─────────────────────────────────────────────────────────

export const tierSlugEnum = mysqlEnum("tierSlug", ["guest", "basic", "standard", "professional"]);

/**
 * Pricing tiers — admin-managed tariff plans displayed on the pricing pages.
 * Separate from the existing `plans` table which tracks active subscriptions.
 */
export const pricingTiers = mysqlTable("pricingTiers", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  /** Share percentage: 0 for guest, 50 for basic, 100 for standard/professional */
  sharePercent: int("sharePercent").notNull().default(0),
  /** Minimum number of animals required (1 for basic/standard, 3 for professional) */
  minAnimals: int("minAnimals").notNull().default(1),
  /** Monthly fee in kopecks (minor currency unit) */
  monthlyFeeMinor: int("monthlyFeeMinor").notNull().default(0),
  /** Annual subscription discount percent (e.g. 15) */
  annualDiscountPercent: int("annualDiscountPercent").notNull().default(0),
  /** Renewal discount percent (e.g. 20) */
  renewalDiscountPercent: int("renewalDiscountPercent").notNull().default(0),
  /** Package discount percent for 3+ animals (professional) */
  packageDiscountPercent: int("packageDiscountPercent").notNull().default(0),
  /** Product plan change frequency: quarterly, monthly, weekly */
  planChangeFrequency: mysqlEnum("planChangeFrequency", ["quarterly", "monthly", "weekly"]),
  /** Number of delivery addresses allowed */
  deliveryAddresses: int("deliveryAddresses").notNull().default(1),
  /** Whether personalized label is free (true) or paid add-on (false) */
  personalizedLabelFree: boolean("personalizedLabelFree").notNull().default(false),
  /** Whether aged cheese (6-24 months) is available */
  agedCheeseAccess: boolean("agedCheeseAccess").notNull().default(false),
  /** Maximum gift subscription months (0 = not available) */
  maxGiftSubscriptionMonths: int("maxGiftSubscriptionMonths").notNull().default(0),
  /** Farm visit quota per year (0 = not included) */
  farmVisitsPerYear: int("farmVisitsPerYear").notNull().default(0),
  /** Club events per year (0 = not included) */
  clubEventsPerYear: int("clubEventsPerYear").notNull().default(0),
  /** Shop discount percent */
  shopDiscountPercent: int("shopDiscountPercent").notNull().default(0),
  /** Referral bonus multiplier (e.g. 1, 2, 3, 5) */
  referralMultiplier: int("referralMultiplier").notNull().default(1),
  /** Whether personal manager is included */
  hasPersonalManager: boolean("hasPersonalManager").notNull().default(false),
  /** Whether digital diary is included */
  hasDigitalDiary: boolean("hasDigitalDiary").notNull().default(false),
  /** Badge system level: none, basic, extended, full */
  badgeSystemLevel: mysqlEnum("badgeSystemLevel", ["none", "basic", "extended", "full"]).default("none"),
  /** Display order on pricing pages */
  displayOrder: int("displayOrder").notNull().default(0),
  /** Whether this tier is currently active and visible */
  isActive: boolean("isActive").notNull().default(true),
  /** Hero description for the tier detail page (rich text / markdown) */
  heroDescription: text("heroDescription"),
  /** Target audience description */
  targetAudience: text("targetAudience"),
  /** JSON array of feature highlights for the tier card */
  featureHighlights: json("featureHighlights"),
  /** JSON array of limitations/restrictions */
  limitations: json("limitations"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("pt_slug_idx").on(t.slug),
  index("pt_active_idx").on(t.isActive),
]);
export type PricingTier = typeof pricingTiers.$inferSelect;
export type InsertPricingTier = typeof pricingTiers.$inferInsert;

/**
 * Market prices — reference prices for premium dairy products in Moscow.
 * Used by the calculator to compare Sher Kozu value vs market purchases.
 * Admin-managed via CMS.
 */
export const marketPrices = mysqlTable("marketPrices", {
  id: int("id").autoincrement().primaryKey(),
  /** Product name in Russian */
  productName: varchar("productName", { length: 255 }).notNull(),
  /** Product slug for programmatic access */
  productSlug: varchar("productSlug", { length: 64 }).notNull().unique(),
  /** Animal species this product applies to */
  species: mysqlEnum("mp_species", ["goat", "sheep"]).notNull(),
  /** Product category */
  category: mysqlEnum("mp_category", ["milk", "fermented", "soft_cheese", "semi_hard_cheese", "hard_cheese", "aged_cheese", "butter", "other"]).notNull(),
  /** Unit of measurement */
  unit: mysqlEnum("mp_unit", ["liter", "kg"]).notNull(),
  /** Minimum market price in kopecks per unit */
  minPriceMinor: int("minPriceMinor").notNull(),
  /** Maximum market price in kopecks per unit */
  maxPriceMinor: int("maxPriceMinor").notNull(),
  /** Average price used by calculator in kopecks per unit */
  avgPriceMinor: int("avgPriceMinor").notNull(),
  /** Price source description */
  source: varchar("source", { length: 255 }),
  /** Date when price was last verified */
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  /** Tier availability: all, standard_plus, professional_only */
  tierAvailability: mysqlEnum("mp_tierAvailability", ["all", "standard_plus", "professional_only"]).notNull().default("all"),
  /** Display order in calculator product list */
  displayOrder: int("displayOrder").notNull().default(0),
  /** Whether this product is active in the calculator */
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("mp_species_idx").on(t.species),
  index("mp_category_idx").on(t.category),
  index("mp_slug_idx").on(t.productSlug),
]);
export type MarketPrice = typeof marketPrices.$inferSelect;
export type InsertMarketPrice = typeof marketPrices.$inferInsert;

/**
 * Product conversion rates — how many liters of milk are needed to produce 1 unit of product.
 * Used by the calculator and product plan system.
 */
export const productConversions = mysqlTable("productConversions", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to market price product */
  marketPriceId: int("marketPriceId").notNull(),
  /** Liters of milk needed to produce 1 unit of this product */
  milkLitersPerUnit: double("milkLitersPerUnit").notNull(),
  /** Unit of the output product */
  outputUnit: mysqlEnum("pc_outputUnit", ["liter", "kg"]).notNull(),
  /** Notes about the conversion (e.g. "varies by fat content") */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("pc_mpId_idx").on(t.marketPriceId),
]);
export type ProductConversion = typeof productConversions.$inferSelect;
export type InsertProductConversion = typeof productConversions.$inferInsert;

/**
 * Calculator sessions — analytics tracking for calculator usage.
 */
export const calculatorSessions = mysqlTable("calculatorSessions", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID if logged in, null for anonymous */
  userId: int("userId"),
  /** Visitor fingerprint for anonymous tracking */
  visitorId: varchar("visitorId", { length: 64 }),
  /** Selected species */
  species: mysqlEnum("cs_species", ["goat", "sheep"]),
  /** Selected breed slug */
  breedSlug: varchar("breedSlug", { length: 64 }),
  /** Selected share percent */
  sharePercent: int("sharePercent"),
  /** Number of animals */
  animalCount: int("animalCount"),
  /** Determined tier slug */
  tierSlug: varchar("cs_tierSlug", { length: 32 }),
  /** Calculated annual cost in kopecks */
  annualCostMinor: int("annualCostMinor"),
  /** Calculated market value of products in kopecks */
  marketValueMinor: int("marketValueMinor"),
  /** Calculated savings percent */
  savingsPercent: int("savingsPercent"),
  /** JSON snapshot of product distribution */
  productDistribution: json("productDistribution"),
  /** Whether user clicked CTA after calculation */
  clickedCta: boolean("clickedCta").default(false),
  /** Which CTA was clicked */
  ctaType: varchar("ctaType", { length: 32 }),
  /** Referrer page */
  referrerPage: varchar("referrerPage", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("cs_userId_idx").on(t.userId),
  index("cs_tierSlug_idx").on(t.tierSlug),
  index("cs_createdAt_idx").on(t.createdAt),
]);
export type CalculatorSession = typeof calculatorSessions.$inferSelect;
export type InsertCalculatorSession = typeof calculatorSessions.$inferInsert;

/**
 * Pricing page views — analytics for the pricing section pages.
 */
export const pricingPageViews = mysqlTable("pricingPageViews", {
  id: int("id").autoincrement().primaryKey(),
  /** Page path (e.g. /pricing, /pricing/calculator) */
  pagePath: varchar("pagePath", { length: 128 }).notNull(),
  /** User ID if logged in */
  userId: int("userId"),
  /** Visitor fingerprint */
  visitorId: varchar("visitorId", { length: 64 }),
  /** Session ID */
  sessionId: varchar("sessionId", { length: 64 }),
  /** Time spent on page in seconds */
  timeOnPageSeconds: int("timeOnPageSeconds"),
  /** Scroll depth percentage (0-100) */
  scrollDepthPercent: int("scrollDepthPercent"),
  /** Referrer URL */
  referrer: varchar("referrer", { length: 512 }),
  /** UTM source */
  utmSource: varchar("utmSource", { length: 128 }),
  /** UTM medium */
  utmMedium: varchar("utmMedium", { length: 128 }),
  /** UTM campaign */
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("ppv_pagePath_idx").on(t.pagePath),
  index("ppv_createdAt_idx").on(t.createdAt),
  index("ppv_userId_idx").on(t.userId),
]);
export type PricingPageView = typeof pricingPageViews.$inferSelect;
export type InsertPricingPageView = typeof pricingPageViews.$inferInsert;

/* ───────────────────────────────────────────────
   Club Interactivity — Likes, Comments, Event Registrations
   ─────────────────────────────────────────────── */

/**
 * Per-user likes on club posts. One row per user-post pair.
 * The denormalized `likes` counter on clubPosts is updated on toggle.
 */
export const clubPostLikes = mysqlTable("clubPostLikes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_cpl_postId").on(t.postId),
  index("idx_cpl_userOpenId").on(t.userOpenId),
]));

/**
 * Comments on club posts. Authenticated users only.
 * The denormalized `comments` counter on clubPosts is updated on create/delete.
 */
export const clubPostComments = mysqlTable("clubPostComments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  userName: varchar("userName", { length: 160 }).notNull(),
  text: text("text").notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_cpc_postId").on(t.postId),
  index("idx_cpc_userOpenId").on(t.userOpenId),
]));

export const eventRegistrationStatusEnum = mysqlEnum("eventRegistrationStatus", [
  "registered",   // confirmed registration
  "waitlist",     // on waiting list
  "cancelled",    // user cancelled
  "rejected",     // admin rejected
]);

/**
 * Event registrations. Access policy:
 * - Active owners (animalOwnerships.status = 'active') → can register freely
 * - Pending owners (status = 'pending_payment') → waitlist
 * - Authenticated non-owners → depends on event status
 * - Unauthenticated → must log in first
 */
export const clubEventRegistrations = mysqlTable("clubEventRegistrations", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  userName: varchar("userName", { length: 160 }).notNull(),
  status: eventRegistrationStatusEnum.default("registered").notNull(),
  /** Admin note or rejection reason */
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_cer_eventId").on(t.eventId),
  index("idx_cer_userOpenId").on(t.userOpenId),
]));

/** Add maxCapacity and registrationCount to clubEvents for capacity tracking */

export type ClubPostLike = typeof clubPostLikes.$inferSelect;
export type InsertClubPostLike = typeof clubPostLikes.$inferInsert;

export type ClubPostComment = typeof clubPostComments.$inferSelect;
export type InsertClubPostComment = typeof clubPostComments.$inferInsert;

export type ClubEventRegistration = typeof clubEventRegistrations.$inferSelect;
export type InsertClubEventRegistration = typeof clubEventRegistrations.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// AI Nutritionist "Zoya" — Tables
// ═══════════════════════════════════════════════════════════════════

export const nutriUserTypeEnum = mysqlEnum("nutriUserType", ["guest", "registered", "owner"]);
export const nutriMessageRoleEnum = mysqlEnum("nutriMessageRole", ["user", "assistant", "system"]);
export const nutriSessionStatusEnum = mysqlEnum("nutriSessionStatus", ["active", "archived"]);
export const nutriKnowledgeCategoryEnum = mysqlEnum("nutriKnowledgeCategory", [
  "nutrition_science", "breed_profile", "product_info", "recipe", "health_goal", "general",
]);
export const nutriSourceTypeEnum = mysqlEnum("nutriSourceType", [
  "manual", "file_upload", "url_import", "auto_search",
]);
export const nutriConfidenceEnum = mysqlEnum("nutriConfidence", ["verified", "trusted", "unverified"]);
export const nutriKnowledgeStatusEnum = mysqlEnum("nutriKnowledgeStatus", [
  "active", "pending_review", "conflict", "archived",
]);
export const nutriImportStatusEnum = mysqlEnum("nutriImportStatus", [
  "processing", "awaiting_review", "approved", "partially_approved", "rejected",
]);
export const nutriSearchJobStatusEnum = mysqlEnum("nutriSearchJobStatus", [
  "running", "completed", "failed", "awaiting_review",
]);
export const nutriRecipeStatusEnum = mysqlEnum("nutriRecipeStatus", ["active", "draft", "archived"]);
export const nutriSeasonEnum = mysqlEnum("nutriSeason", ["all", "spring", "summer", "autumn", "winter"]);

/**
 * Zoya chat sessions — one per conversation thread.
 * Guests get a fingerprint-based session; authenticated users get userId.
 */
export const nutriSessions = mysqlTable("nutriSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userType: nutriUserTypeEnum.notNull(),
  guestFingerprint: varchar("guestFingerprint", { length: 128 }),
  goal: varchar("goal", { length: 255 }),
  status: nutriSessionStatusEnum.default("active").notNull(),
  messageCount: int("messageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_nutriSessions_userId").on(t.userId),
  index("idx_nutriSessions_guestFingerprint").on(t.guestFingerprint),
  index("idx_nutriSessions_createdAt").on(t.createdAt),
]));

/**
 * Individual messages within a Zoya chat session.
 */
export const nutriMessages = mysqlTable("nutriMessages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: nutriMessageRoleEnum.notNull(),
  content: text("content").notNull(),
  tokenCount: int("tokenCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_nutriMessages_sessionId").on(t.sessionId),
  index("idx_nutriMessages_createdAt").on(t.createdAt),
]));

/**
 * User nutrition profile — goals, allergies, restrictions, family members.
 * One per authenticated user.
 */
export const nutriProfiles = mysqlTable("nutriProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  goals: json("goals").$type<string[]>(),
  allergies: json("allergies").$type<string[]>(),
  restrictions: json("restrictions").$type<string[]>(),
  familyMembers: json("familyMembers").$type<Array<{ name: string; age?: number; notes?: string }>>(),
  preferredProducts: json("preferredProducts").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_nutriProfiles_userId").on(t.userId),
]));

/**
 * Saved meal plans generated by Zoya for a user.
 */
export const nutriMealPlans = mysqlTable("nutriMealPlans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),
  title: varchar("title", { length: 255 }).notNull(),
  goal: varchar("goal", { length: 255 }),
  planData: json("planData").$type<{
    days: Array<{
      day: string;
      meals: Array<{
        type: string;
        items: Array<{ name: string; amount: string; farmProduct?: boolean }>;
      }>;
    }>;
  }>(),
  animalId: int("animalId"),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_nutriMealPlans_userId").on(t.userId),
]));

/**
 * Unified knowledge base for Zoya — nutrition facts, breed profiles, product info, recipes, etc.
 */
export const nutriKnowledge = mysqlTable("nutriKnowledge", {
  id: int("id").autoincrement().primaryKey(),
  category: nutriKnowledgeCategoryEnum.notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  contentChunks: json("contentChunks").$type<string[]>(),
  sourceType: nutriSourceTypeEnum.default("manual").notNull(),
  sourceUrl: text("sourceUrl"),
  sourceName: varchar("sourceName", { length: 500 }),
  confidence: nutriConfidenceEnum.default("verified").notNull(),
  language: varchar("language", { length: 10 }).default("ru").notNull(),
  tags: json("tags").$type<string[]>(),
  status: nutriKnowledgeStatusEnum.default("active").notNull(),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_nutriKnowledge_category").on(t.category),
  index("idx_nutriKnowledge_status").on(t.status),
  index("idx_nutriKnowledge_confidence").on(t.confidence),
]));

/**
 * Import log for knowledge base — tracks file uploads, URL imports, and auto-search results.
 */
export const nutriKnowledgeImports = mysqlTable("nutriKnowledgeImports", {
  id: int("id").autoincrement().primaryKey(),
  sourceType: nutriSourceTypeEnum.notNull(),
  sourceUrl: text("sourceUrl"),
  fileName: varchar("fileName", { length: 500 }),
  fileKey: varchar("fileKey", { length: 500 }),
  factsExtracted: int("factsExtracted").default(0).notNull(),
  factsNew: int("factsNew").default(0).notNull(),
  factsConflict: int("factsConflict").default(0).notNull(),
  status: nutriImportStatusEnum.default("processing").notNull(),
  report: json("report").$type<{
    extractedFacts: Array<{
      title: string;
      content: string;
      category: string;
      isNew: boolean;
      conflictsWith?: number;
      conflictDetails?: string;
    }>;
    summary: string;
  }>(),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_nutriKnowledgeImports_status").on(t.status),
]));

/**
 * Auto-search jobs — triggered by "Find new knowledge" button or scheduled cron.
 */
export const nutriSearchJobs = mysqlTable("nutriSearchJobs", {
  id: int("id").autoincrement().primaryKey(),
  triggeredBy: int("triggeredBy"),
  queries: json("queries").$type<string[]>(),
  resultsFound: int("resultsFound").default(0).notNull(),
  factsProposed: int("factsProposed").default(0).notNull(),
  status: nutriSearchJobStatusEnum.default("running").notNull(),
  report: json("report").$type<{
    sources: Array<{
      url: string;
      title: string;
      relevanceScore: number;
      factsExtracted: number;
    }>;
    proposedFacts: Array<{
      title: string;
      content: string;
      category: string;
      source: string;
      conflictsWith?: number;
    }>;
    summary: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (t) => ([
  index("idx_nutriSearchJobs_status").on(t.status),
]));

/**
 * Recipes with farm products — curated by Zoya.
 */
export const nutriRecipes = mysqlTable("nutriRecipes", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  ingredients: json("ingredients").$type<Array<{ name: string; amount: string; farmProduct?: boolean }>>(),
  instructions: text("instructions"),
  goals: json("goals").$type<string[]>(),
  prepTimeMinutes: int("prepTimeMinutes"),
  season: nutriSeasonEnum.default("all").notNull(),
  productIds: json("productIds").$type<number[]>(),
  imageUrl: text("imageUrl"),
  status: nutriRecipeStatusEnum.default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_nutriRecipes_status").on(t.status),
]));

/**
 * Auto-search settings — single-row config table for knowledge auto-discovery.
 */
export const nutriSearchSettings = mysqlTable("nutriSearchSettings", {
  id: int("id").autoincrement().primaryKey(),
  autoSearchEnabled: boolean("autoSearchEnabled").default(false).notNull(),
  cronSchedule: varchar("cronSchedule", { length: 64 }).default("0 3 * * 1"),
  priorityTopics: json("priorityTopics").$type<string[]>(),
  trustedSources: json("trustedSources").$type<string[]>(),
  excludedSources: json("excludedSources").$type<string[]>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Zoya types ───
export type NutriSession = typeof nutriSessions.$inferSelect;
export type InsertNutriSession = typeof nutriSessions.$inferInsert;

export type NutriMessage = typeof nutriMessages.$inferSelect;
export type InsertNutriMessage = typeof nutriMessages.$inferInsert;

export type NutriProfile = typeof nutriProfiles.$inferSelect;
export type InsertNutriProfile = typeof nutriProfiles.$inferInsert;

export type NutriMealPlan = typeof nutriMealPlans.$inferSelect;
export type InsertNutriMealPlan = typeof nutriMealPlans.$inferInsert;

export type NutriKnowledgeEntry = typeof nutriKnowledge.$inferSelect;
export type InsertNutriKnowledgeEntry = typeof nutriKnowledge.$inferInsert;

export type NutriKnowledgeImport = typeof nutriKnowledgeImports.$inferSelect;
export type InsertNutriKnowledgeImport = typeof nutriKnowledgeImports.$inferInsert;

export type NutriSearchJob = typeof nutriSearchJobs.$inferSelect;
export type InsertNutriSearchJob = typeof nutriSearchJobs.$inferInsert;

export type NutriRecipe = typeof nutriRecipes.$inferSelect;
export type InsertNutriRecipe = typeof nutriRecipes.$inferInsert;

export type NutriSearchSettings = typeof nutriSearchSettings.$inferSelect;
export type InsertNutriSearchSettings = typeof nutriSearchSettings.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// Zoya Shared Content (for shareable links)
// ═══════════════════════════════════════════════════════════════════

export const zoyaSharedContent = mysqlTable("zoyaSharedContent", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique share token (UUID-based, URL-safe) */
  shareToken: varchar("shareToken", { length: 64 }).notNull().unique(),
  /** The AI response content (markdown) */
  content: text("content").notNull(),
  /** Title extracted or provided */
  title: varchar("title", { length: 500 }),
  /** The user's question that prompted the response */
  userQuestion: text("userQuestion"),
  /** User who created the share (null for guests) */
  userId: int("userId"),
  /** View count */
  viewCount: int("viewCount").default(0).notNull(),
  /** Created timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Expiry (optional, null = never expires) */
  expiresAt: timestamp("expiresAt"),
});

export type ZoyaSharedContent = typeof zoyaSharedContent.$inferSelect;
export type InsertZoyaSharedContent = typeof zoyaSharedContent.$inferInsert;


/* ─── Telegram Bot ─── */

export const telegramLinkTokens = mysqlTable("telegramLinkTokens", {
  id: int("id").autoincrement().primaryKey(),
  /** One-time token for linking Telegram account */
  token: varchar("token", { length: 64 }).notNull().unique(),
  /** User who generated the link */
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  /** When the token expires (15 minutes after creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  /** When the token was used (null = unused) */
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TelegramLinkToken = typeof telegramLinkTokens.$inferSelect;
export type InsertTelegramLinkToken = typeof telegramLinkTokens.$inferInsert;

export const telegramSessionStateEnum = mysqlEnum("telegramSessionState", ["idle", "chat_zoya", "chat_masha"]);

export const telegramSessions = mysqlTable("telegramSessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Telegram chat ID */
  chatId: varchar("chatId", { length: 20 }).notNull().unique(),
  /** Current conversation state */
  state: telegramSessionStateEnum.default("idle").notNull(),
  /** JSON context for the current conversation (message history, etc.) */
  contextJson: text("contextJson"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TelegramSession = typeof telegramSessions.$inferSelect;
export type InsertTelegramSession = typeof telegramSessions.$inferInsert;

/* ─── Product Plan Setup Requests ─── */
export const setupRequestStatusEnum = mysqlEnum("setupRequestStatus", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export const productPlanSetupRequests = mysqlTable("productPlanSetupRequests", {
  id: int("id").autoincrement().primaryKey(),
  /** Animal that needs product plan configuration */
  animalId: int("animalId").notNull(),
  /** Owner who requested the setup */
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  /** Bitrix24 task ID created for the manager */
  bitrixTaskId: varchar("bitrixTaskId", { length: 32 }),
  /** Current status of the setup request */
  status: setupRequestStatusEnum.default("pending").notNull(),
  /** When the manager completed the setup */
  completedAt: timestamp("completedAt"),
  /** Whether the owner was notified about completion */
  ownerNotified: boolean("ownerNotified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductPlanSetupRequest = typeof productPlanSetupRequests.$inferSelect;
export type InsertProductPlanSetupRequest = typeof productPlanSetupRequests.$inferInsert;


/* ═══════════════════════════════════════════════════════════════════
   Milk Turnover Control — АРМ Дояра / АРМ Сыродела
   Farm worker auth, milking sessions, milk reception,
   tank management, processing batches, audit log
   ═══════════════════════════════════════════════════════════════════ */

export const farmWorkerRoleEnum = mysqlEnum("farmWorkerRole", [
  "milker",       // Дояр
  "cheesemaker",  // Сыродел
  "controller",   // Контролёр
  "vet",          // Ветеринар (reserved)
  "manager",      // Менеджер (reserved)
]);

export const milkTypeEnum = mysqlEnum("milkType", ["goat", "sheep", "cow"]);
export const milkSessionShiftEnum = mysqlEnum("milkSessionShift", ["morning", "evening"]);
export const milkSessionStatusEnum = mysqlEnum("milkSessionStatus", [
  "in_progress",    // Дойка идёт
  "pending_confirm", // Ожидает подтверждения (72ч авто)
  "confirmed",       // Подтверждена
  "disputed",        // Оспорена
]);

export const milkReceptionStatusEnum = mysqlEnum("milkReceptionStatus", [
  "pending",    // Ожидает приёмки
  "accepted",   // Принято
  "rejected",   // Отклонено (качество)
]);

export const milkTankStatusEnum = mysqlEnum("milkTankStatus", [
  "empty",      // Пустой
  "filling",    // Заполняется
  "full",       // Полный
  "processing", // В переработке
  "cleaning",   // На мойке
]);

export const milkMovementTypeEnum = mysqlEnum("milkMovementType", [
  "milking_in",     // Поступление от дойки
  "transfer",       // Перелив между ёмкостями
  "processing_out", // Отправка в переработку
  "waste",          // Списание (утилизация)
  "sample",         // Отбор пробы
  "adjustment",     // Корректировка админом
]);

export const milkProcessingStatusEnum = mysqlEnum("milkProcessingStatus", [
  "planned",      // Запланирована
  "in_progress",  // В процессе
  "completed",    // Завершена
  "cancelled",    // Отменена
]);

export const milkAuditActionEnum = mysqlEnum("milkAuditAction", [
  "session_created",
  "session_updated",
  "session_cancelled",
  "session_confirmed",
  "session_disputed",
  "session_auto_confirmed",
  "reception_accepted",
  "reception_rejected",
  "tank_movement",
  "batch_started",
  "batch_completed",
  "worker_login",
  "worker_password_changed",
  "admin_edit",
  "admin_delete",
  "processing_session_created",
  "processing_session_updated",
  "processing_session_completed",
  "processing_session_cancelled",
  "processing_session_corrected",
  "warehouse_created",
  "warehouse_updated",
  "warehouse_movement",
]);

/**
 * Farm workers — separate auth from site users.
 * Workers log in via /farm with login + password.
 * Each worker has a role (milker, cheesemaker, etc.) and optional Telegram chatId.
 */
export const farmWorkers = mysqlTable("farmWorkers", {
  id: int("id").autoincrement().primaryKey(),
  /** Login identifier (e.g. "ivan", "petya") */
  login: varchar("login", { length: 64 }).notNull().unique(),
  /** Display name */
  name: varchar("name", { length: 160 }).notNull(),
  /** bcrypt hash of password */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: farmWorkerRoleEnum.notNull(),
  /** Phone number */
  phone: varchar("phone", { length: 32 }),
  /** Telegram chat ID for notifications (set via /myid bot command) */
  telegramChatId: varchar("telegramChatId", { length: 20 }),
  /** Whether the worker must change password on next login */
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  /** Whether the account is active */
  isActive: boolean("isActive").default(true).notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_farmWorkers_role").on(t.role),
  index("idx_farmWorkers_telegramChatId").on(t.telegramChatId),
]));

/**
 * Milking session — one per shift (morning/evening).
 * ID format: SK-DDMMYY-S where S = M(morning) or E(evening).
 * Contains total volume, head counts by species, and confirmation status.
 */
export const milkSessions = mysqlTable("milkSessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable session code: SK-DDMMYY-M or SK-DDMMYY-E */
  sessionCode: varchar("sessionCode", { length: 20 }).notNull().unique(),
  /** Worker who performed the milking */
  workerId: int("workerId").notNull(),
  /** Date of milking (YYYY-MM-DD) */
  milkingDate: varchar("milkingDate", { length: 10 }).notNull(),
  shift: milkSessionShiftEnum.notNull(),
  /** Goat milk volume in milliliters */
  goatVolumeMl: int("goatVolumeMl").default(0).notNull(),
  /** Number of goats milked */
  goatHeadCount: int("goatHeadCount").default(0).notNull(),
  /** Sheep milk volume in milliliters */
  sheepVolumeMl: int("sheepVolumeMl").default(0).notNull(),
  /** Number of sheep milked */
  sheepHeadCount: int("sheepHeadCount").default(0).notNull(),
  /** Cow milk volume in milliliters */
  cowVolumeMl: int("cowVolumeMl").default(0).notNull(),
  /** Number of cows milked */
  cowHeadCount: int("cowHeadCount").default(0).notNull(),
  /** Goat milk used for feeding young animals (ml) */
  goatFeedingMl: int("goatFeedingMl").default(0).notNull(),
  /** Goat milk losses (ml) */
  goatLossesMl: int("goatLossesMl").default(0).notNull(),
  /** Sheep milk used for feeding young animals (ml) */
  sheepFeedingMl: int("sheepFeedingMl").default(0).notNull(),
  /** Sheep milk losses (ml) */
  sheepLossesMl: int("sheepLossesMl").default(0).notNull(),
  /** Cow milk used for feeding young animals (ml) */
  cowFeedingMl: int("cowFeedingMl").default(0).notNull(),
  /** Cow milk losses (ml) */
  cowLossesMl: int("cowLossesMl").default(0).notNull(),
  /** Temperature at milking (°C × 10, e.g. 365 = 36.5°C) */
  temperatureTenths: int("temperatureTenths"),
  /** Density reading (g/cm³ × 1000, e.g. 1030 = 1.030 g/cm³) */
  densityThousandths: int("densityThousandths"),
  /** Worker's note about the session */
  note: text("note"),
  status: milkSessionStatusEnum.default("in_progress").notNull(),
  /** When auto-confirmation should trigger (created_at + 72h) */
  autoConfirmAt: timestamp("autoConfirmAt"),
  /** Who confirmed (admin openId or 'auto') */
  confirmedBy: varchar("confirmedBy", { length: 64 }),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_milkSessions_workerId").on(t.workerId),
  index("idx_milkSessions_milkingDate").on(t.milkingDate),
  index("idx_milkSessions_status").on(t.status),
  index("idx_milkSessions_autoConfirmAt").on(t.autoConfirmAt),
]));

/**
 * Per-animal breakdown within a milking session.
 * Optional — allows tracking individual animal yields.
 */
export const milkSessionAnimals = mysqlTable("milkSessionAnimals", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  animalId: int("animalId").notNull(),
  /** Volume from this animal in milliliters */
  volumeMl: int("volumeMl").notNull(),
  /** Any note about this specific animal */
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_milkSessionAnimals_sessionId").on(t.sessionId),
  index("idx_milkSessionAnimals_animalId").on(t.animalId),
]));

/**
 * Milk reception — cheesemaker accepts/rejects milk from a session.
 * Quality gate between milking and processing.
 */
export const milkReceptions = mysqlTable("milkReceptions", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to milking session */
  sessionId: int("sessionId").notNull(),
  /** Type of milk being received */
  milkType: milkTypeEnum.notNull(),
  /** Cheesemaker who performed the reception */
  receivedByWorkerId: int("receivedByWorkerId").notNull(),
  /** Accepted volume in milliliters (may differ from session total for this type) */
  acceptedVolumeMl: int("acceptedVolumeMl").notNull(),
  /** Rejected volume in milliliters */
  rejectedVolumeMl: int("rejectedVolumeMl").default(0).notNull(),
  /** Temperature at reception (°C × 10) */
  temperatureTenths: int("temperatureTenths"),
  /** Density at reception (g/cm³ × 1000) */
  densityThousandths: int("densityThousandths"),
  /** Fat content (% × 10, e.g. 45 = 4.5%) */
  fatPercentTenths: int("fatPercentTenths"),
  /** Acidity (°T — Turner degrees) */
  acidityTurner: int("acidityTurner"),
  status: milkReceptionStatusEnum.default("pending").notNull(),
  /** Rejection reason if status = rejected */
  rejectionReason: text("rejectionReason"),
  /** Target tank for accepted milk */
  targetTankId: int("targetTankId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_milkReceptions_sessionId").on(t.sessionId),
  index("idx_milkReceptions_receivedByWorkerId").on(t.receivedByWorkerId),
  index("idx_milkReceptions_status").on(t.status),
]));

/**
 * Milk tanks / containers — physical storage vessels.
 * Tracks current volume, capacity, and status.
 */
export const milkTanks = mysqlTable("milkTanks", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable name, e.g. "Танк-1 (козье)", "Ведро утро" */
  name: varchar("name", { length: 120 }).notNull(),
  /** Type of milk stored in this tank */
  milkType: milkTypeEnum.notNull(),
  /** Capacity in milliliters */
  capacityMl: int("capacityMl").notNull(),
  /** Current volume in milliliters */
  currentVolumeMl: int("currentVolumeMl").default(0).notNull(),
  status: milkTankStatusEnum.default("empty").notNull(),
  /** Location description, e.g. "Молочная", "Сыроварня" */
  location: varchar("location", { length: 120 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_milkTanks_milkType").on(t.milkType),
]));

/**
 * Milk tank movements — every volume change is logged.
 * Provides full traceability from udder to processing.
 */
export const milkTankMovements = mysqlTable("milkTankMovements", {
  id: int("id").autoincrement().primaryKey(),
  /** Tank affected */
  tankId: int("tankId").notNull(),
  movementType: milkMovementTypeEnum.notNull(),
  /** Volume change in milliliters (positive = in, negative = out) */
  volumeMl: int("volumeMl").notNull(),
  /** Tank volume after this movement */
  tankVolumeAfterMl: int("tankVolumeAfterMl").notNull(),
  /** Reference to milking session (for milking_in) */
  sessionId: int("sessionId"),
  /** Reference to reception (for milking_in after acceptance) */
  receptionId: int("receptionId"),
  /** Reference to processing batch (for processing_out) */
  batchId: int("batchId"),
  /** Reference to target tank (for transfers) */
  targetTankId: int("targetTankId"),
  /** Worker who performed the movement */
  performedByWorkerId: int("performedByWorkerId").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_milkTankMovements_tankId").on(t.tankId),
  index("idx_milkTankMovements_sessionId").on(t.sessionId),
  index("idx_milkTankMovements_batchId").on(t.batchId),
]));

/**
 * Milk processing batches — cheese, yogurt, etc.
 * Links to source tank and tracks input/output volumes.
 */
export const milkProcessingBatches = mysqlTable("milkProcessingBatches", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable batch code, e.g. "B-210426-01" */
  batchCode: varchar("batchCode", { length: 32 }).notNull().unique(),
  /** Product being made */
  productType: productTypeEnum.notNull(),
  /** Custom product label */
  productLabel: varchar("productLabel", { length: 160 }),
  /** Source tank */
  sourceTankId: int("sourceTankId").notNull(),
  /** Milk volume used in milliliters */
  inputVolumeMl: int("inputVolumeMl").notNull(),
  /** Output weight in grams (for solid products) or volume in ml (for liquid) */
  outputQuantity: int("outputQuantity"),
  /** Output unit: "г", "кг", "мл", "л" */
  outputUnit: varchar("outputUnit", { length: 8 }),
  /** Worker who started the batch */
  startedByWorkerId: int("startedByWorkerId").notNull(),
  /** Worker who completed the batch */
  completedByWorkerId: int("completedByWorkerId"),
  status: milkProcessingStatusEnum.default("planned").notNull(),
  /** Planned start time */
  plannedAt: timestamp("plannedAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_milkProcessingBatches_sourceTankId").on(t.sourceTankId),
  index("idx_milkProcessingBatches_status").on(t.status),
  index("idx_milkProcessingBatches_productType").on(t.productType),
]));

/**
 * Audit log for all milk module operations.
 * Immutable append-only trail for compliance and dispute resolution.
 */
export const milkAuditLog = mysqlTable("milkAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  action: milkAuditActionEnum.notNull(),
  /** Farm worker who performed the action */
  workerId: int("workerId"),
  /** Admin openId if action was performed by admin */
  adminOpenId: varchar("adminOpenId", { length: 64 }),
  /** Reference to the entity (session, reception, tank, batch) */
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: int("entityId").notNull(),
  /** JSON snapshot of the change (before/after or key details) */
  detailsJson: text("detailsJson"),
  /** IP address of the request */
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_milkAuditLog_action").on(t.action),
  index("idx_milkAuditLog_workerId").on(t.workerId),
  index("idx_milkAuditLog_entityType").on(t.entityType),
  index("idx_milkAuditLog_createdAt").on(t.createdAt),
]));

/* ─── Processing System (Переработка) ─── */

export const processingSessionStatusEnum = mysqlEnum("processingSessionStatus", [
  "draft",         // Черновик — можно свободно редактировать
  "in_progress",   // В процессе
  "completed",     // Завершена — танки списаны, склад пополнен
  "cancelled",     // Отменена
]);

export const warehouseMovementTypeEnum = mysqlEnum("warehouseMovementType", [
  "in",           // Поступление (из переработки)
  "out",          // Выдача / отгрузка
  "writeoff",     // Списание
  "adjustment",   // Корректировка
]);

/**
 * Warehouses — admin-managed storage locations for finished products.
 * E.g. "Сыроварня — холодильник", "Склад готовой продукции".
 */
export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Processing sessions — one session per cheesemaker shift.
 * Session code format: CH-дд.мм.гггг (with -02 suffix for multiple per day).
 * Multi-tank input, multi-product output.
 */
export const processingSessions = mysqlTable("processingSessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable session code: CH-01.05.2026, CH-01.05.2026-02, etc. */
  sessionCode: varchar("sessionCode", { length: 32 }).notNull().unique(),
  /** Date of processing (YYYY-MM-DD) — can be set retroactively */
  shiftDate: varchar("shiftDate", { length: 10 }).notNull(),
  status: processingSessionStatusEnum.default("draft").notNull(),
  /** Cheesemaker who started the session */
  startedByWorkerId: int("startedByWorkerId").notNull(),
  /** Total input volume in ml (sum of all processingInputs) */
  totalInputMl: int("totalInputMl").default(0).notNull(),
  note: text("note"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_processingSessions_shiftDate").on(t.shiftDate),
  index("idx_processingSessions_status").on(t.status),
  index("idx_processingSessions_startedByWorkerId").on(t.startedByWorkerId),
]));

/**
 * Processing inputs — milk taken from tanks for a processing session.
 * Junction table: one session can draw from multiple tanks.
 */
export const processingInputs = mysqlTable("processingInputs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  tankId: int("tankId").notNull(),
  /** Volume taken from this tank in milliliters */
  volumeMl: int("volumeMl").notNull(),
  /** Type of milk from this tank */
  milkType: milkTypeEnum.notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_processingInputs_sessionId").on(t.sessionId),
  index("idx_processingInputs_tankId").on(t.tankId),
]));

/**
 * Processing outputs — products created in a processing session.
 * One session can produce multiple products.
 * Tracks actual conversion ratio vs base from tierProductCatalog.
 */
export const processingOutputs = mysqlTable("processingOutputs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  /** Reference to tierProductCatalog item */
  catalogItemId: int("catalogItemId").notNull(),
  /** Human-readable product label (snapshot from catalog at time of creation) */
  productLabel: varchar("productLabel", { length: 160 }).notNull(),
  /** Quantity produced */
  quantity: double("quantity").notNull(),
  /** Unit of measurement: "л", "кг", "шт" */
  unit: varchar("unit", { length: 16 }).notNull(),
  /** Target warehouse for this product */
  warehouseId: int("warehouseId").notNull(),
  /** Actual conversion ratio: input_ml / (quantity * 1000) for this product */
  actualConversionRatio: double("actualConversionRatio"),
  /** Base conversion ratio from tierProductCatalog at time of session */
  baseConversionRatio: double("baseConversionRatio"),
  /** Deviation percentage: ((actual - base) / base) * 100 */
  deviationPercent: double("deviationPercent"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_processingOutputs_sessionId").on(t.sessionId),
  index("idx_processingOutputs_catalogItemId").on(t.catalogItemId),
  index("idx_processingOutputs_warehouseId").on(t.warehouseId),
]));

/**
 * Warehouse inventory — current stock levels per product per warehouse.
 * Updated on every warehouse movement.
 */
export const warehouseInventory = mysqlTable("warehouseInventory", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  /** Reference to tierProductCatalog item */
  catalogItemId: int("catalogItemId").notNull(),
  /** Human-readable product label */
  productLabel: varchar("productLabel", { length: 160 }).notNull(),
  /** Current quantity in stock */
  quantity: double("quantity").default(0).notNull(),
  /** Unit of measurement */
  unit: varchar("unit", { length: 16 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_warehouseInventory_warehouseId").on(t.warehouseId),
  index("idx_warehouseInventory_catalogItemId").on(t.catalogItemId),
]));

/**
 * Warehouse movements — journal of all inventory changes.
 * Full audit trail for warehouse operations.
 */
export const warehouseMovements = mysqlTable("warehouseMovements", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  movementType: warehouseMovementTypeEnum.notNull(),
  /** Reference to tierProductCatalog item */
  catalogItemId: int("catalogItemId").notNull(),
  /** Human-readable product label */
  productLabel: varchar("productLabel", { length: 160 }).notNull(),
  /** Quantity moved (positive for in, negative for out/writeoff) */
  quantity: double("quantity").notNull(),
  /** Unit of measurement */
  unit: varchar("unit", { length: 16 }).notNull(),
  /** Reference to processing session (for 'in' movements from processing) */
  processingSessionId: int("processingSessionId"),
  /** Worker who performed the movement */
  performedByWorkerId: int("performedByWorkerId").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ([
  index("idx_warehouseMovements_warehouseId").on(t.warehouseId),
  index("idx_warehouseMovements_catalogItemId").on(t.catalogItemId),
  index("idx_warehouseMovements_processingSessionId").on(t.processingSessionId),
  index("idx_warehouseMovements_performedByWorkerId").on(t.performedByWorkerId),
]));

// ─── Type exports for Milk Turnover Control ───

export type FarmWorker = typeof farmWorkers.$inferSelect;
export type InsertFarmWorker = typeof farmWorkers.$inferInsert;

export type MilkSession = typeof milkSessions.$inferSelect;
export type InsertMilkSession = typeof milkSessions.$inferInsert;

export type MilkSessionAnimal = typeof milkSessionAnimals.$inferSelect;
export type InsertMilkSessionAnimal = typeof milkSessionAnimals.$inferInsert;

export type MilkReception = typeof milkReceptions.$inferSelect;
export type InsertMilkReception = typeof milkReceptions.$inferInsert;

export type MilkTank = typeof milkTanks.$inferSelect;
export type InsertMilkTank = typeof milkTanks.$inferInsert;

export type MilkTankMovement = typeof milkTankMovements.$inferSelect;
export type InsertMilkTankMovement = typeof milkTankMovements.$inferInsert;

export type MilkProcessingBatch = typeof milkProcessingBatches.$inferSelect;
export type InsertMilkProcessingBatch = typeof milkProcessingBatches.$inferInsert;

export type MilkAuditLogEntry = typeof milkAuditLog.$inferSelect;
export type InsertMilkAuditLogEntry = typeof milkAuditLog.$inferInsert;

// ─── Type exports for Processing System ───

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = typeof warehouses.$inferInsert;

export type ProcessingSession = typeof processingSessions.$inferSelect;
export type InsertProcessingSession = typeof processingSessions.$inferInsert;

export type ProcessingInput = typeof processingInputs.$inferSelect;
export type InsertProcessingInput = typeof processingInputs.$inferInsert;

export type ProcessingOutput = typeof processingOutputs.$inferSelect;
export type InsertProcessingOutput = typeof processingOutputs.$inferInsert;

export type WarehouseInventoryItem = typeof warehouseInventory.$inferSelect;
export type InsertWarehouseInventoryItem = typeof warehouseInventory.$inferInsert;

export type WarehouseMovement = typeof warehouseMovements.$inferSelect;
export type InsertWarehouseMovement = typeof warehouseMovements.$inferInsert;
