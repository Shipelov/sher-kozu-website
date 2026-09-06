/**
 * ZoyaChat — AI Nutritionist Chat Component
 *
 * Features:
 * - SSE streaming for real-time typing effect
 * - 3 user types: guest (3 msg limit), registered (unlimited), owner (personalized)
 * - Suggested prompts based on user type
 * - Session persistence for authenticated users
 * - Markdown rendering with Streamdown
 * - Registration CTA for guests hitting limit
 * - Responsive: full-width embedded or floating panel
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDisplayName } from "@shared/formatName";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import LazyStreamdown from "@/components/LazyStreamdown";
import {
  Send,
  Loader2,
  Leaf,
  Sparkles,
  Lock,
  ArrowRight,
} from "lucide-react";
import ZoyaExportActions from "./ZoyaExportActions";
import { cn } from "@/lib/utils";

const ZOYA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/zoya_avatar_128_9c34a1ee.webp";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type UserType = "guest" | "registered" | "owner";

const MAX_CHARS = 8000;
const CHAR_WARNING = 6500;
const REQUEST_HISTORY_LIMIT = 12;

/* ─── Suggested prompts by user type ─── */
const GUEST_PROMPTS = [
  "Чем козье молоко полезнее коровьего?",
  "Какие витамины в овечьем молоке?",
  "Подходит ли козье молоко для детей?",
];

const REGISTERED_PROMPTS = [
  "Составь мне план здорового питания",
  "Какие сыры самые полезные?",
  "Помоги выбрать продукты для ребёнка",
];

const OWNER_PROMPTS = [
  "Что приготовить из молока моего животного?",
  "Составь рацион с учётом моей доставки",
  "Какие продукты лучше для моей семьи?",
];

function getPrompts(userType: UserType): string[] {
  switch (userType) {
    case "owner":
      return OWNER_PROMPTS;
    case "registered":
      return REGISTERED_PROMPTS;
    default:
      return GUEST_PROMPTS;
  }
}

/* ─── Fingerprint for guest rate limiting ─── */
function getFingerprint(): string {
  const key = "zoya_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `fp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, fp);
  }
  return fp;
}

type ZoyaChatProps = {
  /** Embedded mode (full width in page) vs compact (floating panel) */
  mode?: "embedded" | "compact";
  /** Custom className for the container */
  className?: string;
  /** Callback when guest hits limit — can trigger auth modal */
  onAuthRequired?: () => void;
};

