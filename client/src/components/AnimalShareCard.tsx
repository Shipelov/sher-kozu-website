import ShareSelectionPreviewCard from "@/components/ShareSelectionPreviewCard";
import { Badge } from "@/components/ui/badge";

type AnimalShareCardProps = {
  statusLabel: string;
  statusClassName: string;
  name: string;
  breedLabel: string;
  priceLabel: string;
  occupiedPercent: number;
  availablePercent: number;
  shareUnitPercent: number;
  primarySharePercent: number;
  primarySharePriceLabel: string;
  availableSharePercents: number[];
  helperText: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  ctaAsButton?: boolean;
  ctaDisabled?: boolean;
  ctaPending?: boolean;
  ctaLoginRequired?: boolean;
  selectedSharePercent?: number;
  onShareSelect?: (percent: number) => void;
  selectable?: boolean;
  title?: string;
  eyebrow?: string;
  theme?: "light" | "stone";
  defaultPlanLabel?: string;
  defaultPlanMeta?: string;
  occupiedUntilLabel?: string | null;
  footer?: React.ReactNode;
  compact?: boolean;
};

export default function AnimalShareCard({
  statusLabel,
  statusClassName,
  name,
  breedLabel,
  priceLabel,
  occupiedPercent,
  availablePercent,
  shareUnitPercent,
  primarySharePercent,
  primarySharePriceLabel,
  availableSharePercents,
  helperText,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  ctaAsButton = false,
  ctaDisabled,
  ctaPending,
  ctaLoginRequired,
  selectedSharePercent,
  onShareSelect,
  selectable = false,
  title = "Единая карточка выбора доли",
  eyebrow = "Статус, доля и цена",
  theme = "light",
  defaultPlanLabel,
  defaultPlanMeta,
  occupiedUntilLabel,
  footer,
  compact = false,
}: AnimalShareCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Badge className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClassName}`}>{statusLabel}</Badge>
          <div>
            <h3 className={compact ? "text-xl font-semibold text-foreground" : "text-2xl font-semibold text-foreground"}>{name}</h3>
            <p className="text-sm text-muted-foreground">{breedLabel}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Стартовая доля</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{primarySharePercent}% · {primarySharePriceLabel}</div>
        </div>
      </div>

      {occupiedUntilLabel ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          В отношениях до {occupiedUntilLabel}
        </div>
      ) : null}

      <ShareSelectionPreviewCard
        priceLabel={priceLabel}
        occupiedPercent={occupiedPercent}
        availablePercent={availablePercent}
        shareUnitPercent={shareUnitPercent}
        primarySharePercent={primarySharePercent}
        primarySharePriceLabel={primarySharePriceLabel}
        availableSharePercents={availableSharePercents}
        helperText={helperText}
        description={description}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        onCtaClick={onCtaClick}
        ctaAsButton={ctaAsButton}
        ctaDisabled={ctaDisabled}
        ctaPending={ctaPending}
        ctaLoginRequired={ctaLoginRequired}
        selectedSharePercent={selectedSharePercent}
        onShareSelect={onShareSelect}
        selectable={selectable}
        title={title}
        eyebrow={eyebrow}
        theme={theme}
        defaultPlanLabel={defaultPlanLabel}
        defaultPlanMeta={defaultPlanMeta}
        footer={footer}
      />
    </div>
  );
}
