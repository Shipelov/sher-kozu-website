/**
 * Отправка сообщения Маше: SSE-стрим с fallback на tRPC-мутацию faqChat.chat
 * (если стрим недоступен: 404 на старом сервере, прокси без SSE, сетевая ошибка
 * до первого чанка). Rate-limit (429) на fallback не уходит.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { MashaStreamHttpError, streamMashaChat, type MashaStreamRequest } from "@/lib/mashaStream";

export const MASHA_CLIENT_ERROR_REPLY = "Простите, произошла ошибка. Попробуйте ещё раз через минутку! 🌿";
export const MASHA_RATE_LIMIT_REPLY = "Слишком много сообщений за последний час. Давайте продолжим чуть позже! 🌿";

const REQUEST_TIMEOUT_MS = 60_000;

export const MASHA_TOOL_LABELS: Record<string, string> = {
  get_farm_info: "Вспоминаю о ферме…",
  list_animals: "Смотрю каталог животных…",
  get_animal: "Открываю профиль животного…",
  get_pricing_tiers: "Проверяю тарифы…",
  calculate_share: "Считаю стоимость доли…",
  search_knowledge: "Ищу в базе знаний…",
  get_delivery_info: "Уточняю условия доставки…",
  get_my_animals: "Смотрю ваших животных…",
};

export function useMashaChat(options: { onReply: (reply: string) => void }) {
  const [isPending, setIsPending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fallbackMutation = trpc.faqChat.chat.useMutation();
  const onReplyRef = useRef(options.onReply);
  onReplyRef.current = options.onReply;

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (request: MashaStreamRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      setIsPending(true);
      setStreamingContent("");
      setActiveTool(null);

      let reply = "";
      try {
        try {
          const result = await streamMashaChat(request, {
            signal: controller.signal,
            onChunk: (accumulated) => {
              setActiveTool(null);
              setStreamingContent(accumulated);
            },
            onTool: (name) => setActiveTool(name),
          });
          reply = result.reply;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof MashaStreamHttpError && error.status === 429) {
            reply = MASHA_RATE_LIMIT_REPLY;
          } else {
            // Стрим не доступен — обычная мутация
            const fallback = await fallbackMutation.mutateAsync(request);
            reply = fallback.reply;
          }
        }
      } catch {
        reply = MASHA_CLIENT_ERROR_REPLY;
      } finally {
        window.clearTimeout(timeoutId);
        if (abortRef.current === controller) {
          setIsPending(false);
          setStreamingContent("");
          setActiveTool(null);
        }
      }
      if (reply) onReplyRef.current(reply);
    },
    [fallbackMutation],
  );

  return { send, isPending, streamingContent, activeTool };
}
