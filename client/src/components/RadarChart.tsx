import { useMemo } from "react";

interface MetricData {
  label: string;
  value: number; // 0-100
  emoji?: string;
}

interface RadarChartProps {
  data: MetricData[];
  color?: string;
  fillColor?: string;
  size?: number;
  label?: string;
}

interface ComparisonRadarChartProps {
  dataA: MetricData[];
  dataB: MetricData[];
  colorA?: string;
  colorB?: string;
  fillA?: string;
  fillB?: string;
  labelA?: string;
  labelB?: string;
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function buildPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  values: number[],
  maxValue: number
): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const angle = (360 / n) * i;
      const r = (v / maxValue) * radius;
      const { x, y } = polarToCartesian(cx, cy, r, angle);
      return `${x},${y}`;
    })
    .join(" ");
}

/** Single-animal radar chart */
export function RadarChart({
  data,
  color = "#6d8c54",
  fillColor = "rgba(109,140,84,0.2)",
  size = 280,
  label,
}: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const n = data.length;
  const maxValue = 100;

  const gridLevels = [20, 40, 60, 80, 100];

  const points = useMemo(
    () => buildPolygonPoints(cx, cy, radius, data.map((d) => d.value), maxValue),
    [cx, cy, radius, data, maxValue]
  );

  return (
    <div className="flex flex-col items-center">
      {label && (
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid circles */}
        {gridLevels.map((level) => {
          const r = (level / maxValue) * radius;
          const gridPoints = Array.from({ length: n }, (_, i) => {
            const angle = (360 / n) * i;
            const { x, y } = polarToCartesian(cx, cy, r, angle);
            return `${x},${y}`;
          }).join(" ");
          return (
            <polygon
              key={level}
              points={gridPoints}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}

        {/* Axis lines */}
        {data.map((_, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToCartesian(cx, cy, radius, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={points}
          fill={fillColor}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const angle = (360 / n) * i;
          const r = (d.value / maxValue) * radius;
          const { x, y } = polarToCartesian(cx, cy, r, angle);
          return <circle key={i} cx={x} cy={y} r={3.5} fill={color} />;
        })}

        {/* Labels */}
        {data.map((d, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToCartesian(cx, cy, radius + 24, angle);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground"
              fontSize={11}
            >
              {d.emoji ? `${d.emoji} ` : ""}
              {d.value}
            </text>
          );
        })}

        {/* Metric names outside */}
        {data.map((d, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToCartesian(cx, cy, radius + 40, angle);
          return (
            <text
              key={`name-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground"
              fontSize={10}
              fontWeight={500}
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/** Dual-animal comparison radar chart */
export function ComparisonRadarChart({
  dataA,
  dataB,
  colorA = "#6d8c54",
  colorB = "#c77d3a",
  fillA = "rgba(109,140,84,0.15)",
  fillB = "rgba(199,125,58,0.15)",
  labelA = "Животное A",
  labelB = "Животное B",
  size = 340,
}: ComparisonRadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.32;
  const n = dataA.length;
  const maxValue = 100;

  const gridLevels = [20, 40, 60, 80, 100];

  const pointsA = useMemo(
    () => buildPolygonPoints(cx, cy, radius, dataA.map((d) => d.value), maxValue),
    [cx, cy, radius, dataA, maxValue]
  );
  const pointsB = useMemo(
    () => buildPolygonPoints(cx, cy, radius, dataB.map((d) => d.value), maxValue),
    [cx, cy, radius, dataB, maxValue]
  );

  return (
    <div className="flex flex-col items-center">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorA }} />
          <span className="text-sm font-medium text-foreground">{labelA}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorB }} />
          <span className="text-sm font-medium text-foreground">{labelB}</span>
        </div>
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid */}
        {gridLevels.map((level) => {
          const r = (level / maxValue) * radius;
          const gridPoints = Array.from({ length: n }, (_, i) => {
            const angle = (360 / n) * i;
            const { x, y } = polarToCartesian(cx, cy, r, angle);
            return `${x},${y}`;
          }).join(" ");
          return (
            <polygon
              key={level}
              points={gridPoints}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}

        {/* Axes */}
        {dataA.map((_, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToCartesian(cx, cy, radius, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon A */}
        <polygon
          points={pointsA}
          fill={fillA}
          stroke={colorA}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data polygon B */}
        <polygon
          points={pointsB}
          fill={fillB}
          stroke={colorB}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Points A */}
        {dataA.map((d, i) => {
          const angle = (360 / n) * i;
          const r = (d.value / maxValue) * radius;
          const { x, y } = polarToCartesian(cx, cy, r, angle);
          return <circle key={`a-${i}`} cx={x} cy={y} r={3.5} fill={colorA} />;
        })}

        {/* Points B */}
        {dataB.map((d, i) => {
          const angle = (360 / n) * i;
          const r = (d.value / maxValue) * radius;
          const { x, y } = polarToCartesian(cx, cy, r, angle);
          return <circle key={`b-${i}`} cx={x} cy={y} r={3.5} fill={colorB} />;
        })}

        {/* Labels with both values */}
        {dataA.map((d, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToCartesian(cx, cy, radius + 30, angle);
          return (
            <g key={`label-${i}`}>
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground"
                fontSize={10}
                fontWeight={500}
              >
                {d.label}
              </text>
              <text
                x={x}
                y={y + 6}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
              >
                <tspan fill={colorA}>{dataA[i].value}</tspan>
                <tspan className="fill-muted-foreground"> / </tspan>
                <tspan fill={colorB}>{dataB[i].value}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
