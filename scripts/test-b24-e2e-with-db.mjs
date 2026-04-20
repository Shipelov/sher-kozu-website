#!/usr/bin/env node
/**
 * End-to-End Bitrix24 Integration Test WITH Database
 *
 * Creates a real ownership row in the DB, creates a matching deal in B24,
 * then moves the deal stage and sends a webhook to verify the ownership
 * status gets updated in the database.
 *
 * Usage: node scripts/test-b24-e2e-with-db.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "https://koza.vip";

const DB_URL = process.env.DATABASE_URL;
const B24_BASE = process.env.BITRIX24_BASE_URL;
const B24_USER = process.env.BITRIX24_REST_USER_ID;
const B24_TOKEN = process.env.BITRIX24_WEBHOOK_TOKEN;
const B24_OUTBOUND_TOKEN = process.env.BITRIX24_OUTBOUND_WEBHOOK_TOKEN || "t3iub0hik3xv6y3egu6ric7b70dq9u4f";

if (!DB_URL || !B24_BASE || !B24_USER || !B24_TOKEN) {
  console.error("Missing required env vars: DATABASE_URL, BITRIX24_BASE_URL, BITRIX24_REST_USER_ID, BITRIX24_WEBHOOK_TOKEN");
  process.exit(1);
}

const B24_WEBHOOK = `${B24_BASE.replace(/\/+$/, "")}/rest/${B24_USER}/${B24_TOKEN}`;

const B24_CATEGORY_MAIN = 1;
const B24_STAGE = {
  NEW_REQUEST: "C1:NEW_REQUEST",
  PAYMENT_RECEIVED: "C1:PAYMENT_RECEIVED",
  ACTIVE_OWNER: "C1:WON",
  FROZEN: "C1:LOSE",
};
const B24_FIELD = {
  OWNERSHIP_ID: "UF_CRM_KOZA_OWNERSHIP_ID",
  ANIMAL_NAME: "UF_CRM_KOZA_ANIMAL_NAME",
  ANIMAL_TYPE: "UF_CRM_KOZA_ANIMAL_TYPE",
  SHARE_PCT: "UF_CRM_KOZA_SHARE_PCT",
  TARIFF: "UF_CRM_KOZA_TARIFF",
  PROFILE_URL: "UF_CRM_KOZA_PROFILE_URL",
  USER_ID: "UF_CRM_KOZA_USER_ID",
};

async function callB24(method, body) {
  const res = await fetch(`${B24_WEBHOOK}/${method}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`B24 ${method}: ${json.error_description || json.error || res.status}`);
  }
  return json;
}

function pass(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ ${msg}`); }

async function main() {
  const testId = `e2e_${Date.now()}`;
  const testOpenId = `test_e2e_${Date.now()}`;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  E2E Bitrix24 Integration Test (with DB)");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Test ID: ${testId}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Parse DATABASE_URL for mysql2
  const dbUrl = new URL(DB_URL);
  const conn = await mysql.createConnection({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port || "4000"),
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  let dealId = null;
  let contactId = null;
  let ownershipId = null;

  try {
    // ─── Step 1: Find a real animal and plan to reference ───
    console.log("[1] Finding a real animal and plan in DB...");
    const [animals] = await conn.execute("SELECT id FROM animals LIMIT 1");
    if (animals.length === 0) {
      fail("No animals in DB — cannot create test ownership");
      return;
    }
    const animalId = animals[0].id;
    // Get familyId from an existing ownership or default to 1
    const [existingOwnerships] = await conn.execute("SELECT familyId FROM animalOwnerships LIMIT 1");
    const familyId = existingOwnerships.length > 0 ? existingOwnerships[0].familyId : 1;

    const [plans] = await conn.execute("SELECT id FROM plans LIMIT 1");
    if (plans.length === 0) {
      fail("No plans in DB — cannot create test ownership");
      return;
    }
    const planId = plans[0].id;

    const [durations] = await conn.execute("SELECT id FROM planDurations LIMIT 1");
    const planDurationId = durations.length > 0 ? durations[0].id : 1;

    console.log(`  Animal ID: ${animalId}, Family ID: ${familyId}, Plan ID: ${planId}`);

    // ─── Step 2: Create test ownership row ──────────────────
    console.log("[2] Creating test ownership row in DB...");
    const now = new Date();
    const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const [insertResult] = await conn.execute(
      `INSERT INTO animalOwnerships 
       (ownerOpenId, animalId, familyId, planId, planDurationId, slotIndex, ownershipStatus, startsAt, endsAt, priceMinor, notes)
       VALUES (?, ?, ?, ?, ?, 99, 'pending_payment', ?, ?, 45000, ?)`,
      [testOpenId, animalId, familyId, planId, planDurationId, now, endsAt, `E2E test ${testId}`]
    );
    ownershipId = insertResult.insertId;
    pass(`Step 2: Ownership created (ID: ${ownershipId})`);

    // ─── Step 3: Create B24 contact ─────────────────────────
    console.log("[3] Creating test contact in B24...");
    const contactRes = await callB24("crm.contact.add", {
      fields: {
        NAME: "E2E-Тест",
        LAST_NAME: "Интеграция",
        OPENED: "Y",
        EMAIL: [{ VALUE: `e2e-${testId}@koza.vip`, VALUE_TYPE: "WORK" }],
      },
    });
    contactId = String(contactRes.result);
    pass(`Step 3: Contact created (ID: ${contactId})`);

    // ─── Step 4: Create B24 deal ────────────────────────────
    console.log("[4] Creating deal in B24 funnel...");
    const dealRes = await callB24("crm.deal.add", {
      fields: {
        TITLE: `[E2E] Доля 50%: Тестовое животное — ${testId}`,
        CATEGORY_ID: B24_CATEGORY_MAIN,
        STAGE_ID: B24_STAGE.NEW_REQUEST,
        CONTACT_ID: contactId,
        OPPORTUNITY: 45000,
        CURRENCY_ID: "RUB",
        [B24_FIELD.OWNERSHIP_ID]: String(ownershipId),
        [B24_FIELD.ANIMAL_NAME]: "Тестовое животное",
        [B24_FIELD.SHARE_PCT]: 50,
        [B24_FIELD.TARIFF]: "Базовый",
        [B24_FIELD.USER_ID]: testOpenId,
      },
    });
    dealId = String(dealRes.result);
    pass(`Step 4: Deal created (ID: ${dealId})`);

    // ─── Step 5: Link deal to ownership in DB ───────────────
    console.log("[5] Linking deal to ownership in DB...");
    await conn.execute(
      "UPDATE animalOwnerships SET bitrixDealId = ?, bitrixStageId = ? WHERE id = ?",
      [dealId, B24_STAGE.NEW_REQUEST, ownershipId]
    );
    pass("Step 5: Ownership linked to deal");

    // Verify initial state
    const [rows0] = await conn.execute("SELECT ownershipStatus, bitrixDealId, bitrixStageId FROM animalOwnerships WHERE id = ?", [ownershipId]);
    console.log(`  → DB state: status=${rows0[0].ownershipStatus}, dealId=${rows0[0].bitrixDealId}, stageId=${rows0[0].bitrixStageId}`);

    // ─── Step 6: Move deal to PAYMENT_RECEIVED in B24 ──────
    console.log("\n[6] Moving deal to PAYMENT_RECEIVED in B24...");
    await callB24("crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: B24_STAGE.PAYMENT_RECEIVED },
    });
    pass("Step 6: Deal stage updated in B24");

    // ─── Step 7: Send webhook to koza.vip ───────────────────
    console.log("[7] Sending ONCRMDEALUPDATE webhook to koza.vip...");
    const webhookRes = await fetch(`${BASE_URL}/api/bitrix24/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "ONCRMDEALUPDATE",
        auth: { application_token: B24_OUTBOUND_TOKEN },
        data: { FIELDS: { ID: dealId } },
      }),
    });
    const webhookBody = await webhookRes.json();
    console.log(`  → Webhook response (HTTP ${webhookRes.status}):`, JSON.stringify(webhookBody));

    if (webhookBody.ok === true && webhookBody.newStatus === "active") {
      pass("Step 7: Webhook processed — ownership changed to 'active'");
    } else if (webhookBody.ok === true) {
      pass(`Step 7: Webhook processed — new status: ${webhookBody.newStatus}`);
    } else {
      fail(`Step 7: Webhook response: ${JSON.stringify(webhookBody)}`);
    }

    // ─── Step 8: Verify ownership status in DB ──────────────
    console.log("[8] Verifying ownership status in DB...");
    // Small delay for DB propagation
    await new Promise(r => setTimeout(r, 1000));
    const [rows1] = await conn.execute("SELECT ownershipStatus, bitrixStageId, paidAt FROM animalOwnerships WHERE id = ?", [ownershipId]);
    const row = rows1[0];
    console.log(`  → DB state: status=${row.ownershipStatus}, stageId=${row.bitrixStageId}, paidAt=${row.paidAt}`);

    if (row.ownershipStatus === "active") {
      pass("Step 8: Ownership status is 'active' ✨");
    } else {
      fail(`Step 8: Expected 'active', got '${row.ownershipStatus}'`);
    }

    if (row.bitrixStageId === B24_STAGE.PAYMENT_RECEIVED) {
      pass("Step 8b: bitrixStageId updated correctly");
    } else {
      fail(`Step 8b: Expected '${B24_STAGE.PAYMENT_RECEIVED}', got '${row.bitrixStageId}'`);
    }

    if (row.paidAt) {
      pass("Step 8c: paidAt timestamp set");
    } else {
      fail("Step 8c: paidAt not set");
    }

    // ─── Step 9: Move to FROZEN and test webhook ────────────
    console.log("\n[9] Moving deal to FROZEN (LOSE) in B24...");
    await callB24("crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: B24_STAGE.FROZEN },
    });

    console.log("[9b] Sending webhook for FROZEN stage...");
    const webhookRes2 = await fetch(`${BASE_URL}/api/bitrix24/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "ONCRMDEALUPDATE",
        auth: { application_token: B24_OUTBOUND_TOKEN },
        data: { FIELDS: { ID: dealId } },
      }),
    });
    const webhookBody2 = await webhookRes2.json();
    console.log(`  → Webhook response:`, JSON.stringify(webhookBody2));

    await new Promise(r => setTimeout(r, 1000));
    const [rows2] = await conn.execute("SELECT ownershipStatus, bitrixStageId FROM animalOwnerships WHERE id = ?", [ownershipId]);
    console.log(`  → DB state: status=${rows2[0].ownershipStatus}, stageId=${rows2[0].bitrixStageId}`);

    if (rows2[0].ownershipStatus === "frozen" || rows2[0].ownershipStatus === "cancelled") {
      pass(`Step 9: Ownership status changed to '${rows2[0].ownershipStatus}'`);
    } else {
      fail(`Step 9: Expected 'frozen' or 'cancelled', got '${rows2[0].ownershipStatus}' (check ownershipStatusEnum)`);
    }

  } catch (err) {
    console.error("\n💥 Fatal error:", err);
  } finally {
    // ─── Cleanup ────────────────────────────────────────────
    console.log("\n─── Cleanup ───");
    try {
      if (ownershipId) {
        await conn.execute("DELETE FROM animalOwnerships WHERE id = ?", [ownershipId]);
        console.log(`  🗑️  Deleted test ownership ${ownershipId}`);
      }
    } catch (e) { console.warn(`  ⚠️  DB cleanup: ${e.message}`); }

    try {
      if (dealId) {
        await callB24("crm.deal.delete", { id: dealId });
        console.log(`  🗑️  Deleted test deal ${dealId}`);
      }
    } catch (e) { console.warn(`  ⚠️  B24 deal cleanup: ${e.message}`); }

    try {
      if (contactId) {
        await callB24("crm.contact.delete", { id: contactId });
        console.log(`  🗑️  Deleted test contact ${contactId}`);
      }
    } catch (e) { console.warn(`  ⚠️  B24 contact cleanup: ${e.message}`); }

    await conn.end();
    console.log("  ✅ Cleanup complete");

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  E2E Test complete!");
    console.log("═══════════════════════════════════════════════════════");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
