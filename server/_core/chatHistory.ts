/**
 * Общая компакция истории чата для Зои и Маши: ограничение по числу сообщений
 * и по суммарному объёму текста с сохранением system-сообщения и, при
 * необходимости, первого сообщения пользователя.
 */

export type ChatHistoryMessage = {
  role: string;
  content: unknown;
};

export type CompactChatHistoryOptions = {
  /** Максимум сообщений истории (без учёта system). */
  maxMessages?: number;
  /** Максимум символов истории (без учёта system). */
  maxChars?: number;
  /** Не выбрасывать первое сообщение пользователя при обрезке. */
  keepFirstUserMessage?: boolean;
};

export function chatMessageLength(message: ChatHistoryMessage): number {
  return typeof message.content === "string"
    ? message.content.length
    : JSON.stringify(message.content ?? "").length;
}

export function chatHistoryLength(messages: ChatHistoryMessage[]): number {
  return messages.reduce((total, message) => total + chatMessageLength(message), 0);
}

/**
 * Возвращает [первый system?, первый user (если закреплён)?, ...хвост истории].
 * Последнее сообщение включается всегда, даже если само превышает бюджет —
 * иначе текущий вопрос пользователя потерялся бы.
 */
export function compactChatHistory<T extends ChatHistoryMessage>(
  messages: T[],
  options: CompactChatHistoryOptions = {},
): T[] {
  if (messages.length === 0) return [];

  const maxMessages = options.maxMessages ?? Number.POSITIVE_INFINITY;
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;

  const systemMessages = messages.filter((message) => message.role === "system");
  const history = messages.filter((message) => message.role !== "system");
  const keptSystem = systemMessages.slice(0, 1);

  const pinnedIndex = options.keepFirstUserMessage
    ? history.findIndex((message) => message.role === "user")
    : -1;
  const pinned = pinnedIndex >= 0 ? history[pinnedIndex] : null;

  let totalChars = pinned ? chatMessageLength(pinned) : 0;
  let count = pinned ? 1 : 0;
  const tail: T[] = [];

  for (let index = history.length - 1; index > pinnedIndex; index -= 1) {
    if (count >= maxMessages && tail.length > 0) break;
    const message = history[index];
    const length = chatMessageLength(message);
    if (tail.length > 0 && totalChars + length > maxChars) break;
    tail.push(message);
    totalChars += length;
    count += 1;
  }

  return [...keptSystem, ...(pinned ? [pinned] : []), ...tail.reverse()];
}
