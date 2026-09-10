/**
 * LLM helper — OpenAI-compatible API client.
 *
 * Priority: Cloudflare OpenAI proxy > Manus Forge > custom OpenAI > OpenAI.
 * URL and credentials are always selected as an inseparable pair.
 *
 * The request/response format is fully OpenAI Chat Completions compatible,
 * so it works with OpenAI, Azure OpenAI, or any proxy that speaks the same protocol.
 */
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  /** Вызовы инструментов ассистента (только role assistant), формат OpenAI. */
  tool_calls?: ToolCall[];
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  model?: string;
  messages: Message[];
  signal?: AbortSignal;
  timeoutMs?: number;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  maxCompletionTokens?: number;
  max_completion_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") return part;
  if (part.type === "image_url") return part;
  if (part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id, tool_calls } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  const toolCallsPart = tool_calls && tool_calls.length > 0 ? { tool_calls } : {};

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text, ...toolCallsPart };
  }

  return { role, name, content: contentParts, ...toolCallsPart };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }
    if (tools.length > 1) {
      throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    }
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return toolChoice;
};

type LlmConnection = {
  apiUrl: string;
  apiKey: string;
  source: "cloudflare-openai" | "custom-openai" | "forge" | "openai";
};

export type LlmDiagnosticResult = {
  ok: boolean;
  source: LlmConnection["source"] | "unconfigured";
  model: string;
  endpointHost: string;
  endpointPath: string;
  status: number | null;
  latencyMs: number;
  error?: {
    type?: string;
    code?: string;
    message: string;
  };
};

export type LlmPayloadDiagnosticResult = LlmDiagnosticResult & {
  request: {
    messageCount: number;
    contentCharacters: number;
    maxTokens: number;
  };
};

function isCloudflareWorkerUrl(value: string): boolean {
  try {
    return new URL(value).hostname.endsWith(".workers.dev");
  } catch {
    return false;
  }
}

function toOpenAiChatUrl(baseUrl: string, cloudflareWorker = false): string {
  let normalized = baseUrl.replace(/\/+$/, "");
  if (cloudflareWorker) {
    const parsed = new URL(normalized);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (!path.endsWith("/openai")) {
      parsed.pathname = `${path}/openai`.replace(/\/+/g, "/");
      normalized = parsed.toString().replace(/\/+$/, "");
    }
  }
  return `${normalized}/v1/chat/completions`;
}

/**
 * Resolve URL and API key as an inseparable pair.
 *
 * A stale OPENAI_API_KEY must never be sent to the Forge endpoint. This was the
 * cause of production 401 responses for both Masha and Zoya: URL selection and
 * key selection previously used different priority chains.
 */
const resolveConnection = (): LlmConnection => {
  const openaiUrl = ENV.openaiApiUrl.trim();
  const directOpenaiKey = ENV.openaiApiKeyDirect.trim();
  const forgeUrl = ENV.forgeApiUrl.trim();
  const forgeKey = ENV.forgeApiKey.trim();
  const telegramProxyUrl = ENV.telegramApiProxyUrl.trim();

  // The Russian VDS reaches OpenAI through the existing Cloudflare Worker.
  // OPENAI_API_URL may be either the Worker root or its /openai route.
  if (directOpenaiKey && openaiUrl && isCloudflareWorkerUrl(openaiUrl)) {
    return {
      apiUrl: toOpenAiChatUrl(openaiUrl, true),
      apiKey: directOpenaiKey,
      source: "cloudflare-openai",
    };
  }

  // TELEGRAM_API_PROXY_URL points to the same multipurpose Worker and is a
  // durable fallback if OPENAI_API_URL was accidentally reset on the VDS.
  if (
    ENV.isProduction &&
    directOpenaiKey &&
    telegramProxyUrl &&
    isCloudflareWorkerUrl(telegramProxyUrl)
  ) {
    return {
      apiUrl: toOpenAiChatUrl(telegramProxyUrl, true),
      apiKey: directOpenaiKey,
      source: "cloudflare-openai",
    };
  }

  if (forgeUrl && forgeKey && !isCloudflareWorkerUrl(forgeUrl)) {
    return {
      apiUrl: `${forgeUrl.replace(/\/$/, "")}/v1/chat/completions`,
      apiKey: forgeKey,
      source: "forge",
    };
  }

  if (openaiUrl) {
    if (!directOpenaiKey) {
      throw new Error("OPENAI_API_URL is configured but OPENAI_API_KEY is missing.");
    }
    return {
      apiUrl: toOpenAiChatUrl(openaiUrl),
      apiKey: directOpenaiKey,
      source: "custom-openai",
    };
  }

  if (forgeUrl && forgeKey) {
    return {
      apiUrl: toOpenAiChatUrl(forgeUrl, isCloudflareWorkerUrl(forgeUrl)),
      apiKey: forgeKey,
      source: isCloudflareWorkerUrl(forgeUrl) ? "cloudflare-openai" : "forge",
    };
  }

  if (directOpenaiKey) {
    return {
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: directOpenaiKey,
      source: "openai",
    };
  }

  throw new Error(
    "LLM API is not configured. Set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY, or configure OPENAI_API_KEY."
  );
};

