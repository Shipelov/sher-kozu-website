import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, describe, it } from "node:test";

import worker, {
  createOpenAiStreamTransformer,
  extractProxySecret,
  fromAnthropicResponse,
  mapStopReason,
  resolveModelRoute,
  secretsMatch,
  toAnthropicRequest,
} from "../src/worker.js";

const sourceUrl = new URL("../src/worker.js", import.meta.url);
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const SECRET = "test-proxy-secret";
const GATEWAY = "https://gateway.ai.cloudflare.com/v1/acc/koza";

function anthropicEnv(overrides = {}) {
  return {
    OPENAI_PROXY_SECRET: SECRET,
    ANTHROPIC_API_KEY: "sk-ant-test-key",
    AI_GATEWAY_URL: GATEWAY,
    AI_GATEWAY_TOKEN: "gateway-token",
    ANTHROPIC_MODEL_SONNET: "claude-sonnet-5",
    ANTHROPIC_MODEL_HAIKU: "claude-haiku-4-5",
    AI: { run: async () => ({ response: "llama fallback" }) },
    ...overrides,
  };
}

function chatRequest(body, headers = {}) {
  return new Request("https://worker.test/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}`, ...headers },
    body: JSON.stringify(body),
  });
}

function anthropicMessage(overrides = {}) {
  return {
    id: "msg_01",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [{ type: "text", text: "Привет из Claude" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 12, output_tokens: 5 },
    ...overrides,
  };
}

/** SSE Anthropic как отдаёт API: event + data, пустая строка между событиями */
function sse(events) {
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}

async function readAll(response) {
  return new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()));
}

function parseOpenAiSse(text) {
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("data:"))
    .map((block) => block.slice(5).trim())
    .map((data) => (data === "[DONE]" ? "[DONE]" : JSON.parse(data)));
}

