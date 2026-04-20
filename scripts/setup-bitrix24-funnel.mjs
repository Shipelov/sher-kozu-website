/**
 * Set up Bitrix24 CRM for Sher Kozu Client Manager Workstation:
 * 1. Create deal category (funnel) "Персональное фермерство"
 * 2. Configure stages via crm.status.add/delete
 * 3. Create custom deal fields
 * 4. Create renewal funnel "Сопровождение и продление"
 * 
 * Run: node scripts/setup-bitrix24-funnel.mjs
 */
import 'dotenv/config';

const BASE_URL = process.env.BITRIX24_BASE_URL?.replace(/\/+$/, '');
const USER_ID = process.env.BITRIX24_REST_USER_ID?.trim();
const TOKEN = process.env.BITRIX24_WEBHOOK_TOKEN?.trim();
const WEBHOOK_URL = `${BASE_URL}/rest/${USER_ID}/${TOKEN}`;

async function callB24(method, body = {}) {
  const res = await fetch(`${WEBHOOK_URL}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json?.error) {
    throw new Error(`Bitrix24 ${method}: ${json?.error_description || json?.error}`);
  }
  return json;
}

/**
 * Configure stages for a deal category using crm.status.add/delete.
 * ENTITY_ID for deal stages: "DEAL_STAGE" (default) or "DEAL_STAGE_{categoryId}" (custom).
 * STATUS_ID for custom categories auto-gets prefix "C{categoryId}:".
 */
async function configureStages(categoryId, targetStages) {
  const entityId = categoryId === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${categoryId}`;
  
  // Get current stages
  const current = await callB24('crm.status.list', { filter: { ENTITY_ID: entityId } });
  const currentStatuses = current.result || [];
  
  console.log(`  Current stages for ${entityId}: ${currentStatuses.map(s => s.STATUS_ID).join(', ')}`);

  // Delete non-target stages (skip SUCCESS/FAIL semantics stages if they're the only ones)
  for (const stage of currentStatuses) {
    const isInTarget = targetStages.some(t => t.STATUS_ID === stage.STATUS_ID);
    if (!isInTarget) {
      try {
        await callB24('crm.status.delete', { id: stage.ID });
        console.log(`  Deleted stage: [${stage.ID}] ${stage.STATUS_ID} "${stage.NAME}"`);
      } catch (e) {
        console.log(`  Could not delete ${stage.STATUS_ID}: ${e.message}`);
      }
    }
  }

  // Create or update target stages
  const currentIds = currentStatuses.map(s => s.STATUS_ID);
  for (const stage of targetStages) {
    if (currentIds.includes(stage.STATUS_ID)) {
      // Find the numeric ID for update
      const existing = currentStatuses.find(s => s.STATUS_ID === stage.STATUS_ID);
      if (existing) {
        await callB24('crm.status.update', {
          id: existing.ID,
          fields: { NAME: stage.NAME, SORT: stage.SORT, COLOR: stage.COLOR, EXTRA: { SEMANTICS: stage.SEMANTICS } },
        });
        console.log(`  Updated stage: ${stage.STATUS_ID} → "${stage.NAME}"`);
      }
    } else {
      try {
        const result = await callB24('crm.status.add', {
          fields: {
            ENTITY_ID: entityId,
            STATUS_ID: stage.STATUS_ID,
            NAME: stage.NAME,
            SORT: stage.SORT,
            COLOR: stage.COLOR,
            EXTRA: { SEMANTICS: stage.SEMANTICS },
          },
        });
        console.log(`  Created stage: ${stage.STATUS_ID} → "${stage.NAME}" (id: ${result.result})`);
      } catch (e) {
        console.log(`  Stage ${stage.STATUS_ID} error: ${e.message}`);
      }
    }
  }

  // Verify
  const verify = await callB24('crm.status.list', { filter: { ENTITY_ID: entityId } });
  console.log(`\n  Final stages for ${entityId}:`);
  for (const s of (verify.result || [])) {
    console.log(`    [${s.ID}] ${s.STATUS_ID} "${s.NAME}" (sort: ${s.SORT}, color: ${s.COLOR})`);
  }
}

async function main() {
  console.log('=== Setting up Bitrix24 CRM for Sher Kozu ===\n');

  // ─── Step 1: Ensure deal category "Персональное фермерство" exists ───
  console.log('--- Step 1: Deal category ---');
  const existingCategories = await callB24('crm.category.list', { entityTypeId: 2 });
  const existing = existingCategories.result?.categories?.find(c => c.name === 'Персональное фермерство');
  
  let categoryId;
  if (existing) {
    categoryId = existing.id;
    console.log(`  Category already exists: id=${categoryId}`);
  } else {
    const catResult = await callB24('crm.category.add', {
      entityTypeId: 2,
      fields: { name: 'Персональное фермерство', sort: 100, isDefault: 'N' },
    });
    categoryId = catResult.result?.category?.id;
    console.log(`  Created category: id=${categoryId}`);
  }

  // ─── Step 2: Configure stages for main funnel ───
  console.log('\n--- Step 2: Main funnel stages ---');
  
  const prefix = `C${categoryId}:`;
  const mainStages = [
    { STATUS_ID: `${prefix}NEW_REQUEST`,       NAME: 'Новая заявка',           SORT: 10,  SEMANTICS: 'P', COLOR: '#2FC6F6' },
    { STATUS_ID: `${prefix}CONSULTATION`,      NAME: 'Консультация',           SORT: 20,  SEMANTICS: 'P', COLOR: '#55D0E0' },
    { STATUS_ID: `${prefix}AWAITING_PAYMENT`,  NAME: 'Ожидание оплаты',        SORT: 30,  SEMANTICS: 'P', COLOR: '#FFA726' },
    { STATUS_ID: `${prefix}PAYMENT_RECEIVED`,  NAME: 'Оплата получена',        SORT: 40,  SEMANTICS: 'P', COLOR: '#66BB6A' },
    { STATUS_ID: `${prefix}CABINET_SETUP`,     NAME: 'Настройка кабинета',     SORT: 50,  SEMANTICS: 'P', COLOR: '#AB47BC' },
    { STATUS_ID: `${prefix}FIRST_DELIVERY`,    NAME: 'Первая доставка',        SORT: 60,  SEMANTICS: 'P', COLOR: '#7E57C2' },
    { STATUS_ID: `${prefix}ACTIVE_OWNER`,      NAME: 'Активный владелец',      SORT: 70,  SEMANTICS: 'S', COLOR: '#4CAF50' },
    { STATUS_ID: `${prefix}FROZEN`,            NAME: 'Заморожен',              SORT: 80,  SEMANTICS: 'F', COLOR: '#78909C' },
    { STATUS_ID: `${prefix}LOST`,              NAME: 'Отказ',                  SORT: 90,  SEMANTICS: 'F', COLOR: '#EF5350' },
  ];

  await configureStages(categoryId, mainStages);

  // ─── Step 3: Ensure custom deal fields exist ───
  console.log('\n--- Step 3: Custom deal fields ---');
  const existingFields = await callB24('crm.deal.userfield.list');
  const existingFieldNames = (existingFields.result || []).map(f => f.FIELD_NAME);

  const customFields = [
    { FIELD_NAME: 'UF_CRM_KOZA_OWNERSHIP_ID', USER_TYPE_ID: 'string',
      EDIT_FORM_LABEL: { ru: 'koza.vip Ownership ID' }, SORT: 100 },
    { FIELD_NAME: 'UF_CRM_KOZA_ANIMAL_NAME', USER_TYPE_ID: 'string',
      EDIT_FORM_LABEL: { ru: 'Имя животного' }, SORT: 200 },
    { FIELD_NAME: 'UF_CRM_KOZA_ANIMAL_TYPE', USER_TYPE_ID: 'enumeration',
      EDIT_FORM_LABEL: { ru: 'Тип животного' }, SORT: 300,
      LIST: [{ VALUE: 'goat', SORT: 10 }, { VALUE: 'sheep', SORT: 20 }] },
    { FIELD_NAME: 'UF_CRM_KOZA_SHARE_PCT', USER_TYPE_ID: 'integer',
      EDIT_FORM_LABEL: { ru: 'Доля (%)' }, SORT: 400 },
    { FIELD_NAME: 'UF_CRM_KOZA_TARIFF', USER_TYPE_ID: 'string',
      EDIT_FORM_LABEL: { ru: 'Тариф' }, SORT: 500 },
    { FIELD_NAME: 'UF_CRM_KOZA_PROFILE_URL', USER_TYPE_ID: 'url',
      EDIT_FORM_LABEL: { ru: 'Профиль на koza.vip' }, SORT: 600 },
    { FIELD_NAME: 'UF_CRM_KOZA_USER_ID', USER_TYPE_ID: 'string',
      EDIT_FORM_LABEL: { ru: 'koza.vip User ID' }, SORT: 700 },
  ];

  for (const field of customFields) {
    if (existingFieldNames.includes(field.FIELD_NAME)) {
      console.log(`  Field ${field.FIELD_NAME} already exists — skipping`);
    } else {
      try {
        const result = await callB24('crm.deal.userfield.add', { fields: field });
        console.log(`  Created field: ${field.FIELD_NAME} (id: ${result.result})`);
      } catch (e) {
        console.log(`  Field ${field.FIELD_NAME} error: ${e.message}`);
      }
    }
  }

  // ─── Step 4: Renewal funnel ───
  console.log('\n--- Step 4: Renewal funnel ---');
  const existingRenewal = existingCategories.result?.categories?.find(c => c.name === 'Сопровождение и продление');
  let renewalCategoryId;
  
  if (existingRenewal) {
    renewalCategoryId = existingRenewal.id;
    console.log(`  Renewal category already exists: id=${renewalCategoryId}`);
  } else {
    const renewalResult = await callB24('crm.category.add', {
      entityTypeId: 2,
      fields: { name: 'Сопровождение и продление', sort: 200, isDefault: 'N' },
    });
    renewalCategoryId = renewalResult.result?.category?.id;
    console.log(`  Created renewal category: id=${renewalCategoryId}`);
  }

  if (renewalCategoryId) {
    const rPrefix = `C${renewalCategoryId}:`;
    const renewalStages = [
      { STATUS_ID: `${rPrefix}RENEWAL_NOTICE`,    NAME: 'Уведомление о продлении',  SORT: 10, SEMANTICS: 'P', COLOR: '#2FC6F6' },
      { STATUS_ID: `${rPrefix}RENEWAL_CONSULT`,   NAME: 'Консультация по продлению', SORT: 20, SEMANTICS: 'P', COLOR: '#55D0E0' },
      { STATUS_ID: `${rPrefix}RENEWAL_PAYMENT`,   NAME: 'Ожидание оплаты продления', SORT: 30, SEMANTICS: 'P', COLOR: '#FFA726' },
      { STATUS_ID: `${rPrefix}RENEWED`,           NAME: 'Продлено',                  SORT: 40, SEMANTICS: 'S', COLOR: '#4CAF50' },
      { STATUS_ID: `${rPrefix}CHURNED`,           NAME: 'Отток',                     SORT: 50, SEMANTICS: 'F', COLOR: '#EF5350' },
    ];
    await configureStages(renewalCategoryId, renewalStages);
  }

  // ─── Summary ───
  console.log('\n\n=== Setup Complete ===');
  console.log(`Main funnel category ID: ${categoryId}`);
  console.log(`Renewal funnel category ID: ${renewalCategoryId || 'N/A'}`);
  console.log('\nThese IDs should be saved in shared/bitrix24Constants.ts');
}

main().catch(console.error);
