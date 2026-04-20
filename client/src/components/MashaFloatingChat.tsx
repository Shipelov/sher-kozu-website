/**
 * MashaFloatingChat — Floating AI chat widget available on all pages.
 *
 * Features:
 * - Small avatar button in the bottom-right corner with pulse animation
 * - Expands into chat panel (desktop: 400px, mobile: full-screen)
 * - Context-aware suggested prompts based on current page
 * - Personalization: Masha addresses user by name (from auth or asks)
 * - A/B testing: greeting variants randomly assigned per session
 * - Engagement tracking: message count, response flag, duration
 * - Hidden on the /faq page (which has its own embedded chat)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import LazyStreamdown from "@/components/LazyStreamdown";
import { Send, Loader2, X, MessageCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const MASHA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha_avatar_128_ad92cbd8.webp";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGES = 30;
const MAX_CHARS = 10000;
const CHAR_WARNING_THRESHOLD = 8000;

/** Trim oldest messages keeping the first (greeting) and the last N-1 */
function trimMessages(msgs: ChatMessage[], max: number): ChatMessage[] {
  if (msgs.length <= max) return msgs;
  // Keep the first message (greeting) + the most recent (max - 1) messages
  return [msgs[0], ...msgs.slice(-(max - 1))];
}

/* ─── Context-aware suggested prompts by page ─── */
const PAGE_PROMPTS: Record<string, string[]> = {
  "/": [
    "Как работает персональное фермерство?",
    "Расскажи о ферме Шипеловых",
    "Какие породы есть на ферме?",
  ],
  "/animals": [
    "Чем отличаются козы от овец?",
    "Какая порода даёт самое жирное молоко?",
    "Как выбрать своё животное?",
  ],
  "/marketplace": [
    "Какие продукты можно заказать?",
    "Как работает доставка?",
    "Расскажи о подарочных наборах",
  ],
  "/club": [
    "Какие мероприятия проходят в клубе?",
    "Как попасть на ужин на ферме?",
    "Что даёт членство в клубе?",
  ],
  "/dashboard": [
    "Как следить за моим животным?",
    "Когда будет следующая доставка?",
    "Как работает трекер продуктов?",
  ],
  "/tracker": [
    "Как отслеживать путь молока?",
    "Что означают статусы в трекере?",
    "Когда ожидать следующую партию?",
  ],
  "/about": [
    "Расскажи историю фермы",
    "Где расположена ферма?",
    "Какие ценности у Шерь Козу?",
  ],
  "/leaderboard": [
    "Как заработать баллы?",
    "Что дают достижения?",
    "Как стать лидером рейтинга?",
  ],
  "/compare": [
    "По каким параметрам сравнивать?",
    "Какая коза лучше для семьи?",
    "Чем Нубийская отличается от Альпийской?",
  ],
  "/partners": [
    "Как стать партнёром фермы?",
    "Какие условия сотрудничества?",
    "Есть ли корпоративные программы?",
  ],
};

const DEFAULT_PROMPTS = [
  "Как выбрать козу?",
  "Какие продукты я получу?",
  "Расскажи о породах",
];

function getPromptsForPage(path: string): string[] {
  // Exact match first
  if (PAGE_PROMPTS[path]) return PAGE_PROMPTS[path];
  // Prefix match for nested routes (e.g., /animals/bella -> /animals)
  const base = "/" + path.split("/").filter(Boolean)[0];
  if (PAGE_PROMPTS[base]) return PAGE_PROMPTS[base];
  return DEFAULT_PROMPTS;
}

