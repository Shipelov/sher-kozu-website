import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  BarChart3,
  Check,
  FlaskConical,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

/* ── Status labels ── */

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  running: "Запущен",
  paused: "Приостановлен",
  completed: "Завершён",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  running: "default",
  paused: "outline",
  completed: "secondary",
};

const VARIANT_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminABExperiments() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetPage, setTargetPage] = useState("/");
  const [goalEvent, setGoalEvent] = useState("share_purchase");

  const experimentsQ = trpc.abExperiments.list.useQuery(undefined, { enabled: isAdmin });
  const detailQ = trpc.abExperiments.getById.useQuery(
    { id: selectedId! },
    { enabled: isAdmin && selectedId !== null }
  );

  const createMut = trpc.abExperiments.create.useMutation({
    onSuccess: () => {
      toast.success("Эксперимент создан");
      utils.abExperiments.list.invalidate();
      setShowCreate(false);
      resetForm();
    },
  });

  const updateMut = trpc.abExperiments.update.useMutation({
    onSuccess: () => {
      toast.success("Эксперимент обновлён");
      utils.abExperiments.list.invalidate();
      utils.abExperiments.getById.invalidate();
    },
  });

  const deleteMut = trpc.abExperiments.delete.useMutation({
    onSuccess: () => {
      toast.success("Эксперимент удалён");
      utils.abExperiments.list.invalidate();
      setSelectedId(null);
    },
  });

  const addVariantMut = trpc.abExperiments.addVariant.useMutation({
    onSuccess: () => {
      toast.success("Вариант добавлен");
      utils.abExperiments.getById.invalidate();
    },
  });

  const removeVariantMut = trpc.abExperiments.removeVariant.useMutation({
    onSuccess: () => {
      toast.success("Вариант удалён");
      utils.abExperiments.getById.invalidate();
    },
  });

  function resetForm() {
    setName("");
    setDescription("");
    setTargetPage("/");
    setGoalEvent("share_purchase");
  }

  function handleCreate() {
    createMut.mutate({ name, description, targetPage, goalEvent });
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Доступ только для администраторов</p>
        </div>
      </DashboardLayout>
    );
  }

  /* ─── Experiment detail view ─── */
  if (selectedId !== null && detailQ.data) {
    const exp = detailQ.data;
    return (
      <DashboardLayout>
        <div className="container max-w-5xl py-6 space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад к списку
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{exp.name}</h1>
              {exp.description && <p className="text-muted-foreground mt-1">{exp.description}</p>}
            </div>
            <div className="flex gap-2">
              <Badge variant={STATUS_COLORS[exp.status] || "secondary"}>
                {STATUS_LABELS[exp.status] || exp.status}
              </Badge>
              {exp.status === "draft" && (
                <Button size="sm" onClick={() => updateMut.mutate({ id: exp.id, status: "running" })}>
                  <Play className="h-4 w-4 mr-1" />
                  Запустить
                </Button>
              )}
              {exp.status === "running" && (
                <Button variant="outline" size="sm" onClick={() => updateMut.mutate({ id: exp.id, status: "paused" })}>
                  <Pause className="h-4 w-4 mr-1" />
                  Приостановить
                </Button>
              )}
              {exp.status === "paused" && (
                <Button size="sm" onClick={() => updateMut.mutate({ id: exp.id, status: "running" })}>
                  <Play className="h-4 w-4 mr-1" />
                  Возобновить
                </Button>
              )}
              {(exp.status === "running" || exp.status === "paused") && (
                <Button variant="outline" size="sm" onClick={() => updateMut.mutate({ id: exp.id, status: "completed" })}>
                  <Check className="h-4 w-4 mr-1" />
                  Завершить
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Card>
              <CardContent className="p-3">
                <div className="text-muted-foreground text-xs">Целевая страница</div>
                <div className="font-mono font-medium mt-1">{exp.targetPage}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-muted-foreground text-xs">Событие конверсии</div>
                <div className="font-mono font-medium mt-1">{exp.goalEvent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-muted-foreground text-xs">Вариантов</div>
                <div className="font-medium mt-1">{exp.variants?.length ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-muted-foreground text-xs">Создан</div>
                <div className="font-medium mt-1">{new Date(exp.createdAt).toLocaleDateString("ru-RU")}</div>
              </CardContent>
            </Card>
          </div>

          {/* Variants */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Варианты</CardTitle>
                <CardDescription>Настройте варианты и их весовое распределение</CardDescription>
              </div>
              {exp.status === "draft" && (
                <AddVariantForm experimentId={exp.id} onAdd={(data) => addVariantMut.mutate(data)} isPending={addVariantMut.isPending} />
              )}
            </CardHeader>
            <CardContent>
              {exp.variants && exp.variants.length > 0 ? (
                <div className="space-y-3">
                  {exp.variants.map((v: { id: number; variantKey: string; label: string; weight: number; config: string | null }, idx: number) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: VARIANT_COLORS[idx % VARIANT_COLORS.length] }}
                        />
                        <div>
                          <div className="font-medium">{v.label}</div>
                          <div className="text-xs text-muted-foreground font-mono">{v.variantKey}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{v.weight}%</Badge>
                        {exp.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Удалить вариант?")) removeVariantMut.mutate({ id: v.id });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6">
                  Добавьте хотя бы 2 варианта для запуска эксперимента
                </p>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {exp.results && exp.results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Результаты
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={exp.results}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [
                        name === "conversionRate" ? `${value}%` : value,
                        name === "conversionRate" ? "Конверсия" : name === "totalAssigned" ? "Назначено" : "Конверсии",
                      ]}
                    />
                    <Bar dataKey="totalAssigned" name="Назначено" radius={[4, 4, 0, 0]}>
                      {exp.results.map((_: unknown, idx: number) => (
                        <Cell key={idx} fill={VARIANT_COLORS[idx % VARIANT_COLORS.length]} opacity={0.3} />
                      ))}
                    </Bar>
                    <Bar dataKey="conversions" name="Конверсии" radius={[4, 4, 0, 0]}>
                      {exp.results.map((_: unknown, idx: number) => (
                        <Cell key={idx} fill={VARIANT_COLORS[idx % VARIANT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Вариант</th>
                      <th className="py-2 font-medium text-right">Назначено</th>
                      <th className="py-2 font-medium text-right">Конверсии</th>
                      <th className="py-2 font-medium text-right">Конверсия %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exp.results.map((r: { variantId: number; label: string; totalAssigned: number; conversions: number; conversionRate: number }, idx: number) => (
                      <tr key={r.variantId} className="border-b last:border-0">
                        <td className="py-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: VARIANT_COLORS[idx % VARIANT_COLORS.length] }} />
                          {r.label}
                        </td>
                        <td className="py-2 text-right">{r.totalAssigned}</td>
                        <td className="py-2 text-right">{r.conversions}</td>
                        <td className="py-2 text-right font-semibold">{r.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Delete experiment */}
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Удалить эксперимент и все его данные?")) {
                  deleteMut.mutate({ id: exp.id });
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Удалить эксперимент
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ─── Experiments list view ─── */
  return (
    <DashboardLayout>
      <div className="container max-w-5xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FlaskConical className="h-6 w-6" />
              A/B Тестирование
            </h1>
            <p className="text-muted-foreground mt-1">
              Сравнивайте варианты страниц и отслеживайте конверсию
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Новый эксперимент
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Новый эксперимент</CardTitle>
              <CardDescription>Определите что тестировать и какое событие считать конверсией</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: CTA кнопка на главной" />
                </div>
                <div className="space-y-2">
                  <Label>Целевая страница</Label>
                  <Input value={targetPage} onChange={(e) => setTargetPage(e.target.value)} placeholder="/ или /animals/*" />
                </div>
                <div className="space-y-2">
                  <Label>Событие конверсии</Label>
                  <Select value={goalEvent} onValueChange={setGoalEvent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="share_purchase">Покупка доли</SelectItem>
                      <SelectItem value="registration">Регистрация</SelectItem>
                      <SelectItem value="club_join">Вступление в клуб</SelectItem>
                      <SelectItem value="product_order">Заказ продукции</SelectItem>
                      <SelectItem value="contact_form">Отправка формы</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Описание (необязательно)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Что именно тестируем и почему..."
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Отмена</Button>
                <Button onClick={handleCreate} disabled={!name || createMut.isPending}>
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Создать
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Experiments list */}
        {experimentsQ.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : experimentsQ.data && experimentsQ.data.length > 0 ? (
          <div className="space-y-3">
            {experimentsQ.data.map((exp: {
              id: number;
              name: string;
              description: string | null;
              status: string;
              targetPage: string;
              goalEvent: string;
              variantCount: number;
              createdAt: Date;
            }) => (
              <Card
                key={exp.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setSelectedId(exp.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{exp.name}</h3>
                        <Badge variant={STATUS_COLORS[exp.status] || "secondary"}>
                          {STATUS_LABELS[exp.status] || exp.status}
                        </Badge>
                      </div>
                      {exp.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{exp.description}</p>
                      )}
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Страница: <code>{exp.targetPage}</code></span>
                        <span>Цель: <code>{exp.goalEvent}</code></span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {exp.variantCount} вариантов
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Нет экспериментов</p>
              <p className="text-sm mt-1">Создайте первый A/B тест для оптимизации конверсии</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ── Add Variant inline form ── */

function AddVariantForm({
  experimentId,
  onAdd,
  isPending,
}: {
  experimentId: number;
  onAdd: (data: { experimentId: number; variantKey: string; label: string; weight: number }) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState("50");

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Добавить вариант
      </Button>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Ключ</Label>
        <Input className="h-8 w-28" value={key} onChange={(e) => setKey(e.target.value)} placeholder="variant_a" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Название</Label>
        <Input className="h-8 w-36" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Вариант A" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Вес (%)</Label>
        <Input className="h-8 w-16" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min={0} max={100} />
      </div>
      <Button
        size="sm"
        className="h-8"
        disabled={!key || !label || isPending}
        onClick={() => {
          onAdd({ experimentId, variantKey: key, label, weight: Number(weight) });
          setKey("");
          setLabel("");
          setWeight("50");
        }}
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpen(false)}>
        ✕
      </Button>
    </div>
  );
}
