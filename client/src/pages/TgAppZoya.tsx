/**
 * Telegram Mini App — Zoya AI Nutritionist Chat screen
 * Compact chat interface for AI nutrition consultations.
 */

import { useState, useRef, useEffect } from "react";
import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { useTelegram } from "@/contexts/TelegramContext";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Stethoscope, Sparkles } from "lucide-react";
import ZoyaNutritionProfiles from "@/components/ZoyaNutritionProfiles";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Чем полезно козье молоко?",
  "Рецепт домашнего сыра",
  "Питание для детей",
  "Непереносимость лактозы",
];

export default function TgAppZoya() {
  const { webApp, user, isAuthenticated } = useTelegram();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.nutritionist.chat.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    // Haptic feedback
    webApp?.HapticFeedback?.impactOccurred("light");

    try {
      const result = await chatMutation.mutateAsync({
        messages: newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        sessionId: sessionId ?? undefined,
        profileId: activeProfileId ?? undefined,
        profileConfirmed,
      });

      const reply = (result as any)?.reply || "Извините, не удалось получить ответ.";
      if (typeof (result as any)?.sessionId === "number") {
        setSessionId((result as any).sessionId);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      webApp?.HapticFeedback?.notificationOccurred("success");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Произошла ошибка. Попробуйте ещё раз.",
        },
      ]);
      webApp?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <TelegramMiniAppLayout title="Зоя — нутрициолог">
      <div className="flex flex-col" style={{ height: "calc(100vh - 48px)" }}>
        <ZoyaNutritionProfiles
          isAuthenticated={isAuthenticated}
          userId={user?.id}
          activeProfileId={activeProfileId}
          onActiveProfileChange={setActiveProfileId}
          onProfileConfirmed={setProfileConfirmed}
          compact
        />
        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-8 pb-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                <Stethoscope className="h-8 w-8 text-violet-500" />
              </div>
              <h2 className="text-base font-semibold text-[#1a3a2a]">
                Привет! Я Зоя 👋
              </h2>
              <p className="text-xs text-[#1a3a2a]/50 text-center max-w-xs leading-relaxed">
                AI-нутрициолог Шерь Козу. Спросите меня о пользе козьего молока,
                рецептах, питании и здоровом образе жизни.
              </p>

              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 font-medium active:scale-95 transition-transform"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex mb-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === "user"
                    ? "bg-[#1a3a2a] text-white rounded-br-md"
                    : "bg-white text-[#1a3a2a] shadow-sm rounded-bl-md"
                }`}
              >
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start mb-3">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 bg-[#f5f0e8] border-t border-[#1a3a2a]/10 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите Зою..."
              disabled={isTyping}
              className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm text-[#1a3a2a] placeholder:text-[#1a3a2a]/30 outline-none border border-[#1a3a2a]/10 focus:border-violet-300 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-full bg-[#1a3a2a] flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-95 transition-transform"
            >
              <Send className="h-4.5 w-4.5 text-white" />
            </button>
          </div>
        </form>
      </div>
    </TelegramMiniAppLayout>
  );
}
