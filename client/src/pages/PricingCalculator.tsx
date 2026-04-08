/*
  PricingCalculator.tsx — Калькулятор выгоды
  Interactive calculator: breed selection, share %, milk allocation sliders,
  payment period toggle, results panel with savings comparison.
*/

import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";
import { useCmsContent } from "@/hooks/useCmsContent";
import {
  ArrowRight,
  Calculator,
  Check,
  Download,
  Leaf,
  Share2,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";

/* ─── Types ─── */
type BreedKey = "anglo-nubian" | "alpine" | "lacaune" | "east-friesian";

interface BreedOption {
  key: BreedKey;
  name: string;
  price: number;
  species: "goat" | "sheep";
  emoji: string;
}

const BREEDS: BreedOption[] = [
  { key: "anglo-nubian", name: "Англо-нубийская", price: 120000, species: "goat", emoji: "🐐" },
  { key: "alpine", name: "Альпийская", price: 95000, species: "goat", emoji: "🐐" },
  { key: "lacaune", name: "Лакон", price: 110000, species: "sheep", emoji: "🐑" },
  { key: "east-friesian", name: "Остфризская", price: 100000, species: "sheep", emoji: "🐑" },
];

/* Default product allocations */
const DEFAULT_ALLOC: Record<string, number> = {
  "fresh-milk": 35,
  "tvorog": 20,
  "kefir": 15,
  "yogurt": 10,
  "soft-cheese": 20,
};

const PRODUCT_LABELS: Record<string, { name: string; color: string }> = {
  "fresh-milk": { name: "Молоко", color: "bg-[oklch(0.55_0.18_145)]" },
  "tvorog": { name: "Творог", color: "bg-[oklch(0.55_0.15_50)]" },
  "kefir": { name: "Кефир", color: "bg-[oklch(0.55_0.12_260)]" },
  "yogurt": { name: "Йогурт", color: "bg-[oklch(0.55_0.10_310)]" },
  "soft-cheese": { name: "Мягкий сыр", color: "bg-[oklch(0.55_0.14_80)]" },
  "semi-hard-cheese": { name: "Полутвёрдый сыр", color: "bg-[oklch(0.50_0.12_30)]" },
  "aged-cheese": { name: "Выдержанный сыр", color: "bg-[oklch(0.45_0.10_20)]" },
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function PricingCalculator() {
  const cms = useCmsContent("calculator");
  const [breed, setBreed] = useState<BreedKey>("alpine");
  const [share, setShare] = useState<50 | 100>(100);
  const [alloc, setAlloc] = useState<Record<string, number>>(DEFAULT_ALLOC);
  const [annualPayment, setAnnualPayment] = useState(false);

  const breedObj = BREEDS.find((b) => b.key === breed)!;

  // Fetch market prices and conversions for the donut chart labels
  const conversionsQuery = trpc.pricing.getConversions.useQuery();

  // Calculate mutation
  const calcMut = trpc.pricing.calculate.useMutation();

  // Auto-calculate on parameter change
  useEffect(() => {
    const totalAlloc = Object.values(alloc).reduce((s, v) => s + v, 0);
    if (Math.abs(totalAlloc - 100) <= 1) {
      calcMut.mutate({
        breed,
        sharePercent: share,
        productAllocation: alloc,
        animalPriceRub: breedObj.price,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breed, share, alloc]);

  const result = calcMut.data;

  // Monthly fee with annual discount
  const monthlyFee = result?.monthlyFeeRub ?? (share === 50 ? 7500 : 14900);
  const annualDiscount = 0.15;
  const effectiveMonthly = annualPayment ? Math.round(monthlyFee * (1 - annualDiscount)) : monthlyFee;
  const annualFee = effectiveMonthly * 12;
  const ownershipCost = Math.round((breedObj.price * share) / 100);
  const totalCost = ownershipCost + annualFee;
  const marketValue = result?.totalMarketValueRub ?? 0;
  const savings = marketValue - annualFee;
  const savingsPercent = marketValue > 0 ? Math.round((savings / marketValue) * 100) : 0;

  // Estimated monthly milk
  const BREED_MONTHLY_MILK: Record<string, number> = {
    "anglo-nubian": 67,
    "alpine": 75,
    "lacaune": 29,
    "east-friesian": 42,
  };
  const monthlyMilk = Math.round((BREED_MONTHLY_MILK[breed] * share) / 100);

  // Allocation slider handler
  const handleAllocChange = useCallback(
    (slug: string, newVal: number) => {
      setAlloc((prev) => {
        const others = Object.entries(prev).filter(([k]) => k !== slug);
        const othersTotal = others.reduce((s, [, v]) => s + v, 0);
        const remaining = 100 - newVal;
        if (othersTotal === 0) {
          // distribute evenly
          const each = Math.floor(remaining / others.length);
          const result: Record<string, number> = { [slug]: newVal };
          others.forEach(([k], i) => {
            result[k] = i === others.length - 1 ? remaining - each * (others.length - 1) : each;
          });
          return result;
        }
        const result: Record<string, number> = { [slug]: newVal };
        let distributed = 0;
        others.forEach(([k, v], i) => {
          if (i === others.length - 1) {
            result[k] = Math.max(0, remaining - distributed);
          } else {
            const scaled = Math.round((v / othersTotal) * remaining);
            result[k] = Math.max(0, scaled);
            distributed += result[k];
          }
        });
        return result;
      });
    },
    []
  );

  // Available products based on share (tier)
  const availableProducts = useMemo(() => {
    const base = ["fresh-milk", "tvorog", "kefir", "yogurt", "soft-cheese"];
    if (share === 100) base.push("semi-hard-cheese");
    return base;
  }, [share]);

  // Reset allocation when share changes
  useEffect(() => {
    if (share === 50) {
      setAlloc(DEFAULT_ALLOC);
    } else {
      setAlloc({
        "fresh-milk": 30,
        "tvorog": 15,
        "kefir": 15,
        "yogurt": 10,
        "soft-cheese": 15,
        "semi-hard-cheese": 15,
      });
    }
  }, [share]);

  // Total allocation for validation
  const totalAlloc = Object.values(alloc).reduce((s, v) => s + v, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Breadcrumbs */}
        <div className="container pt-4 pb-2">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Цены", href: "/pricing" },
              { label: "Калькулятор выгоды" },
            ]}
          />
        </div>

        {/* Header */}
        <div className="container pb-8 pt-2">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">{cms.getText("page_title", "Калькулятор выгоды")}</h1>
          <p className="mt-2 text-muted-foreground">
            {cms.getText("page_subtitle", "Настройте параметры и увидите реальную экономию по сравнению с покупкой на рынке")}
          </p>
        </div>

        {/* Main grid: config left, results right */}
        <div className="container pb-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* ─── LEFT: Configuration ─── */}
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-6">
                <Calculator className="h-5 w-5 text-primary" />
                {cms.getText("config_heading", "Настройте параметры")}
              </h2>

              {/* Breed selection */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-foreground mb-3 block">{cms.getText("breed_label", "Порода животного")}</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {BREEDS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBreed(b.key)}
                      className={`rounded-xl border-2 p-3 text-center transition-all ${
                        breed === b.key
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl block mb-1">{b.emoji}</span>
                      <span className="text-sm font-semibold text-foreground block">{b.name}</span>
                      <span className="text-xs text-muted-foreground">{fmt(b.price)} ₽</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Share selection */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-foreground mb-3 block">{cms.getText("share_label", "Доля владения")}</label>
                <div className="grid grid-cols-2 gap-3">
                  {([50, 100] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShare(s)}
                      className={`rounded-xl border-2 p-4 text-center transition-all ${
                        share === s
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl font-bold text-foreground block">{s}%</span>
                      <span className="text-sm text-muted-foreground">{s === 50 ? "Совладение" : "Полное владение"}</span>
                      <span className="text-xs text-muted-foreground block">{s === 50 ? "Базовый тариф" : "Стандартный тариф"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Milk allocation */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-foreground mb-1 block">{cms.getText("alloc_label", "Распределение баланса молока")}</label>
                <p className="text-xs text-muted-foreground mb-4">
                  {cms.getText("alloc_hint", "Перемещайте слайдеры, чтобы распределить молоко между продуктами")}
                </p>

                {/* Monthly milk indicator */}
                <div className="flex items-center justify-center mb-5">
                  <div className="rounded-full bg-primary/10 px-5 py-2 text-center">
                    <span className="text-2xl font-bold text-primary">{monthlyMilk} л</span>
                    <span className="text-xs text-muted-foreground block">в месяц</span>
                  </div>
                </div>

                {/* Sliders */}
                <div className="space-y-4">
                  {availableProducts.map((slug) => {
                    const label = PRODUCT_LABELS[slug];
                    const val = alloc[slug] ?? 0;
                    return (
                      <div key={slug} className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full shrink-0 ${label?.color ?? "bg-muted"}`} />
                        <span className="text-sm text-foreground w-32 shrink-0">{label?.name ?? slug}</span>
                        <Slider
                          value={[val]}
                          min={0}
                          max={80}
                          step={5}
                          onValueChange={([v]) => handleAllocChange(slug, v)}
                          className="flex-1"
                        />
                        <span className="text-sm font-semibold text-foreground w-10 text-right">{val}%</span>
                      </div>
                    );
                  })}
                </div>
                {Math.abs(totalAlloc - 100) > 1 && (
                  <p className="mt-2 text-xs text-destructive">
                    Сумма: {totalAlloc}% (должна быть 100%)
                  </p>
                )}
              </div>

              {/* Payment period */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-foreground mb-3 block">{cms.getText("payment_label", "Период оплаты")}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnnualPayment(false)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      !annualPayment ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground block">Помесячно</span>
                    <span className="text-xs text-muted-foreground">{fmt(monthlyFee)} ₽/мес</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnualPayment(true)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      annualPayment ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground block">Годовая (−15%)</span>
                    <span className="text-xs text-muted-foreground">{fmt(Math.round(monthlyFee * 0.85))} ₽/мес</span>
                  </button>
                </div>
              </div>

              {/* Products table */}
              {result && result.products.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">{cms.getText("products_label", "Что вы получите за год")}</label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 font-semibold text-muted-foreground">Продукт</th>
                          <th className="py-2 font-semibold text-muted-foreground text-right">Объём/год</th>
                          <th className="py-2 font-semibold text-muted-foreground text-right">Рыночная цена</th>
                          <th className="py-2 font-semibold text-muted-foreground text-right">Стоимость</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.products.map((p) => (
                          <tr key={p.productSlug} className="border-b border-border/50">
                            <td className="py-2 text-foreground">{p.productName}</td>
                            <td className="py-2 text-right text-foreground">
                              {p.outputQuantity.toFixed(1)} {p.unit}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {/* show per-unit market price */}
                              —
                            </td>
                            <td className="py-2 text-right font-semibold text-primary">
                              {fmt(p.marketValueRub)} ₽
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="py-2 font-bold text-foreground">Итого рыночная стоимость</td>
                          <td className="py-2 text-right font-bold text-primary">{fmt(marketValue)} ₽</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ─── RIGHT: Results (sticky) ─── */}
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              {/* Savings hero */}
              <div className="rounded-2xl bg-primary p-5 text-center text-primary-foreground">
                <p className="text-sm font-medium opacity-80">{cms.getText("savings_title", "Ваша выгода за год")}</p>
                <p className="text-4xl font-bold mt-1">{savingsPercent > 0 ? `${savingsPercent}%` : "—"}</p>
                <p className="text-sm font-semibold mt-1">
                  Экономия: {savings > 0 ? `${fmt(savings)} ₽` : "—"}
                </p>
              </div>

              {/* Cost breakdown */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{cms.getText("costs_title", "Сводка расходов (год)")}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Разовый платёж</span>
                    <span className="font-semibold text-foreground">{fmt(ownershipCost)} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ежемесячные взносы</span>
                    <span className="font-semibold text-foreground">{fmt(annualFee)} ₽</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-bold text-foreground">Итого ваши расходы</span>
                    <span className="font-bold text-foreground">{fmt(totalCost)} ₽</span>
                  </div>
                </div>
              </div>

              {/* Value breakdown */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{cms.getText("value_title", "Ценность (год)")}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Продукция (рыночная цена)</span>
                    <span className="font-semibold text-foreground">{fmt(marketValue)} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Привилегии и клуб</span>
                    <span className="font-semibold text-foreground">{fmt(share === 100 ? 95000 : 45000)} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Визиты и мероприятия</span>
                    <span className="font-semibold text-foreground">{fmt(share === 100 ? 76000 : 36000)} ₽</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-bold text-foreground">Итого ценность</span>
                    <span className="font-bold text-primary">
                      {fmt(marketValue + (share === 100 ? 171000 : 81000))} ₽
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparison bar chart */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{cms.getText("comparison_title", "Сравнение")}</p>
                <div className="flex items-end justify-center gap-6 h-32">
                  {/* Your costs bar */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-16 rounded-t-lg bg-muted-foreground/20 relative flex items-end justify-center"
                      style={{ height: `${Math.min(100, (totalCost / Math.max(totalCost, marketValue + (share === 100 ? 171000 : 81000))) * 100)}%` }}
                    >
                      <span className="absolute -top-6 text-xs font-bold text-foreground whitespace-nowrap">
                        {fmt(totalCost)} ₽
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-2 text-center">Ваши<br />расходы</span>
                  </div>
                  {/* Market value bar */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-16 rounded-t-lg bg-primary relative flex items-end justify-center"
                      style={{ height: "100%" }}
                    >
                      <span className="absolute -top-6 text-xs font-bold text-primary whitespace-nowrap">
                        {fmt(marketValue + (share === 100 ? 171000 : 81000))} ₽
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-2 text-center">Рыночная<br />стоимость</span>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-2">
                <Link href="/animals" className="block">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {cms.getText("cta_catalog", "Выбрать животное в каталоге")}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  onClick={async () => {
                    try {
                      const { toast } = await import("sonner");
                      toast.info("Генерация PDF...");
                      const pdfData = {
                        breedName: breedObj.name,
                        breedEmoji: breedObj.emoji,
                        sharePercent: share,
                        monthlyLiters: monthlyMilk,
                        initialPrice: ownershipCost,
                        monthlyFee: effectiveMonthly,
                        annualPayment: annualPayment ? "annual" : "monthly",
                        products: (result?.products ?? []).map((p) => ({
                          name: p.productName,
                          volume: p.outputQuantity.toFixed(1),
                          unit: p.unit,
                          marketPrice: 0,
                          value: p.marketValueRub,
                        })),
                        marketValue,
                        totalCost,
                        savingsPercent,
                        savingsAmount: savings,
                        productDistribution: Object.entries(alloc).map(([slug, pct]) => ({
                          label: PRODUCT_LABELS[slug]?.name ?? slug,
                          pct,
                        })),
                      };
                      const response = await fetch("/api/calculator/pdf", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(pdfData),
                      });
                      if (!response.ok) throw new Error("Server error");
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Шерь_Козу_Расчёт_${breedObj.name}_${share}%.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }, 100);
                      toast.success("PDF скачан!");
                    } catch (err) {
                      console.error("PDF generation error:", err);
                      const { toast } = await import("sonner");
                      toast.error("Ошибка генерации PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  {cms.getText("cta_pdf", "Скачать расчёт PDF")}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    import("sonner").then(({ toast }) => toast.success("Ссылка скопирована"));
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  {cms.getText("cta_share", "Поделиться расчётом")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}
