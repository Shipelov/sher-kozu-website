/**
 * OwnerProductPlanSection
 *
 * Embedded section in AnimalProfile for owners to:
 * 1. View available products and milk budget
 * 2. Select their product plan (first time only)
 * 3. View confirmed plan (read-only after confirmation)
 * 4. View delivery schedule
 *
 * After first confirmation, changes are only possible through admin.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Lock,
  MessageCircle,
  Milk,
  Package,
  Pencil,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import OwnerAdminChat from "@/components/OwnerAdminChat";

/* ── Types ── */

type ProductType = "milk" | "smetana" | "yogurt" | "kefir" | "cheese";

type ProductOption = {
  id: number;
  animalId: number;
  productType: ProductType;
  label: string;
  conversionRatio: number;
  unit: string;
  maxAnnualUnits: number;
  isEnabled: number;
  sortOrder: number;
};

type Selection = {
  productOptionId: number;
  annualUnits: number;
};

type EnrichedSelection = {
  productOptionId: number;
  productType: string;
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

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  milk: "Молоко",
  smetana: "Сметана",
  yogurt: "Йогурт",
  kefir: "Кефир",
  cheese: "Сыр",
};

const PRODUCT_TYPE_ICONS: Record<ProductType, typeof Milk> = {
  milk: Milk,
  smetana: FlaskConical,
  yogurt: FlaskConical,
  kefir: FlaskConical,
  cheese: Package,
};

const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

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

/* ── Product Selection Card ── */

