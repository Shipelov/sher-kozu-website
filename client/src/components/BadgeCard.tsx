import { motion } from "framer-motion";

interface BadgeDefinition {
  name: string;
  description: string;
  emoji: string;
  category: string;
}

interface BadgeCardProps {
  badge: {
    badgeType: string;
    awardedAt: string | Date;
    definition: BadgeDefinition;
  };
  index?: number;
}

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  ownership: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  marketplace: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  community: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  rating: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  care: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  other: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" },
};

export function BadgeCard({ badge, index = 0 }: BadgeCardProps) {
  const colors = categoryColors[badge.definition.category] || categoryColors.other;
  const date = new Date(badge.awardedAt);
  const formattedDate = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border ${colors.bg} ${colors.border} hover:shadow-md transition-shadow cursor-default group`}
    >
      <span className="text-3xl" role="img" aria-label={badge.definition.name}>
        {badge.definition.emoji}
      </span>
      <div className="text-center">
        <p className={`text-sm font-semibold ${colors.text}`}>{badge.definition.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
      </div>
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {badge.definition.description}
      </div>
    </motion.div>
  );
}

interface BadgeGridProps {
  badges: Array<{
    badgeType: string;
    awardedAt: string | Date;
    definition: BadgeDefinition;
  }>;
  emptyMessage?: string;
}

export function BadgeGrid({ badges, emptyMessage = "Пока нет достижений" }: BadgeGridProps) {
  if (badges.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <span className="text-4xl block mb-2">🏅</span>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {badges.map((badge, i) => (
        <BadgeCard key={badge.badgeType} badge={badge} index={i} />
      ))}
    </div>
  );
}

/** Compact inline badge list for showing in headers/cards */
export function BadgeInline({
  badges,
  max = 5,
}: {
  badges: Array<{ badgeType: string; definition: BadgeDefinition }>;
  max?: number;
}) {
  if (badges.length === 0) return null;
  const shown = badges.slice(0, max);
  const remaining = badges.length - max;

  return (
    <div className="flex items-center gap-1">
      {shown.map((b) => (
        <span
          key={b.badgeType}
          title={b.definition.name}
          className="text-lg cursor-default hover:scale-125 transition-transform"
        >
          {b.definition.emoji}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground ml-1">+{remaining}</span>
      )}
    </div>
  );
}