describe("secret hygiene", () => {
  it("references secrets only through env and contains no literal credentials or IPs", async () => {
    const source = await readFile(sourceUrl, "utf8");
    for (const name of [
      "ALERT_BOT_TOKEN",
      "ALERT_CHAT_ID",
      "OPENAI_PROXY_SECRET",
      "PROXY_SECRET",
      "ANTHROPIC_API_KEY",
      "AI_GATEWAY_URL",
      "AI_GATEWAY_TOKEN",
      "ANTHROPIC_MODEL_SONNET",
      "ANTHROPIC_MODEL_HAIKU",
    ]) {
      assert.match(source, new RegExp(`env\\?*\\.${name}`));
    }
    assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(source, /\d{8,}:[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(source, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
    assert.doesNotMatch(source, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    assert.doesNotMatch(source, /ALLOWED_AI_CLIENT_IPS/);
  });
});

describe("authorization", () => {
  it("accepts the secret from X-OpenAI-Proxy-Secret or Authorization: Bearer", () => {
    assert.equal(extractProxySecret(new Request("https://w/", { headers: { "X-OpenAI-Proxy-Secret": " abc " } })), "abc");
    assert.equal(extractProxySecret(new Request("https://w/", { headers: { Authorization: "Bearer xyz" } })), "xyz");
    assert.equal(extractProxySecret(new Request("https://w/", { headers: { Authorization: "Basic xyz" } })), "");
    assert.equal(extractProxySecret(new Request("https://w/")), "");
  });

  it("compares secrets in constant time and rejects mismatches of any length", () => {
    assert.equal(secretsMatch("secret", "secret"), true);
    assert.equal(secretsMatch("secret", "secreT"), false);
    assert.equal(secretsMatch("secre", "secret"), false);
    assert.equal(secretsMatch("secret-longer", "secret"), false);
    assert.equal(secretsMatch("", "secret"), false);
    assert.equal(secretsMatch("secret", ""), false);
  });

  it("rejects requests without a secret and with a wrong secret, and fails closed without OPENAI_PROXY_SECRET", async () => {
    globalThis.fetch = async () => {
      throw new Error("upstream must not be called");
    };
    const body = { messages: [{ role: "user", content: "hi" }] };

    const noSecret = await worker.fetch(
      new Request("https://worker.test/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
        body: JSON.stringify(body),
      }),
      anthropicEnv(),
    );
    assert.equal(noSecret.status, 403);

    const wrongSecret = await worker.fetch(chatRequest(body, { Authorization: "Bearer wrong" }), anthropicEnv());
    assert.equal(wrongSecret.status, 403);

    const wrongHeaderSecret = await worker.fetch(
      chatRequest(body, { Authorization: "", "X-OpenAI-Proxy-Secret": "wrong" }),
      anthropicEnv(),
    );
    assert.equal(wrongHeaderSecret.status, 403);

    const unconfigured = await worker.fetch(chatRequest(body), anthropicEnv({ OPENAI_PROXY_SECRET: undefined }));
    assert.equal(unconfigured.status, 503);
  });
});

describe("model routing", () => {
  it("maps aliases to providers and falls back to claude-sonnet for unknown and legacy aliases", () => {
    const env = anthropicEnv();
    assert.deepEqual(resolveModelRoute("claude-sonnet", env), { provider: "anthropic", alias: "claude-sonnet", model: "claude-sonnet-5", fallback: null });
    assert.deepEqual(resolveModelRoute("claude-haiku", env), { provider: "anthropic", alias: "claude-haiku", model: "claude-haiku-4-5", fallback: null });
    assert.equal(resolveModelRoute("workers-ai", env).provider, "workers-ai");
    assert.equal(resolveModelRoute("workers-ai", env).model, "@cf/meta/llama-3.1-8b-instruct-fast");
    assert.equal(resolveModelRoute("gpt-4o-mini", env).model, "claude-sonnet-5");
    assert.equal(resolveModelRoute("gpt-4o-mini", env).alias, "claude-sonnet");
    assert.equal(resolveModelRoute("something-else", env).model, "claude-sonnet-5");
    assert.equal(resolveModelRoute(undefined, env).model, "claude-sonnet-5");
  });

  it("uses documented default Anthropic IDs when the model secrets are empty", () => {
    const env = anthropicEnv({ ANTHROPIC_MODEL_SONNET: "", ANTHROPIC_MODEL_HAIKU: undefined });
    assert.equal(resolveModelRoute("claude-sonnet", env).model, "claude-sonnet-5");
    assert.equal(resolveModelRoute("claude-haiku", env).model, "claude-haiku-4-5");
  });

  it("routes Anthropic aliases to Workers AI with a fallback marker when Anthropic is not configured", () => {
    const route = resolveModelRoute("claude-sonnet", anthropicEnv({ ANTHROPIC_API_KEY: undefined }));
    assert.equal(route.provider, "workers-ai");
    assert.equal(route.fallback, "anthropic-unconfigured");
  });
});

describe("OpenAI → Anthropic request conversion", () => {
  const route = { model: "claude-sonnet-5", alias: "claude-sonnet", provider: "anthropic" };

  it("merges system messages, converts tools, tool calls and tool results", () => {
    const { body, jsonOutputTool } = toAnthropicRequest(
      {
        messages: [
          { role: "system", content: "Ты Зоя." },
          { role: "system", content: [{ type: "text", text: "Отвечай кратко." }] },
          { role: "user", content: "Погода?" },
          {
            role: "assistant",
            content: null,
            tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Москва"}' } }],
          },
          { role: "tool", tool_call_id: "call_1", content: '{"temp":21}' },
          { role: "user", content: [{ type: "text", text: "Спасибо" }, { type: "image_url", image_url: { url: "https://example.invalid/a.png" } }] },
        ],
        tools: [
          { type: "function", function: { name: "get_weather", description: "Погода", parameters: { type: "object", properties: { city: { type: "string" } } } } },
        ],
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 500,
      },
      route,
    );

    assert.equal(jsonOutputTool, false);
    assert.equal(body.model, "claude-sonnet-5");
    assert.equal(body.system, "Ты Зоя.\n\nОтвечай кратко.");
    assert.equal(body.max_tokens, 500);
    assert.equal(body.temperature, 0.3);
    assert.deepEqual(body.tools, [
      { name: "get_weather", description: "Погода", input_schema: { type: "object", properties: { city: { type: "string" } } } },
    ]);
    assert.deepEqual(body.tool_choice, { type: "auto" });
    assert.deepEqual(body.messages, [
      { role: "user", content: [{ type: "text", text: "Погода?" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "call_1", name: "get_weather", input: { city: "Москва" } }] },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "call_1", content: '{"temp":21}' },
          { type: "text", text: "Спасибо" },
          { type: "image", source: { type: "url", url: "https://example.invalid/a.png" } },
        ],
      },
    ]);
    assert.equal(body.stream, undefined);
  });

  it("keeps a long Cyrillic tool result (20 KB) intact without throwing", () => {
    const paragraph = "Лакон — молочная порода овец из Франции; молоко идёт на сыр рокфор. ";
    const content = JSON.stringify({ results: [{ title: "Лакон", content: paragraph.repeat(Math.ceil(20_000 / paragraph.length)) }] });
    assert.ok(content.length >= 20_000);
    const { body } = toAnthropicRequest(
      {
        messages: [
          { role: "system", content: "Ты Маша." },
          { role: "user", content: "Чем знамениты лаконы?" },
          { role: "assistant", content: "", tool_calls: [{ id: "call_k", type: "function", function: { name: "search_knowledge", arguments: '{"query":"лаконы"}' } }] },
          { role: "tool", tool_call_id: "call_k", name: "search_knowledge", content },
        ],
        tools: [{ type: "function", function: { name: "search_knowledge", parameters: { type: "object", properties: { query: { type: "string" } } } } }],
        tool_choice: "auto",
      },
      route,
    );
    const toolResult = body.messages[2].content[0];
    assert.equal(toolResult.type, "tool_result");
    assert.equal(toolResult.tool_use_id, "call_k");
    assert.equal(toolResult.content, content);
    assert.equal(body.messages[2].role, "user");
    // Тело сериализуется в валидный JSON заданного размера
    const serialized = JSON.stringify(body);
    assert.ok(new TextEncoder().encode(serialized).length > 30_000);
    assert.deepEqual(JSON.parse(serialized).messages[2].content[0].content.length, content.length);
  });

  it("applies defaults: max_tokens 2048, tool_choice required/none/by-name, stream flag", () => {
    const tools = [{ type: "function", function: { name: "f", parameters: { type: "object" } } }];
    const base = { messages: [{ role: "user", content: "x" }], tools };

    assert.equal(toAnthropicRequest({ messages: [{ role: "user", content: "x" }] }, route).body.max_tokens, 2048);
    assert.deepEqual(toAnthropicRequest({ ...base, tool_choice: "required" }, route).body.tool_choice, { type: "any" });
    assert.deepEqual(toAnthropicRequest({ ...base, tool_choice: { type: "function", function: { name: "f" } } }, route).body.tool_choice, { type: "tool", name: "f" });
    assert.deepEqual(toAnthropicRequest({ ...base, tool_choice: { name: "f" } }, route).body.tool_choice, { type: "tool", name: "f" });
    const none = toAnthropicRequest({ ...base, tool_choice: "none" }, route).body;
    assert.equal(none.tools, undefined);
    assert.equal(none.tool_choice, undefined);
    assert.equal(toAnthropicRequest({ messages: [{ role: "user", content: "x" }], stream: true }, route).body.stream, true);
  });

  it("starts with a user message even if the history begins with the assistant", () => {
    const { body } = toAnthropicRequest({ messages: [{ role: "assistant", content: "Привет!" }] }, route);
    assert.equal(body.messages[0].role, "user");
    assert.equal(body.messages[1].role, "assistant");
  });

  it("implements response_format json_schema through a forced tool and json_object through the system prompt", () => {
    const schema = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] };
    const strict = toAnthropicRequest(
      { messages: [{ role: "user", content: "x" }], response_format: { type: "json_schema", json_schema: { name: "out", schema } } },
      route,
    );
    assert.equal(strict.jsonOutputTool, true);
    assert.deepEqual(strict.body.tool_choice, { type: "tool", name: "koza_json_output" });
    assert.deepEqual(strict.body.tools[0].input_schema, schema);

    const loose = toAnthropicRequest({ messages: [{ role: "user", content: "x" }], response_format: { type: "json_object" } }, route);
    assert.match(loose.body.system, /JSON/);
    assert.equal(loose.jsonOutputTool, false);
  });
});

