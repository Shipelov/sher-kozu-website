/**
 * Общее ядро AI-ассистентов с инструментами (Маша, далее Зоя).
 *
 * runAssistant: цикл «модель → tool_calls → выполнение → модель» поверх
 * OpenAI-совместимого invokeLLM. Инструменты описываются zod-схемами,
 * выполняются параллельно с таймаутом; ошибка инструмента возвращается
 * модели как результат с полем error и не роняет диалог.
 */

import { z } from "zod";
import { compactChatHistory } from "../_core/chatHistory";
import {
  invokeLLM,
  invokeLLMStream,
  type Message,
  type MessageContent,
  type Tool,
  type ToolCall,
} from "../_core/llm";

export type AssistantChatMessage = { role: "user" | "assistant"; content: string };

export type ToolDef<Ctx> = {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  /** Аргументы уже провалидированы схемой. Результат — JSON-сериализуемое значение. */
  handler: (args: unknown, ctx: Ctx) => Promise<unknown> | unknown;
};

/** Типизированное объявление инструмента: handler получает z.output схемы. */
export function defineTool<Ctx, S extends z.ZodType>(def: {
  name: string;
  description: string;
  inputSchema: S;
  handler: (args: z.output<S>, ctx: Ctx) => Promise<unknown> | unknown;
}): ToolDef<Ctx> {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    handler: (args, ctx) => def.handler(args as z.output<S>, ctx),
  };
}

/** defineTool с зафиксированным типом контекста: схема выводится из inputSchema. */
export function createToolDefiner<Ctx>() {
  return <S extends z.ZodType>(def: {
    name: string;
    description: string;
    inputSchema: S;
    handler: (args: z.output<S>, ctx: Ctx) => Promise<unknown> | unknown;
  }): ToolDef<Ctx> => defineTool<Ctx, S>(def);
}

export type ToolTraceEntry = {
  name: string;
  args: unknown;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export type AssistantUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Число обращений к LLM (стриминговый вызов usage не возвращает). */
  llmCalls: number;
};

export type RunAssistantOptions<Ctx> = {
  systemPrompt: string;
  tools: ToolDef<Ctx>[];
  messages: AssistantChatMessage[];
  ctx: Ctx;
  maxToolRounds?: number;
  toolTimeoutMs?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToolCall?: (name: string, args: unknown, result: unknown) => void;
  /**
   * Стриминг финального ответа. Раунды с инструментами идут через invokeLLM,
   * финальный текст — через invokeLLMStream без инструментов.
   */
  onChunk?: (text: string) => void;
  /** Метка для логов, например "masha". */
  logLabel?: string;
  history?: { maxMessages?: number; maxChars?: number };
};

export type RunAssistantResult = {
  text: string;
  toolTrace: ToolTraceEntry[];
  usage: AssistantUsage;
  rounds: number;
  finishedBy: "model" | "rounds_exhausted";
};

export const DEFAULT_MAX_TOOL_ROUNDS = 4;
export const DEFAULT_TOOL_TIMEOUT_MS = 5_000;
export const DEFAULT_HISTORY_MAX_MESSAGES = 8;
export const DEFAULT_HISTORY_MAX_CHARS = 6_000;
/**
 * В режиме стриминга раунд с инструментами получает малый бюджет токенов:
 * аргументы инструментов короткие, а длинный текстовый ответ (finish_reason
 * "length") перегенерируется потоком без инструментов.
 */
export const STREAM_TOOL_ROUND_MAX_TOKENS = 320;
/** Порог предупреждения о размере запроса к LLM: большие тела обрывались на прокси (ECONNRESET). */
export const LLM_REQUEST_WARN_BYTES = 100 * 1024;

/** Оценка размера тела запроса к LLM (messages + tools) в байтах UTF-8. */
export function estimateRequestBytes(messages: Message[], tools?: Tool[]): number {
  return Buffer.byteLength(JSON.stringify(tools && tools.length > 0 ? { messages, tools } : { messages }));
}

function logRequestSize(label: string, stage: string, bytes: number): void {
  const line = `${label} ${stage} requestBytes=${bytes}`;
  if (bytes > LLM_REQUEST_WARN_BYTES) {
    console.warn(`${line} — превышает ${LLM_REQUEST_WARN_BYTES} байт, возможен обрыв на прокси`);
  } else {
    console.info(line);
  }
}

