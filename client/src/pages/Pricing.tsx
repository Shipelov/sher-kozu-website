/*
  Pricing.tsx — Главная страница «Цены»
  CMS-managed: all text, FAQ, steps, rights, calculator example
  Sections:
  1. Hero: «Два простых шага к вашему животному» + quick overview card
  2. Как устроена стоимость: Two-component model explanation
  3. Steps timeline: 6-step journey
  4. Три права владельца: Product plan, milk balance, gift/self
  5. Обзор тарифов: 4 tier cards (Guest, Basic, Standard, Professional)
  6. Calculator CTA: Dark green banner with sample savings
  7. FAQ: Accordion with pricing questions
  8. Footer
*/

import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { trpc } from "@/lib/trpc";
import { useCmsContent } from "@/hooks/useCmsContent";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Calendar,
  Gift,
  Leaf,
  Milk,
  Package,
  Scale,
  Sparkles,
  Star,
  Users,
  Crown,
  Calculator,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

/* ─── Default FAQ Data ─── */
const DEFAULT_FAQ_ITEMS = [
  {
    q: "Что входит в разовый платёж?",
    a: "Право владения долей (50% или 100%) на 1 год, именной сертификат, доступ к экосистеме — личный кабинет, трекер, клуб и все привилегии тарифа.",
  },
  {
    q: "Что покрывает ежемесячный взнос?",
    a: "Содержание животного (корм, ветеринария, уход), переработку молока по вашему продуктовому плану, логистику доставки и доступ к привилегиям вашего тарифного уровня.",
  },
  {
    q: "Можно ли менять продуктовый план?",
    a: "Да. Частота зависит от тарифа: Базовый — раз в квартал, Стандартный — раз в месяц, Профессиональный — раз в неделю. Изменения вступают в силу со следующего производственного цикла.",
  },
  {
    q: "Что такое баланс молока?",
    a: "Это реальное количество молока от вашего животного, пропорциональное доле владения. Баланс обновляется после каждого надоя и отображается в реальном времени. Весь баланс за месяц должен быть направлен на переработку — перенос на следующий месяц не предусмотрен.",
  },
  {
    q: "Можно ли отправить продукцию в подарок?",
    a: "Да, на всех платных тарифах. Каждую партию можно отправить другому человеку с именной открыткой и историей животного. На Стандартном и Профессиональном тарифах доступна подарочная подписка.",
  },
  {
    q: "Что будет через год?",
    a: "Вы можете продлить владение со скидкой 20% от первоначальной стоимости. Если не продлеваете, доля возвращается в каталог. Ваш дневник и достижения сохраняются.",
  },
  {
    q: "Можно ли увеличить долю с 50% до 100%?",
    a: "Да, при наличии свободной доли. Вы доплачиваете разницу в разовом платеже и переходите на Стандартный тариф с расширенными привилегиями.",
  },
];

/* ─── Default Steps Data ─── */
const DEFAULT_STEPS = [
  { num: "1", label: "Выберите животное", sub: "в каталоге" },
  { num: "2", label: "Выберите долю", sub: "50% или 100%" },
  { num: "3", label: "Оплатите право", sub: "Разовый платёж" },
  { num: "4", label: "Настройте план", sub: "продуктовый" },
  { num: "5", label: "Получайте продукцию", sub: "Ежемесячный взнос" },
  { num: "6", label: "Продлите", sub: "со скидкой 20%" },
];

/* ─── Default Rights Data ─── */
const DEFAULT_RIGHTS = [
  {
    title: "Выбор продуктового плана",
    text: "Молоко, творог, кефир, сыры — вы сами распределяете баланс молока между продуктами. Меняйте план от раза в квартал до раза в неделю.",
  },
  {
    title: "Управление балансом молока",
    text: "Персональный баланс обновляется после каждого надоя. Перенесите до 30% остатка или направьте молоко в созревание сыров.",
  },
  {
    title: "Себе или в подарок",
    text: "Каждую партию можно доставить себе или отправить подарком с именной открыткой и историей вашего животного. Подписка до 12 мес.",
  },
];

