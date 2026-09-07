const TELEGRAM_API = "https://api.telegram.org";
const TARGET_ORIGIN = "https://koza.vip";
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const ALLOWED_AI_CLIENT_IPS = new Set(["89.111.165.77"]);

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 25_000;
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

function addCors(responseHeaders) {
  const headers = new Headers(responseHeaders);
  headers.set("Access-Control-Allow-Origin", "*");
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

async function handleOpenAI(request, url, env) {
  const clientIp = request.headers.get("CF-Connecting-IP") || "";
  const providedSecret = request.headers.get("X-OpenAI-Proxy-Secret") || "";
  const validSecret = Boolean(
    env?.OPENAI_PROXY_SECRET && providedSecret === env.OPENAI_PROXY_SECRET,
  );
  if (!ALLOWED_AI_CLIENT_IPS.has(clientIp) && !validSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method !== "POST" || url.pathname !== "/openai/v1/chat/completions") {
    return new Response(
      JSON.stringify({ error: "Only POST /openai/v1/chat/completions is supported" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!env?.AI?.run) {
    return new Response(
      JSON.stringify({ error: "Workers AI binding 'AI' is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const payload = await request.json();
    if (!Array.isArray(payload?.messages) || payload.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages must be a non-empty array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxTokens = Math.min(
      Math.max(Number(payload.max_tokens ?? payload.max_completion_tokens ?? 1024), 1),
      4096,
    );
    const aiInput = {
      messages: payload.messages,
      max_tokens: maxTokens,
      ...(typeof payload.temperature === "number"
        ? { temperature: payload.temperature }
        : {}),
      ...(Array.isArray(payload.tools) ? { tools: payload.tools } : {}),
      ...(payload.tool_choice ? { tool_choice: payload.tool_choice } : {}),
      ...(payload.response_format ? { response_format: payload.response_format } : {}),
    };

    const result = await env.AI.run(WORKERS_AI_MODEL, aiInput);
    const completion = result?.choices
      ? result
      : {
          id: crypto.randomUUID(),
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

    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    await sendAlert(
      env,
      `🔴 <b>Workers AI</b> FAILED\nError: ${escapeHtml(error?.message || error)}`,
    );
    return new Response(
      JSON.stringify({ error: `Workers AI error: ${error?.message || error}` }),
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