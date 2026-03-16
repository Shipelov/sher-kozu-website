import { describe, expect, it } from "vitest";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  expect(value, `Missing env ${name}`).toBeTruthy();
  return value as string;
}

function buildWebhookBaseUrl() {
  const baseUrl = getRequiredEnv("BITRIX24_BASE_URL").replace(/\/$/, "");
  const userId = getRequiredEnv("BITRIX24_REST_USER_ID");
  const token = getRequiredEnv("BITRIX24_WEBHOOK_TOKEN");

  return `${baseUrl}/rest/${userId}/${token}`;
}

describe("Bitrix24 CRM scope", () => {
  it("can access CRM dictionaries required for partner lead sync", async () => {
    const webhookBaseUrl = buildWebhookBaseUrl();
    const response = await fetch(`${webhookBaseUrl}/crm.status.list.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          ENTITY_ID: "DEAL_TYPE",
        },
      }),
    });

    expect(response.ok).toBe(true);

    const payload = await response.json();
    expect(payload).toHaveProperty("result");
    expect(Array.isArray(payload.result)).toBe(true);
    expect(payload.result.length).toBeGreaterThan(0);
  }, 20000);

  it("can read CRM field metadata for contacts and deals", async () => {
    const webhookBaseUrl = buildWebhookBaseUrl();

    const [contactResponse, dealResponse] = await Promise.all([
      fetch(`${webhookBaseUrl}/crm.contact.fields.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      fetch(`${webhookBaseUrl}/crm.deal.fields.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    ]);

    expect(contactResponse.ok).toBe(true);
    expect(dealResponse.ok).toBe(true);

    const contactPayload = await contactResponse.json();
    const dealPayload = await dealResponse.json();

    expect(contactPayload.result).toHaveProperty("NAME");
    expect(contactPayload.result).toHaveProperty("LAST_NAME");
    expect(dealPayload.result).toHaveProperty("TITLE");
    expect(dealPayload.result).toHaveProperty("TYPE_ID");
  }, 20000);
});
