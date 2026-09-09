const TELEGRAM_API = "https://api.telegram.org";
const TARGET_ORIGIN = "https://koza.vip";
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const WORKERS_AI_WHISPER_MODEL = "@cf/openai/whisper";

// Anthropic Messages API через Cloudflare AI Gateway: {AI_GATEWAY_URL}/anthropic/v1/messages
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_DEFAULT_MODELS = {
  sonnet: "claude-sonnet-5",
  haiku: "claude-haiku-4-5",
};
const DEFAULT_MAX_TOKENS = 2048;
const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;
// Инструмент-трюк для response_format json_schema: модель обязана вызвать его,
// а input становится content ответа (строгий JSON без пояснений)
const JSON_OUTPUT_TOOL = "koza_json_output";

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 25_000;
const ANTHROPIC_TIMEOUT_MS = 120_000;
const alertCooldowns = new Map();

const TELEGRAM_REQUEST_HEADERS = ["accept", "content-type", "user-agent"];
const WEBHOOK_REQUEST_HEADERS = [
  "content-type",
  "user-agent",
  "x-telegram-bot-api-secret-token",
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": [
      "Content-Type",
      "Authorization",
      "OpenAI-Organization",
      "OpenAI-Project",
      "X-Proxy-Secret",
      "X-OpenAI-Proxy-Secret",
      "X-Telegram-Bot-Api-Secret-Token",
    ].join(", "),
    "Access-Control-Max-Age": "86400",
  };
}

function copyAllowedHeaders(request, allowedNames) {
  const headers = new Headers();
  for (const name of allowedNames) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function safeUrlForAlert(value) {
  return String(value).replace(/\/bot[^/]+/i, "/bot[REDACTED]");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });
}

