/**
 * SSE-клиент Маши: POST /api/masha/chat/stream.
 * События: meta | tool | chunk | done | error, завершение — `data: [DONE]`.
 * При HTTP-ошибке бросает исключение — вызывающий код уходит на tRPC-fallback.
 */

export type MashaChatMessage = { role: "user" | "assistant"; content: string };

export type MashaStreamRequest = {
  messages: MashaChatMessage[];
  sessionId?: string;
  source?: "faq" | "floating";
  userName?: string;
  currentPage?: string;
};

export type MashaStreamResult = {
  reply: string;
  outcome: string;
  tools: string[];
};

export class MashaStreamHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Masha stream HTTP ${status}`);
    this.name = "MashaStreamHttpError";
  }
}

export const MASHA_STREAM_PATH = "/api/masha/chat/stream";

export async function streamMashaChat(
  request: MashaStreamRequest,
  handlers: {
    signal?: AbortSignal;
    onChunk?: (accumulated: string, delta: string) => void;
    onTool?: (name: string) => void;
  } = {},
): Promise<MashaStreamResult> {
  const response = await fetch(MASHA_STREAM_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    signal: handlers.signal,
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new MashaStreamHttpError(response.status);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Masha stream: no body");

  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let outcome = "ok";
  const tools: string[] = [];
  let finished = false;

  const handleLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const data = line.slice(6).trim();
    if (data === "[DONE]") {
      finished = true;
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const event = parsed as { type?: string; content?: unknown; name?: unknown; outcome?: unknown };
    if (event.type === "chunk" && typeof event.content === "string") {
      reply += event.content;
      handlers.onChunk?.(reply, event.content);
    } else if (event.type === "tool" && typeof event.name === "string") {
      tools.push(event.name);
      handlers.onTool?.(event.name);
    } else if (event.type === "done" && typeof event.outcome === "string") {
      outcome = event.outcome;
    } else if (event.type === "error") {
      outcome = "error";
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
    if (finished) break;
  }
  if (buffer) handleLine(buffer);

  if (!reply.trim()) throw new Error("Masha stream: empty reply");
  return { reply, outcome, tools };
}
