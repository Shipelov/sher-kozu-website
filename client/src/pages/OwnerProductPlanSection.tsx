/**
 * OwnerProductPlanSection — Tier-Based Product Plan
 *
 * New workflow:
 * 1. Owner purchases animal → tier is computed automatically
 * 2. Admin generates product catalog for the tier and verifies it
 * 3. Owner receives notification → configures their plan from tier catalog
 * 4. Admin approves → delivery schedule generated
 * 5. Plan changes governed by tier frequency (basic=quarterly, standard=monthly, professional=weekly)
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

type TierInfo = {
  tierSlug: string;
  changeFrequencyDays: number;
};

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

/* ── Milk Budget Bar ── */

function MilkBudgetBar({ used, total, label }: { used: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const remaining = Math.max(0, total - used);
  const color = pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>}
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used} л выбрано</span>
        <span>{remaining} л свободно</span>
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

/* ── Product Selection Card (Tier Catalog) ── */

function CatalogSelectionCard({
  item,
  value,
  maxByBudget,
  onChange,
  disabled,
}: {
  item: CatalogItem;
  value: number;
  maxByBudget: number;
  onChange: (units: number) => void;
  disabled: boolean;
}) {
  const Icon = PRODUCT_TYPE_ICONS[item.productType] ?? Package;
  const milkUsed = value * item.conversionRatio;
  const effectiveMax = Math.min(item.maxAnnualUnits, maxByBudget);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 transition-colors ${
        value > 0 ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${value > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{item.label}</h4>
          <p className="text-xs text-muted-foreground">
            {item.conversionRatio} л молока → 1 {item.unit}
          </p>
        </div>
        {value > 0 && (
          <Badge className="rounded-full border-primary/20 bg-primary/10 text-primary">
            {value} {item.unit}
          </Badge>
        )}
      </div>

      {!disabled && effectiveMax > 0 && (
        <div className="space-y-3">
          <Slider
            value={[value]}
            min={0}
            max={effectiveMax}
            step={1}
            onValueChange={([v]) => onChange(v)}
            disabled={disabled}
            className="py-1"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 {item.unit}</span>
            <span className="font-medium text-foreground">{value} {item.unit} · {milkUsed} л молока</span>
            <span>{effectiveMax} {item.unit}</span>
          </div>
        </div>
      )}

      {disabled && value > 0 && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>{value} {item.unit}/год · {milkUsed} л молока</span>
        </div>
      )}
    </motion.div>
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
}: {
  animalId: number;
  animalSlug: string;
  animalName: string;
  mySharePercent: number;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Queries
  const profileQuery = trpc.productTrack.getProfile.useQuery({ animalId });
  const planQuery = trpc.productTrack.getMyPlan.useQuery({ animalId }, { staleTime: 0 });
  const tierQuery = trpc.productTrack.getMyTier.useQuery(undefined, { staleTime: 60_000 });
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Get tier catalog based on owner's tier
  const tierSlug = tierQuery.data?.tierSlug ?? "basic";
  const catalogQuery = trpc.productTrack.getMyTierCatalog.useQuery(
    { species: undefined },
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
        description: "Ферма рассмотрит ваш план и подтвердит его. После подтверждения будет сформирован график доставки.",
      });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const requestChange = trpc.productTrack.requestPlanChange.useMutation({
    onSuccess: () => {
      utils.productTrack.getMyPlan.invalidate({ animalId });
      utils.productTrack.canChangePlan.invalidate();
      toast.success("План открыт для изменения", {
        description: "Настройте новый набор продуктов.",
      });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // Local state for selections
  const [selections, setSelections] = useState<Map<number, number>>(new Map());

  const profile = profileQuery.data;
  const catalog = (catalogQuery.data ?? []) as CatalogItem[];
  const existingPlan = planQuery.data;
  const schedule = (scheduleQuery.data ?? []) as DeliveryEntry[];

  // Calculate milk budget for this owner's share
  const annualMilkBudget = profile ? Math.floor((profile.annualMilkLiters * mySharePercent) / 100) : 0;

  // Calculate total milk used by current selections
  const totalMilkUsed = useMemo(() => {
    let total = 0;
    selections.forEach((units, catalogItemId) => {
      const item = catalog.find((c) => c.id === catalogItemId);
      if (item) total += units * item.conversionRatio;
    });
    return total;
  }, [selections, catalog]);

  // Initialize selections from existing plan
  useEffect(() => {
    if (existingPlan?.selectionsJson) {
      try {
        const parsed = JSON.parse(existingPlan.selectionsJson) as EnrichedSelection[];
        const map = new Map<number, number>();
        for (const sel of parsed) {
          if (sel.annualUnits > 0) {
            map.set(sel.catalogItemId, sel.annualUnits);
          }
        }
        setSelections(map);
      } catch {
        setSelections(new Map());
      }
    } else {
      setSelections(new Map());
    }
  }, [existingPlan?.selectionsJson, existingPlan?.status]);

  const handleSelectionChange = useCallback(
    (catalogItemId: number, units: number) => {
      setSelections((prev) => {
        const next = new Map(prev);
        if (units <= 0) {
          next.delete(catalogItemId);
        } else {
          next.set(catalogItemId, units);
        }
        return next;
      });
    },
    [],
  );

  const handleSubmit = () => {
    if (selections.size === 0) {
      toast.error("Выберите хотя бы один продукт");
      return;
    }
    const selArray: Array<{ catalogItemId: number; annualUnits: number }> = [];
    selections.forEach((annualUnits, catalogItemId) => {
      selArray.push({ catalogItemId, annualUnits });
    });
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

  const isPendingAdminSetup = existingPlan?.status === "pending_admin_setup";
  const isPendingOwnerConfig = existingPlan?.status === "pending_owner_config";
  const isPendingApproval = existingPlan?.status === "pending_approval";
  const isConfirmed = existingPlan?.status === "confirmed";
  const isLocked = isConfirmed || isPendingApproval;
  const isLoading = profileQuery.isLoading || planQuery.isLoading || tierQuery.isLoading;

  // Don't show if no production profile configured
  if (!isLoading && !profile) return null;

  return (
    <section id="product-plan" className="border-b border-border/60 py-10 md:py-14">
      <div className="container">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header with Tier Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">Мои продукты</h2>
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
                <Lock className="mr-1 h-3 w-3" /> План подтверждён
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
              {/* Tier Info Card */}
              {tierQuery.data && (
                <Card className="rounded-2xl border-border/70 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${TIER_COLORS[tierSlug]?.replace("border-", "bg-").replace("text-", "text-") ?? "bg-stone-100"}`}>
                        {(() => { const Icon = TIER_ICONS[tierSlug] ?? ShieldCheck; return <Icon className="h-6 w-6" />; })()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          Тариф: {TIER_LABELS[tierSlug] ?? tierSlug}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Частота изменения плана: {TIER_FREQUENCY_LABELS[tierSlug] ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Продукты формируются автоматически на основе вашего тарифа
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status-specific messages */}
              {isPendingAdminSetup && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                  <p className="font-medium">⏳ Ожидает настройки администратором</p>
                  <p className="mt-1 text-xs text-orange-700">
                    Ваш тариф определён. Администратор фермы формирует набор доступных продуктов.
                    Вы получите уведомление, когда сможете настроить свой план.
                  </p>
                </div>
              )}

              {isPendingApproval && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="font-medium">⏳ План отправлен на подтверждение</p>
                  <p className="mt-1 text-xs text-blue-700">
                    Ферма рассмотрит ваш выбор и подтвердит план. После подтверждения будет сформирован график доставки.
                  </p>
                </div>
              )}

              {/* Milk Budget */}
              {(isPendingOwnerConfig || isLocked) && profile && (
                <Card className="rounded-2xl border-border/70 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Milk className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-foreground">Молочный бюджет</h3>
                        <p className="text-xs text-muted-foreground">
                          Ваша доля {mySharePercent}% от {animalName} = {annualMilkBudget} литров молока в год
                        </p>
                      </div>
                    </div>
                    <MilkBudgetBar used={totalMilkUsed} total={annualMilkBudget} />
                  </CardContent>
                </Card>
              )}

              {/* Product Selection / View */}
              {(isPendingOwnerConfig || isLocked || isPendingApproval) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {isPendingOwnerConfig ? "Выберите продукты из каталога" : "Ваш продуктовый план"}
                  </h3>

                  {isPendingOwnerConfig && (
                    <p className="text-sm text-muted-foreground">
                      Распределите молочный бюджет между доступными продуктами вашего тарифа.
                    </p>
                  )}

                  {isConfirmed && existingPlan?.adminNotes && (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                      <p className="font-medium">Заметка фермы:</p>
                      <p className="mt-1 text-xs">{existingPlan.adminNotes}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {catalog.filter(c => c.isEnabled).map((item) => {
                      const currentValue = selections.get(item.id) ?? 0;
                      const milkUsedByOthers = totalMilkUsed - currentValue * item.conversionRatio;
                      const remainingMilk = annualMilkBudget - milkUsedByOthers;
                      const maxByBudget = Math.max(0, Math.floor(remainingMilk / item.conversionRatio));

                      return (
                        <CatalogSelectionCard
                          key={item.id}
                          item={item}
                          value={currentValue}
                          maxByBudget={maxByBudget}
                          onChange={(units) => handleSelectionChange(item.id, units)}
                          disabled={Boolean(isLocked || isPendingApproval)}
                        />
                      );
                    })}
                  </div>

                  {isPendingOwnerConfig && (
                    <div className="flex items-center gap-4 pt-2">
                      <Button
                        onClick={handleSubmit}
                        disabled={configurePlan.isPending || selections.size === 0}
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
                        После отправки ферма рассмотрит ваш план и подтвердит его.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Plan Change Section (for confirmed plans) */}
              {isConfirmed && canChangeQuery.data && (
                <Card className="rounded-2xl border-border/70 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      Изменение плана
                    </h3>
                    <PlanChangeCountdown
                      nextChangeAt={canChangeQuery.data.nextChangeAt}
                      tierSlug={tierSlug}
                    />
                    {canChangeQuery.data.allowed && (
                      <Button
                        onClick={handleRequestChange}
                        disabled={requestChange.isPending}
                        variant="outline"
                        className="rounded-full"
                      >
                        {requestChange.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Изменить план
                      </Button>
                    )}
                  </CardContent>
                </Card>
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
                      Равномерное распределение продукции по месяцам. Статус обновляется фермой.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollRemaining totalItems={schedule.length} itemHeight={140} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[520px] overflow-y-auto pr-1">
                      {schedule.map((entry) => {
                        let items: Array<{ label: string; quantity: number; unit: string }> = [];
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
                              {items.map((item, idx) => (
                                <p key={idx} className="text-xs text-muted-foreground">
                                  {item.label}: <span className="font-medium text-foreground">{item.quantity} {item.unit}</span>
                                </p>
                              ))}
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
