/**
 * Admin Milk Dashboard — /admin/milk
 *
 * Overview of milk turnover: stats, sessions, receptions, tanks, audit log.
 * With scrolling tables, edit/delete sessions, and clear data presentation.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exportExcel,
  exportPDF,
  periodSubtitle,
  type ReportColumn,
} from "@/lib/reportExport";
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
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Container,
  Droplets,
  FileSpreadsheet,
  FileText,
  Loader2,
  Milk,
  Package,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ScrollText,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
  pending_confirm: { label: "Ожидает", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Подтверждена", color: "bg-emerald-100 text-emerald-700" },
  disputed: { label: "Оспорена", color: "bg-red-100 text-red-700" },
};

const RECEPTION_STATUS: Record<string, { label: string; color: string }> = {
  accepted: { label: "Принято", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Отклонено", color: "bg-red-100 text-red-700" },
  partial: { label: "Частично", color: "bg-amber-100 text-amber-700" },
};

const TANK_STATUS: Record<string, { label: string; color: string }> = {
  empty: { label: "Пустой", color: "bg-gray-100 text-gray-600" },
  filling: { label: "Заполняется", color: "bg-blue-100 text-blue-700" },
  full: { label: "Полный", color: "bg-emerald-100 text-emerald-700" },
  processing: { label: "Переработка", color: "bg-purple-100 text-purple-700" },
  cleaning: { label: "Мойка", color: "bg-amber-100 text-amber-700" },
};

const ACTION_LABELS: Record<string, string> = {
  session_created: "Дойка создана",
  session_updated: "Дойка обновлена",
  session_submitted: "Дойка отправлена",
  session_auto_confirmed: "Автоподтверждение",
  session_confirmed: "Подтверждена",
  session_cancelled: "Дойка удалена",
  reception_accepted: "Молоко принято",
  reception_rejected: "Молоко отклонено",
  tank_movement: "Движение танка",
};

/** Convert liters string to ml integer */
function parseMl(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 1000);
}

