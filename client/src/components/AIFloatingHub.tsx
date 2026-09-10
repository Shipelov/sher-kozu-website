/**
 * AIFloatingHub — Unified floating AI assistant hub.
 *
 * Replaces two separate floating buttons (Masha + Zoya) with one smart button.
 * On click, shows a compact selector: Masha (farm manager) or Zoya (nutritionist).
 * Selecting one opens the corresponding chat panel.
 *
 * - Bottom-right position (where Masha used to be)
 * - Single pulse animation (no dual-button confusion)
 * - Hidden on /faq (Masha embedded) and /nutritionist (Zoya embedded)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDisplayName } from "@shared/formatName";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import LazyStreamdown from "@/components/LazyStreamdown";
import { MASHA_TOOL_LABELS, useMashaChat } from "@/hooks/useMashaChat";
import { currentOrigin, renderAssistantLinks } from "@/lib/assistantMarkdown";
import {
  Send,
  Loader2,
  X,
  MessageCircle,
  ChevronDown,
  Leaf,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
const ZoyaChat = React.lazy(() => import("./ZoyaChat"));
import AuthModal from "./AuthModal";

/* ─── Avatars ─── */
const MASHA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha_avatar_128_ad92cbd8.webp";
const ZOYA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/zoya_avatar_128_9c34a1ee.webp";

type ActivePanel = null | "selector" | "masha" | "zoya";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGES = 30;
const MAX_CHARS = 10000;
const CHAR_WARNING_THRESHOLD = 8000;

function trimMessages(msgs: ChatMessage[], max: number): ChatMessage[] {
  if (msgs.length <= max) return msgs;
  return [msgs[0], ...msgs.slice(-(max - 1))];
}

/* ─── Context-aware suggested prompts for Masha ─── */
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
  if (PAGE_PROMPTS[path]) return PAGE_PROMPTS[path];
  const base = "/" + path.split("/").filter(Boolean)[0];
  if (PAGE_PROMPTS[base]) return PAGE_PROMPTS[base];
  return DEFAULT_PROMPTS;
}

