#!/usr/bin/env node
/**
 * Очистка мусора, который накапливают тестовые прогоны в тестовой базе TiDB.
 *
 * Удаляет только строки с распознаваемыми тестовыми маркерами (email вида
 * *@test.sherkozu.ru, openId с префиксами buyer-/e2e-/test-/bell-, заголовки
 * «E2E …», «Test Experiment …» и т.п.) и только старше TEST_DB_CLEANUP_MAX_AGE_HOURS
 * (по умолчанию 24 ч). Seed-данные из scripts/seed-test-db.mjs (ci-farm-owner,
 * marta/ci-lola/ci-rufa, ci-core-care, тарифы, база знаний Зои) не трогает.
 *
 * Защита от запуска на проде:
 *   - адрес берётся ТОЛЬКО из TEST_DATABASE_URL (DATABASE_URL игнорируется);
 *   - имя базы в URL обязано быть `test`;
 *   - нужна переменная ALLOW_TEST_DB_CLEANUP=1 (её задаёт только CI).
 *
 * Запуск: pnpm db:cleanup-test [--dry-run]
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const dryRun = process.argv.includes("--dry-run");
const MAX_AGE_HOURS = Number(process.env.TEST_DB_CLEANUP_MAX_AGE_HOURS ?? 24);
const BATCH = 5000;

const SEED_OWNER_OPEN_ID = process.env.OWNER_OPEN_ID?.trim() || "ci-farm-owner";
const SEED_EMAIL_DOMAIN = "@ci.koza.test";
const SEED_ANIMAL_SLUGS = ["marta", "ci-lola", "ci-rufa"];

// Маркеры собраны по server/**/*.test.ts — см. описание в PR
const OPEN_ID_PREFIXES = [
  "buyer-", "mkt-buyer-", "mkt-admin-", "ownership-buyer-", "e2e-", "test-", "bell-",
  "zoya-profile-test-", "update-pref-user-", "scope-user-", "club-test-user-",
];
const OPEN_ID_EXACT = ["new-user-prefs-test", "user-pref-1"];
const EMAIL_DOMAINS = ["@test.sherkozu.ru", "@example.com"];
const VISITOR_PREFIXES = ["test-visitor-", "perf-visitor-", "e2e-visitor-"];
const VISITOR_EXACT = ["test-visitor-123", "sticky-visitor", "conv-visitor"];
const SESSION_PREFIXES = ["test-session-", "perf-session-", "e2e-session-", "e2e-faq-"];
const CLUB_TITLE_MARKERS = ["E2E %", "%Тестовый пост для уведомлений%", "%Тестовое событие для уведомлений%"];
const NOTIFICATION_BODY_MARKERS = ["%E2E Тестов%", "%Тестовый пост для уведомлений%", "%Тестовое событие для уведомлений%"];
const NUTRI_TEMP_TITLES = [
  "Временная тестовая запись от админа", "Запись для обновления",
  "Временно обновлённая запись", "Запись для удаления",
];

function fail(message) {
  console.error(`[cleanup-test-db] ${message}`);
  process.exit(2);
}

function parseTargetUrl() {
  const raw = process.env.TEST_DATABASE_URL?.trim();
  if (!raw) fail("Не задан TEST_DATABASE_URL (DATABASE_URL намеренно не используется)");
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("TEST_DATABASE_URL не разбирается как URL");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (database !== "test") {
    fail(`Отказ: имя базы должно быть "test", получено "${database || "(пусто)"}"`);
  }
  if (process.env.ALLOW_TEST_DB_CLEANUP !== "1") {
    fail("Отказ: требуется ALLOW_TEST_DB_CLEANUP=1 (задаёт CI)");
  }
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ...(isLocal ? {} : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false } }),
  };
}

const q = (name) => "`" + name + "`";

