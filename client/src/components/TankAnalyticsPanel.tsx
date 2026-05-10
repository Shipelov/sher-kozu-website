/**
 * TankAnalyticsPanel — expandable analytics panel for a single tank.
 * Shows: turnover summary, volume dynamics chart, movement journal, predictive metrics.
 * Supports custom period selection and analytics reset.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  Loader2,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { toast } from "sonner";
import { exportExcel, exportPDF, type ReportColumn, periodSubtitle } from "@/lib/reportExport";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
);

const MOVEMENT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  milking_in: { label: "Пополнение", color: "bg-emerald-100 text-emerald-700", icon: "🟢" },
  processing_out: { label: "В производство", color: "bg-purple-100 text-purple-700", icon: "🔴" },
  adjustment: { label: "Корректировка", color: "bg-amber-100 text-amber-700", icon: "🟡" },
  waste: { label: "Списание", color: "bg-red-100 text-red-700", icon: "⚫" },
  transfer: { label: "Перелив", color: "bg-blue-100 text-blue-700", icon: "🔵" },
  sample: { label: "Проба", color: "bg-gray-100 text-gray-700", icon: "⚪" },
};

interface TankAnalyticsPanelProps {
  tankId: number;
  tankResetAt: string | null;
  onClose: () => void;
  movementPage: number;
  onMovementPageChange: (p: number) => void;
  movementFilter: string;
  onMovementFilterChange: (f: string) => void;
}

export default function TankAnalyticsPanel({
  tankId,
  tankResetAt,
  onClose,
  movementPage,
  onMovementPageChange,
  movementFilter,
  onMovementFilterChange,
}: TankAnalyticsPanelProps) {
  // Period selection state
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const isCustomPeriod = !!dateFrom;

  // Effective dateFrom: if analytics was reset and no custom period, use reset date
  const effectiveDateFrom = dateFrom || (tankResetAt ? tankResetAt.slice(0, 10) : "");
  const effectiveDateTo = dateTo || "";

  const turnoverQuery = trpc.milkAdmin.tankTurnover.useQuery({
    tankId,
    dateFrom: effectiveDateFrom || undefined,
    dateTo: effectiveDateTo || undefined,
  });
  const historyQuery = trpc.milkAdmin.tankVolumeHistory.useQuery({
    tankId,
    days: 30,
    dateFrom: effectiveDateFrom || undefined,
    dateTo: effectiveDateTo || undefined,
  });
  const metricsQuery = trpc.milkAdmin.tankMetrics.useQuery({
    tankId,
    dateFrom: effectiveDateFrom || undefined,
    dateTo: effectiveDateTo || undefined,
  });
  const movementsQuery = trpc.milkAdmin.tankMovements.useQuery({
    tankId,
    page: movementPage,
    pageSize: 10,
    movementType: movementFilter
      ? (movementFilter as "milking_in" | "transfer" | "processing_out" | "waste" | "sample" | "adjustment")
      : undefined,
    dateFrom: effectiveDateFrom || undefined,
    dateTo: effectiveDateTo || undefined,
  });

  const utils = trpc.useUtils();
  const resetMutation = trpc.milkAdmin.resetTankAnalytics.useMutation({
    onSuccess: (data) => {
      toast.success(`Аналитика сброшена для ${data.tankName}`, {
        description: `Базовый объём: ${data.baselineVolumeLiters} л. Новые данные начнутся с ${new Date(data.resetAt).toLocaleDateString("ru-RU")}`,
      });
      void utils.milkAdmin.tanks.invalidate();
      void utils.milkAdmin.tankTurnover.invalidate();
      void utils.milkAdmin.tankVolumeHistory.invalidate();
      void utils.milkAdmin.tankMetrics.invalidate();
      void utils.milkAdmin.tankMovements.invalidate();
    },
    onError: (err) => toast.error("Ошибка сброса аналитики", { description: err.message }),
  });

  const metrics = metricsQuery.data;
  const turnover = turnoverQuery.data;
  const history = historyQuery.data;
  const movements = movementsQuery.data;

  const isLoading = turnoverQuery.isLoading || historyQuery.isLoading || metricsQuery.isLoading;

  // Chart data
  const chartData = history?.history
    ? {
        labels: history.history.map((h) => {
          const d = new Date(h.date);
          return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        }),
        datasets: [
          {
            label: "Объём (л)",
            data: history.history.map((h) => h.volumeLiters),
            borderColor: "oklch(0.45 0.12 150)",
            backgroundColor: "oklch(0.45 0.12 150 / 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: "Ёмкость (л)",
            data: history.history.map(() => history.capacityLiters),
            borderColor: "oklch(0.7 0.05 60)",
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y} л`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Литры" },
      },
      x: {
        title: { display: false },
      },
    },
  };

  const totalPages = movements ? Math.ceil(movements.total / movements.pageSize) : 0;

  return (
    <div className="mt-6 border-2 border-[oklch(0.85_0.06_150)] rounded-xl p-5 bg-[oklch(0.99_0.005_90)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[oklch(0.25_0.04_60)] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[oklch(0.4_0.12_150)]" />
          Аналитика танка{metrics ? `: ${metrics.tankName}` : ""}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
            disabled={resetMutation.isPending}
            onClick={() => {
              if (confirm("Сбросить аналитику? Текущий остаток станет начальной точкой. Данные до этого момента будут исключены из отчётов.")) {
                resetMutation.mutate({ tankId });
              }
            }}
          >
            {resetMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
            Сбросить
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-[oklch(0.97_0.01_90)] rounded-lg border">
        <span className="text-xs font-medium text-[oklch(0.4_0.04_80)]">Период:</span>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); onMovementPageChange(1); }}
          className="w-[140px] h-8 text-xs"
          placeholder="От"
        />
        <span className="text-xs text-[oklch(0.5_0.04_80)]">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); onMovementPageChange(1); }}
          className="w-[140px] h-8 text-xs"
          placeholder="До"
        />
        {isCustomPeriod && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setDateFrom(""); setDateTo(""); onMovementPageChange(1); }}
          >
            Сбросить период
          </Button>
        )}
        {tankResetAt && !isCustomPeriod && (
          <span className="text-[10px] text-[oklch(0.55_0.04_80)] ml-auto">
            Аналитика с {new Date(tankResetAt).toLocaleDateString("ru-RU")}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Predictive Metrics ── */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Ср. расход/день"
                value={`${metrics.avgDailyConsumptionLiters} л`}
                icon={<TrendingDown className="w-4 h-4 text-red-500" />}
              />
              <MetricCard
                label="Ср. приход/день"
                value={`${metrics.avgDailyInflowLiters} л`}
                icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
              />
              <MetricCard
                label="Хватит на"
                value={metrics.daysUntilEmpty != null ? `${metrics.daysUntilEmpty} дн.` : "∞"}
                icon={<Clock className="w-4 h-4 text-amber-500" />}
                highlight={metrics.daysUntilEmpty != null && metrics.daysUntilEmpty <= 3}
              />
              <MetricCard
                label="Оборачиваемость"
                value={`${metrics.turnoverRate}×`}
                subtitle={isCustomPeriod ? "за период" : "за 30 дней"}
                icon={<Droplets className="w-4 h-4 text-blue-500" />}
              />
            </div>
          )}

          {/* ── Turnover Summary ── */}
          {turnover && (
            <div>
              <h4 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-2">
                Оборот {turnover.isCustomPeriod ? "за выбранный период" : "по периодам"}
              </h4>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[oklch(0.96_0.01_90)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-xs">Период</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">
                        <span className="inline-flex items-center gap-1">
                          <ArrowDown className="w-3 h-3 text-emerald-600" /> Приход, л
                        </span>
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-xs">
                        <span className="inline-flex items-center gap-1">
                          <ArrowUp className="w-3 h-3 text-red-600" /> Расход, л
                        </span>
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Корректировки, л</th>
                      <th className="text-right px-3 py-2 font-medium text-xs font-bold">Итого, л</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {turnover.isCustomPeriod ? (
                      <TurnoverRow label="Выбранный период" data={turnover.custom!} />
                    ) : (
                      <>
                        <TurnoverRow label="Сегодня" data={turnover.today} />
                        <TurnoverRow label="7 дней" data={turnover.week} />
                        <TurnoverRow label="30 дней" data={turnover.month} />
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Volume Dynamics Chart ── */}
          {chartData && chartData.labels.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-2">
                Динамика объёма {isCustomPeriod ? "(выбранный период)" : "(30 дней)"}
              </h4>
              <div className="border rounded-lg p-3 bg-white" style={{ height: 240 }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          )}

          {/* ── Movement Journal ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[oklch(0.4_0.04_80)]">
                  Журнал движений {movements ? `(${movements.total})` : ""}
                </h4>
                {movements && movements.movements.length > 0 && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => {
                        const cols: ReportColumn[] = [
                          { header: "Дата", key: "date", width: 18 },
                          { header: "Тип операции", key: "type", width: 18 },
                          { header: "Объём, л", key: "volume", width: 12 },
                          { header: "Остаток, л", key: "balance", width: 12 },
                          { header: "Сотрудник", key: "worker", width: 22 },
                          { header: "Примечание", key: "note", width: 30 },
                        ];
                        const rows = movements.movements.map((m: any) => {
                          const mt = MOVEMENT_LABELS[m.movementType] ?? { label: m.movementType };
                          const d = new Date(m.createdAt);
                          return {
                            date: d.toLocaleDateString("ru-RU") + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
                            type: mt.label,
                            volume: m.volumeLiters,
                            balance: m.tankVolumeAfterLiters,
                            worker: m.workerName || "—",
                            note: m.note || "—",
                          };
                        });
                        const sub = effectiveDateFrom || effectiveDateTo
                          ? periodSubtitle(effectiveDateFrom || "...", effectiveDateTo || new Date().toISOString().slice(0, 10))
                          : "Все данные";
                        exportExcel({
                          title: `Журнал движений — ${metrics?.tankName || "Танк"}`,
                          subtitle: sub,
                          columns: cols,
                          rows,
                          filename: `journal_tank_${tankId}_${new Date().toISOString().slice(0, 10)}`,
                        });
                        toast.success("Excel-файл скачан");
                      }}
                    >
                      <Download className="w-3 h-3" /> Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => {
                        const cols: ReportColumn[] = [
                          { header: "Дата", key: "date", width: 18, pdfWidth: 35 },
                          { header: "Тип операции", key: "type", width: 18, pdfWidth: 30 },
                          { header: "Объём, л", key: "volume", width: 12, pdfWidth: 20 },
                          { header: "Остаток, л", key: "balance", width: 12, pdfWidth: 20 },
                          { header: "Сотрудник", key: "worker", width: 22, pdfWidth: 40 },
                          { header: "Примечание", key: "note", width: 30, pdfWidth: 50 },
                        ];
                        const rows = movements.movements.map((m: any) => {
                          const mt = MOVEMENT_LABELS[m.movementType] ?? { label: m.movementType };
                          const d = new Date(m.createdAt);
                          return {
                            date: d.toLocaleDateString("ru-RU") + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
                            type: mt.label,
                            volume: m.volumeLiters,
                            balance: m.tankVolumeAfterLiters,
                            worker: m.workerName || "—",
                            note: m.note || "—",
                          };
                        });
                        const sub = effectiveDateFrom || effectiveDateTo
                          ? periodSubtitle(effectiveDateFrom || "...", effectiveDateTo || new Date().toISOString().slice(0, 10))
                          : "Все данные";
                        exportPDF({
                          title: `Журнал движений — ${metrics?.tankName || "Танк"}`,
                          subtitle: sub,
                          columns: cols,
                          rows,
                          filename: `journal_tank_${tankId}_${new Date().toISOString().slice(0, 10)}`,
                        });
                        toast.success("PDF-файл скачан");
                      }}
                    >
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                  </div>
                )}
              </div>
              <Select value={movementFilter || "all"} onValueChange={(v) => onMovementFilterChange(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Все типы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="milking_in">🟢 Пополнение</SelectItem>
                  <SelectItem value="processing_out">🔴 В производство</SelectItem>
                  <SelectItem value="adjustment">🟡 Корректировка</SelectItem>
                  <SelectItem value="waste">⚫ Списание</SelectItem>
                  <SelectItem value="transfer">🔵 Перелив</SelectItem>
                  <SelectItem value="sample">⚪ Проба</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {movementsQuery.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : movements && movements.movements.length > 0 ? (
              <>
                <div className="border rounded-lg overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[oklch(0.96_0.01_90)] sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-xs">Дата</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Тип</th>
                        <th className="text-right px-3 py-2 font-medium text-xs">Объём, л</th>
                        <th className="text-right px-3 py-2 font-medium text-xs">Остаток, л</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Сотрудник</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Примечание</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {movements.movements.map((m: any) => {
                        const mt = MOVEMENT_LABELS[m.movementType] ?? { label: m.movementType, color: "bg-gray-100 text-gray-700", icon: "?" };
                        const date = new Date(m.createdAt);
                        return (
                          <tr key={m.id} className="hover:bg-[oklch(0.98_0.005_90)]">
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              {date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}{" "}
                              <span className="text-[oklch(0.6_0.02_80)]">
                                {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <Badge className={`rounded-full text-[10px] ${mt.color}`}>
                                {mt.icon} {mt.label}
                              </Badge>
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${m.volumeLiters > 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {m.volumeLiters > 0 ? "+" : ""}{m.volumeLiters} л
                            </td>
                            <td className="px-3 py-2 text-right text-[oklch(0.5_0.04_80)]">
                              {m.tankVolumeAfterLiters} л
                            </td>
                            <td className="px-3 py-2 text-xs text-[oklch(0.5_0.04_80)]">
                              {m.workerName}
                            </td>
                            <td className="px-3 py-2 text-xs text-[oklch(0.5_0.04_80)] max-w-[150px] truncate">
                              {m.note || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[oklch(0.5_0.04_80)]">
                      Стр. {movementPage} из {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={movementPage <= 1}
                        onClick={() => onMovementPageChange(movementPage - 1)}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={movementPage >= totalPages}
                        onClick={() => onMovementPageChange(movementPage + 1)}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[oklch(0.6_0.04_80)] py-4 text-center">Нет записей за выбранный период</p>
            )}
          </div>

          {/* Peak load info */}
          {metrics && (
            <div className="flex items-center gap-4 text-xs text-[oklch(0.5_0.04_80)] border-t pt-3">
              <span>
                <Calendar className="w-3 h-3 inline mr-1" />
                Пиковая загрузка: <strong>{metrics.peakVolumeLiters} л</strong> ({metrics.peakFillPercent}%)
              </span>
              <span>
                Текущий: <strong>{metrics.currentVolumeLiters} / {metrics.capacityLiters} л</strong> ({metrics.fillPercent}%)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-3 ${highlight ? "border-red-300 bg-red-50" : "bg-white"}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-[oklch(0.5_0.04_80)]">{label}</span>
      </div>
      <p className={`text-lg font-bold ${highlight ? "text-red-600" : "text-[oklch(0.25_0.04_60)]"}`}>
        {value}
      </p>
      {subtitle && <p className="text-[10px] text-[oklch(0.6_0.04_80)]">{subtitle}</p>}
    </div>
  );
}

function TurnoverRow({ label, data }: { label: string; data: any }) {
  return (
    <tr className="hover:bg-[oklch(0.98_0.005_90)]">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2 text-right text-emerald-600">+{data.inflowLiters}</td>
      <td className="px-3 py-2 text-right text-red-600">−{data.outflowLiters}</td>
      <td className="px-3 py-2 text-right text-amber-600">
        {data.adjustmentLiters >= 0 ? "+" : ""}{data.adjustmentLiters}
      </td>
      <td className={`px-3 py-2 text-right font-bold ${data.netChangeLiters >= 0 ? "text-emerald-700" : "text-red-700"}`}>
        {data.netChangeLiters >= 0 ? "+" : ""}{data.netChangeLiters}
      </td>
    </tr>
  );
}
