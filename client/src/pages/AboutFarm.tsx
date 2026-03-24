/*
  AboutFarm.tsx — О ферме

  Структура:
  1. Hero: Семейная ферма — заголовок и атмосферное фото
  2. Наша история: Как всё начиналось
  3. Философия: Три принципа
  4. Наши породы: Элитная генетика
  5. Фотогалерея: Жизнь на ферме
  6. Ценности: Не масштаб, а глубина
  7. CTA: Присоединяйтесь

  Все тексты, изображения и JSON-данные подключены к CMS через useCmsContent("about").
*/

import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { useCmsContent } from "@/hooks/useCmsContent";
import {
  ArrowRight,
  Heart,
  Eye,
  Leaf,
  ShieldCheck,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Baby,
  Milk,
} from "lucide-react";

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_family_story-YMV9ujT7krNrfNEGsYidAo.webp",
  philosophy: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_philosophy-UsPE82Ym7NqaHcQhCHFj4f.webp",
  breeds: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_breeds-CDKnxN8KzLjmZdjyKV8vE4.webp",
  visit: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/about_farm_visit-VXmkrXCZVHGawgNavuytqu.webp",
};

/* ─── Fallback Data ─── */

const defaultPrinciples = [
  {
    icon: "Eye",
    title: "Радикальная прозрачность",
    text: "Вы знаете всё: имя животного, породу, родословную, состав молока, условия содержания и маршрут доставки. Никаких чёрных ящиков — только открытость на каждом этапе.",
  },
  {
    icon: "Heart",
    title: "Эмоциональная связь",
    text: "Это не просто покупка продуктов. Вы выбираете конкретное животное, следите за его жизнью, приезжаете в гости. Каждая коробка — продолжение вашей личной истории с фермой.",
  },
  {
    icon: "ShieldCheck",
    title: "Элитная генетика",
    text: "Мы работаем только с лучшими породами: англо-нубийские и альпийские козы, остфризские овцы и овцы породы Лакон. Европейская генетика — основа премиального качества молока и продуктов.",
  },
];

const defaultBreeds = [
  {
    name: "Англо-нубийская коза",
    origin: "Великобритания",
    trait: "Молоко с высоким содержанием жира (5–8%) и сливочным вкусом. Идеально для сыров и йогуртов.",
    character: "Общительные, ласковые, с выразительными длинными ушами и римским профилем.",
  },
  {
    name: "Альпийская коза",
    origin: "Французские Альпы",
    trait: "Высокая молочная продуктивность, молоко с мягким, чистым вкусом. Отлично подходит для свежего молока и мягких сыров.",
    character: "Выносливые, любопытные, с яркой контрастной окраской.",
  },
  {
    name: "Остфризская овца",
    origin: "Восточная Фризия, Германия",
    trait: "Самая молочная порода овец в мире. Молоко с 6–7% жирности — основа для элитных овечьих сыров.",
    character: "Спокойные, дружелюбные, легко привыкают к людям.",
  },
  {
    name: "Овца породы Лакон",
    origin: "Греция",
    trait: "Молоко с богатым вкусом и высоким содержанием белка. Традиционная основа для фета и других средиземноморских сыров.",
    character: "Грациозные, неприхотливые, хорошо адаптируются к разным условиям.",
  },
];

const defaultTimeline = [
  { year: "2019", title: "Идея", text: "Мечта о собственной ферме, где каждое животное — член семьи, а каждый продукт — результат заботы и любви." },
  { year: "2020", title: "Первые животные", text: "Появились первые англо-нубийские козы. Начали изучать генетику, уход и традиции европейского фермерства." },
  { year: "2022", title: "Расширение стада", text: "Добавили альпийских коз и остфризских овец. Запустили собственное сыроделие и начали работать с первыми семьями." },
  { year: "2024", title: "Клуб «Шерь Козу»", text: "Создали закрытый клуб персонального фермерства — первый в России. Семьи выбирают своё животное и получают именные продукты." },
  { year: "2025", title: "Цифровая ферма", text: "Запустили платформу с личными кабинетами, трекером продуктов и дневниками животных. Прозрачность стала полной." },
];

const defaultStats = [
  { value: "50", label: "семей в клубе" },
  { value: "4", label: "элитные породы" },
  { value: "100%", label: "прозрачность" },
];

const galleryImages = [
  { src: CDN.hero, alt: "Семья на ферме с козами", caption: "Утро на ферме — каждый день начинается с заботы" },
  { src: CDN.philosophy, alt: "Именные сыры от козы Марта", caption: "Именные продукты — от конкретного животного к вашему столу" },
  { src: CDN.breeds, alt: "Элитные породы коз и овец", caption: "Англо-нубийские козы, альпийские козы и остфризские овцы" },
  { src: CDN.visit, alt: "Дети на ферме", caption: "Визиты на ферму — дети знают своих животных по имени" },
];