function ProductSelectionCard({
  option,
  value,
  maxByBudget,
  onChange,
  disabled,
}: {
  option: ProductOption;
  value: number;
  maxByBudget: number;
  onChange: (units: number) => void;
  disabled: boolean;
}) {
  const Icon = PRODUCT_TYPE_ICONS[option.productType] ?? Package;
  const milkUsed = value * option.conversionRatio;
  const effectiveMax = Math.min(option.maxAnnualUnits, maxByBudget);

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
          <h4 className="font-semibold text-foreground">{option.label}</h4>
          <p className="text-xs text-muted-foreground">
            {PRODUCT_TYPE_LABELS[option.productType]} · {option.conversionRatio} л молока → 1 {option.unit}
          </p>
        </div>
        {value > 0 && (
          <Badge className="rounded-full border-primary/20 bg-primary/10 text-primary">
            {value} {option.unit}
          </Badge>
        )}
      </div>

      {!disabled && (
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
            <span>0 {option.unit}</span>
            <span className="font-medium text-foreground">{value} {option.unit} · {milkUsed} л молока</span>
            <span>{effectiveMax} {option.unit}</span>
          </div>
        </div>
      )}

      {disabled && value > 0 && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>{value} {option.unit}/год · {milkUsed} л молока</span>
        </div>
      )}
    </motion.div>
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
  const optionsQuery = trpc.productTrack.listOptions.useQuery({ animalId });
  const planQuery = trpc.productTrack.getMyPlan.useQuery({ animalId }, { staleTime: 0 });
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const scheduleQuery = trpc.productTrack.getSchedule.useQuery(
    { ownerOpenId: user?.openId ?? "", animalId, year: currentYear },
    { enabled: Boolean(user?.openId) && Boolean(planQuery.data?.id), staleTime: 0 },
  );

  // Mutations
  const confirmPlan = trpc.productTrack.confirmPlan.useMutation({
    onSuccess: () => {
      utils.productTrack.getMyPlan.invalidate({ animalId });
      utils.productTrack.getSchedule.invalidate();
      toast.success("Продуктовый план подтверждён", {
        description: "График доставки сформирован. Изменения возможны через чат с фермой.",
      });
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // Local state for selections
  const [selections, setSelections] = useState<Map<number, number>>(new Map());

  const profile = profileQuery.data;
  const options = (optionsQuery.data ?? []).filter((o: any) => o.isEnabled) as ProductOption[];
  const existingPlan = planQuery.data;
  const schedule = (scheduleQuery.data ?? []) as DeliveryEntry[];

  // Calculate milk budget for this owner's share
  const annualMilkBudget = profile ? Math.floor((profile.annualMilkLiters * mySharePercent) / 100) : 0;

  // Calculate total milk used by current selections
  const totalMilkUsed = useMemo(() => {
    let total = 0;
    selections.forEach((units, optionId) => {
      const opt = options.find((o) => o.id === optionId);
      if (opt) total += units * opt.conversionRatio;
    });
    return total;
  }, [selections, options]);

  // Initialize selections from existing plan (or clear them on reset)
  useEffect(() => {
    if (existingPlan?.selectionsJson) {
      try {
        const parsed = JSON.parse(existingPlan.selectionsJson) as EnrichedSelection[];
        const map = new Map<number, number>();
        for (const sel of parsed) {
          if (sel.annualUnits > 0) {
            map.set(sel.productOptionId, sel.annualUnits);
          }
        }
        setSelections(map);
      } catch {
        setSelections(new Map());
      }
    } else {
      // No plan or empty selections — start fresh
      setSelections(new Map());
    }
  }, [existingPlan?.selectionsJson, existingPlan?.status]);

  const handleSelectionChange = useCallback(
    (optionId: number, units: number) => {
      setSelections((prev) => {
        const next = new Map(prev);
        if (units <= 0) {
          next.delete(optionId);
        } else {
          next.set(optionId, units);
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
    const selArray: Array<{ productOptionId: number; annualUnits: number }> = [];
    selections.forEach((annualUnits, productOptionId) => {
      selArray.push({ productOptionId, annualUnits });
    });
    confirmPlan.mutate({ animalId, selections: selArray });
  };

  const isLocked = existingPlan && (existingPlan.status === "confirmed" || existingPlan.status === "modified_by_admin");
  const isModifiedByAdmin = existingPlan?.status === "modified_by_admin";
  const isLoading = profileQuery.isLoading || optionsQuery.isLoading || planQuery.isLoading;

  // Don't show if no production profile configured
  if (!isLoading && !profile) return null;

  // Don't show if no options configured
  if (!isLoading && options.length === 0) return null;

  return (
    <section id="product-plan" className="border-b border-border/60 py-10 md:py-14">
      <div className="container">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">Мои продукты</h2>
            {isLocked && !isModifiedByAdmin && (
              <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                <Lock className="mr-1 h-3 w-3" /> План подтверждён
              </Badge>
            )}
            {isModifiedByAdmin && (
              <Badge className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                <Pencil className="mr-1 h-3 w-3" /> Изменён фермой
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
              {/* Milk Budget */}
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

              {/* Product Selection / View */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {isLocked ? "Ваш продуктовый план" : "Выберите продукты"}
                </h3>
            {isLocked && !isModifiedByAdmin && (
              <p className="text-sm text-muted-foreground">
                План зафиксирован. Для изменений свяжитесь с фермой через чат ниже.
              </p>
            )}
            {isModifiedByAdmin && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">✒️ План изменён администратором фермы</p>
                {existingPlan?.adminNotes && (
                  <p className="mt-1 text-xs text-amber-700">Причина: {existingPlan.adminNotes}</p>
                )}
                <p className="mt-1 text-xs text-amber-700">График доставки обновлён автоматически. Вопросы — в чате ниже.</p>
              </div>
            )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {options.map((opt) => {
                    const currentValue = selections.get(opt.id) ?? 0;
                    // Calculate max units this option can have based on remaining milk budget
                    const milkUsedByOthers = totalMilkUsed - currentValue * opt.conversionRatio;
                    const remainingMilk = annualMilkBudget - milkUsedByOthers;
                    const maxByBudget = Math.max(0, Math.floor(remainingMilk / opt.conversionRatio));

                    return (
                      <ProductSelectionCard
                        key={opt.id}
                        option={opt}
                        value={currentValue}
                        maxByBudget={maxByBudget}
                        onChange={(units) => handleSelectionChange(opt.id, units)}
                        disabled={Boolean(isLocked)}
                      />
                    );
                  })}
                </div>

                {!isLocked && (
                  <div className="flex items-center gap-4 pt-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={confirmPlan.isPending || selections.size === 0}
                      className="rounded-full"
                    >
                      {confirmPlan.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Подтвердить план
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      После подтверждения план фиксируется. Изменения — только через админа.
                    </p>
                  </div>
                )}
              </div>

              {/* Delivery Schedule */}
              {isLocked && schedule.length > 0 && (
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
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Chat with farm */}
              {isLocked && user?.openId && (
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
