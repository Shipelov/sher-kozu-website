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
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }

  return { role, name, content: contentParts };
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

const defaultModelForConnection = (connection: LlmConnection): string =>
  connection.source === "forge" ? "gemini-3-flash-preview" : "gpt-4o-mini";

const diagnosticModelLabel = (connection: LlmConnection, requestModel: string): string =>
  connection.source === "cloudflare-openai"
    ? `worker-managed (request alias: ${requestModel})`
    : requestModel;

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
      model,
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
      model,
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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const connection = resolveConnection();

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
  const maxTokens = params.maxTokens ?? params.max_tokens ?? 16384;
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

  const timeoutMs = params.timeoutMs ?? 90_000;
  const requestController = new AbortController();
  const forwardAbort = () => requestController.abort(params.signal?.reason);
  if (params.signal?.aborted) {
    forwardAbort();
  } else {
    params.signal?.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeoutId = setTimeout(
    () => requestController.abort(new Error(`LLM request timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );

  let response: Response;
  try {
    response = await fetch(connection.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: requestController.signal,
    });
  } catch (error) {
    console.error(
      `[LLM] Network error source=${connection.source} model=${String(payload.model)}`,
      error,
    );
    throw error;
  } finally {
    clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", forwardAbort);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[LLM] Upstream error source=${connection.source} model=${String(payload.model)} status=${response.status}`,
    );
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
