/**
 * Admin Milk Dashboard — /admin/milk
 *
 * Overview of milk turnover: stats, sessions, receptions, tanks, audit log.
 * With scrolling tables, edit/delete sessions, and clear data presentation.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Container,
  Droplets,
  FileText,
  Loader2,
  Milk,
  Pencil,
  Plus,
  Power,
  PowerOff,
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
  const [tab, setTab] = useState<"overview" | "sessions" | "receptions" | "tanks" | "audit">(
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

  const overviewQuery = trpc.milkAdmin.overview.useQuery(undefined, {
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
            <OverviewSection overview={overview} />
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
          <div className="flex justify-end mb-4">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleTankMutation.mutate({
                          tankId: t.id,
                          isActive: !t.isActive,
                        })
                      }
                      className="w-full text-xs"
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
                );
              })}
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
    </div>
  );
}
// ─── Overview Section ───────────────────────────────────────────────────────

type PeriodData = {
  sessions: number;
  total: { volumeL: number; heads: number; feedingL: number; lossesL: number; netL: number };
  goat: { volumeL: number; heads: number; feedingL: number; lossesL: number; netL: number };
  sheep: { volumeL: number; heads: number; feedingL: number; lossesL: number; netL: number };
  cow: { volumeL: number; heads: number; feedingL: number; lossesL: number; netL: number };
};

type OverviewData = {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
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
];

function OverviewSection({ overview }: { overview: OverviewData }) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const d = overview[period];

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

  const thCls = "px-3 py-2 text-xs font-semibold text-[oklch(0.4_0.04_80)] text-right first:text-left";
  const tdCls = "px-3 py-2 text-sm text-right first:text-left";
  const tdBold = `${tdCls} font-semibold`;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-[oklch(0.96_0.01_90)] rounded-lg p-1">
          {PERIOD_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === t.key
                  ? "bg-white text-[oklch(0.22_0.04_60)] shadow-sm"
                  : "text-[oklch(0.5_0.04_80)] hover:text-[oklch(0.3_0.04_80)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[oklch(0.52_0.04_80)]">
          Доек: {d.sessions}
        </span>
        {overview.pendingSessions > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            ⚠ Ожидают: {overview.pendingSessions}
          </span>
        )}
      </div>

      {/* Main 4-column table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
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
              <td className={`${tdBold} text-[oklch(0.25_0.12_150)]`}>Нетто, л</td>
              {columns.map((c) => (
                <td key={c.key} className={`${tdBold} text-[oklch(0.25_0.12_150)]`}>
                  {d[c.key].netL}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Analytics section */}
      <div>
        <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Аналитика
        </h3>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
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

      {/* Operational cards: reception + tanks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Приёмок сегодня"
          value={overview.receptionToday.count}
          sub={`${overview.receptionToday.acceptedLiters} л принято`}
        />
        <StatCard
          label="Танки"
          value={`${overview.tanks.active} / ${overview.tanks.total}`}
          sub={`Заполн: ${overview.tanks.fillPercent}% (${overview.tanks.currentLiters}л)`}
        />
      </div>
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