export default function AdminMilkDashboard() {
  const [tab, setTab] = useState<"overview" | "sessions" | "receptions" | "tanks" | "processing" | "warehouses" | "audit">(
    "overview",
  );
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [receptionPage, setReceptionPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // ─── Tank create dialog ───
  const [showTankDialog, setShowTankDialog] = useState(false);
  const [tankName, setTankName] = useState("");
  const [tankMilkType, setTankMilkType] = useState<string>("goat");
  const [tankCapacity, setTankCapacity] = useState("");
  const [tankLocation, setTankLocation] = useState("");

  // ─── Session edit dialog ───
  const [editSession, setEditSession] = useState<any>(null);
  const [editGoatVol, setEditGoatVol] = useState("");
  const [editGoatHeads, setEditGoatHeads] = useState("");
  const [editGoatFeeding, setEditGoatFeeding] = useState("");
  const [editGoatLosses, setEditGoatLosses] = useState("");
  const [editSheepVol, setEditSheepVol] = useState("");
  const [editSheepHeads, setEditSheepHeads] = useState("");
  const [editSheepFeeding, setEditSheepFeeding] = useState("");
  const [editSheepLosses, setEditSheepLosses] = useState("");
  const [editCowVol, setEditCowVol] = useState("");
  const [editCowHeads, setEditCowHeads] = useState("");
  const [editCowFeeding, setEditCowFeeding] = useState("");
  const [editCowLosses, setEditCowLosses] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // ─── Delete confirm dialog ───
  const [deleteSession, setDeleteSession] = useState<any>(null);

  // ─── Reception edit/delete state ───
  const [editReception, setEditReception] = useState<any>(null);
  const [editRecAccepted, setEditRecAccepted] = useState("");
  const [editRecRejected, setEditRecRejected] = useState("");
  const [editRecStatus, setEditRecStatus] = useState("");
  const [editRecReason, setEditRecReason] = useState("");
  const [editRecNote, setEditRecNote] = useState("");
  const [deleteReception, setDeleteReception] = useState<any>(null);

  // Overview custom date range state
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const overviewInput = useMemo(
    () => (useCustom && customFrom && customTo ? { customFrom, customTo } : undefined),
    [useCustom, customFrom, customTo],
  );

  const overviewQuery = trpc.milkAdmin.overview.useQuery(overviewInput, {
    enabled: tab === "overview",
  });

  const sessionsQuery = trpc.milkAdmin.sessions.useQuery(
    {
      page: sessionPage,
      pageSize: 15,
      status: sessionStatus
        ? (sessionStatus as "in_progress" | "pending_confirm" | "confirmed" | "disputed")
        : undefined,
    },
    { enabled: tab === "sessions" },
  );

  const receptionsQuery = trpc.milkAdmin.receptions.useQuery(
    { page: receptionPage, pageSize: 15 },
    { enabled: tab === "receptions" },
  );

  const tanksQuery = trpc.milkAdmin.tanks.useQuery(undefined, {
    enabled: tab === "tanks",
  });

  const reconciliationQuery = trpc.milkAdmin.tankReconciliation.useQuery(undefined, {
    enabled: tab === "tanks",
  });

  const auditQuery = trpc.milkAdmin.auditLog.useQuery(
    { page: auditPage, pageSize: 20 },
    { enabled: tab === "audit" },
  );

  const utils = trpc.useUtils();

  const createTankMutation = trpc.milkAdmin.createTank.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Танк «${data.name}» создан`);
      setShowTankDialog(false);
      setTankName("");
      setTankCapacity("");
      setTankLocation("");
      void utils.milkAdmin.tanks.invalidate();
      void utils.milkAdmin.overview.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const toggleTankMutation = trpc.milkAdmin.toggleTank.useMutation({
    onSuccess: () => {
      void utils.milkAdmin.tanks.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const recalculateTanks = trpc.milkAdmin.recalculateTankVolumes.useMutation();

  // ─── Tank adjustment dialog state ───
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustTankId, setAdjustTankId] = useState<number | null>(null);
  const [adjustMode, setAdjustMode] = useState<"absolute" | "delta">("absolute");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const adjustTankMutation = trpc.milkAdmin.adjustTankVolume.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${data.tankName}: ${data.oldLiters} л → ${data.newLiters} л (${data.deltaLiters >= 0 ? "+" : ""}${data.deltaLiters} л)`);
      setShowAdjustDialog(false);
      setAdjustTankId(null);
      setAdjustValue("");
      setAdjustReason("");
      void utils.milkAdmin.tanks.invalidate();
      void utils.milkAdmin.tankReconciliation.invalidate();
      void utils.milkAdmin.overview.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка корректировки", { description: err.message }),
  });

  function openAdjustDialog(tankId: number) {
    setAdjustTankId(tankId);
    setAdjustMode("absolute");
    setAdjustValue("");
    setAdjustReason("");
    setShowAdjustDialog(true);
  }

  function handleAdjustSubmit() {
    if (!adjustTankId || !adjustValue || !adjustReason) return;
    adjustTankMutation.mutate({
      tankId: adjustTankId,
      mode: adjustMode,
      valueLiters: parseFloat(adjustValue),
      reason: adjustReason,
    });
  }

  const updateSessionMutation = trpc.milkAdmin.updateSession.useMutation({
    onSuccess: () => {
      toast.success("Дойка обновлена");
      setEditSession(null);
      void utils.milkAdmin.sessions.invalidate();
      void utils.milkAdmin.overview.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const deleteSessionMutation = trpc.milkAdmin.deleteSession.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      setDeleteSession(null);
      void utils.milkAdmin.sessions.invalidate();
      void utils.milkAdmin.overview.invalidate();
      void utils.milkAdmin.receptions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const updateReceptionMutation = trpc.milkAdmin.updateReception.useMutation({
    onSuccess: () => {
      toast.success("Приёмка обновлена");
      setEditReception(null);
      void utils.milkAdmin.receptions.invalidate();
      void utils.milkAdmin.overview.invalidate();
      void utils.milkAdmin.tanks.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const deleteReceptionMutation = trpc.milkAdmin.deleteReception.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      setDeleteReception(null);
      void utils.milkAdmin.receptions.invalidate();
      void utils.milkAdmin.overview.invalidate();
      void utils.milkAdmin.tanks.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  function openEditReceptionDialog(r: any) {
    setEditReception(r);
    setEditRecAccepted(String(r.acceptedVolumeLiters));
    setEditRecRejected(String(r.rejectedVolumeLiters));
    setEditRecStatus(r.status);
    setEditRecReason(r.rejectionReason ?? "");
    setEditRecNote(r.note ?? "");
  }

  function handleSaveReception() {
    if (!editReception) return;
    updateReceptionMutation.mutate({
      receptionId: editReception.id,
      acceptedVolumeMl: Math.round(parseFloat(editRecAccepted || "0") * 1000),
      rejectedVolumeMl: Math.round(parseFloat(editRecRejected || "0") * 1000),
      status: editRecStatus as any,
      rejectionReason: editRecReason || null,
      note: editRecNote || null,
    });
  }

  const clearAuditMutation = trpc.milkAdmin.clearAuditLog.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Удалено ${data.deleted} записей старше 30 дней`);
      void utils.milkAdmin.auditLog.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const overview = overviewQuery.data;

  const TABS = [
    { key: "overview" as const, label: "Обзор", icon: BarChart3 },
    { key: "sessions" as const, label: "Дойки", icon: Milk },
    { key: "receptions" as const, label: "Приёмки", icon: Droplets },
    { key: "tanks" as const, label: "Танки", icon: Container },
    { key: "processing" as const, label: "Переработка", icon: TrendingUp },
    { key: "warehouses" as const, label: "Склады", icon: Package },
    { key: "audit" as const, label: "Аудит", icon: ScrollText },
  ];

  function openEditDialog(s: any) {
    setEditSession(s);
    setEditGoatVol(String(s.goat.volumeLiters));
    setEditGoatHeads(String(s.goat.headCount));
    setEditGoatFeeding(String(s.goat.feedingLiters));
    setEditGoatLosses(String(s.goat.lossesLiters));
    setEditSheepVol(String(s.sheep.volumeLiters));
    setEditSheepHeads(String(s.sheep.headCount));
    setEditSheepFeeding(String(s.sheep.feedingLiters));
    setEditSheepLosses(String(s.sheep.lossesLiters));
    setEditCowVol(String(s.cow.volumeLiters));
    setEditCowHeads(String(s.cow.headCount));
    setEditCowFeeding(String(s.cow.feedingLiters));
    setEditCowLosses(String(s.cow.lossesLiters));
    setEditNote(s.note ?? "");
    setEditStatus(s.status);
  }

  function handleSaveEdit() {
    if (!editSession) return;
    updateSessionMutation.mutate({
      sessionId: editSession.id,
      goatVolumeMl: parseMl(editGoatVol),
      goatHeadCount: parseInt(editGoatHeads) || 0,
      goatFeedingMl: parseMl(editGoatFeeding),
      goatLossesMl: parseMl(editGoatLosses),
      sheepVolumeMl: parseMl(editSheepVol),
      sheepHeadCount: parseInt(editSheepHeads) || 0,
      sheepFeedingMl: parseMl(editSheepFeeding),
      sheepLossesMl: parseMl(editSheepLosses),
      cowVolumeMl: parseMl(editCowVol),
      cowHeadCount: parseInt(editCowHeads) || 0,
      cowFeedingMl: parseMl(editCowFeeding),
      cowLossesMl: parseMl(editCowLosses),
      status: editStatus as any,
      note: editNote || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="outline" size="icon" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-[oklch(0.22_0.04_60)]">
          Контроль оборота молока
        </h1>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === t.key
                ? "bg-[oklch(0.35_0.12_150)] text-white"
                : "bg-[oklch(0.96_0.01_90)] text-[oklch(0.4_0.04_80)] hover:bg-[oklch(0.92_0.02_90)]"}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div>
          {overviewQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[oklch(0.5_0.04_80)]" />
            </div>
          ) : overview ? (
            <OverviewSection
              overview={overview}
              customFrom={customFrom}
              customTo={customTo}
              useCustom={useCustom}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
              onUseCustomChange={setUseCustom}
            />
          ) : null}
        </div>
      )}

      {/* ── Sessions ── */}
      {tab === "sessions" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Select
              value={sessionStatus || "all"}
              onValueChange={(v) => {
                setSessionStatus(v === "all" ? "" : v);
                setSessionPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="pending_confirm">Ожидает</SelectItem>
                <SelectItem value="confirmed">Подтверждена</SelectItem>
                <SelectItem value="in_progress">В процессе</SelectItem>
                <SelectItem value="disputed">Оспорена</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sessionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[oklch(0.96_0.01_90)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Код</th>
                      <th className="text-left px-3 py-2 font-medium">Дояр</th>
                      <th className="text-left px-3 py-2 font-medium">Смена</th>
                      <th className="text-right px-3 py-2 font-medium">🐐 л</th>
                      <th className="text-right px-3 py-2 font-medium">🐑 л</th>
                      <th className="text-right px-3 py-2 font-medium">🐄 л</th>
                      <th className="text-right px-3 py-2 font-medium">Итого</th>
                      <th className="text-left px-3 py-2 font-medium">Статус</th>
                      <th className="text-left px-3 py-2 font-medium">Дата</th>
                      <th className="text-center px-3 py-2 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sessionsQuery.data?.sessions.map((s: any) => {
                      const st = SESSION_STATUS[s.status] ?? SESSION_STATUS.pending_confirm;
                      return (
                        <tr key={s.id} className="hover:bg-[oklch(0.98_0.01_90)]">
                          <td className="px-3 py-2 font-mono text-xs font-bold">
                            {s.sessionCode}
                          </td>
                          <td className="px-3 py-2">{s.workerName}</td>
                          <td className="px-3 py-2">
                            {s.shift === "morning" ? "🌅 Утро" : "🌙 Вечер"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {s.goat.volumeLiters > 0 ? `${s.goat.volumeLiters}` : "—"}
                            {s.goat.headCount > 0 && <span className="text-[10px] text-[oklch(0.6_0.02_80)] ml-0.5">({s.goat.headCount})</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {s.sheep.volumeLiters > 0 ? `${s.sheep.volumeLiters}` : "—"}
                            {s.sheep.headCount > 0 && <span className="text-[10px] text-[oklch(0.6_0.02_80)] ml-0.5">({s.sheep.headCount})</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {s.cow.volumeLiters > 0 ? `${s.cow.volumeLiters}` : "—"}
                            {s.cow.headCount > 0 && <span className="text-[10px] text-[oklch(0.6_0.02_80)] ml-0.5">({s.cow.headCount})</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {s.totalVolumeLiters} л
                          </td>
                          <td className="px-3 py-2">
                            <Badge className={`rounded-full text-[10px] ${st.color}`}>
                              {st.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-[oklch(0.5_0.04_80)]">
                            {new Date(s.createdAt).toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditDialog(s)}
                                className="w-8 h-8 rounded-lg bg-[oklch(0.94_0.02_90)] flex items-center justify-center hover:bg-[oklch(0.88_0.04_220)] transition-colors"
                                title="Редактировать"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[oklch(0.45_0.08_220)]" />
                              </button>
                              <button
                                onClick={() => setDeleteSession(s)}
                                className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={sessionPage}
                total={sessionsQuery.data?.total ?? 0}
                pageSize={15}
                onPageChange={setSessionPage}
              />
            </>
          )}
        </div>
      )}

      {/* ── Receptions ── */}
      {tab === "receptions" && (
        <div>
          {receptionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[oklch(0.96_0.01_90)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Дойка</th>
                      <th className="text-left px-3 py-2 font-medium">Тип</th>
                      <th className="text-left px-3 py-2 font-medium">Сыродел</th>
                      <th className="text-right px-3 py-2 font-medium">Принято</th>
                      <th className="text-right px-3 py-2 font-medium">Отклонено</th>
                      <th className="text-left px-3 py-2 font-medium">Статус</th>
                      <th className="text-left px-3 py-2 font-medium">Дата</th>
                      <th className="text-center px-3 py-2 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {receptionsQuery.data?.receptions.map((r: any) => {
                      const st = RECEPTION_STATUS[r.status] ?? RECEPTION_STATUS.accepted;
                      return (
                        <tr key={r.id} className="hover:bg-[oklch(0.98_0.01_90)]">
                          <td className="px-3 py-2 font-mono text-xs font-bold">
                            {r.sessionCode}
                          </td>
                          <td className="px-3 py-2">
                            <Badge className="rounded-full text-[10px] bg-[oklch(0.92_0.04_80)] text-[oklch(0.3_0.08_80)]">
                              {r.milkTypeLabel}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{r.receiverName}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                            {r.acceptedVolumeLiters} л
                          </td>
                          <td className="px-3 py-2 text-right text-red-600">
                            {r.rejectedVolumeLiters > 0 ? `${r.rejectedVolumeLiters} л` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge className={`rounded-full text-[10px] ${st.color}`}>
                              {st.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-[oklch(0.5_0.04_80)]">
                            {new Date(r.createdAt).toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditReceptionDialog(r)}
                                className="w-8 h-8 rounded-lg bg-[oklch(0.94_0.02_90)] flex items-center justify-center hover:bg-[oklch(0.88_0.04_220)] transition-colors"
                                title="Редактировать"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[oklch(0.45_0.08_220)]" />
                              </button>
                              <button
                                onClick={() => setDeleteReception(r)}
                                className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={receptionPage}
                total={receptionsQuery.data?.total ?? 0}
                pageSize={15}
                onPageChange={setReceptionPage}
              />
            </>
          )}
        </div>
      )}

      {/* ── Tanks ── */}
      {tab === "tanks" && (
        <div>
          <div className="flex justify-end gap-2 mb-4">
            <Button
              variant="outline"
              onClick={() => {
                if (!confirm("Пересчитать объёмы всех танков по данным приёмок и списаний?")) return;
                recalculateTanks.mutate(undefined, {
                  onSuccess: (data: any) => {
                    const changed = data.tanks.filter((t: any) => t.changed);
                    if (changed.length === 0) {
                      toast.success("Все танки корректны, изменений не требуется");
                    } else {
                      toast.success(`Пересчёт завершён: ${changed.map((t: any) => `${t.name}: ${t.oldLiters}→${t.newLiters} л`).join(", ")}`);
                    }
                    void utils.milkAdmin.tanks.invalidate();
                    void utils.milkAdmin.tankReconciliation.invalidate();
                  },
                  onError: (err: any) => toast.error(err.message),
                });
              }}
              disabled={recalculateTanks.isPending}
            >
              {recalculateTanks.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              Пересчитать объёмы
            </Button>
            <Button
              onClick={() => setShowTankDialog(true)}
              className="bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Добавить танк
            </Button>
          </div>

          {tanksQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(tanksQuery.data ?? []).map((t: any) => {
                const st = TANK_STATUS[t.status] ?? TANK_STATUS.empty;
                return (
                  <div
                    key={t.id}
                    className={`border rounded-lg p-4 ${t.isActive ? "bg-white" : "bg-gray-50 opacity-60"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-[oklch(0.22_0.04_60)]">{t.name}</h4>
                      <div className="flex gap-1.5">
                        <Badge className="rounded-full text-[10px] bg-[oklch(0.92_0.04_80)] text-[oklch(0.3_0.08_80)]">
                          {t.milkTypeLabel}
                        </Badge>
                        <Badge className={`rounded-full text-[10px] ${st.color}`}>
                          {st.label}
                        </Badge>
                      </div>
                    </div>
                    {t.location && (
                      <p className="text-xs text-[oklch(0.52_0.04_80)] mb-2">📍 {t.location}</p>
                    )}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-[oklch(0.52_0.04_80)] mb-1">
                        <span>{t.currentVolumeLiters} л</span>
                        <span>{t.capacityLiters} л</span>
                      </div>
                      <div className="h-2.5 bg-[oklch(0.94_0.02_90)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAdjustDialog(t.id)}
                        className="flex-1 text-xs"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Корректировка
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleTankMutation.mutate({
                            tankId: t.id,
                            isActive: !t.isActive,
                          })
                        }
                        className="flex-1 text-xs"
                      >
                        {t.isActive ? (
                          <>
                            <PowerOff className="w-3 h-3 mr-1" /> Деактивировать
                          </>
                        ) : (
                          <>
                            <Power className="w-3 h-3 mr-1" /> Активировать
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Tank Reconciliation ── */}
          {reconciliationQuery.data && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
                <Check className="w-4 h-4" /> Сверка объёмов танков
              </h3>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[oklch(0.96_0.01_90)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-xs">Танк</th>
                      <th className="text-left px-3 py-2 font-medium text-xs">Тип</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Принято, л</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Расход, л</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Ожидаемо, л</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Факт, л</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Расхождение</th>
                      <th className="text-center px-3 py-2 font-medium text-xs">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reconciliationQuery.data.map((r: any) => (
                      <tr key={r.id} className={r.isOk ? "hover:bg-[oklch(0.98_0.005_90)]" : "bg-red-50 hover:bg-red-100"}>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-[oklch(0.52_0.04_80)]">{r.milkTypeLabel}</td>
                        <td className="px-3 py-2 text-right">{r.acceptedLiters}</td>
                        <td className="px-3 py-2 text-right">{r.outflowLiters}</td>
                        <td className="px-3 py-2 text-right font-medium">{r.expectedLiters}</td>
                        <td className="px-3 py-2 text-right font-medium">{r.actualLiters}</td>
                        <td className={`px-3 py-2 text-right font-bold ${r.isOk ? "text-emerald-600" : "text-red-600"}`}>
                          {r.discrepancyLiters > 0 ? "+" : ""}{r.discrepancyLiters} л
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.isOk ? (
                            <Badge className="bg-emerald-100 text-emerald-700 rounded-full text-[10px]">✔ OK</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 rounded-full text-[10px]">⚠ Расхождение</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create tank dialog */}
          <Dialog open={showTankDialog} onOpenChange={setShowTankDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Новый танк</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                    Название
                  </label>
                  <Input
                    placeholder="Танк №1"
                    value={tankName}
                    onChange={(e) => setTankName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                    Тип молока
                  </label>
                  <Select value={tankMilkType} onValueChange={setTankMilkType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Тип молока" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="goat">🐐 Козье</SelectItem>
                      <SelectItem value="sheep">🐑 Овечье</SelectItem>
                      <SelectItem value="cow">🐄 Коровье</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                    Ёмкость (литры)
                  </label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={tankCapacity}
                    onChange={(e) => setTankCapacity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                    Расположение
                  </label>
                  <Input
                    placeholder="Молочный цех"
                    value={tankLocation}
                    onChange={(e) => setTankLocation(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="pt-3">
                <Button
                  disabled={
                    !tankName.trim() ||
                    !tankCapacity ||
                    parseFloat(tankCapacity) <= 0 ||
                    createTankMutation.isPending
                  }
                  onClick={() => {
                    createTankMutation.mutate({
                      name: tankName.trim(),
                      milkType: tankMilkType as "goat" | "sheep" | "cow",
                      capacityLiters: parseFloat(tankCapacity),
                      location: tankLocation.trim() || undefined,
                    });
                  }}
                  className="bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]"
                >
                  {createTankMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── Processing Sessions ── */}
      {tab === "processing" && <AdminProcessingTab />}

      {/* ── Warehouses ── */}
      {tab === "warehouses" && <AdminWarehousesTab />}

      {/* ── Audit Log ── */}
      {tab === "audit" && (
        <div>
          {/* Audit header with clear button */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[oklch(0.52_0.04_80)]">
              {auditQuery.data ? `${auditQuery.data.total} записей` : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={clearAuditMutation.isPending}
              onClick={() => {
                if (confirm("Удалить записи аудита старше 30 дней?")) {
                  clearAuditMutation.mutate({ olderThanDays: 30 });
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Очистить (30+ дней)
            </Button>
          </div>

          {auditQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[oklch(0.96_0.01_90)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Действие</th>
                      <th className="text-left px-3 py-2 font-medium">Сотрудник</th>
                      <th className="text-left px-3 py-2 font-medium">Сущность</th>
                      <th className="text-left px-3 py-2 font-medium">Детали</th>
                      <th className="text-left px-3 py-2 font-medium">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditQuery.data?.logs.map((l: any) => (
                      <tr key={l.id} className="hover:bg-[oklch(0.98_0.01_90)]">
                        <td className="px-3 py-2 text-xs font-medium">
                          {ACTION_LABELS[l.action] ?? l.action}
                        </td>
                        <td className="px-3 py-2 text-xs">{l.workerName}</td>
                        <td className="px-3 py-2 text-xs">
                          {l.entityType} #{l.entityId}
                        </td>
                        <td className="px-3 py-2 text-xs text-[oklch(0.5_0.04_80)] max-w-[200px] truncate">
                          {l.details?.sessionCode ??
                            l.details?.reason ??
                            (l.details ? JSON.stringify(l.details).slice(0, 60) : "—")}
                        </td>
                        <td className="px-3 py-2 text-xs text-[oklch(0.5_0.04_80)]">
                          {new Date(l.createdAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={auditPage}
                total={auditQuery.data?.total ?? 0}
                pageSize={20}
                onPageChange={setAuditPage}
              />
            </>
          )}
        </div>
      )}

      {/* ── Edit Session Dialog ── */}
      <Dialog open={!!editSession} onOpenChange={(open) => !open && setEditSession(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Редактировать дойку {editSession?.sessionCode}
            </DialogTitle>
          </DialogHeader>
          {editSession && (
            <div className="space-y-4 pt-2">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                  Статус
                </label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_confirm">Ожидает подтверждения</SelectItem>
                    <SelectItem value="confirmed">Подтверждена</SelectItem>
                    <SelectItem value="in_progress">В процессе</SelectItem>
                    <SelectItem value="disputed">Оспорена</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Goat */}
              <div className="border rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">🐐 Козье молоко</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Объём (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editGoatVol}
                      onChange={(e) => setEditGoatVol(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Голов</label>
                    <Input
                      inputMode="numeric"
                      value={editGoatHeads}
                      onChange={(e) => setEditGoatHeads(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Выпойка (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editGoatFeeding}
                      onChange={(e) => setEditGoatFeeding(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Потери (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editGoatLosses}
                      onChange={(e) => setEditGoatLosses(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Sheep */}
              <div className="border rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">🐑 Овечье молоко</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Объём (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editSheepVol}
                      onChange={(e) => setEditSheepVol(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Голов</label>
                    <Input
                      inputMode="numeric"
                      value={editSheepHeads}
                      onChange={(e) => setEditSheepHeads(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Выпойка (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editSheepFeeding}
                      onChange={(e) => setEditSheepFeeding(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Потери (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editSheepLosses}
                      onChange={(e) => setEditSheepLosses(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Cow */}
              <div className="border rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">🐄 Коровье молоко</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Объём (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editCowVol}
                      onChange={(e) => setEditCowVol(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Голов</label>
                    <Input
                      inputMode="numeric"
                      value={editCowHeads}
                      onChange={(e) => setEditCowHeads(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Выпойка (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editCowFeeding}
                      onChange={(e) => setEditCowFeeding(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[oklch(0.52_0.04_80)]">Потери (л)</label>
                    <Input
                      inputMode="decimal"
                      value={editCowLosses}
                      onChange={(e) => setEditCowLosses(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
                  Примечание
                </label>
                <Input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Примечание..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setEditSession(null)}>
              Отмена
            </Button>
            <Button
              disabled={updateSessionMutation.isPending}
              onClick={handleSaveEdit}
              className="bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]"
            >
              {updateSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Session Confirm Dialog ── */}
      <Dialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Удалить дойку?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-[oklch(0.4_0.04_80)]">
            <p>
              Вы уверены, что хотите удалить дойку{" "}
              <strong className="font-mono">{deleteSession?.sessionCode}</strong>?
            </p>
            <p className="mt-2 text-xs text-red-500">
              Все связанные приёмки будут удалены, объёмы в танках будут откорректированы.
              Это действие необратимо.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSession(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSessionMutation.isPending}
              onClick={() => {
                if (deleteSession) {
                  deleteSessionMutation.mutate({ sessionId: deleteSession.id });
                }
              }}
            >
              {deleteSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Reception Dialog ── */}
      <Dialog open={!!editReception} onOpenChange={(open) => !open && setEditReception(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать приёмку</DialogTitle>
          </DialogHeader>
          {editReception && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-[oklch(0.52_0.04_80)] space-y-1">
                <p>Дойка: <strong className="font-mono">{editReception.sessionCode}</strong></p>
                <p>Тип: <strong>{editReception.milkTypeLabel}</strong></p>
                <p>Сыродел: <strong>{editReception.receiverName}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Принято (л)</label>
                  <Input
                    inputMode="decimal"
                    value={editRecAccepted}
                    onChange={(e) => setEditRecAccepted(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Отклонено (л)</label>
                  <Input
                    inputMode="decimal"
                    value={editRecRejected}
                    onChange={(e) => setEditRecRejected(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Статус</label>
                <Select value={editRecStatus} onValueChange={setEditRecStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="accepted">Принята</SelectItem>
                    <SelectItem value="rejected">Отклонена</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editRecStatus === "rejected" && (
                <div>
                  <label className="text-xs font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Причина отклонения</label>
                  <Input
                    value={editRecReason}
                    onChange={(e) => setEditRecReason(e.target.value)}
                    placeholder="Причина..."
                    className="h-10"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Примечание</label>
                <Input
                  value={editRecNote}
                  onChange={(e) => setEditRecNote(e.target.value)}
                  placeholder="Примечание..."
                  className="h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setEditReception(null)}>
              Отмена
            </Button>
            <Button
              disabled={updateReceptionMutation.isPending}
              onClick={handleSaveReception}
              className="bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]"
            >
              {updateReceptionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Reception Confirm Dialog ── */}
      <Dialog open={!!deleteReception} onOpenChange={(open) => !open && setDeleteReception(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Удалить приёмку?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-[oklch(0.4_0.04_80)]">
            <p>
              Вы уверены, что хотите удалить приёмку{" "}
              <strong>{deleteReception?.milkTypeLabel}</strong> из дойки{" "}
              <strong className="font-mono">{deleteReception?.sessionCode}</strong>?
            </p>
            <p className="mt-2 text-xs text-red-500">
              Объём в танке будет откорректирован. Это действие необратимо.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReception(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={deleteReceptionMutation.isPending}
              onClick={() => {
                if (deleteReception) {
                  deleteReceptionMutation.mutate({ receptionId: deleteReception.id });
                }
              }}
            >
              {deleteReceptionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─── Overview Section ───────────────────────────────────────────────────────

type TypeStats = { volumeL: number; heads: number; feedingL: number; lossesL: number; netL: number; acceptedL: number; rejectedL: number };
type PeriodData = {
  sessions: number;
  total: TypeStats;
  goat: TypeStats;
  sheep: TypeStats;
  cow: TypeStats;
};

type OverviewData = {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  custom: PeriodData | null;
  pendingSessions: number;
  receptionToday: { count: number; acceptedLiters: number; rejectedLiters: number };
  tanks: {
    total: number;
    active: number;
    capacityLiters: number;
    currentLiters: number;
    fillPercent: number;
    byType: Record<string, { capacityLiters: number; currentLiters: number; fillPercent: number; active: number; total: number }>;
  };
};

const PERIOD_TABS = [
  { key: "today" as const, label: "Сегодня" },
  { key: "week" as const, label: "Неделя" },
  { key: "month" as const, label: "Месяц" },
  { key: "custom" as const, label: "Период" },
];

interface OverviewSectionProps {
  overview: OverviewData;
  customFrom: string;
  customTo: string;
  useCustom: boolean;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  onUseCustomChange: (v: boolean) => void;
}

function OverviewSection({
  overview,
  customFrom,
  customTo,
  useCustom,
  onCustomFromChange,
  onCustomToChange,
  onUseCustomChange,
}: OverviewSectionProps) {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");

  const d: PeriodData =
    period === "custom" && overview.custom
      ? overview.custom
      : period === "custom"
        ? { sessions: 0, total: { volumeL: 0, heads: 0, feedingL: 0, lossesL: 0, netL: 0, acceptedL: 0, rejectedL: 0 }, goat: { volumeL: 0, heads: 0, feedingL: 0, lossesL: 0, netL: 0, acceptedL: 0, rejectedL: 0 }, sheep: { volumeL: 0, heads: 0, feedingL: 0, lossesL: 0, netL: 0, acceptedL: 0, rejectedL: 0 }, cow: { volumeL: 0, heads: 0, feedingL: 0, lossesL: 0, netL: 0, acceptedL: 0, rejectedL: 0 } }
        : overview[period];

  const pct = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

  const avgPerHead = (vol: number, heads: number) =>
    heads > 0 ? `${(vol / heads).toFixed(2)} л` : "—";

  const columns = [
    { key: "total" as const, label: "Всего", emoji: "" },
    { key: "goat" as const, label: "Козы", emoji: "🐐" },
    { key: "sheep" as const, label: "Овцы", emoji: "🐑" },
    { key: "cow" as const, label: "Коровы", emoji: "🐄" },
  ];

  const thCls = "px-3 py-2 text-xs font-semibold text-[oklch(0.4_0.04_80)] text-right first:text-left whitespace-nowrap";
  const tdCls = "px-3 py-2 text-sm text-right first:text-left";
  const tdBold = `${tdCls} font-semibold`;

  function handlePeriodChange(key: typeof period) {
    setPeriod(key);
    if (key === "custom") {
      onUseCustomChange(true);
    } else {
      onUseCustomChange(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-[oklch(0.96_0.01_90)] rounded-lg p-1">
          {PERIOD_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handlePeriodChange(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === t.key
                  ? "bg-white text-[oklch(0.22_0.04_60)] shadow-sm"
                  : "text-[oklch(0.5_0.04_80)] hover:text-[oklch(0.3_0.04_80)]"
              }`}
            >
              {t.key === "custom" && <CalendarRange className="w-3.5 h-3.5" />}
              {t.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="border rounded-md px-2 py-1.5 text-sm bg-white text-[oklch(0.22_0.04_60)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.5_0.12_150)]"
            />
            <span className="text-xs text-[oklch(0.52_0.04_80)]">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="border rounded-md px-2 py-1.5 text-sm bg-white text-[oklch(0.22_0.04_60)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.5_0.12_150)]"
            />
            {customFrom && customTo && !overview.custom && (
              <span className="text-xs text-amber-600">Загрузка...</span>
            )}
          </div>
        )}

        <span className="text-xs text-[oklch(0.52_0.04_80)]">
          Доек: {d.sessions}
        </span>
        {overview.pendingSessions > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            ⚠ Ожидают: {overview.pendingSessions}
          </span>
        )}
      </div>

      {/* No data hint for custom period */}
      {period === "custom" && (!customFrom || !customTo) && (
        <div className="text-sm text-[oklch(0.52_0.04_80)] py-4 text-center border rounded-lg bg-[oklch(0.98_0.005_90)]">
          Укажите начальную и конечную дату для формирования отчёта
        </div>
      )}

      {/* Main 4-column table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="bg-[oklch(0.96_0.01_90)]">
            <tr>
              <th className={thCls}>Показатель</th>
              {columns.map((c) => (
                <th key={c.key} className={thCls}>
                  {c.emoji ? `${c.emoji} ${c.label}` : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Heads */}
            <tr className="hover:bg-[oklch(0.98_0.005_90)]">
              <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Голов</td>
              {columns.map((c) => (
                <td key={c.key} className={tdCls}>{d[c.key].heads || "—"}</td>
              ))}
            </tr>
            {/* Volume */}
            <tr className="bg-[oklch(0.97_0.02_150)] hover:bg-[oklch(0.96_0.03_150)]">
              <td className={`${tdBold} text-[oklch(0.30_0.12_150)]`}>Надой, л</td>
              {columns.map((c) => (
                <td key={c.key} className={`${tdBold} text-[oklch(0.30_0.12_150)]`}>
                  {d[c.key].volumeL}
                </td>
              ))}
            </tr>
            {/* Feeding */}
            <tr className="hover:bg-[oklch(0.98_0.005_90)]">
              <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Выпойка, л</td>
              {columns.map((c) => (
                <td key={c.key} className={tdCls}>{d[c.key].feedingL || "—"}</td>
              ))}
            </tr>
            {/* Losses */}
            <tr className="hover:bg-[oklch(0.98_0.005_90)]">
              <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Потери, л</td>
              {columns.map((c) => {
                const hasLoss = d[c.key].lossesL > 0;
                return (
                  <td key={c.key} className={`${tdCls} ${hasLoss ? "text-amber-700 font-medium" : ""}`}>
                    {hasLoss ? d[c.key].lossesL : "—"}
                  </td>
                );
              })}
            </tr>
            {/* Net */}
            <tr className="bg-[oklch(0.96_0.04_150)] hover:bg-[oklch(0.95_0.05_150)] border-t-2 border-[oklch(0.7_0.12_150)]">
              <td className={`${tdBold} text-[oklch(0.25_0.12_150)]`}>Нетто (→ сыроделу), л</td>
              {columns.map((c) => (
                <td key={c.key} className={`${tdBold} text-[oklch(0.25_0.12_150)]`}>
                  {d[c.key].netL}
                </td>
              ))}
            </tr>
            {/* Accepted */}
            <tr className="bg-emerald-50 hover:bg-emerald-100">
              <td className={`${tdBold} text-emerald-700`}>✔ Принято, л</td>
              {columns.map((c) => (
                <td key={c.key} className={`${tdBold} text-emerald-700`}>
                  {d[c.key].acceptedL || "—"}
                </td>
              ))}
            </tr>
            {/* Rejected */}
            {(d.total.rejectedL > 0) && (
            <tr className="bg-red-50 hover:bg-red-100">
              <td className={`${tdBold} text-red-600`}>✖ Отклонено, л</td>
              {columns.map((c) => (
                <td key={c.key} className={`${tdBold} text-red-600`}>
                  {d[c.key].rejectedL || "—"}
                </td>
              ))}
            </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Analytics section */}
      <div>
        <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Аналитика
        </h3>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-[oklch(0.96_0.01_90)]">
              <tr>
                <th className={thCls}>Метрика</th>
                {columns.map((c) => (
                  <th key={c.key} className={thCls}>
                    {c.emoji ? `${c.emoji} ${c.label}` : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Feeding % */}
              <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>% выпойки</td>
                {columns.map((c) => (
                  <td key={c.key} className={tdCls}>
                    {pct(d[c.key].feedingL, d[c.key].volumeL)}
                  </td>
                ))}
              </tr>
              {/* Losses % */}
              <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>% потерь</td>
                {columns.map((c) => {
                  const val = d[c.key].volumeL > 0 ? (d[c.key].lossesL / d[c.key].volumeL) * 100 : 0;
                  return (
                    <td key={c.key} className={`${tdCls} ${val > 5 ? "text-red-600 font-medium" : val > 2 ? "text-amber-600" : ""}`}>
                      {pct(d[c.key].lossesL, d[c.key].volumeL)}
                    </td>
                  );
                })}
              </tr>
              {/* Net % */}
              <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>% нетто</td>
                {columns.map((c) => (
                  <td key={c.key} className={`${tdCls} text-[oklch(0.30_0.12_150)] font-medium`}>
                    {pct(d[c.key].netL, d[c.key].volumeL)}
                  </td>
                ))}
              </tr>
              {/* Avg per head */}
              <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Ср. надой/гол</td>
                {columns.map((c) => (
                  <td key={c.key} className={tdCls}>
                    {avgPerHead(d[c.key].volumeL, d[c.key].heads)}
                  </td>
                ))}
              </tr>
              {/* Avg net per head */}
              <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Ср. нетто/гол</td>
                {columns.map((c) => (
                  <td key={c.key} className={`${tdCls} text-[oklch(0.30_0.12_150)]`}>
                    {avgPerHead(d[c.key].netL, d[c.key].heads)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[oklch(0.4_0.04_80)]">Выгрузить:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportOverviewExcel(d, columns, period, customFrom, customTo)}
          className="border-[oklch(0.35_0.12_150)] text-[oklch(0.35_0.12_150)]"
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportOverviewPDF(d, columns, period, customFrom, customTo)}
          className="border-[oklch(0.35_0.12_150)] text-[oklch(0.35_0.12_150)]"
        >
          <FileText className="w-4 h-4 mr-1.5" />
          PDF
        </Button>
      </div>

      {/* ── Accepted / Rejected Visual Chart ── */}
      {(d.total.acceptedL > 0 || d.total.rejectedL > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Принято / Отклонено по типу молока
          </h3>
          <div className="space-y-3">
            {(["goat", "sheep", "cow"] as const).map((type) => {
              const label = type === "goat" ? "🐐 Козье" : type === "sheep" ? "🐑 Овечье" : "🐄 Коровье";
              const acc = d[type].acceptedL;
              const rej = d[type].rejectedL;
              const net = d[type].netL;
              const total = acc + rej;
              if (net <= 0 && total <= 0) return null;
              const accPct = net > 0 ? Math.round((acc / net) * 100) : 0;
              const rejPct = net > 0 ? Math.round((rej / net) * 100) : 0;
              const pendingPct = Math.max(0, 100 - accPct - rejPct);
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm w-28 shrink-0">{label}</span>
                  <div className="flex-1">
                    <div className="h-6 rounded-full overflow-hidden flex bg-[oklch(0.94_0.02_90)]">
                      {accPct > 0 && (
                        <div
                          className="h-full bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ width: `${accPct}%` }}
                        >
                          {accPct > 10 ? `${acc}л` : ""}
                        </div>
                      )}
                      {rejPct > 0 && (
                        <div
                          className="h-full bg-red-400 flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ width: `${rejPct}%` }}
                        >
                          {rejPct > 10 ? `${rej}л` : ""}
                        </div>
                      )}
                      {pendingPct > 0 && (
                        <div
                          className="h-full bg-[oklch(0.88_0.04_80)] flex items-center justify-center text-[10px] font-medium text-[oklch(0.4_0.04_80)]"
                          style={{ width: `${pendingPct}%` }}
                        >
                          {pendingPct > 15 ? "Ожидает" : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] text-[oklch(0.52_0.04_80)] mt-0.5">
                      <span>✔ {acc}л ({accPct}%)</span>
                      {rej > 0 && <span className="text-red-500">✖ {rej}л ({rejPct}%)</span>}
                      <span>Нетто: {net}л</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational cards: reception + tanks + processing */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Приёмок сегодня"
          value={overview.receptionToday.count}
          sub={`✔ ${overview.receptionToday.acceptedLiters}л${overview.receptionToday.rejectedLiters > 0 ? ` / ✖ ${overview.receptionToday.rejectedLiters}л` : ""}`}
        />
        <StatCard
          label="Танки"
          value={`${overview.tanks.active} / ${overview.tanks.total}`}
          sub={`Заполн: ${overview.tanks.fillPercent}% (${overview.tanks.currentLiters}л)`}
        />
        <StatCard
          label="Переработка сегодня"
          value={overview.processing?.today?.sessions ?? 0}
          sub={`Вход: ${overview.processing?.today?.inputLiters ?? 0}л → ${overview.processing?.today?.outputUnits ?? 0} ед.`}
          accent
        />
        <StatCard
          label="Ср. коэфф. конверсии"
          value={overview.processing?.avgConversionRatio ? `${(overview.processing.avgConversionRatio * 100).toFixed(1)}%` : "—"}
          sub={`За месяц: ${overview.processing?.month?.sessions ?? 0} сессий`}
        />
      </div>

      {/* Processing analytics section */}
      {overview.processing && (
        <div>
          <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Переработка
          </h3>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[oklch(0.96_0.01_90)]">
                <tr>
                  <th className={thCls}>Показатель</th>
                  <th className={thCls}>Сегодня</th>
                  <th className={thCls}>Неделя</th>
                  <th className={thCls}>Месяц</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                  <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Сессий переработки</td>
                  <td className={tdCls}>{overview.processing.today.sessions}</td>
                  <td className={tdCls}>{overview.processing.week.sessions}</td>
                  <td className={tdCls}>{overview.processing.month.sessions}</td>
                </tr>
                <tr className="bg-[oklch(0.97_0.02_270)] hover:bg-[oklch(0.96_0.03_270)]">
                  <td className={`${tdBold} text-[oklch(0.30_0.10_270)]`}>Молока в переработку, л</td>
                  <td className={`${tdBold} text-[oklch(0.30_0.10_270)]`}>{overview.processing.today.inputLiters}</td>
                  <td className={`${tdBold} text-[oklch(0.30_0.10_270)]`}>{overview.processing.week.inputLiters}</td>
                  <td className={`${tdBold} text-[oklch(0.30_0.10_270)]`}>{overview.processing.month.inputLiters}</td>
                </tr>
                <tr className="hover:bg-[oklch(0.98_0.005_90)]">
                  <td className={`${tdCls} text-[oklch(0.4_0.04_80)]`}>Произведено единиц</td>
                  <td className={tdCls}>{overview.processing.today.outputUnits}</td>
                  <td className={tdCls}>{overview.processing.week.outputUnits}</td>
                  <td className={tdCls}>{overview.processing.month.outputUnits}</td>
                </tr>
                <tr className="bg-[oklch(0.96_0.04_150)] hover:bg-[oklch(0.95_0.05_150)]">
                  <td className={`${tdBold} text-[oklch(0.25_0.12_150)]`}>Ср. коэфф. конверсии (мес)</td>
                  <td className={`${tdBold} text-[oklch(0.25_0.12_150)]`} colSpan={3}>
                    {overview.processing.avgConversionRatio ? `${(overview.processing.avgConversionRatio * 100).toFixed(2)}%` : "Нет данных"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Product breakdown by type */}
          {overview.processing.productBreakdown && overview.processing.productBreakdown.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[oklch(0.45_0.04_80)] mb-2 uppercase tracking-wide">
                Произведённая продукция за месяц
              </h4>
              <div className="border rounded-lg overflow-x-auto max-h-[240px] overflow-y-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[50%]" />
                    <col className="w-[20%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-[oklch(0.96_0.01_90)] sticky top-0">
                    <tr>
                      <th className={thCls}>Продукт</th>
                      <th className={thCls}>Количество</th>
                      <th className={thCls}>Ед.</th>
                      <th className={thCls}>Сессий</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overview.processing.productBreakdown.map((p: { productLabel: string; unit: string; totalQuantity: number; sessionsCount: number }, idx: number) => (
                      <tr key={idx} className="hover:bg-[oklch(0.98_0.005_90)]">
                        <td className={`${tdCls} text-[oklch(0.4_0.04_80)] font-medium`}>{p.productLabel}</td>
                        <td className={`${tdBold} text-[oklch(0.30_0.10_150)]`}>{p.totalQuantity}</td>
                        <td className={tdCls}>{p.unit}</td>
                        <td className={tdCls}>{p.sessionsCount}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-[oklch(0.94_0.03_90)] font-semibold">
                      <td className={`${tdBold} text-[oklch(0.3_0.08_80)]`}>ИТОГО</td>
                      <td className={`${tdBold} text-[oklch(0.3_0.08_80)]`}>
                        {overview.processing.productBreakdown.reduce((sum: number, p: { totalQuantity: number }) => sum + p.totalQuantity, 0).toFixed(2)}
                      </td>
                      <td className={tdCls}>—</td>
                      <td className={tdCls}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        warn
          ? "border-amber-200 bg-amber-50"
          : accent
            ? "border-[oklch(0.7_0.12_150)] bg-[oklch(0.96_0.04_150)]"
            : "bg-white"
      }`}
    >
      <p className="text-xs text-[oklch(0.52_0.04_80)] mb-1">{label}</p>
      <p
        className={`text-xl font-bold ${
          warn ? "text-amber-700" : accent ? "text-[oklch(0.30_0.12_150)]" : "text-[oklch(0.22_0.04_60)]"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[oklch(0.52_0.04_80)] mt-0.5">{sub}</p>}
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-[oklch(0.52_0.04_80)]">
      <span>
        Страница {page} из {totalPages} ({total} записей)
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Overview Export Helpers ────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  custom: "Период",
};

const OVERVIEW_COLUMNS: ReportColumn[] = [
  { header: "Показатель", key: "metric", width: 20 },
  { header: "Всего", key: "total", width: 14 },
  { header: "Козы 🐐", key: "goat", width: 14 },
  { header: "Овцы 🐑", key: "sheep", width: 14 },
  { header: "Коровы 🐄", key: "cow", width: 14 },
];

function buildOverviewRows(d: PeriodData) {
  const pct = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
  const avg = (vol: number, heads: number) =>
    heads > 0 ? `${(vol / heads).toFixed(2)} л` : "—";

  const keys = ["total", "goat", "sheep", "cow"] as const;
  const row = (metric: string, fn: (k: typeof keys[number]) => string | number) => {
    const r: Record<string, any> = { metric };
    keys.forEach((k) => (r[k] = fn(k)));
    return r;
  };

  const rows = [
    row("Голов", (k) => d[k].heads || "—"),
    row("Надой, л", (k) => d[k].volumeL),
    row("Выпойка, л", (k) => d[k].feedingL || "—"),
    row("Потери, л", (k) => d[k].lossesL || "—"),
    row("Нетто (→ сыроделу), л", (k) => d[k].netL),
    row("✔ Принято, л", (k) => d[k].acceptedL || "—"),
  ];
  if (d.total.rejectedL > 0) {
    rows.push(row("✖ Отклонено, л", (k) => d[k].rejectedL || "—"));
  }
  rows.push(
    row("% выпойки", (k) => pct(d[k].feedingL, d[k].volumeL)),
    row("% потерь", (k) => pct(d[k].lossesL, d[k].volumeL)),
    row("% нетто", (k) => pct(d[k].netL, d[k].volumeL)),
    row("% принято от нетто", (k) => pct(d[k].acceptedL, d[k].netL)),
    row("Ср. надой/гол", (k) => avg(d[k].volumeL, d[k].heads)),
    row("Ср. нетто/гол", (k) => avg(d[k].netL, d[k].heads)),
  );
  return rows;
}

function getOverviewSubtitle(
  period: string,
  customFrom: string,
  customTo: string,
): string {
  if (period === "custom" && customFrom && customTo) {
    return periodSubtitle(customFrom, customTo);
  }
  return `Период: ${PERIOD_LABELS[period] ?? period}`;
}

function exportOverviewExcel(
  d: PeriodData,
  _columns: any[],
  period: string,
  customFrom: string,
  customTo: string,
) {
  exportExcel({
    title: "Обзор молочного оборота — Шерь Козу",
    subtitle: getOverviewSubtitle(period, customFrom, customTo) + ` | Доек: ${d.sessions}`,
    columns: OVERVIEW_COLUMNS,
    rows: buildOverviewRows(d),
    filename: `Обзор_${period === "custom" ? `${customFrom}_${customTo}` : period}`,
  });
}

function exportOverviewPDF(
  d: PeriodData,
  _columns: any[],
  period: string,
  customFrom: string,
  customTo: string,
) {
  exportPDF({
    title: "Обзор молочного оборота — Шерь Козу",
    subtitle: getOverviewSubtitle(period, customFrom, customTo) + ` | Доек: ${d.sessions}`,
    columns: OVERVIEW_COLUMNS,
    rows: buildOverviewRows(d),
    filename: `Обзор_${period === "custom" ? `${customFrom}_${customTo}` : period}`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// Processing Sessions Admin Tab
// ═══════════════════════════════════════════════════════════════════

function AdminProcessingTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const utils = trpc.useUtils();

  const deleteMutation = trpc.warehouseAdmin.deleteProcessingSession.useMutation({
    onSuccess: () => {
      toast.success("Сессия удалена");
      void utils.warehouseAdmin.processingSessions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const sessionsQuery = trpc.warehouseAdmin.processingSessions.useQuery({
    limit: 15,
    offset: (page - 1) * 15,
    status: statusFilter ? (statusFilter as any) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const conversionQuery = trpc.warehouseAdmin.conversionAnalytics.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    deviationThreshold: 15,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const total = sessionsQuery.data?.total ?? 0;
  const alerts = conversionQuery.data?.alerts ?? [];

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

  function exportData(format: "excel" | "pdf") {
    const rows = sessions.map((s: any) => ({
      date: s.shiftDate,
      sessionCode: s.sessionCode,
      worker: s.workerName ?? "—",
      inputLiters: (s.totalInputMl / 1000).toFixed(1),
      status: PROC_STATUS[s.status]?.label ?? s.status,
    }));
    const totalL = sessions.reduce((sum: number, s: any) => sum + s.totalInputMl, 0) / 1000;
    const config = {
      title: "Отчёт переработки — Шерь Козу",
      subtitle: periodSubtitle(dateFrom || "—", dateTo || "—"),
      columns: PROC_COLUMNS,
      rows,
      summaryRows: [{ date: "ИТОГО", sessionCode: `${sessions.length} сессий`, worker: "", inputLiters: totalL.toFixed(1), status: "" }],
      filename: `Переработка_${dateFrom || "all"}_${dateTo || "all"}`,
    };
    format === "excel" ? exportExcel(config) : exportPDF(config);
  }

  return (
    <div className="space-y-4">
      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
            <TrendingUp className="w-4 h-4" /> Отклонения коэффициентов конверсии ({alerts.length})
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {alerts.map((a: any, i: number) => (
              <div key={i} className="text-xs text-red-600 flex items-center gap-2">
                <span className="font-mono">{a.sessionCode}</span>
                <span>{a.productLabel}</span>
                <Badge className="rounded-full text-[9px] bg-red-100 text-red-700">
                  {a.deviationPercent > 0 ? "+" : ""}{a.deviationPercent.toFixed(1)}%
                </Badge>
                <span className="text-red-400">факт: {a.actualRatio.toFixed(2)} / норма: {a.baseRatio.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_statuses">Все статусы</SelectItem>
            <SelectItem value="draft">Черновик</SelectItem>
            <SelectItem value="in_progress">В процессе</SelectItem>
            <SelectItem value="completed">Завершена</SelectItem>
            <SelectItem value="cancelled">Отменена</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-xs bg-white h-9"
        />
        <span className="text-xs text-[oklch(0.52_0.04_80)]">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-xs bg-white h-9"
        />
        <Button size="sm" variant="outline" onClick={() => exportData("excel")} className="h-9 text-xs">
          <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportData("pdf")} className="h-9 text-xs">
          <FileText className="w-3.5 h-3.5 mr-1" /> PDF
        </Button>
      </div>

      {/* Table */}
      {sessionsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-[oklch(0.96_0.01_90)] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Код</th>
                <th className="px-3 py-2 text-left font-semibold">Дата</th>
                <th className="px-3 py-2 text-left font-semibold">Сыродел</th>
                <th className="px-3 py-2 text-right font-semibold">Вход (л)</th>
                <th className="px-3 py-2 text-left font-semibold">Статус</th>
                <th className="px-3 py-2 text-left font-semibold">Создана</th>
                <th className="px-3 py-2 text-center font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s: any) => {
                const st = PROC_STATUS[s.status] ?? { label: s.status, color: "" };
                return (
                  <tr key={s.id} className="hover:bg-[oklch(0.98_0.005_90)]">
                    <td className="px-3 py-2 font-mono font-medium">{s.sessionCode}</td>
                    <td className="px-3 py-2">{s.shiftDate}</td>
                    <td className="px-3 py-2">{s.workerName ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-700">{(s.totalInputMl / 1000).toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <Badge className={`rounded-full text-[9px] ${st.color}`}>{st.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-[oklch(0.5_0.04_80)]">
                      {new Date(s.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.status === "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(`Удалить сессию ${s.sessionCode} безвозвратно?`)) {
                              deleteMutation.mutate({ sessionId: s.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[oklch(0.5_0.04_80)]">
                    Нет сессий переработки
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 15 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[oklch(0.52_0.04_80)]">
            Стр. {page} из {Math.ceil(total / 15)}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" disabled={page * 15 >= total} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Warehouses Admin Tab
// ═══════════════════════════════════════════════════════════════════

function AdminWarehousesTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedWh, setSelectedWh] = useState<number | null>(null);

  const whQuery = trpc.warehouseAdmin.list.useQuery();
  const inventoryQuery = trpc.warehouseAdmin.inventory.useQuery(
    { warehouseId: selectedWh! },
    { enabled: !!selectedWh },
  );
  const movementsQuery = trpc.warehouseAdmin.movements.useQuery(
    { warehouseId: selectedWh!, limit: 20, offset: 0 },
    { enabled: !!selectedWh },
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.warehouseAdmin.create.useMutation({
    onSuccess: () => {
      toast.success("Склад создан");
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      void utils.warehouseAdmin.list.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const updateMutation = trpc.warehouseAdmin.update.useMutation({
    onSuccess: () => {
      toast.success("Склад обновлён");
      void utils.warehouseAdmin.list.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const warehouses = whQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[oklch(0.52_0.04_80)]">
          Всего складов: <strong>{warehouses.length}</strong>
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)} className="text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Новый склад
        </Button>
      </div>

      {/* Warehouse list */}
      {whQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {warehouses.map((wh: any) => (
            <div
              key={wh.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedWh === wh.id ? "border-[oklch(0.40_0.12_80)] bg-[oklch(0.97_0.02_90)]" : "hover:bg-[oklch(0.98_0.005_90)]"
              }`}
              onClick={() => setSelectedWh(selectedWh === wh.id ? null : wh.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">{wh.name}</h4>
                  {wh.description && (
                    <p className="text-xs text-[oklch(0.52_0.04_80)] mt-0.5">{wh.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`rounded-full text-[9px] ${wh.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {wh.isActive ? "Активен" : "Неактивен"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMutation.mutate({ id: wh.id, isActive: !wh.isActive });
                    }}
                  >
                    {wh.isActive ? <PowerOff className="w-3.5 h-3.5 text-red-400" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-[oklch(0.5_0.04_80)]">
                <span>Позиций: {wh.itemCount}</span>
                <span>Единиц: {wh.totalItems}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inventory for selected warehouse */}
      {selectedWh && (
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">
            Остатки на складе
          </h3>
          {inventoryQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (inventoryQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-[oklch(0.6_0.02_80)]">Пусто</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[oklch(0.96_0.01_90)] sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">Продукт</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Кол-во</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Ед.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(inventoryQuery.data ?? []).map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-1.5">{item.productLabel}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{item.quantity}</td>
                      <td className="px-3 py-1.5">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent movements */}
          <h3 className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">
            Последние движения
          </h3>
          {movementsQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (movementsQuery.data?.movements ?? []).length === 0 ? (
            <p className="text-xs text-[oklch(0.6_0.02_80)]">Нет движений</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[oklch(0.96_0.01_90)] sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">Дата</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Тип</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Продукт</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Кол-во</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Сессия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(movementsQuery.data?.movements ?? []).map((m: any) => (
                    <tr key={m.id}>
                      <td className="px-3 py-1.5">{new Date(m.createdAt).toLocaleDateString("ru-RU")}</td>
                      <td className="px-3 py-1.5">
                        <Badge className={`rounded-full text-[9px] ${
                          m.movementType === "in" ? "bg-emerald-100 text-emerald-700" :
                          m.movementType === "out" ? "bg-blue-100 text-blue-700" :
                          m.movementType === "writeoff" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {m.movementType === "in" ? "Приход" : m.movementType === "out" ? "Расход" : m.movementType === "writeoff" ? "Списание" : "Корректировка"}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5">{m.productLabel}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${m.quantity >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity} {m.unit}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[oklch(0.5_0.04_80)]">{m.sessionCode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create warehouse dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новый склад</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">Название</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Холодильник №1"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">Описание (необязательно)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Описание склада..."
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newName, description: newDesc || null })}
              disabled={newName.trim().length < 2 || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tank Adjustment Dialog ── */}
      <Dialog open={showAdjustDialog} onOpenChange={(open) => !open && setShowAdjustDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Корректировка объёма танка</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Mode selector */}
            <div>
              <label className="text-sm font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Режим</label>
              <div className="flex gap-2">
                <Button
                  variant={adjustMode === "absolute" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAdjustMode("absolute")}
                  className="flex-1"
                >
                  Установить объём
                </Button>
                <Button
                  variant={adjustMode === "delta" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAdjustMode("delta")}
                  className="flex-1"
                >
                  Добавить / Списать
                </Button>
              </div>
            </div>

            {/* Value input */}
            <div>
              <label className="text-sm font-medium text-[oklch(0.35_0.04_60)] mb-1 block">
                {adjustMode === "absolute" ? "Новый объём (литры)" : "Изменение (литры, минус = списание)"}
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder={adjustMode === "absolute" ? "Напр. 150.5" : "Напр. -20 или +30"}
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
              />
            </div>

            {/* Reason input */}
            <div>
              <label className="text-sm font-medium text-[oklch(0.35_0.04_60)] mb-1 block">Причина корректировки *</label>
              <Input
                placeholder="Напр. Инвентаризация, пролив, погрешность измерения"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Отмена</Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={!adjustValue || !adjustReason || adjustReason.length < 3 || adjustTankMutation.isPending}
            >
              {adjustTankMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
