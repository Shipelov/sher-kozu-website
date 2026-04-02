import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
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
import ScrollRemaining from "@/components/ScrollRemaining";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crown,
  Droplets,
  FlaskConical,
  History,
  Layers,
  Loader2,
  MessageCircle,
  Milk,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import OwnerAdminChat from "@/components/OwnerAdminChat";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";

/* ── Types ── */

type ProductType = "milk" | "smetana" | "yogurt" | "kefir" | "cheese" | "brynza" | "kachotta" | "halumi" | "ricotta" | "camembert" | "aged_cheese" | "blue_cheese" | "smoked_cheese" | "butter" | "condensed_milk" | "fermented_drink" | "custom";

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
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerPreferredContact: string | null;
  familyName: string;
  sharePercent: number;
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

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  milk: "Молоко",
  smetana: "Сметана",
  yogurt: "Йогурт",
  kefir: "Кефир",
  cheese: "Сыр",
  brynza: "Брынза",
  kachotta: "Качотта",
  halumi: "Халуми",
  ricotta: "Рикотта",
  camembert: "Камамбер",
  aged_cheese: "Выдержанный сыр",
  blue_cheese: "Голубой сыр",
  smoked_cheese: "Копчёный сыр",
  butter: "Масло",
  condensed_milk: "Сгущёнка",
  fermented_drink: "Ферментированный напиток",
  custom: "Другое",
};