describe("Anthropic → OpenAI response conversion", () => {
  it("maps text, tool_use blocks, stop reasons and usage", () => {
    const completion = fromAnthropicResponse(
      anthropicMessage({
        content: [
          { type: "text", text: "Смотрю погоду. " },
          { type: "tool_use", id: "toolu_1", name: "get_weather", input: { city: "Москва" } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 40, output_tokens: 9 },
      }),
    );
    assert.equal(completion.object, "chat.completion");
    assert.equal(completion.model, "claude-sonnet-5");
    assert.equal(completion.choices[0].finish_reason, "tool_calls");
    assert.equal(completion.choices[0].message.content, "Смотрю погоду. ");
    assert.deepEqual(completion.choices[0].message.tool_calls, [
      { id: "toolu_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Москва"}' } },
    ]);
    assert.deepEqual(completion.usage, { prompt_tokens: 40, completion_tokens: 9, total_tokens: 49 });

    assert.equal(mapStopReason("end_turn"), "stop");
    assert.equal(mapStopReason("max_tokens"), "length");
    assert.equal(mapStopReason("tool_use"), "tool_calls");
    assert.equal(mapStopReason("stop_sequence"), "stop");
  });

  it("turns the json_schema tool call into plain JSON content", () => {
    const completion = fromAnthropicResponse(
      anthropicMessage({
        content: [{ type: "tool_use", id: "toolu_1", name: "koza_json_output", input: { answer: "42" } }],
        stop_reason: "tool_use",
      }),
      { jsonOutputTool: true },
    );
    assert.equal(completion.choices[0].message.content, '{"answer":"42"}');
    assert.equal(completion.choices[0].message.tool_calls, undefined);
    assert.equal(completion.choices[0].finish_reason, "stop");
  });
});

describe("streaming transcoder", () => {
  const fixture = [
    { type: "message_start", message: { id: "msg_stream", model: "claude-sonnet-5", usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "ping" },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Прив" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ет" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_9", name: "get_weather", input: {} } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"city":' } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '"Москва"}' } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 17 } },
    { type: "message_stop" },
  ];

  async function transcode(sseText, chunkSize) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(sseText);
    const source = new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        }
        controller.close();
      },
    });
    const response = new Response(source.pipeThrough(createOpenAiStreamTransformer({ model: "claude-sonnet-5" })));
    return parseOpenAiSse(await readAll(response));
  }

  it("re-encodes Anthropic SSE into OpenAI chunks with role, content, tool_calls, finish_reason, usage and [DONE]", async () => {
    const chunks = await transcode(sse(fixture), 7);

    assert.deepEqual(chunks[0].choices[0].delta, { role: "assistant", content: "" });
    assert.equal(chunks[0].id, "msg_stream");
    assert.equal(chunks[0].object, "chat.completion.chunk");
    assert.equal(chunks[0].model, "claude-sonnet-5");

    const text = chunks.filter((c) => c !== "[DONE]" && typeof c.choices?.[0]?.delta?.content === "string").map((c) => c.choices[0].delta.content).join("");
    assert.equal(text, "Привет");

    const toolChunks = chunks.filter((c) => c !== "[DONE]" && c.choices?.[0]?.delta?.tool_calls);
    assert.deepEqual(toolChunks[0].choices[0].delta.tool_calls, [
      { index: 0, id: "toolu_9", type: "function", function: { name: "get_weather", arguments: "" } },
    ]);
    const args = toolChunks.slice(1).map((c) => c.choices[0].delta.tool_calls[0].function.arguments).join("");
    assert.equal(args, '{"city":"Москва"}');

    const final = chunks.find((c) => c !== "[DONE]" && c.choices?.[0]?.finish_reason);
    assert.equal(final.choices[0].finish_reason, "tool_calls");
    assert.deepEqual(final.usage, { prompt_tokens: 10, completion_tokens: 17, total_tokens: 27 });
    assert.equal(chunks.at(-1), "[DONE]");
  });

  it("produces identical output regardless of how the bytes are chunked", async () => {
    const whole = await transcode(sse(fixture), 1 << 20);
    const tiny = await transcode(sse(fixture), 3);
    assert.deepEqual(tiny, whole);
  });

  it("appends [DONE] when the upstream ends without message_stop", async () => {
    const chunks = await transcode(sse(fixture.slice(0, 5)), 16);
    assert.equal(chunks.at(-1), "[DONE]");
    assert.equal(chunks.filter((c) => c === "[DONE]").length, 1);
  });
});