/* ─── Icon map for JSON-driven principles ─── */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  Heart,
  ShieldCheck,
  Sparkles,
  Leaf,
  MapPin,
  Calendar,
  Users,
  Baby,
  Milk,
};

/* ─── Animations ─── */

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.55, ease: [0, 0, 0.2, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ─── Component ─── */

export default function AboutFarm() {
  const cms = useCmsContent("about");

  // CMS-driven data with fallbacks
  const principles = cms.getJson("philosophy_principles", defaultPrinciples);
  const breeds = cms.getJson("breeds_list", defaultBreeds);
  const timeline = cms.getJson("history_timeline", defaultTimeline);
  const stats = cms.getJson("values_stats", defaultStats);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),rgba(244,240,232,0.48)_35%,rgba(235,230,220,0)_70%)] pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden>
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="container relative">
          <PageBreadcrumbs
            className="mb-6"
            items={[
              { label: "Главная", href: "/" },
              { label: "О ферме" },
            ]}
          />
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Text */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="max-w-xl"
            >
              <motion.div variants={fadeUp} custom={0} className="mb-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Leaf className="h-3.5 w-3.5" />
                  {cms.getText("hero_badge", "О ферме")}
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
              >
                {cms.getText("hero_heading", "Семейная ферма, где каждое животное — член семьи")}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                {cms.getText("hero_subtitle", "Мы — семья, которая превратила любовь к животным и натуральным продуктам в дело жизни. Наша ферма — это не производство. Это место, где козы и овцы элитных пород живут в заботе, а каждый продукт несёт имя конкретного животного.")}
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-4">
                <Link href="/animals">
                  <motion.span
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
                  >
                    Познакомиться с животными
                    <ArrowRight className="h-4 w-4" />
                  </motion.span>
                </Link>
                <Link href="/club">
                  <motion.span
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    Вступить в клуб
                  </motion.span>
                </Link>
              </motion.div>
            </motion.div>

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="overflow-hidden rounded-3xl border border-border/60 shadow-xl">
                <img
                  src={cms.getImage("hero_image", CDN.hero)}
                  alt="Семья на ферме Шерь Козу с козами элитных пород"
                  className="w-full h-auto object-cover aspect-[16/10]"
                  loading="eager"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 rounded-2xl border border-border bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm">
                <p className="text-sm font-semibold text-foreground">{cms.getText("hero_location", "Подмосковье")}</p>
                <p className="text-xs text-muted-foreground">{cms.getText("hero_since", "Семейная ферма с 2019 года")}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — НАША ИСТОРИЯ (Timeline)
          ═══════════════════════════════════════════════════════ */}
      <section className="border-b border-border/60 bg-white py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground"
            >
              <Calendar className="h-3.5 w-3.5" />
              {cms.getText("history_badge", "Наша история")}
            </motion.span>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              {cms.getText("history_heading", "От мечты — к первому в России клубу персонального фермерства")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-muted-foreground sm:text-lg"
            >
              {cms.getText("history_subtitle", "Каждый год мы росли — не ради масштаба, а ради глубины. Больше заботы, больше прозрачности, больше связи между семьями и фермой.")}
            </motion.p>
          </motion.div>

          <div className="relative mx-auto max-w-3xl">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border md:left-1/2 md:-translate-x-px" />
            {timeline.map((item: { year: string; title: string; text: string }, i: number) => (
              <motion.div
                key={item.year}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className={`relative mb-12 flex items-start gap-6 md:gap-10 ${
                  i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                <div className="hidden md:block md:w-1/2" />
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-white text-xs font-bold text-primary shadow-sm">
                  {item.year.slice(-2)}
                </div>
                <div className="ml-16 md:ml-0 md:w-1/2">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold text-primary">{item.year}</p>
                    <h3 className="mt-1 text-base font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — ФИЛОСОФИЯ
          ═══════════════════════════════════════════════════════ */}
      <section className="border-b border-border/60 bg-[radial-gradient(circle_at_bottom_right,rgba(244,240,232,0.5),transparent_60%)] py-20 md:py-28">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <div className="overflow-hidden rounded-3xl border border-border/60 shadow-xl">
                <img
                  src={cms.getImage("philosophy_image", CDN.philosophy)}
                  alt="Философия фермы Шерь Козу"
                  className="w-full h-auto object-cover aspect-[4/3]"
                  loading="lazy"
                />
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="order-1 lg:order-2"
            >
              <motion.span
                variants={fadeUp}
                custom={0}
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {cms.getText("philosophy_badge", "Наша философия")}
              </motion.span>
              <motion.h2
                variants={fadeUp}
                custom={1}
                className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
              >
                {cms.getText("philosophy_heading", "Три принципа, на которых стоит ферма")}
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-4 text-muted-foreground sm:text-lg"
              >
                {cms.getText("philosophy_subtitle", "Мы верим, что качество начинается с отношения — к животным, к продукту и к людям, которые нам доверяют.")}
              </motion.p>

              <div className="mt-8 space-y-5">
                {principles.map((p: { icon: string; title: string; text: string }, i: number) => {
                  const Icon = iconMap[p.icon] || Eye;
                  return (
                    <motion.div
                      key={p.title}
                      variants={fadeUp}
                      custom={i + 3}
                      className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">{p.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{p.text}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — НАШИ ПОРОДЫ
          ═══════════════════════════════════════════════════════ */}
      <section className="border-b border-border/60 bg-white py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="mx-auto max-w-2xl text-center mb-14"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {cms.getText("breeds_badge", "Элитные породы")}
            </motion.span>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              {cms.getText("breeds_heading", "Генетика европейского уровня — основа премиального качества")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-muted-foreground sm:text-lg"
            >
              {cms.getText("breeds_subtitle", "Мы тщательно отбираем породы, которые дают лучшее молоко для сыров, йогуртов и свежих молочных продуктов.")}
            </motion.p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="overflow-hidden rounded-3xl border border-border/60 shadow-xl"
            >
              <img
                src={cms.getImage("breeds_image", CDN.breeds)}
                alt="Элитные породы коз и овец на ферме"
                className="w-full h-auto object-cover aspect-[4/3]"
                loading="lazy"
              />
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-4"
            >
              {breeds.map((b: { name: string; origin: string; trait: string; character: string }, i: number) => (
                <motion.div
                  key={b.name}
                  variants={fadeUp}
                  custom={i}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Milk className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{b.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.origin}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.trait}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80 italic">{b.character}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — ФОТОГАЛЕРЕЯ
          ═══════════════════════════════════════════════════════ */}
      <section className="border-b border-border/60 bg-[radial-gradient(circle_at_top_right,rgba(244,240,232,0.5),transparent_60%)] py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="mx-auto max-w-2xl text-center mb-14"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground"
            >
              <Baby className="h-3.5 w-3.5" />
              {cms.getText("gallery_badge", "Жизнь на ферме")}
            </motion.span>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              {cms.getText("gallery_heading", "Каждый день — забота, каждый продукт — история")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-muted-foreground sm:text-lg"
            >
              {cms.getText("gallery_subtitle", "Ферма живёт своим ритмом: утренние надои, прогулки на пастбище, визиты семей и вечерний уход. Вот как это выглядит.")}
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-6 sm:grid-cols-2"
          >
            {galleryImages.map((img, i) => (
              <motion.div
                key={img.alt}
                variants={fadeUp}
                custom={i}
                className="group relative overflow-hidden rounded-2xl border border-border shadow-sm"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-64 sm:h-72 lg:h-80 object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-5">
                  <p className="text-sm font-medium text-white">{img.caption}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 6 — НАШИ ЦЕННОСТИ (Compact)
          ═══════════════════════════════════════════════════════ */}
      <section className="border-b border-border/60 bg-white py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
            >
              <Users className="h-3.5 w-3.5" />
              {cms.getText("values_badge", "Наши ценности")}
            </motion.span>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              {cms.getText("values_heading", "Не масштаб, а глубина")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-muted-foreground sm:text-lg max-w-2xl mx-auto"
            >
              {cms.getText("values_subtitle", "Мы сознательно ограничиваем количество мест в клубе. Не потому что хотим создать дефицит — а потому что каждому животному нужна настоящая забота, а каждой семье — персональное внимание. Мы растём медленно, чтобы расти правильно.")}
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="mt-10 grid gap-6 sm:grid-cols-3"
            >
              {stats.map((s: { value: string; label: string }) => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-6 text-center">
                  <p className="text-3xl font-bold text-primary">{s.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-primary py-20 md:py-24">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl"
            >
              {cms.getText("cta_heading", "Приезжайте к нам на ферму")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="mt-4 text-primary-foreground/80 sm:text-lg"
            >
              {cms.getText("cta_subtitle", "Познакомьтесь с животными лично, попробуйте свежие продукты и почувствуйте, каково это — знать, откуда ваша еда.")}
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={2}
              className="mt-8 flex flex-wrap justify-center gap-4"
            >
              <Link href="/animals">
                <motion.span
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-primary shadow-lg transition-colors hover:bg-white/90"
                >
                  Выбрать животное
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Link>
              <Link href="/club">
                <motion.span
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Узнать о клубе
                </motion.span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-card py-10">
        <div className="container flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
              <Leaf className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">
              Шерь <span className="text-primary">Козу</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Семейная ферма персонального фермерства. Элитные породы коз и овец,
            именные продукты, закрытый клуб.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Главная</Link>
            <Link href="/animals" className="hover:text-foreground transition-colors">Каталог</Link>
            <Link href="/club" className="hover:text-foreground transition-colors">Клуб</Link>
            <Link href="/partners" className="hover:text-foreground transition-colors">Для партнёров</Link>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2">
            &copy; {new Date().getFullYear()} Шерь Козу. Все права защищены.
          </p>
        </div>
      </footer>
    </div>
  );
}