const PRODUCT_TYPE_ICONS: Record<string, typeof Milk> = {
  milk: Milk,
  smetana: FlaskConical,
  yogurt: FlaskConical,
  kefir: FlaskConical,
  cheese: Package,
  brynza: Package,
  kachotta: Package,
  halumi: Package,
  ricotta: Package,
  camembert: Package,
  aged_cheese: Package,
  blue_cheese: Package,
  smoked_cheese: Package,
  butter: Package,
  condensed_milk: FlaskConical,
  fermented_drink: FlaskConical,
  custom: Package,
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
        <CardDescription>Годовой объём молока и бюджет продуктов</CardDescription>
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

function ProductOptionsManager({ animalId, animalSpecies, ownerPlans, activeOwnerOpenIds }: { animalId: number; animalSpecies: "goat" | "sheep"; ownerPlans: OwnerPlanRecord[]; activeOwnerOpenIds: string[] }) {
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

  const populateFromCatalog = trpc.productTrack.populateProductsFromCatalog.useMutation({
    onSuccess: (data) => {
      utils.productTrack.listOptions.invalidate({ animalId });
      utils.productTrack.getAnimalTrackData.invalidate({ animalId });
      toast.success(`Подтянуто ${data.created} продуктов из каталога (тариф: ${TIER_LABELS[data.tierSlug] ?? data.tierSlug})`);
    },
    onError: (err) => toast.error(err.message),
  });
  const batchVerify = trpc.productTrack.batchVerifyProducts.useMutation({
    onSuccess: (data) => {
      utils.productTrack.listOptions.invalidate({ animalId });
      utils.productTrack.getAnimalTrackData.invalidate({ animalId });
      setSelectedIds(new Set());
      toast.success(`Верифицировано: ${data.verified} продуктов`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [editingOption, setEditingOption] = useState<Partial<ProductOptionRecord> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Find first owner for this animal to get tier (from plans or active ownerships)
  const firstOwnerOpenId = ownerPlans[0]?.ownerOpenId ?? activeOwnerOpenIds[0] ?? null;

  const options = (optionsQuery.data ?? []) as (ProductOptionRecord & { isAdminVerified?: number; adminVerifiedAt?: string | null; catalogItemId?: number | null })[];
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

  // Calculate milk used by OTHER options (excluding the one being edited)
  const milkUsedByOtherOptions = useMemo(() => {
    return options
      .filter((o) => o.id !== editingOption?.id)
      .reduce((sum, o) => sum + o.maxAnnualUnits * o.conversionRatio, 0);
  }, [options, editingOption?.id]);

  // Milk this option would use
  const editingOptionMilk = (editingOption?.maxAnnualUnits ?? 0) * (editingOption?.conversionRatio ?? 1);
  const projectedTotalMilk = milkUsedByOtherOptions + editingOptionMilk;
  const isOverBudget = annualMilk > 0 && projectedTotalMilk > annualMilk;

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
    if (isOverBudget) {
      toast.error(`Превышен молочный бюджет: ${projectedTotalMilk} л из ${annualMilk} л`);
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Продукты животного
            </CardTitle>
            <CardDescription>
              Продукты подтягиваются из тарифного каталога по виду животного ({animalSpecies === "goat" ? "козье" : "овечье"}) и тарифу владельца. После подтягивания верифицируйте продукты.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {firstOwnerOpenId && (
              <Button
                onClick={() => populateFromCatalog.mutate({ animalId, ownerOpenId: firstOwnerOpenId, animalSpecies })}
                className="rounded-full"
                size="sm"
                variant="outline"
                disabled={populateFromCatalog.isPending}
              >
                {populateFromCatalog.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Подтянуть из каталога
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button
                onClick={() => batchVerify.mutate({ optionIds: Array.from(selectedIds) })}
                className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                size="sm"
                variant="outline"
                disabled={batchVerify.isPending}
              >
                {batchVerify.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Верифицировать ({selectedIds.size})
              </Button>
            )}
            {options.filter(o => !o.isAdminVerified).length > 0 && (
              <Button
                onClick={() => {
                  const unverifiedIds = options.filter(o => !o.isAdminVerified).map(o => o.id);
                  batchVerify.mutate({ optionIds: unverifiedIds });
                }}
                className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                size="sm"
                variant="outline"
                disabled={batchVerify.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Верифицировать все
              </Button>
            )}
            <Button onClick={openNewOption} className="rounded-full" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Добавить вручную
            </Button>
          </div>
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
          <div className="overflow-x-auto rounded-[1.75rem] border border-border/70 bg-white shadow-sm">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={options.length > 0 && selectedIds.size === options.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(options.map(o => o.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Продукт</TableHead>
                  <TableHead className="whitespace-nowrap">Тип</TableHead>
                  <TableHead className="whitespace-nowrap">Конверсия</TableHead>
                  <TableHead className="whitespace-nowrap">Лимит/год</TableHead>
                  <TableHead className="whitespace-nowrap">Молока/год</TableHead>
                  <TableHead className="whitespace-nowrap">Статус</TableHead>
                  <TableHead className="whitespace-nowrap">Верификация</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map((opt) => {
                  const Icon = PRODUCT_TYPE_ICONS[opt.productType] ?? Package;
                  const milkForOption = opt.maxAnnualUnits * opt.conversionRatio;
                  const isVerified = Boolean(opt.isAdminVerified);
                  const isSelected = selectedIds.has(opt.id);
                  return (
                    <TableRow key={opt.id} className={isSelected ? "bg-blue-50/50" : ""}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(opt.id);
                            else next.delete(opt.id);
                            setSelectedIds(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium">{opt.label}</span>
                          {opt.catalogItemId && (
                            <Badge variant="outline" className="rounded-full text-xs border-blue-200 bg-blue-50 text-blue-600">
                              каталог
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {PRODUCT_TYPE_LABELS[opt.productType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {opt.conversionRatio} л → 1 {opt.unit}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {opt.maxAnnualUnits} {opt.unit}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {milkForOption} л
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full border ${opt.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                          {opt.isEnabled ? "Активен" : "Отключён"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isVerified ? (
                          <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Верифицирован
                          </Badge>
                        ) : (
                          <Badge className="rounded-full border border-orange-200 bg-orange-50 text-orange-700">
                            <Clock className="mr-1 h-3 w-3" /> Ожидает
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
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
                {annualMilk > 0 && (
                  <div className={`rounded-xl p-3 text-sm ${isOverBudget ? "bg-red-50 border border-red-200" : "bg-secondary/40"}`}>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Другие продукты</span>
                      <span>{milkUsedByOtherOptions} л</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Этот продукт</span>
                      <span className="font-medium">{editingOptionMilk} л</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden my-2">
                      <div
                        className={`h-full rounded-full transition-all ${isOverBudget ? "bg-red-500" : "bg-primary"}`}
                        style={{ width: `${Math.min((projectedTotalMilk / annualMilk) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className={`font-semibold ${isOverBudget ? "text-red-600" : ""}`}>
                        Итого: {projectedTotalMilk} л
                      </span>
                      <span className="text-muted-foreground">из {annualMilk} л/год</span>
                    </div>
                    {isOverBudget && (
                      <p className="text-xs text-red-600 font-medium mt-1">
                        ⚠ Превышение на {projectedTotalMilk - annualMilk} л. Уменьшите лимит или конверсию.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" className="rounded-full" onClick={() => setEditingOption(null)}>Отмена</Button>
                  <Button className="rounded-full" onClick={handleSaveOption} disabled={upsertOption.isPending || isOverBudget}>
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

type SelectionEntry = {
  productOptionId?: number;
  catalogItemId?: number;
  productType?: string;
  label: string;
  annualUnits: number;
  unit: string;
  milkUsed: number;
};

type TierCatalogItem = {
  id: number;
  productType: string;
  label: string;
  conversionRatio: number;
  unit: string;
  maxAnnualUnits: number;
  minTier: string;
  species: string;
  isEnabled: number;
  sortOrder: number;
};

const TIER_LABELS: Record<string, string> = {
  basic: "Базовый",
  standard: "Стандартный",
  professional: "Профессиональный",
};

const TIER_COLORS: Record<string, string> = {
  basic: "border-stone-200 bg-stone-50 text-stone-700",
  standard: "border-blue-200 bg-blue-50 text-blue-700",
  professional: "border-amber-200 bg-amber-50 text-amber-700",
};

const TIER_ICONS: Record<string, typeof Crown> = {
  basic: ShieldCheck,
  standard: Sparkles,
  professional: Crown,
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  pending_admin_setup: "Ожидает настройки",
  pending_owner_config: "Ожидает владельца",
  pending_approval: "Ожидает подтверждения",
  confirmed: "Подтверждён",
};

const PLAN_STATUS_COLORS: Record<string, string> = {
  pending_admin_setup: "border-orange-200 bg-orange-50 text-orange-700",
  pending_owner_config: "border-blue-200 bg-blue-50 text-blue-700",
  pending_approval: "border-violet-200 bg-violet-50 text-violet-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function OwnerPlansOverview({ animalId }: { animalId: number }) {
  const trackData = trpc.productTrack.getAnimalTrackData.useQuery({ animalId });
  const ownerPlans = (trackData.data?.ownerPlans ?? []) as OwnerPlanRecord[];
  const productOptions = (trackData.data?.options ?? []) as ProductOptionRecord[];
  const profile = trackData.data?.profile;

  const [editingPlan, setEditingPlan] = useState<OwnerPlanRecord | null>(null);
  const [editSelections, setEditSelections] = useState<Map<number, number>>(new Map());
  const [adminNotes, setAdminNotes] = useState("");

  const adminUpdatePlan = trpc.productTrack.adminVerifyPlan.useMutation({
    onSuccess: () => {
      toast.success("План обновлён");
      setEditingPlan(null);
      trackData.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const adminResetPlan = trpc.productTrack.adminResetPlan.useMutation({
    onSuccess: () => {
      toast.success("План сброшен — владелец может выбрать заново");
      trackData.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const adminApprovePlan = trpc.productTrack.adminApprovePlan.useMutation({
    onSuccess: () => {
      toast.success("План подтверждён — график доставки сформирован");
      trackData.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const openEditDialog = useCallback((plan: OwnerPlanRecord) => {
    let selections: SelectionEntry[] = [];
    try { selections = JSON.parse(plan.selectionsJson); } catch {}
    const map = new Map<number, number>();
    for (const sel of selections) {
      if (sel.productOptionId) map.set(sel.productOptionId, sel.annualUnits);
    }
    // Also add any product options not yet in the plan
    for (const opt of productOptions) {
      if (!map.has(opt.id)) map.set(opt.id, 0);
    }
    setEditSelections(map);
    setAdminNotes(plan.adminNotes ?? "");
    setEditingPlan(plan);
  }, [productOptions]);

  const editTotalMilk = useMemo(() => {
    let total = 0;
    editSelections.forEach((units, optId) => {
      const opt = productOptions.find((o) => o.id === optId);
      if (opt) total += units * opt.conversionRatio;
    });
    return total;
  }, [editSelections, productOptions]);

  const handleSaveEdit = () => {
    if (!editingPlan) return;
    const selections = Array.from(editSelections.entries())
      .filter(([, units]) => units > 0)
      .map(([optId, units]) => ({ catalogItemId: optId, annualUnits: units }));
    if (selections.length === 0) {
      toast.error("Выберите хотя бы один продукт.");
      return;
    }
    adminUpdatePlan.mutate({
      planId: editingPlan.id,
      selections,
      adminNotes: adminNotes || null,
    });
  };

  return (
    <>
      <Card className="rounded-[2rem] border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Продуктовые планы владельцев
          </CardTitle>

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
            <ScrollRemaining totalItems={ownerPlans.length} itemHeight={120} className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
              {ownerPlans.map((plan) => {
                let selections: SelectionEntry[] = [];
                try { selections = JSON.parse(plan.selectionsJson); } catch {}

                return (
                  <div key={plan.id} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{plan.ownerName}</p>
                        <p className="text-xs text-muted-foreground">Семья: {plan.familyName} · Доля: {plan.sharePercent}%</p>
                        {(plan.ownerEmail || plan.ownerPhone) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {plan.ownerEmail && <span>{plan.ownerEmail}</span>}
                            {plan.ownerEmail && plan.ownerPhone && <span> · </span>}
                            {plan.ownerPhone && <span>{plan.ownerPhone}</span>}
                          </p>
                        )}
                        {plan.ownerPreferredContact && (
                          <p className="text-[10px] text-primary/80 mt-0.5">
                            Предпочитает: {plan.ownerPreferredContact === "email" ? "Email" : plan.ownerPreferredContact === "phone" ? "Телефон" : "Мессенджер"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(plan as any).tierSlug && (() => {
                          const TierIcon = TIER_ICONS[(plan as any).tierSlug] ?? ShieldCheck;
                          return (
                            <Badge className={`rounded-full border ${TIER_COLORS[(plan as any).tierSlug] ?? TIER_COLORS.basic}`}>
                              <TierIcon className="mr-1 h-3 w-3" />
                              {TIER_LABELS[(plan as any).tierSlug] ?? (plan as any).tierSlug}
                            </Badge>
                          );
                        })()}
                        <Badge className={`rounded-full border ${PLAN_STATUS_COLORS[plan.status] ?? "border-stone-200 bg-stone-50 text-stone-500"}`}>
                          {PLAN_STATUS_LABELS[plan.status] ?? plan.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {selections.map((sel, idx) => (
                        <div key={idx} className="rounded-xl bg-secondary/30 p-3 text-sm">
                          <p className="font-medium">{sel.label}</p>
                          <p className="text-muted-foreground">{sel.annualUnits} {sel.unit}/год · {sel.milkUsed} л молока</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Итого: {plan.totalMilkUsed} л молока/год
                        {plan.adminNotes ? ` · Заметка: ${plan.adminNotes}` : ""}
                      </p>
                      <div className="flex gap-2">
                        {plan.status === "pending_approval" && (
                          <Button
                            size="sm"
                            className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              if (confirm(`Подтвердить план ${plan.ownerName}? Будет сформирован график доставки.`)) {
                                adminApprovePlan.mutate({ planId: plan.id });
                              }
                            }}
                            disabled={adminApprovePlan.isPending}
                          >
                            {adminApprovePlan.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                            Подтвердить
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Pencil className="mr-1 h-3 w-3" /> Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            if (confirm(`Сбросить план ${plan.ownerName}? Владелец сможет выбрать заново.`)) {
                              adminResetPlan.mutate({ planId: plan.id });
                            }
                          }}
                          disabled={adminResetPlan.isPending}
                        >
                          {adminResetPlan.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                          Сбросить
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </ScrollRemaining>
          )}
        </CardContent>
      </Card>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => { if (!open) setEditingPlan(null); }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Редактирование плана — {editingPlan?.ownerName}
            </DialogTitle>
            <DialogDescription>
              Измените количества продуктов. После сохранения график доставки будет пересоздан автоматически.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Milk budget indicator — limited by owner's share */}
            {profile && editingPlan && (() => {
              const ownerMilkBudget = Math.floor((profile.annualMilkLiters * editingPlan.sharePercent) / 100);
              const overBudget = editTotalMilk > ownerMilkBudget;
              return (
                <div className={`rounded-xl p-3 ${overBudget ? "bg-red-50 border border-red-200" : "bg-secondary/30"}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Использовано молока</span>
                    <span className={`font-semibold ${overBudget ? "text-red-600" : ""}`}>{editTotalMilk} л</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${Math.min((editTotalMilk / ownerMilkBudget) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    из {ownerMilkBudget} л (доля {editingPlan.sharePercent}% от {profile.annualMilkLiters} л/год)
                  </p>
                  {overBudget && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      ⚠ Превышен молочный бюджет владельца на {editTotalMilk - ownerMilkBudget} л
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Product sliders */}
            {productOptions.filter((o) => o.isEnabled).map((opt) => {
              const currentUnits = editSelections.get(opt.id) ?? 0;
              const milkForThis = currentUnits * opt.conversionRatio;
              return (
                <div key={opt.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.conversionRatio} л молока → 1 {opt.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{currentUnits} {opt.unit}/год</p>
                      <p className="text-xs text-muted-foreground">{milkForThis} л молока</p>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={opt.maxAnnualUnits}
                    step={1}
                    value={currentUnits}
                    onChange={(e) => {
                      const newMap = new Map(editSelections);
                      newMap.set(opt.id, Number(e.target.value));
                      setEditSelections(newMap);
                    }}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>макс. {opt.maxAnnualUnits} {opt.unit}</span>
                  </div>
                </div>
              );
            })}

            {/* Admin notes */}
            <div>
              <Label className="text-sm">Заметка администратора</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Причина изменения плана…"
                className="mt-1 rounded-xl"
                rows={2}
              />
            </div>

            {/* Save button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-full" onClick={() => setEditingPlan(null)}>
                Отмена
              </Button>
              <Button
                className="rounded-full"
                onClick={handleSaveEdit}
                disabled={adminUpdatePlan.isPending || (profile && editingPlan ? editTotalMilk > Math.floor((profile.annualMilkLiters * editingPlan.sharePercent) / 100) : false)}
              >
                {adminUpdatePlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Сохранить изменения
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
          <ScrollRemaining totalItems={schedule.length} itemHeight={160} className="max-h-[520px] overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {schedule.map((entry) => {
              let items: Array<{ label: string; quantity: number; unit: string; frequency?: string }> = [];
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
                        {item.frequency === "quarterly" && <span className="text-[10px] text-amber-600 ml-1">(кварт.)</span>}
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
          </ScrollRemaining>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Chat Conversations Overview (Admin) ── */

function ChatConversationsOverview({ animalId, animalName }: { animalId: number; animalName: string }) {
  const conversationsQuery = trpc.productTrack.adminListConversations.useQuery();
  const conversations = (conversationsQuery.data ?? []).filter((c: any) => c.animalId === animalId);
  const [selectedOwner, setSelectedOwner] = useState<{ openId: string; name: string } | null>(null);
  const utils = trpc.useUtils();
  const clearChat = trpc.productTrack.adminClearChat.useMutation({
    onSuccess: (data) => {
      toast.success(`Удалено ${data.deleted} сообщений`);
      utils.productTrack.adminListConversations.invalidate();
      utils.productTrack.listMessages.invalidate();
    },
    onError: () => toast.error("Не удалось очистить чат"),
  });
  const [confirmClear, setConfirmClear] = useState(false);

  // If a conversation is selected, show the chat inline
  if (selectedOwner) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setSelectedOwner(null)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Назад к списку чатов
        </Button>
        <Card className="rounded-[2rem] border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-primary" />
              Чат с {selectedOwner.name}
            </CardTitle>
            <CardDescription>По животному: {animalName}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <OwnerAdminChat
              animalId={animalId}
              ownerOpenId={selectedOwner.openId}
              animalName={animalName}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Чаты с владельцами
          </CardTitle>
          {conversations.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Удалить все сообщения?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full text-xs h-7"
                  onClick={() => { clearChat.mutate({ animalId }); setConfirmClear(false); }}
                  disabled={clearChat.isPending}
                >
                  {clearChat.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Да, очистить"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-7"
                  onClick={() => setConfirmClear(false)}
                >
                  Отмена
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs gap-1 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="h-3 w-3" /> Очистить чат
              </Button>
            )
          )}
        </div>

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
          <ScrollRemaining totalItems={conversations.length} itemHeight={72} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {conversations.map((conv: any) => (
              <button
                key={`${conv.animalId}-${conv.ownerOpenId}`}
                type="button"
                onClick={() => setSelectedOwner({ openId: conv.ownerOpenId, name: conv.ownerName })}
                className="w-full text-left"
              >
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
              </button>
            ))}
          </ScrollRemaining>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Tier Catalog Manager (Admin) ── */

const ALL_PRODUCT_TYPES = [
  "milk", "smetana", "yogurt", "kefir", "cheese",
  "brynza", "kachotta", "halumi", "ricotta", "camembert",
  "aged_cheese", "blue_cheese", "smoked_cheese",
  "butter", "condensed_milk", "fermented_drink", "custom",
];

const ALL_TIERS = ["basic", "standard", "professional"];
const ALL_SPECIES = ["goat", "sheep", "both"];
const SPECIES_LABELS: Record<string, string> = { goat: "Козы", sheep: "Овцы", both: "Все" };

function TierCatalogManager() {
  const utils = trpc.useUtils();
  const catalogQuery = trpc.productTrack.listAllTierCatalog.useQuery();
  const upsertItem = trpc.productTrack.upsertTierCatalogItem.useMutation({
    onSuccess: () => {
      utils.productTrack.listAllTierCatalog.invalidate();
      setEditing(null);
      toast.success("Продукт сохранён в каталог");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteItem = trpc.productTrack.deleteTierCatalogItem.useMutation({
    onSuccess: () => {
      utils.productTrack.listAllTierCatalog.invalidate();
      toast.success("Продукт удалён из каталога");
    },
    onError: (err) => toast.error(err.message),
  });

  const [editing, setEditing] = useState<Partial<TierCatalogItem> | null>(null);
  const [filterTier, setFilterTier] = useState<string>("all");

  const catalog = (catalogQuery.data ?? []) as TierCatalogItem[];

  const filteredCatalog = useMemo(() => {
    if (filterTier === "all") return catalog;
    return catalog.filter(c => c.minTier === filterTier);
  }, [catalog, filterTier]);

  const openNew = () => {
    setEditing({
      productType: "milk",
      label: "",
      conversionRatio: 1,
      unit: "л",
      maxAnnualUnits: 100,
      minTier: "basic",
      species: "both",
      isEnabled: 1,
      sortOrder: catalog.length,
    });
  };

  const openEdit = (item: TierCatalogItem) => {
    setEditing({ ...item });
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.label?.trim()) {
      toast.error("Укажите название продукта");
      return;
    }
    upsertItem.mutate({
      id: editing.id,
      productType: editing.productType as any,
      label: editing.label!.trim(),
      conversionRatio: editing.conversionRatio ?? 1,
      unit: editing.unit ?? "л",
      minTier: editing.minTier as any ?? "basic",
      species: editing.species as any ?? "both",
      isEnabled: Boolean(editing.isEnabled),
      sortOrder: editing.sortOrder ?? 0,
    });
  };

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Тарифный каталог продуктов
            </CardTitle>
            <CardDescription>
              Глобальный каталог продуктов по тарифам. Владельцы видят только продукты своего тарифа и ниже.
            </CardDescription>
          </div>
          <Button onClick={openNew} size="sm" className="rounded-full">
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterTier === "all" ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs"
            onClick={() => setFilterTier("all")}
          >
            Все ({catalog.length})
          </Button>
          {ALL_TIERS.map(t => {
            const count = catalog.filter(c => c.minTier === t).length;
            const TierIcon = TIER_ICONS[t] ?? ShieldCheck;
            return (
              <Button
                key={t}
                variant={filterTier === t ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs"
                onClick={() => setFilterTier(t)}
              >
                <TierIcon className="mr-1 h-3 w-3" />
                {TIER_LABELS[t]} ({count})
              </Button>
            );
          })}
        </div>

        {catalogQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем каталог…
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            Каталог пуст. Добавьте продукты для каждого тарифного уровня.
          </div>
        ) : (
          <ScrollRemaining totalItems={filteredCatalog.length} itemHeight={72} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredCatalog.map((item) => {
              const Icon = PRODUCT_TYPE_ICONS[item.productType] ?? Package;
              const TierIcon = TIER_ICONS[item.minTier] ?? ShieldCheck;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-2xl border p-4 transition-shadow hover:shadow-sm ${
                    item.isEnabled ? "border-border/60 bg-white/80" : "border-border/40 bg-stone-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <Badge className={`rounded-full border text-[10px] ${TIER_COLORS[item.minTier] ?? TIER_COLORS.basic}`}>
                          <TierIcon className="mr-0.5 h-2.5 w-2.5" />
                          {TIER_LABELS[item.minTier] ?? item.minTier}+
                        </Badge>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {SPECIES_LABELS[item.species] ?? item.species}
                        </Badge>
                        {!item.isEnabled && (
                          <Badge className="rounded-full border-stone-200 bg-stone-100 text-stone-500 text-[10px]">
                            Отключен
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.conversionRatio} л молока → 1 {item.unit} · макс. {item.maxAnnualUnits} {item.unit}/год
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Удалить «${item.label}» из каталога?`)) {
                          deleteItem.mutate({ id: item.id });
                        }
                      }}
                      disabled={deleteItem.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </ScrollRemaining>
        )}

        {/* Edit / Create Dialog */}
        <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Редактировать продукт" : "Новый продукт в каталоге"}</DialogTitle>
              <DialogDescription>
                Продукт будет доступен владельцам с указанным тарифом и выше.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={editing?.label ?? ""}
                    onChange={(e) => setEditing(prev => prev ? { ...prev, label: e.target.value } : prev)}
                    placeholder="Молоко цельное"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тип продукта</Label>
                  <Select
                    value={editing?.productType ?? "milk"}
                    onValueChange={(v) => setEditing(prev => prev ? { ...prev, productType: v } : prev)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_PRODUCT_TYPES.map(pt => (
                        <SelectItem key={pt} value={pt}>{PRODUCT_TYPE_LABELS[pt] ?? pt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Конверсия (л молока → 1 ед.)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={editing?.conversionRatio ?? 1}
                    onChange={(e) => setEditing(prev => prev ? { ...prev, conversionRatio: Number(e.target.value) } : prev)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Единица</Label>
                  <Input
                    value={editing?.unit ?? "л"}
                    onChange={(e) => setEditing(prev => prev ? { ...prev, unit: e.target.value } : prev)}
                    placeholder="л, кг, шт"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Макс. ед./год</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100000}
                    value={editing?.maxAnnualUnits ?? 100}
                    onChange={(e) => setEditing(prev => prev ? { ...prev, maxAnnualUnits: Number(e.target.value) } : prev)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Минимальный тариф</Label>
                  <Select
                    value={editing?.minTier ?? "basic"}
                    onValueChange={(v) => setEditing(prev => prev ? { ...prev, minTier: v } : prev)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_TIERS.map(t => (
                        <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Вид животного</Label>
                  <Select
                    value={editing?.species ?? "both"}
                    onValueChange={(v) => setEditing(prev => prev ? { ...prev, species: v } : prev)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_SPECIES.map(s => (
                        <SelectItem key={s} value={s}>{SPECIES_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Порядок</Label>
                  <Input
                    type="number"
                    min={0}
                    max={9999}
                    value={editing?.sortOrder ?? 0}
                    onChange={(e) => setEditing(prev => prev ? { ...prev, sortOrder: Number(e.target.value) } : prev)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={Boolean(editing?.isEnabled)}
                  onCheckedChange={(v) => setEditing(prev => prev ? { ...prev, isEnabled: v ? 1 : 0 } : prev)}
                />
                <Label>Активен</Label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>
                  Отмена
                </Button>
                <Button className="rounded-full" onClick={handleSave} disabled={upsertItem.isPending}>
                  {upsertItem.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {editing?.id ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
  const activeOwnerOpenIds = (trackData.data?.activeOwnerOpenIds ?? []) as string[];

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
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Admin", href: "/admin" },
              { label: "Трек продукции" },
            ]}
          />
          <div className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Трек продукции</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Выберите животное для настройки производственного профиля и продуктовых опций.
            </p>
          </div>

          <Tabs defaultValue="animals" className="space-y-6">
            <TabsList className="rounded-full bg-secondary/50 p-1">
              <TabsTrigger value="animals" className="rounded-full">
                <Milk className="mr-2 h-4 w-4" /> Животные
              </TabsTrigger>
              <TabsTrigger value="tier-catalog" className="rounded-full">
                <Layers className="mr-2 h-4 w-4" /> Тарифный каталог
              </TabsTrigger>
            </TabsList>

            <TabsContent value="animals">
          {animalsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загружаем каталог…
            </div>
          ) : (
            <ScrollRemaining totalItems={animals.length} itemHeight={80} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto pr-1">
              {animals.map((a) => (
                <Card
                  key={a.id}
                  className="rounded-[2rem] border-border/70 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/admin/product-track/${a.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-stone-100">
                        {a.coverImageUrl && a.coverImageUrl !== "NULL" ? (
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
            </ScrollRemaining>
          )}
            </TabsContent>

            <TabsContent value="tier-catalog">
              <TierCatalogManager />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-10 space-y-6">
        <PageBreadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Admin", href: "/admin" },
            { label: "Трек продукции", href: "/admin/product-track" },
            { label: animal?.name ?? `#${animalId}` },
          ]}
        />
        <div className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {animal?.coverImageUrl && animal.coverImageUrl !== "NULL" && (
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
          <TabsList className="rounded-full bg-secondary/50 p-1 flex-wrap">
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
            <TabsTrigger value="composition" className="rounded-full">
              <FlaskConical className="mr-2 h-4 w-4" /> Состав
            </TabsTrigger>
            <TabsTrigger value="seasonal" className="rounded-full">
              <Droplets className="mr-2 h-4 w-4" /> Ритм
            </TabsTrigger>
            <TabsTrigger value="log" className="rounded-full">
              <History className="mr-2 h-4 w-4" /> Лог
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProductionProfileEditor animalId={animalId} animalName={animal?.name ?? ""} />
          </TabsContent>

          <TabsContent value="products">
            <ProductOptionsManager animalId={animalId} animalSpecies={(animal?.species as "goat" | "sheep") ?? "goat"} ownerPlans={ownerPlans} activeOwnerOpenIds={activeOwnerOpenIds} />
          </TabsContent>

          <TabsContent value="plans">
            <OwnerPlansOverview animalId={animalId} />
          </TabsContent>

          <TabsContent value="delivery">
            <DeliveryScheduleOverview animalId={animalId} ownerPlans={ownerPlans} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatConversationsOverview animalId={animalId} animalName={animal?.name ?? ""} />
          </TabsContent>

          <TabsContent value="composition">
            <CompositionSnapshotsManager animalId={animalId} />
          </TabsContent>

          <TabsContent value="seasonal">
            <MonthlyMetricsManager animalId={animalId} />
          </TabsContent>

          <TabsContent value="log">
            <PlanChangeLogView animalId={animalId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ── Plan Change Log ── */

type LogEntry = {
  id: number;
  planId: number;
  action: string;
  actorType: string;
  actorId: string;
  actorName: string | null;
  previousSelectionsJson: string | null;
  newSelectionsJson: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  note: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  owner_submitted: "Владелец отправил план",
  admin_approved: "Админ подтвердил",
  admin_modified: "Админ изменил",
  admin_reset: "Админ сбросил",
};

const ACTION_COLORS: Record<string, string> = {
  owner_submitted: "border-blue-200 bg-blue-50 text-blue-700",
  admin_approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  admin_modified: "border-amber-200 bg-amber-50 text-amber-700",
  admin_reset: "border-rose-200 bg-rose-50 text-rose-700",
};

function PlanChangeLogView({ animalId }: { animalId: number }) {
  const logQuery = trpc.productTrack.getPlanChangeLog.useQuery({ animalId });
  const logs = (logQuery.data ?? []) as LogEntry[];
  const utils = trpc.useUtils();
  const clearLog = trpc.productTrack.adminClearLog.useMutation({
    onSuccess: (data) => {
      toast.success(`Удалено ${data.deleted} записей лога`);
      utils.productTrack.getPlanChangeLog.invalidate();
      utils.productTrack.getAllPlanChangeLogs.invalidate();
    },
    onError: () => toast.error("Не удалось очистить лог"),
  });
  const [confirmClearLog, setConfirmClearLog] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const renderSelections = (json: string | null) => {
    if (!json) return null;
    try {
      const sels = JSON.parse(json) as Array<{ label?: string; annualUnits?: number; unit?: string; milkUsed?: number }>;
      if (sels.length === 0) return <span className="text-muted-foreground italic">Пустой план</span>;
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {sels.map((s, i) => (
            <span key={i} className="inline-flex items-center rounded-full bg-secondary/50 px-2 py-0.5 text-xs">
              {s.label}: {s.annualUnits} {s.unit}
            </span>
          ))}
        </div>
      );
    } catch {
      return null;
    }
  };

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Лог изменений планов
          </CardTitle>
          {logs.length > 0 && (
            confirmClearLog ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Удалить всю историю?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full text-xs h-7"
                  onClick={() => { clearLog.mutate({ animalId }); setConfirmClearLog(false); }}
                  disabled={clearLog.isPending}
                >
                  {clearLog.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Да, очистить"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-7"
                  onClick={() => setConfirmClearLog(false)}
                >
                  Отмена
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs gap-1 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmClearLog(true)}
              >
                <Trash2 className="h-3 w-3" /> Очистить лог
              </Button>
            )
          )}
        </div>
        <CardDescription>Записи хранятся 30 дней</CardDescription>
      </CardHeader>
      <CardContent>
        {logQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем лог…
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            История изменений пуста.
          </div>
        ) : (
          <ScrollRemaining totalItems={logs.length} itemHeight={80} className="relative max-h-[520px] overflow-y-auto pr-1">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {logs.map((entry) => (
                <div key={entry.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 ${
                    entry.action === "admin_approved" ? "border-emerald-500 bg-emerald-100" :
                    entry.action === "admin_modified" ? "border-amber-500 bg-amber-100" :
                    entry.action === "admin_reset" ? "border-rose-500 bg-rose-100" :
                    "border-blue-500 bg-blue-100"
                  }`} />

                  <div className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`rounded-full border text-[10px] ${ACTION_COLORS[entry.action] ?? "border-stone-200 bg-stone-50 text-stone-500"}`}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {entry.actorName ?? entry.actorId}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                    </div>

                    {entry.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">«{entry.note}»</p>
                    )}

                    {entry.previousSelectionsJson && entry.newSelectionsJson && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Было</p>
                          {renderSelections(entry.previousSelectionsJson)}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Стало</p>
                          {renderSelections(entry.newSelectionsJson)}
                        </div>
                      </div>
                    )}

                    {!entry.previousSelectionsJson && entry.newSelectionsJson && (
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">План</p>
                        {renderSelections(entry.newSelectionsJson)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollRemaining>
        )}
      </CardContent>
    </Card>
  );
}


/* ── Composition Snapshots Manager ── */

type CompositionRecord = {
  id: number;
  animalSlug: string;
  label: string;
  value: string;
  note: string;
  sortOrder: number;
};

function CompositionSnapshotsManager({ animalId }: { animalId: number }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.productTrack.listCompositionSnapshots.useQuery({ animalId });
  const createMut = trpc.productTrack.createCompositionSnapshot.useMutation({
    onSuccess: () => {
      utils.productTrack.listCompositionSnapshots.invalidate({ animalId });
      setEditing(null);
      toast.success("Показатель добавлен");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMut = trpc.productTrack.updateCompositionSnapshot.useMutation({
    onSuccess: () => {
      utils.productTrack.listCompositionSnapshots.invalidate({ animalId });
      setEditing(null);
      toast.success("Показатель обновлён");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMut = trpc.productTrack.deleteCompositionSnapshot.useMutation({
    onSuccess: () => {
      utils.productTrack.listCompositionSnapshots.invalidate({ animalId });
      toast.success("Показатель удалён");
    },
    onError: (err) => toast.error(err.message),
  });

  const [editing, setEditing] = useState<Partial<CompositionRecord> | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formSort, setFormSort] = useState("0");

  const openNew = () => {
    setEditing({});
    setFormLabel("");
    setFormValue("");
    setFormNote("");
    setFormSort("0");
  };

  const openEdit = (rec: CompositionRecord) => {
    setEditing(rec);
    setFormLabel(rec.label);
    setFormValue(rec.value);
    setFormNote(rec.note);
    setFormSort(String(rec.sortOrder));
  };

  const handleSave = () => {
    if (!formLabel.trim() || !formValue.trim()) {
      toast.error("Заполните название и значение");
      return;
    }
    if (editing?.id) {
      updateMut.mutate({
        id: editing.id,
        animalId,
        label: formLabel.trim(),
        value: formValue.trim(),
        note: formNote.trim(),
        sortOrder: parseInt(formSort, 10) || 0,
      });
    } else {
      createMut.mutate({
        animalId,
        label: formLabel.trim(),
        value: formValue.trim(),
        note: formNote.trim(),
        sortOrder: parseInt(formSort, 10) || 0,
      });
    }
  };

  const items = (listQuery.data ?? []) as CompositionRecord[];
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Состав молока
            </CardTitle>
            <CardDescription>Показатели состава молока животного (жирность, белок, лактоза и др.)</CardDescription>
          </div>
          <Button onClick={openNew} size="sm" className="rounded-full">
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {listQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем…
          </div>
        ) : items.length === 0 && !editing ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center">
            <FlaskConical className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Пока нет данных о составе молока.</p>
            <p className="text-xs text-muted-foreground mt-1">Нажмите «Добавить» чтобы внести показатели.</p>
          </div>
        ) : (
          <ScrollRemaining totalItems={items.length} itemHeight={72} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-white/80 p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <Badge variant="secondary" className="rounded-full text-xs">{item.value}</Badge>
                  </div>
                  {item.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.note}</p>}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                    onClick={() => deleteMut.mutate({ id: item.id, animalId, label: item.label })}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollRemaining>
        )}

        {/* Edit / Create Dialog */}
        <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Редактировать показатель" : "Новый показатель состава"}</DialogTitle>
              <DialogDescription>
                Укажите название показателя (напр. «Жирность»), значение (напр. «4.2%») и примечание.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Жирность, Белок, Лактоза…"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Значение</Label>
                  <Input
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="4.2%"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Порядок</Label>
                  <Input
                    type="number"
                    min={0}
                    max={9999}
                    value={formSort}
                    onChange={(e) => setFormSort(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Примечание</Label>
                <Input
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Единица измерения или пояснение"
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="rounded-full">
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="rounded-full">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {editing?.id ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ── Monthly Metrics Manager ── */

type MonthlyMetricRecord = {
  id: number;
  animalSlug: string;
  monthLabel: string;
  milkVolumeLiters: number;
  proteinPercentTenth: number;
  fatPercentTenth: number;
  sortOrder: number;
};

const MONTH_LABELS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function MonthlyMetricsManager({ animalId }: { animalId: number }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.productTrack.listMonthlyMetrics.useQuery({ animalId });
  const upsertMut = trpc.productTrack.upsertMonthlyMetric.useMutation({
    onSuccess: () => {
      utils.productTrack.listMonthlyMetrics.invalidate({ animalId });
      setEditing(null);
      toast.success("Данные сохранены");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMut = trpc.productTrack.deleteMonthlyMetric.useMutation({
    onSuccess: () => {
      utils.productTrack.listMonthlyMetrics.invalidate({ animalId });
      toast.success("Запись удалена");
    },
    onError: (err) => toast.error(err.message),
  });

  const [editing, setEditing] = useState<Partial<MonthlyMetricRecord> | null>(null);
  const [formMonth, setFormMonth] = useState("");
  const [formLiters, setFormLiters] = useState("");
  const [formProtein, setFormProtein] = useState("");
  const [formFat, setFormFat] = useState("");
  const [formSort, setFormSort] = useState("0");

  const openNew = () => {
    setEditing({});
    setFormMonth(MONTH_LABELS[0]);
    setFormLiters("");
    setFormProtein("");
    setFormFat("");
    setFormSort("0");
  };

  const openEdit = (rec: MonthlyMetricRecord) => {
    setEditing(rec);
    setFormMonth(rec.monthLabel);
    setFormLiters(String(rec.milkVolumeLiters));
    setFormProtein(String(rec.proteinPercentTenth / 10));
    setFormFat(String(rec.fatPercentTenth / 10));
    setFormSort(String(rec.sortOrder));
  };

  const handleSave = () => {
    if (!formMonth.trim()) {
      toast.error("Выберите месяц");
      return;
    }
    const liters = parseInt(formLiters, 10);
    if (!Number.isFinite(liters) || liters < 0) {
      toast.error("Укажите корректный объём молока");
      return;
    }
    const protein = Math.round(parseFloat(formProtein) * 10) || 0;
    const fat = Math.round(parseFloat(formFat) * 10) || 0;

    upsertMut.mutate({
      id: editing?.id,
      animalId,
      monthLabel: formMonth.trim(),
      milkVolumeLiters: liters,
      proteinPercentTenth: protein,
      fatPercentTenth: fat,
      sortOrder: parseInt(formSort, 10) || 0,
    });
  };

  const items = (listQuery.data ?? []) as MonthlyMetricRecord[];

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Сезонный ритм
            </CardTitle>
            <CardDescription>Помесячные данные: объём молока, белок и жирность</CardDescription>
          </div>
          <Button onClick={openNew} size="sm" className="rounded-full">
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {listQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем…
          </div>
        ) : items.length === 0 && !editing ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center">
            <Droplets className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Пока нет данных о сезонном ритме.</p>
            <p className="text-xs text-muted-foreground mt-1">Нажмите «Добавить» чтобы внести помесячные показатели.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Summary bar chart */}
            {items.length > 0 && (
              <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Объём молока по месяцам (л)</p>
                <div className="flex items-end gap-1" style={{ height: 120 }}>
                  {items.map((m) => {
                    const maxLiters = Math.max(...items.map((i) => i.milkVolumeLiters), 1);
                    const pct = (m.milkVolumeLiters / maxLiters) * 100;
                    return (
                      <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{m.milkVolumeLiters}</span>
                        <div
                          className="w-full rounded-t-lg bg-primary/70 transition-all"
                          style={{ height: `${Math.max(pct, 4)}%`, minHeight: 4 }}
                        />
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                          {m.monthLabel.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <ScrollRemaining totalItems={items.length} itemHeight={72} className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-white/80 p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{item.monthLabel}</span>
                      <Badge variant="secondary" className="rounded-full text-xs">{item.milkVolumeLiters} л</Badge>
                      <span className="text-xs text-muted-foreground">
                        Белок {(item.proteinPercentTenth / 10).toFixed(1)}% · Жир {(item.fatPercentTenth / 10).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                      onClick={() => deleteMut.mutate({ id: item.id, animalId })}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollRemaining>
          </div>
        )}

        {/* Edit / Create Dialog */}
        <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Редактировать месяц" : "Новый месяц"}</DialogTitle>
              <DialogDescription>
                Укажите месяц, объём молока (литров) и показатели белка/жирности (%).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Месяц</Label>
                <Select value={formMonth} onValueChange={setFormMonth}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Выберите месяц" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_LABELS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Молоко (л)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    value={formLiters}
                    onChange={(e) => setFormLiters(e.target.value)}
                    placeholder="120"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Белок (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={formProtein}
                    onChange={(e) => setFormProtein(e.target.value)}
                    placeholder="3.2"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Жирность (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={formFat}
                    onChange={(e) => setFormFat(e.target.value)}
                    placeholder="4.5"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Порядок сортировки</Label>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  value={formSort}
                  onChange={(e) => setFormSort(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="rounded-full">
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={upsertMut.isPending} className="rounded-full">
                  {upsertMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {editing?.id ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