async function sendAlert(env, text) {
  if (!env?.ALERT_BOT_TOKEN || !env?.ALERT_CHAT_ID) return;

  const alertKey = text.slice(0, 80);
  const now = Date.now();
  const lastSentAt = alertCooldowns.get(alertKey) || 0;
  if (now - lastSentAt < ALERT_COOLDOWN_MS) return;
  alertCooldowns.set(alertKey, now);

  try {
    await fetch(
      `${TELEGRAM_API}/bot${env.ALERT_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.ALERT_CHAT_ID,
          text: `⚠️ CF Worker Alert\n\n${text}\n\n🕐 ${new Date().toISOString()}`,
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch (error) {
    console.error("Alert send failed:", error?.message || error);
  }
}

async function monitoredFetch(url, init, env, routeName) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;
    const safeUrl = escapeHtml(safeUrlForAlert(url));

    if (response.status >= 500) {
      await sendAlert(
        env,
        `🔴 <b>${escapeHtml(routeName)}</b> upstream error\nStatus: ${response.status}\nURL: ${safeUrl}\nDuration: ${durationMs}ms`,
      );
    }

    if (durationMs > 10_000) {
      await sendAlert(
        env,
        `🟡 <b>${escapeHtml(routeName)}</b> slow response\nDuration: ${durationMs}ms\nURL: ${safeUrl}\nStatus: ${response.status}`,
      );
    }

    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    await sendAlert(
      env,
      `🔴 <b>${escapeHtml(routeName)}</b> ${isTimeout ? "TIMEOUT" : "FAILED"}\nError: ${escapeHtml(error?.message || error)}\nURL: ${escapeHtml(safeUrlForAlert(url))}\nDuration: ${durationMs}ms`,
    );
    throw error;
  }
}

function proxyResponse(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ───────────────────────── Авторизация /openai/* ─────────────────────────

/**
 * Сравнение за постоянное время: crypto.subtle.timingSafeEqual есть в Workers,
 * в Node (тесты) — XOR по байтам. Разная длина всегда false, но время такое же.
 */
export function secretsMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  const sameLength = a.byteLength === b.byteLength;
  const compareWith = sameLength ? a : b;
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(compareWith, b) && sameLength;
  }
  let diff = 0;
  for (let i = 0; i < b.byteLength; i += 1) diff |= compareWith[i] ^ b[i];
  return diff === 0 && sameLength;
}

/** Секрет принимается из X-OpenAI-Proxy-Secret или Authorization: Bearer (так шлёт VDS). */
export function extractProxySecret(request) {
  const explicit = request.headers.get("X-OpenAI-Proxy-Secret");
  if (explicit) return explicit.trim();
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1].trim() : "";
}

function authorizeOpenAI(request, env) {
  if (!env?.OPENAI_PROXY_SECRET) {
    return jsonResponse({ error: { message: "OPENAI_PROXY_SECRET is not configured", type: "proxy_error" } }, 503);
  }
  if (!secretsMatch(extractProxySecret(request), env.OPENAI_PROXY_SECRET)) {
    return jsonResponse({ error: { message: "Unauthorized", type: "proxy_error" } }, 403);
  }
  return null;
}

// ───────────────────────── Маршрутизация моделей ─────────────────────────

export function anthropicConfigured(env) {
  return Boolean(env?.ANTHROPIC_API_KEY && env?.AI_GATEWAY_URL);
}

/**
 * Поле model запроса — alias, не имя модели:
 *   claude-sonnet → Anthropic (ANTHROPIC_MODEL_SONNET), claude-haiku → Anthropic (ANTHROPIC_MODEL_HAIKU),
 *   workers-ai → Llama через env.AI; всё остальное (включая старый gpt-4o-mini) → claude-sonnet.
 * Без ANTHROPIC_API_KEY/AI_GATEWAY_URL Anthropic-alias уходит в Workers AI с пометкой fallback.
 */
export function resolveModelRoute(requestedModel, env) {
  const alias = String(requestedModel || "").trim().toLowerCase();
  if (alias === "workers-ai") {
    return { provider: "workers-ai", alias, model: WORKERS_AI_MODEL, fallback: null };
  }
  const tier = alias === "claude-haiku" ? "haiku" : "sonnet";
  const resolvedAlias = tier === "haiku" ? "claude-haiku" : "claude-sonnet";
  if (!anthropicConfigured(env)) {
    return { provider: "workers-ai", alias: resolvedAlias, model: WORKERS_AI_MODEL, fallback: "anthropic-unconfigured" };
  }
  const configured = tier === "haiku" ? env.ANTHROPIC_MODEL_HAIKU : env.ANTHROPIC_MODEL_SONNET;
  return {
    provider: "anthropic",
    alias: resolvedAlias,
    model: String(configured || ANTHROPIC_DEFAULT_MODELS[tier]).trim(),
    fallback: null,
  };
}

// ───────────────── OpenAI Chat Completions → Anthropic Messages ─────────────────

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  return String(content);
}

function contentBlocks(content) {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  if (!Array.isArray(content)) return content == null ? [] : [{ type: "text", text: String(content) }];
  const blocks = [];
  for (const part of content) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
    } else if (part?.type === "text" && part.text) {
      blocks.push({ type: "text", text: part.text });
    } else if (part?.type === "image_url" && part.image_url?.url) {
      const url = String(part.image_url.url);
      const dataUrl = /^data:([^;]+);base64,(.+)$/s.exec(url);
      blocks.push({
        type: "image",
        source: dataUrl
          ? { type: "base64", media_type: dataUrl[1], data: dataUrl[2] }
          : { type: "url", url },
      });
    }
  }
  return blocks;
}

function parseToolArguments(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { value: parsed };
  } catch {
    return { raw: String(raw) };
  }
}

function convertTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((tool) => tool?.type === "function" && tool.function?.name)
    .map((tool) => ({
      name: tool.function.name,
      ...(tool.function.description ? { description: tool.function.description } : {}),
      input_schema: tool.function.parameters ?? { type: "object", properties: {} },
    }));
}

function convertToolChoice(toolChoice) {
  if (toolChoice == null) return undefined;
  if (toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "required") return { type: "any" };
  if (toolChoice === "none") return null;
  if (typeof toolChoice === "object") {
    const name = toolChoice.function?.name ?? toolChoice.name;
    if (name) return { type: "tool", name };
  }
  return undefined;
}

/**
 * OpenAI Chat Completions → тело Anthropic Messages.
 * system-сообщения объединяются в поле system; tool → tool_result внутри user;
 * assistant.tool_calls → tool_use; соседние сообщения одной роли склеиваются
 * (Anthropic требует чередования и первое сообщение от user).
 */
export function toAnthropicRequest(payload, route) {
  const systemParts = [];
  const messages = [];
  const push = (role, blocks) => {
    if (blocks.length === 0) return;
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content.push(...blocks);
    } else {
      messages.push({ role, content: blocks });
    }
  };

  for (const message of payload.messages ?? []) {
    const role = message?.role;
    if (role === "system" || role === "developer") {
      const text = textOf(message.content);
      if (text) systemParts.push(text);
    } else if (role === "user") {
      push("user", contentBlocks(message.content));
    } else if (role === "assistant") {
      const blocks = contentBlocks(message.content);
      for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
        if (!call?.function?.name) continue;
        blocks.push({
          type: "tool_use",
          id: call.id || `call_${crypto.randomUUID()}`,
          name: call.function.name,
          input: parseToolArguments(call.function.arguments),
        });
      }
      push("assistant", blocks);
    } else if (role === "tool" || role === "function") {
      push("user", [
        {
          type: "tool_result",
          tool_use_id: message.tool_call_id || message.name || "unknown",
          content: textOf(message.content),
        },
      ]);
    }
  }
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({ role: "user", content: [{ type: "text", text: "(продолжай)" }] });
  }

  let tools = convertTools(payload.tools);
  let toolChoice = convertToolChoice(payload.tool_choice);
  if (toolChoice === null) {
    // tool_choice: none — инструменты не предлагаем вовсе
    tools = [];
    toolChoice = undefined;
  }

  // response_format: json_schema — через обязательный инструмент, json_object — инструкцией
  let jsonOutputTool = false;
  const format = payload.response_format;
  if (format?.type === "json_schema" && format.json_schema?.schema) {
    tools = [
      {
        name: JSON_OUTPUT_TOOL,
        description: "Верни итоговый ответ строго в этой JSON-схеме.",
        input_schema: format.json_schema.schema,
      },
    ];
    toolChoice = { type: "tool", name: JSON_OUTPUT_TOOL };
    jsonOutputTool = true;
  } else if (format?.type === "json_object") {
    systemParts.push("Ответ верни строго одним валидным JSON-объектом без пояснений и без markdown.");
  }

  const requestedMax = Number(payload.max_tokens ?? payload.max_completion_tokens);
  const maxTokens = Number.isFinite(requestedMax) && requestedMax > 0 ? Math.floor(requestedMax) : DEFAULT_MAX_TOKENS;

  const body = {
    model: route.model,
    max_tokens: maxTokens,
    messages,
    ...(systemParts.length ? { system: systemParts.join("\n\n") } : {}),
    ...(typeof payload.temperature === "number" ? { temperature: payload.temperature } : {}),
    ...(tools.length ? { tools } : {}),
    ...(tools.length && toolChoice ? { tool_choice: toolChoice } : {}),
    ...(payload.stream === true ? { stream: true } : {}),
  };
  return { body, jsonOutputTool };
}

// ───────────────── Anthropic Messages → OpenAI Chat Completions ─────────────────

export function mapStopReason(stopReason) {
  switch (stopReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    default:
      return stopReason ? "stop" : null;
  }
}

function usageFrom(usage) {
  const prompt = Number(usage?.input_tokens ?? 0);
  const completion = Number(usage?.output_tokens ?? 0);
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

export function fromAnthropicResponse(message, { jsonOutputTool = false } = {}) {
  const texts = [];
  const toolCalls = [];
  let jsonOutput;
  for (const block of Array.isArray(message?.content) ? message.content : []) {
    if (block?.type === "text" && block.text) {
      texts.push(block.text);
    } else if (block?.type === "tool_use") {
      if (jsonOutputTool && block.name === JSON_OUTPUT_TOOL) {
        jsonOutput = JSON.stringify(block.input ?? {});
      } else {
        toolCalls.push({
          id: block.id || `call_${crypto.randomUUID()}`,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }
  }
  const finishReason = jsonOutput ? "stop" : mapStopReason(message?.stop_reason);
  return {
    id: message?.id || `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: message?.model || "",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: jsonOutput ?? (texts.join("") || (toolCalls.length ? null : "")),
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    usage: usageFrom(message?.usage),
  };
}

// ───────────────── SSE Anthropic → SSE OpenAI (без буферизации тела) ─────────────────

/**
 * TransformStream: принимает байты SSE Anthropic, отдаёт байты SSE в формате
 * OpenAI chat.completion.chunk и завершающий `data: [DONE]`.
 */
export function createOpenAiStreamTransformer({ model, jsonOutputTool = false }) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const created = Math.floor(Date.now() / 1000);
  let id = `chatcmpl-${crypto.randomUUID()}`;
  let buffer = "";
  let inputTokens = 0;
  let toolIndexByBlock = new Map();
  let nextToolIndex = 0;
  let finished = false;

  const chunk = (delta, finishReason = null, extra = {}) =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
        ...extra,
      })}\n\n`,
    );

  const handleEvent = (event, controller) => {
    switch (event?.type) {
      case "message_start": {
        if (event.message?.id) id = event.message.id;
        inputTokens = Number(event.message?.usage?.input_tokens ?? 0);
        controller.enqueue(chunk({ role: "assistant", content: "" }));
        break;
      }
      case "content_block_start": {
        const block = event.content_block;
        if (block?.type === "tool_use") {
          if (jsonOutputTool && block.name === JSON_OUTPUT_TOOL) {
            toolIndexByBlock.set(event.index, "json");
          } else {
            const toolIndex = nextToolIndex++;
            toolIndexByBlock.set(event.index, toolIndex);
            controller.enqueue(
              chunk({
                tool_calls: [
                  { index: toolIndex, id: block.id, type: "function", function: { name: block.name, arguments: "" } },
                ],
              }),
            );
          }
        } else if (block?.type === "text" && block.text) {
          controller.enqueue(chunk({ content: block.text }));
        }
        break;
      }
      case "content_block_delta": {
        const delta = event.delta;
        if (delta?.type === "text_delta" && delta.text) {
          controller.enqueue(chunk({ content: delta.text }));
        } else if (delta?.type === "input_json_delta" && delta.partial_json) {
          const toolIndex = toolIndexByBlock.get(event.index);
          if (toolIndex === "json") {
            controller.enqueue(chunk({ content: delta.partial_json }));
          } else if (toolIndex !== undefined) {
            controller.enqueue(chunk({ tool_calls: [{ index: toolIndex, function: { arguments: delta.partial_json } }] }));
          }
        }
        break;
      }
      case "message_delta": {
        const outputTokens = Number(event.usage?.output_tokens ?? 0);
        const stopReason = event.delta?.stop_reason;
        const finishReason = jsonOutputTool && stopReason === "tool_use" ? "stop" : mapStopReason(stopReason);
        controller.enqueue(
          chunk({}, finishReason, {
            usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
          }),
        );
        break;
      }
      case "message_stop": {
        finished = true;
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        break;
      }
      case "error": {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: { message: String(event.error?.message || "upstream error"), type: event.error?.type || "anthropic_error" } })}\n\n`),
        );
        finished = true;
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        break;
      }
      default:
        break;
    }
  };

  const consumeBuffer = (controller, flush = false) => {
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLines = raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) continue;
      try {
        handleEvent(JSON.parse(dataLines.join("\n")), controller);
      } catch (error) {
        console.error("SSE parse error:", error?.message || error);
      }
    }
    if (flush && buffer.trim()) {
      const dataLines = buffer.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
      buffer = "";
      if (dataLines.length) {
        try {
          handleEvent(JSON.parse(dataLines.join("\n")), controller);
        } catch {
          /* хвост без валидного JSON игнорируем */
        }
      }
    }
  };

  return new TransformStream({
    transform(bytes, controller) {
      buffer += decoder.decode(bytes, { stream: true });
      consumeBuffer(controller);
    },
    flush(controller) {
      buffer += decoder.decode();
      consumeBuffer(controller, true);
      if (!finished) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    },
  });
}

