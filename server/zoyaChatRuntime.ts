import { invokeLLM, type Message } from "./_core/llm";

export const ZOYA_MAX_HISTORY_MESSAGES = 12;
export const ZOYA_MAX_HISTORY_CHARS = 12_000;
const ZOYA_RETRY_HISTORY_MESSAGES = 6;
const ZOYA_RETRY_HISTORY_CHARS = 6_000;

type CompactOptions = {
  maxHistoryMessages?: number;
  maxHistoryChars?: number;
};

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
  const status = Number(error.message.match(/\b([45]\d{2})\b/)?.[1]);
  if (!Number.isFinite(status)) return true;
  return status === 408 || status === 429 || status >= 500;
}

export async function invokeZoyaLLM(messages: Message[]) {
  const primaryMessages = compactZoyaMessages(messages);
  try {
    return await invokeLLM({ messages: primaryMessages, maxTokens: 2048 });
  } catch (error) {
    console.error("[Zoya LLM] Primary attempt failed", safeFailureMeta(error, primaryMessages, 1));
    if (!shouldRetryZoyaError(error)) throw error;
  }

  const retryMessages = compactZoyaMessages(messages, {
    maxHistoryMessages: ZOYA_RETRY_HISTORY_MESSAGES,
    maxHistoryChars: ZOYA_RETRY_HISTORY_CHARS,
  });
  return invokeLLM({ messages: retryMessages, maxTokens: 2048 });
}
