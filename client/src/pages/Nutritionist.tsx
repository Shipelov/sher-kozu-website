/**
 * Nutritionist.tsx — Zoya AI Nutritionist Landing Page
 *
 * Structure (4 viewport blocks):
 * 1. Hero: Zoya introduction + value proposition
 * 2. Scenario cards: What Zoya can do for you
 * 3. Embedded chat: Talk to Zoya right here
 * 4. Science showcase: Why goat/sheep milk is special
 */

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ZoyaChat from "@/components/ZoyaChat";
import AuthModal from "@/components/AuthModal";
import {
  Leaf,
  Brain,
  Utensils,
  Baby,
  Heart,
  FlaskConical,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Milk,
  BookOpen,
  Target,
  Apple,
  Dumbbell,
} from "lucide-react";

const ZOYA_HERO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/zoya_avatar_v1_aeb7b33a.png";

const ZOYA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/zoya_avatar_128_9c34a1ee.webp";

/* ─── Scenario Cards Data ─── */
const scenarios = [
  {
    icon: Brain,
    title: "Персональный план питания",
    text: "Зоя поможет составить рацион с учётом подтверждённого профиля, целей и доступных продуктов фермы. Расчётные значения проходят серверную проверку.",
    color: "emerald",
  },
  {
    icon: Baby,
    title: "Питание для детей",
    text: "Зоя объяснит общие принципы детского питания и подскажет, какие вопросы о молочных продуктах важно обсудить с педиатром. Она не заменяет медицинскую консультацию.",
    color: "amber",
  },
  {
    icon: FlaskConical,
    title: "Научная экспертиза",
    text: "Зоя сопоставляет подтверждённые данные фермы с проверенными источниками и отделяет факты конкретного продукта от справочных оценок.",
    color: "blue",
  },
  {
    icon: Utensils,
    title: "Рецепты и кулинария",
    text: "Что приготовить из козьего молока? Как использовать овечий сыр? Зоя предложит рецепты, адаптированные под ваши продукты.",
    color: "rose",
  },
  {
    icon: Target,
    title: "Сравнение продуктов",
    text: "Магазинное vs фермерское, козье vs коровье, Нубийская vs Альпийская — Зоя покажет разницу в цифрах и объяснит, что важно именно для вас.",
    color: "violet",
  },
  {
    icon: Heart,
    title: "Здоровье и аллергии",
    text: "Зоя различает непереносимость лактозы и аллергию на молочный белок. При аллергии козье и овечье молоко не считаются безопасной заменой без решения врача.",
    color: "teal",
  },
];

/* ─── Science Facts ─── */
const scienceFacts = [
  {
    icon: Milk,
    title: "A2-казеин",
    value: "зависит от генотипа",
    desc: "Профиль β-казеина зависит от породы и конкретного животного. Даже молоко с A2-вариантом не является безопасным при подтверждённой аллергии на молочный белок.",
    source: "World Allergy Organization: DRACMA guideline",
  },
  {
    icon: FlaskConical,
    title: "Жировые глобулы",
    value: "в среднем меньше",
    desc: "Размер жировых глобул козьего молока в среднем меньше, чем коровьего, но показатели варьируют. Это свойство нельзя превращать в обещание лечебного эффекта.",
    source: "Park et al., Small Ruminant Research, 2007",
  },
  {
    icon: ShieldCheck,
    title: "Кальций",
    value: "зависит от продукта",
    desc: "Содержание кальция зависит от вида молока, сезона и технологии продукта. Для расчётов Зоя использует лабораторные данные или явно отмеченный справочный аналог.",
    source: "USDA FoodData Central",
  },
  {
    icon: Apple,
    title: "Овечье молоко",
    value: "больше сухих веществ",
    desc: "Овечье молоко обычно содержит больше жира, белка и сухих веществ, чем коровье и козье, поэтому хорошо подходит для сыроделия. Состав конкретной партии проверяется отдельно.",
    source: "FAO Dairy Production and Products",
  },
];

/* ─── Color helpers ─── */
function getColorClasses(color: string) {
  const map: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/60", iconBg: "bg-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60", iconBg: "bg-amber-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/60", iconBg: "bg-blue-100" },
    rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200/60", iconBg: "bg-rose-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200/60", iconBg: "bg-violet-100" },
    teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200/60", iconBg: "bg-teal-100" },
  };
  return map[color] || map.emerald;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

