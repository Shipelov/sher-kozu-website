import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
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
