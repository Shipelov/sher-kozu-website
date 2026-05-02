/**
 * /farm/cheesemaker — Processing Tab (Переработка).
 *
 * Full workflow for cheesemaker to:
 * 1. Create processing sessions (CH-dd.mm.yyyy)
 * 2. Select milk from tanks (inputs)
 * 3. Record produced products (outputs)
 * 4. Complete session → tank deduction + warehouse credit + conversion calc
 * 5. View history with conversion coefficients
 * 6. Export to Excel/PDF
 */

import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportExcel,
  exportPDF,
  fmtDate,
  periodSubtitle,
  getPresetDates,
  type ReportColumn,
} from "@/lib/reportExport";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "Черновик", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "В процессе", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Завершена", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Отменена", color: "bg-red-100 text-red-700" },
};

const MILK_TYPE_EMOJI: Record<string, string> = {
  goat: "🐐",
  sheep: "🐑",
  cow: "🐄",
};

const MILK_TYPE_LABELS: Record<string, string> = {
  goat: "Козье",
  sheep: "Овечье",
  cow: "Коровье",
};

interface ProcessingTabProps {
  isActive: boolean;
}

export default function FarmProcessingTab({ isActive }: ProcessingTabProps) {
  const [subView, setSubView] = useState<"list" | "create" | "detail" | "report">("list");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ─── Report state ───
  const [reportPreset, setReportPreset] = useState<"today" | "week" | "month" | "custom">("week");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const reportDates = useMemo(() => {
    if (reportPreset === "custom") return { from: reportFrom, to: reportTo };
    return getPresetDates(reportPreset);
  }, [reportPreset, reportFrom, reportTo]);

  // ─── Queries ───
  const sessionsQuery = trpc.milkProcessing.listSessions.useQuery(
    { limit: 30, offset: 0 },
    { enabled: isActive },
  );

  const tanksQuery = trpc.milkProcessing.activeTanks.useQuery(undefined, { enabled: isActive });
  const catalogQuery = trpc.milkProcessing.catalogItems.useQuery(undefined, { enabled: isActive });
  const warehousesQuery = trpc.milkProcessing.activeWarehouses.useQuery(undefined, { enabled: isActive });

  const detailQuery = trpc.milkProcessing.getSession.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: !!selectedSessionId },
  );

  const utils = trpc.useUtils();

  // ─── Mutations ───
  const createMutation = trpc.milkProcessing.createSession.useMutation({
    onSuccess: (data: any) => {
      toast.success("Сессия создана", { description: data.sessionCode });
      setSelectedSessionId(data.id);
      setSubView("detail");
      void utils.milkProcessing.listSessions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const updateMutation = trpc.milkProcessing.updateSession.useMutation({
    onSuccess: () => {
      toast.success("Сессия обновлена");
      void utils.milkProcessing.getSession.invalidate();
      void utils.milkProcessing.listSessions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const completeMutation = trpc.milkProcessing.completeSession.useMutation({
    onSuccess: (data: any) => {
      toast.success("Сессия завершена!", { description: `${data.sessionCode} — танки списаны, склад пополнен` });
      void utils.milkProcessing.getSession.invalidate();
      void utils.milkProcessing.listSessions.invalidate();
      void utils.milkProcessing.activeTanks.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const cancelMutation = trpc.milkProcessing.cancelSession.useMutation({
    onSuccess: () => {
      toast.success("Сессия отменена");
      void utils.milkProcessing.getSession.invalidate();
      void utils.milkProcessing.listSessions.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  const correctMutation = trpc.milkProcessing.correctSession.useMutation({
    onSuccess: () => {
      toast.success("Сессия откатана для исправления");
      void utils.milkProcessing.getSession.invalidate();
      void utils.milkProcessing.listSessions.invalidate();
      void utils.milkProcessing.activeTanks.invalidate();
    },
    onError: (err: any) => toast.error("Ошибка", { description: err.message }),
  });

  // ─── Create session state ───
  const [createDate, setCreateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createNote, setCreateNote] = useState("");

  // ─── Edit session state ───
  const [editInputs, setEditInputs] = useState<Array<{ tankId: number; volumeMl: number; milkType: string }>>([]);
  const [editOutputs, setEditOutputs] = useState<Array<{
    catalogItemId: number;
    productLabel: string;
    quantity: number;
    unit: string;
    warehouseId: number;
  }>>([]);
  const [editNote, setEditNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Sync detail data to edit state
  useEffect(() => {
    if (detailQuery.data && !isEditing) {
      setEditInputs(
        detailQuery.data.inputs.map((inp: any) => ({
          tankId: inp.tankId,
          volumeMl: inp.volumeMl,
          milkType: inp.milkType,
        })),
      );
      setEditOutputs(
        detailQuery.data.outputs.map((out: any) => ({
          catalogItemId: out.catalogItemId,
          productLabel: out.productLabel,
          quantity: out.quantity,
          unit: out.unit,
          warehouseId: out.warehouseId,
        })),
      );
      setEditNote(detailQuery.data.session.note ?? "");
    }
  }, [detailQuery.data, isEditing]);

  if (!isActive) return null;

  const sessions = sessionsQuery.data?.sessions ?? [];
  const tanks = (tanksQuery.data ?? []) as any[];
  const catalog = (catalogQuery.data ?? []) as any[];
  const warehousesList = (warehousesQuery.data ?? []) as any[];

  // ─── Sub-views ───

  // LIST VIEW
  if (subView === "list") {
    return (
      <div className="px-4 mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[oklch(0.22_0.04_60)]">Переработка</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSubView("report")}
              className="rounded-xl text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Отчёт
            </Button>
            <Button
              size="sm"
              onClick={() => setSubView("create")}
              className="rounded-xl bg-[oklch(0.40_0.12_80)] hover:bg-[oklch(0.35_0.12_80)] text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Новая сессия
            </Button>
          </div>
        </div>

        {sessionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[oklch(0.5_0.04_80)]" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto mb-3 text-[oklch(0.7_0.04_80)]" />
            <p className="text-sm font-medium text-[oklch(0.3_0.04_60)]">Нет сессий переработки</p>
            <p className="text-xs text-[oklch(0.52_0.04_80)] mt-1">
              Создайте первую сессию, чтобы начать
            </p>
          </div>
        ) : (
          sessions.map((s: any) => {
            const st = STATUS_MAP[s.status] ?? { label: s.status, color: "bg-gray-100" };
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] overflow-hidden"
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                        {s.sessionCode}
                      </span>
                      <Badge className={`rounded-full text-[10px] ${st.color}`}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-[oklch(0.52_0.04_80)] mt-0.5">
                      {fmtDate(s.shiftDate + "T00:00:00")} • {s.workerName} • {(s.totalInputMl / 1000).toFixed(1)} л
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[oklch(0.5_0.04_80)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[oklch(0.5_0.04_80)]" />
                  )}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[oklch(0.95_0.01_90)] pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSessionId(s.id);
                        setSubView("detail");
                        setIsEditing(false);
                      }}
                      className="rounded-xl text-xs w-full"
                    >
                      Открыть
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // CREATE VIEW
  if (subView === "create") {
    return (
      <div className="px-4 mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSubView("list")} className="rounded-xl">
            ← Назад
          </Button>
          <h2 className="text-base font-semibold text-[oklch(0.22_0.04_60)]">Новая сессия</h2>
        </div>

        <div className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
              Дата переработки
            </label>
            <input
              type="date"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[oklch(0.40_0.12_80)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
              Заметка (необязательно)
            </label>
            <textarea
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Комментарий к сессии..."
              className="w-full rounded-xl border border-[oklch(0.88_0.02_90)] bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[oklch(0.40_0.12_80)]"
            />
          </div>

          <Button
            onClick={() => createMutation.mutate({ shiftDate: createDate, note: createNote || undefined })}
            disabled={!createDate || createMutation.isPending}
            className="w-full h-12 rounded-xl bg-[oklch(0.40_0.12_80)] hover:bg-[oklch(0.35_0.12_80)]"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Создать сессию
          </Button>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (subView === "detail" && selectedSessionId) {
    const detail = detailQuery.data;
    const isLoading = detailQuery.isLoading;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[oklch(0.5_0.04_80)]" />
        </div>
      );
    }

    if (!detail) return null;

    const session = detail.session;
    const canEdit = session.status === "draft" || session.status === "in_progress";
    const canComplete = canEdit && editInputs.length > 0 && editOutputs.length > 0;
    const st = STATUS_MAP[session.status] ?? { label: session.status, color: "bg-gray-100" };

    return (
      <div className="px-4 mt-4 space-y-4 pb-8">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSubView("list"); setSelectedSessionId(null); setIsEditing(false); }}
            className="rounded-xl"
          >
            ← Назад
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[oklch(0.22_0.04_60)] font-mono">
                {session.sessionCode}
              </span>
              <Badge className={`rounded-full text-[10px] ${st.color}`}>{st.label}</Badge>
            </div>
            <p className="text-xs text-[oklch(0.52_0.04_80)]">
              {fmtDate(session.shiftDate + "T00:00:00")} • {session.workerName}
            </p>
          </div>
        </div>

        {/* Inputs section */}
        <div className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">
              🥛 Входное молоко
            </h3>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditInputs([...editInputs, { tankId: 0, volumeMl: 0, milkType: "goat" }])}
                className="text-xs h-7"
              >
                <Plus className="w-3 h-3 mr-1" /> Добавить
              </Button>
            )}
          </div>

          {editInputs.length === 0 ? (
            <p className="text-xs text-[oklch(0.6_0.02_80)] py-2">Нет входных данных</p>
          ) : (
            <div className="space-y-2">
              {editInputs.map((inp, idx) => {
                const tank = tanks.find((t: any) => t.id === inp.tankId);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-[oklch(0.97_0.01_90)] rounded-lg p-2">
                    <div className="flex-1 space-y-1.5">
                      {canEdit ? (
                        <>
                          <Select
                            value={inp.tankId ? String(inp.tankId) : ""}
                            onValueChange={(val) => {
                              const t = tanks.find((t: any) => t.id === parseInt(val));
                              const newInputs = [...editInputs];
                              newInputs[idx] = {
                                ...newInputs[idx],
                                tankId: parseInt(val),
                                milkType: t?.milkType ?? "goat",
                              };
                              setEditInputs(newInputs);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-lg">
                              <SelectValue placeholder="Выберите танк" />
                            </SelectTrigger>
                            <SelectContent>
                              {tanks.filter((t: any) => t.currentVolumeMl > 0).map((t: any) => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {MILK_TYPE_EMOJI[t.milkType]} {t.name} — {(t.currentVolumeMl / 1000).toFixed(1)} л
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            placeholder="Объём (л)"
                            value={inp.volumeMl ? (inp.volumeMl / 1000).toString() : ""}
                            onChange={(e) => {
                              const newInputs = [...editInputs];
                              newInputs[idx] = { ...newInputs[idx], volumeMl: Math.round(parseFloat(e.target.value || "0") * 1000) };
                              setEditInputs(newInputs);
                            }}
                            className="h-8 text-xs rounded-lg"
                          />
                        </>
                      ) : (
                        <div className="text-xs">
                          <span className="font-medium">{MILK_TYPE_EMOJI[inp.milkType]} {tank?.name ?? `Танк #${inp.tankId}`}</span>
                          <span className="ml-2 text-[oklch(0.5_0.04_80)]">{(inp.volumeMl / 1000).toFixed(1)} л</span>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                        onClick={() => setEditInputs(editInputs.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-[oklch(0.5_0.04_80)] pt-1">
                Итого: <strong>{(editInputs.reduce((s, i) => s + i.volumeMl, 0) / 1000).toFixed(1)} л</strong>
              </p>
            </div>
          )}
        </div>

        {/* Outputs section */}
        <div className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">
              🧀 Выходная продукция
            </h3>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditOutputs([...editOutputs, { catalogItemId: 0, productLabel: "", quantity: 0, unit: "кг", warehouseId: 0 }])}
                className="text-xs h-7"
              >
                <Plus className="w-3 h-3 mr-1" /> Добавить
              </Button>
            )}
          </div>

          {editOutputs.length === 0 ? (
            <p className="text-xs text-[oklch(0.6_0.02_80)] py-2">Нет выходных данных</p>
          ) : (
            <div className="space-y-2">
              {editOutputs.map((out, idx) => (
                <div key={idx} className="bg-[oklch(0.97_0.01_90)] rounded-lg p-2 space-y-1.5">
                  {canEdit ? (
                    <>
                      <Select
                        value={out.catalogItemId ? String(out.catalogItemId) : ""}
                        onValueChange={(val) => {
                          const item = catalog.find((c: any) => c.id === parseInt(val));
                          const newOutputs = [...editOutputs];
                          newOutputs[idx] = {
                            ...newOutputs[idx],
                            catalogItemId: parseInt(val),
                            productLabel: item?.label ?? "",
                            unit: item?.unit ?? "кг",
                          };
                          setEditOutputs(newOutputs);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue placeholder="Выберите продукт" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.label} ({c.conversionRatio} л/ед)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          placeholder="Кол-во"
                          value={out.quantity || ""}
                          onChange={(e) => {
                            const newOutputs = [...editOutputs];
                            newOutputs[idx] = { ...newOutputs[idx], quantity: parseFloat(e.target.value || "0") };
                            setEditOutputs(newOutputs);
                          }}
                          className="h-8 text-xs rounded-lg flex-1"
                        />
                        <span className="text-xs self-center text-[oklch(0.5_0.04_80)] w-8">{out.unit}</span>
                        <Select
                          value={out.warehouseId ? String(out.warehouseId) : ""}
                          onValueChange={(val) => {
                            const newOutputs = [...editOutputs];
                            newOutputs[idx] = { ...newOutputs[idx], warehouseId: parseInt(val) };
                            setEditOutputs(newOutputs);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-lg flex-1">
                            <SelectValue placeholder="Склад" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehousesList.map((w: any) => (
                              <SelectItem key={w.id} value={String(w.id)}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{out.productLabel}</span>
                      <span className="text-[oklch(0.5_0.04_80)]">{out.quantity} {out.unit}</span>
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400 hover:text-red-600"
                        onClick={() => setEditOutputs(editOutputs.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Conversion coefficients (for completed sessions) */}
          {session.status === "completed" && detail.outputs.length > 0 && (
            <div className="mt-4 border-t border-[oklch(0.92_0.01_90)] pt-3">
              <h4 className="text-xs font-semibold text-[oklch(0.3_0.04_60)] mb-2">
                📊 Коэффициенты конверсии
              </h4>
              <div className="space-y-1.5">
                {detail.outputs.map((out: any) => {
                  const deviation = out.deviationPercent;
                  const isAlert = deviation !== null && Math.abs(deviation) > 15;
                  return (
                    <div key={out.id} className={`flex items-center justify-between text-xs p-2 rounded-lg ${isAlert ? "bg-red-50" : "bg-[oklch(0.97_0.01_90)]"}`}>
                      <span className="font-medium">{out.productLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[oklch(0.5_0.04_80)]">
                          Факт: {out.actualConversionRatio?.toFixed(2) ?? "—"} л/ед
                        </span>
                        <span className="text-[oklch(0.6_0.02_80)]">|</span>
                        <span className="text-[oklch(0.5_0.04_80)]">
                          Норма: {out.baseConversionRatio?.toFixed(2) ?? "—"}
                        </span>
                        {deviation !== null && (
                          <Badge className={`rounded-full text-[9px] ${isAlert ? "bg-red-100 text-red-700" : Math.abs(deviation) > 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%
                          </Badge>
                        )}
                        {isAlert && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        {canEdit && (
          <div className="bg-white rounded-xl border border-[oklch(0.9_0.02_90)] p-4">
            <label className="text-xs font-medium text-[oklch(0.52_0.04_80)] mb-1.5 block">
              Заметка
            </label>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              maxLength={2000}
              rows={2}
              className="w-full rounded-xl border border-[oklch(0.88_0.02_90)] bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[oklch(0.40_0.12_80)]"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {canEdit && (
            <>
              <Button
                onClick={() => {
                  updateMutation.mutate({
                    sessionId: selectedSessionId!,
                    note: editNote || null,
                    inputs: editInputs.filter((i) => i.tankId > 0 && i.volumeMl > 0).map((i) => ({
                      tankId: i.tankId,
                      volumeMl: i.volumeMl,
                      milkType: i.milkType as "goat" | "sheep" | "cow",
                    })),
                    outputs: editOutputs.filter((o) => o.catalogItemId > 0 && o.quantity > 0 && o.warehouseId > 0),
                  });
                }}
                disabled={updateMutation.isPending}
                variant="outline"
                className="w-full h-11 rounded-xl"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                💾 Сохранить черновик
              </Button>

              <Button
                onClick={() => completeMutation.mutate({ sessionId: selectedSessionId! })}
                disabled={!canComplete || completeMutation.isPending}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Завершить сессию
              </Button>

              <Button
                onClick={() => cancelMutation.mutate({ sessionId: selectedSessionId! })}
                disabled={cancelMutation.isPending}
                variant="ghost"
                className="w-full h-9 rounded-xl text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-1" /> Отменить сессию
              </Button>
            </>
          )}

          {session.status === "completed" && (
            <Button
              onClick={() => correctMutation.mutate({ sessionId: selectedSessionId! })}
              disabled={correctMutation.isPending}
              variant="outline"
              className="w-full h-11 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              {correctMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Исправить (откатить)
            </Button>
          )}
        </div>
      </div>
    );
  }

  // REPORT VIEW
  if (subView === "report") {
    return (
      <div className="px-4 mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSubView("list")} className="rounded-xl">
            ← Назад
          </Button>
          <h2 className="text-base font-semibold text-[oklch(0.22_0.04_60)]">Отчёт переработки</h2>
        </div>

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

        <ProcessingReport dateFrom={reportDates.from} dateTo={reportDates.to} />
      </div>
    );
  }

  return null;
}

// ─── Processing Report Sub-component ───────────────────────────

function ProcessingReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const sessionsQuery = trpc.milkProcessing.listSessions.useQuery(
    { limit: 100, offset: 0, status: "completed", dateFrom, dateTo },
    { enabled: !!dateFrom && !!dateTo },
  );

  if (sessionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[oklch(0.5_0.04_80)]" />
        <span className="ml-2 text-sm text-[oklch(0.52_0.04_80)]">Загрузка данных...</span>
      </div>
    );
  }

  const sessions = sessionsQuery.data?.sessions ?? [];

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-center text-[oklch(0.52_0.04_80)] py-4">
        Нет завершённых сессий за выбранный период
      </p>
    );
  }

  const PROCESSING_COLUMNS: ReportColumn[] = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Код сессии", key: "sessionCode", width: 18 },
    { header: "Сыродел", key: "worker", width: 16 },
    { header: "Вход (л)", key: "inputLiters", width: 10 },
    { header: "Статус", key: "status", width: 12 },
  ];

  const rows = sessions.map((s: any) => ({
    date: fmtDate(s.shiftDate + "T00:00:00"),
    sessionCode: s.sessionCode,
    worker: s.workerName ?? "—",
    inputLiters: (s.totalInputMl / 1000).toFixed(1),
    status: STATUS_MAP[s.status]?.label ?? s.status,
  }));

  const totalInputL = sessions.reduce((sum: number, s: any) => sum + s.totalInputMl, 0) / 1000;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[oklch(0.52_0.04_80)]">
        Сессий: <span className="font-semibold text-[oklch(0.22_0.04_60)]">{sessions.length}</span>,{" "}
        молока переработано: <span className="font-semibold text-[oklch(0.22_0.04_60)]">{totalInputL.toFixed(1)} л</span>
      </p>

      {/* Download buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() =>
            exportExcel({
              title: "Отчёт переработки — Шерь Козу",
              subtitle: periodSubtitle(dateFrom, dateTo),
              columns: PROCESSING_COLUMNS,
              rows,
              summaryRows: [{
                date: "ИТОГО",
                sessionCode: `${sessions.length} сессий`,
                worker: "",
                inputLiters: totalInputL.toFixed(1),
                status: "",
              }],
              filename: `Переработка_${dateFrom}_${dateTo}`,
            })
          }
          variant="outline"
          className="flex-1 h-12 rounded-xl border-[oklch(0.40_0.12_80)] text-[oklch(0.40_0.12_80)]"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Excel
        </Button>
        <Button
          onClick={() =>
            exportPDF({
              title: "Отчёт переработки — Шерь Козу",
              subtitle: periodSubtitle(dateFrom, dateTo),
              columns: PROCESSING_COLUMNS,
              rows,
              summaryRows: [{
                date: "ИТОГО",
                sessionCode: `${sessions.length} сессий`,
                worker: "",
                inputLiters: totalInputL.toFixed(1),
                status: "",
              }],
              filename: `Переработка_${dateFrom}_${dateTo}`,
            })
          }
          variant="outline"
          className="flex-1 h-12 rounded-xl border-[oklch(0.40_0.12_80)] text-[oklch(0.40_0.12_80)]"
        >
          <FileText className="w-4 h-4 mr-2" />
          PDF
        </Button>
      </div>

      {/* Preview table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[oklch(0.96_0.01_90)]">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
              <th className="px-2 py-1.5 text-left font-semibold">Код</th>
              <th className="px-2 py-1.5 text-right font-semibold">Вход (л)</th>
              <th className="px-2 py-1.5 text-left font-semibold">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sessions.slice(0, 15).map((s: any) => (
              <tr key={s.id} className="hover:bg-[oklch(0.98_0.005_90)]">
                <td className="px-2 py-1.5">{fmtDate(s.shiftDate + "T00:00:00")}</td>
                <td className="px-2 py-1.5 font-mono">{s.sessionCode}</td>
                <td className="px-2 py-1.5 text-right font-medium text-emerald-700">
                  {(s.totalInputMl / 1000).toFixed(1)}
                </td>
                <td className="px-2 py-1.5">
                  <Badge className={`rounded-full text-[9px] ${STATUS_MAP[s.status]?.color ?? ""}`}>
                    {STATUS_MAP[s.status]?.label ?? s.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length > 15 && (
          <p className="text-center text-[10px] text-[oklch(0.6_0.02_80)] py-1">
            Показано 15 из {sessions.length}
          </p>
        )}
      </div>
    </div>
  );
}
