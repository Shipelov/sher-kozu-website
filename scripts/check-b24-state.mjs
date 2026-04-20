import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.BITRIX24_BASE_URL.replace(/\/+$/, "");
const USER = process.env.BITRIX24_REST_USER_ID;
const TOKEN = process.env.BITRIX24_WEBHOOK_TOKEN;
const WEBHOOK = `${BASE}/rest/${USER}/${TOKEN}`;

async function call(method, body = {}) {
  const res = await fetch(`${WEBHOOK}/${method}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// 1. All categories
const cats = await call("crm.dealcategory.list");
console.log("=== Categories ===");
for (const c of cats.result || []) {
  console.log(`  [${c.ID}] "${c.NAME}" (sort: ${c.SORT})`);
}

// 2. Stages for each category
for (const c of [{ ID: 0 }, ...(cats.result || [])]) {
  const stages = await call("crm.dealcategory.stage.list", { id: c.ID });
  console.log(`\n=== Stages for category ${c.ID} ===`);
  for (const s of stages.result || []) {
    console.log(`  [${s.STATUS_ID}] "${s.NAME}" (sort: ${s.SORT}, sem: ${s.SEMANTICS})`);
  }
}

// 3. Custom fields
const ufs = await call("crm.deal.userfield.list");
console.log("\n=== Custom Deal Fields ===");
for (const f of ufs.result || []) {
  console.log(`  [${f.ID}] ${f.FIELD_NAME} "${f.EDIT_FORM_LABEL?.ru || f.LIST_COLUMN_LABEL?.ru || "?"}" (type: ${f.USER_TYPE_ID})`);
}
