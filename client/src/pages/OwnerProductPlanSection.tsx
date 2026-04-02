/*
 * OwnerProductPlanSection — Tier-Based Product Plan (Calculator Style)
 *
 * Workflow:
 * 1. Owner purchases animal → tier computed automatically
 * 2. Admin populates products from tier catalog → verifies them
 * 3. Owner configures plan with calculator-style sliders (like PricingCalculator)
 * 4. "What you get" table shows annual volumes
 * 5. Plan changes governed by tier frequency
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  FlaskConical,
  Loader2,
  Lock,
  MessageCircle,
  Milk,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import OwnerAdminChat from "@/components/OwnerAdminChat";

/* ── Types ── */

type CatalogItem = {
  id: number;
  productType: string;
  label: string;
  conversionRatio: number;
  unit: string;
  maxAnnualUnits: number;
  minTier: string;
  species: string;
  isEnabled: number;
  sortOrder: number;
};

type EnrichedSelection = {
  catalogItemId: number;
  label: string;
  annualUnits: number;
  unit: string;
  milkUsed: number;
};

type DeliveryEntry = {
  id: number;
  month: number;
  year: number;
  itemsJson: string;
  status: "planned" | "ready" | "delivered";
  adminNote: string | null;
};

/* ── Constants ── */

const TIER_LABELS: Record<string, string> = {
  basic: "Базовый",
  standard: "Стандартный",
  professional: "Профессиональный",
};

const TIER_COLORS: Record<string, string> = {
  basic: "border-stone-200 bg-stone-50 text-stone-700",
  standard: "border-blue-200 bg-blue-50 text-blue-700",
  professional: "border-amber-200 bg-amber-50 text-amber-700",
};

const TIER_ICONS: Record<string, typeof Crown> = {
  basic: ShieldCheck,
  standard: Sparkles,
  professional: Crown,
};

const TIER_FREQUENCY_LABELS: Record<string, string> = {
  basic: "1 раз в квартал",
  standard: "1 раз в месяц",
  professional: "1 раз в неделю",
};

const PRODUCT_COLORS: Record<string, string> = {
  milk: "bg-[oklch(0.55_0.18_145)]",
  smetana: "bg-[oklch(0.55_0.15_50)]",
  yogurt: "bg-[oklch(0.55_0.12_260)]",
  kefir: "bg-[oklch(0.55_0.10_310)]",
  cheese: "bg-[oklch(0.55_0.14_80)]",
  brynza: "bg-[oklch(0.50_0.12_30)]",
  kachotta: "bg-[oklch(0.45_0.10_20)]",
  halumi: "bg-[oklch(0.50_0.15_120)]",
  ricotta: "bg-[oklch(0.60_0.10_90)]",
  camembert: "bg-[oklch(0.48_0.12_60)]",
  aged_cheese: "bg-[oklch(0.42_0.10_40)]",
  blue_cheese: "bg-[oklch(0.45_0.14_250)]",
  smoked_cheese: "bg-[oklch(0.40_0.08_50)]",
  butter: "bg-[oklch(0.65_0.15_95)]",
  condensed_milk: "bg-[oklch(0.58_0.12_80)]",
  fermented_drink: "bg-[oklch(0.52_0.10_200)]",
  custom: "bg-[oklch(0.50_0.08_160)]",
};

const PRODUCT_TYPE_ICONS: Record<string, typeof Milk> = {
  milk: Milk,
  smetana: FlaskConical,
  yogurt: FlaskConical,
  kefir: FlaskConical,
  cheese: Package,
  brynza: Package,
  kachotta: Package,
  halumi: Package,
  ricotta: Package,
  camembert: Package,
  aged_cheese: Package,
  blue_cheese: Package,
  smoked_cheese: Package,
  butter: Package,
  condensed_milk: FlaskConical,
  fermented_drink: FlaskConical,
  custom: Package,
};

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово к получению",
  delivered: "Доставлено",
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  planned: "border-stone-200 bg-stone-50 text-stone-700",
  ready: "border-amber-200 bg-amber-50 text-amber-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  pending_admin_setup: "Ожидает настройки администратором",
  pending_owner_config: "Настройте ваш план",
  pending_approval: "Ожидает подтверждения фермой",
  confirmed: "План подтверждён",
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

