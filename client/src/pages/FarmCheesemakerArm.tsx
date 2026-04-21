/**
 * /farm/cheesemaker — Cheesemaker ARM (Automated Workstation).
 *
 * Mobile-first interface for:
 * - Accepting/rejecting milk from milking sessions
 * - Managing milk tanks (volumes, status)
 * - Viewing reception history
 */

import { useEffect, useState } from "react";
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
  Check,
  Clock,
  Container,
  History,
  Loader2,
  LogOut,
  Milk,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
  const [view, setView] = useState<"reception" | "tanks" | "history">("reception");

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
  const [acceptSession, setAcceptSession] = useState<any>(null);
  const [acceptVolume, setAcceptVolume] = useState("");
  const [rejectVolume, setRejectVolume] = useState("0");
  const [acceptTankId, setAcceptTankId] = useState<string>("");
  const [acceptTemp, setAcceptTemp] = useState("");
  const [acceptDensity, setAcceptDensity] = useState("");
  const [acceptFat, setAcceptFat] = useState("");
  const [acceptAcidity, setAcceptAcidity] = useState("");
  const [acceptNote, setAcceptNote] = useState("");

  // ─── Reject dialog state ───
  const [rejectSession, setRejectSession] = useState<any>(null);
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
        description: `В танке теперь ${data.tankNewVolumeLiters} л`,
      });
      setAcceptSession(null);
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
      setRejectSession(null);
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

  function openAcceptDialog(session: any) {
    setAcceptSession(session);
    setAcceptVolume(String(session.totalVolumeLiters));
    setRejectVolume("0");
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

  const pendingSessions = pendingQuery.data ?? [];
  const tanks = (tanksQuery.data ?? []) as any[];
  const activeTanks = tanks.filter((t: any) => t.isActive && t.status !== "cleaning" && t.status !== "processing");

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
          {pendingSessions.length > 0 && (
            <Badge className="ml-1 rounded-full text-[9px] bg-red-500 text-white px-1.5 py-0">
              {pendingSessions.length}
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
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-6">
        {view === "reception" && (
          <div className="px-4 mt-4 space-y-3">
            {pendingQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-[oklch(0.52_0.04_80)]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…
              </div>
            ) : pendingSessions.length === 0 ? (
              <div className="text-center py-12">
                <Check className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-medium text-[oklch(0.3_0.04_60)]">Всё принято</p>
                <p className="text-xs text-[oklch(0.52_0.04_80)] mt-1">
                  Нет дойок, ожидающих приёмки
                </p>
              </div>
            ) : (
              (pendingSessions as any[]).map((s: any) => (
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                      {s.sessionCode}
                    </span>
                    <span className="text-xs text-[oklch(0.52_0.04_80)]">{s.workerName}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-[oklch(0.6_0.02_80)]">Объём</span>
                      <p className="font-bold text-base text-[oklch(0.22_0.04_60)]">
                        {s.totalVolumeLiters} л
                      </p>
                    </div>
                    <div>
                      <span className="text-[oklch(0.6_0.02_80)]">🐐 Козы</span>
                      <p className="font-semibold text-sm">{s.goatHeadCount}</p>
                    </div>
                    <div>
                      <span className="text-[oklch(0.6_0.02_80)]">🐑 Овцы</span>
                      <p className="font-semibold text-sm">{s.sheepHeadCount}</p>
                    </div>
                  </div>
                  {(s.temperatureCelsius != null || s.densityGCm3 != null) && (
                    <div className="flex gap-3 text-[10px] text-[oklch(0.52_0.04_80)] mb-3">
                      {s.temperatureCelsius != null && <span>🌡 {s.temperatureCelsius}°C</span>}
                      {s.densityGCm3 != null && <span>💧 {s.densityGCm3}</span>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => openAcceptDialog(s)}
                      className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
                                 active:bg-emerald-800 touch-manipulation text-sm font-medium"
                    >
                      <ThumbsUp className="w-4 h-4 mr-1.5" />
                      Принять
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectSession(s)}
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
                      <div>
                        <span className="text-sm font-bold text-[oklch(0.22_0.04_60)]">
                          {t.name}
                        </span>
                        {t.location && (
                          <span className="text-xs text-[oklch(0.52_0.04_80)] ml-2">
                            📍 {t.location}
                          </span>
                        )}
                      </div>
                      <Badge className={`rounded-full text-[10px] ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>

                    {/* Volume bar */}
                    <div className="mt-2">
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
                      <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                        {r.sessionCode}
                      </span>
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

      {/* ── Accept Dialog ── */}
      <Dialog open={!!acceptSession} onOpenChange={() => setAcceptSession(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Приёмка {acceptSession?.sessionCode}
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
                Дояр заявил: {acceptSession?.totalVolumeLiters} л
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

            {/* Target tank */}
            <div>
              <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
                Целевой танк
              </label>
              <Select value={acceptTankId} onValueChange={setAcceptTankId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Выберите танк" />
                </SelectTrigger>
                <SelectContent>
                  {activeTanks.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} — {t.currentVolumeLiters}/{t.capacityLiters} л ({t.fillPercent}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setAcceptSession(null)} className="rounded-xl">
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
                if (!acceptSession) return;
                acceptMutation.mutate({
                  sessionId: acceptSession.id,
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
      <Dialog open={!!rejectSession} onOpenChange={() => setRejectSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-red-600">
              Отклонить {rejectSession?.sessionCode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-[oklch(0.52_0.04_80)]">
              Объём: <strong>{rejectSession?.totalVolumeLiters} л</strong> будет полностью отклонён.
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
            <Button variant="outline" onClick={() => setRejectSession(null)} className="rounded-xl">
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 3 || rejectMutation.isPending}
              onClick={() => {
                if (!rejectSession) return;
                rejectMutation.mutate({
                  sessionId: rejectSession.id,
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