export default function MashaFloatingChat() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [askedForName, setAskedForName] = useState(false);
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate a stable session ID for analytics
  const sessionId = useMemo(
    () => `floating-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  // Get user name from auth profile
  useEffect(() => {
    if (user?.name) {
      setUserName(user.name);
    }
  }, [user]);

  // Context-aware prompts
  const suggestedPrompts = useMemo(
    () => getPromptsForPage(location),
    [location]
  );

  // A/B testing: fetch greeting variant for this session
  const greetingQuery = trpc.faqChat.getGreetingVariant.useQuery(
    { sessionId, source: "floating" },
    { enabled: isOpen, staleTime: Infinity, refetchOnWindowFocus: false }
  );

  // A/B testing: engagement tracking mutation
  const trackEngagement = trpc.faqChat.trackAbEngagement.useMutation();

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

  // When chat opens, use A/B greeting variant
  useEffect(() => {
    if (!isOpen || messages.length > 0 || askedForName) return;

    // Wait for greeting variant to load
    const greetingText = greetingQuery.data?.greetingText;
    if (!greetingText && greetingQuery.isLoading) return;

    setAskedForName(true);
    setChatStartTime(Date.now());

    if (!userName) {
      // Use A/B variant greeting + ask for name
      const greeting = greetingText || "Привет! Я Маша, AI-управляющая фермой «Шерь Козу» 👋";
      setMessages([
        {
          role: "assistant",
          content: greeting + "\n\nКак я могу к вам обращаться?",
        },
      ]);
    } else {
      // Use A/B variant greeting personalized with name
      const greeting = greetingText || `Привет! Я Маша, AI-управляющая фермой «Шерь Козу» 👋`;
      // Insert user name into greeting
      const personalizedGreeting = greeting.includes("Привет")
        ? greeting.replace("Привет", `Привет, ${userName}`)
        : `${userName}, ${greeting.charAt(0).toLowerCase()}${greeting.slice(1)}`;
      setMessages([
        {
          role: "assistant",
          content: personalizedGreeting + "\n\nЧем могу помочь?",
        },
      ]);
    }
  }, [isOpen, messages.length, userName, askedForName, greetingQuery.data, greetingQuery.isLoading]);

  // Track engagement when chat closes or component unmounts
  useEffect(() => {
    return () => {
      if (chatStartTime && userMessageCount > 0) {
        const durationSeconds = Math.round((Date.now() - chatStartTime) / 1000);
        trackEngagement.mutate({
          sessionId,
          didRespond: true,
          messageCount: userMessageCount,
          durationSeconds,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also track on close
  const handleClose = useCallback(() => {
    if (chatStartTime && userMessageCount > 0) {
      const durationSeconds = Math.round((Date.now() - chatStartTime) / 1000);
      trackEngagement.mutate({
        sessionId,
        didRespond: true,
        messageCount: userMessageCount,
        durationSeconds,
      });
    }
    setIsOpen(false);
  }, [chatStartTime, userMessageCount, sessionId, trackEngagement]);

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text || input).trim();
      if (!content || chatMutation.isPending) return;

      // If Masha asked for name and user responds (first user message)
      if (!userName && messages.length === 1 && messages[0].role === "assistant") {
        // Treat the first response as the user's name if it's short enough
        if (content.length <= 30 && !content.includes("?")) {
          setUserName(content);
        }
      }

      // Track user message count for A/B engagement
      setUserMessageCount((prev) => prev + 1);

      // Track first response for A/B testing
      if (userMessageCount === 0) {
        trackEngagement.mutate({
          sessionId,
          didRespond: true,
          messageCount: 1,
        });
      }

      const updated: ChatMessage[] = [
        ...messages,
        { role: "user", content },
      ];
      const trimmed = trimMessages(updated, MAX_MESSAGES);
      setMessages(trimmed);
      setInput("");
      chatMutation.mutate({
        messages: trimmed,
        sessionId,
        source: "floating",
        userName: userName || undefined,
        currentPage: location,
      });
      textareaRef.current?.focus();
    },
    [input, messages, chatMutation, sessionId, userName, location, userMessageCount, trackEngagement]
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

      {/* Chat Panel — desktop: fixed bottom-right, mobile: full-screen */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed z-50 flex flex-col bg-card shadow-2xl overflow-hidden",
              // Mobile: full-screen
              "inset-0 rounded-none",
              // Desktop: bottom-right panel
              "sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[540px] sm:rounded-2xl sm:border sm:border-border/60"
            )}
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
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Закрыть чат"
              >
                {/* On mobile show chevron down, on desktop show X */}
                <X className="h-4 w-4 hidden sm:block" />
                <ChevronDown className="h-5 w-5 sm:hidden" />
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
                      {userName ? `Привет, ${userName}! 👋` : "Привет! Я Маша 👋"}
                    </p>
                    <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                      Спросите меня о ферме, животных, продуктах или клубе
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-[320px]">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        disabled={chatMutation.isPending}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
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
                              <LazyStreamdown>{msg.content}</LazyStreamdown>
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
              className="flex items-end gap-2 border-t border-border/60 bg-background/50 p-2.5 pb-safe"
            >
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) setInput(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Спросите Машу..."
                  maxLength={MAX_CHARS}
                  className="w-full max-h-20 resize-none min-h-8 rounded-xl text-[13px] pr-2"
                  rows={1}
                />
                {input.length >= CHAR_WARNING_THRESHOLD && (
                  <span
                    className={cn(
                      "absolute bottom-0.5 right-2 text-[10px] tabular-nums",
                      input.length >= MAX_CHARS * 0.95
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {input.length}/{MAX_CHARS}
                  </span>
                )}
              </div>
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
