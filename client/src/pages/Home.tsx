/*
  Home.tsx — Redesigned Landing Page
  
  Marketing-first structure:
  1. Hero: Explain the concept of personal farming
  2. How it works: 3 clear steps
  3. For whom: Target audience segments
  4. Animal gallery preview: First product contact
  5. Why us: Trust & values with social proof
  6. Final CTA: One clear action
  
  Partner form moved to /partners page.
  "Animal of the week" moved to /animals page.
  Internal language (ecosystem routes, AI curator) removed.
*/

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import AuthModal from "@/components/AuthModal";
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Milk,
  ShieldCheck,
  Sparkles,
  Users,
  Package,
  MapPin,
  Leaf,
  Baby,
  Gift,
  Salad,
  Quote,
  Eye,
  Truck,
} from "lucide-react";

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
};

/* ─── Data ─── */

const steps = [
  {
    index: "01",
    title: "Выберите животное",
    text: "Не обезличенную корзину продуктов, а конкретную козу или овцу с именем, характером и прозрачной историей.",
    icon: Heart,
  },
  {
    index: "02",
    title: "Следите за жизнью на ферме",
    text: "Личный кабинет, дневник животного, фото и события клуба — фермерство становится частью вашего ритма.",
    icon: Eye,
  },
  {
    index: "03",
    title: "Получайте именные продукты",
    text: "Молоко, сыры и сезонные наборы от вашего животного — с трекером происхождения от надоя до доставки.",
    icon: Package,
  },
];

const audiences = [
  {
    icon: Baby,
    title: "Семьи с детьми",
    text: "Натуральное молоко и сыры от конкретного животного, которое ребёнок знает по имени. Визиты на ферму как семейный ритуал.",
  },
  {
    icon: Salad,
    title: "Ценители натуральных продуктов",
    text: "Полная прозрачность: состав молока, условия содержания, маршрут доставки. Никаких чёрных ящиков.",
  },
  {
    icon: Gift,
    title: "Дарители уникальных подарков",
    text: "Подарочная доля в животном — это не вещь, а живая история. Именной сертификат, доступ к профилю и продуктам.",
  },
  {
    icon: Users,
    title: "Участники закрытого клуба",
    text: "Ужины на ферме, мастер-классы по сыроварению, сезонные визиты. Сообщество людей, которые ценят настоящее.",
  },
];

const values = [
  {
    title: "Эмоциональная связь",
    text: "Профиль животного с характером, фото и дневником. Это не покупка — это участие.",
    icon: Heart,
    stat: "100%",
    statLabel: "прозрачность",
  },
  {
    title: "Радикальная прозрачность",
    text: "Происхождение продукта, состав молока, статус ухода и маршрут доставки — всё на виду.",
    icon: ShieldCheck,
    stat: "A2",
    statLabel: "тип молока",
  },
  {
    title: "Премиальная продукция",
    text: "Молоко, сыры и сезонные наборы идут не от абстрактной фермы, а от вашего животного.",
    icon: Milk,
    stat: "48ч",
    statLabel: "до доставки",
  },
  {
    title: "Доставка до двери",
    text: "Именная коробка с продуктами от вашего животного — регулярно и с заботой о каждой детали.",
    icon: Truck,
    stat: "2×",
    statLabel: "в месяц",
  },
];

const testimonials = [
  {
    text: "Дочка каждое утро спрашивает, как дела у Марты. Молоко пьёт только «от нашей козы». Это больше, чем продукт — это ритуал.",
    author: "Анна К.",
    role: "мама двоих детей",
  },
  {
    text: "Подарил жене долю в козе на годовщину. Теперь у нас семейная традиция — ездить на ферму каждый сезон.",
    author: "Дмитрий Р.",
    role: "участник клуба",
  },
  {
    text: "Впервые вижу такую прозрачность: знаю, от какого животного молоко, когда надоено и когда доставят. Это другой уровень.",
    author: "Елена М.",
    role: "ценитель натуральных продуктов",
  },
];

