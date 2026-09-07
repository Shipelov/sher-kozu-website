#!/usr/bin/env node
/**
 * Идемпотентный минимальный сид тестовой базы для CI (pnpm db:seed-test).
 *
 * Создаёт ровно то, что ожидают интеграционные тесты и чего нет в пустой базе
 * после миграций: admin-пользователя фермы (OWNER_OPEN_ID), план с длительностями,
 * три публичных животных, тарифы/рыночные цены/конверсии (server/seed-pricing.mjs)
 * и базу знаний Зои (server/seedNutriKnowledge.mjs).
 *
 * Все данные синтетические, production-данные не используются. Повторный запуск
 * ничего не дублирует. Адрес базы: DATABASE_URL, иначе TEST_DATABASE_URL.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { seedPricing } from "../server/seed-pricing.mjs";
import { seedNutriKnowledge } from "../server/seedNutriKnowledge.mjs";

const ownerOpenId = process.env.OWNER_OPEN_ID?.trim();
if (!ownerOpenId) {
  console.error("[seed-test] OWNER_OPEN_ID не задан: тесты и сид должны использовать один и тот же openId владельца фермы");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.TEST_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[seed-test] Не задан DATABASE_URL / TEST_DATABASE_URL");
  process.exit(1);
}

function connectionOptions(urlString) {
  const url = new URL(urlString);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    timezone: "Z",
    connectTimeout: 15_000,
    ...(isLocal ? {} : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false } }),
  };
}

const PLAN_CODE = "ci-core-care";

const ANIMALS = [
  {
    slug: "marta",
    name: "Марта",
    species: "goat",
    breed: "Альпийская",
    shortDescription: "Спокойная альпийская коза с высоким удоем — тестовое животное CI.",
    story: "Марта живёт на тестовой ферме CI. Любит яблоки, охотно идёт к людям и стабильно даёт молоко круглый год.",
    price: 45000,
    isFeatured: 1,
    sortOrder: 0,
  },
  {
    slug: "ci-lola",
    name: "Лола",
    species: "goat",
    breed: "Англо-нубийская",
    shortDescription: "Голосистая англо-нубийская коза с жирным молоком — тестовое животное CI.",
    story: "Лола — общительная коза с длинными висячими ушами. Её молоко идёт на сыр и йогурт в тестовых сценариях.",
    price: 52000,
    isFeatured: 0,
    sortOrder: 1,
  },
  {
    slug: "ci-rufa",
    name: "Руфа",
    species: "sheep",
    breed: "Лакон",
    shortDescription: "Овца породы Лакон для тестовых сценариев овечьих продуктов.",
    story: "Руфа спокойно переносит машинное доение и участвует в тестах трекера продуктов.",
    price: 60000,
    isFeatured: 0,
    sortOrder: 2,
  },
];

async function seedOwnerUser(conn) {
  await conn.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, onboardingCompleted)
     VALUES (?, ?, ?, 'local', 'admin', true)
     ON DUPLICATE KEY UPDATE role = 'admin', deletedAt = NULL, deletedBy = NULL`,
    [ownerOpenId, "CI Farm Owner", `${ownerOpenId}@ci.koza.test`],
  );
  console.log(`[seed-test] admin user ${ownerOpenId}: ok`);
}

async function seedPlanWithDurations(conn) {
  await conn.execute(
    `INSERT INTO plans (ownerOpenId, code, name, description, planStatus, basePriceMinor, maxOwnersPerAnimal, benefitsSummary)
     VALUES (?, ?, 'Базовая опека', 'Тестовый план CI для покупки долей.', 'active', 45000, 3, 'Кабинет, клубные обновления, базовая продуктовая выдача.')
     ON DUPLICATE KEY UPDATE planStatus = 'active', ownerOpenId = VALUES(ownerOpenId)`,
    [ownerOpenId, PLAN_CODE],
  );
  const [planRows] = await conn.execute("SELECT id FROM plans WHERE code = ? LIMIT 1", [PLAN_CODE]);
  const planId = planRows[0].id;

  const [durationRows] = await conn.execute(
    "SELECT id FROM planDurations WHERE planId = ? LIMIT 1",
    [planId],
  );
  if (durationRows.length === 0) {
    await conn.query(
      `INSERT INTO planDurations (planId, months, label, priceMinor, isDefault, isActive, sortOrder) VALUES ?`,
      [[
        [planId, 1, "1 месяц", 45000, 1, 1, 0],
        [planId, 3, "3 месяца", 129000, 0, 1, 1],
        [planId, 12, "12 месяцев", 480000, 0, 1, 2],
      ]],
    );
  }
  console.log(`[seed-test] plan ${PLAN_CODE} (#${planId}) with durations: ok`);
}

async function seedAnimals(conn) {
  for (const a of ANIMALS) {
    await conn.execute(
      `INSERT INTO animals (ownerOpenId, name, slug, animalSpecies, breed, birthDate, shortDescription, story,
                            coverImageUrl, galleryIntro, animalStatus, totalOwnershipSlots, baseMonthlyPriceMinor,
                            healthScore, happinessScore, milkPotentialScore, careLevelScore, isFeatured, sortOrder, publishedAt)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 2 YEAR), ?, ?, ?, ?, 'public_available', 2, ?, 90, 88, 85, 70, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE ownerOpenId = VALUES(ownerOpenId), animalStatus = 'public_available',
                               name = VALUES(name), animalSpecies = VALUES(animalSpecies), breed = VALUES(breed)`,
      [
        ownerOpenId,
        a.name,
        a.slug,
        a.species,
        a.breed,
        a.shortDescription,
        a.story,
        `https://placehold.co/800x600?text=${encodeURIComponent(a.name)}`,
        `Фотогалерея ${a.name}: тестовые снимки CI.`,
        a.price,
        a.isFeatured,
        a.sortOrder,
      ],
    );
  }
  console.log(`[seed-test] animals (${ANIMALS.map((a) => a.slug).join(", ")}): ok`);
}

async function main() {
  const conn = await mysql.createConnection(connectionOptions(databaseUrl));
  try {
    await seedOwnerUser(conn);
    await seedPlanWithDurations(conn);
    await seedAnimals(conn);
    await seedPricing(conn);
    await seedNutriKnowledge(conn);

    const [[counts]] = await conn.query(
      `SELECT (SELECT COUNT(*) FROM animals WHERE ownerOpenId = ?) AS animals,
              (SELECT COUNT(*) FROM planDurations) AS durations,
              (SELECT COUNT(*) FROM pricingTiers) AS tiers,
              (SELECT COUNT(*) FROM marketPrices) AS marketPrices,
              (SELECT COUNT(*) FROM productConversions) AS conversions,
              (SELECT COUNT(*) FROM nutriKnowledge) AS knowledge`,
      [ownerOpenId],
    );
    console.log("[seed-test] итог:", counts);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("[seed-test] ошибка:", error?.message ?? error);
  process.exit(1);
});
