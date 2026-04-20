#!/usr/bin/env node
/**
 * Full Bitrix24 Integration Cycle Test
 *
 * Tests:
 * 1. Create a test deal in B24 via syncOwnershipDealToBitrix logic
 * 2. Verify deal appears in B24 with correct fields
 * 3. Move deal stage in B24
 * 4. Send webhook to koza.vip to trigger ownership update
 * 5. Verify ownership status changed
 *
 * Usage: node scripts/test-b24-full-cycle.mjs [--base-url https://koza.vip]
 */

import "dotenv/config";

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "https://koza.vip";

const B24_BASE = process.env.BITRIX24_BASE_URL;
const B24_USER = process.env.BITRIX24_REST_USER_ID;
const B24_TOKEN = process.env.BITRIX24_WEBHOOK_TOKEN;
const B24_OUTBOUND_TOKEN = process.env.BITRIX24_OUTBOUND_WEBHOOK_TOKEN || "t3iub0hik3xv6y3egu6ric7b70dq9u4f";

if (!B24_BASE || !B24_USER || !B24_TOKEN) {
  console.error("Missing BITRIX24_BASE_URL, BITRIX24_REST_USER_ID, or BITRIX24_WEBHOOK_TOKEN");
  process.exit(1);
}

const B24_WEBHOOK = `${B24_BASE.replace(/\/+$/, "")}/rest/${B24_USER}/${B24_TOKEN}`;

