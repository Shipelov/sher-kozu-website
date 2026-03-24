/**
 * AdminFaqAnalytics — Admin page for viewing FAQ chat analytics.
 *
 * Shows: daily question chart, source breakdown, recent questions table,
 * CSV export with filters, A/B testing management, and uncertain answers history.
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
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
  AlertTriangle,
  X,
  Undo2,
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
    refetchInterval: 30_000,
  });

  const utils = trpc.useUtils();

  // A/B testing data
  const abTestQuery = trpc.faqChat.abTestResults.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchInterval: 30_000,
  });

  // Uncertain answers data
  const [uncertainFilter, setUncertainFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const uncertainQuery = trpc.faqChat.uncertainAnswersList.useQuery(
    {
      resolved: uncertainFilter === "all" ? undefined : uncertainFilter === "resolved",
    },
    {
      enabled: isAdmin,
      retry: false,
      refetchInterval: 30_000,
    }
  );

  const toggleVariant = trpc.faqChat.toggleGreetingVariant.useMutation({
    onSuccess: () => {
      toast.success("Вариант обновлён");
      void utils.faqChat.abTestResults.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка", { description: err.message });
    },
  });

  const upsertVariant = trpc.faqChat.upsertGreetingVariant.useMutation({
    onSuccess: () => {
      toast.success("Вариант сохранён");
      void utils.faqChat.abTestResults.invalidate();
      setVariantDialogOpen(false);
      resetVariantForm();
    },
    onError: (err) => {
      toast.error("Ошибка", { description: err.message });
    },
  });

  const deleteVariant = trpc.faqChat.deleteGreetingVariant.useMutation({
    onSuccess: () => {
      toast.success("Вариант удалён");
      void utils.faqChat.abTestResults.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка", { description: err.message });
    },
  });

  const resolveUncertain = trpc.faqChat.resolveUncertainAnswer.useMutation({
    onSuccess: () => {
      toast.success("Статус обновлён");
      void utils.faqChat.uncertainAnswersList.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка", { description: err.message });
    },
  });

  const deleteUncertain = trpc.faqChat.deleteUncertainAnswer.useMutation({
    onSuccess: () => {
      toast.success("Запись удалена");
      void utils.faqChat.uncertainAnswersList.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка", { description: err.message });
    },
  });

  // State for variant creation/editing dialog
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [variantForm, setVariantForm] = useState({
    variantKey: "",
    greetingText: "",
    description: "",
  });

  const resetVariantForm = () => {
    setVariantForm({ variantKey: "", greetingText: "", description: "" });
    setEditingVariant(null);
  };

  const openCreateVariant = () => {
    resetVariantForm();
    setVariantDialogOpen(true);
  };

  const openEditVariant = (v: any) => {
    setEditingVariant(v.variantKey);
    setVariantForm({
      variantKey: v.variantKey,
      greetingText: v.greetingText,
      description: v.description || "",
    });
    setVariantDialogOpen(true);
  };

  // State for uncertain answer note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<{ id: number; question: string } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  // State for CSV filters
  const [csvDateFrom, setCsvDateFrom] = useState("");
  const [csvDateTo, setCsvDateTo] = useState("");
  const [csvSource, setCsvSource] = useState<"all" | "faq" | "floating">("all");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvFiltersOpen, setCsvFiltersOpen] = useState(false);

  const csvFilterInput = useMemo(() => {
    const input: { dateFrom?: string; dateTo?: string; source?: "all" | "faq" | "floating" } = {};
    if (csvDateFrom) input.dateFrom = csvDateFrom;
    if (csvDateTo) input.dateTo = csvDateTo;
    if (csvSource !== "all") input.source = csvSource;
    return Object.keys(input).length > 0 ? input : undefined;
  }, [csvDateFrom, csvDateTo, csvSource]);

  const exportCsvQuery = trpc.faqChat.exportCsv.useQuery(csvFilterInput, {
    enabled: false,
  });

  const handleExportCsv = async () => {
    setCsvLoading(true);
    try {
      const result = await exportCsvQuery.refetch();
      if (result.data?.csv) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const suffix = csvDateFrom || csvDateTo ? `_${csvDateFrom || "start"}_${csvDateTo || "end"}` : "";
        a.download = `faq-analytics${suffix}-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Экспорт завершён", { description: "Файл CSV скачан" });
      }
    } catch (err) {
      toast.error("Ошибка экспорта");
    } finally {
      setCsvLoading(false);
    }
  };

  const hasActiveFilters = csvDateFrom || csvDateTo || csvSource !== "all";

  const [cleanupDays, setCleanupDays] = useState("90");
  const [cleanupOpen, setCleanupOpen] = useState(false);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              FAQ Аналитика
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Статистика вопросов к AI-управляющей Маше
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* CSV Export with Filters */}
            <div className="flex items-center gap-1">
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
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-[9px] rounded-full ml-1 px-1.5">
                    <Filter className="h-2.5 w-2.5" />
                  </Badge>
                )}
              </Button>
              <Button
                variant={csvFiltersOpen ? "secondary" : "outline"}
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={() => setCsvFiltersOpen(!csvFiltersOpen)}
                title="Фильтры экспорта"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* CSV Filter Panel (collapsible) */}
        {csvFiltersOpen && (
          <Card className="rounded-2xl border-primary/20 bg-primary/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Дата от</label>
                  <Input
                    type="date"
                    value={csvDateFrom}
                    onChange={(e) => setCsvDateFrom(e.target.value)}
                    className="w-40 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Дата до</label>
                  <Input
                    type="date"
                    value={csvDateTo}
                    onChange={(e) => setCsvDateTo(e.target.value)}
                    className="w-40 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Источник</label>
                  <Select value={csvSource} onValueChange={(v) => setCsvSource(v as "all" | "faq" | "floating")}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все источники</SelectItem>
                      <SelectItem value="floating">Виджет</SelectItem>
                      <SelectItem value="faq">Страница FAQ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full gap-1 text-xs"
                    onClick={() => {
                      setCsvDateFrom("");
                      setCsvDateTo("");
                      setCsvSource("all");
                    }}
                  >
                    <X className="h-3 w-3" />
                    Сбросить
                  </Button>
                )}
              </div>
              {hasActiveFilters && (
                <p className="text-xs text-muted-foreground mt-3">
                  Фильтры применяются к экспорту CSV. Нажмите «Экспорт CSV» для скачивания отфильтрованных данных.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Последние вопросы
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {recent.length} записей за {stats?.days ?? 30} дней
                    </CardDescription>
                  </div>
                  {recent.length > 0 && (
                    <Dialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full gap-1.5 text-xs border-red-200 hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Очистить
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Очистка старых записей</DialogTitle>
                          <DialogDescription>
                            Удалить вопросы старше указанного количества дней. Это действие необратимо.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-2">
                          <label className="text-sm font-medium">Удалить записи старше (дней)</label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={cleanupDays}
                            onChange={(e) => setCleanupDays(e.target.value)}
                            className="w-32"
                          />
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
                              const days = parseInt(cleanupDays);
                              if (isNaN(days) || days < 1) {
                                toast.error("Укажите корректное количество дней");
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
                  )}
                </div>
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
                    <div className="max-h-[480px] overflow-y-auto">
                      <table className="w-full caption-bottom text-sm">
                        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm [&_tr]:border-b">
                          <tr className="border-b transition-colors">
                            <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[30%]">Вопрос</th>
                            <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[40%]">Ответ Маши</th>
                            <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[10%]">Источник</th>
                            <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[20%]">Дата</th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                          {recent.map((q: any, i: number) => (
                            <tr key={i} className="border-b transition-colors hover:bg-muted/20">
                              <td className="p-2 align-top">
                                <p className="text-sm line-clamp-3">
                                  {q.question}
                                </p>
                              </td>
                              <td className="p-2 align-top">
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                  {q.answer}
                                </p>
                              </td>
                              <td className="p-2 align-top">
                                <SourceBadge source={q.source ?? "faq"} />
                              </td>
                              <td className="p-2 align-top">
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {recent.length >= 5 && (
                      <div className="border-t border-border/40 px-4 py-2 bg-muted/10">
                        <p className="text-[11px] text-muted-foreground text-center">
                          Показано {recent.length} записей • Прокрутите таблицу вниз для просмотра всех
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ Uncertain Answers Section ═══ */}
            <Card className="rounded-2xl border-amber-200/50 bg-amber-50/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Неуверенные ответы Маши
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {uncertainQuery.data && (
                        <>Нерешённых: <span className="font-semibold text-amber-600">{uncertainQuery.data.unresolvedCount}</span> из {uncertainQuery.data.totalCount}</>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["unresolved", "all", "resolved"] as const).map((f) => (
                      <Button
                        key={f}
                        variant={uncertainFilter === f ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-full text-xs h-7 px-3"
                        onClick={() => setUncertainFilter(f)}
                      >
                        {f === "unresolved" ? "Открытые" : f === "resolved" ? "Решённые" : "Все"}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {uncertainQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  </div>
                ) : !uncertainQuery.data?.items?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-400/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {uncertainFilter === "unresolved"
                        ? "Нет нерешённых вопросов. Маша справляется отлично!"
                        : "Нет записей по выбранному фильтру."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {uncertainQuery.data.items.map((item: any) => (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-2 transition-colors",
                          item.resolved
                            ? "border-green-200/50 bg-green-50/30"
                            : "border-amber-200/50 bg-amber-50/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] rounded-full",
                                  item.resolved
                                    ? "border-green-200 bg-green-50 text-green-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                )}
                              >
                                {item.resolved ? (
                                  <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Решено</>
                                ) : (
                                  <><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Открыто</>
                                )}
                              </Badge>
                              <SourceBadge source={item.source} />
                              <span className="text-[10px] text-muted-foreground">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleString("ru-RU", {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {item.question}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              {item.answer}
                            </p>
                            {item.adminNote && (
                              <div className="rounded-lg bg-background/80 border border-border/40 p-2 mt-1">
                                <p className="text-xs text-foreground/70">
                                  <span className="font-medium">Заметка:</span> {item.adminNote}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            {!item.resolved ? (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full border-green-200 hover:bg-green-50"
                                title="Отметить как решённое"
                                onClick={() => {
                                  setNoteTarget({ id: item.id, question: item.question });
                                  setAdminNote("");
                                  setNoteDialogOpen(true);
                                }}
                              >
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                title="Вернуть в открытые"
                                onClick={() =>
                                  resolveUncertain.mutate({
                                    id: item.id,
                                    resolved: false,
                                  })
                                }
                              >
                                <Undo2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-full border-red-200 hover:bg-red-50"
                              title="Удалить"
                              onClick={() => deleteUncertain.mutate({ id: item.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resolve Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Отметить как решённое</DialogTitle>
                  <DialogDescription>
                    {noteTarget?.question && (
                      <span className="line-clamp-2">Вопрос: «{noteTarget.question}»</span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <label className="text-sm font-medium">Заметка (необязательно)</label>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Например: добавлено в базу знаний Маши, раздел «Доставка»"
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setNoteDialogOpen(false)}
                    className="rounded-full"
                  >
                    Отмена
                  </Button>
                  <Button
                    className="rounded-full gap-2"
                    disabled={resolveUncertain.isPending}
                    onClick={() => {
                      if (noteTarget) {
                        resolveUncertain.mutate({
                          id: noteTarget.id,
                          resolved: true,
                          adminNote: adminNote || undefined,
                        });
                        setNoteDialogOpen(false);
                      }
                    }}
                  >
                    {resolveUncertain.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <Check className="h-4 w-4" />
                    Решено
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* ═══ A/B Testing Section ═══ */}
            <Card className="rounded-2xl border-border/70">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      A/B Тестирование приветствий
                    </CardTitle>
                    <CardDescription>Сессий: {abTestQuery.data?.totalSessions ?? 0}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={openCreateVariant}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Новый вариант
                  </Button>
                </div>
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
                      Нет вариантов приветствий. Нажмите «Новый вариант» для создания.
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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditVariant(v)}
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5"
                                title="Редактировать"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  toggleVariant.mutate({
                                    variantKey: v.variantKey,
                                    isActive: !v.isActive,
                                  })
                                }
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5"
                                title={v.isActive ? "Отключить" : "Включить"}
                              >
                                {v.isActive ? (
                                  <ToggleRight className="h-5 w-5 text-primary" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Удалить вариант «${v.variantKey}»?`)) {
                                    deleteVariant.mutate({ variantKey: v.variantKey });
                                  }
                                }}
                                className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer p-0.5"
                                title="Удалить"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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

            {/* Create/Edit Variant Dialog */}
            <Dialog open={variantDialogOpen} onOpenChange={(open) => {
              setVariantDialogOpen(open);
              if (!open) resetVariantForm();
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingVariant ? "Редактировать вариант" : "Новый вариант приветствия"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingVariant
                      ? "Измените текст приветствия или описание варианта."
                      : "Создайте новый вариант приветствия для A/B тестирования."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ключ варианта</label>
                    <Input
                      value={variantForm.variantKey}
                      onChange={(e) =>
                        setVariantForm((f) => ({ ...f, variantKey: e.target.value }))
                      }
                      placeholder="Например: warm_v2, playful_v1"
                      disabled={!!editingVariant}
                      maxLength={64}
                    />
                    {!editingVariant && (
                      <p className="text-[10px] text-muted-foreground">
                        Уникальный идентификатор. Нельзя изменить после создания.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Текст приветствия</label>
                    <Textarea
                      value={variantForm.greetingText}
                      onChange={(e) =>
                        setVariantForm((f) => ({ ...f, greetingText: e.target.value }))
                      }
                      placeholder="Привет! 🌿 Я Маша, управляющая фермой..."
                      rows={4}
                      maxLength={2000}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Описание (необязательно)</label>
                    <Input
                      value={variantForm.description}
                      onChange={(e) =>
                        setVariantForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="Например: Тёплый и дружеский стиль"
                      maxLength={255}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVariantDialogOpen(false);
                      resetVariantForm();
                    }}
                    className="rounded-full"
                  >
                    Отмена
                  </Button>
                  <Button
                    className="rounded-full gap-2"
                    disabled={
                      upsertVariant.isPending ||
                      !variantForm.variantKey.trim() ||
                      !variantForm.greetingText.trim()
                    }
                    onClick={() => {
                      upsertVariant.mutate({
                        variantKey: variantForm.variantKey.trim(),
                        greetingText: variantForm.greetingText.trim(),
                        description: variantForm.description.trim() || undefined,
                      });
                    }}
                  >
                    {upsertVariant.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {editingVariant ? "Сохранить" : "Создать"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
