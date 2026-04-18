/**
 * FAQ.tsx — Frequently Asked Questions + Masha AI Chat
 *
 * Two-column layout on desktop:
 * - Left: Traditional FAQ accordion organized by categories
 * - Right: Masha AI chat interface (sticky)
 *
 * Mobile: stacked — FAQ first, then chat
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Streamdown } from "streamdown";
import {
  ChevronDown,
  Leaf,
  MessageCircle,
  Send,
  Loader2,
  HelpCircle,
  PawPrint,
  Milk,
  Users,
  CreditCard,
  Truck,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── FAQ Data ─── */
type FAQItem = { q: string; a: string };
type FAQCategory = { title: string; icon: React.ElementType; items: FAQItem[] };

const FAQ_DATA: FAQCategory[] = [
  {
    title: "О персональном фермерстве",
    icon: HelpCircle,
    items: [
      {
        q: "Что такое персональное фермерство?",
        a: "Персональное фермерство — это модель, при которой вы выбираете конкретное животное на нашей ферме (козу или овцу), наблюдаете за его жизнью и получаете именные молочные продукты именно от вашего животного. Это не абстрактная подписка, а живая связь с конкретным существом.",
      },
      {
        q: "Чем это отличается от обычной покупки фермерских продуктов?",
        a: "Вы знаете своё животное по имени, видите его фото и дневник, отслеживаете путь молока от надоя до доставки. Это полная прозрачность, эмоциональная связь и гарантия качества — вы точно знаете, откуда ваши продукты.",
      },
      {
        q: "Нужно ли мне самому ухаживать за животным?",
        a: "Нет, весь уход берёт на себя наша команда профессиональных фермеров. Вы наблюдаете, участвуете в жизни фермы через платформу и получаете продукты. При желании можете приехать на ферму и пообщаться с вашим животным лично.",
      },
      {
        q: "Можно ли приехать на ферму?",
        a: "Конечно! Мы находимся в Истринском районе Подмосковья, всего в 65 км от Москвы по Новорижскому шоссе. Для владельцев животных организуются регулярные визиты, мастер-классы и семейные мероприятия.",
      },
    ],
  },
  {
    title: "Животные и породы",
    icon: PawPrint,
    items: [
      {
        q: "Какие породы есть на ферме?",
        a: "У нас четыре элитные молочные породы: англо-нубийская коза (сливочное молоко 5-8% жирности), альпийская коза (рекордные удои), овца Остфриз (самая молочная порода овец в мире) и овца Лакон (из её молока делают знаменитый Рокфор).",
      },
      {
        q: "Как выбрать животное?",
        a: "В каталоге на сайте представлены все доступные животные с фотографиями, описанием характера, породы и истории. Вы можете сравнить несколько животных по параметрам и выбрать то, которое вам ближе. Каждое животное уникально!",
      },
      {
        q: "Можно ли сменить животное?",
        a: "Да, при необходимости вы можете перейти к другому животному. Свяжитесь с нами, и мы поможем подобрать нового подопечного. Однако большинство владельцев привязываются к своему животному и остаются с ним надолго.",
      },
      {
        q: "Что происходит, если животное заболело?",
        a: "У нас есть штатный ветеринар, который следит за здоровьем всех животных. В личном кабинете вы видите медицинскую карту вашего животного. В случае болезни мы сразу уведомляем вас и обеспечиваем лучшее лечение.",
      },
    ],
  },
  {
    title: "Продукты и доставка",
    icon: Milk,
    items: [
      {
        q: "Какие продукты я буду получать?",
        a: "Именные молочные продукты: свежее молоко, различные сыры (мягкие, выдержанные, рикотта, брынза), йогурты, масло. Состав зависит от породы вашего животного и сезона. Также доступны подарочные наборы.",
      },
      {
        q: "Как часто доставляются продукты?",
        a: "Частота доставки зависит от выбранного тарифного плана. Стандартная доставка — раз в неделю или раз в две недели. Доставка осуществляется по Москве и Подмосковью в охлаждённом виде.",
      },
      {
        q: "Как отследить путь продуктов?",
        a: "В личном кабинете есть трекер продуктов, который показывает весь путь: от надоя молока, через производство до доставки к вашей двери. Полная прозрачность на каждом этапе.",
      },
    ],
  },
  {
    title: "Клуб владельцев",
    icon: Users,
    items: [
      {
        q: "Что такое клуб владельцев?",
        a: "Это закрытое сообщество людей, которые разделяют ценности осознанного потребления и персонального фермерства. В клубе проходят ужины на ферме, мастер-классы по сыроварению, семейные мероприятия и праздники.",
      },
      {
        q: "Как стать членом клуба?",
        a: "Членство в клубе автоматически доступно всем владельцам животных. Выберите своё животное — и вы уже в клубе! Вам откроется доступ к ленте новостей, событиям и специальным мероприятиям.",
      },
      {
        q: "Какие мероприятия проводятся?",
        a: "Регулярные визиты на ферму, мастер-классы по сыроварению, сезонные ужины с продуктами фермы, детские программы, праздники урожая и тематические вечера. Расписание доступно в разделе «Клуб».",
      },
    ],
  },
  {
    title: "Стоимость и оплата",
    icon: CreditCard,
    items: [
      {
        q: "Сколько стоит участие?",
        a: "Стоимость зависит от выбранного животного, породы и тарифного плана. Актуальные цены указаны в каталоге животных на сайте. Мы предлагаем гибкие планы для разных потребностей.",
      },
      {
        q: "Есть ли пробный период?",
        a: "Мы регулярно проводим дни открытых дверей, где вы можете познакомиться с фермой, животными и попробовать продукцию. Следите за анонсами в разделе «Клуб» или свяжитесь с нами.",
      },
      {
        q: "Можно ли подарить участие?",
        a: "Да! Персональное фермерство — отличный подарок. Мы предлагаем подарочные сертификаты и именные наборы. Это уникальный подарок для семьи, друзей или деловых партнёров.",
      },
    ],
  },
  {
    title: "Безопасность и качество",
    icon: Shield,
    items: [
      {
        q: "Как обеспечивается качество продуктов?",
        a: "Все продукты проходят ветеринарный контроль. Животные содержатся в идеальных условиях, питаются натуральными кормами. Трекер продуктов обеспечивает полную прозрачность на каждом этапе — от фермы до вашего стола.",
      },
      {
        q: "Есть ли сертификаты?",
        a: "Ферма имеет все необходимые ветеринарные документы и сертификаты. Информация о здоровье каждого животного доступна в его профиле на платформе.",
      },
    ],
  },
];