/** zod → JSON Schema для поля parameters инструмента (без служебного $schema). */
export function toolInputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  if (rest.type !== "object") {
    return { type: "object", properties: {}, additionalProperties: false };
  }
  return rest;
}

export function toolsToLlmSpec<Ctx>(tools: ToolDef<Ctx>[]): Tool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toolInputJsonSchema(tool.inputSchema),
    },
  }));
}

export function messageContentToText(content: MessageContent | MessageContent[] | undefined | null): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((part) => (typeof part === "string" ? part : part.type === "text" ? part.text : ""))
    .join("");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown error";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

type ExecutedToolCall = {
  message: Message;
  trace: ToolTraceEntry;
  result: unknown;
};

function parseToolArgs(raw: string): { ok: true; args: unknown } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, args: {} };
  try {
    return { ok: true, args: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalid JSON in tool arguments" };
  }
}

async function executeToolCall<Ctx>(
  tools: ToolDef<Ctx>[],
  call: ToolCall,
  ctx: Ctx,
  timeoutMs: number,
): Promise<ExecutedToolCall> {
  const startedAt = Date.now();
  const name = call.function?.name ?? "unknown";
  const parsed = parseToolArgs(call.function?.arguments ?? "");
  const args = parsed.ok ? parsed.args : call.function?.arguments;
  const tool = tools.find((candidate) => candidate.name === name);

  let result: unknown;
  let error: string | undefined;
  if (!parsed.ok) {
    error = parsed.error;
  } else if (!tool) {
    error = `unknown tool "${name}"`;
  } else {
    const validated = tool.inputSchema.safeParse(parsed.args ?? {});
    if (!validated.success) {
      error = `invalid arguments: ${validated.error.issues
        .map((issue) => `${issue.path.join(".") || "input"} ${issue.message}`)
        .join("; ")}`;
    } else {
      try {
        result = await withTimeout(Promise.resolve(tool.handler(validated.data, ctx)), timeoutMs, name);
      } catch (caught) {
        error = errorMessage(caught);
      }
    }
  }

  const latencyMs = Date.now() - startedAt;
  const payload = error === undefined ? (result === undefined ? null : result) : { error };
  return {
    message: {
      role: "tool",
      tool_call_id: call.id,
      name,
      content: JSON.stringify(payload),
    },
    trace: { name, args, ok: error === undefined, latencyMs, ...(error ? { error } : {}) },
    result: payload,
  };
}

/**
 * Для финального вызова без инструментов историю tool_calls/tool нельзя
 * отправлять: Anthropic требует объявленных tools при наличии tool_use.
 * Результаты инструментов переносятся в system-промпт как данные.
 */
export function flattenToolHistory(messages: Message[]): Message[] {
  const toolBlocks: string[] = [];
  const pendingCalls = new Map<string, string>();
  const plain: Message[] = [];

  for (const message of messages) {
    if (message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0) {
      for (const call of message.tool_calls) {
        pendingCalls.set(call.id, `${call.function.name}(${call.function.arguments})`);
      }
      const text = messageContentToText(message.content);
      if (text.trim()) plain.push({ role: "assistant", content: text });
      continue;
    }
    if (message.role === "tool") {
      const label = pendingCalls.get(message.tool_call_id ?? "") ?? message.name ?? "tool";
      toolBlocks.push(`### ${label}\n${messageContentToText(message.content)}`);
      continue;
    }
    plain.push(message);
  }

  if (toolBlocks.length === 0) return plain;

  const systemIndex = plain.findIndex((message) => message.role === "system");
  const dataSection = `\n\nДанные инструментов для текущего вопроса (получены системой, используй только их):\n${toolBlocks.join("\n\n")}`;
  if (systemIndex >= 0) {
    const system = plain[systemIndex];
    plain[systemIndex] = { ...system, content: messageContentToText(system.content) + dataSection };
  } else {
    plain.unshift({ role: "system", content: dataSection.trim() });
  }
  return plain;
}

function addUsage(usage: AssistantUsage, result: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }) {
  usage.llmCalls += 1;
  usage.promptTokens += result.usage?.prompt_tokens ?? 0;
  usage.completionTokens += result.usage?.completion_tokens ?? 0;
  usage.totalTokens += result.usage?.total_tokens ?? 0;
}

