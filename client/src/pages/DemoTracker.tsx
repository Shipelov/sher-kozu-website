/*
DemoTracker.tsx — Демо-версия трекера продукции
Показывается неавторизованным посетителям и зарегистрированным пользователям без животных.
Полностью повторяет визуал реального трекера, но с mock-данными и демо-баннером.
*/

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import ScrollRemaining from "@/components/ScrollRemaining";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useCmsContent } from "@/hooks/useCmsContent";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Eye,
  FlaskConical,
  Info,
  Leaf,
  Lock,
  Milk,
  Package,
  Sparkles,
  Star,
  Truck,
  Users,
} from "lucide-react";

const CDN = {
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  delivery: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  cheese: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
};

/* ─── Demo mock data ─── */
const DEMO_ANIMAL = {
  name: "Мира",
  slug: "mira",
  title: "Мира — источник вашего персонального маршрута",
  description: "Англо-нубийская коза Мира. Трекер показывает происхождение молока, параметры партии и ход доставки.",
  coverImageUrl: CDN.goat,
};

const DEMO_STATS = [
  { label: "Партий", value: "12", icon: "flask" as const },
  { label: "Доставок", value: "8", icon: "truck" as const },
  { label: "Литров", value: "94 л", icon: "milk" as const },
  { label: "Анализов", value: "6", icon: "sparkles" as const },
];

const DEMO_COMPOSITION = [
  { label: "Жирность", value: 5.2, max: 8, unit: "%" },
  { label: "Белок", value: 3.8, max: 6, unit: "%" },
  { label: "Лактоза", value: 4.1, max: 6, unit: "%" },
  { label: "Кальций", value: 134, max: 200, unit: "мг/100мл" },
  { label: "Соматические клетки", value: 180, max: 400, unit: "тыс/мл" },
];

const DEMO_MONTHLY = [
  { month: "Окт", liters: 11 },
  { month: "Ноя", liters: 14 },
  { month: "Дек", liters: 12 },
  { month: "Янв", liters: 9 },
  { month: "Фев", liters: 10 },
  { month: "Мар", liters: 13 },
  { month: "Апр", liters: 15 },
  { month: "Май", liters: 10 },
];

const DEMO_DELIVERIES = [
  {
    id: "Доставка #SK-2026-031",
    date: "28 марта 2026",
    status: "В пути",
    progress: 65,
    story: "Именная коробка с молочными продуктами от Миры отправлена курьерской службой. Ожидаемое время доставки — завтра до 14:00.",
    items: ["Козье молоко 1л", "Мягкий сыр «Мира» 200г", "Йогурт натуральный 350мл"],
  },
  {
    id: "Доставка #SK-2026-024",
    date: "14 марта 2026",
    status: "Доставлено",
    progress: 100,
    story: "Доставка завершена. Семейный набор передан лично. Спасибо за участие в жизни фермы!",
    items: ["Козье молоко 2л", "Сыр выдержанный 150г"],
  },
  {
    id: "Доставка #SK-2026-018",
    date: "28 февраля 2026",
    status: "Доставлено",
    progress: 100,
    story: "Зимний набор доставлен. Включал сезонный сыр с травами.",
    items: ["Козье молоко 1.5л", "Сыр с травами 200г", "Кефир 500мл"],
  },
];

const DEMO_ORIGIN_STEPS = [
  { title: "Надой", text: "Молоко получено от Миры на семейной ферме Шерь Козу утром в день производства." },
  { title: "Анализ", text: "Каждая партия проходит проверку состава: жирность, белок, соматические клетки." },
  { title: "Производство", text: "Из молока создаются именные продукты: сыры, йогурты, кефир — вручную, малыми партиями." },
  { title: "Доставка", text: "Готовый набор доставляется вам с полной историей происхождения и сертификатом." },
];

const DEMO_ROUTE_NOTES = [
  "Козье молоко: партия SK-031, жирность 5.2%, анализ от 25.03.2026",
  "Мягкий сыр «Мира»: ручное производство, выдержка 5 дней",
  "Йогурт натуральный: без добавок, из утреннего надоя",
];

const DEMO_TIPS = [
  {
    icon: Eye,
    title: "Полная прозрачность",
    text: "Как владелец, вы видите реальный состав молока, даты анализов и маршрут каждой партии.",
  },
  {
    icon: Lock,
    title: "Только ваши данные",
    text: "Трекер показывает продукцию именно от вашего животного — никаких обезличенных данных.",
  },
  {
    icon: Milk,
    title: "Именные продукты",
    text: "Каждый продукт подписан именем вашего животного и содержит QR-код с историей.",
  },
];

