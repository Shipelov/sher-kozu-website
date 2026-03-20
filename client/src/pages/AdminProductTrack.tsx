import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  FlaskConical,
  Loader2,
  MessageCircle,
  Milk,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";

/* ── Types ── */

type ProductType = "milk" | "smetana" | "yogurt" | "kefir" | "cheese";

type ProductOptionRecord = {
  id: number;
  animalId: number;
  productType: ProductType;
  label: string;
  conversionRatio: number;
  unit: string;
  maxAnnualUnits: number;
  isEnabled: number;
  sortOrder: number;
};

type OwnerPlanRecord = {
  id: number;
  ownerOpenId: string;
  animalId: number;
  ownershipId: number;
  status: string;
  selectionsJson: string;
  totalMilkUsed: number;
  adminNotes: string | null;
  confirmedAt: string | null;
  ownerName: string;
  familyName: string;
};

type DeliveryEntry = {
  id: number;
  ownerOpenId: string;
  animalId: number;
  month: number;
  year: number;
  itemsJson: string;
  status: "planned" | "ready" | "delivered";
  adminNote: string | null;
};

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  milk: "Молоко",
  smetana: "Сметана",
  yogurt: "Йогурт",
  kefir: "Кефир",
  cheese: "Сыр",
};

const PRODUCT_TYPE_ICONS: Record<ProductType, typeof Milk> = {
  milk: Milk,
  smetana: FlaskConical,
  yogurt: FlaskConical,
  kefir: FlaskConical,
  cheese: Package,
};

const MONTH_NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово",
  delivered: "Доставлено",
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  planned: "border-stone-200 bg-stone-50 text-stone-700",
  ready: "border-amber-200 bg-amber-50 text-amber-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

/* ── Helper: format milk usage bar ── */

function MilkUsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used} л использовано</span>
        <span>{total} л всего</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground text-right">{pct}% молочного бюджета</p>
    </div>
  );
}

/* ── Production Profile Editor ── */

