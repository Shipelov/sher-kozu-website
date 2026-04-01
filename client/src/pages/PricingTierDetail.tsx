/*
  PricingTierDetail.tsx — Детальная страница тарифа
  Shows full details for a single tier: description, features, limitations, pricing.
*/

import { motion } from "framer-motion";
import { Link, useParams } from "wouter";
import Navbar from "@/components/Navbar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Leaf,
  Loader2,
  Crown,
  Star,
  Users,
  ShieldCheck,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

const TIER_ICONS: Record<string, typeof Star> = {
  guest: Users,
  basic: Star,
  standard: ShieldCheck,
  professional: Crown,
};

const TIER_COLORS: Record<string, string> = {
  guest: "bg-muted text-muted-foreground",
  basic: "bg-primary/10 text-primary",
  standard: "bg-primary text-primary-foreground",
  professional: "bg-accent text-accent-foreground",
};

const TIER_NAMES: Record<string, string> = {
  guest: "Гость",
  basic: "Базовый",
  standard: "Стандартный",
  professional: "Профессиональный",
};

/* Detailed descriptions per tier */
const TIER_DESCRIPTIONS: Record<string, string> = {
  guest: "Тариф «Гость» — это точка входа в экосистему Шерь Козу. Он предназначен для людей, которые интересуются фермерской жизнью, натуральными продуктами и осознанным потреблением, но ещё не готовы к финансовым обязательствам. Задача тарифа — познакомить с философией проекта, дать попробовать атмосферу и создать мотивацию для перехода на платный уровень.",
  basic: "Тариф «Базовый» — это первый уровень реального участия в экосистеме. Участник приобретает 50% доли в одном из доступных животных и начинает получать именные молочные продукты в объёме половины надоя. У одного животного может быть максимум два совладельца. Это полноценное персональное фермерство — с именным животным, продуктовым планом, балансом молока и правом отправить продукцию подарком.",
  standard: "Тариф «Стандартный» предназначен для участников, которые владеют 100% одного животного. Это полноценное персональное фермерство: всё молоко от вашего животного — ваше, весь баланс молока — под вашим управлением, а продуктовый план включает расширенный ассортимент переработки. Вы становитесь полноправным членом закрытого клуба Шерь Козу с расширенными привилегиями.",
  professional: "Тариф «Профессиональный» — это высший уровень участия в экосистеме Шерь Козу, предназначенный для энтузиастов, которые владеют тремя и более животными (100% каждого). Это не просто потребление продукции — это соучастие в развитии фермы, влияние на технологические решения и формирование клубной культуры. Профессиональный участник — это патрон фермы.",
};

const TIER_PRICING_DETAILS: Record<string, { oneTime: string; monthly: string; extras: string[] }> = {
  guest: {
    oneTime: "Бесплатно",
    monthly: "Бесплатно",
    extras: ["Посещение фермы: 2 500 ₽ (взрослый), 500 ₽ (ребёнок)", "Мероприятия: от 1 500 до 5 000 ₽", "Скидка 5% при бронировании через платформу"],
  },
  basic: {
    oneTime: "50% стоимости животного (от 47 500 ₽)",
    monthly: "от 7 500 ₽/мес",
    extras: ["Продление через год: скидка 20%", "Годовая подписка: скидка 15%", "Скидка в магазине: 5%", "Подарочные наборы: от 3 000 ₽ (скидка 5%)"],
  },
  standard: {
    oneTime: "100% стоимости животного (от 95 000 ₽)",
    monthly: "от 14 900 ₽/мес",
    extras: ["Продление через год: скидка 20%", "Годовая подписка: скидка 15%", "Скидка в магазине: 10%", "Бесплатная доставка в пределах 50 км"],
  },
  professional: {
    oneTime: "Сумма стоимостей 3+ животных (скидка 10%)",
    monthly: "от 39 900 ₽/мес (3 животных)",
    extras: ["Скидка 10% на пакетное оформление", "Каждое доп. животное: от 12 500 ₽/мес", "Продление через год: скидка 20%", "Годовая подписка: скидка 15%", "Скидка в магазине: 20%"],
  },
};

export default function PricingTierDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "basic";

  const tierQuery = trpc.pricing.getTierBySlug.useQuery({ slug });
  const tier = tierQuery.data;

  const Icon = TIER_ICONS[slug] || Star;
  const colorClass = TIER_COLORS[slug] || TIER_COLORS.basic;
  const description = TIER_DESCRIPTIONS[slug] || "";
  const pricingDetails = TIER_PRICING_DETAILS[slug];

  if (tierQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!tier) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-32 text-center">
          <h1 className="text-2xl font-bold text-foreground">Тариф не найден</h1>
          <Link href="/pricing" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Вернуться к ценам
          </Link>
        </div>
      </div>
    );
  }

  const features = tier.featureHighlights as string[];
  const limitations = tier.limitations as string[];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="container pt-4 pb-2">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Цены", href: "/pricing" },
              { label: TIER_NAMES[slug] || tier.name },
            ]}
          />
        </div>

        {/* Hero */}
        <section className="container pb-12 pt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground md:text-4xl">{tier.name}</h1>
                <p className="text-muted-foreground">{tier.subtitle}</p>
              </div>
            </div>
            <p className="max-w-3xl text-muted-foreground leading-relaxed mt-4">{description}</p>
          </motion.div>
        </section>

        {/* Pricing details */}
        {pricingDetails && (
          <section className="bg-card border-y border-border/60 py-12">
            <div className="container">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
                <h2 className="text-2xl font-bold text-foreground mb-6">Стоимость</h2>
                <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
                  <div className="rounded-xl border border-border bg-background p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Разовый платёж</p>
                    <p className="text-lg font-bold text-foreground">{pricingDetails.oneTime}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Ежемесячный взнос</p>
                    <p className="text-lg font-bold text-foreground">{pricingDetails.monthly}</p>
                  </div>
                </div>
                {pricingDetails.extras.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {pricingDetails.extras.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {e}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </section>
        )}

        {/* Features */}
        <section className="py-12 container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-2xl font-bold text-foreground mb-6">Что входит</h2>
            <div className="grid gap-3 sm:grid-cols-2 max-w-4xl">
              {features.map((feat, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i * 0.3}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{feat}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Limitations */}
        {limitations.length > 0 && (
          <section className="bg-card border-y border-border/60 py-12">
            <div className="container">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
                <h2 className="text-2xl font-bold text-foreground mb-6">Ограничения</h2>
                <div className="space-y-3 max-w-3xl">
                  {limitations.map((lim, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      {lim}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* CTAs */}
        <section className="py-12 container">
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing/calculator">
              <button className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-colors">
                Рассчитать выгоду <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/pricing/compare">
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                Сравнить все тарифы
              </button>
            </Link>
            <Link href="/animals">
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                Выбрать животное
              </button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-card py-10">
          <div className="container">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-3">
                <Leaf className="h-5 w-5 text-primary" />
                <span className="font-display text-lg text-foreground">Шерь Козу</span>
                <span className="text-sm text-muted-foreground">Персональное фермерство</span>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <Link href="/pricing" className="transition-colors hover:text-foreground">Цены</Link>
                <Link href="/animals" className="transition-colors hover:text-foreground">Животные</Link>
                <Link href="/faq" className="transition-colors hover:text-foreground">FAQ</Link>
              </div>
            </div>
            <div className="mt-6 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Шерь Козу. Семейная ферма персонального фермерства.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
