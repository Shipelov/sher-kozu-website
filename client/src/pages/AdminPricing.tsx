/*
  AdminPricing.tsx — Admin CMS for Pricing module
  Tabs: Market Prices, Conversions, Tiers, Analytics
  Allows admin to view/edit market prices, conversion rates, and tier parameters.
*/

import { useState, useCallback } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  DollarSign,
  Edit2,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";

/* ─── Tabs ─── */
type Tab = "prices" | "conversions" | "tiers" | "analytics";

const TABS: { key: Tab; label: string; icon: typeof DollarSign }[] = [
  { key: "prices", label: "Рыночные цены", icon: DollarSign },
  { key: "conversions", label: "Конверсии", icon: RefreshCw },
  { key: "tiers", label: "Тарифы", icon: Settings },
  { key: "analytics", label: "Аналитика", icon: TrendingUp },
];

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function AdminPricing() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("prices");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user || (user as any).role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-32 text-center">
          <h1 className="text-2xl font-bold text-foreground">Доступ запрещён</h1>
          <p className="mt-2 text-muted-foreground">Эта страница доступна только администраторам.</p>
          <Link href="/admin" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Вернуться в админку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="container pt-4 pb-2">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Админ", href: "/admin" },
              { label: "Управление ценами" },
            ]}
          />
        </div>

        <div className="container pb-4 pt-2">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Управление ценами</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CMS для рыночных цен, конверсий молока и параметров тарифов
          </p>
        </div>

        {/* Tabs */}
        <div className="container pb-2">
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="container pb-16 pt-4">
          {tab === "prices" && <MarketPricesTab />}
          {tab === "conversions" && <ConversionsTab />}
          {tab === "tiers" && <TiersTab />}
          {tab === "analytics" && <AnalyticsTab />}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Market Prices Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function MarketPricesTab() {
  const pricesQuery = trpc.pricing.adminListMarketPrices.useQuery();
  const updateMut = trpc.pricing.adminUpdateMarketPrice.useMutation({
    onSuccess: () => {
      toast.success("Цена обновлена");
      pricesQuery.refetch();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const startEdit = useCallback((row: any) => {
    setEditing(row.id);
    setEditValues({
      minPrice: String(row.minPrice),
      maxPrice: String(row.maxPrice),
      avgPrice: String(row.avgPrice),
      source: row.source || "",
    });
  }, []);

  const saveEdit = useCallback(
    (id: number) => {
      updateMut.mutate({
        id,
        minPrice: parseFloat(editValues.minPrice) || 0,
        maxPrice: parseFloat(editValues.maxPrice) || 0,
        avgPrice: parseFloat(editValues.avgPrice) || 0,
        source: editValues.source || undefined,
      });
    },
    [editValues, updateMut]
  );

  if (pricesQuery.isLoading) return <LoadingSpinner />;

  const prices = pricesQuery.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Рыночные цены продуктов</h2>
        <Button variant="outline" size="sm" onClick={() => pricesQuery.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Обновить
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Цены указаны за единицу измерения (литр, кг). Источник: sff.market и аналоги.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left font-semibold text-muted-foreground">Продукт</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Вид</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Категория</th>
              <th className="p-3 text-right font-semibold text-muted-foreground">Мин ₽</th>
              <th className="p-3 text-right font-semibold text-muted-foreground">Макс ₽</th>
              <th className="p-3 text-right font-semibold text-muted-foreground">Сред ₽</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Ед.</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Доступность</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Источник</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Действия</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((row: any) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{row.productName}</td>
                <td className="p-3 text-muted-foreground">{row.species === "goat" ? "Козье" : "Овечье"}</td>
                <td className="p-3 text-muted-foreground">{row.category}</td>
                {editing === row.id ? (
                  <>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={editValues.minPrice}
                        onChange={(e) => setEditValues((v) => ({ ...v, minPrice: e.target.value }))}
                        className="w-20 h-8 text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={editValues.maxPrice}
                        onChange={(e) => setEditValues((v) => ({ ...v, maxPrice: e.target.value }))}
                        className="w-20 h-8 text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={editValues.avgPrice}
                        onChange={(e) => setEditValues((v) => ({ ...v, avgPrice: e.target.value }))}
                        className="w-20 h-8 text-sm"
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 text-right text-foreground">{fmt(row.minPrice)}</td>
                    <td className="p-3 text-right text-foreground">{fmt(row.maxPrice)}</td>
                    <td className="p-3 text-right font-semibold text-foreground">{fmt(row.avgPrice)}</td>
                  </>
                )}
                <td className="p-3 text-muted-foreground">{row.unit}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.tierAvailability === "all"
                        ? "bg-primary/10 text-primary"
                        : row.tierAvailability === "standard_plus"
                        ? "bg-accent/10 text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {row.tierAvailability === "all" ? "Все" : row.tierAvailability === "standard_plus" ? "Станд.+" : "Проф."}
                  </span>
                </td>
                {editing === row.id ? (
                  <td className="p-2">
                    <Input
                      value={editValues.source}
                      onChange={(e) => setEditValues((v) => ({ ...v, source: e.target.value }))}
                      className="w-24 h-8 text-sm"
                    />
                  </td>
                ) : (
                  <td className="p-3 text-xs text-muted-foreground">{row.source || "—"}</td>
                )}
                <td className="p-3 text-center">
                  {editing === row.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => saveEdit(row.id)} disabled={updateMut.isPending}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Conversions Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function ConversionsTab() {
  const conversionsQuery = trpc.pricing.adminListConversions.useQuery();
  const updateMut = trpc.pricing.adminUpdateConversion.useMutation({
    onSuccess: () => {
      toast.success("Конверсия обновлена");
      conversionsQuery.refetch();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const startEdit = useCallback((row: any) => {
    setEditing(row.id);
    setEditValues({
      milkLitersPerUnit: String(row.milkLitersPerUnit),
      notes: row.notes || "",
    });
  }, []);

  const saveEdit = useCallback(
    (id: number) => {
      updateMut.mutate({
        id,
        milkLitersPerUnit: parseFloat(editValues.milkLitersPerUnit) || 1,
        notes: editValues.notes || undefined,
      });
    },
    [editValues, updateMut]
  );

  if (conversionsQuery.isLoading) return <LoadingSpinner />;

  const conversions = conversionsQuery.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Конверсии молока в продукцию</h2>
        <Button variant="outline" size="sm" onClick={() => conversionsQuery.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Обновить
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Сколько литров молока нужно для производства 1 единицы продукта.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left font-semibold text-muted-foreground">Продукт</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Slug</th>
              <th className="p-3 text-right font-semibold text-muted-foreground">Литров / ед.</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Ед. выхода</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Примечание</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Действия</th>
            </tr>
          </thead>
          <tbody>
            {conversions.map((row: any) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{row.productName}</td>
                <td className="p-3 text-xs text-muted-foreground font-mono">{row.productSlug}</td>
                {editing === row.id ? (
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={editValues.milkLitersPerUnit}
                      onChange={(e) => setEditValues((v) => ({ ...v, milkLitersPerUnit: e.target.value }))}
                      className="w-24 h-8 text-sm"
                    />
                  </td>
                ) : (
                  <td className="p-3 text-right font-semibold text-foreground">{row.milkLitersPerUnit}</td>
                )}
                <td className="p-3 text-muted-foreground">{row.outputUnit}</td>
                {editing === row.id ? (
                  <td className="p-2">
                    <Input
                      value={editValues.notes}
                      onChange={(e) => setEditValues((v) => ({ ...v, notes: e.target.value }))}
                      className="w-40 h-8 text-sm"
                    />
                  </td>
                ) : (
                  <td className="p-3 text-xs text-muted-foreground">{row.notes || "—"}</td>
                )}
                <td className="p-3 text-center">
                  {editing === row.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => saveEdit(row.id)} disabled={updateMut.isPending}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tiers Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function TiersTab() {
  const tiersQuery = trpc.pricing.adminListTiers.useQuery();
  const updateMut = trpc.pricing.adminUpdateTier.useMutation({
    onSuccess: () => {
      toast.success("Тариф обновлён");
      tiersQuery.refetch();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const startEdit = useCallback((row: any) => {
    setEditing(row.id);
    setEditValues({
      monthlyFee: String(row.monthlyFee),
      annualDiscountPercent: String(row.annualDiscountPercent),
      renewalDiscountPercent: String(row.renewalDiscountPercent),
      shopDiscountPercent: String(row.shopDiscountPercent),
      farmVisitsPerYear: String(row.farmVisitsPerYear),
      clubEventsPerYear: String(row.clubEventsPerYear),
      deliveryAddresses: String(row.deliveryAddresses),
    });
  }, []);

  const saveEdit = useCallback(
    (id: number) => {
      updateMut.mutate({
        id,
        monthlyFee: parseFloat(editValues.monthlyFee) || 0,
        annualDiscountPercent: parseInt(editValues.annualDiscountPercent) || 0,
        renewalDiscountPercent: parseInt(editValues.renewalDiscountPercent) || 0,
        shopDiscountPercent: parseInt(editValues.shopDiscountPercent) || 0,
        farmVisitsPerYear: parseInt(editValues.farmVisitsPerYear) || 0,
        clubEventsPerYear: parseInt(editValues.clubEventsPerYear) || 0,
        deliveryAddresses: parseInt(editValues.deliveryAddresses) || 0,
      });
    },
    [editValues, updateMut]
  );

  if (tiersQuery.isLoading) return <LoadingSpinner />;

  const tiers = tiersQuery.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Параметры тарифов</h2>
        <Button variant="outline" size="sm" onClick={() => tiersQuery.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Обновить
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tiers.map((tier: any) => (
          <div key={tier.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-foreground">{tier.name}</h3>
                <p className="text-xs text-muted-foreground">{tier.slug}</p>
              </div>
              {editing === tier.id ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => saveEdit(tier.id)} disabled={updateMut.isPending}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => startEdit(tier)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ежемесячный взнос</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.monthlyFee}
                    onChange={(e) => setEditValues((v) => ({ ...v, monthlyFee: e.target.value }))}
                    className="w-28 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{fmt(tier.monthlyFee)} ₽</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Годовая скидка</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.annualDiscountPercent}
                    onChange={(e) => setEditValues((v) => ({ ...v, annualDiscountPercent: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{tier.annualDiscountPercent}%</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Скидка продления</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.renewalDiscountPercent}
                    onChange={(e) => setEditValues((v) => ({ ...v, renewalDiscountPercent: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{tier.renewalDiscountPercent}%</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Скидка в магазине</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.shopDiscountPercent}
                    onChange={(e) => setEditValues((v) => ({ ...v, shopDiscountPercent: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{tier.shopDiscountPercent}%</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Визиты на ферму / год</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.farmVisitsPerYear}
                    onChange={(e) => setEditValues((v) => ({ ...v, farmVisitsPerYear: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{tier.farmVisitsPerYear === 999 ? "∞" : tier.farmVisitsPerYear}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Мероприятия / год</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.clubEventsPerYear}
                    onChange={(e) => setEditValues((v) => ({ ...v, clubEventsPerYear: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{tier.clubEventsPerYear === 999 ? "∞" : tier.clubEventsPerYear}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Адреса доставки</span>
                {editing === tier.id ? (
                  <Input
                    type="number"
                    value={editValues.deliveryAddresses}
                    onChange={(e) => setEditValues((v) => ({ ...v, deliveryAddresses: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                ) : (
                  <span className="font-semibold text-foreground">{tier.deliveryAddresses}</span>
                )}
              </div>
            </div>

            {/* Features list */}
            {tier.featureHighlights && tier.featureHighlights.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Возможности</p>
                <div className="space-y-1">
                  {(tier.featureHighlights as string[]).slice(0, 5).map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-primary shrink-0" />
                      {f}
                    </div>
                  ))}
                  {tier.featureHighlights.length > 5 && (
                    <p className="text-xs text-muted-foreground/60">+{tier.featureHighlights.length - 5} ещё</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Analytics Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const analyticsQuery = trpc.pricing.adminGetAnalytics.useQuery({ days });

  if (analyticsQuery.isLoading) return <LoadingSpinner />;

  const data = analyticsQuery.data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Аналитика блока Цены</h2>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => analyticsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Page views */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground mb-3">Просмотры страниц</h3>
            {data.pageViews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет данных за период</p>
            ) : (
              <div className="space-y-2">
                {data.pageViews.map((pv: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-mono text-xs">{pv.pagePath}</span>
                    <span className="font-semibold text-foreground">{pv.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calculator sessions */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground mb-3">Сессии калькулятора</h3>
            {data.calculatorSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет данных за период</p>
            ) : (
              <div className="space-y-2">
                {data.calculatorSessions.map((cs: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{cs.breed} ({cs.tierSlug})</span>
                    <span className="font-semibold text-foreground">{cs.count} сессий</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Popular configs */}
          <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
            <h3 className="font-bold text-foreground mb-3">Популярные конфигурации</h3>
            {data.popularConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет данных за период</p>
            ) : (
              <div className="space-y-2">
                {data.popularConfigs.map((pc: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{pc.breed} — {pc.sharePercent}%</span>
                    <span className="font-semibold text-foreground">{pc.count} раз</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared ─── */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