describe("chat completions route", () => {
  it("calls Anthropic through the AI Gateway with the expected headers and converts the answer", async () => {
    let received;
    globalThis.fetch = async (input, init) => {
      received = { url: String(input), init, body: JSON.parse(init.body) };
      return Response.json(anthropicMessage());
    };

    const response = await worker.fetch(
      chatRequest({ model: "gpt-4o-mini", messages: [{ role: "system", content: "S" }, { role: "user", content: "Привет" }], max_tokens: 64 }),
      anthropicEnv(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(received.url, `${GATEWAY}/anthropic/v1/messages`);
    const headers = new Headers(received.init.headers);
    assert.equal(headers.get("x-api-key"), "sk-ant-test-key");
    assert.equal(headers.get("anthropic-version"), "2023-06-01");
    assert.equal(headers.get("cf-aig-authorization"), "Bearer gateway-token");
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(received.body.model, "claude-sonnet-5");
    assert.equal(received.body.system, "S");
    assert.equal(body.choices[0].message.content, "Привет из Claude");
    assert.equal(body.usage.prompt_tokens, 12);
    assert.equal(response.headers.get("x-koza-provider"), "anthropic");
    assert.equal(response.headers.get("x-koza-model"), "claude-sonnet-5");
    assert.equal(response.headers.get("x-koza-fallback"), null);
  });

  it("omits cf-aig-authorization when AI_GATEWAY_TOKEN is not set and picks haiku by alias", async () => {
    let received;
    globalThis.fetch = async (input, init) => {
      received = { init, body: JSON.parse(init.body) };
      return Response.json(anthropicMessage({ model: "claude-haiku-4-5" }));
    };
    const response = await worker.fetch(
      chatRequest({ model: "claude-haiku", messages: [{ role: "user", content: "x" }] }),
      anthropicEnv({ AI_GATEWAY_TOKEN: undefined }),
    );
    assert.equal(response.status, 200);
    assert.equal(new Headers(received.init.headers).get("cf-aig-authorization"), null);
    assert.equal(received.body.model, "claude-haiku-4-5");
    assert.equal(response.headers.get("x-koza-model"), "claude-haiku-4-5");
  });

  it("streams: proxies Anthropic SSE as OpenAI chunks with event-stream headers", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(JSON.parse(init.body).stream, true);
      return new Response(
        sse([
          { type: "message_start", message: { id: "msg_s", usage: { input_tokens: 3 } } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    };
    const response = await worker.fetch(
      chatRequest({ model: "claude-sonnet", stream: true, messages: [{ role: "user", content: "x" }] }),
      anthropicEnv(),
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/event-stream/);
    assert.equal(response.headers.get("cache-control"), "no-cache");
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    assert.equal(response.headers.get("x-koza-provider"), "anthropic");
    const chunks = parseOpenAiSse(await readAll(response));
    assert.equal(chunks[1].choices[0].delta.content, "ok");
    assert.equal(chunks[2].choices[0].finish_reason, "stop");
    assert.equal(chunks.at(-1), "[DONE]");
  });

  it("falls back to Workers AI once on Anthropic 5xx and marks the response", async () => {
    let anthropicCalls = 0;
    globalThis.fetch = async () => {
      anthropicCalls += 1;
      return new Response("upstream down", { status: 503 });
    };
    let llamaInput;
    const env = anthropicEnv({
      AI: {
        run: async (model, input) => {
          llamaInput = { model, input };
          return { response: "ответ llama" };
        },
      },
    });
    const response = await worker.fetch(
      chatRequest({ model: "claude-sonnet", messages: [{ role: "system", content: "S" }, { role: "user", content: [{ type: "text", text: "Привет" }] }] }),
      env,
    );
    const body = await response.json();
    assert.equal(anthropicCalls, 1);
    assert.equal(response.status, 200);
    assert.equal(llamaInput.model, "@cf/meta/llama-3.1-8b-instruct-fast");
    assert.deepEqual(llamaInput.input.messages, [{ role: "system", content: "S" }, { role: "user", content: "Привет" }]);
    assert.equal(body.choices[0].message.content, "ответ llama");
    assert.equal(response.headers.get("x-koza-fallback"), "workers-ai");
    assert.equal(response.headers.get("x-koza-provider"), "workers-ai");
    assert.equal(response.headers.get("x-koza-model"), "@cf/meta/llama-3.1-8b-instruct-fast");
  });

  it("falls back to Workers AI on 429 and on network errors", async () => {
    globalThis.fetch = async () => new Response("slow down", { status: 429 });
    const throttled = await worker.fetch(chatRequest({ messages: [{ role: "user", content: "x" }] }), anthropicEnv());
    assert.equal(throttled.headers.get("x-koza-fallback"), "workers-ai");
    assert.equal(throttled.headers.get("x-koza-fallback-reason"), "upstream_429");

    globalThis.fetch = async () => {
      throw new Error("connect ECONNRESET");
    };
    const network = await worker.fetch(chatRequest({ messages: [{ role: "user", content: "x" }] }), anthropicEnv());
    assert.equal(network.status, 200);
    assert.equal(network.headers.get("x-koza-fallback-reason"), "network_error");
  });

  it("does not fall back on 401/400/403 and sanitizes the upstream body", async () => {
    let llamaCalled = false;
    for (const status of [400, 401, 403]) {
      globalThis.fetch = async () =>
        Response.json({ error: { type: "authentication_error", message: `invalid x-api-key sk-ant-api03-verysecretvalue1234567890` } }, { status });
      const env = anthropicEnv({ AI: { run: async () => { llamaCalled = true; return {}; } } });
      const response = await worker.fetch(chatRequest({ messages: [{ role: "user", content: "x" }] }), env);
      const body = await response.json();
      assert.equal(response.status, status);
      assert.equal(body.error.type, "authentication_error");
      assert.equal(body.error.provider, "anthropic");
      assert.doesNotMatch(JSON.stringify(body), /verysecretvalue/);
      assert.equal(response.headers.get("x-koza-fallback"), null);
    }
    assert.equal(llamaCalled, false);
  });

  it("serves the workers-ai alias directly and keeps the legacy max_tokens clamp", async () => {
    let received;
    globalThis.fetch = async () => {
      throw new Error("Anthropic must not be called");
    };
    const env = anthropicEnv({ AI: { run: async (model, input) => { received = { model, input }; return { response: "ok", usage: { total_tokens: 3 } }; } } });
    const response = await worker.fetch(
      chatRequest({ model: "workers-ai", messages: [{ role: "user", content: "x" }], max_tokens: 99_999, temperature: 0.2 }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(received.model, "@cf/meta/llama-3.1-8b-instruct-fast");
    assert.equal(received.input.max_tokens, 4096);
    assert.equal(received.input.temperature, 0.2);
    assert.equal(response.headers.get("x-koza-provider"), "workers-ai");
    assert.equal(response.headers.get("x-koza-fallback"), null);
  });

  it("uses Workers AI with a marker when Anthropic secrets are missing", async () => {
    globalThis.fetch = async () => {
      throw new Error("Anthropic must not be called");
    };
    const response = await worker.fetch(
      chatRequest({ model: "gpt-4o-mini", messages: [{ role: "user", content: "x" }] }),
      anthropicEnv({ ANTHROPIC_API_KEY: undefined, AI_GATEWAY_URL: undefined }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-koza-fallback-reason"), "anthropic-unconfigured");
  });

  it("rejects unsupported routes and methods after authorization", async () => {
    const get = await worker.fetch(
      new Request("https://worker.test/openai/v1/chat/completions", { method: "GET", headers: { Authorization: `Bearer ${SECRET}` } }),
      anthropicEnv(),
    );
    assert.equal(get.status, 405);
    const unknown = await worker.fetch(
      new Request("https://worker.test/openai/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${SECRET}` }, body: "{}" }),
      anthropicEnv(),
    );
    assert.equal(unknown.status, 404);
  });
});

describe("audio transcriptions route", () => {
  it("transcribes a multipart file through Workers AI whisper", async () => {
    let received;
    const env = anthropicEnv({
      AI: {
        run: async (model, input) => {
          received = { model, input };
          return { text: " Привет, ферма ", word_count: 2, words: [] };
        },
      },
    });
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/ogg" }), "voice.ogg");
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    const response = await worker.fetch(
      new Request("https://worker.test/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET}` },
        body: form,
      }),
      env,
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(received.model, "@cf/openai/whisper");
    assert.deepEqual(received.input.audio, [1, 2, 3, 4]);
    assert.equal(body.text, "Привет, ферма");
    assert.equal(response.headers.get("x-koza-model"), "@cf/openai/whisper");
  });

  it("requires the secret and a file field", async () => {
    const form = new FormData();
    form.append("model", "whisper-1");
    const unauthorized = await worker.fetch(
      new Request("https://worker.test/openai/v1/audio/transcriptions", { method: "POST", body: form }),
      anthropicEnv(),
    );
    assert.equal(unauthorized.status, 403);
    const noFile = await worker.fetch(
      new Request("https://worker.test/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${SECRET}` }, body: form }),
      anthropicEnv(),
    );
    assert.equal(noFile.status, 400);
  });
});

describe("other routes stay unchanged", () => {
  it("returns CORS preflight without calling an upstream", async () => {
    globalThis.fetch = async () => {
      throw new Error("upstream must not be called");
    };
    const response = await worker.fetch(new Request("https://worker.test/anything", { method: "OPTIONS" }), {});
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  });

  it("reports healthy when Telegram, Workers AI, and VDS checks pass and shows Anthropic configuration", async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url === "https://api.telegram.org/bot0:fake/getMe") return new Response("unauthorized", { status: 401 });
      if (url === "https://koza.vip/api/health") return Response.json({ status: "ok" });
      throw new Error(`Unexpected URL: ${url}`);
    };
    const response = await worker.fetch(new Request("https://worker.test/health"), { AI: { run: async () => ({ response: "ok" }) } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "healthy");
    assert.deepEqual(body.checks, {
      telegram_api: "reachable",
      workers_ai: "binding_configured",
      anthropic: "unconfigured",
      vds: "reachable",
    });
  });

  it("proxies Telegram without a secret check while PROXY_SECRET is unset (open relay, see docs/ops/TELEGRAM_PROXY_SECRET.md)", async () => {
    let receivedUrl;
    globalThis.fetch = async (input) => {
      receivedUrl = String(input);
      return Response.json({ ok: true });
    };
    const response = await worker.fetch(new Request("https://worker.test/bot123/getMe"), {});
    assert.equal(response.status, 200);
    assert.equal(receivedUrl, "https://api.telegram.org/bot123/getMe");
  });

  it("enforces PROXY_SECRET on the Telegram catch-all route", async () => {
    let upstreamCalled = false;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ ok: true });
    };
    const rejected = await worker.fetch(new Request("https://worker.test/bot123/getMe"), { PROXY_SECRET: "expected-secret" });
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
        headers: { Accept: "application/json", Authorization: "must-not-be-forwarded", "Content-Type": "application/json", "X-Proxy-Secret": "expected-secret" },
        body: "{}",
      }),
      { PROXY_SECRET: "expected-secret" },
    );
    assert.equal(response.status, 200);
    assert.equal(receivedUrl, "https://api.telegram.org/bot123/sendMessage");
    assert.equal(receivedHeaders.get("accept"), "application/json");
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
        headers: { Authorization: "must-not-be-forwarded", "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "telegram-secret" },
        body: "{}",
      }),
      {},
    );
    assert.equal(response.status, 200);
    assert.equal(receivedUrl, "https://koza.vip/api/telegram/webhook?source=cf");
    assert.equal(receivedHeaders.get("x-telegram-bot-api-secret-token"), "telegram-secret");
    assert.equal(receivedHeaders.get("authorization"), null);
  });
});
