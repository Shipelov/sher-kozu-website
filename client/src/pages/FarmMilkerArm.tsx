/**
 * /farm/milker — Milker ARM (Automated Workstation).
 *
 * Mobile-first interface for recording milking sessions.
 * Touch-optimized: large buttons, minimal text input, bottom-anchored actions.
 */

import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  History,
  Loader2,
  LogOut,
  Milk,
  Minus,
  Plus,
  Sun,
  Moon,
  Thermometer,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const SHIFT_OPTIONS = [
  { value: "morning" as const, label: "Утренняя", icon: Sun, emoji: "🌅" },
  { value: "evening" as const, label: "Вечерняя", icon: Moon, emoji: "🌙" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
  pending_confirm: { label: "Ожидает подтверждения", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Подтверждена", color: "bg-emerald-100 text-emerald-700" },
  disputed: { label: "Оспорена", color: "bg-red-100 text-red-700" },
};

export default function FarmMilkerArm() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"form" | "history">("form");

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

  // ─── Form state ───
  const [shift, setShift] = useState<"morning" | "evening">(
    new Date().getHours() < 14 ? "morning" : "evening",
  );
  const [goatCount, setGoatCount] = useState(0);
  const [sheepCount, setSheepCount] = useState(0);
  const [cowCount, setCowCount] = useState(0);
  const [volumeL, setVolumeL] = useState("");
  const [temperature, setTemperature] = useState("");
  const [density, setDensity] = useState("");
  const [note, setNote] = useState("");
  const [showExtras, setShowExtras] = useState(false);

  // ─── Queries ───
  const todayQuery = trpc.milkSession.myToday.useQuery(undefined, {
    enabled: !!meQuery.data,
    refetchOnWindowFocus: true,
  });

  const historyQuery = trpc.milkSession.myHistory.useQuery(
    { page: 1, pageSize: 30 },
    { enabled: !!meQuery.data && view === "history" },
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.milkSession.create.useMutation({
    onSuccess: (data) => {
      toast.success("Дойка зафиксирована!", {
        description: `${data.sessionCode} — ожидает подтверждения`,
      });
      // Reset form
      setGoatCount(0);
      setSheepCount(0);
      setCowCount(0);
      setVolumeL("");
      setTemperature("");
      setDensity("");
      setNote("");
      setShowExtras(false);
      void utils.milkSession.myToday.invalidate();
      void utils.milkSession.myHistory.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  // ─── Derived ───
  const totalHeads = goatCount + sheepCount + cowCount;
  const volumeMl = volumeL ? Math.round(parseFloat(volumeL) * 1000) : 0;
  const canSubmit = totalHeads > 0 && volumeMl > 0 && !createMutation.isPending;

  const todaySessions = todayQuery.data ?? [];
  const hasMorning = todaySessions.some((s: any) => s.shift === "morning");
  const hasEvening = todaySessions.some((s: any) => s.shift === "evening");
  const todayTotalL = todaySessions.reduce((sum: number, s: any) => sum + s.totalVolumeLiters, 0);

  // ─── Loading / Auth guard ───
  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[oklch(0.97_0.015_90)]">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.35_0.12_150)]" />
      </div>
    );
  }

  const worker = meQuery.data;
  if (!worker) return null;

  function handleSubmit() {
    if (!canSubmit) return;
    createMutation.mutate({
      shift,
      totalVolumeMl: volumeMl,
      goatHeadCount: goatCount,
      sheepHeadCount: sheepCount,
      cowHeadCount: cowCount,
      temperatureCelsius: temperature ? parseFloat(temperature) : undefined,
      densityGCm3: density ? parseFloat(density) : undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[oklch(0.97_0.015_90)]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[oklch(0.9_0.02_90)] shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.35_0.12_150)] flex items-center justify-center">
            <Milk className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[oklch(0.22_0.04_60)] leading-tight">
              {worker.name}
            </p>
            <p className="text-xs text-[oklch(0.52_0.04_80)]">АРМ Дояра</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/farm/change-password")}
            className="h-10 w-10 text-[oklch(0.52_0.04_80)] touch-manipulation"
            title="Сменить пароль"
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
          onClick={() => setView("form")}
          className={`flex-1 py-3 text-sm font-medium text-center touch-manipulation transition-colors
            ${view === "form" ? "text-[oklch(0.35_0.12_150)] border-b-2 border-[oklch(0.35_0.12_150)]" : "text-[oklch(0.52_0.04_80)]"}`}
        >
          <Milk className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Новая дойка
        </button>
        <button
          onClick={() => setView("history")}
          className={`flex-1 py-3 text-sm font-medium text-center touch-manipulation transition-colors
            ${view === "history" ? "text-[oklch(0.35_0.12_150)] border-b-2 border-[oklch(0.35_0.12_150)]" : "text-[oklch(0.52_0.04_80)]"}`}
        >
          <History className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          История
        </button>
      </div>

      {view === "form" ? (
        <div className="flex-1 overflow-y-auto pb-32">
          {/* ── Today summary ── */}
          {todaySessions.length > 0 && (
            <div className="mx-4 mt-4 p-3 rounded-xl bg-white border border-[oklch(0.9_0.02_90)]">
              <p className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-2">Сегодня</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-[oklch(0.45_0.12_220)]" />
                  <span className="text-lg font-bold text-[oklch(0.22_0.04_60)]">
                    {todayTotalL.toFixed(1)} л
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {hasMorning && (
                    <Badge className="rounded-full text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                      🌅 Утро ✓
                    </Badge>
                  )}
                  {hasEvening && (
                    <Badge className="rounded-full text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
                      🌙 Вечер ✓
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Shift selector ── */}
          <div className="px-4 mt-4">
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-2 block">
              Смена
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SHIFT_OPTIONS.map((opt) => {
                const isSelected = shift === opt.value;
                const alreadyDone =
                  (opt.value === "morning" && hasMorning) ||
                  (opt.value === "evening" && hasEvening);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setShift(opt.value)}
                    disabled={alreadyDone}
                    className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-medium
                      touch-manipulation transition-all
                      ${isSelected
                        ? "border-[oklch(0.35_0.12_150)] bg-[oklch(0.92_0.04_150)] text-[oklch(0.25_0.12_150)]"
                        : "border-[oklch(0.88_0.02_90)] bg-white text-[oklch(0.4_0.04_80)]"}
                      ${alreadyDone ? "opacity-40 line-through" : "active:scale-[0.97]"}`}
                  >
                    <span className="text-lg">{opt.emoji}</span>
                    {opt.label}
                    {alreadyDone && <Check className="w-4 h-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Head counts ── */}
          <div className="px-4 mt-5">
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-2 block">
              Дойные головы
            </label>

            {/* Goats */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-[oklch(0.88_0.02_90)] px-4 h-16 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐐</span>
                <span className="text-sm font-medium text-[oklch(0.3_0.04_60)]">Козы</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGoatCount(Math.max(0, goatCount - 1))}
                  className="w-11 h-11 rounded-xl bg-[oklch(0.94_0.02_90)] flex items-center justify-center
                             active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
                >
                  <Minus className="w-5 h-5 text-[oklch(0.4_0.04_80)]" />
                </button>
                <span className="w-10 text-center text-xl font-bold text-[oklch(0.22_0.04_60)] tabular-nums">
                  {goatCount}
                </span>
                <button
                  onClick={() => setGoatCount(goatCount + 1)}
                  className="w-11 h-11 rounded-xl bg-[oklch(0.35_0.12_150)] flex items-center justify-center
                             active:bg-[oklch(0.30_0.12_150)] touch-manipulation"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Sheep */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-[oklch(0.88_0.02_90)] px-4 h-16 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐑</span>
                <span className="text-sm font-medium text-[oklch(0.3_0.04_60)]">Овцы</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSheepCount(Math.max(0, sheepCount - 1))}
                  className="w-11 h-11 rounded-xl bg-[oklch(0.94_0.02_90)] flex items-center justify-center
                             active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
                >
                  <Minus className="w-5 h-5 text-[oklch(0.4_0.04_80)]" />
                </button>
                <span className="w-10 text-center text-xl font-bold text-[oklch(0.22_0.04_60)] tabular-nums">
                  {sheepCount}
                </span>
                <button
                  onClick={() => setSheepCount(sheepCount + 1)}
                  className="w-11 h-11 rounded-xl bg-[oklch(0.35_0.12_150)] flex items-center justify-center
                             active:bg-[oklch(0.30_0.12_150)] touch-manipulation"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Cows */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-[oklch(0.88_0.02_90)] px-4 h-16">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐄</span>
                <span className="text-sm font-medium text-[oklch(0.3_0.04_60)]">Коровы</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCowCount(Math.max(0, cowCount - 1))}
                  className="w-11 h-11 rounded-xl bg-[oklch(0.94_0.02_90)] flex items-center justify-center
                             active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
                >
                  <Minus className="w-5 h-5 text-[oklch(0.4_0.04_80)]" />
                </button>
                <span className="w-10 text-center text-xl font-bold text-[oklch(0.22_0.04_60)] tabular-nums">
                  {cowCount}
                </span>
                <button
                  onClick={() => setCowCount(cowCount + 1)}
                  className="w-11 h-11 rounded-xl bg-[oklch(0.35_0.12_150)] flex items-center justify-center
                             active:bg-[oklch(0.30_0.12_150)] touch-manipulation"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {totalHeads > 0 && (
              <p className="text-xs text-[oklch(0.52_0.04_80)] mt-2 text-center">
                Всего: <strong>{totalHeads}</strong> голов
              </p>
            )}
          </div>

          {/* ── Volume ── */}
          <div className="px-4 mt-5">
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-2 block">
              Объём молока (литры)
            </label>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="500"
                placeholder="0.0"
                value={volumeL}
                onChange={(e) => setVolumeL(e.target.value)}
                className="h-14 text-xl font-bold text-center rounded-xl pr-12
                           border-[oklch(0.88_0.02_90)] bg-white
                           focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[oklch(0.52_0.04_80)] font-medium">
                л
              </span>
            </div>
            {volumeMl > 0 && (
              <p className="text-xs text-[oklch(0.52_0.04_80)] mt-1 text-center">
                = {volumeMl.toLocaleString("ru-RU")} мл
              </p>
            )}
          </div>

          {/* ── Optional fields toggle ── */}
          <div className="px-4 mt-4">
            <button
              onClick={() => setShowExtras(!showExtras)}
              className="flex items-center gap-2 text-xs font-medium text-[oklch(0.45_0.08_150)] touch-manipulation"
            >
              {showExtras ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Температура, плотность, заметка
            </button>

            {showExtras && (
              <div className="mt-3 space-y-3">
                {/* Temperature */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[oklch(0.92_0.08_30)] flex items-center justify-center flex-shrink-0">
                    <Thermometer className="w-5 h-5 text-[oklch(0.5_0.15_30)]" />
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="Температура, °C"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="h-12 rounded-xl border-[oklch(0.88_0.02_90)] bg-white"
                  />
                </div>

                {/* Density */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[oklch(0.92_0.08_220)] flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-5 h-5 text-[oklch(0.45_0.12_220)]" />
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    placeholder="Плотность, г/см³ (напр. 1.030)"
                    value={density}
                    onChange={(e) => setDensity(e.target.value)}
                    className="h-12 rounded-xl border-[oklch(0.88_0.02_90)] bg-white"
                  />
                </div>

                {/* Note */}
                <textarea
                  placeholder="Заметка (необязательно)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="w-full rounded-xl border border-[oklch(0.88_0.02_90)] bg-white px-4 py-3
                             text-sm resize-none focus:outline-none focus:border-[oklch(0.35_0.12_150)]
                             focus:ring-1 focus:ring-[oklch(0.35_0.12_150)]"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── History view ── */
        <div className="flex-1 overflow-y-auto pb-6">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[oklch(0.52_0.04_80)]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…
            </div>
          ) : !historyQuery.data?.sessions.length ? (
            <div className="text-center py-12 px-6">
              <History className="w-12 h-12 mx-auto mb-3 text-[oklch(0.8_0.02_90)]" />
              <p className="text-sm text-[oklch(0.52_0.04_80)]">Нет записей</p>
            </div>
          ) : (
            <div className="px-4 mt-4 space-y-3">
              {historyQuery.data.sessions.map((s: any) => {
                const st = STATUS_MAP[s.status] ?? STATUS_MAP.pending_confirm;
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                        {s.sessionCode}
                      </span>
                      <Badge className={`rounded-full text-[10px] ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-[oklch(0.4_0.04_80)]">
                      <div>
                        <span className="text-[oklch(0.6_0.02_80)]">Объём</span>
                        <p className="font-semibold text-sm text-[oklch(0.22_0.04_60)]">
                          {s.totalVolumeLiters} л
                        </p>
                      </div>
                      <div>
                        <span className="text-[oklch(0.6_0.02_80)]">🐐 Козы</span>
                        <p className="font-semibold text-sm text-[oklch(0.22_0.04_60)]">
                          {s.goatHeadCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-[oklch(0.6_0.02_80)]">🐑 Овцы</span>
                        <p className="font-semibold text-sm text-[oklch(0.22_0.04_60)]">
                          {s.sheepHeadCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-[oklch(0.6_0.02_80)]">🐄 Коровы</span>
                        <p className="font-semibold text-sm text-[oklch(0.22_0.04_60)]">
                          {s.cowHeadCount}
                        </p>
                      </div>
                    </div>
                    {s.note && (
                      <p className="text-xs text-[oklch(0.52_0.04_80)] mt-2 italic">
                        {s.note}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[oklch(0.6_0.02_80)]">
                      <Clock className="w-3 h-3" />
                      {new Date(s.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {s.temperatureCelsius != null && (
                        <span className="ml-2">🌡 {s.temperatureCelsius}°C</span>
                      )}
                      {s.densityGCm3 != null && (
                        <span className="ml-2">💧 {s.densityGCm3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {historyQuery.data.total > historyQuery.data.sessions.length && (
                <p className="text-center text-xs text-[oklch(0.6_0.02_80)] py-2">
                  Показано {historyQuery.data.sessions.length} из {historyQuery.data.total}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom submit button (only on form view) ── */}
      {view === "form" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[oklch(0.9_0.02_90)] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-14 rounded-xl text-base font-semibold
                       bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]
                       active:bg-[oklch(0.28_0.12_150)] touch-manipulation
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Check className="h-5 w-5 mr-2" />
            )}
            Зафиксировать дойку
          </Button>
          {!canSubmit && totalHeads === 0 && volumeMl === 0 && (
            <p className="text-center text-[10px] text-[oklch(0.6_0.02_80)] mt-1.5">
              Укажите голов и объём молока
            </p>
          )}
        </div>
      )}
    </div>
  );
}
