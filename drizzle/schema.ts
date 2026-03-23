import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
export const ownershipStatusEnum = mysqlEnum("ownershipStatus", ["pending_payment", "active", "expired", "cancelled"]);
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
  totalOwnershipSlots: int("totalOwnershipSlots").default(3).notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_animalPhotos_animalSlug").on(t.animalSlug),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ([
  index("idx_clubPosts_ownerOpenId").on(t.ownerOpenId),
  index("idx_clubPosts_category").on(t.category),
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

export const productTypeEnum = mysqlEnum("productType", ["milk", "smetana", "yogurt", "kefir", "cheese"]);
export const ownerProductPlanStatusEnum = mysqlEnum("ownerProductPlanStatus", ["draft", "pending_approval", "confirmed", "modified_by_admin"]);
export const planChangeActionEnum = mysqlEnum("planChangeAction", ["created", "submitted", "approved", "modified", "reset"]);
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
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Owner's chosen product plan for a specific animal ownership.
 * Created when owner first selects products. After confirmation,
 * changes only through admin (status → modified_by_admin).
 */
export const ownerProductPlans = mysqlTable("ownerProductPlans", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  animalId: int("animalId").notNull(),
  ownershipId: int("ownershipId").notNull(),
  status: ownerProductPlanStatusEnum.default("draft").notNull(),
  /** JSON array of selections: [{productOptionId, annualUnits}] */
  selectionsJson: text("selectionsJson").notNull(),
  /** Total milk liters consumed by this plan */
  totalMilkUsed: int("totalMilkUsed").default(0).notNull(),
  /** Admin notes when modifying */
  adminNotes: text("adminNotes"),
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