export default function ZoyaChat({
  mode = "embedded",
  className,
  onAuthRequired,
}: ZoyaChatProps) {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [userType, setUserType] = useState<UserType>("guest");
  const [limitReached, setLimitReached] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Determine user type
  useEffect(() => {
    if (isAuthenticated) {
      // Will be updated by SSE meta event
      setUserType("registered");
    } else {
      setUserType("guest");
    }
  }, [isAuthenticated]);

  const suggestedPrompts = useMemo(
    () => getPrompts(userType),
    [userType]
  );

  // Initial greeting
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    const displayName = formatDisplayName(user?.name);
    const greeting = user?.name
      ? `Здравствуйте, ${displayName}! Я Зоя — AI-нутрициолог фермы «Шерь Козу» 🌿\n\nЯ помогу разобраться в пользе козьего и овечьего молока, подберу продукты под ваши цели и составлю план здорового питания. Чем могу помочь?`
      : `Здравствуйте! Я Зоя — AI-нутрициолог фермы «Шерь Козу» 🌿\n\nЯ расскажу о пользе козьего и овечьего молока, помогу выбрать продукты и составлю план питания. Спрашивайте!`;

    setMessages([{ role: "assistant", content: greeting }]);
  }, [initialized, user]);

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
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text || input).trim();
      if (!content || isStreaming || limitReached) return;

      // Add user message
      const updatedMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content },
      ];
      setMessages(updatedMessages);
      setInput("");
      setIsStreaming(true);
      setStreamingContent("");

      // Abort any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/zoya/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            messages: updatedMessages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .slice(-REQUEST_HISTORY_LIMIT),
            sessionId,
            fingerprint: !isAuthenticated ? getFingerprint() : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let fullContent = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "meta") {
                setUserType(parsed.userType);
                continue;
              }

              if (parsed.type === "limit_reached") {
                setLimitReached(true);
                fullContent = parsed.content;
                setStreamingContent(fullContent);
                continue;
              }

              if (parsed.type === "error") {
                fullContent = parsed.content;
                setStreamingContent(fullContent);
                continue;
              }

              if (parsed.type === "chunk") {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }

              if (parsed.type === "session") {
                setSessionId(parsed.sessionId);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        // Finalize: move streaming content to messages
        if (fullContent) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullContent },
          ]);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Простите, произошла ошибка. Попробуйте ещё раз через минутку 🌿",
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [input, messages, isStreaming, limitReached, sessionId, isAuthenticated]
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

  const isEmbedded = mode === "embedded";

  return (
    <div
      className={cn(
        "flex flex-col bg-card overflow-hidden",
        isEmbedded
          ? "rounded-2xl border border-border/60 shadow-lg"
          : "h-full",
        className
      )}
      style={isEmbedded ? { height: "580px" } : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-emerald-50/80 to-transparent px-4 py-3">
        <div className="relative">
          <img
            src={ZOYA_AVATAR}
            alt="Зоя"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-200/60"
          />
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            Зоя
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Нутрициолог фермы «Шерь Козу»
          </p>
        </div>
        {userType !== "guest" && (
          <div className="ml-auto">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                userType === "owner"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-primary/10 text-primary"
              )}
            >
              {userType === "owner" ? "Владелец" : "Участник"}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-hidden">
        {messages.length <= 1 && !isStreaming ? (
          <ScrollArea className="h-full">
            <div className="flex flex-col items-center justify-center gap-4 p-5 pt-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <img
                  src={ZOYA_AVATAR}
                  alt="Зоя"
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-200/40 shadow-md"
                />
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  {user?.name ? `Привет, ${formatDisplayName(user.name)}! 🌿` : "Привет! Я Зоя 🌿"}
                </p>
                <p className="max-w-[300px] text-xs leading-relaxed text-muted-foreground">
                  Спросите о пользе козьего и овечьего молока, продуктах фермы или попросите составить план питания
                </p>
              </div>

              {/* Suggested prompts */}
              <div className="flex flex-wrap justify-center gap-2 max-w-[360px]">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    disabled={isStreaming}
                    className="rounded-full border border-emerald-200/60 bg-emerald-50/50 px-3 py-1.5 text-[11px] text-foreground transition-all hover:border-emerald-300 hover:bg-emerald-100/50 disabled:opacity-50 cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {userType === "guest" && (
                <p className="text-[10px] text-muted-foreground/70 mt-2">
                  <Lock className="inline h-3 w-3 mr-0.5" />
                  3 бесплатных сообщения для гостей
                </p>
              )}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3 p-3">
              {messages.map((msg, i) => {
                // Find the user question that preceded this assistant message
                const prevUserMsg =
                  msg.role === "assistant" && i > 0
                    ? messages
                        .slice(0, i)
                        .reverse()
                        .find((m) => m.role === "user")
                    : undefined;
                const isLastAssistant =
                  msg.role === "assistant" &&
                  !isStreaming &&
                  i === messages.length - 1;

                return (
                  <div key={i}>
                    <div
                      className={cn(
                        "flex gap-2",
                        msg.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <img
                          src={ZOYA_AVATAR}
                          alt="Зоя"
                          className="h-6 w-6 shrink-0 rounded-full object-cover mt-1"
                        />
                      )}
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px]",
                          msg.role === "user"
                            ? "bg-emerald-600 text-white rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5">
                            <LazyStreamdown>{msg.content}</LazyStreamdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Export actions for substantive assistant responses */}
                    {msg.role === "assistant" && isLastAssistant && (
                      <ZoyaExportActions
                        content={msg.content}
                        userQuestion={prevUserMsg?.content}
                        userName={user?.name ?? undefined}
                        compact={mode === "compact"}
                      />
                    )}
                  </div>
                );
              })}

              {/* Streaming message */}
              {isStreaming && streamingContent && (
                <div className="flex gap-2 justify-start">
                  <img
                    src={ZOYA_AVATAR}
                    alt="Зоя"
                    className="h-6 w-6 shrink-0 rounded-full object-cover mt-1"
                  />
                  <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-muted text-foreground px-3.5 py-2 text-[13px]">
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5">
                      <LazyStreamdown>{streamingContent}</LazyStreamdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading dots */}
              {isStreaming && !streamingContent && (
                <div className="flex gap-2">
                  <img
                    src={ZOYA_AVATAR}
                    alt="Зоя"
                    className="h-6 w-6 shrink-0 rounded-full object-cover mt-1"
                  />
                  <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Guest limit reached CTA */}
              {limitReached && (
                <div className="mx-auto mt-2 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                  <Lock className="mx-auto h-5 w-5 text-emerald-600 mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Бесплатные сообщения закончились
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Зарегистрируйтесь, чтобы общаться с Зоей без ограничений — это бесплатно
                  </p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onAuthRequired?.()}
                  >
                    Зарегистрироваться
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
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
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={limitReached ? "Зарегистрируйтесь для продолжения..." : "Спросите Зою..."}
            disabled={limitReached}
            maxLength={MAX_CHARS}
            className="w-full max-h-20 resize-none min-h-8 rounded-xl text-[13px] pr-2"
            rows={1}
          />
          {input.length >= CHAR_WARNING && (
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
          disabled={!input.trim() || isStreaming || limitReached}
          className="shrink-0 h-8 w-8 rounded-xl bg-emerald-600 hover:bg-emerald-700"
        >
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </form>
    </div>
  );
}
