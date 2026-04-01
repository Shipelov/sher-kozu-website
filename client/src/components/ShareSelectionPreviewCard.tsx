import { ArrowRight, Loader2, Package, Users, User } from "lucide-react";
import type { ReactNode } from "react";

type ShareSelectionPreviewCardProps = {
  priceLabel: string;
  occupiedPercent: number;
  availablePercent: number;
  shareUnitPercent: number;
  primarySharePercent: number;
  primarySharePriceLabel: string;
  availableSharePercents: number[];
  helperText: string;
  description?: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  ctaHref?: string;
  ctaAsButton?: boolean;
  ctaDisabled?: boolean;
  ctaPending?: boolean;
  ctaLoginRequired?: boolean;
  selectedSharePercent?: number;
  onShareSelect?: (percent: number) => void;
  selectable?: boolean;
  title?: string;
  eyebrow?: string;
  defaultPlanLabel?: string;
  defaultPlanMeta?: string;
  className?: string;
  theme?: "light" | "stone";
  footer?: ReactNode;
};

function getThemeClasses(theme: "light" | "stone") {
  if (theme === "stone") {
    return {
      shell: "rounded-[1.25rem] border border-stone-200 bg-white px-4 py-4",
      metricGrid: "grid gap-3 rounded-[1.5rem] bg-stone-50 p-4 sm:grid-cols-2",
      metricLabel: "text-xs uppercase tracking-[0.16em] text-stone-500",
      metricValue: "mt-1 text-lg font-semibold text-stone-900",
      eyebrow: "text-xs uppercase tracking-[0.16em] text-stone-500",
      title: "mt-2 text-base font-semibold text-stone-900",
      body: "mt-2 text-sm leading-6 text-stone-600",
      sideCard: "rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700",
      sideTitle: "text-xs uppercase tracking-[0.16em] text-stone-500",
      sideValue: "mt-1 font-semibold text-stone-900",
      sideMeta: "mt-1 text-xs text-stone-500",
      chipActive: "bg-stone-900 text-white ring-stone-900 shadow-md",
      chipIdle: "bg-stone-50 text-stone-700 ring-stone-200 hover:bg-stone-100",
      emptyChip: "rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-500 ring-1 ring-stone-200",
      selectedBadge: "rounded-full bg-stone-900 px-3 py-1 text-sm font-semibold text-white",
      cta: "mt-4 inline-flex w-full items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60",
      defaultPlan: "rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700",
      defaultPlanTitle: "text-xs uppercase tracking-[0.16em] text-stone-500",
      defaultPlanValue: "mt-1 font-semibold text-stone-900",
      defaultPlanMeta: "mt-1 text-xs text-stone-500",
    };
  }

  return {
    shell: "rounded-[1.25rem] border border-border/70 bg-background/70 p-4",
    metricGrid: "grid gap-3 rounded-[1.5rem] bg-secondary p-4 sm:grid-cols-2",
    metricLabel: "text-xs uppercase tracking-[0.16em] text-muted-foreground",
    metricValue: "mt-1 text-lg font-semibold text-foreground",
    eyebrow: "text-xs uppercase tracking-[0.16em] text-primary/70",
    title: "mt-2 text-lg font-semibold text-foreground",
    body: "mt-2 text-sm leading-6 text-muted-foreground",
    sideCard: "rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground",
    sideTitle: "text-xs uppercase tracking-[0.16em] text-muted-foreground",
    sideValue: "mt-1 font-semibold",
    sideMeta: "mt-1 text-xs text-muted-foreground",
    chipActive: "bg-primary text-primary-foreground ring-primary shadow-md",
    chipIdle: "border border-border bg-white text-foreground ring-border hover:bg-secondary",
    emptyChip: "rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground",
    selectedBadge: "rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary",
    cta: "mt-4 inline-flex w-full items-center justify-between rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all hover:-translate-y-0.5 hover:bg-primary/95 disabled:cursor-not-allowed disabled:opacity-60",
    defaultPlan: "rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground",
    defaultPlanTitle: "text-xs uppercase tracking-[0.16em] text-muted-foreground",
    defaultPlanValue: "mt-1 font-semibold",
    defaultPlanMeta: "mt-1 text-xs text-muted-foreground",
  };
}

const SHARE_OPTIONS = [
  {
    percent: 50,
    label: "Совладение 50%",
    sublabel: "Базовый тариф",
    description: "Делите животное с другим участником. Получаете половину продукции.",
    icon: Users,
  },
  {
    percent: 100,
    label: "Полное владение 100%",
    sublabel: "Стандартный тариф",
    description: "Вся продукция — только ваша. Максимум привилегий и выбора.",
    icon: User,
  },
] as const;