/* ── Donut Chart Colors (raw hex for SVG) ── */

const DONUT_COLORS: Record<string, string> = {
  milk: "#3a9a4f",
  smetana: "#b87333",
  yogurt: "#5a6abf",
  kefir: "#9a5ab5",
  cheese: "#c4a030",
  brynza: "#a0522d",
  kachotta: "#8b4513",
  halumi: "#3aa05a",
  ricotta: "#a0a040",
  camembert: "#b08030",
  aged_cheese: "#7a5a30",
  blue_cheese: "#4a6ab0",
  smoked_cheese: "#6a5a40",
  butter: "#d4b040",
  condensed_milk: "#b0a040",
  fermented_drink: "#4a8a7a",
  custom: "#6a8a6a",
};

const DONUT_FALLBACK = "#94a3b8";

/* ── Donut Chart ── */

function ProductDonutChart({
  products,
  activeCount,
  totalCount,
}: {
  products: { catalogItemId: number; label: string; productType: string; percent: number; milkUsed: number }[];
  activeCount: number;
  totalCount: number;
}) {
  const active = products.filter((p) => p.percent > 0);
  const size = 200;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments
  let accumulated = 0;
  const segments = active.map((p) => {
    const segLen = (p.percent / 100) * circumference;
    const offset = circumference - accumulated;
    accumulated += segLen;
    return {
      ...p,
      dashArray: `${segLen} ${circumference - segLen}`,
      dashOffset: offset,
      color: DONUT_COLORS[p.productType] ?? DONUT_FALLBACK,
    };
  });

  // Unused portion
  const usedPercent = active.reduce((s, p) => s + p.percent, 0);
  const unusedPercent = Math.max(0, 100 - usedPercent);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/30"
            strokeWidth={strokeWidth}
          />
          {/* Unused segment */}
          {unusedPercent > 0 && unusedPercent < 100 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-muted/50"
              strokeWidth={strokeWidth}
              strokeDasharray={`${(unusedPercent / 100) * circumference} ${circumference - (unusedPercent / 100) * circumference}`}
              strokeDashoffset={circumference - accumulated}
              strokeLinecap="round"
            />
          )}
          {/* Product segments */}
          {segments.map((seg, i) => (
            <motion.circle
              key={seg.catalogItemId}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth - 2}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold text-foreground"
            key={activeCount}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {activeCount}
          </motion.span>
          <span className="text-xs text-muted-foreground mt-0.5">
            {activeCount === 1 ? "продукт" : activeCount >= 2 && activeCount <= 4 ? "продукта" : "продуктов"}
          </span>
        </div>
      </div>
      {/* Legend */}
      {active.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs w-full">
          {active.map((p) => (
            <div key={p.catalogItemId} className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: DONUT_COLORS[p.productType] ?? DONUT_FALLBACK }}
              />
              <span className="truncate text-muted-foreground">{p.label}</span>
              <span className="ml-auto font-semibold text-foreground shrink-0">{p.percent}%</span>
            </div>
          ))}
          {unusedPercent > 0 && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0 bg-muted/50" />
              <span className="truncate text-muted-foreground">Свободно</span>
              <span className="ml-auto font-semibold text-foreground shrink-0">{unusedPercent}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Milk Budget Bar ── */

function MilkBudgetBar({ used, total, allocPercent }: { used: number; total: number; allocPercent?: number }) {
  const pct = total > 0 ? Math.min(100, Math.floor((used / total) * 100)) : 0;
  const remaining = Math.floor(Math.max(0, total - used));
  const color = pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  const isTechLoss = remaining > 0 && (allocPercent ?? 0) >= 95;

  return (
    <div className="space-y-1.5">
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{Math.floor(used)} л использовано</span>
        <span>{isTechLoss ? `${remaining} л тех. потери` : `${remaining} л свободно`}</span>
      </div>
    </div>
  );
}

/* ── Tier Badge ── */

function TierBadge({ tierSlug }: { tierSlug: string }) {
  const Icon = TIER_ICONS[tierSlug] ?? ShieldCheck;
  return (
    <Badge className={`rounded-full border ${TIER_COLORS[tierSlug] ?? TIER_COLORS.basic}`}>
      <Icon className="mr-1 h-3 w-3" />
      {TIER_LABELS[tierSlug] ?? tierSlug}
    </Badge>
  );
}

/* ── Plan Change Countdown ── */

function PlanChangeCountdown({ nextChangeAt, tierSlug }: { nextChangeAt: string | Date | null; tierSlug: string }) {
  if (!nextChangeAt) return null;
  const nextDate = nextChangeAt instanceof Date ? nextChangeAt : new Date(nextChangeAt);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const canChange = daysLeft === 0;

  return (
    <div className={`rounded-xl border p-3 text-sm ${canChange ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-stone-50 text-stone-700"}`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        {canChange ? (
          <span className="font-medium">Вы можете изменить план прямо сейчас</span>
        ) : (
          <span>
            Следующее изменение через <span className="font-semibold">{daysLeft} дн.</span>
            <span className="text-xs ml-1">({TIER_FREQUENCY_LABELS[tierSlug] ?? ""})</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ── */

export default function OwnerProductPlanSection({
  animalId,
  animalSlug,
  animalName,
  mySharePercent,
  species,
}: {
  animalId: number;
  animalSlug: string;
  animalName: string;
  mySharePercent: number;
  species: "goat" | "sheep";
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Queries
  const profileQuery = trpc.productTrack.getProfile.useQuery({ animalId });
  const planQuery = trpc.productTrack.getMyPlan.useQuery({ animalId }, { staleTime: 0 });
  const tierQuery = trpc.productTrack.getMyTier.useQuery(undefined, { staleTime: 60_000 });
  // Check if admin has configured and verified products for this animal
  const verifiedOptionsQuery = trpc.productTrack.getVerifiedOptions.useQuery({ animalId }, { staleTime: 30_000 });
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Get tier catalog based on owner's tier
  const tierSlug = tierQuery.data?.tierSlug ?? "basic";
  const catalogQuery = trpc.productTrack.getMyTierCatalog.useQuery(
    { species },
    { enabled: Boolean(tierQuery.data), staleTime: 60_000 },
  );

  const scheduleQuery = trpc.productTrack.getSchedule.useQuery(
    { ownerOpenId: user?.openId ?? "", animalId, year: currentYear },
    { enabled: Boolean(user?.openId) && Boolean(planQuery.data?.id) && planQuery.data?.status === "confirmed", staleTime: 0 },
  );

  // Check if plan change is allowed
  const canChangeQuery = trpc.productTrack.canChangePlan.useQuery(
    { planId: planQuery.data?.id ?? 0 },
    { enabled: Boolean(planQuery.data?.id) && planQuery.data?.status === "confirmed", staleTime: 30_000 },
  );

  // Mutations
  const configurePlan = trpc.productTrack.ownerConfigurePlan.useMutation({
    onSuccess: () => {
      utils.productTrack.getMyPlan.invalidate({ animalId });
      utils.productTrack.getSchedule.invalidate();
      toast.success("План отправлен на подтверждение", {
        description: "Ферма рассмотрит ваш план и подтвердит его.",
      });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const requestChange = trpc.productTrack.requestPlanChange.useMutation({
    onSuccess: () => {
      utils.productTrack.getMyPlan.invalidate({ animalId });
      utils.productTrack.canChangePlan.invalidate();
      toast.success("План открыт для изменения");
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // Local state: allocation as percentage per catalog item
  const [allocPercent, setAllocPercent] = useState<Record<number, number>>({});

  const profile = profileQuery.data;
  const catalog = useMemo(() => ((catalogQuery.data ?? []) as CatalogItem[]).filter(c => c.isEnabled), [catalogQuery.data]);
  const existingPlan = planQuery.data;
  const schedule = (scheduleQuery.data ?? []) as DeliveryEntry[];

  // Calculate milk budget for this owner's share
  const annualMilkBudget = profile ? Math.floor((profile.annualMilkLiters * mySharePercent) / 100) : 0;

  // Total allocation percentage
  const totalAllocPercent = useMemo(() => {
    return Object.values(allocPercent).reduce((s, v) => s + v, 0);
  }, [allocPercent]);

  // Calculate product outputs from allocation percentages
  const productOutputs = useMemo(() => {
    return catalog.map((item) => {
      const pct = allocPercent[item.id] ?? 0;
      const milkAllocated = (annualMilkBudget * pct) / 100;
      // Integer annual units (rounded down)
      const annualUnits = item.conversionRatio > 0 ? Math.floor(milkAllocated / item.conversionRatio) : 0;
      // Recalculate actual milk used from integer units
      const milkUsed = annualUnits * item.conversionRatio;
      return {
        catalogItemId: item.id,
        label: item.label,
        productType: item.productType,
        unit: item.unit,
        percent: pct,
        milkUsed,
        annualUnits,
        conversionRatio: item.conversionRatio,
      };
    });
  }, [catalog, allocPercent, annualMilkBudget]);

  // Total milk used
  const totalMilkUsed = useMemo(() => {
    return productOutputs.reduce((s, p) => s + p.milkUsed, 0);
  }, [productOutputs]);

  // Initialize allocPercent from existing plan selections
  useEffect(() => {
    if (catalog.length === 0) return;

    // Try to restore from saved selections
    if (existingPlan?.selectionsJson) {
      try {
        const parsed = JSON.parse(existingPlan.selectionsJson) as EnrichedSelection[];
        if (parsed.length > 0) {
          const totalMilkInPlan = parsed.reduce((s, sel) => s + (sel.milkUsed ?? 0), 0);
          if (totalMilkInPlan > 0 && annualMilkBudget > 0) {
            const newAlloc: Record<number, number> = {};
            for (const sel of parsed) {
              if (sel.milkUsed > 0) {
                newAlloc[sel.catalogItemId] = Math.floor((sel.milkUsed / annualMilkBudget) * 100);
              }
            }
            setAllocPercent(newAlloc);
            return;
          }
          // Fallback: distribute from annualUnits * conversionRatio
          const newAlloc: Record<number, number> = {};
          let hasAny = false;
          for (const sel of parsed) {
            const item = catalog.find(c => c.id === sel.catalogItemId);
            if (item && sel.annualUnits > 0) {
              const milkUsed = sel.annualUnits * item.conversionRatio;
              newAlloc[sel.catalogItemId] = annualMilkBudget > 0 ? Math.floor((milkUsed / annualMilkBudget) * 100) : 0;
              hasAny = true;
            }
          }
          if (hasAny) {
            setAllocPercent(newAlloc);
            return;
          }
        }
      } catch {
        // fall through to default distribution
      }
    }

    // Default: distribute evenly among first 5 products when plan is pending owner config
    if (existingPlan?.status === "pending_owner_config") {
      const items = catalog.slice(0, Math.min(5, catalog.length));
      const each = Math.floor(100 / items.length);
      const newAlloc: Record<number, number> = {};
      items.forEach((item, i) => {
        newAlloc[item.id] = i === items.length - 1 ? 100 - each * (items.length - 1) : each;
      });
      setAllocPercent(newAlloc);
    }
  }, [existingPlan?.selectionsJson, existingPlan?.status, catalog, annualMilkBudget]);

  // Allocation slider handler (proportional redistribution like PricingCalculator)
  const handleAllocChange = useCallback(
    (itemId: number, newVal: number) => {
      setAllocPercent((prev) => {
        const others = Object.entries(prev).filter(([k]) => Number(k) !== itemId);
        const othersTotal = others.reduce((s, [, v]) => s + v, 0);
        const remaining = 100 - newVal;

        if (othersTotal === 0) {
          const each = others.length > 0 ? Math.floor(remaining / others.length) : 0;
          const result: Record<number, number> = { [itemId]: newVal };
          others.forEach(([k], i) => {
            result[Number(k)] = i === others.length - 1 ? remaining - each * (others.length - 1) : each;
          });
          return result;
        }

        const result: Record<number, number> = { [itemId]: newVal };
        let distributed = 0;
        others.forEach(([k, v], i) => {
          if (i === others.length - 1) {
            result[Number(k)] = Math.max(0, remaining - distributed);
          } else {
            const scaled = Math.floor((v / othersTotal) * remaining);
            result[Number(k)] = Math.max(0, scaled);
            distributed += result[Number(k)];
          }
        });
        return result;
      });
    },
    [],
  );

  const handleSubmit = () => {
    if (Object.values(allocPercent).every(v => v === 0)) {
      toast.error("Выберите хотя бы один продукт");
      return;
    }
    const selArray = productOutputs
      .filter(p => p.annualUnits > 0)
      .map(p => ({
        catalogItemId: p.catalogItemId,
        annualUnits: Math.floor(p.annualUnits),
      }));
    if (!existingPlan?.id) {
      toast.error("План не найден");
      return;
    }
    configurePlan.mutate({ planId: existingPlan.id, selections: selArray });
  };

  const handleRequestChange = () => {
    if (!existingPlan?.id) return;
    requestChange.mutate({ planId: existingPlan.id });
  };

  // Check if admin has verified products for this animal
  const hasVerifiedProducts = (verifiedOptionsQuery.data ?? []).length > 0;
  // Treat pending_owner_config with no verified products as effectively pending_admin_setup
  const rawStatus = existingPlan?.status;
  const effectiveStatus = (rawStatus === "pending_owner_config" && !hasVerifiedProducts) ? "pending_admin_setup" : rawStatus;
  const isPendingAdminSetup = effectiveStatus === "pending_admin_setup";
  const isPendingOwnerConfig = effectiveStatus === "pending_owner_config";
  const isPendingApproval = effectiveStatus === "pending_approval";
  const isConfirmed = effectiveStatus === "confirmed";
  const isLocked = isConfirmed || isPendingApproval;
  const isLoading = profileQuery.isLoading || planQuery.isLoading || tierQuery.isLoading || verifiedOptionsQuery.isLoading;

  // Don't show if no production profile configured
  if (!isLoading && !profile) return null;

  // Active products (those with allocation > 0)
  const activeProducts = productOutputs.filter(p => p.annualUnits > 0);

  return (
    <section id="product-plan" className="border-b border-border/60 py-10 md:py-14">
      <div className="container">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header with Tier Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">Продуктовый план</h2>
            {tierQuery.data && <TierBadge tierSlug={tierSlug} />}
            {isPendingAdminSetup && (
              <Badge className="rounded-full border-orange-200 bg-orange-50 text-orange-700">
                <Clock className="mr-1 h-3 w-3" /> Ожидает настройки
              </Badge>
            )}
            {isPendingOwnerConfig && (
              <Badge className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                <Sparkles className="mr-1 h-3 w-3" /> Настройте план
              </Badge>
            )}
            {isPendingApproval && (
              <Badge className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Ожидает подтверждения
              </Badge>
            )}
            {isConfirmed && (
              <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> План подтверждён
              </Badge>
            )}
          </div>

          {isLoading ? (
            <Card className="rounded-2xl border-border/70">
              <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Загружаем продуктовый план…
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Status messages */}
              {isPendingAdminSetup && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                  <p className="font-medium">Ожидает настройки администратором</p>
                  <p className="mt-1 text-xs text-orange-700">
                    Ваш тариф определён. Администратор фермы формирует набор доступных продуктов.
                    Вы получите уведомление, когда сможете настроить свой план.
                  </p>
                </div>
              )}

              {isPendingApproval && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="font-medium">План отправлен на подтверждение</p>
                  <p className="mt-1 text-xs text-blue-700">
                    Ферма рассмотрит ваш выбор и подтвердит план. После подтверждения будет сформирован график доставки.
                  </p>
                </div>
              )}

              {/* No plan exists yet */}
              {!existingPlan && profile && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                  <p className="font-medium">Продуктовый план ещё не создан</p>
                  <p className="mt-1 text-xs text-stone-600">
                    Администратор фермы создаст ваш продуктовый план после настройки доступных продуктов.
                    Вы получите уведомление, когда план будет готов к настройке.
                  </p>
                </div>
              )}

              {/* ─── Calculator Layout: Config Left + Results Right ─── */}
              {(isPendingOwnerConfig || isLocked || isPendingApproval) && profile && (
                <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
                  {/* ─── LEFT: Configuration Panel ─── */}
                  <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
                    {/* Tier info */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                        tierSlug === "professional" ? "bg-amber-100 text-amber-700" :
                        tierSlug === "standard" ? "bg-blue-100 text-blue-700" :
                        "bg-stone-100 text-stone-700"
                      }`}>
                        {(() => { const Icon = TIER_ICONS[tierSlug] ?? ShieldCheck; return <Icon className="h-5 w-5" />; })()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Тариф: {TIER_LABELS[tierSlug] ?? tierSlug}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Частота изменения: {TIER_FREQUENCY_LABELS[tierSlug] ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* Milk budget indicator */}
                    <div className="flex items-center justify-center mb-6">
                      <div className="rounded-full bg-primary/10 px-6 py-3 text-center">
                        <span className="text-2xl font-bold text-primary">{annualMilkBudget} л</span>
                        <span className="text-xs text-muted-foreground block">молочный бюджет в год</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({mySharePercent}% от {animalName})
                        </span>
                      </div>
                    </div>

                    {/* Milk budget bar */}
                    <div className="mb-6">
                      <MilkBudgetBar used={totalMilkUsed} total={annualMilkBudget} allocPercent={totalAllocPercent} />
                    </div>

                    {/* Allocation label */}
                    <label className="text-sm font-semibold text-foreground mb-1 block">
                      Распределение баланса молока
                    </label>
                    <p className="text-xs text-muted-foreground mb-5">
                      Перемещайте слайдеры, чтобы распределить молоко между продуктами вашего тарифа
                    </p>

                    {/* Allocation sliders */}
                    <div className="space-y-4 mb-6">
                      {catalog.map((item) => {
                        const val = allocPercent[item.id] ?? 0;
                        const colorClass = PRODUCT_COLORS[item.productType] ?? PRODUCT_COLORS.custom;
                        const Icon = PRODUCT_TYPE_ICONS[item.productType] ?? Package;

                        return (
                          <div key={item.id} className="flex items-center gap-3">
                            <div className={`h-3 w-3 rounded-full shrink-0 ${colorClass}`} />
                            <div className="flex items-center gap-1.5 w-52 shrink-0">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm text-foreground truncate">{item.label}</span>
                            </div>
                            <Slider
                              value={[val]}
                              min={0}
                              max={80}
                              step={5}
                              onValueChange={([v]) => handleAllocChange(item.id, v)}
                              disabled={isLocked || isPendingApproval}
                              className="flex-1"
                            />
                            <span className="text-sm font-semibold text-foreground w-10 text-right">{val}%</span>
                          </div>
                        );
                      })}
                    </div>

                    {(totalAllocPercent < 95 || totalAllocPercent > 100) && totalAllocPercent > 0 && (
                      <p className="mb-4 text-xs text-destructive">
                        Сумма: {totalAllocPercent}% (должна быть 95–100%)
                      </p>
                    )}

                    {/* "What you get" table */}
                    {activeProducts.length > 0 && (
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-3 block">
                          Что вы получите за год
                        </label>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-left">
                                <th className="py-2 font-semibold text-muted-foreground">Продукт</th>
                                <th className="py-2 font-semibold text-muted-foreground text-right">Молоко</th>
                                <th className="py-2 font-semibold text-muted-foreground text-right">Объём/год</th>
                                <th className="py-2 font-semibold text-muted-foreground text-right">Доставка</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeProducts.map((p) => (
                                <tr key={p.catalogItemId} className="border-b border-border/50">
                                  <td className="py-2 text-foreground">
                                    <div className="flex items-center gap-2">
                                      <div className={`h-2.5 w-2.5 rounded-full ${PRODUCT_COLORS[p.productType] ?? PRODUCT_COLORS.custom}`} />
                                      {p.label}
                                    </div>
                                  </td>
                                  <td className="py-2 text-right text-muted-foreground">
                                    {Math.floor(p.milkUsed)} л
                                  </td>
                                  <td className="py-2 text-right font-semibold text-primary">
                                    {Math.floor(p.annualUnits)} {p.unit}
                                  </td>
                                  <td className="py-2 text-right text-xs text-muted-foreground">
                                    {Math.floor(p.annualUnits / 12) >= 1
                                      ? <>{Math.floor(p.annualUnits / 12)} {p.unit}/мес</>
                                      : <span className="text-amber-600">{Math.floor(p.annualUnits / 4)} {p.unit}/кварт.</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td className="py-2 font-bold text-foreground">Итого молока</td>
                                <td className="py-2 text-right font-bold text-primary">
                  {Math.floor(totalMilkUsed)} л
                </td>
                                <td></td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Submit button */}
                    {isPendingOwnerConfig && (
                      <div className="flex items-center gap-4 pt-4">
                        <Button
                          onClick={handleSubmit}
                          disabled={configurePlan.isPending || activeProducts.length === 0 || totalAllocPercent < 95 || totalAllocPercent > 100}
                          className="rounded-full"
                        >
                          {configurePlan.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Отправить на подтверждение
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          После отправки ферма рассмотрит ваш план.
                        </p>
                      </div>
                    )}

                    {/* Admin notes — only show meaningful notes, not stale reset messages */}
                    {isConfirmed && existingPlan?.adminNotes && 
                     !existingPlan.adminNotes.toLowerCase().includes("сброшен") && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700 mt-4">
                        <p className="font-medium">Заметка фермы:</p>
                        <p className="mt-1 text-xs">{existingPlan.adminNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* ─── RIGHT: Results Panel (sticky) ─── */}
                  <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                    {/* Milk budget hero */}
                    <div className="rounded-2xl bg-primary p-5 text-center text-primary-foreground">
                      <p className="text-sm font-medium opacity-80">Молочный бюджет</p>
                      <p className="text-4xl font-bold mt-1">{annualMilkBudget} л</p>
                      <p className="text-sm font-semibold mt-1">в год</p>
                      <p className="text-xs opacity-70 mt-1">
                        {Math.floor(annualMilkBudget / 12)} л/мес
                      </p>
                    </div>

                    {/* Compact plan summary */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Сводка плана
                      </p>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Выбрано продуктов</span>
                          <span className="font-bold text-lg text-primary">{activeProducts.length} <span className="text-xs font-normal text-muted-foreground">из {catalog.length}</span></span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Использовано молока</span>
                          <span className="font-bold text-lg text-foreground">{Math.floor(totalMilkUsed)} л</span>
                        </div>
                        {(() => {
                          const remainder = Math.floor(annualMilkBudget - totalMilkUsed);
                          if (remainder > 0 && totalAllocPercent >= 95) {
                            // Small remainder from rounding → tech losses
                            return (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Тех. потери</span>
                                <span className="font-medium text-muted-foreground">{remainder} л</span>
                              </div>
                            );
                          }
                          if (remainder > 0) {
                            return (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Свободно</span>
                                <span className="font-bold text-lg text-emerald-600">{remainder} л</span>
                              </div>
                            );
                          }
                          if (remainder < 0) {
                            return (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Превышение</span>
                                <span className="font-bold text-lg text-destructive">{Math.abs(remainder)} л</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${totalMilkUsed > annualMilkBudget ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${Math.min((totalMilkUsed / annualMilkBudget) * 100, 100)}%` }}
                          />
                        </div>
                        {totalAllocPercent > 0 && totalAllocPercent < 95 && (
                          <p className="text-xs text-amber-600">Распределено {totalAllocPercent}% — добавьте ещё продуктов</p>
                        )}
                        {totalAllocPercent >= 95 && activeProducts.length > 0 && (
                          <p className="text-xs text-emerald-600">План полностью настроен ✓</p>
                        )}
                      </div>
                    </div>

                    {/* Product Donut Chart */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Распределение продуктов
                      </p>
                      <ProductDonutChart
                        products={productOutputs}
                        activeCount={activeProducts.length}
                        totalCount={catalog.length}
                      />
                    </div>

                    {/* Tier privileges */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Привилегии тарифа
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Тариф</span>
                          <span className="font-semibold text-foreground">{TIER_LABELS[tierSlug]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Изменение плана</span>
                          <span className="font-semibold text-foreground">{TIER_FREQUENCY_LABELS[tierSlug]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Доступно продуктов</span>
                          <span className="font-semibold text-foreground">{catalog.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Plan change section */}
                    {isConfirmed && canChangeQuery.data && (
                      <div className="rounded-2xl border border-border bg-card p-5">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                          Изменение плана
                        </p>
                        <PlanChangeCountdown
                          nextChangeAt={canChangeQuery.data.nextChangeAt}
                          tierSlug={tierSlug}
                        />
                        {canChangeQuery.data.allowed && (
                          <Button
                            onClick={handleRequestChange}
                            disabled={requestChange.isPending}
                            variant="outline"
                            className="rounded-full w-full mt-3"
                          >
                            {requestChange.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Изменить план
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery Schedule */}
              {isConfirmed && schedule.length > 0 && (
                <Card className="rounded-2xl border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                      График доставки — {currentYear}
                    </CardTitle>
                    <CardDescription>
                      Равномерное распределение продукции по месяцам
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollRemaining totalItems={schedule.length} itemHeight={140} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[520px] overflow-y-auto pr-1">
                      {schedule.map((entry) => {
                        let items: Array<{ label: string; quantity: number; unit: string; frequency?: string }> = [];
                        try { items = JSON.parse(entry.itemsJson); } catch {}

                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-border/70 bg-card p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-semibold text-foreground">{MONTH_NAMES[entry.month - 1]}</p>
                              <Badge className={`rounded-full border text-[10px] ${DELIVERY_STATUS_COLORS[entry.status]}`}>
                                {entry.status === "delivered" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                {entry.status === "ready" && <Truck className="mr-1 h-3 w-3" />}
                                {DELIVERY_STATUS_LABELS[entry.status]}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              {items.filter(item => item.quantity > 0).map((item, idx) => (
                                <p key={idx} className="text-xs text-muted-foreground">
                                  {item.label}: <span className="font-medium text-foreground">{item.quantity} {item.unit}</span>
                                  {item.frequency === "quarterly" && <span className="text-[10px] text-amber-600 ml-1">(раз в квартал)</span>}
                                </p>
                              ))}
                              {items.filter(item => item.quantity > 0).length === 0 && (
                                <p className="text-xs text-muted-foreground italic">Нет доставок в этом месяце</p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </ScrollRemaining>
                  </CardContent>
                </Card>
              )}

              {/* Chat with farm */}
              {(isLocked || isPendingApproval) && user?.openId && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Чат с фермой
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Обсудите детали доставки или изменения плана напрямую с фермой.
                  </p>
                  <OwnerAdminChat
                    animalId={animalId}
                    ownerOpenId={user.openId}
                    animalName={animalName}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