function MetricBar({ value, max }: { value: number; max: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth((value / max) * 100), 250);
    return () => clearTimeout(timer);
  }, [value, max]);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary progress-bar-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function iconForStat(icon: "milk" | "truck" | "sparkles" | "flask") {
  switch (icon) {
    case "milk": return Milk;
    case "truck": return Truck;
    case "sparkles": return Sparkles;
    case "flask": default: return FlaskConical;
  }
}

/** Tooltip-style hint badge shown on demo sections */
function DemoHint({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 ${className ?? ""}`}>
      <Info className="h-3 w-3 shrink-0" />
      {text}
    </div>
  );
}

export default function DemoTracker() {
  const { isAuthenticated } = useAuth();
  const cms = useCmsContent("tracker");
  const [activeDelivery, setActiveDelivery] = useState(0);
  const maxLiters = useMemo(() => Math.max(1, ...DEMO_MONTHLY.map((i) => i.liters)), []);
  const currentDelivery = DEMO_DELIVERIES[activeDelivery] ?? DEMO_DELIVERIES[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container">
          <PageBreadcrumbs
            className="mb-5"
            items={[
              { label: "Главная", href: "/" },
              { label: "Трекер продукции (демо)" },
            ]}
          />

          {/* ═══ DEMO BANNER ═══ */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 overflow-hidden rounded-[2rem] border-2 border-dashed border-amber-400/60 bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50/60 p-5 shadow-sm md:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-200/70 text-amber-700">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{cms.getText("demo_banner_title", "Это демо-версия трекера")}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    {cms.getText("demo_banner_description", "Вы видите пример того, как выглядит трекер продукции для владельца животного. Все данные ниже — демонстрационные. Станьте владельцем, чтобы видеть реальный путь продуктов от вашего животного.")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <Link
                  href="/animals"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  {cms.getText("demo_banner_cta", "Выбрать животное")} <ChevronRight className="h-4 w-4" />
                </Link>
                {!isAuthenticated && (
                  <a
                    href={getLoginUrl()}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    {cms.getText("demo_banner_login", "Войти в аккаунт")}
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* ═══ TIPS FOR FUTURE OWNERS ═══ */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {DEMO_TIPS.map((tip) => (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <tip.icon className="h-4.5 w-4.5" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-foreground">{tip.title}</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{tip.text}</p>
              </motion.div>
            ))}
          </div>

          {/* ═══ HERO SECTION ═══ */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-8 overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-[0_28px_80px_-42px_rgba(32,26,20,0.26)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
              <div className="relative min-h-[360px] overflow-hidden">
                <img src={DEMO_ANIMAL.coverImageUrl} alt="Демо — козье молоко" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,20,0.84),rgba(25,22,20,0.42),rgba(25,22,20,0.14))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <DemoHint text="Демо-данные" className="bg-amber-100/90" />
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                      <Leaf className="h-3.5 w-3.5" />
                      Партия SK-2026-031
                    </div>
                    <div className="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold">Органик</div>
                  </div>

                  <div className="max-w-2xl">
                    <p className="text-sm uppercase tracking-[0.22em] text-amber-300">{cms.getText("hero_label", "Трекер продукта")}</p>
                    <h1 className="mt-3 font-display text-4xl text-white md:text-5xl">
                      Путь продукта: от {DEMO_ANIMAL.name} до вашей именной коробки.
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/76 md:text-base">
                      {cms.getText("hero_description", "Происхождение молока, состав партии, статус доставки и связь с вашим животным — всё в одном месте.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(250,245,237,0.92))] p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {DEMO_STATS.map((item) => {
                    const Icon = iconForStat(item.icon);
                    return (
                      <div key={item.label} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-xl font-semibold text-foreground">{item.value}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                        <Milk className="h-7 w-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.22em] text-primary">Ваше животное</p>
                        <h2 className="mt-1.5 text-lg font-semibold text-foreground">{DEMO_ANIMAL.name}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{DEMO_ANIMAL.description}</p>
                      </div>
                    </div>
                    <Link
                      href="/animals"
                      className="mt-4 flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Перейти к профилю <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ═══ MAIN GRID ═══ */}
          <div className="grid grid-cols-12 gap-5">

            {/* Composition */}
            <motion.section
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className="relative col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:col-span-5"
            >
              <div className="space-y-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">{cms.getText("composition_label", "Состав партии")}</p>
                    <DemoHint text="Пример анализа" />
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">{cms.getText("composition_heading", `Состав молока от ${DEMO_ANIMAL.name}`)}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {cms.getText("composition_description", "Качество партии видно прямо здесь — никаких абстрактных обещаний. Данные привязаны к вашему животному и вашей доле участия.")}
                  </p>
                </div>

                {DEMO_COMPOSITION.map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono-data font-semibold text-foreground">
                        {item.value} {item.unit}
                      </span>
                    </div>
                    <MetricBar value={item.value} max={item.max} />
                  </div>
                ))}

                <div className="rounded-2xl bg-secondary/55 p-4 text-sm leading-7 text-muted-foreground">
                    {cms.getText("composition_note", "Как владелец, вы увидите здесь реальные данные анализа молока именно от вашего животного — с датами и сертификатами.")}
                </div>
              </div>
            </motion.section>

            {/* Monthly chart */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="relative col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm lg:col-span-7"
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">{cms.getText("chart_label", "Динамика надоев")}</p>
                    <DemoHint text="Пример графика" />
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">{cms.getText("chart_heading", "Сезонный ритм животного")}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {cms.getText("chart_description", "График показывает сезонность и связь между жизнью животного и объёмом продукта.")}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-mono-data text-3xl font-semibold text-foreground">{DEMO_MONTHLY[DEMO_MONTHLY.length - 1]?.liters ?? 0} л</div>
                  <div className="text-xs text-green-600">Последний доступный месяц</div>
                </div>
              </div>

              <div className="mt-8 flex h-44 items-end gap-2 overflow-x-auto pb-2 sm:h-48 sm:gap-3">
                {DEMO_MONTHLY.map((item, index) => (
                  <div key={item.month} className="flex min-w-[42px] flex-1 flex-col items-center gap-2 sm:min-w-0">
                    <span className="font-mono-data text-xs text-muted-foreground">{item.liters}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(item.liters / maxLiters) * 100}%` }}
                      transition={{ delay: 0.18 + index * 0.06, duration: 0.55 }}
                      className={`w-full rounded-t-xl ${index === DEMO_MONTHLY.length - 1 ? "bg-primary" : "bg-primary/28"}`}
                    />
                    <span className="text-xs text-muted-foreground">{item.month}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Origin steps */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">{cms.getText("origin_label", "Путь продукта")}</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">{cms.getText("origin_heading", "От жизни животного до семейной коробки")}</h2>
                </div>
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {DEMO_ORIGIN_STEPS.map((step, index) => (
                  <div key={step.title} className="rounded-[1.5rem] bg-secondary/50 p-4">
                    <div className="font-mono-data text-xs uppercase tracking-[0.18em] text-primary">0{index + 1}</div>
                    <div className="mt-3 text-lg font-semibold text-foreground">{step.title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Deliveries */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
            >
              <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="overflow-hidden border-b border-border/70 lg:border-b-0 lg:border-r">
                  <img src={cms.getImageWithFocus("delivery_image", CDN.delivery).url} alt="История доставок" className="h-full min-h-[260px] w-full object-cover" style={{ objectPosition: cms.getImageWithFocus("delivery_image", CDN.delivery).objectPosition }} />
                </div>
                <div className="p-5">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm uppercase tracking-[0.22em] text-primary">{cms.getText("delivery_label", "История доставок")}</p>
                        <DemoHint text="Пример доставок" />
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold text-foreground">{cms.getText("delivery_heading", "Каждая доставка — часть истории, а не просто заказ.")}</h2>
                    </div>
                    <Package className="h-6 w-6 text-primary" />
                  </div>

                  <ScrollRemaining totalItems={DEMO_DELIVERIES.length} itemHeight={72} className="mt-6 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {DEMO_DELIVERIES.map((delivery, index) => (
                      <button
                        key={delivery.id}
                        onClick={() => setActiveDelivery(activeDelivery === index ? -1 : index)}
                        className="w-full rounded-[1.5rem] border border-border bg-white p-4 text-left transition-colors hover:bg-muted/35"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{delivery.id}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{delivery.date}</div>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                            {delivery.progress === 100 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                            {delivery.status}
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${delivery.progress}%` }} />
                        </div>

                        <AnimatePresence initial={false}>
                          {activeDelivery === index && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <p className="mt-4 text-sm leading-7 text-muted-foreground">{delivery.story}</p>
                              <div className="mt-3 grid gap-2">
                                {delivery.items.map((item) => (
                                  <div key={item} className="rounded-xl bg-secondary/55 px-3 py-2 text-sm text-foreground">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    ))}
                  </ScrollRemaining>
                </div>
              </div>
            </motion.section>

            {/* Named product */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:col-span-6"
            >
              <img src={cms.getImageWithFocus("named_product_image", CDN.cheese).url} alt="Именной сыр" className="h-56 w-full object-cover" style={{ objectPosition: cms.getImageWithFocus("named_product_image", CDN.cheese).objectPosition }} />
              <div className="p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-primary">{cms.getText("named_product_label", "Именной продукт")}</p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">
                  {cms.getText("named_product_heading", "Именной продукт завершает цикл от фермы до стола.")}
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {cms.getText("named_product_description", "Не безликий сыр, а именной продукт — результат вашей связи с животным и заботы фермы.")}
                </p>
                <ScrollRemaining totalItems={DEMO_ROUTE_NOTES.length} itemHeight={32} className="mt-5 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {DEMO_ROUTE_NOTES.map((note) => (
                    <div key={note} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Star className="mt-0.5 h-4 w-4 text-accent" />
                      <span>{note}</span>
                    </div>
                  ))}
                </ScrollRemaining>
              </div>
            </motion.section>

            {/* CTA section */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="col-span-12 rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(26,58,42,0.97),rgba(46,77,59,0.94))] p-6 text-white shadow-[0_34px_80px_-42px_rgba(26,58,42,0.72)] lg:col-span-6"
            >
              <p className="text-sm uppercase tracking-[0.22em] text-amber-300">{cms.getText("cta_label", "Как это работает")}</p>
              <h2 className="mt-3 font-display text-3xl">{cms.getText("cta_heading", "Станьте владельцем — получите свой трекер.")}</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                {cms.getText("cta_description", "Когда вы выберете животное и оформите участие, этот трекер заполнится реальными данными: состав молока, динамика надоев, история доставок и именные продукты — всё от вашего конкретного животного.")}
              </p>

              <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-white/8 p-4 text-sm text-white/78">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-300">{cms.getText("cta_path_label", "Ваш путь")}</div>
                <div className="mt-2 text-base font-semibold text-white">{cms.getText("cta_path_title", "Каталог → Выбор животного → Оформление → Личный трекер")}</div>
                <p className="mt-2 leading-6 text-white/65">
                  {cms.getText("cta_path_description", "Выберите козу или овцу в каталоге, оформите участие и получите доступ к персональному трекеру с реальными данными.")}
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/animals"
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">Открыть каталог животных</div>
                    <div className="mt-1 text-xs text-white/60">Выберите козу или овцу и начните путь владельца</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/about"
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">Узнать о ферме</div>
                    <div className="mt-1 text-xs text-white/60">Как устроено персональное фермерство</div>
                  </div>
                  <Users className="h-5 w-5 text-amber-300" />
                </Link>
                {!isAuthenticated && (
                  <a
                    href={getLoginUrl()}
                    className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white">Войти в аккаунт</div>
                      <div className="mt-1 text-xs text-white/60">Если у вас уже есть животное — войдите для доступа к реальному трекеру</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                  </a>
                )}
              </div>
            </motion.section>

            {/* Current delivery detail */}
            {currentDelivery ? (
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="relative col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm uppercase tracking-[0.22em] text-primary">{cms.getText("status_label", "Текущий статус маршрута")}</p>
                      <DemoHint text="Пример статуса" />
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-foreground">{cms.getText("status_heading", "Текущая доставка — часть вашей истории с животным.")}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                      {cms.getText("status_description", "Вы всегда знаете, какая именно доставка сейчас в пути, что в ней и откуда она.")}
                    </p>

                    <div className="mt-5 rounded-[1.5rem] bg-secondary/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-primary">Активная доставка</div>
                          <div className="mt-1 text-lg font-semibold text-foreground">
                            {currentDelivery.id} · {currentDelivery.date}
                          </div>
                        </div>
                        <div className="rounded-full bg-accent/20 px-4 py-2 text-xs font-semibold text-amber-800">{currentDelivery.status}</div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{currentDelivery.story}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <Link
                      href="/animals"
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92"
                    >
                      Выбрать животное
                    </Link>
                    <Link
                      href="/club"
                      className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      К клубной ленте
                    </Link>
                    {!isAuthenticated ? (
                      <a
                        href={getLoginUrl()}
                        className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Войти
                      </a>
                    ) : (
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        В кабинет
                      </Link>
                    )}
                  </div>
                </div>
              </motion.section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
