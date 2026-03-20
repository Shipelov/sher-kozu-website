/*
Design Philosophy Reminder — Dashboard.tsx
Biomorphic Tech owner cockpit.
Core: not an admin panel, but a premium emotional operating system for personal farming.
Must feel like a living bridge between animal, products, club and future AI curation.
*/

import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import AuthModal from "@/components/AuthModal";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Calendar,
  ChevronRight,
  Heart,
  MapPin,
  Milk,
  Package,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Users,
  Waves,
} from "lucide-react";

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
  dairyBox: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
};

type StepKind = "profile" | "tracker" | "club" | "confirm" | "diary" | "catalog";

type DashboardStep = {
  id: string;
  href: string;
  title: string;
  description: string;
  kind: string;
};

function formatCurrency(minor?: number | null, currencyCode: string = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format((minor ?? 0) / 100);
}

function getAnimalStatusLabel(status?: string | null) {
  if (status === "fully_booked") return "Выкуплено полностью";
  if (status === "public_limited") return "Осталось мало долей";
  if (status === "hidden") return "Скрыто";
  if (status === "archived") return "Архив";
  return "Доступно для участия";
}

function getOwnershipTone(status?: string | null) {
  if (status === "pending_payment") {
    return {
      pill: "Ожидает подтверждения",
      description:
        "Участие уже забронировано, и следующий шаг — подтвердить маршрут владельца и закрепить его в кабинете.",
    };
  }

  return {
    pill: "Активный владелец",
    description:
      "У вас открыт полный owner-режим: дневник, галерея, трекер продукта и клубные сценарии возвращения.",
  };
}