/* ─── Default Overview Data ─── */
const DEFAULT_OVERVIEW = [
  { label: "Доля владения", value: "50% или 100%" },
  { label: "Разовый платёж", value: "от 47 500 ₽" },
  { label: "Ежемесячный взнос", value: "от 7 500 ₽/мес" },
  { label: "Продукция", value: "Именная, от вашего животного" },
];

/* ─── Default Calculator Example ─── */
const DEFAULT_CALC_EXAMPLE = [
  { label: "Стоимость участия", value: "258 000 ₽/год" },
  { label: "Рыночная стоимость", value: "349 000 ₽" },
  { label: "Привилегии", value: "222 000 ₽" },
];

/* ─── Rights icon map ─── */
const RIGHTS_ICONS = [
  { icon: Package, iconBg: "bg-primary/10 text-primary" },
  { icon: Scale, iconBg: "bg-amber-100 text-amber-700" },
  { icon: Gift, iconBg: "bg-rose-100 text-rose-600" },
];

/* ─── Tier badge colors ─── */
const TIER_STYLES: Record<string, { badge: string; badgeText: string; border: string; cta: string; ctaText: string }> = {
  guest: {
    badge: "bg-muted",
    badgeText: "text-muted-foreground",
    border: "border-border",
    cta: "bg-muted hover:bg-muted/80",
    ctaText: "text-foreground",
  },
  basic: {
    badge: "bg-primary/10",
    badgeText: "text-primary",
    border: "border-primary/20",
    cta: "bg-primary/10 hover:bg-primary/20",
    ctaText: "text-primary",
  },
  standard: {
    badge: "bg-primary",
    badgeText: "text-primary-foreground",
    border: "border-primary",
    cta: "bg-primary hover:bg-primary/90",
    ctaText: "text-primary-foreground",
  },
  professional: {
    badge: "bg-accent",
    badgeText: "text-accent-foreground",
    border: "border-accent",
    cta: "bg-accent hover:bg-accent/90",
    ctaText: "text-accent-foreground",
  },
};

const TIER_LABELS: Record<string, string> = {
  guest: "БЕСПЛАТНО",
  basic: "СОВЛАДЕНИЕ",
  standard: "ПОПУЛЯРНЫЙ ВЫБОР",
  professional: "ФЕРМЕРСКИЙ ПАТРОНАЖ",
};