/** (col LIKE ? OR col LIKE ? …) */
function likeAny(col, patterns) {
  return {
    sql: `(${patterns.map(() => `${q(col)} LIKE ?`).join(" OR ")})`,
    params: [...patterns],
  };
}
const prefixes = (col, list) => likeAny(col, list.map((p) => `${p}%`));
const suffixes = (col, list) => likeAny(col, list.map((s) => `%${s}`));
function inList(col, values) {
  return { sql: `${q(col)} IN (${values.map(() => "?").join(", ")})`, params: [...values] };
}
function older(col) {
  return { sql: `${q(col)} < NOW() - INTERVAL ? HOUR`, params: [MAX_AGE_HOURS] };
}
function or(...parts) {
  return { sql: `(${parts.map((p) => p.sql).join(" OR ")})`, params: parts.flatMap((p) => p.params) };
}
function and(...parts) {
  return { sql: parts.map((p) => p.sql).join(" AND "), params: parts.flatMap((p) => p.params) };
}
function inSubquery(col, table, idCol, where) {
  return { sql: `${q(col)} IN (SELECT ${q(idCol)} FROM ${q(table)} WHERE ${where.sql})`, params: [...where.params] };
}

const testOpenId = (col) => or(prefixes(col, OPEN_ID_PREFIXES), inList(col, OPEN_ID_EXACT));

// Условия для родительских таблиц — переиспользуются в подзапросах детей
const testUsersWhere = and(
  or(suffixes("email", EMAIL_DOMAINS), testOpenId("openId")),
  older("createdAt"),
  { sql: `${q("openId")} <> ?`, params: [SEED_OWNER_OPEN_ID] },
  { sql: `(${q("email")} IS NULL OR ${q("email")} NOT LIKE ?)`, params: [`%${SEED_EMAIL_DOMAIN}`] },
);
const testAnimalsWhere = and(
  testOpenId("ownerOpenId"),
  { sql: `${q("slug")} NOT IN (${SEED_ANIMAL_SLUGS.map(() => "?").join(", ")})`, params: SEED_ANIMAL_SLUGS },
  older("createdAt"),
);
const testPostsWhere = and(likeAny("title", CLUB_TITLE_MARKERS), older("createdAt"));
const testEventsWhere = and(likeAny("title", CLUB_TITLE_MARKERS), older("createdAt"));
const testAlertRulesWhere = and(likeAny("name", ["Test Alert%", "E2E Alert%"]), older("createdAt"));
const testExperimentsWhere = and(likeAny("name", ["Test Experiment%"]), older("createdAt"));
const testWarehousesWhere = and(likeAny("name", ["Test Warehouse %"]), older("createdAt"));
const testLeadsWhere = and(or(likeAny("fullName", ["E2E %"]), likeAny("companyName", ["E2E %"])), older("createdAt"));
const testVisitor = (visitorCol, sessionCol) =>
  or(prefixes(visitorCol, VISITOR_PREFIXES), inList(visitorCol, VISITOR_EXACT), prefixes(sessionCol, SESSION_PREFIXES));

