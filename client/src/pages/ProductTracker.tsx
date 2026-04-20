/*
Design Philosophy Reminder — ProductTracker.tsx
Biomorphic Tech product transparency layer.
Core: transform product status into trust and narrative, not dry logistics.
Must connect milk, delivery, named products and animal origin in one readable route.
*/

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ScrollRemaining from "@/components/ScrollRemaining";
import PlanLifecycleProgress from "@/components/PlanLifecycleProgress";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Leaf,
  Loader2,
  Milk,
  Package,
  Sparkles,
  Star,
  Truck,
  Users,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  Heart,
  Smile,
  Activity,
} from "lucide-react";

const CDN = {
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  delivery: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/cms/150001-5t4v0ner-Главная_ШК1-Photoroom_cropped.jpg",
  cheese: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
};

type CompositionItem = {
  label: string;
  value: number;
  max: number;
  unit: string;
};

type MonthlyItem = {
  month: string;
  liters: number;
};

type DeliveryItem = {
  id: string;
  date: string;
  status: string;
  progress: number;
  story: string;
  items: string[];
};

type OriginStep = {
  title: string;
  text: string;
};

type TrackerSummary = {
  headline: {
    analysisLabel: string;
    organicLabel: string;
    title: string;
    description: string;
  };
  stats: Array<{ label: string; value: string; icon: "milk" | "truck" | "sparkles" | "flask" }>;
  composition: CompositionItem[];
  monthlyData: MonthlyItem[];
  deliveries: DeliveryItem[];
  originSteps: OriginStep[];
  routeNotes: string[];
  currentAnimal: {
    slug?: string;
    name: string;
    title: string;
    description: string;
    coverImageUrl?: string | null;
  };
  productStory: {
    title: string;
    description: string;
  };
};

// Transform raw API response (DB rows) into the TrackerSummary shape the UI expects
function transformApiToSummary(raw: any): TrackerSummary | undefined {
  if (!raw) return undefined;

  // If the data already has the TrackerSummary shape (legacy), return as-is
  if (raw.headline && raw.stats && raw.composition) {
    return raw as TrackerSummary;
  }

  const batches = raw.productBatches ?? [];
  const snapshots = raw.compositionSnapshots ?? [];
  const metrics = raw.monthlyMetrics ?? [];
  const rawDeliveries = raw.deliveries ?? [];
  const animal = raw.currentAnimal;

  const animalName = animal?.name ?? "вашего животного";
  const totalLiters = metrics.reduce((s: number, m: any) => s + (m.milkVolumeLiters ?? 0), 0);

  const headline = {
    analysisLabel: batches.length > 0 ? `Партия ${batches[0]?.batchCode ?? "—"}` : "Анализ партии загружается",
    organicLabel: "Органик",
    title: `Путь продукта: от ${animalName} до вашей именной коробки.`,
    description: "Происхождение молока, состав партии, статус доставки и связь с вашим животным — всё в одном месте.",
  };

  const stats: TrackerSummary["stats"] = [
    { label: "Партий", value: String(batches.length), icon: "flask" },
    { label: "Доставок", value: String(rawDeliveries.length), icon: "truck" },
    { label: "Литров", value: `${totalLiters} л`, icon: "milk" },
    { label: "Анализов", value: String(snapshots.length), icon: "sparkles" },
  ];

  const composition: CompositionItem[] = snapshots.map((s: any) => {
    const numVal = parseFloat(s.value) || 0;
    return {
      label: s.label ?? "—",
      value: numVal,
      max: Math.max(numVal * 1.5, 10),
      unit: s.note ?? "",
    };
  });

  const monthlyData: MonthlyItem[] = metrics.map((m: any) => ({
    month: m.monthLabel ?? "—",
    liters: m.milkVolumeLiters ?? 0,
  }));

  const deliveries: DeliveryItem[] = rawDeliveries.map((d: any, i: number) => ({
    id: d.title ?? `Доставка #${i + 1}`,
    date: d.etaLabel ?? "—",
    status: d.status ?? "в обработке",
    progress: d.isActive ? 60 : 100,
    story: d.courierNote ?? d.destination ?? "",
    items: batches
      .filter((_: any, bi: number) => bi % rawDeliveries.length === i)
      .map((b: any) => b.productName ?? "Продукт"),
  }));

  const originSteps: OriginStep[] = [
    { title: "Надой", text: `Молоко получено от ${animalName} на семейной ферме Шерь Козу.` },
    { title: "Анализ", text: "Каждая партия проходит проверку состава и качества." },
    { title: "Производство", text: "Из молока создаются именные продукты: сыры, йогурты, кефир." },
    { title: "Доставка", text: "Готовый набор доставляется вам с полной историей происхождения." },
  ];

  const routeNotes: string[] = batches.map((b: any) => `${b.productName}: ${b.detail ?? b.routeLabel ?? ""}`);

  return {
    headline,
    stats,
    composition,
    monthlyData,
    deliveries,
    originSteps,
    routeNotes,
    currentAnimal: animal
      ? {
          slug: animal.slug,
          name: animal.name,
          title: animal.title ?? `${animal.name} — источник вашего персонального маршрута`,
          description: animal.description ?? `Трекер продукции ${animal.name} показывает происхождение молока.`,
          coverImageUrl: animal.coverImageUrl,
        }
      : { name: animalName, title: "Каждый продукт начинается с конкретного животного.", description: "Выберите животное, чтобы увидеть полный трекер." },
    productStory: {
      title: "Именной продукт завершает цикл от фермы до стола.",
      description: "Не безликий сыр, а именной продукт — результат вашей связи с животным и заботы фермы.",
    },
  };
}

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

