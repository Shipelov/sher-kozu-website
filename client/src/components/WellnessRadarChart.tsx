import { useMemo } from "react";

type WellnessMetrics = {
  happiness: number;
  health: number;
  attachment: number;
  mood: number;
  obedience: number;
};

type Props = {
  metrics: WellnessMetrics;
  size?: number;
};

const LABELS = [
  { key: "happiness", label: "Счастье", emoji: "😊" },
  { key: "health", label: "Здоровье", emoji: "💚" },
  { key: "attachment", label: "Привязанность", emoji: "🤝" },
  { key: "mood", label: "Настроение", emoji: "🌈" },
  { key: "obedience", label: "Послушание", emoji: "🎓" },
] as const;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function WellnessRadarChart({ metrics, size = 220 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const labelR = size * 0.47;

  const angleStep = 360 / 5;

  // Grid rings
  const rings = [25, 50, 75, 100];

  // Data polygon
  const dataPoints = useMemo(() => {
    return LABELS.map((l, i) => {
      const val = Math.max(0, Math.min(100, metrics[l.key] ?? 0));
      const r = (val / 100) * maxR;
      const angle = i * angleStep;
      return polarToCartesian(cx, cy, r, angle);
    });
  }, [metrics, cx, cy, maxR, angleStep]);

  const polygonPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Overall score
  const overall = Math.round(
    (metrics.happiness + metrics.health + metrics.attachment + metrics.mood + metrics.obedience) / 5
  );
  const overallColor = overall >= 70 ? "#16a34a" : overall >= 40 ? "#d97706" : "#dc2626";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid rings */}
        {rings.map((pct) => {
          const r = (pct / 100) * maxR;
          return (
            <circle
              key={pct}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              opacity={0.5}
            />
          );
        })}

        {/* Axis lines */}
        {LABELS.map((_, i) => {
          const angle = i * angleStep;
          const end = polarToCartesian(cx, cy, maxR, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              opacity={0.5}
            />
          );
        })}

        {/* Data polygon */}
        <path
          d={polygonPath}
          fill="oklch(0.35 0.12 150 / 0.15)"
          stroke="oklch(0.35 0.12 150)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="oklch(0.35 0.12 150)" stroke="white" strokeWidth={1.5} />
        ))}

        {/* Labels */}
        {LABELS.map((l, i) => {
          const angle = i * angleStep;
          const pos = polarToCartesian(cx, cy, labelR, angle);
          const val = Math.round(metrics[l.key] ?? 0);
          const valColor = val >= 70 ? "#16a34a" : val >= 40 ? "#d97706" : "#dc2626";
          return (
            <g key={l.key}>
              <text
                x={pos.x}
                y={pos.y - 7}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] fill-muted-foreground"
              >
                {l.emoji} {l.label}
              </text>
              <text
                x={pos.x}
                y={pos.y + 7}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[11px] font-bold"
                fill={valColor}
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Center score */}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[22px] font-bold"
          fill={overallColor}
        >
          {overall}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[8px] fill-muted-foreground"
        >
          ОБЩИЙ
        </text>
      </svg>
    </div>
  );
}
