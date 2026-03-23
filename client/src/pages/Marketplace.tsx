import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Coins,
  Gift,
  Heart,
  Loader2,
  ShoppingBag,
  Sparkles,
  Star,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import ShowMoreList from "@/components/ShowMoreList";
import ScrollRemaining from "@/components/ScrollRemaining";

type MetricEffect = {
  happiness?: number;
  health?: number;
  attachment?: number;
  mood?: number;
  obedience?: number;
};

const metricLabels: Record<string, { label: string; emoji: string; color: string }> = {
  happiness: { label: "Счастье", emoji: "😊", color: "text-yellow-600" },
  health: { label: "Здоровье", emoji: "💚", color: "text-emerald-600" },
  attachment: { label: "Привязанность", emoji: "🤝", color: "text-rose-500" },
  mood: { label: "Настроение", emoji: "🌈", color: "text-blue-500" },
  obedience: { label: "Послушание", emoji: "🎓", color: "text-purple-600" },
};

export default function Marketplace() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<any>(null);
  const [purchaseAnimalId, setPurchaseAnimalId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastPurchasedItem, setLastPurchasedItem] = useState<any>(null);

  // Queries
  const categoriesQuery = trpc.gamification.categories.list.useQuery();
  const itemsQuery = trpc.gamification.items.list.useQuery(
    { categoryId: selectedCategory ?? undefined },
  );
  const balanceQuery = trpc.gamification.wallet.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const dashboardQuery = trpc.animals.ownerDashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Mutation
  const purchase = trpc.gamification.purchase.useMutation({
    onSuccess: (data: any) => {
      setLastPurchasedItem(purchaseItem);
      setPurchaseItem(null);
      setShowSuccess(true);
      toast.success("Подарок отправлен!");
      utils.gamification.wallet.balance.invalidate();
      utils.gamification.items.list.invalidate();
      utils.gamification.wellness.get.invalidate();
      utils.gamification.wallet.transactions.invalidate();
      utils.gamification.wallet.purchaseHistory.invalidate();
      utils.animals.ownerDashboard.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const balance = balanceQuery.data?.balanceSKC ?? 0;
  const animals = (dashboardQuery.data as any)?.allOwnerships ?? [];

  // Auto-select first animal if only one
  useMemo(() => {
    if (animals.length === 1 && !purchaseAnimalId) {
      setPurchaseAnimalId(animals[0].animalId);
    }
  }, [animals, purchaseAnimalId]);

  const handlePurchase = () => {
    if (!purchaseItem || !purchaseAnimalId) return;
    purchase.mutate({ itemId: purchaseItem.id, animalId: purchaseAnimalId });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--forest-green-pale)] via-white to-[var(--amber-light)] opacity-60" />
        <div className="container relative py-16 md:py-20">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-[var(--forest-green)] text-white">
              <Gift className="h-3 w-3 mr-1" /> Маркетплейс фермы
            </Badge>
            <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-tight mb-4">
              Позаботьтесь о вашем <span className="text-[var(--forest-green)]">питомце</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Выбирайте угощения, спа-процедуры, прогулки и подарки. Каждая покупка улучшает самочувствие вашего животного и укрепляет вашу связь.
            </p>
            {isAuthenticated && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border shadow-sm">
                  <Coins className="h-5 w-5 text-amber-500" />
                  <span className="font-bold text-lg">{balance.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">SKC</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container py-8">
        {!isAuthenticated ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="font-semibold mb-2">Войдите, чтобы делать покупки</h3>
              <p className="text-sm text-muted-foreground mb-4">Маркетплейс доступен владельцам животных</p>
              <a href={getLoginUrl()}>
                <Button>Войти</Button>
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Categories Sidebar */}
            <div className="lg:col-span-1">
              <ScrollRemaining totalItems={categories.length + 1} itemHeight={40} className="sticky top-24 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">Категории</h3>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === null ? "bg-[var(--forest-green)] text-white font-medium" : "hover:bg-muted"
                  }`}
                >
                  🏪 Все товары
                </button>
                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat.id ? "bg-[var(--forest-green)] text-white font-medium" : "hover:bg-muted"
                    }`}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </ScrollRemaining>
            </div>

            {/* Items Grid */}
            <div className="lg:col-span-3">
              {itemsQuery.isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                    <h3 className="font-semibold mb-2">Товаров пока нет</h3>
                    <p className="text-sm text-muted-foreground">Администратор скоро добавит товары в маркетплейс</p>
                  </CardContent>
                </Card>
              ) : (
                <ShowMoreList
                  items={items}
                  pageSize={9}
                  getKey={(item: any) => item.id}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                  buttonLabel="Показать ещё товаров"
                  renderItem={(item: any) => {
                    const effects: MetricEffect = item.metricEffects ? (typeof item.metricEffects === "string" ? JSON.parse(item.metricEffects) : item.metricEffects) : {};
                    const effectEntries = Object.entries(effects).filter(([, v]) => (v as number) > 0);
                    const canAfford = balance >= item.priceSKC;
                    const isUnlimited = item.stock === null || item.stock === -1;
                    const inStock = isUnlimited || item.stock > 0;

                    return (
                      <Card
                        className={`group relative overflow-hidden transition-all hover:shadow-lg ${!inStock ? "opacity-60" : ""}`}
                      >
                        <CardContent className="p-5">
                          {/* Item Header */}
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl">{item.emoji || "🎁"}</span>
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <Coins className="h-3.5 w-3.5 text-amber-500" />
                                <span className="font-bold text-lg">{item.priceSKC}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">SKC</span>
                            </div>
                          </div>

                          {/* Item Info */}
                          <h4 className="font-semibold text-sm mb-1">{item.name}</h4>
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>

                          {/* Effects */}
                          {effectEntries.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {effectEntries.map(([key, val]) => {
                                const meta = metricLabels[key];
                                if (!meta) return null;
                                return (
                                  <Badge key={key} variant="secondary" className="text-[10px] gap-0.5">
                                    {meta.emoji} +{val as number}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}

                          {/* Stock & Season */}
                          <div className="flex items-center gap-2 mb-3">
                            {!isUnlimited && item.stock !== null && (
                              <span className="text-[10px] text-muted-foreground">
                                {inStock ? `Осталось: ${item.stock}` : "Нет в наличии"}
                              </span>
                            )}
                            {item.isSeasonal === 1 && (
                              <Badge variant="outline" className="text-[10px]">
                                <Clock className="h-2.5 w-2.5 mr-0.5" /> Сезонный
                              </Badge>
                            )}
                          </div>

                          {/* Buy Button */}
                          <Button
                            className="w-full"
                            size="sm"
                            disabled={!canAfford || !inStock}
                            onClick={() => {
                              setPurchaseItem(item);
                              if (animals.length === 1) {
                                setPurchaseAnimalId(animals[0].animalId);
                              }
                            }}
                          >
                            {!inStock ? "Нет в наличии" : !canAfford ? "Недостаточно SKC" : (
                              <>
                                <Gift className="h-3.5 w-3.5 mr-1" /> Подарить
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={!!purchaseItem} onOpenChange={() => setPurchaseItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{purchaseItem?.emoji || "🎁"}</span>
              {purchaseItem?.name}
            </DialogTitle>
            <DialogDescription>{purchaseItem?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Select Animal */}
            {animals.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Для какого животного?</label>
                <div className="grid grid-cols-2 gap-2">
                  {animals.map((a: any) => (
                    <button
                      key={a.animalId}
                      onClick={() => setPurchaseAnimalId(a.animalId)}
                      className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                        purchaseAnimalId === a.animalId
                          ? "border-[var(--forest-green)] bg-[var(--forest-green-pale)]"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{a.animalName}</span>
                      <span className="text-xs text-muted-foreground block">{a.animalSpecies}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price Summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm">Стоимость:</span>
              <div className="flex items-center gap-1">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="font-bold">{purchaseItem?.priceSKC} SKC</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm">Ваш баланс после:</span>
              <span className="font-bold text-sm">{balance - (purchaseItem?.priceSKC ?? 0)} SKC</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseItem(null)}>Отмена</Button>
            <Button
              onClick={handlePurchase}
              disabled={purchase.isPending || !purchaseAnimalId}
            >
              {purchase.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Gift className="h-4 w-4 mr-2" />
              )}
              Подарить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>Подарок отправлен</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">Подарок отправлен!</h3>
            <p className="text-sm text-muted-foreground mb-1">
              {lastPurchasedItem?.emoji} {lastPurchasedItem?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Метрики вашего животного обновлены. Фермер получит задание.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={() => setShowSuccess(false)} className="w-full">
              Продолжить покупки
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full" onClick={() => setShowSuccess(false)}>
                <ArrowRight className="h-4 w-4 mr-2" /> В кабинет
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
