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

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
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
    title: "Выберите своё животное",
    text: "В каталоге — козы и овцы элитных пород: англо-нубийские, альпийские, остфризские. У каждого — имя, характер, элитная родословная и прозрачная история.",
    icon: Heart,
  },
  {
    index: "02",
    title: "Наблюдайте за жизнью на ферме",
    text: "Личный кабинет с профилем животного, дневником, фотоотчётами и событиями клуба. Фермерство становится частью вашего ритма, а не разовой покупкой.",
    icon: Eye,
  },
  {
    index: "03",
    title: "Получайте именные продукты",
    text: "Молоко, сыры и сезонные наборы именно от вашего животного — в именной коробке с трекером от надоя до двери. Наслаждайтесь сами и радуйте своих близких.",
    icon: Package,
  },
];

const audiences = [
  {
    icon: Baby,
    title: "Семьи с детьми",
    text: "Ребёнок знает свою козу по имени, пьёт её молоко и приезжает на ферму как к другу. Детская академия, мастер-классы по сыроварению и семейные визиты — это не покупка, а воспитание.",
  },
  {
    icon: Salad,
    title: "Ценители качества",
    text: "Полная прозрачность: порода, состав молока, условия содержания, маршрут доставки. Элитная генетика европейского уровня — Остфриз, Лакон, Англо-нубийская.",
  },
  {
    icon: Gift,
    title: "Дарители уникальных подарков",
    text: "Именной сыр с вашим именем на этикетке, подарочный абонемент на продукцию «от моей козы» — подарок, который живёт и рассказывает историю.",
  },
  {
    icon: Users,
    title: "Участники закрытого клуба",
    text: "Ужины на ферме, сезонные визиты, дни рождения животных, мастер-классы. Сообщество людей, объединённых общими ценностями.",
  },
];

const values = [
  {
    title: "Эмоциональная связь",
    text: "Профиль животного с именем, характером, дневником и фотоотчётами. Это не покупка — это причастность к живой истории.",
    icon: Heart,
    stat: "100%",
    statLabel: "прозрачность",
  },
  {
    title: "Радикальная прозрачность",
    text: "Вы видите всё: породу, родословную, состав молока, условия ухода и маршрут доставки. Никаких чёрных ящиков.",
    icon: ShieldCheck,
    stat: "→",
    statLabel: "от надоя до двери",
  },
  {
    title: "Элитные породы",
    text: "Англо-нубийские козы, альпийские козы, овцы Остфриз и Лакон — генетика европейского уровня, обосновывающая премиальное качество.",
    icon: Milk,
    stat: "4",
    statLabel: "породы",
  },
  {
    title: "Доставка до двери",
    text: "Именная коробка с продуктами от вашего животного — регулярно, бережно, с трекером каждого этапа.",
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
  const [mashaVideoOpen, setMashaVideoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const openAuthRegister = () => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  };

  const closeMashaVideo = useCallback(() => {
    setMashaVideoOpen(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  // Close video on Escape key
  useEffect(() => {
    if (!mashaVideoOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMashaVideo();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mashaVideoOpen, closeMashaVideo]);

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
                Ваша ферма.{" "}
                <span className="text-primary">Ваше молоко.</span>{" "}
                <span className="block mt-1">Ваша история.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground"
              >
                Выберите конкретную козу или овцу элитной породы, наблюдайте за её жизнью,
                воспитывайте её на ферме и получайте именные молочные продукты — с прозрачным процессом создания.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
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

                {/* Masha AI Manager — inline with CTA buttons */}
                <button
                  type="button"
                  onClick={() => setMashaVideoOpen(true)}
                  className="group inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-white/90 py-2 pl-2 pr-5 shadow-md backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer"
                >
                  <div className="relative">
                    <img
                      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/manager-v1_e0256177.jpg"
                      alt="Маша — AI Управляющая"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-sm">
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground leading-tight">Маша — AI Управляющая</p>
                    <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">Познакомиться ▶</p>
                  </div>
                </button>
              </motion.div>

              {/* Trust signals */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-10 flex flex-wrap gap-4"
              >
                {[
                  { value: "\u2764\uFE0F", label: "здоровое питание" },
                  { value: "\uD83C\uDF3E", label: "основатель фермы" },
                  { value: "100%", label: "прозрачность" },
                  { value: "24/7", label: "сервис" },
                  { value: "50", label: "семей" },
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
                    Конкретная ферма — конкретное животное с именем, породой и историей.
                  </h2>
                </div>
              </div>


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
              Три шага — от выбора животного до именной коробки с продуктами
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Персональное фермерство — это просто. Выберите животное, наблюдайте за его жизнью и получайте продукты с прозрачной историей.
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
                Для тех, кому важна не только еда, но и история за ней
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Персональное фермерство — это осознанный выбор. Не массовый продукт,
                а личная связь с источником для тех, кто ценит прозрачность и качество.
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
              Познакомьтесь с животными фермы
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Элитные породы с европейской генетикой. У каждого — имя, характер, родословная и доступные доли.
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
                      Англо-нубийские и альпийские козы
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Молоко жирностью до 5% с исключительным сливочным вкусом. «Королевские» породы французского сыроделия — основа для артизанальных сыров.
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
                      Овцы Остфриз и Лакон
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Самые высокоудойные породы в мире. Молоко с высоким содержанием жира и белка — идеально для сыроварения. Генетика уровня Рокфора.
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
                Не просто продукты — личная история с фермой
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
                Что внутри именной коробки
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Каждый продукт — результат вашей связи с конкретным животным.
                С трекером происхождения от надоя до двери.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { label: "Свежее молоко", desc: "Козье или овечье молоко от вашего животного. Доставка в течение 24 часов после надоя." },
                  { label: "Именные сыры", desc: "Мягкие и выдержанные сыры ручной работы — с именем владельца на этикетке. Статусный подарок и семейная традиция." },
                  { label: "Сезонные наборы", desc: "Подарочные боксы с лучшими продуктами фермы — для себя, семьи или в подарок близким." },
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
                  Станьте частью первого в России клуба персонального фермерства
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
                  Выберите животное, познакомьтесь с его историей и начните получать именные продукты.
                  Количество мест в клубе ограничено — мы работаем с каждым владельцем лично.
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

      {/* Masha Video Modal */}
      <AnimatePresence>
        {mashaVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={closeMashaVideo}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={closeMashaVideo}
                className="absolute -top-12 right-0 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
                Закрыть
              </button>

              {/* Video container */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 bg-gradient-to-r from-primary/90 to-primary/70 px-5 py-3">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/manager-v1_e0256177.jpg"
                    alt="Маша"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-white/30"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Маша — AI Управляющая фермой</p>
                    <p className="text-xs text-white/70">Добро пожаловать на ферму Шерь Козу!</p>
                  </div>
                </div>

                {/* Video */}
                <video
                  ref={videoRef}
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/masha-intro-video-compressed_ee7518ad.mp4"
                  controls
                  autoPlay
                  className="w-full aspect-video bg-black"
                  playsInline
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
