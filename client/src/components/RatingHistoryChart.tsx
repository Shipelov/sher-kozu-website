import { useMemo } from "react";

interface Snapshot {
  snapshotDate: string;
  totalScore: number;
  averageAnimalRating: number;
  activityBonus: number;
  rank: number;
}

interface RatingHistoryChartProps {
  snapshots: Snapshot[];
  height?: number;
  className?: string;
}

/**
 * Minimal sparkline-style chart showing rating history over time.
 * Uses pure SVG — no external chart library needed.
 */
export default function RatingHistoryChart({
  snapshots,
  height = 80,
  className = "",
}: RatingHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;

    const sorted = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    const values = sorted.map((s) => s.totalScore);
    const min = Math.max(0, Math.min(...values) - 5);
    const max = Math.min(100, Math.max(...values) + 5);
    const range = max - min || 1;

    const width = 300;
    const padding = { top: 8, bottom: 20, left: 4, right: 4 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = sorted.map((s, i) => {
      const x = padding.left + (sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW);
      const y = padding.top + chartH - ((s.totalScore - min) / range) * chartH;
      return { x, y, ...s };
    });

    // SVG polyline path
    const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");

    // Gradient fill area path
    const areaPath = `M${points[0].x},${padding.top + chartH} ` +
      points.map((p) => `L${p.x},${p.y}`).join(" ") +
      ` L${points[points.length - 1].x},${padding.top + chartH} Z`;

    // Date labels (first and last)
    const formatDate = (d: string) => {
      const parts = d.split("-");
      return `${parts[2]}.${parts[1]}`;
    };

    const firstLabel = formatDate(sorted[0].snapshotDate);
    const lastLabel = sorted.length > 1 ? formatDate(sorted[sorted.length - 1].snapshotDate) : null;

    // Trend
    const firstVal = values[0];
    const lastVal = values[values.length - 1];
    const trend = lastVal > firstVal ? "up" : lastVal < firstVal ? "down" : "flat";

    return { points, linePath, areaPath, width, firstLabel, lastLabel, trend, lastVal, padding, chartH };
  }, [snapshots, height]);

  if (!chartData) {
    return (
      <div className={`flex items-center justify-center text-xs text-muted-foreground ${className}`} style={{ height }}>
        Нет данных за последние 30 дней
      </div>
    );
  }

  const trendColor = chartData.trend === "up" ? "#22c55e" : chartData.trend === "down" ? "#ef4444" : "#a3a3a3";
  const trendEmoji = chartData.trend === "up" ? "↑" : chartData.trend === "down" ? "↓" : "→";

  return (
    <div className={`relative ${className}`}>
      {/* Trend badge */}
      <div className="absolute top-0 right-0 flex items-center gap-1 text-xs font-semibold" style={{ color: trendColor }}>
        <span>{trendEmoji}</span>
        <span>{chartData.lastVal}</span>
      </div>

      <svg
        viewBox={`0 0 ${chartData.width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={chartData.areaPath} fill="url(#ratingGrad)" />

        {/* Line */}
        <polyline
          points={chartData.linePath}
          fill="none"
          stroke={trendColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {chartData.points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={chartData.points.length <= 7 ? 3 : 2}
            fill="white"
            stroke={trendColor}
            strokeWidth="1.5"
          />
        ))}

        {/* Date labels */}
        <text
          x={chartData.padding.left}
          y={height - 4}
          fontSize="9"
          fill="#a3a3a3"
          textAnchor="start"
        >
          {chartData.firstLabel}
        </text>
        {chartData.lastLabel && (
          <text
            x={chartData.width - chartData.padding.right}
            y={height - 4}
            fontSize="9"
            fill="#a3a3a3"
            textAnchor="end"
          >
            {chartData.lastLabel}
          </text>
        )}
      </svg>
    </div>
  );
}