export default function ShareSelectionPreviewCard({
  priceLabel,
  occupiedPercent,
  availablePercent,
  shareUnitPercent: _shareUnitPercent,
  primarySharePercent,
  primarySharePriceLabel,
  availableSharePercents,
  helperText,
  description,
  ctaLabel,
  onCtaClick,
  ctaHref,
  ctaAsButton = false,
  ctaDisabled,
  ctaPending,
  ctaLoginRequired,
  selectedSharePercent,
  onShareSelect,
  selectable = false,
  title = "Два формата участия — выберите свой",
  eyebrow = "Простой выбор доли",
  defaultPlanLabel,
  defaultPlanMeta,
  className = "",
  theme = "light",
  footer,
}: ShareSelectionPreviewCardProps) {
  const tone = getThemeClasses(theme);
  const activeSharePercent = selectedSharePercent ?? primarySharePercent;
  const ctaContent = (
    <>
      <span>{ctaLabel}</span>
      {ctaPending ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLoginRequired ? <Package className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
    </>
  );

  return (
    <div className={`${tone.shell} ${className}`.trim()}>
      <div className={tone.metricGrid}>
        <div>
          <p className={tone.metricLabel}>Полная цена (100%)</p>
          <p className={tone.metricValue}>{priceLabel}</p>
        </div>
        <div>
          <p className={tone.metricLabel}>Формат владения</p>
          <p className={tone.metricValue}>50% или 100%</p>
        </div>
        <div>
          <p className={tone.metricLabel}>Занято сейчас</p>
          <p className={tone.metricValue}>{occupiedPercent}%</p>
        </div>
        <div>
          <p className={tone.metricLabel}>Свободно для участия</p>
          <p className={tone.metricValue}>{availablePercent}%</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={tone.eyebrow}>{eyebrow}</p>
          <h4 className={tone.title}>{title}</h4>
          <p className={tone.body}>{description ?? helperText}</p>
        </div>

        {defaultPlanLabel ? (
          <div className={tone.defaultPlan}>
            <div className={tone.defaultPlanTitle}>Формат по умолчанию</div>
            <div className={tone.defaultPlanValue}>{defaultPlanLabel}</div>
            {defaultPlanMeta ? <div className={tone.defaultPlanMeta}>{defaultPlanMeta}</div> : null}
          </div>
        ) : (
          <div className={tone.sideCard}>
            <div className={tone.sideTitle}>Рекомендуемая доля</div>
            <div className={tone.sideValue}>{primarySharePercent}% · {primarySharePriceLabel}</div>
            <div className={tone.sideMeta}>Первый доступный вариант</div>
          </div>
        )}
      </div>

      {selectable ? (
        <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-medium text-foreground">Выберите формат владения</p>
            <div className={tone.selectedBadge}>{activeSharePercent}%</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHARE_OPTIONS.map((option) => {
              const isAvailable = availableSharePercents.includes(option.percent);
              const isActive = activeSharePercent === option.percent;
              const Icon = option.icon;
              return (
                <button
                  key={option.percent}
                  type="button"
                  onClick={() => isAvailable && onShareSelect?.(option.percent)}
                  disabled={!isAvailable || ctaPending}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left ring-2 transition-all ${
                    isActive
                      ? `${tone.chipActive} scale-[1.02]`
                      : isAvailable
                        ? `${tone.chipIdle} cursor-pointer`
                        : "cursor-not-allowed bg-muted/50 text-muted-foreground ring-border/30 opacity-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Icon className="h-5 w-5" />
                    <span className="text-2xl font-bold">{option.percent}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-xs opacity-70">{option.sublabel}</p>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">{option.description}</p>
                  {!isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px]">
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Занято</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {SHARE_OPTIONS.map((option) => {
            const isAvailable = availableSharePercents.includes(option.percent);
            return (
              <span
                key={option.percent}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ${
                  isAvailable
                    ? option.percent === primarySharePercent
                      ? tone.chipActive
                      : tone.chipIdle
                    : "bg-muted/50 text-muted-foreground ring-border/30 opacity-50"
                }`}
              >
                <option.icon className="h-4 w-4" />
                {option.percent}% — {option.label}
              </span>
            );
          })}
          {!availableSharePercents.length && (
            <span className={tone.emptyChip}>Свободных долей сейчас нет</span>
          )}
        </div>
      )}

      {footer ? <div className="mt-4">{footer}</div> : null}

      {ctaHref && !ctaAsButton ? (
        <a href={ctaHref} className={tone.cta} aria-disabled={ctaDisabled ? "true" : "false"}>
          {ctaContent}
        </a>
      ) : (
        <button type="button" onClick={onCtaClick} disabled={ctaDisabled} className={tone.cta}>
          {ctaContent}
        </button>
      )}

      {!description ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