/* ─── Component ─── */
export default function Pricing() {
  const cms = useCmsContent("pricing");
  const tiersQuery = trpc.pricing.getTiers.useQuery();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Log page view
  const logView = trpc.pricing.logPageView.useMutation();
  useEffect(() => {
    logView.mutate({ pagePath: "/pricing" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiers = tiersQuery.data ?? [];

  const toggleFaq = useCallback((idx: number) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  }, []);

  // CMS-managed data
  const faqItems = cms.getJson<{ q: string; a: string }[]>("faq_items", DEFAULT_FAQ_ITEMS);
  const stepsData = cms.getJson<{ num: string; label: string; sub: string }[]>("steps", DEFAULT_STEPS);
  const rightsItems = cms.getJson<{ title: string; text: string }[]>("rights_items", DEFAULT_RIGHTS);
  const overviewItems = cms.getJson<{ label: string; value: string }[]>("hero_overview", DEFAULT_OVERVIEW);
  const calcExample = cms.getJson<{ label: string; value: string }[]>("calc_example", DEFAULT_CALC_EXAMPLE);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Breadcrumbs */}
        <div className="container pt-4 pb-2">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Цены" },
            ]}
          />
        </div>

        {/* ─── HERO ─── */}
        <section className="container pb-16 pt-4">
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-[3.25rem] leading-tight">
                {cms.getText("hero_title", "Два простых шага").split("\n").map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {i > 0 ? <span className="text-primary">{line}</span> : line}
                  </span>
                ))}
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground leading-relaxed">
                {cms.getText("hero_subtitle", "Разовый платёж за право владения + ежемесячный взнос за содержание и привилегии. Никаких скрытых комиссий.")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pricing/calculator">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-shadow hover:shadow-lg"
                  >
                    <Calculator className="h-4 w-4" />
                    {cms.getText("hero_cta_primary", "Рассчитать мою выгоду")}
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
                <Link href="/pricing/compare">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    {cms.getText("hero_cta_secondary", "Сравнить тарифы")}
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Quick overview card */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Быстрый обзор</p>
              <div className="space-y-3">
                {overviewItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── HOW PRICING WORKS ─── */}
        <section className="bg-card border-y border-border/60 py-16">
          <div className="container">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
              <h2 className="text-3xl font-bold text-foreground">{cms.getText("model_heading", "Как устроена стоимость")}</h2>
              <p className="mt-2 text-muted-foreground">{cms.getText("model_subtitle", "Двухкомпонентная модель — прозрачная и понятная")}</p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              {/* One-time payment */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
                className="rounded-2xl border border-border bg-background p-6 relative"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{cms.getText("model_onetime_title", "Разовый платёж")}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {cms.getText("model_onetime_text", "Вы выбираете животное и долю: 50% или 100%. Разовый платёж закрепляет за вами право владения, именной сертификат и доступ ко всей экосистеме.")}
                </p>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="text-muted-foreground">Коза альпийской породы:</p>
                  <p className="font-semibold text-foreground">{cms.getText("model_onetime_example", "47 500 ₽ (50%) или 95 000 ₽ (100%)")}</p>
                </div>
                <p className="mt-3 text-xs text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {cms.getText("model_onetime_bonus", "Продление через год — со скидкой 20%")}
                </p>
              </motion.div>

              {/* Monthly fee */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
                className="rounded-2xl border border-border bg-background p-6 relative"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{cms.getText("model_monthly_title", "Ежемесячный взнос")}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {cms.getText("model_monthly_text", "Покрывает корм, ветеринарию, переработку молока по вашему плану и доставку. Чем выше тариф — тем больше привилегий.")}
                </p>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-semibold text-foreground">
                    {cms.getText("model_monthly_example", "от 7 500 ₽/мес (50% доли) или от 14 900 ₽/мес (100%)")}
                  </p>
                </div>
                <p className="mt-3 text-xs text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {cms.getText("model_monthly_bonus", "Годовая подписка — скидка 15%")}
                </p>
              </motion.div>
            </div>

            {/* Plus connector */}
            <div className="hidden md:flex justify-center -mt-3 relative z-10">
              <div className="absolute -top-[4.5rem] left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-card text-lg font-bold text-primary shadow">
                +
              </div>
            </div>
          </div>
        </section>

        {/* ─── STEPS TIMELINE ─── */}
        <section className="py-16 container">
          <div className="relative max-w-5xl mx-auto">
            {/* Connecting line behind circles */}
            <div className="hidden md:block absolute top-5 left-[4%] right-[4%] h-[2px] bg-border z-0" />
            <div className="flex flex-wrap justify-center gap-y-8 gap-x-4 md:flex-nowrap md:justify-between">
              {stepsData.map((step, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                  className="flex flex-col items-center text-center w-[calc(33%-1rem)] md:w-[140px] shrink-0 relative z-10"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold bg-background ${
                    i === 2 ? "bg-primary text-primary-foreground" : "border-2 border-border text-foreground"
                  }`}>
                    {step.num}
                  </div>
                  <p className="mt-2 text-[13px] font-semibold text-foreground leading-snug">{step.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{step.sub}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── THREE RIGHTS ─── */}
        <section className="bg-card border-y border-border/60 py-16">
          <div className="container">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
              <h2 className="text-3xl font-bold text-foreground">{cms.getText("rights_heading", "Три права владельца")}</h2>
              <p className="mt-2 text-muted-foreground">{cms.getText("rights_subtitle", "Вы не просто покупаете продукты — вы управляете своим фермерским хозяйством")}</p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              {rightsItems.map((item, i) => {
                const iconInfo = RIGHTS_ICONS[i] || RIGHTS_ICONS[0];
                const IconComp = iconInfo.icon;
                return (
                  <motion.div
                    key={i}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i}
                    className="rounded-2xl border border-border bg-background p-6 group hover:shadow-md transition-shadow"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconInfo.iconBg} mb-4`}>
                      <IconComp className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                    <Link href="/pricing/compare" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Подробнее <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── TIER OVERVIEW ─── */}
        <section className="py-16 container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground">{cms.getText("tiers_heading", "Обзор тарифов")}</h2>
            <p className="mt-2 text-muted-foreground">{cms.getText("tiers_subtitle", "Выберите уровень участия, который подходит именно вам")}</p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {tiers.map((tier: any, i: number) => {
              const style = TIER_STYLES[tier.slug] || TIER_STYLES.basic;
              const isPopular = tier.slug === "standard";
              return (
                <motion.div
                  key={tier.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                  className={`relative rounded-2xl border-2 ${style.border} bg-card p-5 flex flex-col ${
                    isPopular ? "shadow-lg ring-1 ring-primary/20" : "shadow-sm"
                  }`}
                >
                  {/* Badge */}
                  <span className={`inline-block self-start rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge} ${style.badgeText} mb-3`}>
                    {TIER_LABELS[tier.slug] || tier.slug}
                  </span>

                  <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{tier.subtitle}</p>

                  {/* Pricing */}
                  <div className="mt-4 space-y-1.5">
                    {tier.slug === "guest" ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Разовый</span>
                          <span className="font-semibold">—</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Ежемесячно</span>
                          <span className="font-bold text-primary">Бесплатно</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Разовый</span>
                          <span className="font-semibold">
                            {tier.slug === "professional" ? "от 270 000 ₽" :
                             tier.slug === "standard" ? "от 95 000 ₽" : "от 47 500 ₽"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Ежемесячно</span>
                          <span className="font-semibold">
                            от {tier.monthlyFee.toLocaleString("ru-RU")} ₽
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mt-4 flex-1 space-y-2">
                    {(tier.featureHighlights as string[]).slice(0, 5).map((feat: string, fi: number) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={tier.slug === "guest" ? "/register" : `/pricing/${tier.slug}`}
                    className={`mt-5 block rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${style.cta} ${style.ctaText}`}
                  >
                    {tier.slug === "guest" ? "Зарегистрироваться" : "Подробнее →"}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ─── CALCULATOR CTA ─── */}
        <section className="py-16">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="rounded-3xl bg-[oklch(0.22_0.04_60)] p-8 md:p-12 grid gap-8 md:grid-cols-2 items-center"
            >
              <div>
                <h2 className="text-3xl font-bold text-white">{cms.getText("calc_heading", "Рассчитайте свою выгоду")}</h2>
                <p className="mt-3 text-white/70 leading-relaxed">
                  {cms.getText("calc_subtitle", "Наш калькулятор покажет реальную стоимость продукции от вашего животного и сравнит её с ценами на премиальных московских рынках.")}
                </p>
                <Link href="/pricing/calculator">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
                  >
                    <Calculator className="h-4 w-4" />
                    {cms.getText("calc_cta", "Открыть калькулятор")}
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
              </div>

              {/* Sample calculation */}
              <div className="rounded-2xl bg-white/10 backdrop-blur p-5 space-y-3">
                {calcExample.map((row, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white/60">{row.label}</span>
                    <span className="font-semibold text-white">{row.value}</span>
                  </div>
                ))}
                <div className="rounded-xl bg-primary/80 px-4 py-2.5 text-center">
                  <span className="text-sm font-bold text-white flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    {cms.getText("calc_result", "Выгода: 313 000 ₽ (55%)")}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-16 container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground">{cms.getText("faq_heading", "Частые вопросы о ценах")}</h2>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqItems.map((item, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i * 0.5}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                >
                  {item.q}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed"
                  >
                    {item.a}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