/* ─── Chat message type ─── */
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/* ─── Accordion Item ─── */
function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-primary cursor-pointer"
      >
        <span className="text-sm font-medium text-foreground pr-2">{item.q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
      </motion.div>
    </div>
  );
}

const FAQ_MAX_MESSAGES = 30;
const FAQ_MAX_CHARS = 10000;
const FAQ_CHAR_WARNING_THRESHOLD = 8000;

function trimFaqMessages(msgs: ChatMessage[], max: number): ChatMessage[] {
  if (msgs.length <= max) return msgs;
  return [msgs[0], ...msgs.slice(-(max - 1))];
}

/* ─── Masha Chat Component ─── */
function MashaChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.faqChat.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Простите, произошла ошибка. Попробуйте ещё раз через минутку! 🌿",
        },
      ]);
    },
  });

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text || input).trim();
      if (!content || chatMutation.isPending) return;

      const updated: ChatMessage[] = [...messages, { role: "user", content }];
      const trimmed = trimFaqMessages(updated, FAQ_MAX_MESSAGES);
      setMessages(trimmed);
      setInput("");
      chatMutation.mutate({ messages: trimmed });
      textareaRef.current?.focus();
    },
    [input, messages, chatMutation]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    "Как выбрать козу?",
    "Какие продукты я получу?",
    "Расскажи о породах",
    "Как попасть на ферму?",
  ];

  return (
    <div className="flex flex-col rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden h-[600px] lg:h-[680px]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent px-5 py-4">
        <div className="relative">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha_avatar_128_ad92cbd8.webp"
            alt="Маша — AI Управляющая"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20"
          />
          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Маша</p>
          <p className="text-xs text-muted-foreground">AI Управляющая фермой • онлайн</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha_avatar_128_ad92cbd8.webp"
                alt="Маша"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/10 shadow-md"
              />
              <p className="mt-2 text-sm font-medium text-foreground">Привет! Я Маша 👋</p>
              <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                Управляющая фермой «Шерь Козу». Спросите меня о ферме, животных, продуктах или клубе — я с радостью помогу!
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={chatMutation.isPending}
                  className="rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3 p-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <img
                      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha_avatar_128_ad92cbd8.webp"
                      alt="Маша"
                      className="h-7 w-7 shrink-0 rounded-full object-cover mt-1"
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-2.5">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha_avatar_128_ad92cbd8.webp"
                    alt="Маша"
                    className="h-7 w-7 shrink-0 rounded-full object-cover mt-1"
                  />
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
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
        className="flex items-end gap-2 border-t border-border/60 bg-background/50 p-3"
      >
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= FAQ_MAX_CHARS) setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Спросите Машу о ферме..."
            maxLength={FAQ_MAX_CHARS}
            className="w-full max-h-24 resize-none min-h-9 rounded-xl text-sm pr-2"
            rows={1}
          />
          {input.length >= FAQ_CHAR_WARNING_THRESHOLD && (
            <span
              className={cn(
                "absolute bottom-1 right-2 text-[10px] tabular-nums",
                input.length >= FAQ_MAX_CHARS * 0.95
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {input.length}/{FAQ_MAX_CHARS}
            </span>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || chatMutation.isPending}
          className="shrink-0 h-9 w-9 rounded-xl"
        >
          {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

/* ─── Main FAQ Page ─── */
export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-forest-green-pale/40 via-background to-background pt-28 pb-14 md:pt-32 md:pb-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-5">
              <MessageCircle className="h-3.5 w-3.5" />
              Помощь и ответы
            </div>
            <h1 className="font-display text-4xl text-foreground md:text-5xl">
              Часто задаваемые вопросы
            </h1>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Всё, что нужно знать о персональном фермерстве, наших животных и продуктах.
              А если не нашли ответ — спросите Машу, нашу AI-управляющую!
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content: FAQ + Chat */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            {/* Left: FAQ Accordion */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="space-y-8">
                {FAQ_DATA.map((category, catIdx) => {
                  const Icon = category.icon;
                  return (
                    <div key={catIdx}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">{category.title}</h2>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card px-5">
                        {category.items.map((item, itemIdx) => {
                          const key = `${catIdx}-${itemIdx}`;
                          return (
                            <AccordionItem
                              key={key}
                              item={item}
                              isOpen={openItems.has(key)}
                              onToggle={() => toggleItem(key)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Right: Masha Chat (sticky on desktop) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:sticky lg:top-24 lg:self-start"
            >
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Спросите Машу</h2>
              </div>
              <MashaChat />
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
