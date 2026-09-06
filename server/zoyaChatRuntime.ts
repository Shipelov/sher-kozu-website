import { invokeLLM, type Message } from "./_core/llm";

export const ZOYA_MAX_HISTORY_MESSAGES = 12;
export const ZOYA_MAX_HISTORY_CHARS = 12_000;
export const ZOYA_TOTAL_DEADLINE_MS = 26_000;
export const ZOYA_PRIMARY_TIMEOUT_MS = 16_000;
export const ZOYA_RETRY_TIMEOUT_MS = 9_000;
export const ZOYA_TEMPORARY_UNAVAILABLE_REPLY =
  "Сейчас внешний AI-сервис отвечает слишком долго. Я остановила ожидание, чтобы чат не завис. Пожалуйста, повторите запрос через минуту — предыдущий контекст сохранён. 🌿";
const ZOYA_RETRY_HISTORY_MESSAGES = 6;
const ZOYA_RETRY_HISTORY_CHARS = 6_000;

type CompactOptions = {
  maxHistoryMessages?: number;
  maxHistoryChars?: number;
};

type InvokeZoyaOptions = {
  signal?: AbortSignal;
  totalDeadlineMs?: number;
  primaryTimeoutMs?: number;
  retryTimeoutMs?: number;
};

export class ZoyaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Zoya LLM attempt timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

function messageTextLength(message: Message): number {
  return typeof message.content === "string"
    ? message.content.length
    : JSON.stringify(message.content).length;
}

export function compactZoyaMessages(
  messages: Message[],
  options: CompactOptions = {},
): Message[] {
  if (messages.length === 0) return [];

  const maxHistoryMessages = options.maxHistoryMessages ?? ZOYA_MAX_HISTORY_MESSAGES;
  const maxHistoryChars = options.maxHistoryChars ?? ZOYA_MAX_HISTORY_CHARS;
  const systemMessages = messages.filter((message) => message.role === "system");
  const history = messages.filter((message) => message.role !== "system");
  const selected: Message[] = [];
  let totalChars = 0;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (selected.length >= maxHistoryMessages) break;
    const message = history[index];
    const length = messageTextLength(message);
    if (selected.length > 0 && totalChars + length > maxHistoryChars) break;
    selected.push(message);
    totalChars += length;
  }

  return [...systemMessages.slice(0, 1), ...selected.reverse()];
}

function safeFailureMeta(error: unknown, messages: Message[], attempt: number) {
  const rawMessage = error instanceof Error ? error.message : "Unknown error";
  const statusMatch = rawMessage.match(/\b([45]\d{2})\b/);
  return {
    attempt,
    name: error instanceof Error ? error.name : "UnknownError",
    upstreamStatus: statusMatch?.[1] ?? null,
    messageCount: messages.length,
    contentChars: messages.reduce((sum, message) => sum + messageTextLength(message), 0),
  };
}

function shouldRetryZoyaError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error.name === "AbortError") return false;
  const status = Number(error.message.match(/\b([45]\d{2})\b/)?.[1]);
  if (!Number.isFinite(status)) return true;
  return status === 408 || status === 429 || status >= 500;
}

function abortError(): Error {
  const error = new Error("Zoya request aborted by client");
  error.name = "AbortError";
  return error;
}

function invokeZoyaAttempt(
  messages: Message[],
  timeoutMs: number,
  externalSignal?: AbortSignal,
) {
  if (externalSignal?.aborted) return Promise.reject(abortError());
  if (timeoutMs <= 0) return Promise.reject(new ZoyaTimeoutError(timeoutMs));

  const controller = new AbortController();
  return new Promise<Awaited<ReturnType<typeof invokeLLM>>>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      callback();
    };
    const onExternalAbort = () => {
      controller.abort(externalSignal?.reason);
      finish(() => reject(abortError()));
    };
    const timeoutId = setTimeout(() => {
      controller.abort();
      finish(() => reject(new ZoyaTimeoutError(timeoutMs)));
    }, timeoutMs);

    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    invokeLLM({ messages, maxTokens: 2048, signal: controller.signal, timeoutMs })
      .then((result) => finish(() => resolve(result)))
      .catch((error) => finish(() => reject(error)));
  });
}

export async function invokeZoyaLLM(
  messages: Message[],
  options: InvokeZoyaOptions = {},
) {
  const totalDeadlineMs = options.totalDeadlineMs ?? ZOYA_TOTAL_DEADLINE_MS;
  const deadlineAt = Date.now() + totalDeadlineMs;
  const primaryMessages = compactZoyaMessages(messages);
  try {
    return await invokeZoyaAttempt(
      primaryMessages,
      Math.min(options.primaryTimeoutMs ?? ZOYA_PRIMARY_TIMEOUT_MS, totalDeadlineMs),
      options.signal,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    console.error("[Zoya LLM] Primary attempt failed", safeFailureMeta(error, primaryMessages, 1));
    if (!shouldRetryZoyaError(error)) throw error;
  }

  const retryMessages = compactZoyaMessages(messages, {
    maxHistoryMessages: ZOYA_RETRY_HISTORY_MESSAGES,
    maxHistoryChars: ZOYA_RETRY_HISTORY_CHARS,
  });
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) throw new ZoyaTimeoutError(totalDeadlineMs);
  return invokeZoyaAttempt(
    retryMessages,
    Math.min(options.retryTimeoutMs ?? ZOYA_RETRY_TIMEOUT_MS, remainingMs),
    options.signal,
  );
}