export default function Nutritionist() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">("register");

  const handleAuthRequired = useCallback(() => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO: Meet Zoya
          ═══════════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden border-b border-border/60 bg-gradient-to-br from-emerald-50/60 via-background to-amber-50/30 pt-28 pb-20 md:pt-36 md:pb-28">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none opacity-30" aria-hidden>
          <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute right-10 bottom-10 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
        </div>

        <div className="container relative">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Left: Text */}
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-white/80 px-4 py-2 text-sm text-emerald-700 shadow-sm backdrop-blur"
              >
                <Leaf className="h-4 w-4" />
                AI-нутрициолог фермы «Шерь Козу»
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-7 font-display text-5xl leading-[0.95] text-foreground md:text-7xl"
              >
                Познакомьтесь{" "}
                <span className="text-emerald-600">с Зоей</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground"
              >
                Зоя — ваш персональный AI-помощник по питанию. Она объединяет подтверждённый профиль,
                доступные продукты фермы и проверенную базу знаний, а затем помогает составить понятный рацион.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-wrap gap-3"
              >
                <a
                  href="#chat"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg"
                >
                  <Sparkles className="h-4 w-4" />
                  Спросить Зою
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#science"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-6 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 hover:border-emerald-300"
                >
                  <BookOpen className="h-4 w-4" />
                  Научные факты
                </a>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mt-8 flex flex-wrap gap-4 text-xs text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Научная база знаний
                </span>
                <span className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-emerald-600" />
                  Персонализация
                </span>
                <span className="flex items-center gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5 text-emerald-600" />
                  Планы питания
                </span>
              </motion.div>
            </div>

            {/* Right: Zoya portrait */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="relative mx-auto max-w-md lg:max-w-none"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-emerald-200/40">
                <img
                  src={ZOYA_HERO}
                  alt="Зоя — AI-нутрициолог фермы Шерь Козу"
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
                {/* Overlay card */}
                <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/90 backdrop-blur-sm border border-emerald-200/40 p-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={ZOYA_AVATAR}
                      alt="Зоя"
                      className="h-10 w-10 rounded-full ring-2 ring-emerald-200/60"
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        Зоя
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                          <Sparkles className="h-2 w-2" />
                          AI
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        AI-нутрициолог • Проверенные данные • Продукты вашей фермы
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — SCENARIO CARDS: What Zoya can do
          ═══════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 border-b border-border/60">
        <div className="container">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 mb-4">
              <Sparkles className="h-3 w-3" />
              Возможности
            </span>
            <h2 className="font-display text-3xl md:text-5xl text-foreground">
              Чем поможет <span className="text-emerald-600">Зоя</span>
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
              От научных фактов до персональных рационов — Зоя объединяет знания нутрициологии 
              с уникальными данными о продуктах вашей фермы
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((s, i) => {
              const colors = getColorClasses(s.color);
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  {...fadeUp}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className={`group rounded-2xl border ${colors.border} ${colors.bg} p-6 transition-all hover:shadow-md`}
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${colors.iconBg} mb-4`}>
                    <Icon className={`h-5 w-5 ${colors.text}`} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — EMBEDDED CHAT: Talk to Zoya
          ═══════════════════════════════════════════════════════ */}
      <section id="chat" className="py-20 md:py-28 bg-gradient-to-b from-background to-emerald-50/30 border-b border-border/60">
        <div className="container">
          <motion.div {...fadeUp} className="text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 mb-4">
              <Leaf className="h-3 w-3" />
              Чат
            </span>
            <h2 className="font-display text-3xl md:text-5xl text-foreground">
              Спросите <span className="text-emerald-600">Зою</span> прямо сейчас
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
              Задайте вопрос о питании, здоровье или продуктах фермы — Зоя ответит на основе научных данных
            </p>
          </motion.div>

          <motion.div {...fadeUp} className="max-w-2xl mx-auto">
            <ZoyaChat
              mode="embedded"
              onAuthRequired={handleAuthRequired}
            />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — SCIENCE SHOWCASE: Why goat/sheep milk
          ═══════════════════════════════════════════════════════ */}
      <section id="science" className="py-20 md:py-28">
        <div className="container">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 mb-4">
              <FlaskConical className="h-3 w-3" />
              Наука
            </span>
            <h2 className="font-display text-3xl md:text-5xl text-foreground">
              Почему козье и овечье молоко{" "}
              <span className="text-emerald-600">особенное</span>
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
              Не маркетинг, а факты — каждое утверждение подкреплено научными исследованиями
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {scienceFacts.map((fact, i) => {
              const Icon = fact.icon;
              return (
                <motion.div
                  key={fact.title}
                  {...fadeUp}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="group rounded-2xl border border-border/60 bg-card p-6 transition-all hover:shadow-md hover:border-emerald-200/60"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3 mb-1">
                        <h3 className="text-base font-semibold text-foreground">
                          {fact.title}
                        </h3>
                        <span className="text-lg font-bold text-emerald-600">
                          {fact.value}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground mb-2">
                        {fact.desc}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 italic">
                        {fact.source}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* CTA to chat */}
          <motion.div {...fadeUp} className="mt-14 text-center">
            <p className="text-muted-foreground mb-4">
              Хотите узнать больше? Зоя расскажет подробнее о каждом факте
            </p>
            <a
              href="#chat"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg"
            >
              <Sparkles className="h-4 w-4" />
              Спросить Зою
              <ArrowRight className="h-4 w-4" />
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultView={authModalView}
      />
    </div>
  );
}
