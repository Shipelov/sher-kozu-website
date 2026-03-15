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

describe("Bitrix24 webhook secrets", () => {
  it("builds a valid webhook base url from env", () => {
    const webhookBaseUrl = buildWebhookBaseUrl();
    expect(webhookBaseUrl).toBe("https://b24-gzcp0i.bitrix24.ru/rest/1/uxr9ddazn99a4pbv");
  });

  it("responds to a lightweight profile call with configured webhook", async () => {
    const webhookBaseUrl = buildWebhookBaseUrl();
    const response = await fetch(`${webhookBaseUrl}/profile.json`);

    expect(response.ok).toBe(true);

    const payload = await response.json();
    expect(payload).toHaveProperty("result");
    expect(payload.result).toHaveProperty("ID");
  }, 20000);
});
