/**
 * Admin Milk Dashboard — /admin/milk
 *
 * Overview of milk turnover: stats, sessions, receptions, tanks, audit log.
 * With scrolling tables and clear data presentation.
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
  Plus,
  Power,
  PowerOff,
  ScrollText,
  TrendingUp,
} from "lucide-react";
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
  session_submitted: "Дойка отправлена",
  session_auto_confirmed: "Автоподтверждение",
  reception_accepted: "Молоко принято",
  reception_rejected: "Молоко отклонено",
  tank_movement: "Движение танка",
};

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

  const overview = overviewQuery.data;

  const TABS = [
    { key: "overview" as const, label: "Обзор", icon: BarChart3 },
    { key: "sessions" as const, label: "Дойки", icon: Milk },
    { key: "receptions" as const, label: "Приёмки", icon: Droplets },
    { key: "tanks" as const, label: "Танки", icon: Container },
    { key: "audit" as const, label: "Аудит", icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
            <div className="space-y-6">
              {/* Today stats */}
              <div>
                <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Сегодня
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Дойки" value={overview.today.sessions} />
                  <StatCard
                    label="Объём (всего)"
                    value={`${overview.today.volume.totalLiters} л`}
                    accent
                  />
                  <StatCard label="🐐 Козы" value={overview.today.goatHeads} sub={`${overview.today.volume.goatLiters} л`} />
                  <StatCard label="🐑 Овцы" value={overview.today.sheepHeads} sub={`${overview.today.volume.sheepLiters} л`} />
                  <StatCard label="🐄 Коровы" value={overview.today.cowHeads} sub={`${overview.today.volume.cowLiters} л`} />
                </div>
              </div>

              {/* Period stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Неделя (дойки)"
                  value={overview.week.sessions}
                  sub={`Всего: ${overview.week.volume.totalLiters} л`}
                />
                <StatCard
                  label="Месяц (дойки)"
                  value={overview.month.sessions}
                  sub={`Всего: ${overview.month.volume.totalLiters} л`}
                />
                <StatCard
                  label="Ожидают подтверждения"
                  value={overview.pendingSessions}
                  warn={overview.pendingSessions > 0}
                />
                <StatCard
                  label="Приёмок сегодня"
                  value={overview.receptionToday.count}
                  sub={`${overview.receptionToday.acceptedLiters} л принято`}
                />
              </div>

              {/* Tank overview */}
              <div>
                <h3 className="text-sm font-semibold text-[oklch(0.4_0.04_80)] mb-3 flex items-center gap-2">
                  <Container className="w-4 h-4" /> Танки
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Активных / Всего"
                    value={`${overview.tanks.active} / ${overview.tanks.total}`}
                  />
                  <StatCard
                    label="Заполнение"
                    value={`${overview.tanks.fillPercent}%`}
                    sub={`${overview.tanks.currentLiters} / ${overview.tanks.capacityLiters} л`}
                  />
                </div>
              </div>
            </div>
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
          {auditQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
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
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

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