// Для Worker поле model — alias: claude-sonnet/claude-haiku/workers-ai, маппинг делает Worker
const defaultModelForConnection = (connection: LlmConnection): string => {
  switch (connection.source) {
    case "forge":
      return "gemini-3-flash-preview";
    case "cloudflare-openai":
      return "claude-sonnet";
    default:
      return "gpt-4o-mini";
  }
};

/**
 * Worker отдаёт фактическую модель и провайдера в X-Koza-Model / X-Koza-Provider;
 * до ответа (или без заголовков) остаётся только alias запроса.
 */
const diagnosticModelLabel = (
  connection: LlmConnection,
  requestModel: string,
  headers?: Headers,
): string => {
  if (connection.source !== "cloudflare-openai") return requestModel;
  const actualModel = headers?.get("x-koza-model");
  const provider = headers?.get("x-koza-provider");
  if (actualModel && provider) {
    const fallback = headers?.get("x-koza-fallback");
    return `${provider}/${actualModel}${fallback ? ` (fallback: ${fallback})` : ""} (request alias: ${requestModel})`;
  }
  return `worker-managed (request alias: ${requestModel})`;
};

export const DEFAULT_MAX_TOKENS = 2048;
export const RETRY_DELAY_MS = 800;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const ERROR_SNIPPET_CHARS = 200;

/** Задержка, прерываемая abort-сигналом, чтобы повтор не пережил отмену. */
const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

const sanitizeDiagnosticText = (value: unknown): string =>
  String(value ?? "Unknown upstream error")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .slice(0, 240);

