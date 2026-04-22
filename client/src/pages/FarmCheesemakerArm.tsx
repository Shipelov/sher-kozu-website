/**
 * /farm/cheesemaker — Cheesemaker ARM (Automated Workstation).
 *
 * Mobile-first interface for:
 * - Accepting/rejecting milk per type (goat/sheep/cow) from milking sessions
 * - Managing milk tanks (each tank is typed by milkType)
 * - Viewing reception history with milkType labels
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarRange,
  Check,
  Clock,
  Container,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  LogOut,
  Milk,
  ThumbsDown,
  ThumbsUp,
  X,
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

const MILK_TYPE_EMOJI: Record<string, string> = {
  goat: "🐐",
  sheep: "🐑",
  cow: "🐄",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_confirm: { label: "Ожидает", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Подтверждена", color: "bg-emerald-100 text-emerald-700" },
  accepted: { label: "Принято", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Отклонено", color: "bg-red-100 text-red-700" },
};

const TANK_STATUS_MAP: Record<string, { label: string; color: string }> = {
  empty: { label: "Пустой", color: "bg-gray-100 text-gray-600" },
  filling: { label: "Заполняется", color: "bg-blue-100 text-blue-700" },
  full: { label: "Полный", color: "bg-emerald-100 text-emerald-700" },
  processing: { label: "В переработке", color: "bg-purple-100 text-purple-700" },
  cleaning: { label: "На мойке", color: "bg-amber-100 text-amber-700" },
};

export default function FarmCheesemakerArm() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"reception" | "tanks" | "history" | "report">("reception");

  // ─── Report state ───
  const [reportPreset, setReportPreset] = useState<"today" | "week" | "month" | "custom">("week");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const reportDates = useMemo(() => {
    if (reportPreset === "custom") return { from: reportFrom, to: reportTo };
    return getPresetDates(reportPreset);
  }, [reportPreset, reportFrom, reportTo]);

  const reportQuery = trpc.milkReception.reportData.useQuery(
    { dateFrom: reportDates.from, dateTo: reportDates.to },
    { enabled: view === "report" && !!reportDates.from && !!reportDates.to },
  );

  // ─── Auth ───
  const meQuery = trpc.farmAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.farmAuth.logout.useMutation({
    onSuccess: () => navigate("/farm"),
  });

  useEffect(() => {
    if (!meQuery.isLoading && !meQuery.data) navigate("/farm");
    if (meQuery.data?.mustChangePassword) navigate("/farm/change-password");
  }, [meQuery.isLoading, meQuery.data, navigate]);

  // ─── Accept dialog state ───
  const [acceptItem, setAcceptItem] = useState<any>(null);
  const [acceptVolume, setAcceptVolume] = useState("");
  const [rejectVolume, setRejectVolume] = useState("0");
  const [acceptTankId, setAcceptTankId] = useState<string>("");
  const [acceptTemp, setAcceptTemp] = useState("");
  const [acceptDensity, setAcceptDensity] = useState("");
  const [acceptFat, setAcceptFat] = useState("");
  const [acceptAcidity, setAcceptAcidity] = useState("");
  const [acceptNote, setAcceptNote] = useState("");

  // ─── Reject dialog state ───
  const [rejectItem, setRejectItem] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ─── Queries ───
  const pendingQuery = trpc.milkReception.pendingSessions.useQuery(undefined, {
    enabled: !!meQuery.data,
    refetchInterval: 30_000,
  });

  const tanksQuery = trpc.milkTank.list.useQuery(undefined, {
    enabled: !!meQuery.data,
  });

  const historyQuery = trpc.milkReception.myReceptions.useQuery(
    { page: 1, pageSize: 30 },
    { enabled: !!meQuery.data && view === "history" },
  );

  const utils = trpc.useUtils();

  const acceptMutation = trpc.milkReception.accept.useMutation({
    onSuccess: (data: any) => {
      toast.success("Молоко принято!", {
        description: `${MILK_TYPE_EMOJI[data.milkType] ?? ""} В танке теперь ${data.tankNewVolumeLiters} л`,
      });
      setAcceptItem(null);
      resetAcceptForm();
      void utils.milkReception.pendingSessions.invalidate();
      void utils.milkTank.list.invalidate();
      void utils.milkReception.myReceptions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const rejectMutation = trpc.milkReception.reject.useMutation({
    onSuccess: () => {
      toast.success("Молоко отклонено");
      setRejectItem(null);
      setRejectReason("");
      void utils.milkReception.pendingSessions.invalidate();
      void utils.milkReception.myReceptions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  function resetAcceptForm() {
    setAcceptVolume("");
    setRejectVolume("0");
    setAcceptTankId("");
    setAcceptTemp("");
    setAcceptDensity("");
    setAcceptFat("");
    setAcceptAcidity("");
    setAcceptNote("");
  }

  function openAcceptDialog(item: any) {
    setAcceptItem(item);
    setAcceptVolume(String(item.netVolumeLiters));
    setRejectVolume("0");
    // Auto-select tank matching milk type if only one available
    const matchingTanks = (tanksQuery.data ?? []).filter(
      (t: any) => t.isActive && t.milkType === item.milkType && t.status !== "cleaning" && t.status !== "processing",
    );
    if (matchingTanks.length === 1) {
      setAcceptTankId(String(matchingTanks[0].id));
    } else {
      setAcceptTankId("");
    }
  }

  // ─── Loading / Auth guard ───
  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[oklch(0.97_0.015_90)]">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.40_0.12_80)]" />
      </div>
    );
  }

  const worker = meQuery.data;
  if (!worker) return null;

  const pendingItems = pendingQuery.data ?? [];
  const tanks = (tanksQuery.data ?? []) as any[];

  // For accept dialog: only show tanks matching the selected milk type
  const matchingTanks = acceptItem
    ? tanks.filter(
        (t: any) =>
          t.isActive &&
          t.milkType === acceptItem.milkType &&
          t.status !== "cleaning" &&
          t.status !== "processing",
      )
    : [];

  return (
    <div className="min-h-dvh flex flex-col bg-[oklch(0.97_0.015_90)]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[oklch(0.9_0.02_90)] shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.40_0.12_80)] flex items-center justify-center">
            <Container className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[oklch(0.22_0.04_60)] leading-tight">
              {worker.name}
            </p>
            <p className="text-xs text-[oklch(0.52_0.04_80)]">АРМ Сыродела</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/farm/change-password")}
            className="h-10 w-10 text-[oklch(0.52_0.04_80)] touch-manipulation"
          >
            <span className="text-lg">🔑</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logoutMutation.mutate()}
            className="h-10 w-10 text-[oklch(0.52_0.04_80)] hover:text-red-500 touch-manipulation"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* ── Tab switcher ── */}
      <div className="flex bg-white border-b border-[oklch(0.9_0.02_90)]">
        <button
          onClick={() => setView("reception")}
          className={`flex-1 py-3 text-xs font-medium text-center touch-manipulation transition-colors
            ${view === "reception" ? "text-[oklch(0.40_0.12_80)] border-b-2 border-[oklch(0.40_0.12_80)]" : "text-[oklch(0.52_0.04_80)]"}`}
        >
          <Milk className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          Приёмка
          {pendingItems.length > 0 && (
            <Badge className="ml-1 rounded-full text-[9px] bg-red-500 text-white px-1.5 py-0">
              {pendingItems.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setView("tanks")}
          className={`flex-1 py-3 text-xs font-medium text-center touch-manipulation transition-colors
            ${view === "tanks" ? "text-[oklch(0.40_0.12_80)] border-b-2 border-[oklch(0.40_0.12_80)]" : "text-[oklch(0.52_0.04_80)]"}`}
        >
          <Container className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          Танки
        </button>
        <button
          onClick={() => setView("history")}
          className={`flex-1 py-3 text-xs font-medium text-center touch-manipulation transition-colors
            ${view === "history" ? "text-[oklch(0.40_0.12_80)] border-b-2 border-[oklch(0.40_0.12_80)]" : "text-[oklch(0.52_0.04_80)]"}`}
        >
          <History className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          История
        </button>
        <button
          onClick={() => setView("report")}
          className={`flex-1 py-3 text-xs font-medium text-center touch-manipulation transition-colors
            ${view === "report" ? "text-[oklch(0.40_0.12_80)] border-b-2 border-[oklch(0.40_0.12_80)]" : "text-[oklch(0.52_0.04_80)]"}`}
        >
          <Download className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          Отчёт
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* ═══ RECEPTION TAB ═══ */}
        {view === "reception" && (
          <div className="px-4 mt-4 space-y-3">
            {pendingQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-[oklch(0.52_0.04_80)]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="text-center py-12">
                <Check className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-medium text-[oklch(0.3_0.04_60)]">Всё принято</p>
                <p className="text-xs text-[oklch(0.52_0.04_80)] mt-1">
                  Нет молока, ожидающего приёмки
                </p>
              </div>
            ) : (
              (pendingItems as any[]).map((item: any, idx: number) => (
                <div
                  key={`${item.sessionId}-${item.milkType}`}
                  className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4"
                >
                  {/* Header: session code + milk type badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                        {item.sessionCode}
                      </span>
                      <Badge className="rounded-full text-[10px] bg-[oklch(0.92_0.04_80)] text-[oklch(0.3_0.08_80)]">
                        {MILK_TYPE_EMOJI[item.milkType]} {item.milkTypeLabel}
                      </Badge>
                    </div>
                    <span className="text-xs text-[oklch(0.52_0.04_80)]">{item.workerName}</span>
                  </div>

                  {/* Net volume (what goes to cheesemaker) */}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-[oklch(0.6_0.02_80)]">Надой</span>
                      <p className="font-semibold text-sm text-[oklch(0.22_0.04_60)]">
                        {item.totalVolumeLiters} л
                      </p>
                    </div>
                    <div>
                      <span className="text-[oklch(0.6_0.02_80)]">Выпойка</span>
                      <p className="font-semibold text-sm text-amber-600">
                        −{item.feedingLiters} л
                      </p>
                    </div>
                    <div>
                      <span className="text-[oklch(0.6_0.02_80)]">Потери</span>
                      <p className="font-semibold text-sm text-red-500">
                        −{item.lossesLiters} л
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[oklch(0.95_0.03_140)] rounded-lg px-3 py-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[oklch(0.35_0.08_140)]">Сыроделу:</span>
                      <span className="text-lg font-bold text-[oklch(0.30_0.12_140)]">
                        {item.netVolumeLiters} л
                      </span>
                    </div>
                    <span className="text-xs text-[oklch(0.5_0.04_80)]">
                      {item.headCount} гол.
                    </span>
                  </div>

                  {(item.temperatureCelsius != null || item.densityGCm3 != null) && (
                    <div className="flex gap-3 text-[10px] text-[oklch(0.52_0.04_80)] mb-3">
                      {item.temperatureCelsius != null && <span>🌡 {item.temperatureCelsius}°C</span>}
                      {item.densityGCm3 != null && <span>💧 {item.densityGCm3}</span>}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => openAcceptDialog(item)}
                      className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
                                 active:bg-emerald-800 touch-manipulation text-sm font-medium"
                    >
                      <ThumbsUp className="w-4 h-4 mr-1.5" />
                      Принять
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectItem(item)}
                      className="h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50
                                 active:bg-red-100 touch-manipulation px-4"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ TANKS TAB ═══ */}
        {view === "tanks" && (
          <div className="px-4 mt-4 space-y-3">
            {tanksQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-[oklch(0.52_0.04_80)]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…
              </div>
            ) : tanks.length === 0 ? (
              <div className="text-center py-12">
                <Container className="w-12 h-12 mx-auto mb-3 text-[oklch(0.8_0.02_90)]" />
                <p className="text-sm text-[oklch(0.52_0.04_80)]">Нет танков</p>
                <p className="text-xs text-[oklch(0.6_0.02_80)] mt-1">
                  Администратор должен создать танки в админ-панели
                </p>
              </div>
            ) : (
              tanks.map((t: any) => {
                const st = TANK_STATUS_MAP[t.status] ?? TANK_STATUS_MAP.empty;
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[oklch(0.22_0.04_60)]">
                          {t.name}
                        </span>
                        <Badge className="rounded-full text-[10px] bg-[oklch(0.92_0.04_80)] text-[oklch(0.3_0.08_80)]">
                          {MILK_TYPE_EMOJI[t.milkType]} {t.milkTypeLabel}
                        </Badge>
                      </div>
                      <Badge className={`rounded-full text-[10px] ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>

                    {t.location && (
                      <p className="text-xs text-[oklch(0.52_0.04_80)] mb-2">📍 {t.location}</p>
                    )}

                    {/* Volume bar */}
                    <div className="mt-1">
                      <div className="flex justify-between text-xs text-[oklch(0.52_0.04_80)] mb-1">
                        <span>{t.currentVolumeLiters} л</span>
                        <span>{t.capacityLiters} л</span>
                      </div>
                      <div className="h-3 bg-[oklch(0.94_0.02_90)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            t.fillPercent >= 90
                              ? "bg-red-400"
                              : t.fillPercent >= 60
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(t.fillPercent, 100)}%` }}
                        />
                      </div>
                      <p className="text-center text-xs font-medium text-[oklch(0.4_0.04_80)] mt-1">
                        {t.fillPercent}%
                      </p>
                    </div>

                    {!t.isActive && (
                      <p className="text-[10px] text-red-500 mt-2">Танк неактивен</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {view === "history" && (
          <div className="px-4 mt-4 space-y-3">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-[oklch(0.52_0.04_80)]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…
              </div>
            ) : !historyQuery.data?.receptions.length ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto mb-3 text-[oklch(0.8_0.02_90)]" />
                <p className="text-sm text-[oklch(0.52_0.04_80)]">Нет записей</p>
              </div>
            ) : (
              historyQuery.data.receptions.map((r: any) => {
                const st = STATUS_MAP[r.status] ?? STATUS_MAP.accepted;
                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                          {r.sessionCode}
                        </span>
                        <Badge className="rounded-full text-[10px] bg-[oklch(0.92_0.04_80)] text-[oklch(0.3_0.08_80)]">
                          {MILK_TYPE_EMOJI[r.milkType]} {r.milkTypeLabel}
                        </Badge>
                      </div>
                      <Badge className={`rounded-full text-[10px] ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[oklch(0.6_0.02_80)]">Принято</span>
                        <p className="font-semibold text-sm text-emerald-700">
                          {r.acceptedVolumeLiters} л
                        </p>
                      </div>
                      {r.rejectedVolumeMl > 0 && (
                        <div>
                          <span className="text-[oklch(0.6_0.02_80)]">Отклонено</span>
                          <p className="font-semibold text-sm text-red-600">
                            {(r.rejectedVolumeMl / 1000).toFixed(2)} л
                          </p>
                        </div>
                      )}
                    </div>
                    {r.rejectionReason && (
                      <p className="text-xs text-red-600 mt-2">
                        Причина: {r.rejectionReason}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[oklch(0.6_0.02_80)]">
                      <Clock className="w-3 h-3" />
                      {new Date(r.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Report view ── */}
      {view === "report" && (
        <div className="p-4 space-y-4">
          <h2 className="text-base font-semibold text-[oklch(0.22_0.04_60)]">
            Отчёт сыродела
          </h2>

          {/* Period selector */}
          <div className="space-y-3">
            <div className="flex gap-1 bg-[oklch(0.96_0.01_90)] rounded-lg p-1">
              {(["today", "week", "month", "custom"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setReportPreset(p)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    reportPreset === p
                      ? "bg-white text-[oklch(0.22_0.04_60)] shadow-sm"
                      : "text-[oklch(0.5_0.04_80)]"
                  }`}
                >
                  {p === "custom" && <CalendarRange className="w-3 h-3" />}
                  {p === "today" ? "Сегодня" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Период"}
                </button>
              ))}
            </div>

            {reportPreset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white"
                />
                <span className="text-xs text-[oklch(0.52_0.04_80)]">—</span>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white"
                />
              </div>
            )}
          </div>

          {/* Status */}
          {reportQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[oklch(0.5_0.04_80)]" />
              <span className="ml-2 text-sm text-[oklch(0.52_0.04_80)]">Загрузка данных...</span>
            </div>
          )}

          {reportQuery.data && (
            <div className="space-y-4">
              <p className="text-sm text-[oklch(0.52_0.04_80)]">
                Приёмок: <span className="font-semibold text-[oklch(0.22_0.04_60)]">{reportQuery.data.receptions.length}</span>,{" "}
                движений по танкам: <span className="font-semibold text-[oklch(0.22_0.04_60)]">{reportQuery.data.movements.length}</span>
              </p>

              {/* Download buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => exportCheesemakerExcel(reportQuery.data!, reportDates.from, reportDates.to)}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-[oklch(0.40_0.12_80)] text-[oklch(0.40_0.12_80)]"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button
                  onClick={() => exportCheesemakerPDF(reportQuery.data!, reportDates.from, reportDates.to)}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-[oklch(0.40_0.12_80)] text-[oklch(0.40_0.12_80)]"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>

              {/* Receptions preview */}
              {reportQuery.data.receptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[oklch(0.22_0.04_60)] mb-2">Приёмка молока</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[oklch(0.96_0.01_90)]">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Тип</th>
                          <th className="px-2 py-1.5 text-right font-semibold">Принято, л</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {reportQuery.data.receptions.slice(0, 15).map((r: any) => (
                          <tr key={r.id} className="hover:bg-[oklch(0.98_0.005_90)]">
                            <td className="px-2 py-1.5">{fmtDate(r.createdAt)}</td>
                            <td className="px-2 py-1.5">{MILK_TYPE_EMOJI[r.milkType]} {r.milkTypeLabel}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-emerald-700">{r.acceptedVolumeLiters}</td>
                            <td className="px-2 py-1.5">{fmtStatus(r.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportQuery.data.receptions.length > 15 && (
                      <p className="text-center text-[10px] text-[oklch(0.6_0.02_80)] py-1">
                        Показано 15 из {reportQuery.data.receptions.length}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Movements preview */}
              {reportQuery.data.movements.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[oklch(0.22_0.04_60)] mb-2">Движения по танкам</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[oklch(0.96_0.01_90)]">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Танк</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Тип</th>
                          <th className="px-2 py-1.5 text-right font-semibold">Объём, л</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {reportQuery.data.movements.slice(0, 15).map((m: any) => (
                          <tr key={m.id} className="hover:bg-[oklch(0.98_0.005_90)]">
                            <td className="px-2 py-1.5">{fmtDate(m.createdAt)}</td>
                            <td className="px-2 py-1.5">{m.tankName}</td>
                            <td className="px-2 py-1.5">{MILK_TYPE_EMOJI[m.milkType]} {fmtMovementType(m.movementType)}</td>
                            <td className={`px-2 py-1.5 text-right font-medium ${m.volumeMl >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                              {m.volumeLiters > 0 ? "+" : ""}{m.volumeLiters}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportQuery.data.movements.length > 15 && (
                      <p className="text-center text-[10px] text-[oklch(0.6_0.02_80)] py-1">
                        Показано 15 из {reportQuery.data.movements.length}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {reportPreset === "custom" && (!reportFrom || !reportTo) && (
            <p className="text-sm text-center text-[oklch(0.52_0.04_80)] py-4">
              Укажите начальную и конечную дату
            </p>
          )}
        </div>
      )}

      {/* ── Accept Dialog ── */}
      <Dialog open={!!acceptItem} onOpenChange={() => setAcceptItem(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              Приёмка {acceptItem?.sessionCode}
              {acceptItem && (
                <Badge className="rounded-full text-[10px] bg-[oklch(0.92_0.04_80)] text-[oklch(0.3_0.08_80)]">
                  {MILK_TYPE_EMOJI[acceptItem.milkType]} {acceptItem.milkTypeLabel}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Volume */}
            <div>
              <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
                Принимаемый объём (л)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={acceptVolume}
                onChange={(e) => setAcceptVolume(e.target.value)}
                className="h-12 text-lg font-bold text-center rounded-xl"
              />
              <p className="text-[10px] text-[oklch(0.6_0.02_80)] mt-1">
                Дояр заявил: {acceptItem?.volumeLiters} л ({acceptItem?.headCount} гол.)
              </p>
            </div>

            {/* Rejected volume */}
            <div>
              <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
                Отклонённый объём (л)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={rejectVolume}
                onChange={(e) => setRejectVolume(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>

            {/* Target tank (filtered by milk type) */}
            <div>
              <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
                Целевой танк ({acceptItem?.milkTypeLabel})
              </label>
              {matchingTanks.length === 0 ? (
                <p className="text-xs text-red-500 p-3 bg-red-50 rounded-xl">
                  Нет доступных танков для {acceptItem?.milkTypeLabel?.toLowerCase()} молока.
                  Попросите администратора создать танк.
                </p>
              ) : (
                <Select value={acceptTankId} onValueChange={setAcceptTankId}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Выберите танк" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingTanks.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} — {t.currentVolumeLiters}/{t.capacityLiters} л ({t.fillPercent}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Quality params */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                  🌡 Температура, °C
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="—"
                  value={acceptTemp}
                  onChange={(e) => setAcceptTemp(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                  💧 Плотность, г/см³
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  placeholder="—"
                  value={acceptDensity}
                  onChange={(e) => setAcceptDensity(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                  🧈 Жирность, %
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="—"
                  value={acceptFat}
                  onChange={(e) => setAcceptFat(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                  🧪 Кислотность, °T
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={acceptAcidity}
                  onChange={(e) => setAcceptAcidity(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Note */}
            <textarea
              placeholder="Заметка (необязательно)"
              value={acceptNote}
              onChange={(e) => setAcceptNote(e.target.value)}
              maxLength={1000}
              rows={2}
              className="w-full rounded-xl border border-[oklch(0.88_0.02_90)] bg-white px-4 py-3
                         text-sm resize-none focus:outline-none focus:border-[oklch(0.40_0.12_80)]
                         focus:ring-1 focus:ring-[oklch(0.40_0.12_80)]"
            />
          </div>
          <DialogFooter className="pt-3 gap-2">
            <Button variant="outline" onClick={() => setAcceptItem(null)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              disabled={
                !acceptVolume ||
                parseFloat(acceptVolume) <= 0 ||
                !acceptTankId ||
                acceptMutation.isPending
              }
              onClick={() => {
                if (!acceptItem) return;
                acceptMutation.mutate({
                  sessionId: acceptItem.sessionId,
                  milkType: acceptItem.milkType,
                  acceptedVolumeMl: Math.round(parseFloat(acceptVolume) * 1000),
                  rejectedVolumeMl: Math.round(parseFloat(rejectVolume || "0") * 1000),
                  targetTankId: parseInt(acceptTankId),
                  temperatureCelsius: acceptTemp ? parseFloat(acceptTemp) : undefined,
                  densityGCm3: acceptDensity ? parseFloat(acceptDensity) : undefined,
                  fatPercent: acceptFat ? parseFloat(acceptFat) : undefined,
                  acidityTurner: acceptAcidity ? parseInt(acceptAcidity) : undefined,
                  note: acceptNote.trim() || undefined,
                });
              }}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Принять
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={!!rejectItem} onOpenChange={() => setRejectItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-red-600 flex items-center gap-2">
              Отклонить {rejectItem?.sessionCode}
              {rejectItem && (
                <Badge className="rounded-full text-[10px] bg-red-100 text-red-700">
                  {MILK_TYPE_EMOJI[rejectItem.milkType]} {rejectItem.milkTypeLabel}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-[oklch(0.52_0.04_80)]">
              Объём: <strong>{rejectItem?.volumeLiters} л</strong> ({rejectItem?.milkTypeLabel}) будет полностью отклонён.
            </p>
            <textarea
              placeholder="Причина отклонения (обязательно)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl border border-red-200 bg-white px-4 py-3
                         text-sm resize-none focus:outline-none focus:border-red-400
                         focus:ring-1 focus:ring-red-400"
            />
          </div>
          <DialogFooter className="pt-3 gap-2">
            <Button variant="outline" onClick={() => setRejectItem(null)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 3 || rejectMutation.isPending}
              onClick={() => {
                if (!rejectItem) return;
                rejectMutation.mutate({
                  sessionId: rejectItem.sessionId,
                  milkType: rejectItem.milkType,
                  rejectionReason: rejectReason.trim(),
                });
              }}
              className="rounded-xl"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Report export helpers ──────────────────────────────────

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  milking_in: "Приёмка",
  processing_out: "В переработку",
  waste: "Списание",
  sample: "Проба",
  transfer: "Перелив",
};

function fmtMovementType(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] ?? type;
}

const RECEPTION_COLUMNS: ReportColumn[] = [
  { header: "Дата", key: "date", width: 14 },
  { header: "Код дойки", key: "sessionCode", width: 14 },
  { header: "Дата дойки", key: "milkingDate", width: 12 },
  { header: "Смена", key: "shift", width: 12 },
  { header: "Тип молока", key: "milkType", width: 14 },
  { header: "Принято (л)", key: "accepted", width: 12 },
  { header: "Отклонено (л)", key: "rejected", width: 12 },
  { header: "Статус", key: "status", width: 14 },
  { header: "Причина отказа", key: "reason", width: 20 },
  { header: "Примечание", key: "note", width: 20 },
];

const MOVEMENT_COLUMNS: ReportColumn[] = [
  { header: "Дата", key: "date", width: 14 },
  { header: "Танк", key: "tankName", width: 16 },
  { header: "Тип молока", key: "milkType", width: 14 },
  { header: "Операция", key: "movementType", width: 16 },
  { header: "Объём (л)", key: "volume", width: 12 },
  { header: "Остаток (л)", key: "tankAfter", width: 12 },
  { header: "Примечание", key: "note", width: 20 },
];

function mapReceptionRow(r: any) {
  return {
    date: fmtDate(r.createdAt),
    sessionCode: r.sessionCode,
    milkingDate: fmtDate(r.milkingDate),
    shift: fmtShift(r.shift),
    milkType: r.milkTypeLabel,
    accepted: r.acceptedVolumeLiters,
    rejected: r.rejectedVolumeLiters ?? 0,
    status: fmtStatus(r.status),
    reason: r.rejectionReason ?? "",
    note: r.note ?? "",
  };
}

function mapMovementRow(m: any) {
  return {
    date: fmtDate(m.createdAt),
    tankName: m.tankName,
    milkType: m.milkTypeLabel,
    movementType: fmtMovementType(m.movementType),
    volume: m.volumeLiters,
    tankAfter: m.tankVolumeAfterLiters,
    note: m.note ?? "",
  };
}

function exportCheesemakerExcel(
  data: { receptions: any[]; movements: any[] },
  from: string,
  to: string,
) {
  // Export receptions sheet
  const receptionRows = data.receptions.map(mapReceptionRow);
  const totalAccepted = receptionRows.reduce((a, r) => a + (Number(r.accepted) || 0), 0);
  const totalRejected = receptionRows.reduce((a, r) => a + (Number(r.rejected) || 0), 0);

  exportExcel({
    title: "Отчёт сыродела — Приёмка — Шерь Козу",
    subtitle: periodSubtitle(from, to),
    columns: RECEPTION_COLUMNS,
    rows: receptionRows,
    summaryRows: [{
      date: "ИТОГО",
      sessionCode: `${data.receptions.length} приёмок`,
      milkingDate: "", shift: "", milkType: "",
      accepted: +totalAccepted.toFixed(2),
      rejected: +totalRejected.toFixed(2),
      status: "", reason: "", note: "",
    }],
    filename: `Приёмка_${from}_${to}`,
  });

  // Also export movements if any
  if (data.movements.length > 0) {
    exportExcel({
      title: "Отчёт сыродела — Движения по танкам — Шерь Козу",
      subtitle: periodSubtitle(from, to),
      columns: MOVEMENT_COLUMNS,
      rows: data.movements.map(mapMovementRow),
      filename: `Танки_${from}_${to}`,
    });
  }
}

function exportCheesemakerPDF(
  data: { receptions: any[]; movements: any[] },
  from: string,
  to: string,
) {
  const receptionRows = data.receptions.map(mapReceptionRow);
  const totalAccepted = receptionRows.reduce((a, r) => a + (Number(r.accepted) || 0), 0);
  const totalRejected = receptionRows.reduce((a, r) => a + (Number(r.rejected) || 0), 0);

  exportPDF({
    title: "Отчёт сыродела — Приёмка — Шерь Козу",
    subtitle: periodSubtitle(from, to),
    columns: RECEPTION_COLUMNS,
    rows: receptionRows,
    summaryRows: [{
      date: "ИТОГО",
      sessionCode: `${data.receptions.length} приёмок`,
      milkingDate: "", shift: "", milkType: "",
      accepted: +totalAccepted.toFixed(2),
      rejected: +totalRejected.toFixed(2),
      status: "", reason: "", note: "",
    }],
    filename: `Приёмка_${from}_${to}`,
  });
}
