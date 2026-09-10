/**
 * Аналитика ответов Маши: журнал вопросов (faqQuestions) и неуверенные
 * ответы (uncertainAnswers + уведомление владельца). Общая для tRPC и SSE.
 */

import { faqQuestions, uncertainAnswers } from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import type { ToolTraceEntry } from "./core";

export type MashaOutcome = "ok" | "uncertain" | "error" | "rounds_exhausted";

export type StoredToolTrace = Array<{ name: string; ok: boolean; latencyMs: number; error?: string }>;

/** В БД уходят только имена, статус и latency — без аргументов и результатов. */
export function toStoredToolTrace(trace: ToolTraceEntry[]): StoredToolTrace {
  return trace.map((entry) => ({
    name: entry.name,
    ok: entry.ok,
    latencyMs: entry.latencyMs,
    ...(entry.error ? { error: entry.error.slice(0, 200) } : {}),
  }));
}

export const UNCERTAIN_PHRASES = [
  "извините",
  "не знаю",
  "не уверена",
  "затрудняюсь",
  "не могу сказать точно",
  "не располагаю информацией",
  "лучше связаться с фермой",
  "свяжитесь напрямую",
  "не в моей компетенции",
  "к сожалению, этот вопрос",
  "не могу ответить",
  "у меня нет данных",
  "нет таких данных",
  "нет информации",
];

export function isUncertainAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  return UNCERTAIN_PHRASES.some((phrase) => lower.includes(phrase));
}

export async function trackQuestion(params: {
  question: string;
  answer: string;
  sessionId: string;
  source: string;
  userOpenId?: string | null;
  outcome: MashaOutcome;
  toolTrace: StoredToolTrace;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(faqQuestions).values({
      question: params.question,
      answer: params.answer,
      sessionId: params.sessionId,
      source: params.source,
      userOpenId: params.userOpenId ?? undefined,
      outcome: params.outcome,
      toolTrace: params.toolTrace,
    });
  } catch (err) {
    console.error("[FAQ Analytics] Failed to track question:", err);
  }
}

/** Fire-and-forget: запись в uncertainAnswers и уведомление владельца. */
export async function notifyUncertainAnswer(
  question: string,
  answer: string,
  source: string,
  sessionId: string,
  toolTrace: StoredToolTrace = [],
): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      await db.insert(uncertainAnswers).values({ question, answer, source, sessionId, toolTrace });
    }
  } catch (err) {
    console.error("[FAQ] Failed to save uncertain answer to DB:", err);
  }

  try {
    const tools = toolTrace.map((entry) => `${entry.name}${entry.ok ? "" : " (ошибка)"}`).join(", ") || "не вызывались";
    await notifyOwner({
      title: "🤔 Маша не смогла уверенно ответить",
      content: `**Вопрос пользователя:** ${question}\n\n**Ответ Маши:** ${answer}\n\n**Источник:** ${source}\n**Session:** ${sessionId}\n**Инструменты:** ${tools}\n\n_Рекомендуется дополнить базу знаний Маши по этой теме._`,
    });
  } catch (err) {
    console.error("[FAQ] Failed to notify owner about uncertain answer:", err);
  }
}

/**
 * Общий итог хода: журнал (если есть sessionId) и неуверенные ответы.
 * Не блокирует ответ пользователю.
 */
export function recordMashaTurn(params: {
  question: string;
  answer: string;
  sessionId?: string;
  source: string;
  userOpenId?: string | null;
  outcome: MashaOutcome;
  toolTrace: ToolTraceEntry[];
}): void {
  const stored = toStoredToolTrace(params.toolTrace);
  if (params.sessionId) {
    void trackQuestion({
      question: params.question,
      answer: params.answer,
      sessionId: params.sessionId,
      source: params.source,
      userOpenId: params.userOpenId,
      outcome: params.outcome,
      toolTrace: stored,
    });
  }
  if (params.outcome === "uncertain") {
    void notifyUncertainAnswer(params.question, params.answer, params.source, params.sessionId ?? "unknown", stored);
  }
}