function ProductionProfileEditor({ animalId, animalName }: { animalId: number; animalName: string }) {
  const utils = trpc.useUtils();
  const profileQuery = trpc.productTrack.getProfile.useQuery({ animalId });
  const upsertProfile = trpc.productTrack.upsertProfile.useMutation({
    onSuccess: () => {
      utils.productTrack.getProfile.invalidate({ animalId });
      utils.productTrack.getAnimalTrackData.invalidate({ animalId });
      toast.success("Производственный профиль сохранён");
    },
    onError: (err) => toast.error(err.message),
  });

  const [milkLiters, setMilkLiters] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setMilkLiters(String(profileQuery.data.annualMilkLiters));
      setNotes(profileQuery.data.notes ?? "");
    }
  }, [profileQuery.data]);

  const handleSave = () => {
    const liters = parseInt(milkLiters, 10);
    if (!liters || liters < 1) {
      toast.error("Укажите корректный годовой объём молока");
      return;
    }
    upsertProfile.mutate({ animalId, annualMilkLiters: liters, notes: notes || null });
  };

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Milk className="h-5 w-5 text-primary" />
          Производственный профиль — {animalName}
        </CardTitle>
        <CardDescription>
          Задайте годовой объём молока для этого животного. Этот бюджет определяет, сколько продуктов могут выбрать владельцы.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {profileQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем профиль…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Годовой объём молока (литров)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={milkLiters}
                  onChange={(e) => setMilkLiters(e.target.value)}
                  placeholder="Например: 800"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Заметки (необязательно)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Особенности лактации, сезонность и т.д."
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={upsertProfile.isPending} className="rounded-full">
              {upsertProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Сохранить профиль
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Product Options Manager ── */

function ProductOptionsManager({ animalId }: { animalId: number }) {
  const utils = trpc.useUtils();
  const optionsQuery = trpc.productTrack.listOptions.useQuery({ animalId });
  const profileQuery = trpc.productTrack.getProfile.useQuery({ animalId });
  const upsertOption = trpc.productTrack.upsertOption.useMutation({
    onSuccess: () => {
      utils.productTrack.listOptions.invalidate({ animalId });
      utils.productTrack.getAnimalTrackData.invalidate({ animalId });
      setEditingOption(null);
      toast.success("Продукт сохранён");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteOption = trpc.productTrack.deleteOption.useMutation({
    onSuccess: () => {
      utils.productTrack.listOptions.invalidate({ animalId });
      utils.productTrack.getAnimalTrackData.invalidate({ animalId });
      toast.success("Продукт удалён");
    },
    onError: (err) => toast.error(err.message),
  });

  const [editingOption, setEditingOption] = useState<Partial<ProductOptionRecord> | null>(null);

  const options = (optionsQuery.data ?? []) as ProductOptionRecord[];
  const annualMilk = profileQuery.data?.annualMilkLiters ?? 0;

  const totalMilkUsedByOptions = useMemo(
    () => options.reduce((sum, opt) => sum + opt.maxAnnualUnits * opt.conversionRatio, 0),
    [options],
  );

  const openNewOption = () => {
    setEditingOption({
      animalId,
      productType: "milk",
      label: "",
      conversionRatio: 1,
      unit: "л",
      maxAnnualUnits: 0,
      isEnabled: 1,
      sortOrder: options.length,
    });
  };

  const openEditOption = (opt: ProductOptionRecord) => {
    setEditingOption({ ...opt });
  };

  const handleSaveOption = () => {
    if (!editingOption) return;
    if (!editingOption.label?.trim()) {
      toast.error("Укажите название продукта");
      return;
    }
    if (!editingOption.conversionRatio || editingOption.conversionRatio < 1) {
      toast.error("Коэффициент конверсии должен быть >= 1");
      return;
    }
    upsertOption.mutate({
      id: editingOption.id,
      animalId,
      productType: editingOption.productType as ProductType,
      label: editingOption.label!,
      conversionRatio: editingOption.conversionRatio!,
      unit: editingOption.unit || "л",
      maxAnnualUnits: editingOption.maxAnnualUnits || 0,
      isEnabled: Boolean(editingOption.isEnabled),
      sortOrder: editingOption.sortOrder ?? 0,
    });
  };

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Доступные продукты
            </CardTitle>
            <CardDescription>
              Настройте, какие молочные продукты можно производить из молока этого животного.
            </CardDescription>
          </div>
          <Button onClick={openNewOption} className="rounded-full" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Добавить продукт
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {annualMilk > 0 && (
          <MilkUsageBar used={totalMilkUsedByOptions} total={annualMilk} />
        )}

        {optionsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем продукты…
          </div>
        ) : options.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            Продукты ещё не настроены. Нажмите «Добавить продукт», чтобы начать.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Продукт</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Конверсия</TableHead>
                  <TableHead>Лимит/год</TableHead>
                  <TableHead>Молока/год</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map((opt) => {
                  const Icon = PRODUCT_TYPE_ICONS[opt.productType] ?? Package;
                  const milkForOption = opt.maxAnnualUnits * opt.conversionRatio;
                  return (
                    <TableRow key={opt.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium">{opt.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {PRODUCT_TYPE_LABELS[opt.productType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {opt.conversionRatio} л → 1 {opt.unit}
                      </TableCell>
                      <TableCell className="text-sm">
                        {opt.maxAnnualUnits} {opt.unit}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {milkForOption} л
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full border ${opt.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                          {opt.isEnabled ? "Активен" : "Отключён"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => openEditOption(opt)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Изменить
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => deleteOption.mutate({ optionId: opt.id, animalId })}
                            disabled={deleteOption.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={Boolean(editingOption)} onOpenChange={(open) => !open && setEditingOption(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingOption?.id ? "Редактировать продукт" : "Новый продукт"}</DialogTitle>
              <DialogDescription>
                Укажите параметры продукта и коэффициент конверсии из молока.
              </DialogDescription>
            </DialogHeader>
            {editingOption && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Тип продукта</Label>
                  <Select
                    value={editingOption.productType}
                    onValueChange={(v) => setEditingOption({ ...editingOption, productType: v as ProductType, label: editingOption.label || PRODUCT_TYPE_LABELS[v as ProductType] })}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={editingOption.label ?? ""}
                    onChange={(e) => setEditingOption({ ...editingOption, label: e.target.value })}
                    placeholder="Например: Козий сыр мягкий"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Конверсия (л → 1 ед.)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingOption.conversionRatio ?? 1}
                      onChange={(e) => setEditingOption({ ...editingOption, conversionRatio: parseInt(e.target.value, 10) || 1 })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Единица</Label>
                    <Select
                      value={editingOption.unit ?? "л"}
                      onValueChange={(v) => setEditingOption({ ...editingOption, unit: v })}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="л">Литры (л)</SelectItem>
                        <SelectItem value="кг">Килограммы (кг)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Макс. в год</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingOption.maxAnnualUnits ?? 0}
                      onChange={(e) => setEditingOption({ ...editingOption, maxAnnualUnits: parseInt(e.target.value, 10) || 0 })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={Boolean(editingOption.isEnabled)}
                    onCheckedChange={(checked) => setEditingOption({ ...editingOption, isEnabled: checked ? 1 : 0 })}
                  />
                  <Label>Доступен для выбора владельцами</Label>
                </div>
                {annualMilk > 0 && editingOption.maxAnnualUnits && editingOption.conversionRatio ? (
                  <div className="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
                    Этот продукт потребует <strong>{(editingOption.maxAnnualUnits ?? 0) * (editingOption.conversionRatio ?? 1)} л</strong> молока в год
                    ({Math.round(((editingOption.maxAnnualUnits ?? 0) * (editingOption.conversionRatio ?? 1) / annualMilk) * 100)}% от бюджета).
                  </div>
                ) : null}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" className="rounded-full" onClick={() => setEditingOption(null)}>Отмена</Button>
                  <Button className="rounded-full" onClick={handleSaveOption} disabled={upsertOption.isPending}>
                    {upsertOption.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Сохранить
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ── Owner Plans Overview (Admin) ── */

function OwnerPlansOverview({ animalId }: { animalId: number }) {
  const trackData = trpc.productTrack.getAnimalTrackData.useQuery({ animalId });
  const ownerPlans = (trackData.data?.ownerPlans ?? []) as OwnerPlanRecord[];

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Продуктовые планы владельцев
        </CardTitle>
        <CardDescription>
          Все подтверждённые продуктовые планы владельцев для этого животного.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trackData.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем планы…
          </div>
        ) : ownerPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            Ни один владелец ещё не выбрал продуктовый план для этого животного.
          </div>
        ) : (
          <div className="space-y-4">
            {ownerPlans.map((plan) => {
              let selections: Array<{ label: string; annualUnits: number; unit: string; milkUsed: number }> = [];
              try {
                selections = JSON.parse(plan.selectionsJson);
              } catch {}

              return (
                <div key={plan.id} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{plan.ownerName}</p>
                      <p className="text-xs text-muted-foreground">Семья: {plan.familyName}</p>
                    </div>
                    <Badge className={`rounded-full border ${plan.status === "confirmed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : plan.status === "modified_by_admin" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                      {plan.status === "confirmed" ? "Подтверждён" : plan.status === "modified_by_admin" ? "Изменён админом" : "Черновик"}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selections.map((sel, idx) => (
                      <div key={idx} className="rounded-xl bg-secondary/30 p-3 text-sm">
                        <p className="font-medium">{sel.label}</p>
                        <p className="text-muted-foreground">{sel.annualUnits} {sel.unit}/год · {sel.milkUsed} л молока</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Итого: {plan.totalMilkUsed} л молока/год
                    {plan.adminNotes ? ` · Заметка: ${plan.adminNotes}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Delivery Schedule Overview (Admin) ── */

function DeliveryScheduleOverview({ animalId, ownerPlans }: { animalId: number; ownerPlans: OwnerPlanRecord[] }) {
  const utils = trpc.useUtils();
  const currentYear = new Date().getFullYear();

  // Get schedule for first owner plan (if any)
  const firstPlan = ownerPlans[0];
  const scheduleQuery = trpc.productTrack.getSchedule.useQuery(
    { ownerOpenId: firstPlan?.ownerOpenId ?? "", animalId, year: currentYear },
    { enabled: Boolean(firstPlan) },
  );

  const updateStatus = trpc.productTrack.updateDeliveryStatus.useMutation({
    onSuccess: () => {
      scheduleQuery.refetch();
      toast.success("Статус доставки обновлён");
    },
    onError: (err) => toast.error(err.message),
  });

  const schedule = (scheduleQuery.data ?? []) as DeliveryEntry[];

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          График доставки — {currentYear}
        </CardTitle>
        <CardDescription>
          Помесячный план доставки продукции. Обновляйте статусы по мере готовности.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!firstPlan ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            Нет подтверждённых планов — график доставки появится после выбора продуктов владельцем.
          </div>
        ) : scheduleQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем график…
          </div>
        ) : schedule.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            График доставки пуст. Он будет сгенерирован автоматически при подтверждении продуктового плана.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {schedule.map((entry) => {
              let items: Array<{ label: string; quantity: number; unit: string }> = [];
              try { items = JSON.parse(entry.itemsJson); } catch {}

              return (
                <div key={entry.id} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-foreground">{MONTH_NAMES[entry.month - 1]}</p>
                    <Badge className={`rounded-full border text-[10px] ${DELIVERY_STATUS_COLORS[entry.status]}`}>
                      {DELIVERY_STATUS_LABELS[entry.status]}
                    </Badge>
                  </div>
                  <div className="space-y-1 mb-3">
                    {items.map((item, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {item.label}: <span className="font-medium text-foreground">{item.quantity} {item.unit}</span>
                      </p>
                    ))}
                  </div>
                  <Select
                    value={entry.status}
                    onValueChange={(v) => updateStatus.mutate({ deliveryId: entry.id, status: v as any })}
                  >
                    <SelectTrigger className="h-8 rounded-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Запланировано</SelectItem>
                      <SelectItem value="ready">Готово</SelectItem>
                      <SelectItem value="delivered">Доставлено</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Chat Conversations Overview (Admin) ── */

function ChatConversationsOverview({ animalId }: { animalId: number }) {
  const conversationsQuery = trpc.productTrack.adminListConversations.useQuery();
  const conversations = (conversationsQuery.data ?? []).filter((c: any) => c.animalId === animalId);

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Чаты с владельцами
        </CardTitle>
        <CardDescription>
          Переписки по этому животному. Откройте чат для ответа.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {conversationsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем чаты…
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            Пока нет сообщений от владельцев по этому животному.
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv: any) => (
              <Link key={`${conv.animalId}-${conv.ownerOpenId}`} href={`/admin/product-track/${conv.animalSlug}/chat/${conv.ownerOpenId}`}>
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-white p-4 shadow-sm hover:bg-secondary/20 transition-colors cursor-pointer">
                  <div>
                    <p className="font-semibold text-foreground">{conv.ownerName}</p>
                    <p className="text-xs text-muted-foreground">{conv.totalMessages} сообщений</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {conv.unreadCount > 0 && (
                      <Badge className="rounded-full bg-rose-500 text-white border-rose-500">
                        {conv.unreadCount} новых
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main Page ── */

export default function AdminProductTrack() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ animalId: string }>();
  const animalId = parseInt(params.animalId ?? "0", 10);

  const animalsQuery = trpc.adminAnimals.list.useQuery(undefined, { retry: false });
  const animals = (animalsQuery.data ?? []) as Array<{ id: number; name: string; slug: string; species: string; coverImageUrl: string | null }>;
  const animal = animals.find((a) => a.id === animalId);

  const trackData = trpc.productTrack.getAnimalTrackData.useQuery({ animalId }, { enabled: animalId > 0 });
  const ownerPlans = (trackData.data?.ownerPlans ?? []) as OwnerPlanRecord[];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Card className="rounded-[2rem] border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загружаем…
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container max-w-4xl py-10">
          <Alert className="rounded-[2rem] border-amber-200 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Нужен вход в аккаунт</AlertTitle>
            <AlertDescription>
              <Button asChild className="mt-2 rounded-full">
                <a href={getLoginUrl("/admin")}>Войти</a>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // If no animalId, show animal selection
  if (!animalId || animalId <= 0) {
    return (
      <DashboardLayout>
        <div className="container py-10 space-y-6">
          <div className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/admin/animals">
                <Button variant="outline" size="sm" className="rounded-full">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Назад к каталогу
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Трек продукции</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Выберите животное для настройки производственного профиля и продуктовых опций.
            </p>
          </div>

          {animalsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загружаем каталог…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {animals.map((a) => (
                <Card
                  key={a.id}
                  className="rounded-[2rem] border-border/70 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/admin/product-track/${a.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-stone-100">
                        {a.coverImageUrl ? (
                          <img src={a.coverImageUrl} alt={a.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-400">
                            <Milk className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.species === "goat" ? "Коза" : "Овца"} · {a.slug}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-10 space-y-6">
        <div className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/admin/product-track">
              <Button variant="outline" size="sm" className="rounded-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Все животные
              </Button>
            </Link>
            <Link href="/admin/animals">
              <Button variant="outline" size="sm" className="rounded-full">
                Каталог животных
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {animal?.coverImageUrl && (
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-stone-100">
                <img src={animal.coverImageUrl} alt={animal.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Трек продукции — {animal?.name ?? `#${animalId}`}
              </h1>
              <p className="text-sm text-muted-foreground">
                Настройте молочный бюджет, доступные продукты, просматривайте планы владельцев и управляйте доставками.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="rounded-full bg-secondary/50 p-1">
            <TabsTrigger value="profile" className="rounded-full">
              <Milk className="mr-2 h-4 w-4" /> Профиль
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-full">
              <Package className="mr-2 h-4 w-4" /> Продукты
            </TabsTrigger>
            <TabsTrigger value="plans" className="rounded-full">
              <BarChart3 className="mr-2 h-4 w-4" /> Планы
            </TabsTrigger>
            <TabsTrigger value="delivery" className="rounded-full">
              <Truck className="mr-2 h-4 w-4" /> Доставка
            </TabsTrigger>
            <TabsTrigger value="chat" className="rounded-full">
              <MessageCircle className="mr-2 h-4 w-4" /> Чаты
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProductionProfileEditor animalId={animalId} animalName={animal?.name ?? ""} />
          </TabsContent>

          <TabsContent value="products">
            <ProductOptionsManager animalId={animalId} />
          </TabsContent>

          <TabsContent value="plans">
            <OwnerPlansOverview animalId={animalId} />
          </TabsContent>

          <TabsContent value="delivery">
            <DeliveryScheduleOverview animalId={animalId} ownerPlans={ownerPlans} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatConversationsOverview animalId={animalId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