export async function diagnoseLLMConnection(): Promise<LlmDiagnosticResult> {
  const startedAt = Date.now();
  let connection: LlmConnection;

  try {
    connection = resolveConnection();
  } catch (error) {
    return {
      ok: false,
      source: "unconfigured",
      model: "unknown",
      endpointHost: "",
      endpointPath: "",
      status: null,
      latencyMs: Date.now() - startedAt,
      error: { message: sanitizeDiagnosticText((error as Error)?.message) },
    };
  }

  const endpoint = new URL(connection.apiUrl);
  const requestModel = defaultModelForConnection(connection);
  const model = diagnosticModelLabel(connection, requestModel);

  try {
    const response = await fetch(connection.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.apiKey}`,
      },
      body: JSON.stringify({
        model: requestModel,
        messages: [{ role: "user", content: "Reply with OK" }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const responseText = await response.text();
    const resolvedModel = diagnosticModelLabel(connection, requestModel, response.headers);
    let payload: any = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    const upstreamError = payload?.error;
    return {
      ok: response.ok,
      source: connection.source,
      model: resolvedModel,
      endpointHost: endpoint.hostname,
      endpointPath: endpoint.pathname,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      ...(response.ok
        ? {}
        : {
            error: {
              ...(upstreamError?.type
                ? { type: sanitizeDiagnosticText(upstreamError.type) }
                : {}),
              ...(upstreamError?.code
                ? { code: sanitizeDiagnosticText(upstreamError.code) }
                : {}),
              message: sanitizeDiagnosticText(
                upstreamError?.message || responseText || response.statusText,
              ),
            },
          }),
    };
  } catch (error) {
    return {
      ok: false,
      source: connection.source,
      model,
      endpointHost: endpoint.hostname,
      endpointPath: endpoint.pathname,
      status: null,
      latencyMs: Date.now() - startedAt,
      error: { message: sanitizeDiagnosticText((error as Error)?.message) },
    };
  }
}

/**
 * Diagnose a real text-only chat payload without returning prompt contents,
 * credentials, request headers, or the generated completion.
 */
export async function diagnoseLLMPayload(
  messages: Message[],
  maxTokens = 1024,
): Promise<LlmPayloadDiagnosticResult> {
  const startedAt = Date.now();
  const request = {
    messageCount: messages.length,
    contentCharacters: messages.reduce(
      (total, message) => total + JSON.stringify(message.content).length,
      0,
    ),
    maxTokens,
  };
  let connection: LlmConnection;

  try {
    connection = resolveConnection();
  } catch (error) {
    return {
      ok: false,
      source: "unconfigured",
      model: "unknown",
      endpointHost: "",
      endpointPath: "",
      status: null,
      latencyMs: Date.now() - startedAt,
      error: { message: sanitizeDiagnosticText((error as Error)?.message) },
      request,
    };
  }

  const endpoint = new URL(connection.apiUrl);
  const requestModel = defaultModelForConnection(connection);
  const model = diagnosticModelLabel(connection, requestModel);

  try {
    const response = await fetch(connection.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.apiKey}`,
      },
      body: JSON.stringify({
        model: requestModel,
        messages: messages.map(normalizeMessage),
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const responseText = await response.text();
    const resolvedModel = diagnosticModelLabel(connection, requestModel, response.headers);
    let payload: any = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    const upstreamError = payload?.error;
    return {
      ok: response.ok,
      source: connection.source,
      model: resolvedModel,
      endpointHost: endpoint.hostname,
      endpointPath: endpoint.pathname,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      request,
      ...(response.ok
        ? {}
        : {
            error: {
              ...(upstreamError?.type
                ? { type: sanitizeDiagnosticText(upstreamError.type) }
                : {}),
              ...(upstreamError?.code
                ? { code: sanitizeDiagnosticText(upstreamError.code) }
                : {}),
              message: sanitizeDiagnosticText(
                upstreamError?.message || responseText || response.statusText,
              ),
            },
          }),
    };
  } catch (error) {
    return {
      ok: false,
      source: connection.source,
      model,
      endpointHost: endpoint.hostname,
      endpointPath: endpoint.pathname,
      status: null,
      latencyMs: Date.now() - startedAt,
      error: { message: sanitizeDiagnosticText((error as Error)?.message) },
      request,
    };
  }
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

/** Payload Chat Completions из InvokeParams — общий для обычного и стримового вызова. */
const buildInvokePayload = (
  params: InvokeParams,
  connection: LlmConnection,
): { payload: Record<string, unknown>; model: string } => {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: params.model || defaultModelForConnection(connection),
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const model = String(payload.model);
  const maxTokens = params.maxTokens ?? params.max_tokens ?? DEFAULT_MAX_TOKENS;
  const maxCompletionTokens =
    params.maxCompletionTokens ?? params.max_completion_tokens;

  if (model.startsWith("gpt-5")) {
    payload.max_completion_tokens = maxCompletionTokens ?? maxTokens;
  } else {
    payload.max_tokens = maxTokens;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return { payload, model };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const connection = resolveConnection();
  const { payload, model } = buildInvokePayload(params, connection);

  const timeoutMs = params.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;
  const requestController = new AbortController();
  const forwardAbort = () => requestController.abort(params.signal?.reason);
  if (params.signal?.aborted) {
    forwardAbort();
  } else {
    params.signal?.addEventListener("abort", forwardAbort, { once: true });
  }
  // Один таймер на всю операцию, включая повтор: timeoutMs — общий бюджет.
  const timeoutId = setTimeout(
    () => requestController.abort(new Error(`LLM request timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );

  const body = JSON.stringify(payload);
  const bodyBytes = Buffer.byteLength(body);
  const logContext = `source=${connection.source} model=${model}`;
  const sendRequest = () =>
    fetch(connection.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.apiKey}`,
      },
      body,
      signal: requestController.signal,
    });
  // Повтор не делаем при abort (свой таймаут или вызывающий код) и если
  // после задержки не останется времени в бюджете.
  const canRetry = (attempt: number) =>
    attempt < MAX_ATTEMPTS &&
    !requestController.signal.aborted &&
    Date.now() + RETRY_DELAY_MS < deadline;

  try {
    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        response = await sendRequest();
      } catch (error) {
        // Размер тела нужен для диагностики обрывов (ECONNRESET) на прокси
        if (!canRetry(attempt)) {
          console.error(`[LLM] Network error ${logContext} attempt=${attempt} bodyBytes=${bodyBytes}`, error);
          throw error;
        }
        console.warn(`[LLM] Network error ${logContext} attempt=${attempt} bodyBytes=${bodyBytes}, retrying in ${RETRY_DELAY_MS}ms`);
        await sleep(RETRY_DELAY_MS, requestController.signal);
        continue;
      }

      if (response.ok) {
        return (await response.json()) as InvokeResult;
      }

      if (RETRYABLE_STATUSES.has(response.status) && canRetry(attempt)) {
        await response.body?.cancel().catch(() => undefined);
        console.warn(
          `[LLM] Upstream error ${logContext} status=${response.status} attempt=${attempt}, retrying in ${RETRY_DELAY_MS}ms`,
        );
        await sleep(RETRY_DELAY_MS, requestController.signal);
        continue;
      }

      // Тело апстрима может содержать фрагменты промпта — в сообщение
      // ошибки попадает только статус и короткий санитизированный фрагмент.
      const errorText = await response.text();
      console.error(`[LLM] Upstream error ${logContext} status=${response.status} attempt=${attempt}`);
      throw new Error(
        `LLM invoke failed: ${response.status} ${response.statusText} – ${sanitizeDiagnosticText(errorText).slice(0, ERROR_SNIPPET_CHARS)}`,
      );
    }
  } finally {
    clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Читает SSE-поток и отдаёт содержимое `data:` каждого события (многострочные
 * data склеиваются через \n). Останавливается на `[DONE]`, не дочитывая остаток.
 */
export async function* readSseDataLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      for (;;) {
        const boundary = buffer.search(/\r?\n\r?\n/);
        if (boundary < 0) break;
        const match = /\r?\n\r?\n/.exec(buffer.slice(boundary)) as RegExpExecArray;
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + match[0].length);
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (!data) continue;
        if (data.trim() === "[DONE]") return;
        yield data;
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** Текстовая дельта из chunk'а Chat Completions; ошибка провайдера — исключение. */
export function extractStreamDeltaText(data: string): string {
  let chunk: unknown;
  try {
    chunk = JSON.parse(data);
  } catch {
    throw new Error(`LLM stream: неразбираемый chunk (${data.length} символов)`);
  }
  if (typeof chunk !== "object" || chunk === null) return "";
  const record = chunk as { error?: { message?: unknown }; choices?: Array<{ delta?: { content?: unknown; tool_calls?: unknown } }> };
  if (record.error) {
    throw new Error(`LLM stream error: ${sanitizeDiagnosticText(record.error.message)}`);
  }
  const delta = record.choices?.[0]?.delta;
  if (delta?.tool_calls) {
    throw new Error("LLM stream: tool_calls в потоке не поддерживаются, используйте invokeLLM");
  }
  return typeof delta?.content === "string" ? delta.content : "";
}

/**
 * Стриминг текстовых дельт (stream: true). Без повторов: повтор из invokeLLM
 * применяется только к не-стримовым вызовам. Если Worker ушёл в fallback без stream,
 * приходит обычный JSON — тогда весь content отдаётся одной дельтой.
 */
export async function* invokeLLMStream(params: InvokeParams): AsyncGenerator<string, void, undefined> {
  if (params.tools && params.tools.length > 0) {
    throw new Error("invokeLLMStream не поддерживает tools: используйте invokeLLM");
  }
  const connection = resolveConnection();
  const { payload, model } = buildInvokePayload(params, connection);
  payload.stream = true;

  const timeoutMs = params.timeoutMs ?? 90_000;
  const requestController = new AbortController();
  const forwardAbort = () => requestController.abort(params.signal?.reason);
  if (params.signal?.aborted) {
    forwardAbort();
  } else {
    params.signal?.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeoutId = setTimeout(
    () => requestController.abort(new Error(`LLM stream timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );
  const logContext = `source=${connection.source} model=${model}`;
  const body = JSON.stringify(payload);

  try {
    let response: Response;
    try {
      response = await fetch(connection.apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${connection.apiKey}`,
          accept: "text/event-stream",
        },
        body,
        signal: requestController.signal,
      });
    } catch (error) {
      // Abort вызывающего кода — не сетевая ошибка, не шумим в логе
      if (!requestController.signal.aborted) {
        console.error(`[LLM] Stream network error ${logContext} bodyBytes=${Buffer.byteLength(body)}`, error);
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM] Stream upstream error ${logContext} status=${response.status}`);
      throw new Error(
        `LLM stream failed: ${response.status} ${response.statusText} – ${sanitizeDiagnosticText(errorText).slice(0, ERROR_SNIPPET_CHARS)}`,
      );
    }
    if (!response.body) {
      throw new Error("LLM stream failed: пустое тело ответа");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const result = (await response.json()) as InvokeResult;
      const content = result.choices?.[0]?.message?.content;
      if (typeof content === "string" && content) yield content;
      return;
    }

    for await (const data of readSseDataLines(response.body)) {
      const text = extractStreamDeltaText(data);
      if (text) yield text;
    }
  } finally {
    clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", forwardAbort);
  }
}
