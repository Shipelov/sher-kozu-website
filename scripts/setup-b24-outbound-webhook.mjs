/**
 * Register an outbound webhook in Bitrix24 for ONCRMDEALUPDATE event.
 * This makes B24 call koza.vip/api/bitrix24/webhook whenever a deal stage changes.
 *
 * Usage: node scripts/setup-b24-outbound-webhook.mjs
 */

import "dotenv/config";

const B24_BASE = process.env.BITRIX24_BASE_URL;
const B24_USER = process.env.BITRIX24_REST_USER_ID;
const B24_TOKEN = process.env.BITRIX24_WEBHOOK_TOKEN;
const OUTBOUND_TOKEN = process.env.BITRIX24_OUTBOUND_WEBHOOK_TOKEN;

if (!B24_BASE || !B24_USER || !B24_TOKEN) {
  console.error("Missing BITRIX24_BASE_URL, BITRIX24_REST_USER_ID, or BITRIX24_WEBHOOK_TOKEN");
  process.exit(1);
}

const webhookBase = `${B24_BASE}/rest/${B24_USER}/${B24_TOKEN}`;
const HANDLER_URL = "https://koza.vip/api/bitrix24/webhook";
const EVENT_NAME = "ONCRMDEALUPDATE";

async function b24Call(method, params = {}) {
  const url = `${webhookBase}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`B24 ${method}: ${data.error} — ${data.error_description || ""}`);
  }
  return data;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Bitrix24 Outbound Webhook Setup");
  console.log("═══════════════════════════════════════════════════════");

  // Step 1: Check existing event bindings
  console.log("\n[1] Checking existing event bindings...");
  const existing = await b24Call("event.get");
  const existingBindings = existing.result || [];
  console.log(`  Found ${existingBindings.length} existing binding(s)`);

  // Check if ONCRMDEALUPDATE is already bound to our handler
  const alreadyBound = existingBindings.find(
    (b) => b.event === EVENT_NAME && b.handler === HANDLER_URL
  );

  if (alreadyBound) {
    console.log(`  ⚠️  ${EVENT_NAME} → ${HANDLER_URL} is already registered`);
    console.log(`  Binding details:`, JSON.stringify(alreadyBound, null, 2));
    console.log("\n✅ No action needed — webhook is already configured.");
    return;
  }

  // Step 2: Register the event binding
  console.log(`\n[2] Registering ${EVENT_NAME} → ${HANDLER_URL}...`);
  const bindResult = await b24Call("event.bind", {
    event: EVENT_NAME,
    handler: HANDLER_URL,
    auth_type: 0, // Use application token (sent in webhook payload as auth.application_token)
  });

  console.log(`  Result:`, JSON.stringify(bindResult.result));

  // Step 3: Verify the binding was created
  console.log("\n[3] Verifying binding...");
  const verify = await b24Call("event.get");
  const verifyBindings = verify.result || [];
  const ourBinding = verifyBindings.find(
    (b) => b.event === EVENT_NAME && b.handler === HANDLER_URL
  );

  if (ourBinding) {
    console.log(`  ✅ Binding confirmed:`);
    console.log(`     Event: ${ourBinding.event}`);
    console.log(`     Handler: ${ourBinding.handler}`);
    console.log(`     Offline: ${ourBinding.offline ?? "N/A"}`);
  } else {
    console.error("  ❌ Binding NOT found after registration!");
    console.log("  All bindings:", JSON.stringify(verifyBindings, null, 2));
    process.exit(1);
  }

  // Step 4: Show all current bindings
  console.log(`\n[4] All current event bindings (${verifyBindings.length}):`);
  for (const b of verifyBindings) {
    console.log(`  • ${b.event} → ${b.handler}`);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ Outbound webhook configured successfully!");
  console.log("  B24 will POST to koza.vip on every deal update.");
  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
