import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  GripVertical,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

// ─── Category Form ───────────────────────────────────────
function CategoryForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initial?: { name: string; slug: string; description?: string; emoji?: string; sortOrder: number; isVisible: number };
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? 1);

  const autoSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 64);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Название</Label>
          <Input value={name} onChange={e => { setName(e.target.value); if (!initial) setSlug(autoSlug(e.target.value)); }} placeholder="Корм и лакомства" />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="korm-i-lakomstva" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Описание</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание категории..." rows={2} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Эмодзи</Label>
          <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🥕" maxLength={10} />
        </div>
        <div className="space-y-2">
          <Label>Порядок</Label>
          <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <Switch checked={isVisible === 1} onCheckedChange={v => setIsVisible(v ? 1 : 0)} />
          <Label className="text-sm">{isVisible ? "Видима" : "Скрыта"}</Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>Отмена</Button>
        <Button onClick={() => onSubmit({ name, slug, description, emoji, sortOrder, isVisible })} disabled={isLoading || !name || !slug}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {initial ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </div>
  );
}

// ─── Item Form ───────────────────────────────────────────
function ItemForm({
  categories,
  initial,
  onSubmit,
  onCancel,
  isLoading,
}: {
  categories: Array<{ id: number; name: string; emoji?: string | null }>;
  initial?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [categoryId, setCategoryId] = useState<number>(initial?.categoryId ?? (categories[0]?.id ?? 0));
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [priceSKC, setPriceSKC] = useState(initial?.priceSKC ?? 10);
  const [stock, setStock] = useState(initial?.stock ?? -1);
  const [season, setSeason] = useState(initial?.season ?? "all");
  const [applicableSpecies, setApplicableSpecies] = useState(initial?.applicableSpecies ?? "");
  const [dailyLimit, setDailyLimit] = useState(initial?.dailyLimitPerOwner ?? 0);
  const [weeklyLimit, setWeeklyLimit] = useState(initial?.weeklyLimitPerOwner ?? 0);
  const [monthlyLimit, setMonthlyLimit] = useState(initial?.monthlyLimitPerOwner ?? 0);
  const [requiresChecklist, setRequiresChecklist] = useState(initial?.requiresChecklist ?? 0);
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? 1);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [feedbackTemplate, setFeedbackTemplate] = useState(initial?.feedbackTemplate ?? "");

  // Metric effects
  const [happiness, setHappiness] = useState(0);
  const [health, setHealth] = useState(0);
  const [attachment, setAttachment] = useState(0);
  const [mood, setMood] = useState(0);
  const [obedience, setObedience] = useState(0);

  // Parse initial metric effects
  useState(() => {
    if (initial?.metricEffectsJson) {
      try {
        const effects = JSON.parse(initial.metricEffectsJson);
        setHappiness(effects.happiness || 0);
        setHealth(effects.health || 0);
        setAttachment(effects.attachment || 0);
        setMood(effects.mood || 0);
        setObedience(effects.obedience || 0);
      } catch {}
    }
  });

  const autoSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 64);

  const handleSubmit = () => {
    const metricEffects: Record<string, number> = {};
    if (happiness) metricEffects.happiness = happiness;
    if (health) metricEffects.health = health;
    if (attachment) metricEffects.attachment = attachment;
    if (mood) metricEffects.mood = mood;
    if (obedience) metricEffects.obedience = obedience;

    onSubmit({
      categoryId,
      name,
      slug,
      description,
      imageUrl: imageUrl || undefined,
      priceSKC,
      stock,
      metricEffectsJson: JSON.stringify(metricEffects),
      requiresChecklist,
      feedbackTemplate: feedbackTemplate || undefined,
      season,
      applicableSpecies: applicableSpecies || undefined,
      dailyLimitPerOwner: dailyLimit,
      weeklyLimitPerOwner: weeklyLimit,
      monthlyLimitPerOwner: monthlyLimit,
      sortOrder,
      isVisible,
    });
  };

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
      {/* Basic info */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground/80">Основное</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Категория</Label>
            <Select value={String(categoryId)} onValueChange={v => setCategoryId(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.emoji ?? ""} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Цена (SKC)</Label>
            <Input type="number" min={1} value={priceSKC} onChange={e => setPriceSKC(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Название</Label>
            <Input value={name} onChange={e => { setName(e.target.value); if (!initial) setSlug(autoSlug(e.target.value)); }} placeholder="Морковка свежая" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="morkovka" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Описание</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Описание товара..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL изображения</Label>
          <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground/80">Доступность</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Запас (-1 = безлимит)</Label>
            <Input type="number" value={stock} onChange={e => setStock(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Сезон</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Весь год</SelectItem>
                <SelectItem value="spring">Весна</SelectItem>
                <SelectItem value="summer">Лето</SelectItem>
                <SelectItem value="autumn">Осень</SelectItem>
                <SelectItem value="winter">Зима</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Вид животного</Label>
            <Input value={applicableSpecies} onChange={e => setApplicableSpecies(e.target.value)} placeholder="Все" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Лимит/день (0 = нет)</Label>
            <Input type="number" min={0} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Лимит/неделю</Label>
            <Input type="number" min={0} value={weeklyLimit} onChange={e => setWeeklyLimit(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Лимит/месяц</Label>
            <Input type="number" min={0} value={monthlyLimit} onChange={e => setMonthlyLimit(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Metric effects */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground/80">Эффект на метрики</h4>
        <div className="grid grid-cols-5 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Счастье</Label>
            <Input type="number" min={-20} max={30} value={happiness} onChange={e => setHappiness(Number(e.target.value))} className="text-xs h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Здоровье</Label>
            <Input type="number" min={-20} max={30} value={health} onChange={e => setHealth(Number(e.target.value))} className="text-xs h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Привяз.</Label>
            <Input type="number" min={-20} max={30} value={attachment} onChange={e => setAttachment(Number(e.target.value))} className="text-xs h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Настроен.</Label>
            <Input type="number" min={-20} max={30} value={mood} onChange={e => setMood(Number(e.target.value))} className="text-xs h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Послуш.</Label>
            <Input type="number" min={-20} max={30} value={obedience} onChange={e => setObedience(Number(e.target.value))} className="text-xs h-8" />
          </div>
        </div>
      </div>

      {/* Checklist & feedback */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground/80">Чек-лист и обратная связь</h4>
        <div className="flex items-center gap-3">
          <Switch checked={requiresChecklist === 1} onCheckedChange={v => setRequiresChecklist(v ? 1 : 0)} />
          <Label className="text-sm">Требует чек-лист фермера</Label>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Шаблон обратной связи</Label>
          <Input value={feedbackTemplate} onChange={e => setFeedbackTemplate(e.target.value)} placeholder="{animalName} говорит: Спасибо за {itemName}!" />
          <p className="text-[10px] text-muted-foreground">Используйте {"{animalName}"} и {"{itemName}"} для подстановки</p>
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-3">
          <Switch checked={isVisible === 1} onCheckedChange={v => setIsVisible(v ? 1 : 0)} />
          <Label className="text-sm">{isVisible ? "Видим в маркетплейсе" : "Скрыт"}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Порядок:</Label>
          <Input type="number" className="w-16 h-8 text-xs" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>Отмена</Button>
        <Button onClick={handleSubmit} disabled={isLoading || !name || !slug || !categoryId}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {initial ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function AdminMarketplace() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("categories");
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>();

  const categoriesQuery = trpc.gamification.categories.list.useQuery({ includeHidden: true }, { enabled: isAdmin });
  const itemsQuery = trpc.gamification.items.list.useQuery(
    { categoryId: filterCategoryId, includeHidden: true },
    { enabled: isAdmin }
  );

  const createCategory = trpc.gamification.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Категория создана");
      utils.gamification.categories.list.invalidate();
      setShowCategoryForm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCategory = trpc.gamification.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Категория обновлена");
      utils.gamification.categories.list.invalidate();
      setEditingCategory(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCategory = trpc.gamification.categories.delete.useMutation({
    onSuccess: () => {
      toast.success("Категория удалена");
      utils.gamification.categories.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createItem = trpc.gamification.items.create.useMutation({
    onSuccess: () => {
      toast.success("Товар создан");
      utils.gamification.items.list.invalidate();
      setShowItemForm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = trpc.gamification.items.update.useMutation({
    onSuccess: () => {
      toast.success("Товар обновлён");
      utils.gamification.items.list.invalidate();
      setEditingItem(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = trpc.gamification.items.delete.useMutation({
    onSuccess: () => {
      toast.success("Товар удалён");
      utils.gamification.items.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  const seasonLabels: Record<string, string> = {
    all: "Весь год",
    spring: "Весна",
    summer: "Лето",
    autumn: "Осень",
    winter: "Зима",
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Card><CardContent className="p-6 text-center text-muted-foreground">Доступ только для администратора</CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <PageBreadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Admin", href: "/admin" },
            { label: "Маркетплейс" },
          ]}
        />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Маркетплейс фермы</h1>
            <p className="text-sm text-muted-foreground">Категории, товары, цены и эффекты на метрики</p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            {categories.length} кат. · {items.length} тов.
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories">Категории</TabsTrigger>
            <TabsTrigger value="items">Товары</TabsTrigger>
          </TabsList>

          {/* ─── Categories Tab ─── */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCategoryForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Новая категория
              </Button>
            </div>

            {showCategoryForm && (
              <Card>
                <CardHeader><CardTitle className="text-base">Новая категория</CardTitle></CardHeader>
                <CardContent>
                  <CategoryForm
                    onSubmit={data => createCategory.mutate(data)}
                    onCancel={() => setShowCategoryForm(false)}
                    isLoading={createCategory.isPending}
                  />
                </CardContent>
              </Card>
            )}

            {categoriesQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Категорий пока нет. Создайте первую!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {categories.map((cat: any) => (
                  <Card key={cat.id} className={cn("transition-colors", !cat.isVisible && "opacity-60")}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat.emoji || "📦"}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cat.name}</span>
                            <Badge variant="outline" className="text-[10px]">{cat.slug}</Badge>
                            {!cat.isVisible && <Badge variant="secondary" className="text-[10px]">Скрыта</Badge>}
                          </div>
                          {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {editingCategory?.id === cat.id ? (
                          <Dialog open onOpenChange={() => setEditingCategory(null)}>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Редактировать категорию</DialogTitle>
                              </DialogHeader>
                              <CategoryForm
                                initial={editingCategory}
                                onSubmit={data => updateCategory.mutate({ id: cat.id, ...data })}
                                onCancel={() => setEditingCategory(null)}
                                isLoading={updateCategory.isPending}
                              />
                            </DialogContent>
                          </Dialog>
                        ) : null}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCategory(cat)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm("Удалить категорию?")) deleteCategory.mutate({ id: cat.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Items Tab ─── */}
          <TabsContent value="items" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Select
                value={filterCategoryId ? String(filterCategoryId) : "all"}
                onValueChange={v => setFilterCategoryId(v === "all" ? undefined : Number(v))}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Все категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.emoji ?? ""} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowItemForm(true)} size="sm" disabled={categories.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Новый товар
              </Button>
            </div>

            {showItemForm && (
              <Card>
                <CardHeader><CardTitle className="text-base">Новый товар</CardTitle></CardHeader>
                <CardContent>
                  <ItemForm
                    categories={categories}
                    onSubmit={data => createItem.mutate(data)}
                    onCancel={() => setShowItemForm(false)}
                    isLoading={createItem.isPending}
                  />
                </CardContent>
              </Card>
            )}

            {editingItem && (
              <Dialog open onOpenChange={() => setEditingItem(null)}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Редактировать товар</DialogTitle>
                    <DialogDescription>{editingItem.name}</DialogDescription>
                  </DialogHeader>
                  <ItemForm
                    categories={categories}
                    initial={editingItem}
                    onSubmit={data => updateItem.mutate({ id: editingItem.id, ...data })}
                    onCancel={() => setEditingItem(null)}
                    isLoading={updateItem.isPending}
                  />
                </DialogContent>
              </Dialog>
            )}

            {itemsQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Товаров пока нет. Создайте первый!</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollRemaining totalItems={items.length} itemHeight={100} className="grid gap-3 max-h-[600px] overflow-y-auto pr-1">
                {items.map((item: any) => {
                  const cat = categories.find((c: any) => c.id === item.categoryId);
                  const effects = item.metricEffectsJson ? JSON.parse(item.metricEffectsJson) : {};
                  const effectLabels = Object.entries(effects)
                    .filter(([_, v]) => v !== 0)
                    .map(([k, v]) => {
                      const labels: Record<string, string> = { happiness: "😊", health: "💚", attachment: "❤️", mood: "🌟", obedience: "🎓" };
                      return `${labels[k] ?? k} ${(v as number) > 0 ? "+" : ""}${v}`;
                    });

                  return (
                    <Card key={item.id} className={cn("transition-colors", !item.isVisible && "opacity-60")}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg">
                                {cat?.emoji ?? "📦"}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item.name}</span>
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                  {item.priceSKC} SKC
                                </Badge>
                                {item.stock !== -1 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Запас: {item.stock}
                                  </Badge>
                                )}
                                {item.season !== "all" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {seasonLabels[item.season]}
                                  </Badge>
                                )}
                                {!item.isVisible && <Badge variant="secondary" className="text-[10px]">Скрыт</Badge>}
                                {item.requiresChecklist === 1 && <Badge variant="outline" className="text-[10px]">📋 Чек-лист</Badge>}
                              </div>
                              {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.description}</p>}
                              {effectLabels.length > 0 && (
                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                  {effectLabels.map((label, i) => (
                                    <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{label}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingItem(item)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (confirm("Удалить товар?")) deleteItem.mutate({ id: item.id });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </ScrollRemaining>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