function iconForStat(icon: TrackerSummary["stats"][number]["icon"]) {
  switch (icon) {
    case "milk":
      return Milk;
    case "truck":
      return Truck;
    case "sparkles":
      return Sparkles;
    case "flask":
    default:
      return FlaskConical;
  }
}

export default function ProductTracker() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { isAuthenticated } = useAuth();
  const ownerDashboardQuery = trpc.animals.ownerDashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  // Only show animals the user actually owns (has active/pending_payment shares)
  const ownedAnimals = useMemo(() => {
    return ownerDashboardQuery.data?.allOwnerships ?? [];
  }, [ownerDashboardQuery.data?.allOwnerships]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const requestedAnimalSlug = useMemo(() => {
    return new URLSearchParams(searchString).get("animal") || null;
  }, [searchString]);
  const ownerAnimalSlug = ownerDashboardQuery.data?.animal?.slug ?? ownerDashboardQuery.data?.ownership?.animalSlug ?? null;
  const fallbackAnimalSlug = requestedAnimalSlug ?? ownerAnimalSlug ?? "";

  const trackerQuery = trpc.productTracker.getByAnimal.useQuery(
    { animalSlug: fallbackAnimalSlug },
    { enabled: Boolean(fallbackAnimalSlug) }
  );

  const summary = useMemo(() => transformApiToSummary(trackerQuery.data), [trackerQuery.data]);
  const currentAnimalSlug = summary?.currentAnimal?.slug ?? requestedAnimalSlug ?? ownerAnimalSlug ?? fallbackAnimalSlug;
  const featuredAnimalName = summary?.currentAnimal?.name ?? ownerDashboardQuery.data?.animal?.name ?? "вашего животного";
  const featuredAnimalProfileHref = currentAnimalSlug ? `/animals/${currentAnimalSlug}` : "/animals";
  const dashboardHref = currentAnimalSlug ? `/dashboard?animal=${currentAnimalSlug}` : "/dashboard";
  const clubHref = currentAnimalSlug ? `/club?animal=${currentAnimalSlug}` : "/club";

  const deliveries = summary?.deliveries ?? [];
  const [activeDelivery, setActiveDelivery] = useState(0);
  const [navigatingToProfile, setNavigatingToProfile] = useState(false);

  useEffect(() => {
    if (activeDelivery > Math.max(0, deliveries.length - 1)) {
      setActiveDelivery(0);
    }
  }, [activeDelivery, deliveries.length]);

  useEffect(() => {
    setActiveDelivery(0);
  }, [location, currentAnimalSlug]);

  const currentDelivery = deliveries[activeDelivery] ?? deliveries[0];
  const monthlyData = summary?.monthlyData ?? [];
  const maxLiters = useMemo(() => Math.max(1, ...monthlyData.map((item) => item.liters)), [monthlyData]);
  const ownerStatusLabel = ownerDashboardQuery.data?.ownership?.statusLabel ?? "Маршрут владельца";
  const ownerSharePercent = ownerDashboardQuery.data?.ownership?.sharePercent ?? 0;
  const isGuestJourney = ownerSharePercent === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container">
          <PageBreadcrumbs
            className="mb-5"
            items={[
              { label: "Главная", href: "/" },
              { label: "Мой кабинет", href: "/dashboard" },
              { label: `Трекер: ${featuredAnimalName}` },
            ]}
          />

          {/* Animal Switcher — only owned animals */}
          {ownedAnimals.length > 1 && (
            <div className="relative mb-6" data-testid="animalSwitcher">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="inline-flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                {summary?.currentAnimal?.coverImageUrl ? (
                  <img
                    src={summary.currentAnimal.coverImageUrl}
                    alt={featuredAnimalName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-primary">
                    <Milk className="h-3.5 w-3.5" />
                  </div>
                )}
                <span>{featuredAnimalName}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {switcherOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
                  >
                    <div className="p-2">
                      <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Переключить животное
                      </p>
                      {ownedAnimals.map((animal) => {
                        const isActive = animal.animalSlug === currentAnimalSlug;
                        return (
                          <button
                            key={animal.animalSlug}
                            onClick={() => {
                              setLocation(`/tracker?animal=${animal.animalSlug}`);
                              setSwitcherOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                              isActive
                                ? "bg-primary/8 font-semibold text-primary"
                                : "text-foreground hover:bg-secondary/60"
                            }`}
                          >
                            {animal.coverImageUrl ? (
                              <img
                                src={animal.coverImageUrl}
                                alt={animal.animalName}
                                className="h-9 w-9 rounded-full object-cover ring-2 ring-border/40"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-2 ring-border/40">
                                <Milk className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{animal.animalName}</div>
                              <div className="text-xs text-muted-foreground">
                                {animal.species === "goat" ? "Коза" : animal.species === "sheep" ? "Овца" : animal.species}
                                {animal.breed ? ` · ${animal.breed}` : ""}
                              </div>
                            </div>
                            {isActive && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Backdrop to close switcher */}
              {switcherOpen && (
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setSwitcherOpen(false)}
                />
              )}
            </div>
          )}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-[0_28px_80px_-42px_rgba(32,26,20,0.26)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
              <div className="relative min-h-[360px] overflow-hidden">
                <img src={summary?.currentAnimal?.coverImageUrl ?? CDN.milk} alt="Именная молочная коробка" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,20,0.84),rgba(25,22,20,0.42),rgba(25,22,20,0.14))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                      <Leaf className="h-3.5 w-3.5" />
                      {summary?.headline?.analysisLabel ?? "Анализ партии загружается"}
                    </div>
                    <div className="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold">
                      {summary?.headline?.organicLabel ?? "Органик"}
                    </div>
                    <div className="rounded-full bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur">
                      {ownerStatusLabel}
                    </div>
                  </div>

                  <div className="max-w-2xl">
                    <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Трекер продукта</p>
                    <h1 className="mt-3 font-display text-4xl text-white md:text-5xl">
                      {summary?.headline?.title ?? `Путь продукта: от ${featuredAnimalName} до вашей именной коробки.`}
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/76 md:text-base">
                      {summary?.headline?.description ??
                        "Происхождение молока, состав партии, статус доставки и связь с вашим животным — всё в одном месте."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(250,245,237,0.92))] p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(summary?.stats ?? []).map((item) => {
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

                <motion.div
                  className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm"
                  animate={navigatingToProfile ? { scale: 0.97, opacity: 0, y: -8 } : { scale: 1, opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                        <Milk className="h-7 w-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.22em] text-primary">Ваше животное</p>
                        <h2 className="mt-1.5 text-lg font-semibold text-foreground">
                          {summary?.currentAnimal?.name ?? featuredAnimalName}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {summary?.currentAnimal?.description ??
                            "Вы всегда знаете, от кого именно получено молоко."}
                        </p>
                      </div>
                    </div>

                    {/* ─── Wellbeing metrics row (from real data) ─── */}
                    {(() => {
                      const animalData = ownerDashboardQuery.data?.animal;
                      const happiness = animalData?.happinessScore ?? 50;
                      const health = animalData?.healthScore ?? 50;
                      const careLevel = animalData?.careLevelScore ?? 50;
                      return (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1 text-rose-600">
                              <Heart className="h-3.5 w-3.5" />
                              <span className="text-base font-bold">{happiness}</span>
                            </div>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Счастье</p>
                          </div>
                          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1 text-emerald-600">
                              <Activity className="h-3.5 w-3.5" />
                              <span className="text-base font-bold">{health}</span>
                            </div>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Здоровье</p>
                          </div>
                          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1 text-amber-600">
                              <Smile className="h-3.5 w-3.5" />
                              <span className="text-base font-bold">{careLevel}</span>
                            </div>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Настроение</p>
                          </div>
                        </div>
                      );
                    })()}

                    {summary?.currentAnimal?.slug && (
                      <button
                        onClick={() => {
                          setNavigatingToProfile(true);
                          setTimeout(() => setLocation(featuredAnimalProfileHref), 350);
                        }}
                        className="mt-4 flex w-full items-center justify-between rounded-xl bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/10 active:scale-[0.98]"
                      >
                        <span>Перейти к профилю</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {trackerQuery.isLoading || ownerDashboardQuery.isLoading ? (
            <div className="mb-5 rounded-[2rem] border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-sm">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загружаем данные о продуктах и вашем участии…
              </div>
            </div>
          ) : null}

          {trackerQuery.isError ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-[2rem] border border-destructive/30 bg-destructive/5 p-6 shadow-sm"
              data-testid="trackerError"
            >
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <Package className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-foreground">Не удалось загрузить продуктовый маршрут</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Произошла ошибка при загрузке данных трекера. Попробуйте обновить страницу или вернитесь позже.
                  </p>
                </div>
                <button
                  onClick={() => trackerQuery.refetch()}
                  className="shrink-0 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90"
                >
                  Попробовать снова
                </button>
              </div>
            </motion.div>
          ) : null}

          {!trackerQuery.isLoading && !trackerQuery.isError && !summary ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-[2rem] border border-dashed border-primary/20 bg-primary/5 p-8 text-center shadow-sm"
              data-testid="trackerEmpty"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Package className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">Трекер ещё не запущен</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Когда вы выберете животное и оформите участие, здесь появится полный трекер: состав молока, динамика надоев, история доставок и именные продукты.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/animals"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Выбрать животное <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  В кабинет
                </Link>
              </div>
            </motion.div>
          ) : null}

          {/* Lifecycle Progress Bar — only for authenticated owners */}
          {isAuthenticated && currentAnimalSlug && !isGuestJourney && (
            <div className="mb-5">
              <PlanLifecycleProgress animalSlug={currentAnimalSlug} />
            </div>
          )}

          <div className="grid grid-cols-12 gap-5">
            <motion.section
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:col-span-5"
            >
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Состав партии</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">Состав молока от {summary?.currentAnimal?.name ?? featuredAnimalName}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Качество партии видно прямо здесь — никаких абстрактных обещаний. Данные привязаны к вашему животному и вашей доле участия.
                  </p>
                </div>

                {(summary?.composition ?? []).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-center" data-testid="trackerEmptyComposition">
                    <FlaskConical className="mx-auto h-5 w-5 text-primary/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Данные о составе партии появятся после первого анализа молока.
                    </p>
                  </div>
                )}
                {(summary?.composition ?? []).map((item) => (
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
                  {ownerSharePercent > 0
                    ? `Ваша доля участия — ${ownerSharePercent}%. Трекер показывает именно вашу партию: происхождение, состав и доставку.`
                    : "Сертификат качества подтверждает каждую партию — прозрачность, которую можно увидеть."}
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm lg:col-span-7"
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Динамика надоев</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">Сезонный ритм животного</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    График показывает сезонность и связь между жизнью животного и объёмом продукта.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-mono-data text-3xl font-semibold text-foreground">{monthlyData[monthlyData.length - 1]?.liters ?? 0} л</div>
                  <div className="text-xs text-green-600">Последний доступный месяц</div>
                </div>
              </div>

              <div className="mt-8 flex h-44 items-end gap-2 overflow-x-auto pb-2 sm:h-48 sm:gap-3">
                {monthlyData.map((item, index) => (
                  <div key={item.month} className="flex min-w-[42px] flex-1 flex-col items-center gap-2 sm:min-w-0">
                    <span className="font-mono-data text-xs text-muted-foreground">{item.liters}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(item.liters / maxLiters) * 100}%` }}
                      transition={{ delay: 0.18 + index * 0.06, duration: 0.55 }}
                      className={`w-full rounded-t-xl ${index === monthlyData.length - 1 ? "bg-primary" : "bg-primary/28"}`}
                    />
                    <span className="text-xs text-muted-foreground">{item.month}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Путь продукта</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">От жизни животного до семейной коробки</h2>
                </div>
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(summary?.originSteps ?? []).map((step, index) => (
                  <div key={step.title} className="rounded-[1.5rem] bg-secondary/50 p-4">
                    <div className="font-mono-data text-xs uppercase tracking-[0.18em] text-primary">0{index + 1}</div>
                    <div className="mt-3 text-lg font-semibold text-foreground">{step.title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Owner Delivery Timeline */}
            <OwnerDeliveryTimeline animalSlug={currentAnimalSlug} />

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:col-span-6"
            >
              <img src={CDN.cheese} alt="Именной сыр" className="h-56 w-full object-cover" />
              <div className="p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-primary">Именной продукт</p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">
                  {summary?.productStory?.title ?? "Именной продукт завершает цикл от фермы до стола."}
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {summary?.productStory?.description ??
                    "Не безликий сыр, а именной продукт — результат вашей связи с животным и заботы фермы."}
                </p>
                <ScrollRemaining totalItems={(summary?.routeNotes ?? []).length} itemHeight={32} className="mt-5 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {(summary?.routeNotes ?? []).map((note) => (
                    <div key={note} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Star className="mt-0.5 h-4 w-4 text-accent" />
                      <span>{note}</span>
                    </div>
                  ))}
                </ScrollRemaining>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="col-span-12 rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(26,58,42,0.97),rgba(46,77,59,0.94))] p-6 text-white shadow-[0_34px_80px_-42px_rgba(26,58,42,0.72)] lg:col-span-6"
            >
              <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Связанные маршруты</p>
              <h2 className="mt-3 font-display text-3xl">Всё связано в единый путь.</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Из трекера вы можете перейти к профилю животного, клубной ленте или личному кабинету — всё связано с вашим участием.
              </p>

              {isGuestJourney ? (
                <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-white/8 p-4 text-sm text-white/78">
                  <div className="text-xs uppercase tracking-[0.16em] text-amber-300">Как начать</div>
                  <div className="mt-2 text-base font-semibold text-white">Трекер → Профиль животного → Вход → Личный кабинет</div>
                  <p className="mt-2 leading-6 text-white/65">
                    Даже без аккаунта вы можете увидеть, откуда продукт. Следующий шаг — откройте профиль животного, выберите долю и войдите в аккаунт.
                  </p>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3">
                <Link
                  href={featuredAnimalProfileHref}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">К профилю {featuredAnimalName}</div>
                    <div className="mt-1 text-xs text-white/60">Дневник, история и галерея вашего животного</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={clubHref}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">К клубной ленте</div>
                    <div className="mt-1 text-xs text-white/60">События, визиты и жизнь фермы</div>
                  </div>
                  <Users className="h-5 w-5 text-amber-300" />
                </Link>
                <Link
                  href={dashboardHref}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">В кабинет</div>
                    <div className="mt-1 text-xs text-white/60">Ваше участие, следующие шаги и быстрые действия</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.section>

            {currentDelivery ? (
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">Текущий статус маршрута</p>
                    <h2 className="mt-3 text-2xl font-semibold text-foreground">Текущая доставка — часть вашей истории с животным.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                      Вы всегда знаете, какая именно доставка сейчас в пути, что в ней и откуда она.
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
                      href={featuredAnimalProfileHref}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92"
                    >
                      К профилю {featuredAnimalName}
                    </Link>
                    <Link
                      href={clubHref}
                      className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      К клубной ленте
                    </Link>
                    <Link
                      href={dashboardHref}
                      className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      В кабинет
                    </Link>
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


/* ─── Owner Delivery Timeline ─── */

const MONTH_NAMES = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

const MONTH_NAMES_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово к отправке",
  delivered: "Доставлено",
};

const DELIVERY_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  planned: { bg: "bg-secondary/60", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  ready: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  delivered: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

type TimelineEntry = {
  id: number;
  month: number;
  year: number;
  status: string;
  itemsJson: string;
  deliveredAt: string | null;
  adminNote: string | null;
};

function OwnerDeliveryTimeline({ animalSlug }: { animalSlug: string }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(currentMonth);
  const [statusFilter, setStatusFilter] = useState<"all" | "planned" | "ready" | "delivered">("all");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 1; y <= currentYear + 1; y++) years.push(y);
    return years;
  }, [currentYear]);

  const timelineQuery = trpc.productTrack.getOwnerDeliveryTimeline.useQuery(
    { animalSlug, year: selectedYear },
    { enabled: Boolean(animalSlug) },
  );

  const allEntries = (timelineQuery.data?.entries ?? []) as TimelineEntry[];
  const entries = statusFilter === "all" ? allEntries : allEntries.filter((e) => e.status === statusFilter);
  const stats = timelineQuery.data?.stats ?? { total: 0, delivered: 0, ready: 0, planned: 0 };
  const progressPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  const parseItems = (json: string) => {
    try {
      return JSON.parse(json) as Array<{ label: string; quantity: number; unit: string; frequency?: string }>;
    } catch {
      return [];
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const XLSX = await import("xlsx");
      const animalName = (timelineQuery.data as any)?.animalName || animalSlug || "";
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["Мои доставки", `${animalName} — ${selectedYear}`],
        [],
        ["Всего доставок", stats.total],
        ["Доставлено", stats.delivered],
        ["Готово к отправке", stats.ready],
        ["Запланировано", stats.planned],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");

      // Detail sheet
      const headers = ["Месяц", "Продукты", "Статус", "Дата доставки", "Заметка"];
      const rows = allEntries.map((e) => {
        const items = parseItems(e.itemsJson);
        const productsStr = items.map((i) => `${i.label}: ${i.quantity} ${i.unit}`).join("; ");
        return [
          MONTH_NAMES_FULL[e.month - 1] || `Месяц ${e.month}`,
          productsStr,
          DELIVERY_STATUS_LABELS[e.status] || e.status,
          e.deliveredAt || "—",
          e.adminNote || "",
        ];
      });
      const detailSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      detailSheet["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 20 }, { wch: 14 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, detailSheet, "Доставки");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `мои_доставки_${animalName}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Excel export error:", err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const response = await fetch("/api/delivery/owner/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedYear,
          stats,
          entries: allEntries.map((e) => ({
            month: e.month,
            status: e.status,
            itemsJson: e.itemsJson,
            deliveredAt: e.deliveredAt,
            adminNote: e.adminNote,
          })),
        }),
      });

      if (!response.ok) throw new Error("PDF generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `мои_доставки_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF export error:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  if (!animalSlug) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
    >
      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left: image + summary */}
        <div className="flex flex-col border-b border-border/70 lg:border-b-0 lg:border-r">
          <div className="overflow-hidden">
            <img src={CDN.delivery} alt="График доставки" className="h-48 w-full object-cover lg:h-56" />
          </div>
          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-primary">График доставки</p>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">
                Ваш персональный календарь доставок
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Каждый месяц — запланированная доставка именных продуктов от вашего животного. Следите за статусом и содержимым каждой коробки.
              </p>
            </div>

            {/* Year selector + PDF export */}
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              {yearOptions.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    selectedYear === y
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {y}
                </button>
              ))}
              {allEntries.length > 0 && (
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={handleExportExcel}
                    disabled={exportingExcel}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {exportingExcel ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
                    Excel
                  </button>
                  <button
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {exportingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </button>
                </div>
              )}
            </div>

            {/* Status filter buttons */}
            {allEntries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([
                  { key: "all" as const, label: "Все", count: allEntries.length, color: "bg-primary/10 text-primary border-primary/20" },
                  { key: "delivered" as const, label: "Доставлено", count: stats.delivered, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { key: "ready" as const, label: "Готово", count: stats.ready, color: "bg-amber-50 text-amber-700 border-amber-200" },
                  { key: "planned" as const, label: "План", count: stats.planned, color: "bg-stone-50 text-stone-700 border-stone-200" },
                ]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                      statusFilter === f.key
                        ? `${f.color} ring-1 ring-offset-1 ring-primary/30`
                        : "border-border/50 bg-card text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {f.label}
                    <span className={`inline-flex items-center justify-center rounded-full px-1 py-0 text-[9px] font-bold ${
                      statusFilter === f.key ? "bg-white/60" : "bg-muted"
                    }`}>{f.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Progress summary */}
            {stats.total > 0 && (
              <div className="mt-5 rounded-[1.5rem] bg-secondary/50 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Прогресс за {selectedYear}</span>
                  <span className="font-semibold text-foreground">{stats.delivered}/{stats.total}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 px-2 py-1.5">
                    <div className="text-lg font-semibold text-emerald-700">{stats.delivered}</div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-600">Доставлено</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-2 py-1.5">
                    <div className="text-lg font-semibold text-amber-700">{stats.ready}</div>
                    <div className="text-[10px] uppercase tracking-wider text-amber-600">Готово</div>
                  </div>
                  <div className="rounded-xl bg-secondary px-2 py-1.5">
                    <div className="text-lg font-semibold text-muted-foreground">{stats.planned}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">План</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: monthly timeline */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Помесячный график</span>
            </div>
            {timelineQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {entries.length === 0 && !timelineQuery.isLoading ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-secondary/30 p-6 text-center" data-testid="trackerEmptyDeliveries">
              <Truck className="mx-auto h-7 w-7 text-primary/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                График доставки появится здесь после подтверждения вашего продуктового плана.
              </p>
            </div>
          ) : (
            <ScrollRemaining totalItems={entries.length} itemHeight={72} className="mt-4 max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {entries.map((entry) => {
                const items = parseItems(entry.itemsJson);
                const statusColors = DELIVERY_STATUS_COLORS[entry.status] ?? DELIVERY_STATUS_COLORS.planned;
                const isExpanded = expandedMonth === entry.month;
                const isCurrent = entry.year === currentYear && entry.month === currentMonth;
                const isPast = entry.year < currentYear || (entry.year === currentYear && entry.month < currentMonth);

                return (
                  <button
                    key={entry.id}
                    onClick={() => setExpandedMonth(isExpanded ? null : entry.month)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition-all ${
                      isCurrent
                        ? "border-primary/30 bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Month circle */}
                        <div className={`flex h-10 w-10 flex-col items-center justify-center rounded-full ${
                          entry.status === "delivered"
                            ? "bg-emerald-100 text-emerald-700"
                            : entry.status === "ready"
                            ? "bg-amber-100 text-amber-700"
                            : isCurrent
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          <span className="text-xs font-bold leading-none">{MONTH_NAMES[entry.month - 1]}</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {MONTH_NAMES_FULL[entry.month - 1]} {entry.year}
                            {isCurrent && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                                <Clock className="h-2.5 w-2.5" />
                                Текущий
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {items.length} {items.length === 1 ? "продукт" : items.length < 5 ? "продукта" : "продуктов"}
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColors.dot}`} />
                        {DELIVERY_STATUS_LABELS[entry.status] ?? entry.status}
                      </div>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-2">
                            {items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/55 px-3 py-2">
                                <span className="text-sm text-foreground">{item.label}</span>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {item.quantity} {item.unit}
                                  {item.frequency === "quarterly" && " (кв.)"}
                                </span>
                              </div>
                            ))}
                          </div>

                          {entry.deliveredAt && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Доставлено: {new Date(entry.deliveredAt).toLocaleDateString("ru-RU")}
                            </div>
                          )}

                          {entry.adminNote && (
                            <div className="mt-2 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{entry.adminNote}</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </ScrollRemaining>
          )}
        </div>
      </div>
    </motion.section>
  );
}
