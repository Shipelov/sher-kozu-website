/**
 * MashaFloatingChat — Floating AI chat widget available on all pages.
 *
 * Shows a small avatar button in the bottom-right corner.
 * On click, expands into a chat panel with Masha AI assistant.
 * Hidden on the /faq page (which has its own embedded chat).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Streamdown } from "streamdown";
import { Send, Loader2, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MASHA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/manager-v1_e0256177.jpg";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function MashaFloatingChat() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate a stable session ID for analytics
  const sessionId = useMemo(
    () => `floating-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const chatMutation = trpc.faqChat.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Простите, произошла ошибка. Попробуйте ещё раз через минутку! 🌿",
        },
      ]);
    },
  });

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text || input).trim();
      if (!content || chatMutation.isPending) return;

      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content },
      ];
      setMessages(newMessages);
      setInput("");
      chatMutation.mutate({
        messages: newMessages,
        sessionId,
        source: "floating",
      });
      textareaRef.current?.focus();
    },
    [input, messages, chatMutation, sessionId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const suggestedPrompts = useMemo(
    () => ["Как выбрать козу?", "Какие продукты я получу?", "Расскажи о породах"],
    []
  );

  // Hide on /faq page (it has its own chat)
  if (location === "/faq") return null;

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 group cursor-pointer"
            aria-label="Открыть чат с Машей"
          >
            <div className="relative">
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              {/* Avatar */}
              <div className="relative h-14 w-14 rounded-full ring-2 ring-primary/40 shadow-lg overflow-hidden transition-transform group-hover:scale-110">
                <img
                  src={MASHA_AVATAR}
                  alt="Маша"
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 ring-2 ring-background" />
              {/* Chat icon badge */}
              <div className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-card border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Спросите Машу
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] sm:w-[400px] h-[520px] flex flex-col rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img
                    src={MASHA_AVATAR}
                    alt="Маша"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Маша</p>
                  <p className="text-[11px] text-muted-foreground">
                    AI Управляющая фермой
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Закрыть чат"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-hidden">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <img
                      src={MASHA_AVATAR}
                      alt="Маша"
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/10 shadow-md"
                    />
                    <p className="mt-1.5 text-sm font-medium text-foreground">
                      Привет! Я Маша 👋
                    </p>
                    <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                      Спросите меня о ферме, животных, продуктах или клубе
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        disabled={chatMutation.isPending}
                        className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-2.5 p-3">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-2",
                          msg.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        )}
                      >
                        {msg.role === "assistant" && (
                          <img
                            src={MASHA_AVATAR}
                            alt="Маша"
                            className="h-6 w-6 shrink-0 rounded-full object-cover mt-1"
                          />
                        )}
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px]",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          )}
                        >
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5">
                              <Streamdown>{msg.content}</Streamdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {chatMutation.isPending && (
                      <div className="flex gap-2">
                        <img
                          src={MASHA_AVATAR}
                          alt="Маша"
                          className="h-6 w-6 shrink-0 rounded-full object-cover mt-1"
                        />
                        <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
                          <div className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2 border-t border-border/60 bg-background/50 p-2.5"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросите Машу..."
                className="flex-1 max-h-20 resize-none min-h-8 rounded-xl text-[13px]"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || chatMutation.isPending}
                className="shrink-0 h-8 w-8 rounded-xl"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
