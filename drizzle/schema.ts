import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  plainPassword: varchar("plainPassword", { length: 255 }),
  bitrix24ContactId: varchar("bitrix24ContactId", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
});

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
});

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
});

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
});

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
});

export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  familyId: int("familyId").notNull(),
  status: walletStatusEnum.default("active").notNull(),
  balanceMinor: int("balanceMinor").default(0).notNull(),
  currencyCode: varchar("currencyCode", { length: 12 }).default("SKC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
});

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
});

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
});

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
});

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
});

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
