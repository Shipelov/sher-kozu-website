/**
 * /farm/milker — Milker ARM (Automated Workstation).
 *
 * Mobile-first interface for recording milking sessions.
 * Touch-optimized: large buttons, minimal text input, bottom-anchored actions.
 *
 * Milk is tracked SEPARATELY by animal type (goat/sheep/cow).
 * Each type has its own head count + volume input.
 */

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

const SHIFT_OPTIONS = [
  { value: "morning" as const, label: "Утренняя", emoji: "🌅" },
  { value: "evening" as const, label: "Вечерняя", emoji: "🌙" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
  pending_confirm: { label: "Ожидает подтверждения", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Подтверждена", color: "bg-emerald-100 text-emerald-700" },
  disputed: { label: "Оспорена", color: "bg-red-100 text-red-700" },
};

const ANIMAL_TYPES = [
  { key: "goat" as const, emoji: "🐐", label: "Козы", labelMilk: "Козье молоко" },
  { key: "sheep" as const, emoji: "🐑", label: "Овцы", labelMilk: "Овечье молоко" },
  { key: "cow" as const, emoji: "🐄", label: "Коровы", labelMilk: "Коровье молоко" },
];

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

  // ─── Form state: per-type head count + volume ───
  const [shift, setShift] = useState<"morning" | "evening">(
    new Date().getHours() < 14 ? "morning" : "evening",
  );

  const [goatHeads, setGoatHeads] = useState(0);
  const [goatVolumeL, setGoatVolumeL] = useState("");
  const [sheepHeads, setSheepHeads] = useState(0);
  const [sheepVolumeL, setSheepVolumeL] = useState("");
  const [cowHeads, setCowHeads] = useState(0);
  const [cowVolumeL, setCowVolumeL] = useState("");

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
      setGoatHeads(0); setGoatVolumeL("");
      setSheepHeads(0); setSheepVolumeL("");
      setCowHeads(0); setCowVolumeL("");
      setTemperature(""); setDensity(""); setNote("");
      setShowExtras(false);
      void utils.milkSession.myToday.invalidate();
      void utils.milkSession.myHistory.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  // ─── Derived ───
  const goatMl = goatVolumeL ? Math.round(parseFloat(goatVolumeL) * 1000) : 0;
  const sheepMl = sheepVolumeL ? Math.round(parseFloat(sheepVolumeL) * 1000) : 0;
  const cowMl = cowVolumeL ? Math.round(parseFloat(cowVolumeL) * 1000) : 0;
  const totalMl = goatMl + sheepMl + cowMl;
  const totalHeads = goatHeads + sheepHeads + cowHeads;

  // Validate: each type with volume must have heads and vice versa
  const goatValid = (goatMl > 0 && goatHeads > 0) || (goatMl === 0 && goatHeads === 0);
  const sheepValid = (sheepMl > 0 && sheepHeads > 0) || (sheepMl === 0 && sheepHeads === 0);
  const cowValid = (cowMl > 0 && cowHeads > 0) || (cowMl === 0 && cowHeads === 0);
  const canSubmit = totalMl > 0 && goatValid && sheepValid && cowValid && !createMutation.isPending;

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
      goat: { volumeMl: goatMl, headCount: goatHeads },
      sheep: { volumeMl: sheepMl, headCount: sheepHeads },
      cow: { volumeMl: cowMl, headCount: cowHeads },
      temperatureCelsius: temperature ? parseFloat(temperature) : undefined,
      densityGCm3: density ? parseFloat(density) : undefined,
      note: note.trim() || undefined,
    });
  }

  // ─── Reusable counter + volume row ───
  function AnimalRow({
    emoji,
    label,
    heads,
    setHeads,
    volumeL: vol,
    setVolumeL: setVol,
    valid,
  }: {
    emoji: string;
    label: string;
    heads: number;
    setHeads: (n: number) => void;
    volumeL: string;
    setVolumeL: (s: string) => void;
    valid: boolean;
  }) {
    const volMl = vol ? Math.round(parseFloat(vol) * 1000) : 0;
    return (
      <div className={`bg-white rounded-xl border ${valid ? "border-[oklch(0.88_0.02_90)]" : "border-red-300"} p-3 mb-3`}>
        {/* Type label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{emoji}</span>
          <span className="text-sm font-semibold text-[oklch(0.3_0.04_60)]">{label}</span>
          {volMl > 0 && (
            <span className="ml-auto text-xs text-[oklch(0.52_0.04_80)]">
              {(volMl / 1000).toFixed(1)} л
            </span>
          )}
        </div>

        {/* Head counter + Volume input in one row */}
        <div className="flex items-center gap-3">
          {/* Head counter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHeads(Math.max(0, heads - 1))}
              className="w-10 h-10 rounded-lg bg-[oklch(0.94_0.02_90)] flex items-center justify-center
                         active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
            >
              <Minus className="w-4 h-4 text-[oklch(0.4_0.04_80)]" />
            </button>
            <span className="w-8 text-center text-lg font-bold text-[oklch(0.22_0.04_60)] tabular-nums">
              {heads}
            </span>
            <button
              onClick={() => setHeads(heads + 1)}
              className="w-10 h-10 rounded-lg bg-[oklch(0.35_0.12_150)] flex items-center justify-center
                         active:bg-[oklch(0.30_0.12_150)] touch-manipulation"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
            <span className="text-[10px] text-[oklch(0.6_0.02_80)]">гол.</span>
          </div>

          {/* Separator */}
          <div className="w-px h-8 bg-[oklch(0.9_0.02_90)]" />

          {/* Volume input */}
          <div className="flex-1 relative">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="500"
              placeholder="0.0"
              value={vol}
              onChange={(e) => setVol(e.target.value)}
              className="h-10 text-base font-bold text-center rounded-lg pr-8
                         border-[oklch(0.88_0.02_90)] bg-[oklch(0.98_0.01_90)]
                         focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[oklch(0.52_0.04_80)]">
              л
            </span>
          </div>
        </div>

        {!valid && (
          <p className="text-[10px] text-red-500 mt-1">
            Укажите и головы, и объём (или оставьте оба пустыми)
          </p>
        )}
      </div>
    );
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
              {/* Per-type breakdown for today */}
              <div className="flex gap-3 mt-2 text-[10px] text-[oklch(0.52_0.04_80)]">
                {todaySessions.reduce((acc: any, s: any) => {
                  acc.goat += s.goat?.volumeLiters ?? 0;
                  acc.sheep += s.sheep?.volumeLiters ?? 0;
                  acc.cow += s.cow?.volumeLiters ?? 0;
                  return acc;
                }, { goat: 0, sheep: 0, cow: 0 }).goat > 0 && (
                  <span>🐐 {todaySessions.reduce((a: number, s: any) => a + (s.goat?.volumeLiters ?? 0), 0).toFixed(1)}л</span>
                )}
                {todaySessions.reduce((acc: number, s: any) => acc + (s.sheep?.volumeLiters ?? 0), 0) > 0 && (
                  <span>🐑 {todaySessions.reduce((a: number, s: any) => a + (s.sheep?.volumeLiters ?? 0), 0).toFixed(1)}л</span>
                )}
                {todaySessions.reduce((acc: number, s: any) => acc + (s.cow?.volumeLiters ?? 0), 0) > 0 && (
                  <span>🐄 {todaySessions.reduce((a: number, s: any) => a + (s.cow?.volumeLiters ?? 0), 0).toFixed(1)}л</span>
                )}
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

          {/* ── Per-type: heads + volume ── */}
          <div className="px-4 mt-5">
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-2 block">
              Дойные головы и объём молока по видам
            </label>

            <AnimalRow
              emoji="🐐" label="Козы"
              heads={goatHeads} setHeads={setGoatHeads}
              volumeL={goatVolumeL} setVolumeL={setGoatVolumeL}
              valid={goatValid}
            />
            <AnimalRow
              emoji="🐑" label="Овцы"
              heads={sheepHeads} setHeads={setSheepHeads}
              volumeL={sheepVolumeL} setVolumeL={setSheepVolumeL}
              valid={sheepValid}
            />
            <AnimalRow
              emoji="🐄" label="Коровы"
              heads={cowHeads} setHeads={setCowHeads}
              volumeL={cowVolumeL} setVolumeL={setCowVolumeL}
              valid={cowValid}
            />

            {totalMl > 0 && (
              <p className="text-xs text-[oklch(0.52_0.04_80)] text-center mt-1">
                Итого: <strong>{(totalMl / 1000).toFixed(1)} л</strong> · {totalHeads} голов
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

                    {/* Per-type breakdown */}
                    <div className="space-y-1 mb-2">
                      {s.goat?.volumeLiters > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[oklch(0.5_0.04_80)]">🐐 Козье</span>
                          <span className="font-semibold text-[oklch(0.22_0.04_60)]">
                            {s.goat.volumeLiters} л · {s.goat.headCount} гол.
                          </span>
                        </div>
                      )}
                      {s.sheep?.volumeLiters > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[oklch(0.5_0.04_80)]">🐑 Овечье</span>
                          <span className="font-semibold text-[oklch(0.22_0.04_60)]">
                            {s.sheep.volumeLiters} л · {s.sheep.headCount} гол.
                          </span>
                        </div>
                      )}
                      {s.cow?.volumeLiters > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[oklch(0.5_0.04_80)]">🐄 Коровье</span>
                          <span className="font-semibold text-[oklch(0.22_0.04_60)]">
                            {s.cow.volumeLiters} л · {s.cow.headCount} гол.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-[oklch(0.94_0.01_90)] pt-1.5">
                      <span className="text-[oklch(0.5_0.04_80)]">Итого</span>
                      <span className="font-bold text-sm text-[oklch(0.22_0.04_60)]">
                        {s.totalVolumeLiters} л · {s.totalHeadCount} гол.
                      </span>
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
          {!canSubmit && totalMl === 0 && (
            <p className="text-center text-[10px] text-[oklch(0.6_0.02_80)] mt-1.5">
              Укажите голов и объём молока по видам
            </p>
          )}
        </div>
      )}
    </div>
  );
}
