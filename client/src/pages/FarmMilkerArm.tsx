/**
 * /farm/milker — Milker ARM (Automated Workstation).
 *
 * Mobile-first interface for recording milking sessions.
 * Touch-optimized: large buttons, minimal text input, bottom-anchored actions.
 *
 * Milk is tracked SEPARATELY by animal type (goat/sheep/cow).
 * Each type has: head count, total volume, feeding (выпойка), losses (потери).
 * Formula: Сыроделу = Общий надой − Выпойка − Потери
 *
 * Volume input: free numeric field — user types liters directly.
 * Pending sessions can be edited or cancelled from history.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Clock,
  Droplets,
  History,
  Loader2,
  LogOut,
  Milk,
  Minus,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
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

/** Parse liters string to ml */
function parseMl(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 1000);
}

/** Validate volume input: allow digits, one dot/comma, up to 2 decimals */
function sanitizeVolume(raw: string): string | null {
  const cleaned = raw.replace(",", ".");
  if (cleaned === "" || /^\d{0,4}\.?\d{0,2}$/.test(cleaned)) return cleaned;
  return null;
}

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

  // ─── Form state: per-type head count + volume + feeding + losses ───
  const [shift, setShift] = useState<"morning" | "evening">(
    new Date().getHours() < 14 ? "morning" : "evening",
  );

  // Goat
  const [goatHeads, setGoatHeads] = useState(0);
  const [goatVolumeL, setGoatVolumeL] = useState("");
  const [goatFeedingL, setGoatFeedingL] = useState("");
  const [goatLossesL, setGoatLossesL] = useState("");
  // Sheep
  const [sheepHeads, setSheepHeads] = useState(0);
  const [sheepVolumeL, setSheepVolumeL] = useState("");
  const [sheepFeedingL, setSheepFeedingL] = useState("");
  const [sheepLossesL, setSheepLossesL] = useState("");
  // Cow
  const [cowHeads, setCowHeads] = useState(0);
  const [cowVolumeL, setCowVolumeL] = useState("");
  const [cowFeedingL, setCowFeedingL] = useState("");
  const [cowLossesL, setCowLossesL] = useState("");

  const [note, setNote] = useState("");

  // ─── Edit mode state ───
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editShift, setEditShift] = useState<"morning" | "evening">("morning");
  const [editGoatHeads, setEditGoatHeads] = useState(0);
  const [editGoatVolumeL, setEditGoatVolumeL] = useState("");
  const [editGoatFeedingL, setEditGoatFeedingL] = useState("");
  const [editGoatLossesL, setEditGoatLossesL] = useState("");
  const [editSheepHeads, setEditSheepHeads] = useState(0);
  const [editSheepVolumeL, setEditSheepVolumeL] = useState("");
  const [editSheepFeedingL, setEditSheepFeedingL] = useState("");
  const [editSheepLossesL, setEditSheepLossesL] = useState("");
  const [editCowHeads, setEditCowHeads] = useState(0);
  const [editCowVolumeL, setEditCowVolumeL] = useState("");
  const [editCowFeedingL, setEditCowFeedingL] = useState("");
  const [editCowLossesL, setEditCowLossesL] = useState("");
  const [editNote, setEditNote] = useState("");

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
      resetForm();
      void utils.milkSession.myToday.invalidate();
      void utils.milkSession.myHistory.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const updateMutation = trpc.milkSession.update.useMutation({
    onSuccess: () => {
      toast.success("Дойка обновлена");
      setEditingId(null);
      void utils.milkSession.myToday.invalidate();
      void utils.milkSession.myHistory.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const cancelMutation = trpc.milkSession.cancel.useMutation({
    onSuccess: () => {
      toast.success("Дойка отменена");
      void utils.milkSession.myToday.invalidate();
      void utils.milkSession.myHistory.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  function resetForm() {
    setGoatHeads(0); setGoatVolumeL(""); setGoatFeedingL(""); setGoatLossesL("");
    setSheepHeads(0); setSheepVolumeL(""); setSheepFeedingL(""); setSheepLossesL("");
    setCowHeads(0); setCowVolumeL(""); setCowFeedingL(""); setCowLossesL("");
    setNote("");
  }

  // ─── Derived ───
  const goatMl = parseMl(goatVolumeL);
  const goatFeedMl = parseMl(goatFeedingL);
  const goatLossMl = parseMl(goatLossesL);
  const goatNetMl = goatMl - goatFeedMl - goatLossMl;

  const sheepMl = parseMl(sheepVolumeL);
  const sheepFeedMl = parseMl(sheepFeedingL);
  const sheepLossMl = parseMl(sheepLossesL);
  const sheepNetMl = sheepMl - sheepFeedMl - sheepLossMl;

  const cowMl = parseMl(cowVolumeL);
  const cowFeedMl = parseMl(cowFeedingL);
  const cowLossMl = parseMl(cowLossesL);
  const cowNetMl = cowMl - cowFeedMl - cowLossMl;

  const totalMl = goatMl + sheepMl + cowMl;
  const totalNetMl = goatNetMl + sheepNetMl + cowNetMl;
  const totalHeads = goatHeads + sheepHeads + cowHeads;

  const goatValid = (goatMl > 0 && goatHeads > 0) || (goatMl === 0 && goatHeads === 0);
  const sheepValid = (sheepMl > 0 && sheepHeads > 0) || (sheepMl === 0 && sheepHeads === 0);
  const cowValid = (cowMl > 0 && cowHeads > 0) || (cowMl === 0 && cowHeads === 0);
  const feedingValid = goatNetMl >= 0 && sheepNetMl >= 0 && cowNetMl >= 0;
  const canSubmit = totalMl > 0 && goatValid && sheepValid && cowValid && feedingValid && !createMutation.isPending;

  const todaySessions = todayQuery.data ?? [];
  const hasMorning = todaySessions.some((s: any) => s.shift === "morning");
  const hasEvening = todaySessions.some((s: any) => s.shift === "evening");
  const todayTotalL = todaySessions.reduce((sum: number, s: any) => sum + s.totalVolumeLiters, 0);
  const todayNetL = todaySessions.reduce((sum: number, s: any) => sum + (s.netVolumeLiters ?? s.totalVolumeLiters), 0);

  // ─── Edit helpers ───
  function startEdit(s: any) {
    setEditingId(s.id);
    setEditShift(s.shift);
    setEditGoatHeads(s.goat?.headCount ?? 0);
    setEditGoatVolumeL(s.goat?.volumeLiters > 0 ? String(s.goat.volumeLiters) : "");
    setEditGoatFeedingL(s.goat?.feedingLiters > 0 ? String(s.goat.feedingLiters) : "");
    setEditGoatLossesL(s.goat?.lossesLiters > 0 ? String(s.goat.lossesLiters) : "");
    setEditSheepHeads(s.sheep?.headCount ?? 0);
    setEditSheepVolumeL(s.sheep?.volumeLiters > 0 ? String(s.sheep.volumeLiters) : "");
    setEditSheepFeedingL(s.sheep?.feedingLiters > 0 ? String(s.sheep.feedingLiters) : "");
    setEditSheepLossesL(s.sheep?.lossesLiters > 0 ? String(s.sheep.lossesLiters) : "");
    setEditCowHeads(s.cow?.headCount ?? 0);
    setEditCowVolumeL(s.cow?.volumeLiters > 0 ? String(s.cow.volumeLiters) : "");
    setEditCowFeedingL(s.cow?.feedingLiters > 0 ? String(s.cow.feedingLiters) : "");
    setEditCowLossesL(s.cow?.lossesLiters > 0 ? String(s.cow.lossesLiters) : "");
    setEditNote(s.note ?? "");
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const eGoatMl = parseMl(editGoatVolumeL);
    const eSheepMl = parseMl(editSheepVolumeL);
    const eCowMl = parseMl(editCowVolumeL);

    if (eGoatMl + eSheepMl + eCowMl === 0) {
      toast.error("Укажите объём хотя бы для одного вида");
      return;
    }

    updateMutation.mutate({
      sessionId: editingId,
      shift: editShift,
      goat: {
        volumeMl: eGoatMl,
        headCount: editGoatHeads,
        feedingMl: parseMl(editGoatFeedingL),
        lossesMl: parseMl(editGoatLossesL),
      },
      sheep: {
        volumeMl: eSheepMl,
        headCount: editSheepHeads,
        feedingMl: parseMl(editSheepFeedingL),
        lossesMl: parseMl(editSheepLossesL),
      },
      cow: {
        volumeMl: eCowMl,
        headCount: editCowHeads,
        feedingMl: parseMl(editCowFeedingL),
        lossesMl: parseMl(editCowLossesL),
      },
      note: editNote.trim() || null,
    });
  }

  function handleCancel(sessionId: number) {
    if (confirm("Отменить эту дойку? Запись будет удалена.")) {
      cancelMutation.mutate({ sessionId });
    }
  }

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
      goat: { volumeMl: goatMl, headCount: goatHeads, feedingMl: goatFeedMl, lossesMl: goatLossMl },
      sheep: { volumeMl: sheepMl, headCount: sheepHeads, feedingMl: sheepFeedMl, lossesMl: sheepLossMl },
      cow: { volumeMl: cowMl, headCount: cowHeads, feedingMl: cowFeedMl, lossesMl: cowLossMl },
      note: note.trim() || undefined,
    });
  }

  // ─── Reusable volume input ───
  function VolumeInput({
    value,
    onChange,
    placeholder,
    label,
  }: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
    label?: string;
  }) {
    return (
      <div className="relative flex-1">
        {label && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(0.55_0.04_80)]">
            {label}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder ?? "0"}
          value={value}
          onChange={(e) => {
            const v = sanitizeVolume(e.target.value);
            if (v !== null) onChange(v);
          }}
          className={`w-full h-10 text-base font-bold text-center rounded-lg pr-7 ${label ? "pl-14" : "pl-3"}
                     border border-[oklch(0.88_0.02_90)] bg-[oklch(0.98_0.01_90)]
                     focus:border-[oklch(0.35_0.12_150)] focus:ring-1 focus:ring-[oklch(0.35_0.12_150)]
                     focus:outline-none`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[oklch(0.52_0.04_80)]">
          л
        </span>
      </div>
    );
  }

  // ─── Animal block with heads + volume + feeding + losses ───
  function AnimalBlock({
    emoji,
    label,
    heads,
    setHeads,
    volumeL,
    setVolumeL,
    feedingL,
    setFeedingL,
    lossesL,
    setLossesL,
    valid,
  }: {
    emoji: string;
    label: string;
    heads: number;
    setHeads: (n: number) => void;
    volumeL: string;
    setVolumeL: (s: string) => void;
    feedingL: string;
    setFeedingL: (s: string) => void;
    lossesL: string;
    setLossesL: (s: string) => void;
    valid: boolean;
  }) {
    const volMl = parseMl(volumeL);
    const feedMl = parseMl(feedingL);
    const lossMl = parseMl(lossesL);
    const netMl = volMl - feedMl - lossMl;
    const overLimit = netMl < 0;

    return (
      <div className={`bg-white rounded-xl border ${!valid || overLimit ? "border-red-300" : "border-[oklch(0.88_0.02_90)]"} p-3 mb-3`}>
        {/* Type label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{emoji}</span>
          <span className="text-sm font-semibold text-[oklch(0.3_0.04_60)]">{label}</span>
          {volMl > 0 && (
            <span className="ml-auto text-xs font-bold text-[oklch(0.35_0.12_150)]">
              → Сыроделу: {(netMl / 1000).toFixed(1)} л
            </span>
          )}
        </div>

        {/* Row 1: Head counter + Total volume */}
        <div className="flex items-center gap-3 mb-2">
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

          {/* Total volume */}
          <VolumeInput value={volumeL} onChange={setVolumeL} placeholder="Надой" />
        </div>

        {/* Row 2: Feeding + Losses (only show if volume > 0) */}
        {volMl > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={feedingL}
                onChange={(e) => {
                  const v = sanitizeVolume(e.target.value);
                  if (v !== null) setFeedingL(v);
                }}
                className="w-full h-9 text-sm font-medium text-center rounded-lg pr-6 pl-16
                           border border-[oklch(0.88_0.02_90)] bg-[oklch(0.99_0.005_90)]
                           focus:border-[oklch(0.35_0.12_150)] focus:ring-1 focus:ring-[oklch(0.35_0.12_150)]
                           focus:outline-none"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(0.55_0.04_80)]">
                Выпойка
              </span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(0.52_0.04_80)]">
                л
              </span>
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={lossesL}
                onChange={(e) => {
                  const v = sanitizeVolume(e.target.value);
                  if (v !== null) setLossesL(v);
                }}
                className="w-full h-9 text-sm font-medium text-center rounded-lg pr-6 pl-14
                           border border-[oklch(0.88_0.02_90)] bg-[oklch(0.99_0.005_90)]
                           focus:border-[oklch(0.35_0.12_150)] focus:ring-1 focus:ring-[oklch(0.35_0.12_150)]
                           focus:outline-none"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(0.55_0.04_80)]">
                Потери
              </span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(0.52_0.04_80)]">
                л
              </span>
            </div>
          </div>
        )}

        {!valid && (
          <p className="text-[10px] text-red-500 mt-1">
            Укажите и головы, и объём (или оставьте оба пустыми)
          </p>
        )}
        {overLimit && (
          <p className="text-[10px] text-red-500 mt-1">
            Выпойка + потери не могут превышать общий надой
          </p>
        )}
      </div>
    );
  }

  // ─── Compact edit row for inline editing in history ───
  function EditAnimalBlock({
    emoji,
    label,
    heads,
    setHeads,
    volumeL,
    setVolumeL,
    feedingL,
    setFeedingL,
    lossesL,
    setLossesL,
  }: {
    emoji: string;
    label: string;
    heads: number;
    setHeads: (n: number) => void;
    volumeL: string;
    setVolumeL: (s: string) => void;
    feedingL: string;
    setFeedingL: (s: string) => void;
    lossesL: string;
    setLossesL: (s: string) => void;
  }) {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{emoji}</span>
          <span className="text-xs text-[oklch(0.4_0.04_80)] font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Heads */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHeads(Math.max(0, heads - 1))}
              className="w-8 h-8 rounded-md bg-[oklch(0.94_0.02_90)] flex items-center justify-center active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{heads}</span>
            <button
              onClick={() => setHeads(heads + 1)}
              className="w-8 h-8 rounded-md bg-[oklch(0.35_0.12_150)] flex items-center justify-center active:bg-[oklch(0.30_0.12_150)] touch-manipulation"
            >
              <Plus className="w-3 h-3 text-white" />
            </button>
          </div>
          {/* Volume */}
          <div className="flex-1 relative">
            <input
              type="text" inputMode="decimal" placeholder="Надой"
              value={volumeL}
              onChange={(e) => { const v = sanitizeVolume(e.target.value); if (v !== null) setVolumeL(v); }}
              className="w-full h-8 text-sm font-bold text-center rounded-md pr-5 pl-2
                         border border-[oklch(0.88_0.02_90)] bg-white
                         focus:border-[oklch(0.35_0.12_150)] focus:ring-1 focus:ring-[oklch(0.35_0.12_150)] focus:outline-none"
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(0.52_0.04_80)]">л</span>
          </div>
          {/* Feeding */}
          <div className="w-16 relative">
            <input
              type="text" inputMode="decimal" placeholder="Вып."
              value={feedingL}
              onChange={(e) => { const v = sanitizeVolume(e.target.value); if (v !== null) setFeedingL(v); }}
              className="w-full h-8 text-xs font-medium text-center rounded-md pr-4 pl-1
                         border border-[oklch(0.88_0.02_90)] bg-white
                         focus:border-[oklch(0.35_0.12_150)] focus:ring-1 focus:ring-[oklch(0.35_0.12_150)] focus:outline-none"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-[oklch(0.52_0.04_80)]">л</span>
          </div>
          {/* Losses */}
          <div className="w-16 relative">
            <input
              type="text" inputMode="decimal" placeholder="Пот."
              value={lossesL}
              onChange={(e) => { const v = sanitizeVolume(e.target.value); if (v !== null) setLossesL(v); }}
              className="w-full h-8 text-xs font-medium text-center rounded-md pr-4 pl-1
                         border border-[oklch(0.88_0.02_90)] bg-white
                         focus:border-[oklch(0.35_0.12_150)] focus:ring-1 focus:ring-[oklch(0.35_0.12_150)] focus:outline-none"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-[oklch(0.52_0.04_80)]">л</span>
          </div>
        </div>
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
            <LogOut className="h-5 w-5" />
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
                <div>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[oklch(0.45_0.12_220)]" />
                    <span className="text-lg font-bold text-[oklch(0.22_0.04_60)]">
                      {todayTotalL.toFixed(1)} л
                    </span>
                  </div>
                  <p className="text-[10px] text-[oklch(0.52_0.04_80)] mt-0.5">
                    → Сыроделу: <strong>{todayNetL.toFixed(1)} л</strong>
                  </p>
                </div>
                <div className="flex gap-1.5 ml-auto">
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
                {(() => {
                  const totals = todaySessions.reduce(
                    (acc: any, s: any) => ({
                      goat: acc.goat + (s.goat?.volumeLiters ?? 0),
                      sheep: acc.sheep + (s.sheep?.volumeLiters ?? 0),
                      cow: acc.cow + (s.cow?.volumeLiters ?? 0),
                      goatNet: acc.goatNet + (s.goat?.netLiters ?? 0),
                      sheepNet: acc.sheepNet + (s.sheep?.netLiters ?? 0),
                      cowNet: acc.cowNet + (s.cow?.netLiters ?? 0),
                    }),
                    { goat: 0, sheep: 0, cow: 0, goatNet: 0, sheepNet: 0, cowNet: 0 },
                  );
                  return (
                    <>
                      {totals.goat > 0 && <span>🐐 {totals.goat.toFixed(1)}л → {totals.goatNet.toFixed(1)}л</span>}
                      {totals.sheep > 0 && <span>🐑 {totals.sheep.toFixed(1)}л → {totals.sheepNet.toFixed(1)}л</span>}
                      {totals.cow > 0 && <span>🐄 {totals.cow.toFixed(1)}л → {totals.cowNet.toFixed(1)}л</span>}
                    </>
                  );
                })()}
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

          {/* ── Per-type: heads + volume + feeding + losses ── */}
          <div className="px-4 mt-5">
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1 block">
              Дойные головы, надой, выпойка и потери
            </label>
            <p className="text-[10px] text-[oklch(0.6_0.02_80)] mb-3">
              Формула: Сыроделу = Надой − Выпойка − Потери
            </p>

            <AnimalBlock
              emoji="🐐" label="Козы"
              heads={goatHeads} setHeads={setGoatHeads}
              volumeL={goatVolumeL} setVolumeL={setGoatVolumeL}
              feedingL={goatFeedingL} setFeedingL={setGoatFeedingL}
              lossesL={goatLossesL} setLossesL={setGoatLossesL}
              valid={goatValid}
            />
            <AnimalBlock
              emoji="🐑" label="Овцы"
              heads={sheepHeads} setHeads={setSheepHeads}
              volumeL={sheepVolumeL} setVolumeL={setSheepVolumeL}
              feedingL={sheepFeedingL} setFeedingL={setSheepFeedingL}
              lossesL={sheepLossesL} setLossesL={setSheepLossesL}
              valid={sheepValid}
            />
            <AnimalBlock
              emoji="🐄" label="Коровы"
              heads={cowHeads} setHeads={setCowHeads}
              volumeL={cowVolumeL} setVolumeL={setCowVolumeL}
              feedingL={cowFeedingL} setFeedingL={setCowFeedingL}
              lossesL={cowLossesL} setLossesL={setCowLossesL}
              valid={cowValid}
            />

            {totalMl > 0 && (
              <div className="bg-[oklch(0.92_0.04_150)] rounded-xl p-3 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[oklch(0.3_0.08_150)]">Общий надой</span>
                  <span className="font-bold text-[oklch(0.22_0.04_60)]">{(totalMl / 1000).toFixed(1)} л</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="font-semibold text-[oklch(0.25_0.12_150)]">→ Сыроделу</span>
                  <span className="font-bold text-lg text-[oklch(0.25_0.12_150)]">{(totalNetMl / 1000).toFixed(1)} л</span>
                </div>
                <p className="text-[10px] text-[oklch(0.45_0.06_150)] mt-1">
                  {totalHeads} голов · Выпойка: {((parseMl(goatFeedingL) + parseMl(sheepFeedingL) + parseMl(cowFeedingL)) / 1000).toFixed(1)}л · Потери: {((parseMl(goatLossesL) + parseMl(sheepLossesL) + parseMl(cowLossesL)) / 1000).toFixed(1)}л
                </p>
              </div>
            )}
          </div>

          {/* ── Note (optional) ── */}
          <div className="px-4 mt-4">
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
                const isPending = s.status === "pending_confirm";
                const isEditing = editingId === s.id;

                return (
                  <div
                    key={s.id}
                    className={`bg-white rounded-xl border p-4 ${isEditing ? "border-[oklch(0.35_0.12_150)] ring-1 ring-[oklch(0.35_0.12_150)]" : "border-[oklch(0.9_0.02_90)]"}`}
                  >
                    {/* Header row: code + status + action buttons */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                          {s.sessionCode}
                        </span>
                        <Badge className={`rounded-full text-[10px] ${st.color}`}>
                          {st.label}
                        </Badge>
                      </div>

                      {isPending && !isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(s)}
                            className="w-9 h-9 rounded-lg bg-[oklch(0.94_0.02_90)] flex items-center justify-center
                                       active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
                            title="Редактировать"
                          >
                            <Pencil className="w-4 h-4 text-[oklch(0.45_0.08_220)]" />
                          </button>
                          <button
                            onClick={() => handleCancel(s.id)}
                            disabled={cancelMutation.isPending}
                            className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center
                                       active:bg-red-100 touch-manipulation"
                            title="Отменить дойку"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      )}

                      {isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            className="w-9 h-9 rounded-lg bg-[oklch(0.35_0.12_150)] flex items-center justify-center
                                       active:bg-[oklch(0.30_0.12_150)] touch-manipulation"
                            title="Сохранить"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 text-white" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-9 h-9 rounded-lg bg-[oklch(0.94_0.02_90)] flex items-center justify-center
                                       active:bg-[oklch(0.88_0.02_90)] touch-manipulation"
                            title="Отмена"
                          >
                            <X className="w-4 h-4 text-[oklch(0.4_0.04_80)]" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Inline edit form ── */}
                    {isEditing ? (
                      <div className="bg-[oklch(0.98_0.01_90)] rounded-lg p-2 mt-1">
                        <div className="flex gap-2 mb-2">
                          {SHIFT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setEditShift(opt.value)}
                              className={`flex-1 h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-1 touch-manipulation
                                ${editShift === opt.value
                                  ? "bg-[oklch(0.35_0.12_150)] text-white"
                                  : "bg-white border border-[oklch(0.88_0.02_90)] text-[oklch(0.4_0.04_80)]"}`}
                            >
                              <span>{opt.emoji}</span> {opt.label}
                            </button>
                          ))}
                        </div>

                        <EditAnimalBlock
                          emoji="🐐" label="Козы"
                          heads={editGoatHeads} setHeads={setEditGoatHeads}
                          volumeL={editGoatVolumeL} setVolumeL={setEditGoatVolumeL}
                          feedingL={editGoatFeedingL} setFeedingL={setEditGoatFeedingL}
                          lossesL={editGoatLossesL} setLossesL={setEditGoatLossesL}
                        />
                        <EditAnimalBlock
                          emoji="🐑" label="Овцы"
                          heads={editSheepHeads} setHeads={setEditSheepHeads}
                          volumeL={editSheepVolumeL} setVolumeL={setEditSheepVolumeL}
                          feedingL={editSheepFeedingL} setFeedingL={setEditSheepFeedingL}
                          lossesL={editSheepLossesL} setLossesL={setEditSheepLossesL}
                        />
                        <EditAnimalBlock
                          emoji="🐄" label="Коровы"
                          heads={editCowHeads} setHeads={setEditCowHeads}
                          volumeL={editCowVolumeL} setVolumeL={setEditCowVolumeL}
                          feedingL={editCowFeedingL} setFeedingL={setEditCowFeedingL}
                          lossesL={editCowLossesL} setLossesL={setEditCowLossesL}
                        />

                        <textarea
                          placeholder="Заметка"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          maxLength={1000}
                          rows={2}
                          className="w-full mt-2 rounded-lg border border-[oklch(0.88_0.02_90)] bg-white px-3 py-2
                                     text-xs resize-none focus:outline-none focus:border-[oklch(0.35_0.12_150)]
                                     focus:ring-1 focus:ring-[oklch(0.35_0.12_150)]"
                        />
                      </div>
                    ) : (
                      <>
                        {/* Per-type breakdown with feeding/losses (read-only) */}
                        <div className="space-y-1 mb-2">
                          {s.goat?.volumeLiters > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[oklch(0.5_0.04_80)]">🐐 Козье</span>
                              <span className="font-semibold text-[oklch(0.22_0.04_60)]">
                                {s.goat.volumeLiters}л · {s.goat.headCount} гол.
                                {(s.goat.feedingLiters > 0 || s.goat.lossesLiters > 0) && (
                                  <span className="text-[oklch(0.55_0.04_80)] font-normal ml-1">
                                    (вып:{s.goat.feedingLiters} пот:{s.goat.lossesLiters})
                                  </span>
                                )}
                                <span className="text-[oklch(0.35_0.12_150)] ml-1">→{s.goat.netLiters}л</span>
                              </span>
                            </div>
                          )}
                          {s.sheep?.volumeLiters > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[oklch(0.5_0.04_80)]">🐑 Овечье</span>
                              <span className="font-semibold text-[oklch(0.22_0.04_60)]">
                                {s.sheep.volumeLiters}л · {s.sheep.headCount} гол.
                                {(s.sheep.feedingLiters > 0 || s.sheep.lossesLiters > 0) && (
                                  <span className="text-[oklch(0.55_0.04_80)] font-normal ml-1">
                                    (вып:{s.sheep.feedingLiters} пот:{s.sheep.lossesLiters})
                                  </span>
                                )}
                                <span className="text-[oklch(0.35_0.12_150)] ml-1">→{s.sheep.netLiters}л</span>
                              </span>
                            </div>
                          )}
                          {s.cow?.volumeLiters > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[oklch(0.5_0.04_80)]">🐄 Коровье</span>
                              <span className="font-semibold text-[oklch(0.22_0.04_60)]">
                                {s.cow.volumeLiters}л · {s.cow.headCount} гол.
                                {(s.cow.feedingLiters > 0 || s.cow.lossesLiters > 0) && (
                                  <span className="text-[oklch(0.55_0.04_80)] font-normal ml-1">
                                    (вып:{s.cow.feedingLiters} пот:{s.cow.lossesLiters})
                                  </span>
                                )}
                                <span className="text-[oklch(0.35_0.12_150)] ml-1">→{s.cow.netLiters}л</span>
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs border-t border-[oklch(0.94_0.01_90)] pt-1.5">
                          <span className="text-[oklch(0.5_0.04_80)]">Итого надой / Сыроделу</span>
                          <span className="font-bold text-sm text-[oklch(0.22_0.04_60)]">
                            {s.totalVolumeLiters}л → <span className="text-[oklch(0.25_0.12_150)]">{s.netVolumeLiters}л</span>
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
                        </div>
                      </>
                    )}
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