// Порядок: сначала дочерние строки, потом родительские. Внешних ключей в схеме
// нет, порядок нужен только чтобы не оставлять сирот.
const steps = [
  ["userNotifications", and(or(testOpenId("userOpenId"), likeAny("body", NOTIFICATION_BODY_MARKERS)), older("createdAt"))],
  ["notificationPreferences", and(testOpenId("userOpenId"), older("updatedAt"))],
  ["otpCodes", and(suffixes("target", EMAIL_DOMAINS), older("createdAt"))],

  ["clubPostLikes", or(inSubquery("postId", "clubPosts", "id", testPostsWhere), testOpenId("userOpenId"))],
  ["clubPostComments", or(inSubquery("postId", "clubPosts", "id", testPostsWhere), testOpenId("userOpenId"))],
  ["clubPosts", testPostsWhere],
  ["clubEventRegistrations", or(inSubquery("eventId", "clubEvents", "id", testEventsWhere), testOpenId("userOpenId"))],
  ["clubEvents", testEventsWhere],

  ["analyticsAlertHistory", inSubquery("ruleId", "analyticsAlertRules", "id", testAlertRulesWhere)],
  ["analyticsAlertRules", testAlertRulesWhere],
  ["abExperimentAssignments", and(or(inSubquery("experimentId", "abExperiments", "id", testExperimentsWhere), inList("visitorId", VISITOR_EXACT)), older("createdAt"))],
  ["abExperimentVariants", inSubquery("experimentId", "abExperiments", "id", testExperimentsWhere)],
  ["abExperiments", testExperimentsWhere],

  ["siteEvents", and(testVisitor("visitorId", "sessionId"), older("createdAt"))],
  ["siteVisits", and(testVisitor("visitorId", "sessionId"), older("createdAt"))],
  ["pagePerformance", and(prefixes("visitorId", VISITOR_PREFIXES), older("createdAt"))],
  ["pricingPageViews", and(prefixes("sessionId", SESSION_PREFIXES), older("createdAt"))],
  ["abTestSessions", and(prefixes("sessionId", SESSION_PREFIXES), older("createdAt"))],

  ["warehouseInventory", inSubquery("warehouseId", "warehouses", "id", testWarehousesWhere)],
  ["warehouseMovements", inSubquery("warehouseId", "warehouses", "id", testWarehousesWhere)],
  ["processingOutputs", inSubquery("warehouseId", "warehouses", "id", testWarehousesWhere)],
  ["warehouses", testWarehousesWhere],

  ["nutriKnowledge", and(inList("title", NUTRI_TEMP_TITLES), older("createdAt"))],

  ["integrationAudits", and({ sql: `${q("entityType")} = 'partnerLead'`, params: [] }, inSubquery("entityId", "partnerLeads", "id", testLeadsWhere))],
  ["partnerLeads", testLeadsWhere],

  ["animalMedia", inSubquery("animalId", "animals", "id", testAnimalsWhere)],
  ["animalPhotos", and(testOpenId("ownerOpenId"), older("createdAt"))],
  ["animalOwnerships", and(testOpenId("ownerOpenId"), older("createdAt"))],
  ["walletTransactions", and(testOpenId("ownerOpenId"), older("createdAt"))],
  ["wallets", and(testOpenId("ownerOpenId"), older("createdAt"))],
  ["marketplacePurchases", and(testOpenId("ownerOpenId"), older("createdAt"))],
  ["achievementBadges", and(testOpenId("ownerOpenId"), older("awardedAt"))],
  ["ownerRatings", and(testOpenId("ownerOpenId"), older("createdAt"))],
  ["animals", testAnimalsWhere],
  ["users", testUsersWhere],
];

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table],
  );
  return Number(rows[0].n) > 0;
}

async function main() {
  if (!Number.isFinite(MAX_AGE_HOURS) || MAX_AGE_HOURS <= 0) {
    fail("TEST_DB_CLEANUP_MAX_AGE_HOURS должен быть положительным числом");
  }
  const options = parseTargetUrl();

  const conn = await mysql.createConnection(options);
  const report = [];
  let totalMatched = 0;
  let totalDeleted = 0;
  try {
    for (const [table, where] of steps) {
      if (!(await tableExists(conn, table))) {
        report.push({ table, matched: 0, deleted: 0, note: "таблицы нет" });
        continue;
      }
      const [countRows] = await conn.query(`SELECT COUNT(*) AS n FROM ${q(table)} WHERE ${where.sql}`, where.params);
      const matched = Number(countRows[0].n);
      let deleted = 0;
      if (!dryRun && matched > 0) {
        // Пакетами, чтобы не упереться в лимит размера транзакции TiDB
        for (;;) {
          const [result] = await conn.query(`DELETE FROM ${q(table)} WHERE ${where.sql} LIMIT ${BATCH}`, where.params);
          deleted += result.affectedRows;
          if (result.affectedRows < BATCH) break;
        }
      }
      totalMatched += matched;
      totalDeleted += deleted;
      report.push({ table, matched, deleted });
    }
  } finally {
    await conn.end();
  }

  console.log(`[cleanup-test-db] ${dryRun ? "dry-run" : "очистка"}: записи старше ${MAX_AGE_HOURS} ч`);
  const nonEmpty = report.filter((r) => r.matched > 0 || r.note);
  if (nonEmpty.length) console.table(nonEmpty);
  console.log(`[cleanup-test-db] найдено ${totalMatched}, удалено ${totalDeleted}`);
}

main().catch((error) => {
  console.error(`[cleanup-test-db] ${error?.message ?? error}`);
  process.exit(1);
});