export async function runAssistant<Ctx>(options: RunAssistantOptions<Ctx>): Promise<RunAssistantResult> {
  const maxToolRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const toolTimeoutMs = options.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? 1024;
  const label = `[assistant:${options.logLabel ?? "generic"}]`;
  const streaming = typeof options.onChunk === "function";

  const history = compactChatHistory(options.messages, {
    maxMessages: options.history?.maxMessages ?? DEFAULT_HISTORY_MAX_MESSAGES,
    maxChars: options.history?.maxChars ?? DEFAULT_HISTORY_MAX_CHARS,
    keepFirstUserMessage: true,
  });

  const llmMessages: Message[] = [
    { role: "system", content: options.systemPrompt },
    ...history.map((message) => ({ role: message.role, content: message.content })),
  ];
  const toolSpec = toolsToLlmSpec(options.tools);
  const toolTrace: ToolTraceEntry[] = [];
  const usage: AssistantUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, llmCalls: 0 };
  const startedAt = Date.now();
  let rounds = 0;

  const finish = (text: string, finishedBy: RunAssistantResult["finishedBy"]): RunAssistantResult => {
    const names = toolTrace.map((entry) => entry.name).join(",") || "-";
    console.info(`${label} done rounds=${rounds} tools=${names} finishedBy=${finishedBy} totalMs=${Date.now() - startedAt}`);
    return { text, toolTrace, usage, rounds, finishedBy };
  };

  if (toolSpec.length > 0) {
    for (let round = 0; round < maxToolRounds; round += 1) {
      rounds = round + 1;
      const llmStartedAt = Date.now();
      logRequestSize(label, `round=${rounds}`, estimateRequestBytes(llmMessages, toolSpec));
      const result = await invokeLLM({
        messages: llmMessages,
        tools: toolSpec,
        toolChoice: "auto",
        maxTokens: streaming ? STREAM_TOOL_ROUND_MAX_TOKENS : maxTokens,
        signal: options.signal,
      });
      addUsage(usage, result);
      const choice = result.choices?.[0];
      const assistantMessage = choice?.message;
      const calls = assistantMessage?.tool_calls ?? [];

      if (calls.length === 0) {
        const text = messageContentToText(assistantMessage?.content);
        // Текст обрезан бюджетом раунда — перегенерируем потоком без инструментов.
        if (streaming && choice?.finish_reason === "length") break;
        if (text.trim()) {
          options.onChunk?.(text);
          return finish(text, "model");
        }
        // Пустой ответ без инструментов: дальнейшие раунды не помогут.
        break;
      }

      llmMessages.push({
        role: "assistant",
        content: messageContentToText(assistantMessage?.content),
        tool_calls: calls,
      });

      const executed = await Promise.all(
        calls.map((call) => executeToolCall(options.tools, call, options.ctx, toolTimeoutMs)),
      );
      for (const item of executed) {
        llmMessages.push(item.message);
        toolTrace.push(item.trace);
        try {
          options.onToolCall?.(item.trace.name, item.trace.args, item.result);
        } catch (error) {
          console.warn(`${label} onToolCall failed:`, errorMessage(error));
        }
      }
      console.info(
        `${label} round=${rounds} llmMs=${Date.now() - llmStartedAt} tools=${executed
          .map((item) => `${item.trace.name}:${item.trace.ok ? "ok" : "err"}:${item.trace.latencyMs}ms`)
          .join(",")}`,
      );
    }
  }

  // Финальный ответ без инструментов: раунды исчерпаны, ответ обрезан или инструментов нет.
  const finalMessages = flattenToolHistory(llmMessages);
  logRequestSize(label, "final", estimateRequestBytes(finalMessages));
  if (streaming) {
    let text = "";
    for await (const chunk of invokeLLMStream({ messages: finalMessages, maxTokens, signal: options.signal })) {
      if (!chunk) continue;
      text += chunk;
      options.onChunk?.(chunk);
    }
    usage.llmCalls += 1;
    return finish(text, "rounds_exhausted");
  }

  const result = await invokeLLM({ messages: finalMessages, maxTokens, signal: options.signal });
  addUsage(usage, result);
  return finish(messageContentToText(result.choices?.[0]?.message?.content), "rounds_exhausted");
}
