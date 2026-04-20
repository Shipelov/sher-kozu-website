/**
 * Fix Bitrix24 stages: rename system stages, delete C1:NEW with FORCED,
 * reorder WON to allow creating intermediate stages, then create missing ones.
 * 
 * Run: node scripts/fix-bitrix24-stages.mjs
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
    throw new Error(`${method}: ${json?.error_description || json?.error}`);
  }
  return json;
}

async function fixFunnel(categoryId, targetStages) {
  const entityId = categoryId === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${categoryId}`;
  const prefix = `C${categoryId}:`;
  
  console.log(`\n=== Fixing funnel for category ${categoryId} (${entityId}) ===`);
  
  // Get current stages
  const current = await callB24('crm.status.list', { filter: { ENTITY_ID: entityId } });
  const stages = current.result || [];
  console.log('Current stages:');
  for (const s of stages) {
    console.log(`  [${s.ID}] ${s.STATUS_ID} "${s.NAME}" sort=${s.SORT}`);
  }

  // Step 1: Delete C{n}:NEW with FORCED=Y
  const newStage = stages.find(s => s.STATUS_ID === `${prefix}NEW`);
  if (newStage) {
    try {
      await callB24('crm.status.delete', { id: newStage.ID, params: { FORCED: 'Y' } });
      console.log(`\n  Deleted ${prefix}NEW with FORCED=Y`);
    } catch (e) {
      console.log(`\n  Could not delete ${prefix}NEW: ${e.message}`);
      // Try alternative format
      try {
        await callB24('crm.status.delete', { id: newStage.ID, FORCED: 'Y' });
        console.log(`  Deleted ${prefix}NEW with alt format`);
      } catch (e2) {
        console.log(`  Alt format also failed: ${e2.message}`);
      }
    }
  }

  // Step 2: Move WON to sort=200 to make room for intermediate stages
  const wonStage = stages.find(s => s.STATUS_ID === `${prefix}WON`);
  if (wonStage) {
    await callB24('crm.status.update', {
      id: wonStage.ID,
      fields: { SORT: 200 },
    });
    console.log(`  Moved ${prefix}WON to sort=200`);
  }

  // Step 3: Create missing intermediate stages (before WON)
  const currentIds = stages.map(s => s.STATUS_ID);
  for (const stage of targetStages) {
    if (stage.SEMANTICS === 'S' || stage.SEMANTICS === 'F') continue; // Skip success/fail for now
    if (currentIds.includes(stage.STATUS_ID)) continue; // Already exists
    
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
      console.log(`  Created: ${stage.STATUS_ID} → "${stage.NAME}" (id: ${result.result})`);
    } catch (e) {
      console.log(`  Error creating ${stage.STATUS_ID}: ${e.message}`);
    }
  }

  // Step 4: Rename and reorder WON and LOSE to match our target
  const successTarget = targetStages.find(s => s.SEMANTICS === 'S');
  const failTargets = targetStages.filter(s => s.SEMANTICS === 'F');
  
  if (wonStage && successTarget) {
    await callB24('crm.status.update', {
      id: wonStage.ID,
      fields: { NAME: successTarget.NAME, SORT: successTarget.SORT, COLOR: successTarget.COLOR },
    });
    console.log(`  Renamed WON → "${successTarget.NAME}" (sort: ${successTarget.SORT})`);
  }

  const loseStage = stages.find(s => s.STATUS_ID === `${prefix}LOSE`);
  if (loseStage && failTargets.length > 0) {
    // Rename LOSE to the first fail target
    const firstFail = failTargets[0];
    await callB24('crm.status.update', {
      id: loseStage.ID,
      fields: { NAME: firstFail.NAME, SORT: firstFail.SORT, COLOR: firstFail.COLOR },
    });
    console.log(`  Renamed LOSE → "${firstFail.NAME}" (sort: ${firstFail.SORT})`);
  }

  // Step 5: Create additional fail stages if needed (e.g., FROZEN)
  for (const failTarget of failTargets.slice(1)) {
    if (!currentIds.includes(failTarget.STATUS_ID)) {
      try {
        const result = await callB24('crm.status.add', {
          fields: {
            ENTITY_ID: entityId,
            STATUS_ID: failTarget.STATUS_ID,
            NAME: failTarget.NAME,
            SORT: failTarget.SORT,
            COLOR: failTarget.COLOR,
            EXTRA: { SEMANTICS: failTarget.SEMANTICS },
          },
        });
        console.log(`  Created fail stage: ${failTarget.STATUS_ID} → "${failTarget.NAME}" (id: ${result.result})`);
      } catch (e) {
        console.log(`  Error creating ${failTarget.STATUS_ID}: ${e.message}`);
      }
    }
  }

  // Verify final state
  const verify = await callB24('crm.status.list', { filter: { ENTITY_ID: entityId } });
  console.log(`\n  Final stages:`);
  for (const s of (verify.result || []).sort((a, b) => a.SORT - b.SORT)) {
    console.log(`    [${s.ID}] ${s.STATUS_ID} "${s.NAME}" sort=${s.SORT} color=${s.COLOR}`);
  }
}

async function main() {
  // ─── Main funnel (category 1) ───
  const mainStages = [
    { STATUS_ID: 'C1:NEW_REQUEST',       NAME: 'Новая заявка',           SORT: 10,  SEMANTICS: 'P', COLOR: '#2FC6F6' },
    { STATUS_ID: 'C1:CONSULTATION',      NAME: 'Консультация',           SORT: 20,  SEMANTICS: 'P', COLOR: '#55D0E0' },
    { STATUS_ID: 'C1:AWAITING_PAYMENT',  NAME: 'Ожидание оплаты',        SORT: 30,  SEMANTICS: 'P', COLOR: '#FFA726' },
    { STATUS_ID: 'C1:PAYMENT_RECEIVED',  NAME: 'Оплата получена',        SORT: 40,  SEMANTICS: 'P', COLOR: '#66BB6A' },
    { STATUS_ID: 'C1:CABINET_SETUP',     NAME: 'Настройка кабинета',     SORT: 50,  SEMANTICS: 'P', COLOR: '#AB47BC' },
    { STATUS_ID: 'C1:FIRST_DELIVERY',    NAME: 'Первая доставка',        SORT: 60,  SEMANTICS: 'P', COLOR: '#7E57C2' },
    { STATUS_ID: 'C1:ACTIVE_OWNER',      NAME: 'Активный владелец',      SORT: 70,  SEMANTICS: 'S', COLOR: '#4CAF50' },
    { STATUS_ID: 'C1:FROZEN',            NAME: 'Заморожен',              SORT: 80,  SEMANTICS: 'F', COLOR: '#78909C' },
    { STATUS_ID: 'C1:LOST',              NAME: 'Отказ',                  SORT: 90,  SEMANTICS: 'F', COLOR: '#EF5350' },
  ];
  await fixFunnel(1, mainStages);

  // ─── Renewal funnel (category 3) ───
  const renewalStages = [
    { STATUS_ID: 'C3:RENEWAL_NOTICE',    NAME: 'Уведомление о продлении',  SORT: 10, SEMANTICS: 'P', COLOR: '#2FC6F6' },
    { STATUS_ID: 'C3:RENEWAL_CONSULT',   NAME: 'Консультация по продлению', SORT: 20, SEMANTICS: 'P', COLOR: '#55D0E0' },
    { STATUS_ID: 'C3:RENEWAL_PAYMENT',   NAME: 'Ожидание оплаты продления', SORT: 30, SEMANTICS: 'P', COLOR: '#FFA726' },
    { STATUS_ID: 'C3:RENEWED',           NAME: 'Продлено',                  SORT: 40, SEMANTICS: 'S', COLOR: '#4CAF50' },
    { STATUS_ID: 'C3:CHURNED',           NAME: 'Отток',                     SORT: 50, SEMANTICS: 'F', COLOR: '#EF5350' },
  ];
  await fixFunnel(3, renewalStages);

  console.log('\n=== All fixes applied ===');
}

main().catch(console.error);
