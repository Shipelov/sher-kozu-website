import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, describe, it } from "node:test";

import worker from "../src/worker.js";

const sourceUrl = new URL("../src/worker.js", import.meta.url);
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("export provenance and secret hygiene", () => {
  it("matches the normalized active-export checksum", async () => {
    const source = (await readFile(sourceUrl, "utf8")).replace(/\r\n/g, "\n");
    const digest = createHash("sha256").update(source).digest("hex");

    assert.equal(
      digest,
      "ba8a594609c0ab0460e864796f3a620b91ecbf92da9e45c96aab332992297b52",
    );
  });

  it("contains secret references but no common literal credential formats", async () => {
    const source = await readFile(sourceUrl, "utf8");

    for (const name of [
      "ALERT_BOT_TOKEN",
      "ALERT_CHAT_ID",
      "OPENAI_PROXY_SECRET",
      "PROXY_SECRET",
    ]) {
      assert.match(source, new RegExp(`env\\?*\\.${name}`));
    }

    assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(source, /\d{8,}:[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(source, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  });
});

describe("route contract", () => {
  it("returns CORS preflight without calling an upstream", async () => {
    globalThis.fetch = async () => {
      throw new Error("upstream must not be called");
    };

    const response = await worker.fetch(
      new Request("https://worker.test/anything", { method: "OPTIONS" }),
      {},
    );

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  });

  it("reports healthy when Telegram, Workers AI, and VDS checks pass", async () => {
    globalThis.fetch = async input => {
      const url = String(input);
      if (url === "https://api.telegram.org/bot0:fake/getMe") {
        return new Response("unauthorized", { status: 401 });
      }
      if (url === "https://koza.vip/api/health") {
        return Response.json({ status: "ok" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.test/health"),
      { AI: { run: async () => ({ response: "ok" }) } },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "healthy");
    assert.deepEqual(body.checks, {
      telegram_api: "reachable",
      workers_ai: "binding_configured",
      vds: "reachable",
    });
  });

  it("rejects an unauthorized AI request", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
      }),
      { AI: { run: async () => ({ response: "must not run" }) } },
    );

    assert.equal(response.status, 403);
  });

  it("maps an authorized OpenAI-compatible request to the locked Workers AI model", async () => {
    let receivedModel;
    let receivedInput;
    const env = {
      AI: {
        run: async (model, input) => {
          receivedModel = model;
          receivedInput = input;
          return { response: "Проверенный ответ", usage: { total_tokens: 12 } };
        },
      },
    };

    const response = await worker.fetch(
      new Request("https://worker.test/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "89.111.165.77",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 99_999,
          temperature: 0.2,
        }),
      }),
      env,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedModel, "@cf/meta/llama-3.1-8b-instruct-fast");
    assert.equal(receivedInput.max_tokens, 4096);
    assert.equal(receivedInput.temperature, 0.2);
    assert.equal(body.choices[0].message.content, "Проверенный ответ");
  });

  it("requires the exact AI route and POST method", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/openai/v1/chat/completions", {
        method: "GET",
        headers: { "CF-Connecting-IP": "89.111.165.77" },
      }),
      { AI: { run: async () => ({ response: "must not run" }) } },
    );

    assert.equal(response.status, 404);
  });

  it("enforces PROXY_SECRET on the Telegram catch-all route", async () => {
    let upstreamCalled = false;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ ok: true });
    };

    const rejected = await worker.fetch(
      new Request("https://worker.test/bot123/getMe"),
      { PROXY_SECRET: "expected-secret" },
    );

    assert.equal(rejected.status, 403);
    assert.equal(upstreamCalled, false);
  });

  it("forwards only allowlisted headers to the Telegram API", async () => {
    let receivedUrl;
    let receivedHeaders;
    globalThis.fetch = async (input, init) => {
      receivedUrl = String(input);
      receivedHeaders = new Headers(init?.headers);
      return Response.json({ ok: true });
    };

    const response = await worker.fetch(
      new Request("https://worker.test/bot123/sendMessage", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "must-not-be-forwarded",
          "Content-Type": "application/json",
          "X-Proxy-Secret": "expected-secret",
        },
        body: "{}",
      }),
      { PROXY_SECRET: "expected-secret" },
    );

    assert.equal(response.status, 200);
    assert.equal(receivedUrl, "https://api.telegram.org/bot123/sendMessage");
    assert.equal(receivedHeaders.get("accept"), "application/json");
    assert.equal(receivedHeaders.get("content-type"), "application/json");
    assert.equal(receivedHeaders.get("authorization"), null);
    assert.equal(receivedHeaders.get("x-proxy-secret"), null);
  });

  it("relays webhook requests only to the fixed koza.vip origin", async () => {
    let receivedUrl;
    let receivedHeaders;
    globalThis.fetch = async (input, init) => {
      receivedUrl = String(input);
      receivedHeaders = new Headers(init?.headers);
      return Response.json({ ok: true });
    };

    const response = await worker.fetch(
      new Request("https://worker.test/webhook/api/telegram/webhook?source=cf", {
        method: "POST",
        headers: {
          Authorization: "must-not-be-forwarded",
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": "telegram-secret",
        },
        body: "{}",
      }),
      {},
    );

    assert.equal(response.status, 200);
    assert.equal(receivedUrl, "https://koza.vip/api/telegram/webhook?source=cf");
    assert.equal(
      receivedHeaders.get("x-telegram-bot-api-secret-token"),
      "telegram-secret",
    );
    assert.equal(receivedHeaders.get("authorization"), null);
  });
});
