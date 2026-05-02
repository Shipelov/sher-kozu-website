/**
 * /farm/controller — Controller ARM (Automated Workstation).
 *
 * Read-only dashboard for the milk turnover controller.
 * Mobile-first, touch-optimized. 5 tabs:
 *  1. Обзор — period stats, shift summary, tank overview
 *  2. Дойки — session list with worker filter
 *  3. Приёмки — reception list with worker filter
 *  4. Ёмкости — tank status + reconciliation
 *  5. Аудит — discrepancy report + audit log
 *
 * No create/update/delete — purely read-only.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Container,
  Download,
  Droplets,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  LogOut,
  Milk,
  Search,
  ShieldAlert,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportExcel,
  exportPDF,
  fmtDate,
  fmtShift,
  fmtStatus,
  periodSubtitle,
  getPresetDates,
  type ReportColumn,
} from "@/lib/reportExport";

type Tab = "overview" | "sessions" | "receptions" | "tanks" | "processing" | "audit";
type Tab = "overview" | "sessions" | "receptions" | "tanks" | "audit";

const TABS: { key: Tab; label: string; icon: any; shortLabel: string }[] = [
  { key: "overview", label: "Обзор", shortLabel: "Обзор", icon: BarChart3 },
  { key: "sessions", label: "Дойки", shortLabel: "Дойки", icon: Droplets },
  { key: "receptions", label: "Приёмки", shortLabel: "Приёмки", icon: ClipboardList },
  { key: "tanks", label: "Ёмкости", shortLabel: "Ёмкости", icon: Container },
  { key: "processing", label: "Переработка", shortLabel: "Перер.", icon: TrendingDown },
  { key: "audit", label: "Аудит", shortLabel: "Аудит", icon: ShieldAlert },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
  pending_confirm: { label: "Ожидает", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Подтверждена", color: "bg-emerald-100 text-emerald-700" },
  disputed: { label: "Оспорена", color: "bg-red-100 text-red-700" },
  accepted: { label: "Принято", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Отклонено", color: "bg-red-100 text-red-700" },
  pending: { label: "Ожидает", color: "bg-amber-100 text-amber-700" },
};

const PERIOD_PRESETS = [
  { key: "today" as const, label: "Сегодня" },
  { key: "week" as const, label: "Неделя" },
  { key: "month" as const, label: "Месяц" },
];

export default function FarmControllerArm() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");

  // Auth check
  const meQuery = trpc.farmAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (meQuery.error) navigate("/farm");
    if (meQuery.data && meQuery.data.role !== "controller") navigate("/farm");
    if (meQuery.data?.mustChangePassword) navigate("/farm/change-password");
  }, [meQuery.data, meQuery.error, navigate]);

  const logoutMutation = trpc.farmAuth.logout.useMutation({
    onSuccess: () => navigate("/farm"),
  });

  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[oklch(0.97_0.015_90)]">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.35_0.12_150)]" />
      </div>
    );
  }

  if (!meQuery.data || meQuery.data.role !== "controller") return null;

  return (
    <div className="min-h-dvh bg-[oklch(0.97_0.015_90)] flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[oklch(0.35_0.12_150)] text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6" />
            <div>
              <h1 className="text-base font-bold leading-tight">АРМ Контролёра</h1>
              <p className="text-[11px] opacity-80">{meQuery.data.name}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            className="text-white/80 hover:text-white hover:bg-white/10 h-10 w-10 p-0"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 px-3 pt-3">
        {tab === "overview" && <OverviewTab />}
        {tab === "sessions" && <SessionsTab />}
        {tab === "receptions" && <ReceptionsTab />}
        {tab === "tanks" && <TanksTab />}
        {tab === "processing" && <ControllerProcessingTab />}
        {tab === "audit" && <AuditTab />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 touch-manipulation transition-colors
                  ${active ? "text-[oklch(0.35_0.12_150)]" : "text-gray-400"}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1: OVERVIEW
   ═══════════════════════════════════════════════════════════════ */

function OverviewTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const overviewQuery = trpc.milkController.overview.useQuery(
    period === "custom" && customFrom && customTo
      ? { customFrom, customTo }
      : undefined,
    { refetchInterval: 30_000 },
  );

  const shiftQuery = trpc.milkController.shiftSummary.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const discrepancyQuery = trpc.milkController.discrepancies.useQuery(
    { days: period === "today" ? 1 : period === "week" ? 7 : 30 },
    { refetchInterval: 60_000 },
  );

  const data = overviewQuery.data;
  const periodData = data
    ? period === "today"
      ? data.today
      : period === "week"
        ? data.week
        : period === "month"
          ? data.month
          : data.custom ?? data.today
    : null;

  const flaggedCount = discrepancyQuery.data?.flagged ?? 0;

  return (
    <div className="space-y-4">
      {/* Shift Summary Card */}
      {shiftQuery.data && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Milk className="w-5 h-5 text-[oklch(0.35_0.12_150)]" />
            <h2 className="text-sm font-bold text-gray-800">Смена сегодня</h2>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {shiftQuery.data.currentShift === "morning" ? "🌅 Утренняя" : "🌙 Вечерняя"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {shiftQuery.data.shifts.map((s: any) => (
              <div key={s.shift} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{s.shiftLabel}</p>
                <p className="text-lg font-bold text-gray-800">{s.totalLiters} л</p>
                <p className="text-[10px] text-gray-400">
                  {s.sessions} доек · {s.confirmed} подтв. · {s.pending} ожид.
                </p>
                {s.disputed > 0 && (
                  <p className="text-[10px] text-red-500 font-medium mt-0.5">
                    ⚠ {s.disputed} оспорено
                  </p>
                )}
              </div>
            ))}
          </div>
          {shiftQuery.data.receptions.rejectedCount > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-lg p-2.5">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">
                Отклонено сегодня: {shiftQuery.data.receptions.rejectedCount} приёмок ({shiftQuery.data.receptions.rejectedLiters} л)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Discrepancy Alert */}
      {flaggedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Обнаружены расхождения</p>
            <p className="text-xs text-red-600 mt-0.5">
              {flaggedCount} сессий с расхождением &gt;5% или высокими потерями за последние{" "}
              {period === "today" ? "сутки" : period === "week" ? "7 дней" : "30 дней"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 text-xs text-red-700 hover:bg-red-100 px-2"
              onClick={() => {
                const tabBtns = document.querySelectorAll("nav button");
                tabBtns[4]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
              }}
            >
              Перейти в Аудит →
            </Button>
          </div>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation
              ${period === p.key
                ? "bg-[oklch(0.35_0.12_150)] text-white"
                : "bg-white text-gray-600 border border-gray-200"}`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPeriod("custom")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation flex items-center gap-1
            ${period === "custom"
              ? "bg-[oklch(0.35_0.12_150)] text-white"
              : "bg-white text-gray-600 border border-gray-200"}`}
        >
          <CalendarRange className="w-3.5 h-3.5" /> Период
        </button>
      </div>

      {period === "custom" && (
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm bg-white"
          />
          <span className="text-gray-400 text-xs">—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm bg-white"
          />
        </div>
      )}

      {/* Period Stats */}
      {overviewQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : periodData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Общий надой" value={`${periodData.total.volumeL} л`} sub={`${periodData.sessions} доек`} />
            <StatCard label="Нетто" value={`${periodData.total.netL} л`} sub="после выпойки и потерь" accent />
            <StatCard label="Принято" value={`${periodData.total.acceptedL} л`} sub="сыроделом" color="emerald" />
            <StatCard label="Отклонено" value={`${periodData.total.rejectedL} л`} sub="забраковано" color={periodData.total.rejectedL > 0 ? "red" : "gray"} />
          </div>

          {/* Per-type breakdown */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-3">По типам молока</h3>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Тип</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Надой</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Выпойка</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Потери</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Нетто</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Принято</th>
                  </tr>
                </thead>
                <tbody>
                  {(["goat", "sheep", "cow"] as const).map((type) => {
                    const d = periodData[type];
                    if (!d || d.volumeL === 0) return null;
                    const label = type === "goat" ? "🐐 Козье" : type === "sheep" ? "🐑 Овечье" : "🐄 Коровье";
                    return (
                      <tr key={type} className="border-b border-gray-50">
                        <td className="py-2 font-medium text-gray-700">{label}</td>
                        <td className="text-right py-2 text-gray-600">{d.volumeL}</td>
                        <td className="text-right py-2 text-gray-600">{d.feedingL}</td>
                        <td className="text-right py-2 text-gray-600">{d.lossesL}</td>
                        <td className="text-right py-2 font-semibold text-gray-800">{d.netL}</td>
                        <td className="text-right py-2 text-emerald-600 font-medium">{d.acceptedL}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-2 text-gray-800">Итого</td>
                    <td className="text-right py-2">{periodData.total.volumeL}</td>
                    <td className="text-right py-2">{periodData.total.feedingL}</td>
                    <td className="text-right py-2">{periodData.total.lossesL}</td>
                    <td className="text-right py-2">{periodData.total.netL}</td>
                    <td className="text-right py-2 text-emerald-600">{periodData.total.acceptedL}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Analytics */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Аналитика</h3>
            <div className="grid grid-cols-3 gap-3">
              <AnalyticChip
                label="% выпойки"
                value={periodData.total.volumeL > 0
                  ? `${((periodData.total.feedingL / periodData.total.volumeL) * 100).toFixed(1)}%`
                  : "—"}
              />
              <AnalyticChip
                label="% потерь"
                value={periodData.total.volumeL > 0
                  ? `${((periodData.total.lossesL / periodData.total.volumeL) * 100).toFixed(1)}%`
                  : "—"}
                warn={periodData.total.volumeL > 0 && (periodData.total.lossesL / periodData.total.volumeL) > 0.05}
              />
              <AnalyticChip
                label="Ср. на голову"
                value={periodData.total.heads > 0
                  ? `${(periodData.total.volumeL / periodData.total.heads).toFixed(2)} л`
                  : "—"}
              />
            </div>
          </div>

          {/* Tank Overview */}
          {data?.tanks && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Ёмкости</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[oklch(0.35_0.12_150)] transition-all"
                    style={{ width: `${Math.min(100, data.tanks.fillPercent)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700">{data.tanks.fillPercent}%</span>
              </div>
              <p className="text-xs text-gray-500">
                {data.tanks.currentLiters} / {data.tanks.capacityLiters} л · {data.tanks.active} активных из {data.tanks.total}
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, sub, accent, color }: {
  label: string; value: string; sub: string; accent?: boolean; color?: string;
}) {
  const colorClasses = color === "emerald"
    ? "text-emerald-700"
    : color === "red"
      ? "text-red-600"
      : accent
        ? "text-[oklch(0.35_0.12_150)]"
        : "text-gray-800";
  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClasses}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function AnalyticChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${warn ? "bg-red-50" : "bg-gray-50"}`}>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${warn ? "text-red-600" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: SESSIONS
   ═══════════════════════════════════════════════════════════════ */

function SessionsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [workerFilter, setWorkerFilter] = useState<number | undefined>(undefined);

  const workersQuery = trpc.milkController.workers.useQuery();
  const milkers = useMemo(
    () => (workersQuery.data ?? []).filter((w: any) => w.role === "milker"),
    [workersQuery.data],
  );

  const sessionsQuery = trpc.milkController.sessions.useQuery({
    page,
    pageSize: 15,
    status: statusFilter ? (statusFilter as any) : undefined,
    workerId: workerFilter,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const total = sessionsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / 15);

  const handleExportExcel = () => {
    if (!sessions.length) return;
    const columns: ReportColumn[] = [
      { header: "Код", key: "sessionCode", width: 16 },
      { header: "Дояр", key: "workerName", width: 18 },
      { header: "Смена", key: "shift", width: 12 },
      { header: "Надой (л)", key: "totalVolumeLiters", width: 12 },
      { header: "Нетто (л)", key: "totalNetLiters", width: 12 },
      { header: "Статус", key: "statusLabel", width: 16 },
      { header: "Дата", key: "dateLabel", width: 14 },
    ];
    const rows = sessions.map((s: any) => ({
      ...s,
      shift: fmtShift(s.shift),
      statusLabel: fmtStatus(s.status),
      dateLabel: fmtDate(s.createdAt),
    }));
    exportExcel({ title: "Дойки — АРМ Контролёра", columns, rows, filename: "controller_sessions" });
    toast.success("Excel-файл скачан");
  };

  const handleExportPDF = () => {
    if (!sessions.length) return;
    const columns: ReportColumn[] = [
      { header: "Код", key: "sessionCode" },
      { header: "Дояр", key: "workerName" },
      { header: "Смена", key: "shift" },
      { header: "Надой (л)", key: "totalVolumeLiters" },
      { header: "Нетто (л)", key: "totalNetLiters" },
      { header: "Статус", key: "statusLabel" },
      { header: "Дата", key: "dateLabel" },
    ];
    const rows = sessions.map((s: any) => ({
      ...s,
      shift: fmtShift(s.shift),
      statusLabel: fmtStatus(s.status),
      dateLabel: fmtDate(s.createdAt),
    }));
    exportPDF({ title: "Дойки — АРМ Контролёра", columns, rows, filename: "controller_sessions" });
    toast.success("PDF-файл скачан");
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 px-3 text-xs bg-white flex-1 min-w-[120px]"
        >
          <option value="">Все статусы</option>
          <option value="in_progress">В процессе</option>
          <option value="pending_confirm">Ожидает</option>
          <option value="confirmed">Подтверждена</option>
          <option value="disputed">Оспорена</option>
        </select>
        <select
          value={workerFilter ?? ""}
          onChange={(e) => { setWorkerFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 px-3 text-xs bg-white flex-1 min-w-[120px]"
        >
          <option value="">Все дояры</option>
          {milkers.map((w: any) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8 text-xs gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs gap-1.5">
          <FileText className="w-3.5 h-3.5" /> PDF
        </Button>
      </div>

      {/* Session cards */}
      {sessionsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Нет данных</div>
      ) : (
        sessions.map((s: any) => (
          <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500">{s.sessionCode}</span>
                <Badge className={`text-[10px] ${STATUS_MAP[s.status]?.color ?? ""}`}>
                  {STATUS_MAP[s.status]?.label ?? s.status}
                </Badge>
              </div>
              <span className="text-[10px] text-gray-400">{fmtDate(s.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">👤 {s.workerName}</span>
              <span className="text-xs text-gray-400">· {fmtShift(s.shift)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(["goat", "sheep", "cow"] as const).map((type) => {
                const d = s[type];
                if (!d || d.volumeLiters === 0) return null;
                const emoji = type === "goat" ? "🐐" : type === "sheep" ? "🐑" : "🐄";
                return (
                  <div key={type} className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500">{emoji}</p>
                    <p className="text-sm font-bold text-gray-800">{d.netLiters} л</p>
                    <p className="text-[9px] text-gray-400">надой {d.volumeLiters}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
              <span className="text-xs text-gray-500">Итого нетто:</span>
              <span className="text-sm font-bold text-[oklch(0.35_0.12_150)]">{s.totalNetLiters} л</span>
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3: RECEPTIONS
   ═══════════════════════════════════════════════════════════════ */

function ReceptionsTab() {
  const [page, setPage] = useState(1);
  const [workerFilter, setWorkerFilter] = useState<number | undefined>(undefined);

  const workersQuery = trpc.milkController.workers.useQuery();
  const cheesemakers = useMemo(
    () => (workersQuery.data ?? []).filter((w: any) => w.role === "cheesemaker"),
    [workersQuery.data],
  );

  const receptionsQuery = trpc.milkController.receptions.useQuery({
    page,
    pageSize: 15,
    receiverWorkerId: workerFilter,
  });

  const receptions = receptionsQuery.data?.receptions ?? [];
  const total = receptionsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / 15);

  const handleExportExcel = () => {
    if (!receptions.length) return;
    const columns: ReportColumn[] = [
      { header: "Сессия", key: "sessionCode", width: 16 },
      { header: "Тип", key: "milkTypeLabel", width: 12 },
      { header: "Сыродел", key: "receiverName", width: 18 },
      { header: "Принято (л)", key: "acceptedVolumeLiters", width: 14 },
      { header: "Отклонено (л)", key: "rejectedVolumeLiters", width: 14 },
      { header: "Статус", key: "statusLabel", width: 14 },
      { header: "Дата", key: "dateLabel", width: 14 },
    ];
    const rows = receptions.map((r: any) => ({
      ...r,
      statusLabel: fmtStatus(r.status),
      dateLabel: fmtDate(r.createdAt),
    }));
    exportExcel({ title: "Приёмки — АРМ Контролёра", columns, rows, filename: "controller_receptions" });
    toast.success("Excel-файл скачан");
  };

  const handleExportPDF = () => {
    if (!receptions.length) return;
    const columns: ReportColumn[] = [
      { header: "Сессия", key: "sessionCode" },
      { header: "Тип", key: "milkTypeLabel" },
      { header: "Сыродел", key: "receiverName" },
      { header: "Принято (л)", key: "acceptedVolumeLiters" },
      { header: "Отклонено (л)", key: "rejectedVolumeLiters" },
      { header: "Статус", key: "statusLabel" },
      { header: "Дата", key: "dateLabel" },
    ];
    const rows = receptions.map((r: any) => ({
      ...r,
      statusLabel: fmtStatus(r.status),
      dateLabel: fmtDate(r.createdAt),
    }));
    exportPDF({ title: "Приёмки — АРМ Контролёра", columns, rows, filename: "controller_receptions" });
    toast.success("PDF-файл скачан");
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={workerFilter ?? ""}
          onChange={(e) => { setWorkerFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 px-3 text-xs bg-white flex-1"
        >
          <option value="">Все сыроделы</option>
          {cheesemakers.map((w: any) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Export */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8 text-xs gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs gap-1.5">
          <FileText className="w-3.5 h-3.5" /> PDF
        </Button>
      </div>

      {/* Reception cards */}
      {receptionsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : receptions.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Нет данных</div>
      ) : (
        receptions.map((r: any) => (
          <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500">{r.sessionCode}</span>
                <Badge className={`text-[10px] ${STATUS_MAP[r.status]?.color ?? ""}`}>
                  {STATUS_MAP[r.status]?.label ?? r.status}
                </Badge>
              </div>
              <span className="text-[10px] text-gray-400">{fmtDate(r.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">👤 {r.receiverName}</span>
              <Badge variant="outline" className="text-[10px]">{r.milkTypeLabel}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-emerald-600">Принято</p>
                <p className="text-lg font-bold text-emerald-700">{r.acceptedVolumeLiters} л</p>
              </div>
              <div className={`rounded-lg p-2.5 text-center ${r.rejectedVolumeLiters > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                <p className={`text-[10px] ${r.rejectedVolumeLiters > 0 ? "text-red-600" : "text-gray-500"}`}>Отклонено</p>
                <p className={`text-lg font-bold ${r.rejectedVolumeLiters > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {r.rejectedVolumeLiters} л
                </p>
              </div>
            </div>
            {r.rejectionReason && (
              <p className="text-[10px] text-red-500 mt-2 bg-red-50 rounded-lg px-2.5 py-1.5">
                Причина: {r.rejectionReason}
              </p>
            )}
            {r.note && (
              <p className="text-[10px] text-gray-500 mt-1.5 italic">💬 {r.note}</p>
            )}
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-9 w-9 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-9 w-9 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4: TANKS
   ═══════════════════════════════════════════════════════════════ */

function TanksTab() {
  const tanksQuery = trpc.milkController.tanks.useQuery(undefined, { refetchInterval: 30_000 });
  const reconciliationQuery = trpc.milkController.tankReconciliation.useQuery(undefined, { refetchInterval: 60_000 });

  const tanks = tanksQuery.data ?? [];
  const reconciliation = reconciliationQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Tank Status */}
      <h2 className="text-sm font-bold text-gray-800">Текущее состояние</h2>
      {tanksQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : tanks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Нет ёмкостей</div>
      ) : (
        <div className="space-y-3">
          {tanks.map((t: any) => (
            <div key={t.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Container className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">{t.milkTypeLabel}</Badge>
                </div>
                <Badge className={`text-[10px] ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.isActive ? "Активна" : "Неактивна"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      t.fillPercent > 90 ? "bg-red-500" : t.fillPercent > 70 ? "bg-amber-500" : "bg-[oklch(0.35_0.12_150)]"
                    }`}
                    style={{ width: `${Math.min(100, t.fillPercent)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700 w-10 text-right">{t.fillPercent}%</span>
              </div>
              <p className="text-[10px] text-gray-500">
                {t.currentVolumeLiters} / {t.capacityLiters} л
                {t.location ? ` · ${t.location}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reconciliation */}
      <h2 className="text-sm font-bold text-gray-800 mt-4">Сверка ёмкостей</h2>
      {reconciliationQuery.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : reconciliation.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">Нет данных для сверки</div>
      ) : (
        <div className="space-y-3">
          {reconciliation.map((t: any) => (
            <div
              key={t.id}
              className={`bg-white rounded-xl p-4 shadow-sm border ${
                t.isOk ? "border-gray-100" : "border-red-200 bg-red-50/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">{t.milkTypeLabel}</Badge>
                </div>
                {t.isOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Ожидаемый</p>
                  <p className="font-semibold text-gray-800">{t.expectedLiters} л</p>
                </div>
                <div>
                  <p className="text-gray-500">Фактический</p>
                  <p className="font-semibold text-gray-800">{t.actualLiters} л</p>
                </div>
                <div>
                  <p className="text-gray-500">Принято всего</p>
                  <p className="text-gray-600">{t.acceptedLiters} л</p>
                </div>
                <div>
                  <p className="text-gray-500">Расхождение</p>
                  <p className={`font-bold ${t.isOk ? "text-emerald-600" : "text-red-600"}`}>
                    {t.discrepancyLiters > 0 ? "+" : ""}{t.discrepancyLiters} л
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 5: AUDIT (Discrepancies + Audit Log)
   ═══════════════════════════════════════════════════════════════ */

function AuditTab() {
  const [auditPage, setAuditPage] = useState(1);
  const [discDays, setDiscDays] = useState(7);
  const [showAll, setShowAll] = useState(false);

  const discrepancyQuery = trpc.milkController.discrepancies.useQuery({ days: discDays });
  const auditQuery = trpc.milkController.auditLog.useQuery({ page: auditPage, pageSize: 20 });

  const allSessions = discrepancyQuery.data?.sessions ?? [];
  const displaySessions = showAll ? allSessions : allSessions.filter((s: any) => s.hasDiscrepancy || s.highLosses);
  const flaggedCount = discrepancyQuery.data?.flagged ?? 0;

  const auditLogs = auditQuery.data?.logs ?? [];
  const auditTotal = auditQuery.data?.total ?? 0;
  const auditTotalPages = Math.ceil(auditTotal / 20);

  const handleExportDiscrepancies = () => {
    if (!allSessions.length) return;
    const columns: ReportColumn[] = [
      { header: "Код", key: "sessionCode", width: 16 },
      { header: "Дояр", key: "workerName", width: 18 },
      { header: "Смена", key: "shiftLabel", width: 12 },
      { header: "% потерь", key: "lossPercent", width: 10 },
      { header: "Расхождение", key: "discrepancyLabel", width: 20 },
      { header: "Статус", key: "statusLabel", width: 14 },
      { header: "Дата", key: "dateLabel", width: 14 },
    ];
    const rows = allSessions.map((s: any) => ({
      sessionCode: s.sessionCode,
      workerName: s.workerName,
      shiftLabel: fmtShift(s.shift),
      lossPercent: `${s.lossPercent}%`,
      discrepancyLabel: s.types
        .filter((t: any) => t.hasDiscrepancy)
        .map((t: any) => `${t.milkTypeLabel}: ${t.diffPercent}%`)
        .join(", ") || "—",
      statusLabel: fmtStatus(s.status),
      dateLabel: fmtDate(s.createdAt),
    }));
    exportExcel({ title: `Расхождения (${discDays} дн.)`, columns, rows, filename: "controller_discrepancies" });
    toast.success("Excel-файл скачан");
  };

  return (
    <div className="space-y-4">
      {/* Discrepancy Report */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Расхождения</h2>
        <div className="flex gap-1.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDiscDays(d)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors touch-manipulation
                ${discDays === d ? "bg-[oklch(0.35_0.12_150)] text-white" : "bg-white text-gray-500 border border-gray-200"}`}
            >
              {d} дн.
            </button>
          ))}
        </div>
      </div>

      {discrepancyQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${flaggedCount > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
              {flaggedCount > 0 ? `⚠ ${flaggedCount} проблем` : "✓ Всё в норме"}
            </Badge>
            <span className="text-[10px] text-gray-400">из {allSessions.length} сессий</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-[10px] px-2"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Только проблемы" : "Показать все"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportDiscrepancies} className="h-7 text-[10px] px-2 gap-1">
              <Download className="w-3 h-3" /> Excel
            </Button>
          </div>

          {displaySessions.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              {showAll ? "Нет данных за период" : "Расхождений не обнаружено"}
            </div>
          ) : (
            displaySessions.map((s: any) => (
              <div
                key={s.sessionId}
                className={`bg-white rounded-xl p-4 shadow-sm border ${
                  s.hasDiscrepancy || s.highLosses ? "border-red-200" : "border-gray-100"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{s.sessionCode}</span>
                    {s.hasDiscrepancy && (
                      <Badge className="text-[9px] bg-red-100 text-red-700">Расхождение</Badge>
                    )}
                    {s.highLosses && (
                      <Badge className="text-[9px] bg-amber-100 text-amber-700">Потери &gt;5%</Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">{fmtDate(s.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">👤 {s.workerName}</span>
                  <span className="text-xs text-gray-400">· {fmtShift(s.shift)}</span>
                  <span className="text-xs text-gray-400">· Потери: {s.lossPercent}%</span>
                </div>
                {/* Per-type discrepancy details */}
                {s.types.map((t: any) => (
                  <div
                    key={t.milkType}
                    className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg mb-1 text-xs ${
                      t.hasDiscrepancy ? "bg-red-50" : "bg-gray-50"
                    }`}
                  >
                    <span className="text-gray-600">{t.milkTypeLabel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">Нетто: {t.netLiters}л</span>
                      <span className="text-gray-500">Принято: {t.acceptedLiters}л</span>
                      <span className={`font-bold ${t.hasDiscrepancy ? "text-red-600" : "text-gray-600"}`}>
                        {t.diffPercent > 0 ? "+" : ""}{t.diffPercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}

      {/* Audit Log */}
      <h2 className="text-sm font-bold text-gray-800 mt-4 flex items-center gap-2">
        <History className="w-4 h-4" /> Журнал операций
      </h2>

      {auditQuery.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">Журнал пуст</div>
      ) : (
        <div className="space-y-2">
          {auditLogs.map((l: any) => (
            <div key={l.id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-xs">
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-[9px]">{l.action}</Badge>
                <span className="text-[10px] text-gray-400">{fmtDate(l.createdAt)}</span>
              </div>
              <p className="text-gray-600">
                {l.workerName} · {l.entityType} #{l.entityId}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Audit pagination */}
      {auditTotalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)} className="h-9 w-9 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-500">{auditPage} / {auditTotalPages}</span>
          <Button variant="outline" size="sm" disabled={auditPage >= auditTotalPages} onClick={() => setAuditPage(auditPage + 1)} className="h-9 w-9 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Processing Tab — Controller read-only view with conversion analytics
// ═══════════════════════════════════════════════════════════════════

function ControllerProcessingTab() {
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dates = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return getPresetDates(preset);
  }, [preset, customFrom, customTo]);

  const sessionsQuery = trpc.milkController.processingSessions.useQuery(
    { dateFrom: dates.from, dateTo: dates.to },
    { enabled: !!dates.from && !!dates.to },
  );

  const conversionQuery = trpc.milkController.conversionAnalytics.useQuery(
    { dateFrom: dates.from, dateTo: dates.to, deviationThreshold: 15 },
    { enabled: !!dates.from && !!dates.to },
  );

  const sessions = sessionsQuery.data?.sessions ?? [];
  const alerts = conversionQuery.data?.alerts ?? [];
  const convSessions = conversionQuery.data?.sessions ?? [];

  const PROC_STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: "Черновик", color: "bg-gray-100 text-gray-700" },
    in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
    completed: { label: "Завершена", color: "bg-emerald-100 text-emerald-700" },
    cancelled: { label: "Отменена", color: "bg-red-100 text-red-700" },
  };

  const PROC_COLUMNS: ReportColumn[] = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Код сессии", key: "sessionCode", width: 18 },
    { header: "Сыродел", key: "worker", width: 16 },
    { header: "Вход (л)", key: "inputLiters", width: 10 },
    { header: "Статус", key: "status", width: 12 },
  ];

  const CONV_COLUMNS: ReportColumn[] = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Сессия", key: "sessionCode", width: 18 },
    { header: "Продукт", key: "product", width: 20 },
    { header: "Факт (л/ед)", key: "actual", width: 12 },
    { header: "Норма (л/ед)", key: "base", width: 12 },
    { header: "Отклонение %", key: "deviation", width: 12 },
  ];

  function exportSessions(format: "excel" | "pdf") {
    const rows = sessions.map((s: any) => ({
      date: s.shiftDate,
      sessionCode: s.sessionCode,
      worker: s.workerName ?? "—",
      inputLiters: (s.totalInputMl / 1000).toFixed(1),
      status: PROC_STATUS[s.status]?.label ?? s.status,
    }));
    const totalL = sessions.reduce((sum: number, s: any) => sum + s.totalInputMl, 0) / 1000;
    const config = {
      title: "Контроль переработки — Шерь Козу",
      subtitle: periodSubtitle(dates.from, dates.to),
      columns: PROC_COLUMNS,
      rows,
      summaryRows: [{ date: "ИТОГО", sessionCode: `${sessions.length} сессий`, worker: "", inputLiters: totalL.toFixed(1), status: "" }],
      filename: `Контроль_переработки_${dates.from}_${dates.to}`,
    };
    format === "excel" ? exportExcel(config) : exportPDF(config);
  }

  function exportConversion(format: "excel" | "pdf") {
    const rows: any[] = [];
    for (const s of convSessions) {
      for (const out of (s as any).outputs ?? []) {
        rows.push({
          date: (s as any).shiftDate,
          sessionCode: (s as any).sessionCode,
          product: out.productLabel,
          actual: out.actualConversionRatio?.toFixed(2) ?? "—",
          base: out.baseConversionRatio?.toFixed(2) ?? "—",
          deviation: out.deviationPercent != null ? `${out.deviationPercent > 0 ? "+" : ""}${out.deviationPercent.toFixed(1)}%` : "—",
        });
      }
    }
    const config = {
      title: "Коэффициенты конверсии — Шерь Козу",
      subtitle: periodSubtitle(dates.from, dates.to) + (alerts.length > 0 ? ` | ⚠ ${alerts.length} отклонений` : ""),
      columns: CONV_COLUMNS,
      rows,
      filename: `Конверсия_${dates.from}_${dates.to}`,
    };
    format === "excel" ? exportExcel(config) : exportPDF(config);
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Period selector */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(["today", "week", "month", "custom"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              preset === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {p === "custom" && <CalendarRange className="w-3 h-3" />}
            {p === "today" ? "Сегодня" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Период"}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white" />
          <span className="text-xs text-gray-400">—</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white" />
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
            <AlertTriangle className="w-4 h-4" /> Отклонения конверсии ({alerts.length})
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1.5">
            {alerts.map((a: any, i: number) => (
              <div key={i} className="text-xs text-red-600 flex flex-wrap items-center gap-1.5 bg-white/60 rounded-lg px-2 py-1">
                <span className="font-mono font-medium">{a.sessionCode}</span>
                <span className="text-red-500">•</span>
                <span>{a.productLabel}</span>
                <Badge className="rounded-full text-[9px] bg-red-100 text-red-700 ml-auto">
                  {a.deviationPercent > 0 ? "+" : ""}{a.deviationPercent.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => exportSessions("excel")} className="text-xs h-8 rounded-lg">
          <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Сессии Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportSessions("pdf")} className="text-xs h-8 rounded-lg">
          <FileText className="w-3.5 h-3.5 mr-1" /> Сессии PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportConversion("excel")} className="text-xs h-8 rounded-lg">
          <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Конверсия Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportConversion("pdf")} className="text-xs h-8 rounded-lg">
          <FileText className="w-3.5 h-3.5 mr-1" /> Конверсия PDF
        </Button>
      </div>

      {/* Sessions table */}
      {sessionsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-center text-gray-400 py-6">Нет сессий за период</p>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-gray-700">Сессии переработки ({sessions.length})</h3>
          <div className="border rounded-xl overflow-x-auto max-h-[250px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Код</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Вход (л)</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((s: any) => {
                  const st = PROC_STATUS[s.status] ?? { label: s.status, color: "" };
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-2 py-1.5 font-mono">{s.sessionCode}</td>
                      <td className="px-2 py-1.5">{s.shiftDate}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-emerald-700">{(s.totalInputMl / 1000).toFixed(1)}</td>
                      <td className="px-2 py-1.5">
                        <Badge className={`rounded-full text-[9px] ${st.color}`}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Conversion analytics */}
      {conversionQuery.isLoading ? null : convSessions.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 pt-2">Коэффициенты конверсии</h3>
          <div className="space-y-2">
            {convSessions.map((s: any) => (
              <div key={s.sessionId} className="bg-white border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-medium text-gray-700">{s.sessionCode}</span>
                  <span className="text-[10px] text-gray-400">{s.shiftDate}</span>
                  <span className="text-[10px] text-gray-400">• {(s.totalInputMl / 1000).toFixed(1)} л</span>
                </div>
                {(s.outputs ?? []).length === 0 ? (
                  <p className="text-[10px] text-gray-400">Нет выходных данных</p>
                ) : (
                  <div className="space-y-1">
                    {(s.outputs ?? []).map((out: any, i: number) => {
                      const dev = out.deviationPercent;
                      const isAlert = dev !== null && Math.abs(dev) > 15;
                      const isWarn = dev !== null && Math.abs(dev) > 5 && !isAlert;
                      return (
                        <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${isAlert ? "bg-red-50" : isWarn ? "bg-amber-50" : "bg-gray-50"}`}>
                          <span className="font-medium text-gray-700">{out.productLabel}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">
                              {out.actualConversionRatio?.toFixed(2) ?? "—"} / {out.baseConversionRatio?.toFixed(2) ?? "—"}
                            </span>
                            {dev !== null && (
                              <Badge className={`rounded-full text-[9px] ${isAlert ? "bg-red-100 text-red-700" : isWarn ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {dev > 0 ? "+" : ""}{dev.toFixed(1)}%
                              </Badge>
                            )}
                            {isAlert && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
