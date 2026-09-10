/**
 * Один ход диалога с Машей: промпт + инструменты + runAssistant.
 * Используется tRPC-мутацией faqChat.chat (без стрима) и SSE-эндпоинтом.
 */

import { z } from "zod";
import { runAssistant, type RunAssistantResult } from "./core";
import { isUncertainAnswer, type MashaOutcome } from "./mashaAnalytics";
import { buildMashaSystemPrompt } from "./mashaPrompt";
import { mashaToolsFor, type MashaToolContext } from "./mashaTools";

export const MASHA_ERROR_REPLY =
  "Ой, что-то пошло не так с моей стороны. Пожалуйста, попробуйте позже или свяжитесь с фермой напрямую! 🐐";
export const MASHA_EMPTY_REPLY =
  "Простите, у меня сейчас небольшие технические трудности. Попробуйте спросить ещё раз через минутку! 🌿";

/** Суммарный размер истории (сумма content) во входе — защита от гигантских тел. */
export const CHAT_HISTORY_MAX_CHARS = 24_000;
export const MASHA_MAX_TOKENS = 1024;

export const mashaChatInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(10000),
      }),
    )
    .min(1)
    .max(30),
  sessionId: z.string().min(1).max(64).optional(),
  source: z.enum(["faq", "floating"]).optional(),
  userName: z.string().max(100).optional(),
  currentPage: z.string().max(200).optional(),
});
export type MashaChatInput = z.infer<typeof mashaChatInputSchema>;

export type MashaTurn = RunAssistantResult & { reply: string; outcome: MashaOutcome };

export function lastUserQuestion(messages: MashaChatInput["messages"]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

export function classifyOutcome(result: RunAssistantResult): MashaOutcome {
  if (!result.text.trim()) return "error";
  if (isUncertainAnswer(result.text)) return "uncertain";
  return result.finishedBy === "rounds_exhausted" ? "rounds_exhausted" : "ok";
}

export async function runMashaChat(params: {
  input: MashaChatInput;
  userOpenId: string | null;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
  onToolCall?: (name: string) => void;
}): Promise<MashaTurn> {
  const ctx: MashaToolContext = { userOpenId: params.userOpenId };
  const result = await runAssistant<MashaToolContext>({
    systemPrompt: buildMashaSystemPrompt({
      userName: params.input.userName,
      currentPage: params.input.currentPage,
      isAuthenticated: Boolean(params.userOpenId),
    }),
    tools: mashaToolsFor(ctx),
    messages: params.input.messages,
    ctx,
    maxTokens: MASHA_MAX_TOKENS,
    signal: params.signal,
    onChunk: params.onChunk,
    onToolCall: params.onToolCall ? (name) => params.onToolCall?.(name) : undefined,
    logLabel: "masha",
  });
  const outcome = classifyOutcome(result);
  return { ...result, outcome, reply: result.text.trim() || MASHA_EMPTY_REPLY };
}
