/**
 * AdminFaqAnalytics — Admin page for viewing FAQ chat analytics.
 *
 * Shows: daily question chart, source breakdown, recent questions table,
 * and a cleanup tool for old records.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { getLoginUrl } from "@/const";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Download,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Trash2,
  Users,
  TrendingUp,
  Globe,
  MessageCircle,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  Percent,
  Timer,
  Hash,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

/* ─── Tiny bar chart (pure CSS, no chart library needed) ─── */
function MiniBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            {d.value}
          </span>
          <div
            className="w-full rounded-t-md bg-primary/80 transition-all duration-300 min-h-[2px]"
            style={{ height: `${(d.value / maxVal) * 100}%` }}
          />
          <span className="text-[9px] text-muted-foreground truncate max-w-full">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Source badge ─── */
function SourceBadge({ source }: { source: string }) {
  const isFloating = source === "floating";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] rounded-full px-2 py-0.5",
        isFloating
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {isFloating ? (
        <>
          <MessageCircle className="h-2.5 w-2.5 mr-1" />
          Виджет
        </>
      ) : (
        <>
          <Globe className="h-2.5 w-2.5 mr-1" />
          FAQ
        </>
      )}
    </Badge>
  );
}

export default function AdminFaqAnalytics() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  const analyticsQuery = trpc.faqChat.analytics.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchInterval: 30_000, // refresh every 30s
  });

  const utils = trpc.useUtils();

  // A/B testing data
  const abTestQuery = trpc.faqChat.abTestResults.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchInterval: 30_000,
  });

  const toggleVariant = trpc.faqChat.toggleGreetingVariant.useMutation({
    onSuccess: () => {
      toast.success("Вариант обновлён");
      void utils.faqChat.abTestResults.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка", { description: err.message });
    },
  });

  const [cleanupDays, setCleanupDays] = useState("90");
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  const exportCsvQuery = trpc.faqChat.exportCsv.useQuery(undefined, {
    enabled: false, // manual fetch only
  });

  const handleExportCsv = async () => {
    setCsvLoading(true);
    try {
      const result = await exportCsvQuery.refetch();
      if (result.data?.csv) {
        const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faq-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Экспорт завершён', { description: 'Файл CSV скачан' });
      }
    } catch (err) {
      toast.error('Ошибка экспорта');
    } finally {
      setCsvLoading(false);
    }
  };

  const clearMutation = trpc.faqChat.clearOld.useMutation({
    onSuccess: (data) => {
      toast.success("Очистка завершена", { description: data.message });
      setCleanupOpen(false);
      void utils.faqChat.analytics.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка очистки", { description: err.message });
    },
  });

  // Prepare chart data from dailyStats
  const chartData = useMemo(() => {
    if (!analyticsQuery.data?.stats.dailyStats) return [];
    return analyticsQuery.data.stats.dailyStats.map((d: { date: string; count: number }) => ({
      label: new Date(d.date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      }),
      value: d.count,
    }));
  }, [analyticsQuery.data?.stats.dailyStats]);

  // Fill missing days with 0
  const fullChartData = useMemo(() => {
    const result: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      });
      const existing = chartData.find((d: { label: string; value: number }) => d.label === label);
      result.push({ label, value: existing?.value ?? 0 });
    }
    return result;
  }, [chartData]);

  // Source breakdown
  const sourceData = useMemo(() => {
    if (!analyticsQuery.data?.stats.sourceBreakdown) return [];
    return analyticsQuery.data.stats.sourceBreakdown;
  }, [analyticsQuery.data?.stats.sourceBreakdown]);

  const floatingCount =
    sourceData.find((s: { source: string; count: number }) => s.source === "floating")?.count ?? 0;
  const faqPageCount =
    sourceData.find((s: { source: string; count: number }) => s.source === "faq")?.count ?? 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка...
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
          <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Нужен вход в аккаунт</AlertTitle>
            <AlertDescription className="mt-2">
              <Button asChild className="rounded-full">
                <a href={getLoginUrl("/admin/faq-analytics")}>Войти</a>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="container max-w-4xl py-10">
          <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Доступ запрещён</AlertTitle>
            <AlertDescription>
              Эта страница доступна только администраторам.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const stats = analyticsQuery.data?.stats;
  const recent = analyticsQuery.data?.recent ?? [];

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8 space-y-6">
        <PageBreadcrumbs
          items={[
            { label: "Админ", href: "/admin" },
            { label: "FAQ Аналитика" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              FAQ Аналитика
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Статистика вопросов к AI-управляющей Маше
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full gap-2"
              disabled={csvLoading}
              onClick={handleExportCsv}
            >
              {csvLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Экспорт CSV
            </Button>
          <Dialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full gap-2">
                <Trash2 className="h-4 w-4" />
                Очистка
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Очистка старых записей</DialogTitle>
                <DialogDescription>
                  Удалить вопросы и ответы старше указанного количества дней.
                  Данные будут удалены безвозвратно.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 py-4">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Старше
                </span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">дней</span>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCleanupOpen(false)}
                  className="rounded-full"
                >
                  Отмена
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-full gap-2"
                  disabled={clearMutation.isPending}
                  onClick={() => {
                    const days = parseInt(cleanupDays, 10);
                    if (isNaN(days) || days < 1 || days > 365) {
                      toast.error("Укажите число от 1 до 365");
                      return;
                    }
                    clearMutation.mutate({ olderThanDays: days });
                  }}
                >
                  {clearMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Удалить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {analyticsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-border/70">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Всего вопросов
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {stats?.totalCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    За всё время
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    За {stats?.days ?? 30} дней
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {stats?.periodCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Вопросов за период
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Уникальных сессий
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {stats?.uniqueSessions ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    За {stats?.days ?? 30} дней
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Среднее в день
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {stats?.periodCount && stats?.days
                      ? (stats.periodCount / Math.min(stats.days, 7)).toFixed(1)
                      : "0"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Вопросов / день
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Daily chart */}
              <Card className="rounded-2xl border-border/70 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Вопросы по дням (последние 7 дней)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {fullChartData.every((d) => d.value === 0) ? (
                    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                      Нет данных за последние 7 дней
                    </div>
                  ) : (
                    <MiniBarChart data={fullChartData} />
                  )}
                </CardContent>
              </Card>

              {/* Source breakdown */}
              <Card className="rounded-2xl border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">
                    Источники вопросов
                  </CardTitle>
                  <CardDescription>За {stats?.days ?? 30} дней</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-sm">Плавающий виджет</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {floatingCount}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{
                          width: `${
                            floatingCount + faqPageCount > 0
                              ? (floatingCount /
                                  (floatingCount + faqPageCount)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="text-sm">Страница FAQ</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {faqPageCount}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${
                            floatingCount + faqPageCount > 0
                              ? (faqPageCount /
                                  (floatingCount + faqPageCount)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {floatingCount + faqPageCount === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Нет данных за период
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Questions Table */}
            <Card className="rounded-2xl border-border/70">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Последние вопросы
                </CardTitle>
                <CardDescription>
                  {recent.length} из последних записей за {stats?.days ?? 30}{" "}
                  дней
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Пока нет вопросов. Они появятся, когда пользователи начнут
                      общаться с Машей.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[30%]">Вопрос</TableHead>
                          <TableHead className="w-[40%]">Ответ Маши</TableHead>
                          <TableHead className="w-[10%]">Источник</TableHead>
                          <TableHead className="w-[20%]">Дата</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recent.map((q: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="align-top">
                              <p className="text-sm line-clamp-3">
                                {q.question}
                              </p>
                            </TableCell>
                            <TableCell className="align-top">
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {q.answer}
                              </p>
                            </TableCell>
                            <TableCell className="align-top">
                              <SourceBadge source={q.source ?? "faq"} />
                            </TableCell>
                            <TableCell className="align-top">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {q.createdAt
                                  ? new Date(q.createdAt).toLocaleString(
                                      "ru-RU",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )
                                  : "—"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* A/B Testing Section */}
            <Card className="rounded-2xl border-border/70">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  A/B Тестирование приветствий
                </CardTitle>
                <CardDescription>
                  Сравнение эффективности разных стилей приветствия Маши.
                  Всего сессий: {abTestQuery.data?.totalSessions ?? 0}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {abTestQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !abTestQuery.data?.variants?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FlaskConical className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Нет вариантов приветствий. Они будут добавлены автоматически.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Variant comparison cards */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {abTestQuery.data.variants.map((v: any) => (
                        <div
                          key={v.variantKey}
                          className={cn(
                            "rounded-xl border p-4 space-y-3 transition-colors",
                            v.isActive
                              ? "border-primary/30 bg-primary/5"
                              : "border-border/60 bg-muted/30 opacity-60"
                          )}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={v.isActive ? "default" : "outline"}
                                className="text-[10px] rounded-full"
                              >
                                {v.variantKey}
                              </Badge>
                              {v.responseRate > 0 && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] rounded-full",
                                    v.responseRate >= 70
                                      ? "border-green-200 bg-green-50 text-green-700"
                                      : v.responseRate >= 40
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-red-200 bg-red-50 text-red-700"
                                  )}
                                >
                                  <Percent className="h-2.5 w-2.5 mr-0.5" />
                                  {v.responseRate}% отклик
                                </Badge>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                toggleVariant.mutate({
                                  variantKey: v.variantKey,
                                  isActive: !v.isActive,
                                })
                              }
                              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={v.isActive ? "Отключить" : "Включить"}
                            >
                              {v.isActive ? (
                                <ToggleRight className="h-5 w-5 text-primary" />
                              ) : (
                                <ToggleLeft className="h-5 w-5" />
                              )}
                            </button>
                          </div>

                          {/* Description */}
                          {v.description && (
                            <p className="text-xs text-muted-foreground">
                              {v.description}
                            </p>
                          )}

                          {/* Greeting preview */}
                          <div className="rounded-lg bg-background/80 border border-border/40 p-2.5">
                            <p className="text-xs text-foreground/80 line-clamp-3">
                              {v.greetingText}
                            </p>
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-background/60 p-2">
                              <p className="text-lg font-bold text-foreground">
                                {v.totalSessions}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Users className="h-2.5 w-2.5" />
                                Сессий
                              </p>
                            </div>
                            <div className="rounded-lg bg-background/60 p-2">
                              <p className="text-lg font-bold text-foreground">
                                {v.avgMessageCount}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Hash className="h-2.5 w-2.5" />
                                Ср. сообщ.
                              </p>
                            </div>
                            <div className="rounded-lg bg-background/60 p-2">
                              <p className="text-lg font-bold text-foreground">
                                {v.avgDuration > 60
                                  ? `${Math.round(v.avgDuration / 60)}м`
                                  : `${v.avgDuration}с`}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Timer className="h-2.5 w-2.5" />
                                Ср. время
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    {abTestQuery.data.variants.length > 1 && (
                      <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/40">
                        {(() => {
                          const best = [...abTestQuery.data.variants]
                            .filter((v: any) => v.totalSessions > 0)
                            .sort((a: any, b: any) => b.responseRate - a.responseRate)[0];
                          if (!best || best.totalSessions < 3) {
                            return "Недостаточно данных для определения лидера. Нужно минимум 3 сессии на вариант.";
                          }
                          return `Лидер: «${best.variantKey}» с откликом ${best.responseRate}% и средним ${best.avgMessageCount} сообщений за сессию.`;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer note */}
            <p className="text-xs text-muted-foreground text-center">
              Данные обновляются автоматически каждые 30 секунд. Записи старше 30
              дней можно удалить через кнопку «Очистка».
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