/* ─── Component ─── */

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">("register");

  const openAuthRegister = () => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO: What is personal farming?
          ═══════════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),rgba(244,240,232,0.48)_35%,rgba(235,230,220,0)_70%)] pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden>
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="container relative">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Left: Message */}
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-sm text-primary shadow-sm backdrop-blur"
              >
                <Leaf className="h-4 w-4" />
                Первый в России клуб персонального фермерства
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-7 font-display text-5xl leading-[0.95] text-foreground md:text-7xl"
              >
                Ваша коза.{" "}
                <span className="text-primary">Ваше молоко.</span>{" "}
                <span className="block mt-1">Ваша история.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground"
              >
                <strong className="text-foreground">Персональное фермерство</strong> — это когда вы выбираете
                конкретное животное на семейной ферме, следите за его жизнью и получаете именные молочные
                продукты именно от него. Не абстрактная «фермерская продукция», а ваша личная связь с источником.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
              >
                <Link
                  href="/animals"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95"
                >
                  Выбрать животное
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-8 py-4 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white"
                >
                  Как это устроено
                  <ChevronRight className="h-4 w-4" />
                </a>
              </motion.div>

              {/* Trust signals */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-10 flex flex-wrap gap-4"
              >
                {[
                  { value: "A2", label: "молоко" },
                  { value: "48ч", label: "доставка" },
                  { value: "100%", label: "прозрачность" },
                  { value: "24/7", label: "доступ к профилю" },
                ].map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-border/60 bg-card/70 px-5 py-3 shadow-sm backdrop-blur"
                  >
                    <div className="text-xl font-semibold tracking-tight text-foreground">{signal.value}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{signal.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Visual */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="relative"
            >
              <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-card shadow-[0_30px_70px_-35px_rgba(33,30,24,0.35)]">
                <img
                  src={CDN.hero}
                  alt="Семейная ферма Шерь Козу"
                  className="h-[540px] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/80 via-dark-oak/15 to-transparent rounded-[2rem]" />
                <div className="absolute bottom-0 left-0 right-0 p-7 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs backdrop-blur">
                    <MapPin className="h-3.5 w-3.5" />
                    Семейная ферма Шерь Козу
                  </div>
                  <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl">
                    Не абстрактная ферма, а конкретное животное с именем и историей.
                  </h2>
                </div>
              </div>

              {/* Floating card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="absolute -bottom-6 -left-6 z-10 rounded-2xl border border-border/70 bg-white p-4 shadow-lg md:-left-10"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={CDN.goat}
                    alt="Коза Марта"
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Коза Марта</p>
                    <p className="text-xs text-muted-foreground">Зааненская, 2 года</p>
                    <p className="mt-1 text-xs text-primary font-medium">Доступна для выбора</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — HOW IT WORKS: 3 clear steps
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Как это работает</p>
            <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
              Три шага к вашему персональному фермерству
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Всё начинается с выбора животного. Дальше — наблюдение, продукты и живой опыт фермы.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative rounded-[2rem] border border-border/70 bg-card p-7 shadow-sm"
                >
                  <div className="absolute top-6 right-6 font-display text-5xl leading-none text-primary/10">
                    {step.index}
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.text}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/animals"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-[0_16px_32px_-20px_rgba(26,58,42,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95"
            >
              Начать с выбора животного
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — FOR WHOM: Target audience segments
          ═══════════════════════════════════════════════════════ */}
      <section className="border-y border-border/60 bg-secondary/30 py-20 md:py-28">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Для кого это</p>
              <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
                Персональное фермерство подходит тем, кто ценит настоящее
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Это не массовый продукт. Это осознанный выбор для людей, которым важно знать,
                откуда приходит еда на их стол.
              </p>
              <div className="mt-8">
                <Link
                  href="/animals"
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white"
                >
                  Посмотреть животных
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {audiences.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — GALLERY PREVIEW: First product contact
          ═══════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Галерея животных</p>
            <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
              Познакомьтесь с нашими животными
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              У каждого животного — своё имя, характер и история. Выберите то, которое вам ближе.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {/* Goats card */}
            <Link href="/animals#goats" className="group block">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="overflow-hidden rounded-[2rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-[#fff5dd] shadow-sm transition-transform duration-300 group-hover:-translate-y-1"
              >
                <div className="grid md:grid-cols-[200px_1fr]">
                  <img src={CDN.goat} alt="Козы Шерь Козу" className="h-48 w-full object-cover md:h-full" />
                  <div className="p-6">
                    <div className="inline-flex items-center rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-medium text-amber-900">
                      Козы
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">
                      Энергичные, контактные, с ярким характером
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Зааненские и альпийские козы с высоким молочным потенциалом. Каждая — с подробным профилем, историей и доступными долями.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-900 transition-colors group-hover:text-amber-700">
                      Перейти к козам
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>

            {/* Sheep card */}
            <Link href="/animals#sheep" className="group block">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                className="overflow-hidden rounded-[2rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-[#eefbf4] shadow-sm transition-transform duration-300 group-hover:-translate-y-1"
              >
                <div className="grid md:grid-cols-[200px_1fr]">
                  <img src={CDN.family} alt="Овцы Шерь Козу" className="h-48 w-full object-cover md:h-full" />
                  <div className="p-6">
                    <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-900">
                      Овцы
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">
                      Спокойные, рациональные, с мягким темпераментом
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Для тех, кто ценит спокойствие и стабильность. Подробный профиль, статус и маршрут владения — всё прозрачно.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 transition-colors group-hover:text-emerald-700">
                      Перейти к овцам
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — WHY US: Trust, values & social proof
          ═══════════════════════════════════════════════════════ */}
      <section className="border-y border-border/60 bg-secondary/45 py-20 md:py-28">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-card shadow-sm">
              <img src={CDN.club} alt="Семья на клубном визите" className="h-full min-h-[380px] w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Почему Шерь Козу</p>
              <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
                Не просто продукты, а личная история с фермой
              </h2>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {values.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.06 }}
                      className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-primary">{item.stat}</div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{item.statLabel}</div>
                        </div>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.text}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="mt-16">
            <h3 className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-primary">Отзывы участников</h3>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {testimonials.map((item, index) => (
                <motion.div
                  key={item.author}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm"
                >
                  <Quote className="h-8 w-8 text-primary/20" />
                  <p className="mt-4 text-sm leading-7 text-foreground italic">
                    &laquo;{item.text}&raquo;
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {item.author.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.author}</p>
                      <p className="text-xs text-muted-foreground">{item.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 6 — PRODUCT PREVIEW: What you get
          ═══════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Что вы получаете</p>
              <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
                Именная коробка делает происхождение зримым
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Вы получаете не просто молочную продукцию, а красиво упакованный результат вашей связи
                с конкретным животным. Молоко, сыры, йогурты — всё с трекером от надоя до вашей двери.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { label: "Молоко A2", desc: "Свежее козье молоко от вашего животного, доставка в течение 48 часов" },
                  { label: "Крафтовые сыры", desc: "Мягкие и выдержанные сыры ручной работы из именного молока" },
                  { label: "Сезонные наборы", desc: "Подарочные боксы с продуктами фермы — для себя или в подарок" },
                ].map((product) => (
                  <div key={product.label} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Milk className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">{product.label}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{product.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
            >
              <img src={CDN.milk} alt="Именные молочные продукты Шерь Козу" className="h-80 w-full object-cover" />
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-primary">Продуктовая линия</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  Каждый продукт — с историей происхождения и именем животного на упаковке.
                </p>
                <Link
                  href="/tracker"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Открыть трекер продуктов
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="pb-20 md:pb-28">
        <div className="container">
          <div className="overflow-hidden rounded-[2.25rem] border border-border/70 bg-[linear-gradient(135deg,rgba(26,58,42,0.96),rgba(45,70,54,0.92))] px-7 py-10 text-white shadow-[0_34px_80px_-45px_rgba(26,58,42,0.8)] md:px-12 md:py-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Начните сейчас</p>
                <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">
                  Выберите животное и станьте частью истории семейной фермы
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
                  Откройте галерею, познакомьтесь с животными и выберите то, которое станет вашим.
                  Первый шаг — это всего лишь выбор. Всё остальное мы берём на себя.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/animals"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-8 py-4 text-sm font-semibold text-stone-950 transition-colors hover:bg-amber-200"
                >
                  Выбрать животное
                  <Heart className="h-4 w-4" />
                </Link>
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-primary transition-colors hover:bg-white/95"
                  >
                    Мой кабинет
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={openAuthRegister}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-primary transition-colors hover:bg-white/95"
                  >
                    Стать участником
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
                <Link
                  href="/club"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Клубная жизнь
                  <Users className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER LINKS: Partners & info
          ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border/60 bg-card py-10">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-display text-lg text-foreground">Шерь Козу</span>
              <span className="text-sm text-muted-foreground">Персональное фермерство</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <Link href="/animals" className="transition-colors hover:text-foreground">Животные</Link>
              <Link href="/club" className="transition-colors hover:text-foreground">Клуб</Link>
              <Link href="/tracker" className="transition-colors hover:text-foreground">Трекер</Link>
              <Link href="/partners" className="transition-colors hover:text-foreground">Для партнёров</Link>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Шерь Козу. Семейная ферма персонального фермерства.
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultView={authModalView}
      />
    </div>
  );
}
