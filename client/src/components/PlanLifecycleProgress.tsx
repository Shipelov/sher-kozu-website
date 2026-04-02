/**
 * PlanLifecycleProgress — visual progress bar showing the product plan lifecycle stages.
 * Stages: Настройка → Выбор продуктов → Подтверждение → Активен
 *
 * Uses the plan status and verified products flag to determine effective stage.
 */

import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";

type LifecycleStage = {
  key: string;
  label: string;
  description: string;
  icon: typeof Settings;
};

const STAGES: LifecycleStage[] = [
  {
    key: "admin_setup",
    label: "Настройка",
    description: "Администратор настраивает продукты",
    icon: Settings,
  },
  {
    key: "owner_config",
    label: "Выбор продуктов",
    description: "Вы выбираете продукты и объёмы",
    icon: Package,
  },
  {
    key: "pending_approval",
    label: "Подтверждение",
    description: "Ферма проверяет и подтверждает план",
    icon: ShieldCheck,
  },
  {
    key: "confirmed",
    label: "Активен",
    description: "План подтверждён, доставки запланированы",
    icon: Sparkles,
  },
];

function getStageIndex(status: string | null | undefined, hasVerifiedProducts: boolean): number {
  if (!status) return -1; // No plan at all

  // Effective status: if pending_owner_config but no verified products, treat as admin_setup
  const effectiveStatus =
    status === "pending_owner_config" && !hasVerifiedProducts
      ? "pending_admin_setup"
      : status;

  switch (effectiveStatus) {
    case "draft":
    case "pending_admin_setup":
      return 0;
    case "pending_owner_config":
      return 1;
    case "pending_approval":
      return 2;
    case "confirmed":
    case "modified_by_admin":
      return 3;
    default:
      return 0;
  }
}

function getStageState(
  stageIdx: number,
  currentIdx: number
): "completed" | "current" | "upcoming" {
  if (stageIdx < currentIdx) return "completed";
  if (stageIdx === currentIdx) return "current";
  return "upcoming";
}

export default function PlanLifecycleProgress({
  animalSlug,
}: {
  animalSlug: string;
}) {
  const planQuery = trpc.productTrack.getMyPlanBySlug.useQuery(
    { animalSlug },
    { enabled: Boolean(animalSlug), staleTime: 30_000 }
  );

  const { plan, hasVerifiedProducts } = planQuery.data ?? {
    plan: null,
    hasVerifiedProducts: false,
  };

  const currentStageIdx = useMemo(
    () => getStageIndex(plan?.status, hasVerifiedProducts),
    [plan?.status, hasVerifiedProducts]
  );

  // Don't render if no plan exists at all
  if (planQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загружаем статус плана…
      </div>
    );
  }

  if (!plan) return null;

  const isComplete = currentStageIdx >= STAGES.length - 1;
  const progressPercent =
    currentStageIdx < 0
      ? 0
      : Math.min(100, ((currentStageIdx + (isComplete ? 1 : 0.5)) / STAGES.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-primary">
            Продуктовый план
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Этапы подготовки вашего плана
          </h3>
        </div>
        {isComplete && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            План активен
          </div>
        )}
        {!isComplete && currentStageIdx >= 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5" />
            Этап {currentStageIdx + 1} из {STAGES.length}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Stages */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage, idx) => {
          const state = getStageState(idx, currentStageIdx);
          const Icon = stage.icon;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08 }}
              className={`relative rounded-2xl border p-3.5 transition-colors ${
                state === "completed"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : state === "current"
                    ? "border-primary/30 bg-primary/5 ring-1 ring-primary/15"
                    : "border-border/50 bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    state === "completed"
                      ? "bg-emerald-100 text-emerald-600"
                      : state === "current"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground/50"
                  }`}
                >
                  {state === "completed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-semibold ${
                      state === "completed"
                        ? "text-emerald-700"
                        : state === "current"
                          ? "text-foreground"
                          : "text-muted-foreground/60"
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div
                    className={`text-xs leading-snug ${
                      state === "completed"
                        ? "text-emerald-600/70"
                        : state === "current"
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                    }`}
                  >
                    {stage.description}
                  </div>
                </div>
              </div>

              {/* Step number */}
              <div
                className={`absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  state === "completed"
                    ? "bg-emerald-500 text-white"
                    : state === "current"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground/50"
                }`}
              >
                {idx + 1}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Current stage description */}
      {currentStageIdx >= 0 && currentStageIdx < STAGES.length && !isComplete && (
        <div className="mt-4 rounded-xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {STAGES[currentStageIdx].label}:
          </span>{" "}
          {STAGES[currentStageIdx].description}
        </div>
      )}
    </motion.div>
  );
}