function iconForStep(kind: string) {
  if (kind === "tracker") return Package;
  if (kind === "club") return Users;
  if (kind === "confirm") return ShieldCheck;
  if (kind === "diary") return BookOpen;
  if (kind === "catalog") return Sparkles;
  return Heart;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pb-14 pt-24 md:pt-28">
        <div className="container space-y-5">
          <div className="animate-pulse overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="min-h-[420px] bg-muted" />
              <div className="bg-secondary/30 p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4">
                      <div className="h-10 w-10 rounded-2xl bg-muted" />
                      <div className="mt-3 h-3 w-20 rounded bg-muted" />
                      <div className="mt-2 h-5 w-28 rounded bg-muted" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[1.75rem] border border-border/70 bg-card">
                  <div className="h-44 bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-32 rounded bg-muted" />
                    <div className="h-5 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-7 animate-pulse rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-3 h-6 w-3/4 rounded bg-muted" />
              <div className="mt-4 h-4 w-full rounded bg-muted" />
              <div className="mt-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-[1.75rem] border border-border/70 bg-white p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 rounded-2xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-2/3 rounded bg-muted" />
                        <div className="h-4 w-full rounded bg-muted" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-12 md:col-span-5 animate-pulse rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="mt-3 h-6 w-2/3 rounded bg-muted" />
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-secondary/55 p-4">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="mt-2 h-5 w-24 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pb-14 pt-24 md:pt-28">
        <div className="container">
          <div className="mx-auto max-w-lg rounded-[2rem] border border-destructive/30 bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Не удалось загрузить кабинет</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Произошла ошибка при загрузке данных вашего кабинета владельца. Попробуйте обновить страницу или вернитесь позже.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={onRetry}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Попробовать снова
              </button>
              <Link
                href="/animals"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Открыть галерею
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const ownerDashboardQuery = trpc.animals.ownerDashboard.useQuery();
  const dashboard = ownerDashboardQuery.data;
  const ownership = dashboard?.ownership ?? null;
  const currentAnimal = dashboard?.animal ?? null;
  const productSummary = dashboard?.productSummary ?? null;
  const clubSummary = dashboard?.clubSummary ?? null;
  const nextSteps = dashboard?.nextSteps ?? [];
  const quickLinks = dashboard?.quickLinks ?? [];
  const allOwnerships = dashboard?.allOwnerships ?? [];

  if (ownerDashboardQuery.isLoading) return <DashboardSkeleton />;
  if (ownerDashboardQuery.isError) return <DashboardError onRetry={() => ownerDashboardQuery.refetch()} />;

  const ownershipTone = getOwnershipTone(ownership?.status);
  const featuredAnimalName = currentAnimal?.name ?? ownership?.animalName ?? "ваше животное";
  const featuredAnimalProfileHref = currentAnimal ? `/animals/${currentAnimal.slug}` : "/animals";
  const trackerHref = currentAnimal ? `/tracker?animal=${currentAnimal.slug}` : "/tracker";
  const clubHref = currentAnimal ? `/club?animal=${currentAnimal.slug}` : "/club";
  const isGuestJourney = !ownership && !currentAnimal;
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const guestPreviewSections = [
    {
      title: "Профиль участия",
      description: "После входа здесь появятся ваша доля, статус участия и персональная карточка выбранного животного.",
    },
    {
      title: "Трекер продукта",
      description: "Кабинет покажет связанную партию, доставку и происхождение молока именно от выбранного животного.",
    },
    {
      title: "Клуб и визиты",
      description: "После авторизации откроются события, семейные визиты и точки возвращения в фермерский ритм.",
    },
  ];

  const guestRegistrationBenefits = [
    "Сохраните выбранное животное и вернётесь к нему без повторного поиска.",
    "Откроете личный кабинет с долей участия, трекером продукта и следующими шагами.",
    "Получите доступ к клубным визитам, дневнику ухода и owner-only обновлениям.",
  ];

  const summaryCards = currentAnimal
    ? [
        {
          label: "Ваше участие",
          value: `${ownership?.sharePercent ?? currentAnimal.mySharePercent ?? 0}%`,
          icon: Heart,
        },
        {
          label: "Статус участия",
          value: ownership?.statusLabel ?? ownershipTone.pill,
          icon: ShieldCheck,
        },
        {
          label: "Ближайшая доставка",
          value: productSummary?.currentDelivery?.status ?? "Маршрут формируется",
          icon: Package,
        },
        {
          label: "Следующее событие",
          value: clubSummary?.nextEvent?.title ?? "Клубный ритм обновляется",
          icon: Calendar,
        },
      ]
    : [
        { label: "Следующий шаг", value: "Выбрать животное", icon: Heart },
        { label: "Каталог", value: "Открыт", icon: Sparkles },
        { label: "Трекер", value: "Доступен после участия", icon: Package },
        { label: "Клуб", value: "Ожидает первого маршрута", icon: Users },
      ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-[0_28px_80px_-42px_rgba(32,26,20,0.26)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="relative min-h-[420px] overflow-hidden">
                <img
                  src={currentAnimal?.coverImageUrl ?? CDN.hero}
                  alt={featuredAnimalName}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,20,0.86),rgba(25,22,20,0.48),rgba(25,22,20,0.18))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-300 backdrop-blur">
                      <Sparkles className="h-4 w-4" />
                      Кабинет владельца
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/80 backdrop-blur">
                      <MapPin className="h-4 w-4" />
                      {currentAnimal
                        ? `${featuredAnimalName}, продукт и клуб в одном ритме`
                        : "Маршрут начнётся после выбора животного"}
                    </div>
                  </div>

                  <div className="max-w-2xl">
                    <h1 className="font-display text-4xl text-white md:text-6xl">
                      {currentAnimal
                        ? `Цифровое сердце Sher Kozu собирает жизнь ${featuredAnimalName} в один понятный маршрут владельца.`
                        : "Цифровое сердце Sher Kozu готово собрать ваше персональное фермерство в один понятный маршрут."}
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/76 md:text-base">
                      {currentAnimal
                        ? ownershipTone.description
                        : "Сначала выберите животное в галерее. После этого кабинет свяжет дневник, трекер продукта, клуб и следующий лучший шаг без лишних развилок."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(250,245,237,0.92))] p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {summaryCards.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{item.value}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                  <img src={CDN.dairyBox} alt="Именная продуктовая коробка" className="h-44 w-full object-cover" />
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Следующий материальный результат</p>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">
                      {currentAnimal
                        ? `Именная коробка продолжает историю ${featuredAnimalName} и вашего участия ${ownership?.sharePercent ?? currentAnimal.mySharePercent ?? 0}%.`
                        : "После выбора животного кабинет покажет, как личная связь превращается в именной продуктовый маршрут."}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {productSummary?.currentBatch?.detail ??
                        "Продуктовый слой здесь показывает, что Sher Kozu продаёт не просто молочные наборы, а прозрачную и персональную историю происхождения."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── Pending Payment Banner ── */}
          {ownership?.status === "pending_payment" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="overflow-hidden rounded-[2rem] border border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm md:p-6"
              data-testid="dashboardPendingPayment"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
                    <Waves className="h-3.5 w-3.5" />
                    Ожидает подтверждения оплаты
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-foreground">
                    Ваша доля {ownership.sharePercent}% в {featuredAnimalName} забронирована
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                    Чтобы активировать участие и открыть полный кабинет владельца, оплатите бронирование. После подтверждения оплаты фермой вам станут доступны: дневник, трекер продуктов, клуб и чат с фермой.
                  </p>

                  {/* Stepper */}
                  <div className="mt-5 flex items-center gap-0">
                    {[
                      { label: "Заявка", done: true },
                      { label: "Оплата", done: false, active: true },
                      { label: "Активация", done: false },
                    ].map((step, i, arr) => (
                      <div key={step.label} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                              step.done
                                ? "bg-emerald-500 text-white"
                                : step.active
                                  ? "bg-amber-500 text-white ring-4 ring-amber-200"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.done ? "✓" : i + 1}
                          </div>
                          <span
                            className={`mt-1.5 text-xs font-medium ${
                              step.done
                                ? "text-emerald-600"
                                : step.active
                                  ? "text-amber-700"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div
                            className={`mx-2 h-0.5 w-10 sm:w-16 ${
                              step.done ? "bg-emerald-400" : "bg-muted"
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment instructions card */}
                <div className="w-full rounded-2xl border border-amber-200 bg-white p-4 shadow-sm lg:max-w-xs">
                  <div className="text-xs font-semibold uppercase tracking-widest text-amber-700">Как оплатить</div>
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-start gap-2.5 text-sm text-foreground">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</div>
                      <span>Свяжитесь с фермой через чат или по контактам на сайте</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-sm text-foreground">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</div>
                      <span>Получите реквизиты для оплаты и переведите сумму {formatCurrency(ownership.priceMinorTotal)}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-sm text-foreground">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</div>
                      <span>Ферма подтвердит оплату, и кабинет откроется полностью</span>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Бронирование действительно 7 дней. После этого доля снова станет доступной для других.
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── Мои животные ── show when owner has multiple animals */}
          {allOwnerships.length > 1 && (
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
              data-testid="dashboardAllOwnerships"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Мои животные</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    У вас {allOwnerships.length} {allOwnerships.length >= 5 ? "животных" : allOwnerships.length >= 2 ? "животных" : "животное"} в персональном фермерстве
                  </h3>
                </div>
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Каждое животное — отдельный маршрут владельца: профиль, трекер продукта и клубные сценарии. Нажмите на карточку, чтобы перейти к конкретному животному.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allOwnerships.map((item) => {
                  const isPrimary = item.animalId === ownership?.animalId;
                  return (
                    <Link
                      key={item.animalId}
                      href={`/animals/${item.animalSlug}`}
                      className={`group relative overflow-hidden rounded-[1.5rem] border bg-white p-4 transition-colors hover:bg-muted/35 ${
                        isPrimary ? "border-primary/30 ring-1 ring-primary/15" : "border-border/70"
                      }`}
                    >
                      {isPrimary && (
                        <div className="absolute right-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                          Основное
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        {item.coverImageUrl ? (
                          <img
                            src={item.coverImageUrl}
                            alt={item.animalName}
                            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                            <Heart className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold text-foreground">{item.animalName}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {item.species}{item.breed ? ` · ${item.breed}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-secondary/55 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Доля</div>
                          <div className="mt-0.5 text-sm font-semibold text-foreground">{item.sharePercent}%</div>
                        </div>
                        <div className="rounded-xl bg-secondary/55 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Статус</div>
                          <div className={`mt-0.5 text-sm font-semibold ${
                            item.status === "pending_payment" ? "text-amber-600" : "text-emerald-600"
                          }`}>
                            {item.statusLabel}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-xs text-muted-foreground">
                          {item.slotsCount} {item.slotsCount === 1 ? "слот" : item.slotsCount < 5 ? "слота" : "слотов"} · {formatCurrency(item.priceMinorTotal)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── Если одно животное, показываем компактную карточку для навигации */}
          {allOwnerships.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-[1.5rem] border border-primary/15 bg-primary/5 px-5 py-3"
              data-testid="dashboardSingleOwnership"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">
                    <span className="font-semibold">{allOwnerships[0].animalName}</span>
                    <span className="text-muted-foreground"> · {allOwnerships[0].sharePercent}% · {allOwnerships[0].statusLabel}</span>
                  </span>
                </div>
                <Link
                  href={`/animals/${allOwnerships[0].animalSlug}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Профиль <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-12 gap-5">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-7"
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Следующие шаги</p>
                  <h3 className="mt-2 text-2xl font-semibold text-foreground">
                    {currentAnimal
                      ? `${featuredAnimalName} уже в кабинете. Дальше — понятные действия без dead-end состояний.`
                      : "Кабинет ждёт первый шаг: выбрать животное и запустить личный маршрут участия."}
                  </h3>
                </div>
                <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                  <span className="pulse-dot" />
                  Owner journey
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                Этот блок больше не живёт как демо-сводка. Он собирает реальные данные текущего участия, чтобы сразу объяснить, что делать после покупки: вернуться в дневник, проверить продукт или открыть клуб.
              </p>

              {isGuestJourney ? (
                <div className="mt-5 space-y-4 rounded-[1.75rem] border border-primary/15 bg-primary/5 p-4" data-testid="dashboardGuestPreview">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-primary">Guest preview</div>
                    <div className="rounded-full border border-primary/15 bg-white/70 px-3 py-1 text-[11px] font-medium text-primary">
                      Ограниченный доступ до входа
                    </div>
                  </div>
                  <div>
                    <div className="mt-2 text-lg font-semibold text-foreground">Gallery → Animal Profile → Вход → Dashboard</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Если вы ещё не авторизованы, кабинет не обрывает сценарий. Сначала откройте галерею, выберите животное и посмотрите его публичный preview, затем войдите в аккаунт на шаге оформления доли — после этого dashboard автоматически свяжет профиль, трекер и клуб.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {guestPreviewSections.map((section) => (
                      <div key={section.title} className="rounded-2xl border border-primary/10 bg-white/80 p-4">
                        <div className="text-sm font-semibold text-foreground">{section.title}</div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-dashed border-primary/20 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-foreground">Что откроется после входа</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Полная owner-версия кабинета показывает реальное участие, долю, текущее животное, следующие шаги и быстрые переходы между профилем, трекером и клубом без тупиковых состояний.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-primary/15 bg-white/80 p-4" data-testid="dashboard-guest-sticky-benefits">
                    <div className="text-sm font-semibold text-foreground">Зачем регистрироваться уже сейчас</div>
                    <div className="mt-3 grid gap-2">
                      {guestRegistrationBenefits.map((benefit) => (
                        <div key={benefit} className="flex items-start gap-2 rounded-2xl bg-primary/5 px-3 py-2 text-sm text-foreground">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/animals"
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92"
                    >
                      Открыть галерею животных
                    </Link>
                    <Link
                      href="/tracker"
                      className="inline-flex items-center justify-center rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Сначала посмотреть продуктовый маршрут
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                {nextSteps.map((step: DashboardStep) => {
                  const Icon = iconForStep(step.kind);
                  return (
                    <Link
                      key={step.id}
                      href={step.href}
                      className="group rounded-[1.75rem] border border-border/70 bg-white p-4 transition-colors hover:bg-muted/35"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-lg font-semibold text-foreground">{step.title}</div>
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                              Открыть
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-5"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Профиль участия</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {currentAnimal ? `Ваше участие в ${featuredAnimalName}` : "Пока участие не выбрано"}
                  </h3>
                </div>
                <Heart className="h-5 w-5 text-primary" />
              </div>

              {isGuestJourney ? (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-secondary/35 p-4" data-testid="dashboardGuestLockedParticipation">
                  <div className="text-xs uppercase tracking-[0.16em] text-primary">Preview режима владельца</div>
                  <h4 className="mt-2 text-lg font-semibold text-foreground">Профиль участия откроется после входа</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Здесь появятся статус ownership, доля участия, закреплённые слоты и карточка текущего животного. До входа мы показываем структуру кабинета, но не раскрываем owner-only данные.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-secondary/55 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Статус</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{ownership?.statusLabel ?? "Выберите животное"}</div>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Доля участия</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">{ownership?.sharePercent ?? 0}%</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {ownership
                      ? `Закреплены доли: ${ownership.slotIndexes.join(", ")}. Общая сумма текущего участия — ${formatCurrency(ownership.priceMinorTotal)}.`
                      : "После выбора доли кабинет начнёт показывать ваш реальный ownership-state и дальнейшие действия владельца."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Животное</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{currentAnimal?.name ?? "Пока не выбрано"}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {currentAnimal
                      ? `${currentAnimal.shortDescription ?? "Профиль животного уже связан с вашим кабинетом."} Статус витрины: ${getAnimalStatusLabel(currentAnimal.status)}.`
                      : "Сначала откройте галерею и выберите животное, чтобы здесь появилась персональная карточка владельца."}
                  </p>
                </div>
              </div>

              <Link
                href={featuredAnimalProfileHref}
                className="group mt-4 flex flex-col items-start gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-foreground">
                    {currentAnimal ? `Перейти к профилю ${featuredAnimalName}` : "Открыть галерею животных"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {currentAnimal
                      ? "Дневник, история, галерея и действия владельца открываются из одного профиля."
                      : "Каталог — первый шаг, чтобы запустить owner journey."}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-7"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Быстрые переходы</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">Важные owner-действия всегда на расстоянии одного клика</h3>
                </div>
                <BookOpen className="h-5 w-5 text-primary" />
              </div>

              {isGuestJourney ? (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-secondary/35 p-4" data-testid="dashboardGuestLockedQuickLinks">
                  <div className="text-xs uppercase tracking-[0.16em] text-primary">Locked owner actions</div>
                  <h4 className="mt-2 text-lg font-semibold text-foreground">Быстрые переходы активируются после авторизации</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    После входа здесь появятся прямые ссылки в дневник, продуктовый трекер и клубную ленту выбранного животного. До этого момента кабинет показывает только направление маршрута.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {quickLinks.map((item: { label: string; href: string; description: string }) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group rounded-[1.5rem] border border-border bg-white p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Открыть
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Надой и партия",
                    value: productSummary?.currentBatch?.stage ?? "Партия появится после участия",
                    icon: Milk,
                  },
                  {
                    label: "Доставка",
                    value: productSummary?.currentDelivery?.status ?? "Ещё не запланирована",
                    icon: Truck,
                  },
                  {
                    label: "Клуб",
                    value: clubSummary?.nextEvent?.title ?? "Новые события скоро",
                    icon: Users,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl bg-secondary/55 p-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.16em]">{item.label}</span>
                      </div>
                      <div className="mt-3 text-lg font-semibold text-foreground">{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:col-span-5"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Маршрут продукта</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">Продукт не отрывается от животного и вашего участия</h3>
                </div>
                <Package className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                <img src={CDN.dairyBox} alt="Именная коробка" className="h-44 w-full object-cover" />
                <div className="p-4">
                  <div className="text-sm font-semibold text-foreground">
                    {productSummary?.currentBatch?.productName ?? "Именная коробка появится после выбора животного"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {productSummary?.currentBatch?.detail ??
                      "Когда участие будет оформлено, этот блок покажет реальную партию, прозрачный маршрут и связь с вашим животным."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <Link
                  href={trackerHref}
                  className="group flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-secondary/80"
                >
                  <span>Открыть трекер продукции</span>
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={clubHref}
                  className="group flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <div>
                    <div className="font-semibold text-foreground">Проверить клубную жизнь</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      События, визиты и точки возврата в фермерский ритм
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="col-span-12 rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(26,58,42,0.97),rgba(46,77,59,0.94))] p-6 text-white shadow-[0_34px_80px_-42px_rgba(26,58,42,0.72)]"
            >
              <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-300">
                    <Bot className="h-3.5 w-3.5" />
                    AI-блок для Sprint 2
                  </div>
                  <h3 className="mt-4 font-display text-3xl">Следующий слой — персональный куратор владельца.</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                    Теперь, когда dashboard уже знает текущее животное, долю и ближайшие действия, нижний блок не остаётся концептом. Он удерживает те же переходы, что и ProductTracker, ClubFeed и Animal Profile, чтобы пользователь не попадал в dead-end состояние.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/65">
                    <span className="rounded-full border border-white/15 px-3 py-1">единый slug животного</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">возврат в профиль, трекер и клуб</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">один ownership journey</span>
                  </div>
                </div>

                <div className="grid min-w-0 gap-3 rounded-[1.5rem] bg-white/8 p-4 backdrop-blur md:min-w-[300px]">
                  <Link
                    href={featuredAnimalProfileHref}
                    className="rounded-2xl border border-white/10 bg-white/8 p-3 text-sm text-white/82 transition-colors hover:bg-white/12"
                  >
                    Профиль {featuredAnimalName}
                  </Link>
                  <Link
                    href={trackerHref}
                    className="rounded-2xl border border-white/10 bg-white/8 p-3 text-sm text-white/82 transition-colors hover:bg-white/12"
                  >
                    Трекер продукта текущего животного
                  </Link>
                  <Link
                    href={clubHref}
                    className="rounded-2xl border border-white/10 bg-white/8 p-3 text-sm text-white/82 transition-colors hover:bg-white/12"
                  >
                    Клубная лента владельца
                  </Link>
                  <div className="rounded-2xl border border-dashed border-white/20 p-3 text-xs text-white/55">
                    Следующий этап здесь сможет добавить AI-объяснения, но уже поверх устойчивого маршрута между кабинетом, профилем, продуктом и клубом.
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
            >
              <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
                <img src={CDN.family} alt="Семья на ферме" className="h-full min-h-[260px] w-full object-cover" />
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Ритм участия</p>
                  <h3 className="mt-2 text-2xl font-semibold text-foreground">Кабинет удерживает пользователя между животным, продуктом и жизнью фермы.</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Важное изменение этой итерации — owner dashboard больше не замыкается на красивой витрине. Теперь он начинает с текущего животного владельца и ведёт дальше в профиль, трекер и клуб как в единый маршрут, а каждый экран возвращает пользователя обратно в эту же систему.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    {[
                      {
                        icon: Waves,
                        label: "Живой ритм",
                        value: currentAnimal ? `${featuredAnimalName} в центре` : "Появится после выбора",
                      },
                      {
                        icon: Calendar,
                        label: "Следующий шаг",
                        value: nextSteps[0]?.title ?? "Открыть галерею",
                      },
                      {
                        icon: Star,
                        label: "Прозрачность",
                        value: productSummary?.currentDelivery?.status ?? "Через трекер",
                      },
                      {
                        icon: ArrowRight,
                        label: "Связанный маршрут",
                        value: currentAnimal ? "Dashboard → Profile → Tracker → Club" : "Gallery → Profile → Dashboard",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-2xl bg-secondary/55 p-4">
                          <Icon className="h-4 w-4 text-primary" />
                          <div className="mt-3 text-xs uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
                          <div className="mt-1 text-sm font-semibold text-foreground">{item.value}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Link href={featuredAnimalProfileHref} className="group rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                      <div className="font-semibold text-foreground">Вернуться к профилю животного</div>
                      <div className="mt-1 text-xs text-muted-foreground">Дневник, галерея и все owner-only действия начинаются отсюда</div>
                    </Link>
                    <Link href={trackerHref} className="group rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                      <div className="font-semibold text-foreground">Проверить трекер продукции</div>
                      <div className="mt-1 text-xs text-muted-foreground">Продолжить путь через прозрачность продукта и доставку</div>
                    </Link>
                    <Link href={clubHref} className="group rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                      <div className="font-semibold text-foreground">Открыть клубную ленту</div>
                      <div className="mt-1 text-xs text-muted-foreground">События, визиты и ритм возвращения к ферме остаются рядом</div>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
        {isGuestJourney ? (
          <div data-testid="dashboardGuestStickyRegister" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 sm:px-6">
            <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full border border-primary/15 bg-white/92 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-primary">Продолжить маршрут</p>
                <p className="truncate text-sm text-muted-foreground">Войдите, чтобы сохранить выбранный маршрут владельца и открыть кабинет участия.</p>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Зарегистрироваться
              </button>
            </div>
          </div>
        ) : null}
        {/* Auth Modal for guest registration */}
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          defaultView="register"
        />
      </div>
    </div>
  );
}
