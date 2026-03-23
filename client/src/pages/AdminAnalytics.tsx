import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  BarChart3,
  Coins,
  Heart,
  Loader2,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import ScrollRemaining from "@/components/ScrollRemaining";

export default function AdminAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("tokens");

  const tokensQuery = trpc.gamification.analytics.tokens.useQuery(undefined, { enabled: isAdmin });
  const marketplaceQuery = trpc.gamification.analytics.marketplace.useQuery(undefined, { enabled: isAdmin });
  const herdQuery = trpc.gamification.analytics.herdWellness.useQuery(undefined, { enabled: isAdmin });

  const tokenData = tokensQuery.data;
  const marketData = marketplaceQuery.data;
  const herdData = herdQuery.data;
  const isLoadingAny = tokensQuery.isLoading || marketplaceQuery.isLoading || herdQuery.isLoading;

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Аналитика «Забота»</h1>
              <p className="text-sm text-muted-foreground">Обзор экономики, продаж и активности</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Аналитика
          </Badge>
        </div>

        {isLoadingAny ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">Банк</span>
                  </div>
                  <p className="text-xl font-bold">{(tokenData?.bankBalance ?? 0).toLocaleString()} SKC</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">Выручка</span>
                  </div>
                  <p className="text-xl font-bold">{(tokenData?.revenueBalance ?? 0).toLocaleString()} SKC</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Покупок</span>
                  </div>
                  <p className="text-xl font-bold">{(marketData?.totalPurchases ?? 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">Владельцев</span>
                  </div>
                  <p className="text-xl font-bold">{tokenData?.tokensInCirculation ?? 0}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tokens">Токены</TabsTrigger>
                <TabsTrigger value="sales">Продажи</TabsTrigger>
                <TabsTrigger value="wellness">Стадо</TabsTrigger>
              </TabsList>

              {/* ─── Token Economy ─── */}
              <TabsContent value="tokens" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Оборот токенов</CardTitle>
                    <CardDescription>Распределение по типам транзакций</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tokenData?.recentVolume && Array.isArray(tokenData.recentVolume) && tokenData.recentVolume.length > 0 ? (
                      <ScrollRemaining totalItems={tokenData.recentVolume.length} itemHeight={48} className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {tokenData.recentVolume.map((item: any, i: number) => {
                          const colors = ["bg-emerald-500", "bg-amber-500", "bg-blue-500", "bg-purple-500", "bg-gray-500"];
                          const maxAmount = Math.max(...tokenData.recentVolume.map((t: any) => t.total ?? 0));
                          const pct = maxAmount > 0 ? ((item.total ?? 0) / maxAmount) * 100 : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{item.type ?? `Тип ${i}`}</span>
                                <span className="text-sm text-muted-foreground">{(item.total ?? 0).toLocaleString()} SKC</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </ScrollRemaining>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Нет данных о транзакциях</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Sales ─── */}
              <TabsContent value="sales" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Топ товаров</CardTitle>
                      <CardDescription>По количеству покупок</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {marketData?.topItems && marketData.topItems.length > 0 ? (
                      <ScrollRemaining totalItems={marketData.topItems.length} itemHeight={40} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {marketData.topItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                                <span className="text-sm">{item.emoji} {item.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium">{item.count} шт.</span>
                                <span className="text-xs text-muted-foreground ml-2">{item.totalSKC} SKC</span>
                              </div>
                            </div>
                          ))}
                        </ScrollRemaining>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Нет покупок</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">По категориям</CardTitle>
                      <CardDescription>Распределение продаж</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {marketData?.categorySales && marketData.categorySales.length > 0 ? (
                      <ScrollRemaining totalItems={marketData.categorySales.length} itemHeight={40} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {marketData.categorySales.map((cat: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                              <span className="text-sm">{cat.emoji} {cat.name}</span>
                              <div className="text-right">
                                <span className="text-sm font-medium">{cat.count} шт.</span>
                                <span className="text-xs text-muted-foreground ml-2">{cat.totalSKC} SKC</span>
                              </div>
                            </div>
                          ))}
                        </ScrollRemaining>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Top Buyers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Топ покупателей</CardTitle>
                    <CardDescription>Самые активные владельцы</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {marketData?.topOwners && marketData.topOwners.length > 0 ? (
                      <ScrollRemaining totalItems={marketData.topOwners.length} itemHeight={40} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {marketData.topOwners.map((buyer: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </div>
                              <span className="text-sm">{buyer.name || buyer.openId}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium">{buyer.totalSpent} SKC</span>
                              <span className="text-xs text-muted-foreground ml-2">({buyer.purchaseCount} покупок)</span>
                            </div>
                          </div>
                        ))}
                      </ScrollRemaining>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Herd Wellness ─── */}
              <TabsContent value="wellness" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4 text-rose-500" /> Средние метрики стада
                    </CardTitle>
                    <CardDescription>Агрегированные показатели здоровья и благополучия</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {herdData ? (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          { label: "Счастье", value: herdData.avgHappiness, emoji: "😊" },
                          { label: "Здоровье", value: herdData.avgHealth, emoji: "💚" },
                          { label: "Привязанность", value: herdData.avgAttachment, emoji: "🤝" },
                          { label: "Настроение", value: herdData.avgMood, emoji: "🌈" },
                          { label: "Послушание", value: herdData.avgObedience, emoji: "🎓" },
                        ].map((metric) => {
                          const val = Math.round(metric.value ?? 0);
                          const color = val >= 70 ? "text-emerald-600" : val >= 40 ? "text-amber-600" : "text-rose-600";
                          return (
                            <div key={metric.label} className="text-center">
                              <span className="text-2xl">{metric.emoji}</span>
                              <p className={`text-xl font-bold ${color}`}>{val}</p>
                              <p className="text-xs text-muted-foreground">{metric.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Нет данных о метриках</p>
                    )}
                  </CardContent>
                </Card>

                {/* Herd Leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Рейтинг стада</CardTitle>
                    <CardDescription>Топ животных по общему рейтингу</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {false ? (
                      <div className="space-y-2">
                        {([] as any[]).map((animal: any, i: number) => {
                          const rating = Math.round(animal.overallRating ?? 0);
                          const color = rating >= 70 ? "bg-emerald-100 text-emerald-700" : rating >= 40 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
                          return (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                  {i + 1}
                                </div>
                                <span className="text-sm">{animal.name}</span>
                                <span className="text-xs text-muted-foreground">{animal.species}</span>
                              </div>
                              <Badge className={color}>{rating} pts</Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