/* ═══════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════ */
export default function AIFloatingHub() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  /* ─── Masha state ─── */
  const [mashaMessages, setMashaMessages] = useState<ChatMessage[]>([]);
  const [mashaInput, setMashaInput] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [askedForName, setAskedForName] = useState(false);
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const mashaScrollRef = useRef<HTMLDivElement>(null);
  const mashaTextareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Zoya state ─── */
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">("register");

  const sessionId = useMemo(
    () => `hub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  useEffect(() => {
    if (user?.name) setUserName(formatDisplayName(user.name));
  }, [user]);

  const suggestedPrompts = useMemo(
    () => getPromptsForPage(location),
    [location]
  );

  /* ─── Masha tRPC ─── */
  const greetingQuery = trpc.faqChat.getGreetingVariant.useQuery(
    { sessionId, source: "floating" },
    { enabled: activePanel === "masha", staleTime: Infinity, refetchOnWindowFocus: false }
  );

  const trackEngagement = trpc.faqChat.trackAbEngagement.useMutation();

  // SSE-стрим с fallback на tRPC-мутацию faqChat.chat
  const mashaChat = useMashaChat({
    onReply: (reply) => setMashaMessages((prev) => [...prev, { role: "assistant", content: reply }]),
  });

  const scrollToBottom = useCallback(() => {
    const viewport = mashaScrollRef.current?.querySelector(
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
  }, [mashaMessages, scrollToBottom]);

  useEffect(() => {
    if (activePanel === "masha" && mashaTextareaRef.current) {
      mashaTextareaRef.current.focus();
    }
  }, [activePanel]);

  /* ─── Masha greeting ─── */
  useEffect(() => {
    if (activePanel !== "masha" || mashaMessages.length > 0 || askedForName) return;
    const greetingText = greetingQuery.data?.greetingText;
    if (!greetingText && greetingQuery.isLoading) return;

    setAskedForName(true);
    setChatStartTime(Date.now());

    if (!userName) {
      const greeting = greetingText || "Привет! Я Маша, AI-управляющая фермой «Шерь Козу» 👋";
      setMashaMessages([{ role: "assistant", content: greeting + "\n\nКак я могу к вам обращаться?" }]);
    } else {
      const greeting = greetingText || `Привет! Я Маша, AI-управляющая фермой «Шерь Козу» 👋`;
      const personalizedGreeting = greeting.includes("Привет")
        ? greeting.replace("Привет", `Привет, ${userName}`)
        : `${userName}, ${greeting.charAt(0).toLowerCase()}${greeting.slice(1)}`;
      setMashaMessages([{ role: "assistant", content: personalizedGreeting + "\n\nЧем могу помочь?" }]);
    }
  }, [activePanel, mashaMessages.length, userName, askedForName, greetingQuery.data, greetingQuery.isLoading]);

  /* ─── Engagement tracking ─── */
  useEffect(() => {
    return () => {
      if (chatStartTime && userMessageCount > 0) {
        const durationSeconds = Math.round((Date.now() - chatStartTime) / 1000);
        trackEngagement.mutate({ sessionId, didRespond: true, messageCount: userMessageCount, durationSeconds });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    if (chatStartTime && userMessageCount > 0 && activePanel === "masha") {
      const durationSeconds = Math.round((Date.now() - chatStartTime) / 1000);
      trackEngagement.mutate({ sessionId, didRespond: true, messageCount: userMessageCount, durationSeconds });
    }
    setActivePanel(null);
  }, [chatStartTime, userMessageCount, sessionId, trackEngagement, activePanel]);

  const handleMashaSend = useCallback(
    (text?: string) => {
      const content = (text || mashaInput).trim();
      if (!content || mashaChat.isPending) return;

      if (!userName && mashaMessages.length === 1 && mashaMessages[0].role === "assistant") {
        if (content.length <= 30 && !content.includes("?")) {
          setUserName(content);
        }
      }

      setUserMessageCount((prev) => prev + 1);
      if (userMessageCount === 0) {
        trackEngagement.mutate({ sessionId, didRespond: true, messageCount: 1 });
      }

      const updated: ChatMessage[] = [...mashaMessages, { role: "user", content }];
      const trimmed = trimMessages(updated, MAX_MESSAGES);
      setMashaMessages(trimmed);
      setMashaInput("");
      void mashaChat.send({
        messages: trimmed,
        sessionId,
        source: "floating",
        userName: userName || undefined,
        currentPage: location,
      });
      mashaTextareaRef.current?.focus();
    },
    [mashaInput, mashaMessages, mashaChat, sessionId, userName, location, userMessageCount, trackEngagement]
  );

  const handleMashaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleMashaSend();
      }
    },
    [handleMashaSend]
  );

  const handleZoyaAuthRequired = useCallback(() => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  }, []);

  /* ─── Visibility: hide on ARM pages, admin panel, and pages with embedded chats ─── */
  const isHiddenPage = location === "/faq" || location === "/nutritionist" || location.startsWith("/farm") || location.startsWith("/admin");

  // Close any open panel when navigating to a hidden page
  useEffect(() => {
    if (isHiddenPage && activePanel) setActivePanel(null);
  }, [isHiddenPage, activePanel]);

  // Don't render anything on hidden pages
  if (isHiddenPage) return null;

  /* ─── Determine which avatar to show on the floating button ─── */
  // Show Zoya avatar on nutrition-related pages, Masha everywhere else
  const showZoyaPrimary = location.startsWith("/nutritionist") || location === "/pricing";

  return (
    <>
      {/* ═══ Floating Button ═══ */}
      <AnimatePresence>
        {!activePanel && !isHiddenPage && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setActivePanel("selector")}
            className="fixed bottom-6 right-6 z-50 group cursor-pointer"
            aria-label="Открыть AI-помощников"
          >
            <div className="relative">
              {/* Pulse ring — single, gentle */}
              <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: "2.5s" }} />
              {/* Stacked avatars */}
              <div className="relative h-14 w-14">
                {/* Back avatar (smaller, offset) */}
                <img
                  src={showZoyaPrimary ? MASHA_AVATAR : ZOYA_AVATAR}
                  alt=""
                  className="absolute top-0 left-0 h-8 w-8 rounded-full object-cover ring-2 ring-background shadow-md z-0"
                />
                {/* Front avatar (main) */}
                <div className="absolute bottom-0 right-0 h-11 w-11 rounded-full ring-2 ring-primary/40 shadow-lg overflow-hidden transition-transform group-hover:scale-110 z-10">
                  <img
                    src={showZoyaPrimary ? ZOYA_AVATAR : MASHA_AVATAR}
                    alt="AI-помощники"
                    className="h-full w-full object-cover"
                  />
                </div>
                {/* Sparkle badge */}
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-md z-20">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-card border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              AI-помощники фермы
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══ Selector Panel ═══ */}
      <AnimatePresence>
        {activePanel === "selector" && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[300px] rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">AI-помощники</span>
              </div>
              <button
                onClick={() => setActivePanel(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Options */}
            <div className="p-3 flex flex-col gap-2">
              {/* Masha option */}
              <button
                onClick={() => setActivePanel("masha")}
                className="flex items-center gap-3 w-full rounded-xl p-3 text-left transition-all hover:bg-primary/5 border border-transparent hover:border-primary/20 cursor-pointer group"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={MASHA_AVATAR}
                    alt="Маша"
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Маша</p>
                  <p className="text-xs text-muted-foreground truncate">Управляющая фермой — всё о ферме и продуктах</p>
                </div>
                <MessageCircle className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors flex-shrink-0" />
              </button>

              {/* Zoya option */}
              <button
                onClick={() => setActivePanel("zoya")}
                className="flex items-center gap-3 w-full rounded-xl p-3 text-left transition-all hover:bg-emerald-50 border border-transparent hover:border-emerald-200 cursor-pointer group"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={ZOYA_AVATAR}
                    alt="Зоя"
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-emerald-400/20 group-hover:ring-emerald-400/40 transition-all"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Зоя</p>
                  <p className="text-xs text-muted-foreground truncate">Нутрициолог — питание, рецепты, здоровье</p>
                </div>
                <Leaf className="h-4 w-4 text-emerald-500/50 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Masha Chat Panel ═══ */}
      <AnimatePresence>
        {activePanel === "masha" && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed z-50 flex flex-col bg-card shadow-2xl overflow-hidden",
              "inset-0 rounded-none",
              "sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[540px] sm:rounded-2xl sm:border sm:border-border/60"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActivePanel("selector")}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer hidden sm:block"
                  aria-label="Назад к выбору"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="relative">
                  <img src={MASHA_AVATAR} alt="Маша" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20" />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Маша</p>
                  <p className="text-[11px] text-muted-foreground">AI Управляющая фермой</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Закрыть чат"
              >
                <X className="h-4 w-4 hidden sm:block" />
                <ChevronDown className="h-5 w-5 sm:hidden" />
              </button>
            </div>

            {/* Messages */}
            <div ref={mashaScrollRef} className="flex-1 overflow-hidden">
              {mashaMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <img src={MASHA_AVATAR} alt="Маша" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/10 shadow-md" />
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
                        onClick={() => handleMashaSend(prompt)}
                        disabled={mashaChat.isPending}
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
                    {mashaMessages.map((msg, i) => (
                      <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                          <img src={MASHA_AVATAR} alt="Маша" className="h-6 w-6 shrink-0 rounded-full object-cover mt-1" />
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
                              <LazyStreamdown>{renderAssistantLinks(msg.content, currentOrigin())}</LazyStreamdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {mashaChat.isPending && (
                      <div className="flex gap-2">
                        <img src={MASHA_AVATAR} alt="Маша" className="h-6 w-6 shrink-0 rounded-full object-cover mt-1" />
                        <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
                          {mashaChat.streamingContent ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5">
                              <LazyStreamdown>{renderAssistantLinks(mashaChat.streamingContent, currentOrigin())}</LazyStreamdown>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                              </div>
                              {mashaChat.activeTool && (
                                <span className="text-[11px] text-muted-foreground">{MASHA_TOOL_LABELS[mashaChat.activeTool] ?? "Уточняю…"}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleMashaSend(); }}
              className="flex items-end gap-2 border-t border-border/60 bg-background/50 p-2.5 pb-safe"
            >
              <div className="flex-1 relative">
                <Textarea
                  ref={mashaTextareaRef}
                  value={mashaInput}
                  onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setMashaInput(e.target.value); }}
                  onKeyDown={handleMashaKeyDown}
                  placeholder="Спросите Машу..."
                  maxLength={MAX_CHARS}
                  className="w-full max-h-20 resize-none min-h-8 rounded-xl text-[13px] pr-2"
                  rows={1}
                />
                {mashaInput.length >= CHAR_WARNING_THRESHOLD && (
                  <span
                    className={cn(
                      "absolute bottom-0.5 right-2 text-[10px] tabular-nums",
                      mashaInput.length >= MAX_CHARS * 0.95 ? "text-destructive font-medium" : "text-muted-foreground"
                    )}
                  >
                    {mashaInput.length}/{MAX_CHARS}
                  </span>
                )}
              </div>
              <Button type="submit" size="icon" disabled={!mashaInput.trim() || mashaChat.isPending} className="shrink-0 h-8 w-8 rounded-xl">
                {mashaChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Zoya Chat Panel ═══ */}
      <AnimatePresence>
        {activePanel === "zoya" && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed z-50 flex flex-col bg-card shadow-2xl overflow-hidden",
              "inset-0 rounded-none",
              "sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[560px] sm:rounded-2xl sm:border sm:border-border/60"
            )}
          >
            {/* Close / back buttons */}
            <div className="absolute top-3 left-3 z-10 hidden sm:block">
              <button
                onClick={() => setActivePanel("selector")}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Назад к выбору"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Закрыть чат"
            >
              <X className="h-4 w-4 hidden sm:block" />
              <ChevronDown className="h-5 w-5 sm:hidden" />
            </button>

            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }>
              <ZoyaChat mode="compact" onAuthRequired={handleZoyaAuthRequired} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal for Zoya */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultView={authModalView} />
    </>
  );
}