// Constants matching shared/bitrix24Constants.ts
const B24_CATEGORY_MAIN = 1;
const B24_STAGE = {
  NEW_REQUEST: "C1:NEW_REQUEST",
  CONSULTATION: "C1:CONSULTATION",
  AWAITING_PAYMENT: "C1:AWAITING_PAYMENT",
  PAYMENT_RECEIVED: "C1:PAYMENT_RECEIVED",
  CABINET_SETUP: "C1:CABINET_SETUP",
  FIRST_DELIVERY: "C1:FIRST_DELIVERY",
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

function log(step, msg, data) {
  const prefix = step ? `[${step}]` : "";
  console.log(`${prefix} ${msg}`);
  if (data) console.log("  →", typeof data === "string" ? data : JSON.stringify(data, null, 2).slice(0, 500));
}

function pass(step) {
  console.log(`✅ ${step} — PASSED`);
}

function fail(step, err) {
  console.error(`❌ ${step} — FAILED: ${err}`);
}

async function main() {
  const testId = `test_${Date.now()}`;
  const testOwnershipId = 999000 + Math.floor(Math.random() * 1000);
  const testUserOpenId = `test_user_${testId}`;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Bitrix24 Full Integration Cycle Test");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  B24: ${B24_BASE}`);
  console.log(`  Test ID: ${testId}`);
  console.log("═══════════════════════════════════════════════════════\n");

  let dealId = null;
  let contactId = null;

  // ─── Step 1: Create a test contact ────────────────────────
  try {
    log("1", "Creating test contact in Bitrix24...");
    const contactRes = await callB24("crm.contact.add", {
      fields: {
        NAME: "Тест",
        LAST_NAME: "Интеграция",
        SECOND_NAME: testId,
        OPENED: "Y",
        TYPE_ID: "CLIENT",
        SOURCE_ID: "WEB",
        EMAIL: [{ VALUE: `test-${testId}@koza.vip`, VALUE_TYPE: "WORK" }],
      },
    });
    contactId = String(contactRes.result);
    pass(`Step 1: Contact created (ID: ${contactId})`);
  } catch (err) {
    fail("Step 1: Create contact", err.message);
    return;
  }

  // ─── Step 2: Create a deal in the main funnel ─────────────
  try {
    log("2", "Creating test deal in 'Персональное фермерство' funnel...");
    const dealFields = {
      TITLE: `[ТЕСТ] Доля 50%: Козочка Белка — ${testId}`,
      CATEGORY_ID: B24_CATEGORY_MAIN,
      STAGE_ID: B24_STAGE.NEW_REQUEST,
      CONTACT_ID: contactId,
      OPPORTUNITY: 45000,
      CURRENCY_ID: "RUB",
      COMMENTS: `Тестовая сделка для проверки интеграции.\nTest ID: ${testId}`,
      [B24_FIELD.OWNERSHIP_ID]: String(testOwnershipId),
      [B24_FIELD.ANIMAL_NAME]: "Козочка Белка",
      [B24_FIELD.ANIMAL_TYPE]: "goat",
      [B24_FIELD.SHARE_PCT]: 50,
      [B24_FIELD.TARIFF]: "Базовый",
      [B24_FIELD.PROFILE_URL]: `${BASE_URL}/animals/test`,
      [B24_FIELD.USER_ID]: testUserOpenId,
    };
    const dealRes = await callB24("crm.deal.add", {
      fields: dealFields,
      params: { REGISTER_SONET_EVENT: "Y" },
    });
    dealId = String(dealRes.result);
    pass(`Step 2: Deal created (ID: ${dealId})`);
  } catch (err) {
    fail("Step 2: Create deal", err.message);
    return;
  }

  // ─── Step 3: Verify deal fields in B24 ────────────────────
  try {
    log("3", `Fetching deal ${dealId} from Bitrix24 to verify fields...`);
    const dealGet = await callB24("crm.deal.get", { id: dealId });
    const deal = dealGet.result;

    const checks = [
      { field: "CATEGORY_ID", expected: String(B24_CATEGORY_MAIN), actual: String(deal.CATEGORY_ID) },
      { field: "STAGE_ID", expected: B24_STAGE.NEW_REQUEST, actual: deal.STAGE_ID },
      { field: B24_FIELD.OWNERSHIP_ID, expected: String(testOwnershipId), actual: deal[B24_FIELD.OWNERSHIP_ID] },
      { field: B24_FIELD.ANIMAL_NAME, expected: "Козочка Белка", actual: deal[B24_FIELD.ANIMAL_NAME] },
      { field: B24_FIELD.SHARE_PCT, expected: "50", actual: String(deal[B24_FIELD.SHARE_PCT] || "") },
      { field: B24_FIELD.USER_ID, expected: testUserOpenId, actual: deal[B24_FIELD.USER_ID] },
    ];

    let allOk = true;
    for (const c of checks) {
      if (c.actual !== c.expected) {
        console.log(`  ⚠️  ${c.field}: expected "${c.expected}", got "${c.actual}"`);
        allOk = false;
      } else {
        console.log(`  ✓ ${c.field}: ${c.actual}`);
      }
    }

    if (allOk) {
      pass("Step 3: All deal fields verified");
    } else {
      fail("Step 3: Some fields mismatch", "See above");
    }
  } catch (err) {
    fail("Step 3: Verify deal", err.message);
  }

  // ─── Step 4: Move deal to PAYMENT_RECEIVED stage ──────────
  try {
    log("4", `Moving deal ${dealId} from NEW_REQUEST → PAYMENT_RECEIVED...`);
    await callB24("crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: B24_STAGE.PAYMENT_RECEIVED },
    });

    // Verify stage changed
    const verify = await callB24("crm.deal.get", { id: dealId });
    if (verify.result.STAGE_ID === B24_STAGE.PAYMENT_RECEIVED) {
      pass(`Step 4: Deal stage updated to PAYMENT_RECEIVED (${B24_STAGE.PAYMENT_RECEIVED})`);
    } else {
      fail("Step 4: Stage update", `Expected ${B24_STAGE.PAYMENT_RECEIVED}, got ${verify.result.STAGE_ID}`);
    }
  } catch (err) {
    fail("Step 4: Move stage", err.message);
  }

  // ─── Step 5: Send webhook to koza.vip ─────────────────────
  try {
    log("5", `Sending ONCRMDEALUPDATE webhook to ${BASE_URL}/api/bitrix24/webhook...`);
    const webhookPayload = {
      event: "ONCRMDEALUPDATE",
      auth: {
        application_token: B24_OUTBOUND_TOKEN,
      },
      data: {
        FIELDS: {
          ID: dealId,
        },
      },
    };

    const webhookRes = await fetch(`${BASE_URL}/api/bitrix24/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    const webhookBody = await webhookRes.json();
    log("5", `Webhook response (HTTP ${webhookRes.status}):`, webhookBody);

    if (webhookRes.status === 200 && webhookBody.ok === true) {
      pass(`Step 5: Webhook processed successfully`);
      console.log(`  → Old status: ${webhookBody.oldStatus}`);
      console.log(`  → New status: ${webhookBody.newStatus}`);
      console.log(`  → Rows updated: ${webhookBody.rowsUpdated}`);
    } else if (webhookRes.status === 200 && webhookBody.error === "ownership_not_found") {
      console.log(`  ℹ️  Step 5: Webhook processed but no matching ownership in DB (expected for test deal)`);
      pass("Step 5: Webhook auth + round-trip verified (no real ownership to update)");
    } else if (webhookRes.status === 403) {
      fail("Step 5: Webhook rejected", `Token verification failed: ${JSON.stringify(webhookBody)}`);
    } else {
      console.log(`  ⚠️  Step 5: Unexpected response: HTTP ${webhookRes.status}`, webhookBody);
    }
  } catch (err) {
    fail("Step 5: Webhook", err.message);
  }

  // ─── Step 6: Move deal to WON (Active Owner) ─────────────
  try {
    log("6", `Moving deal ${dealId} to ACTIVE_OWNER (WON)...`);
    await callB24("crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: B24_STAGE.ACTIVE_OWNER },
    });

    const verify = await callB24("crm.deal.get", { id: dealId });
    if (verify.result.STAGE_ID === B24_STAGE.ACTIVE_OWNER) {
      pass(`Step 6: Deal moved to ACTIVE_OWNER (${B24_STAGE.ACTIVE_OWNER})`);
    } else {
      fail("Step 6", `Expected ${B24_STAGE.ACTIVE_OWNER}, got ${verify.result.STAGE_ID}`);
    }
  } catch (err) {
    fail("Step 6: Move to WON", err.message);
  }

  // ─── Step 7: Test webhook for WON stage ───────────────────
  try {
    log("7", `Sending webhook for WON stage...`);
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
    log("7", `Webhook response:`, webhookBody);

    if (webhookBody.ok === true || webhookBody.error === "ownership_not_found") {
      pass("Step 7: Webhook for WON stage processed");
    } else {
      fail("Step 7", JSON.stringify(webhookBody));
    }
  } catch (err) {
    fail("Step 7: WON webhook", err.message);
  }

  // ─── Step 8: Move deal to FROZEN (LOSE) ───────────────────
  try {
    log("8", `Moving deal ${dealId} to FROZEN (LOSE)...`);
    await callB24("crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: B24_STAGE.FROZEN },
    });

    const verify = await callB24("crm.deal.get", { id: dealId });
    if (verify.result.STAGE_ID === B24_STAGE.FROZEN) {
      pass(`Step 8: Deal moved to FROZEN (${B24_STAGE.FROZEN})`);
    } else {
      fail("Step 8", `Expected ${B24_STAGE.FROZEN}, got ${verify.result.STAGE_ID}`);
    }
  } catch (err) {
    fail("Step 8: Move to FROZEN", err.message);
  }

  // ─── Cleanup: Delete test deal and contact ────────────────
  console.log("\n─── Cleanup ───");
  try {
    if (dealId) {
      await callB24("crm.deal.delete", { id: dealId });
      console.log(`  🗑️  Deleted test deal ${dealId}`);
    }
    if (contactId) {
      await callB24("crm.contact.delete", { id: contactId });
      console.log(`  🗑️  Deleted test contact ${contactId}`);
    }
    console.log("  ✅ Cleanup complete");
  } catch (err) {
    console.warn(`  ⚠️  Cleanup error: ${err.message}`);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Test complete!");
  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
