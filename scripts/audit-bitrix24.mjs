/**
 * Audit Bitrix24 CRM state: categories (funnels), stages, custom fields, contacts, deals.
 * Run: node scripts/audit-bitrix24.mjs
 */
import 'dotenv/config';

const BASE_URL = process.env.BITRIX24_BASE_URL?.replace(/\/+$/, '');
const USER_ID = process.env.BITRIX24_REST_USER_ID?.trim();
const TOKEN = process.env.BITRIX24_WEBHOOK_TOKEN?.trim();

if (!BASE_URL || !USER_ID || !TOKEN) {
  console.error('Missing BITRIX24_BASE_URL, BITRIX24_REST_USER_ID, or BITRIX24_WEBHOOK_TOKEN');
  process.exit(1);
}

const WEBHOOK_URL = `${BASE_URL}/rest/${USER_ID}/${TOKEN}`;

async function callB24(method, body = {}) {
  const res = await fetch(`${WEBHOOK_URL}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json?.error) {
    console.error(`Error calling ${method}:`, json?.error_description || json?.error);
    return null;
  }
  return json;
}

async function main() {
  console.log('=== Bitrix24 CRM Audit ===\n');
  console.log(`Webhook URL: ${WEBHOOK_URL.replace(TOKEN, TOKEN.slice(0, 6) + '...')}\n`);

  // 1. Check access
  console.log('--- 1. Access Check ---');
  const profile = await callB24('profile');
  if (profile?.result) {
    console.log(`Logged in as: ${profile.result.NAME} ${profile.result.LAST_NAME} (ID: ${profile.result.ID})`);
  } else {
    console.error('Cannot access Bitrix24. Check credentials.');
    process.exit(1);
  }

  // 2. Deal categories (funnels)
  console.log('\n--- 2. Deal Categories (Funnels) ---');
  const categories = await callB24('crm.category.list', { entityTypeId: 2 });
  if (categories?.result?.categories) {
    for (const cat of categories.result.categories) {
      console.log(`  [${cat.id}] "${cat.name}" (isDefault: ${cat.isDefault}, sort: ${cat.sort})`);
    }
  } else {
    console.log('  No categories found or method not available');
  }

  // 3. Deal stages
  console.log('\n--- 3. Deal Stages ---');
  const stages = await callB24('crm.dealcategory.stage.list', { id: 0 });
  if (stages?.result) {
    for (const stage of stages.result) {
      console.log(`  [${stage.STATUS_ID}] "${stage.NAME}" (sort: ${stage.SORT}, semantics: ${stage.SEMANTICS})`);
    }
  }

  // Also check non-default categories
  if (categories?.result?.categories) {
    for (const cat of categories.result.categories) {
      if (cat.isDefault) continue;
      const catStages = await callB24('crm.dealcategory.stage.list', { id: cat.id });
      if (catStages?.result?.length) {
        console.log(`\n  Stages for category "${cat.name}" (id: ${cat.id}):`);
        for (const stage of catStages.result) {
          console.log(`    [${stage.STATUS_ID}] "${stage.NAME}" (sort: ${stage.SORT}, semantics: ${stage.SEMANTICS})`);
        }
      }
    }
  }

  // 4. Custom deal fields
  console.log('\n--- 4. Custom Deal Fields (UF_*) ---');
  const fields = await callB24('crm.deal.userfield.list');
  if (fields?.result?.length) {
    for (const f of fields.result) {
      console.log(`  [${f.ID}] ${f.FIELD_NAME} — "${f.EDIT_FORM_LABEL?.ru || f.EDIT_FORM_LABEL?.en || 'no label'}" (type: ${f.USER_TYPE_ID})`);
    }
  } else {
    console.log('  No custom fields found');
  }

  // 5. Contacts count
  console.log('\n--- 5. Contacts ---');
  const contacts = await callB24('crm.contact.list', { select: ['ID'], start: 0 });
  console.log(`  Total contacts: ${contacts?.total || 0}`);

  // 6. Deals count
  console.log('\n--- 6. Deals ---');
  const deals = await callB24('crm.deal.list', { select: ['ID', 'TITLE', 'STAGE_ID', 'CATEGORY_ID'], start: 0 });
  console.log(`  Total deals: ${deals?.total || 0}`);
  if (deals?.result?.length) {
    for (const d of deals.result.slice(0, 10)) {
      console.log(`    [${d.ID}] "${d.TITLE}" — stage: ${d.STAGE_ID}, category: ${d.CATEGORY_ID}`);
    }
    if (deals.total > 10) console.log(`    ... and ${deals.total - 10} more`);
  }

  // 7. Available scopes
  console.log('\n--- 7. Available Scopes ---');
  const scope = await callB24('scope');
  if (scope?.result) {
    console.log(`  Scopes: ${scope.result.join(', ')}`);
  }

  console.log('\n=== Audit Complete ===');
}

main().catch(console.error);