// ───────────────────────── Вызовы провайдеров ─────────────────────────

function anthropicHeaders(env) {
  const headers = {
    "content-type": "application/json",
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (env.AI_GATEWAY_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.AI_GATEWAY_TOKEN}`;
  return headers;
}

function anthropicMessagesUrl(env) {
  return `${String(env.AI_GATEWAY_URL).replace(/\/+$/, "")}/anthropic/v1/messages`;
}

function sanitizeUpstreamText(value) {
  return String(value ?? "")
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .slice(0, 400);
}

/** Workers AI (Llama) в OpenAI-формате — текущая логика, без stream и без Anthropic-блоков. */
async function runWorkersAi(env, payload, route, extraHeaders = {}) {
  if (!env?.AI?.run) {
    return jsonResponse({ error: { message: "Workers AI binding 'AI' is not configured", type: "proxy_error" } }, 503, extraHeaders);
  }
  const maxTokens = Math.min(
    Math.max(Number(payload.max_tokens ?? payload.max_completion_tokens ?? 1024), 1),
    4096,
  );
  const messages = (payload.messages ?? [])
    .filter((message) => ["system", "user", "assistant"].includes(message?.role))
    .map((message) => ({ role: message.role, content: textOf(message.content) }));
  const aiInput = {
    messages,
    max_tokens: maxTokens,
    ...(typeof payload.temperature === "number" ? { temperature: payload.temperature } : {}),
    ...(Array.isArray(payload.tools) ? { tools: payload.tools } : {}),
    ...(payload.tool_choice ? { tool_choice: payload.tool_choice } : {}),
    ...(payload.response_format ? { response_format: payload.response_format } : {}),
  };

  const result = await env.AI.run(WORKERS_AI_MODEL, aiInput);
  const completion = result?.choices
    ? result
    : {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: WORKERS_AI_MODEL,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: String(result?.response ?? result?.result?.response ?? ""),
            },
            finish_reason: "stop",
          },
        ],
        usage: result?.usage,
      };
  return jsonResponse(completion, 200, {
    "X-Koza-Provider": "workers-ai",
    "X-Koza-Model": WORKERS_AI_MODEL,
    "X-Koza-Requested-Model": route.alias,
    ...extraHeaders,
  });
}

async function workersAiFallback(env, payload, route, reason, detail) {
  await sendAlert(
    env,
    `🟡 <b>Anthropic</b> fallback → Workers AI\nReason: ${escapeHtml(reason)}\nModel: ${escapeHtml(route.model)}\n${escapeHtml(sanitizeUpstreamText(detail)).slice(0, 200)}`,
  );
  try {
    return await runWorkersAi(env, payload, route, { "X-Koza-Fallback": "workers-ai", "X-Koza-Fallback-Reason": reason });
  } catch (error) {
    return jsonResponse(
      { error: { message: `Anthropic ${reason}; Workers AI fallback failed: ${sanitizeUpstreamText(error?.message || error)}`, type: "proxy_error" } },
      502,
      { "X-Koza-Fallback": "workers-ai", "X-Koza-Fallback-Reason": reason },
    );
  }
}

async function handleChatCompletions(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: { message: "Request body must be JSON", type: "invalid_request_error" } }, 400);
  }
  if (!Array.isArray(payload?.messages) || payload.messages.length === 0) {
    return jsonResponse({ error: { message: "messages must be a non-empty array", type: "invalid_request_error" } }, 400);
  }

  const route = resolveModelRoute(payload.model, env);
  if (route.provider === "workers-ai") {
    try {
      return await runWorkersAi(env, payload, route, route.fallback ? { "X-Koza-Fallback": "workers-ai", "X-Koza-Fallback-Reason": route.fallback } : {});
    } catch (error) {
      await sendAlert(env, `🔴 <b>Workers AI</b> FAILED\nError: ${escapeHtml(error?.message || error)}`);
      return jsonResponse({ error: { message: `Workers AI error: ${sanitizeUpstreamText(error?.message || error)}`, type: "proxy_error" } }, 502);
    }
  }

  const { body, jsonOutputTool } = toAnthropicRequest(payload, route);
  let upstream;
  try {
    upstream = await fetch(anthropicMessagesUrl(env), {
      method: "POST",
      headers: anthropicHeaders(env),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
    });
  } catch (error) {
    return workersAiFallback(env, payload, route, "network_error", error?.message || error);
  }

  const providerHeaders = {
    "X-Koza-Provider": "anthropic",
    "X-Koza-Model": route.model,
    "X-Koza-Requested-Model": route.alias,
  };

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    if (upstream.status === 429 || upstream.status >= 500) {
      return workersAiFallback(env, payload, route, `upstream_${upstream.status}`, text);
    }
    // 400/401/403 и прочие клиентские ошибки: без fallback, тело санитизировано
    let upstreamError = null;
    try {
      upstreamError = JSON.parse(text)?.error ?? null;
    } catch {
      upstreamError = null;
    }
    return jsonResponse(
      {
        error: {
          message: sanitizeUpstreamText(upstreamError?.message || text || upstream.statusText),
          type: upstreamError?.type || "anthropic_error",
          provider: "anthropic",
          status: upstream.status,
        },
      },
      upstream.status,
      providerHeaders,
    );
  }

  if (body.stream) {
    const transformer = createOpenAiStreamTransformer({ model: route.model, jsonOutputTool });
    return new Response(upstream.body.pipeThrough(transformer), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        ...providerHeaders,
      },
    });
  }

  let message;
  try {
    message = await upstream.json();
  } catch (error) {
    return workersAiFallback(env, payload, route, "invalid_upstream_json", error?.message || error);
  }
  return jsonResponse(fromAnthropicResponse(message, { jsonOutputTool }), 200, providerHeaders);
}

// ───────────────────────── Транскрипция ─────────────────────────

async function handleTranscription(request, env) {
  if (!env?.AI?.run) {
    return jsonResponse({ error: { message: "Workers AI binding 'AI' is not configured", type: "proxy_error" } }, 503);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: { message: "Expected multipart/form-data with a file field", type: "invalid_request_error" } }, 400);
  }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return jsonResponse({ error: { message: "file field is required", type: "invalid_request_error" } }, 400);
  }
  if (file.size > MAX_TRANSCRIPTION_BYTES) {
    return jsonResponse({ error: { message: "file exceeds 25 MB", type: "invalid_request_error" } }, 413);
  }
  try {
    const audio = [...new Uint8Array(await file.arrayBuffer())];
    const result = await env.AI.run(WORKERS_AI_WHISPER_MODEL, { audio });
    const text = String(result?.text ?? "").trim();
    return jsonResponse(
      {
        text,
        ...(typeof result?.word_count === "number" ? { word_count: result.word_count } : {}),
        ...(Array.isArray(result?.words) ? { words: result.words } : {}),
      },
      200,
      { "X-Koza-Provider": "workers-ai", "X-Koza-Model": WORKERS_AI_WHISPER_MODEL },
    );
  } catch (error) {
    await sendAlert(env, `🔴 <b>Workers AI whisper</b> FAILED\nError: ${escapeHtml(error?.message || error)}`);
    return jsonResponse({ error: { message: `Transcription error: ${sanitizeUpstreamText(error?.message || error)}`, type: "proxy_error" } }, 502);
  }
}

async function handleOpenAI(request, url, env) {
  const denied = authorizeOpenAI(request, env);
  if (denied) return denied;

  if (request.method !== "POST") {
    return jsonResponse({ error: { message: "Only POST is supported", type: "invalid_request_error" } }, 405);
  }
  if (url.pathname === "/openai/v1/chat/completions") {
    return handleChatCompletions(request, env);
  }
  if (url.pathname === "/openai/v1/audio/transcriptions") {
    return handleTranscription(request, env);
  }
  return jsonResponse(
    { error: { message: "Supported routes: POST /openai/v1/chat/completions, POST /openai/v1/audio/transcriptions", type: "invalid_request_error" } },
    404,
  );
}

// ───────────────────────── Health, Telegram ─────────────────────────

async function handleHealth(env) {
  const checks = {};

  try {
    const response = await fetch(`${TELEGRAM_API}/bot0:fake/getMe`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    checks.telegram_api = response.status === 401
      ? "reachable"
      : `status_${response.status}`;
  } catch (error) {
    checks.telegram_api = `unreachable: ${error?.message || error}`;
  }

  checks.workers_ai = env?.AI?.run ? "binding_configured" : "binding_missing";
  checks.anthropic = anthropicConfigured(env) ? "configured" : "unconfigured";

  try {
    const response = await fetch(`${TARGET_ORIGIN}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    checks.vds = response.status < 500
      ? "reachable"
      : `status_${response.status}`;
  } catch (error) {
    checks.vds = `unreachable: ${error?.message || error}`;
  }

  const healthy =
    checks.telegram_api === "reachable" &&
    checks.workers_ai === "binding_configured" &&
    checks.vds === "reachable";

  return new Response(
    JSON.stringify(
      {
        status: healthy ? "healthy" : "degraded",
        worker: "tg-proxy",
        timestamp: new Date().toISOString(),
        checks,
      },
      null,
      2,
    ),
    {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleTelegramSdk(request, url, env) {
  const sdkPath = url.pathname.slice("/sdk".length);
  const targetUrl = `https://telegram.org/js${sdkPath}`;
  const headers = copyAllowedHeaders(request, ["user-agent"]);

  try {
    const response = await monitoredFetch(
      targetUrl,
      { method: "GET", headers },
      env,
      "Telegram SDK Proxy",
    );
    return proxyResponse(response, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    });
  } catch (error) {
    return new Response(`// SDK proxy error: ${error?.message || error}`, {
      status: 502,
      headers: { "Content-Type": "application/javascript" },
    });
  }
}

async function handleWebhook(request, url, env) {
  const relayPath = url.pathname.slice("/webhook".length);
  const targetUrl = `${TARGET_ORIGIN}${relayPath}${url.search}`;
  const headers = copyAllowedHeaders(request, WEBHOOK_REQUEST_HEADERS);
  const init = { method: request.method, headers };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  try {
    const response = await monitoredFetch(
      targetUrl,
      init,
      env,
      "Webhook Relay",
    );
    return proxyResponse(response);
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: `Webhook relay error: ${error?.message || error}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function handleTelegramApi(request, url, env) {
  if (env?.PROXY_SECRET) {
    const providedSecret = request.headers.get("X-Proxy-Secret");
    if (providedSecret !== env.PROXY_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const targetUrl = `${TELEGRAM_API}${url.pathname}${url.search}`;
  const headers = copyAllowedHeaders(request, TELEGRAM_REQUEST_HEADERS);
  const init = { method: request.method, headers };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  try {
    const response = await monitoredFetch(
      targetUrl,
      init,
      env,
      "Telegram API Proxy",
    );
    return proxyResponse(response, { "Access-Control-Allow-Origin": "*" });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: `Proxy error: ${error?.message || error}` }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleHealth(env);
    }
    if (url.pathname.startsWith("/openai/")) {
      return handleOpenAI(request, url, env);
    }
    if (url.pathname.startsWith("/sdk/")) {
      return handleTelegramSdk(request, url, env);
    }
    if (url.pathname.startsWith("/webhook/")) {
      return handleWebhook(request, url, env);
    }
    return handleTelegramApi(request, url, env);
  },
};
