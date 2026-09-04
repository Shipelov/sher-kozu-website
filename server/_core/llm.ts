/**
 * LLM helper — OpenAI-compatible API client.
 *
 * Priority for webdev runtime: BUILT_IN_FORGE_API_URL > custom OpenAI > OpenAI.
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
  source: "custom-openai" | "forge" | "openai";
};

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

  // Webdev projects must prefer the platform-provided Forge pair. Production
  // can retain legacy OPENAI_API_URL/OPENAI_API_KEY values that are unrelated
  // to the current built-in proxy and otherwise cause 401 responses.
  if (forgeUrl && forgeKey) {
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
      apiUrl: `${openaiUrl.replace(/\/$/, "")}/v1/chat/completions`,
      apiKey: directOpenaiKey,
      source: "custom-openai",
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
    model:
      params.model ||
      (connection.source === "forge" ? "gemini-3-flash-preview" : "gpt-4o-mini"),
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

  let response: Response;
  try {
    response = await fetch(connection.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(
      `[LLM] Network error source=${connection.source} model=${String(payload.model)}`,
      error,
    );
    throw error;
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
