/**
 * Маша — SSE-эндпоинт POST /api/masha/chat/stream.
 *
 * Протокол как у Зои: заголовки text/event-stream, события
 *   data: {"type":"meta", ...}
 *   data: {"type":"tool","name":"list_animals"}   — вызван инструмент
 *   data: {"type":"chunk","content":"..."}         — фрагмент ответа
 *   data: {"type":"done","outcome":"ok","uncertain":false}
 *   data: [DONE]
 * heartbeat `: keepalive` каждые 5 с, abort при закрытии соединения.
 */

import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import type { User } from "../drizzle/schema";
import { recordMashaTurn } from "./assistants/mashaAnalytics";
import {
  CHAT_HISTORY_MAX_CHARS,
  MASHA_ERROR_REPLY,
  lastUserQuestion,
  mashaChatInputSchema,
  runMashaChat,
} from "./assistants/mashaChat";
import { checkChatRateLimit } from "./assistants/mashaRateLimit";
import { compactChatHistory } from "./_core/chatHistory";

export const MASHA_SSE_PATH = "/api/masha/chat/stream";

async function tryAuthenticateUser(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user && user.deletedAt) return null;
    return user;
  } catch {
    return null;
  }
}

function sseWrite(res: Response, payload: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerMashaSSE(app: Express): void {
  app.post(MASHA_SSE_PATH, async (req: Request, res: Response) => {
    const parsed = mashaChatInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Некорректный запрос", issues: parsed.error.issues.length });
    }
    const input = parsed.data;

    const clientIp = req.ip || "unknown";
    if (!checkChatRateLimit(clientIp)) {
      return res.status(429).json({ error: "Слишком много сообщений за последний час, попробуйте позже" });
    }

    // Слушатель закрытия — до первого await, иначе ранний обрыв соединения потеряется
    const controller = new AbortController();
    let completed = false;
    const onClose = () => {
      if (!completed) controller.abort(new Error("client disconnected"));
    };
    res.on("close", onClose);

    const user = await tryAuthenticateUser(req);
    const userOpenId = user?.openId ?? null;
    const messages = compactChatHistory(input.messages, {
      maxChars: CHAT_HISTORY_MAX_CHARS,
      keepFirstUserMessage: true,
    });
    const question = lastUserQuestion(messages);
    const source = input.source ?? "floating";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    sseWrite(res, { type: "meta", authenticated: Boolean(userOpenId) });

    const heartbeat = setInterval(() => {
      if (!completed && !res.writableEnded && !res.destroyed) res.write(": keepalive\n\n");
    }, 5_000);

    const finish = (payload: { outcome: string; uncertain: boolean }) => {
      completed = true;
      sseWrite(res, { type: "done", ...payload });
      if (!res.writableEnded && !res.destroyed) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
    };

    try {
      const turn = await runMashaChat({
        input: { ...input, messages },
        userOpenId,
        signal: controller.signal,
        onChunk: (text) => sseWrite(res, { type: "chunk", content: text }),
        onToolCall: (name) => sseWrite(res, { type: "tool", name }),
      });
      if (controller.signal.aborted) return;

      // Пустой ответ модели: fallback-текст ещё не отправлялся чанком.
      if (!turn.text.trim()) sseWrite(res, { type: "chunk", content: turn.reply });

      recordMashaTurn({
        question,
        answer: turn.reply,
        sessionId: input.sessionId,
        source,
        userOpenId,
        outcome: turn.outcome,
        toolTrace: turn.toolTrace,
      });
      finish({ outcome: turn.outcome, uncertain: turn.outcome === "uncertain" });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[Masha SSE] error:", error instanceof Error ? error.message : error);
      sseWrite(res, { type: "error" });
      sseWrite(res, { type: "chunk", content: MASHA_ERROR_REPLY });
      recordMashaTurn({
        question,
        answer: MASHA_ERROR_REPLY,
        sessionId: input.sessionId,
        source,
        userOpenId,
        outcome: "error",
        toolTrace: [],
      });
      finish({ outcome: "error", uncertain: false });
    } finally {
      clearInterval(heartbeat);
      res.off("close", onClose);
    }
  });
}
