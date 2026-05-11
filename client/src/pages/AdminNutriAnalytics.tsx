/**
 * AdminNutriAnalytics — Nutrition (Zoya) Analytics Dashboard
 *
 * Tabs:
 * 1. Обзор — KPI cards + chat trend chart
 * 2. Пользователи — user type breakdown, engagement
 * 3. Контент — knowledge base, recipes, meal plans
 * 4. Шеринг — shared content analytics
 * 5. Вопросы — recent user questions (topic cloud)
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { fmtNum } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Brain,
  Download,
  Eye,
  Heart,
  Leaf,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Utensils,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import ScrollRemaining from "@/components/ScrollRemaining";

/* ─── Chart colors ─── */

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

const USER_TYPE_COLORS: Record<string, string> = {
  guest: "#94a3b8",
  registered: "#3b82f6",
  owner: "#10b981",
};

const USER_TYPE_LABELS: Record<string, string> = {
  guest: "Гости",
  registered: "Зарегистрированные",
  owner: "Владельцы",
};

const CATEGORY_LABELS: Record<string, string> = {
  nutrition_science: "Наука о питании",
  breed_profile: "Профили пород",
  product_info: "Информация о продуктах",
  recipe: "Рецепты",
  health_goal: "Цели здоровья",
  general: "Общее",
};

/* ─── CSV export helper ─── */

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => `"${String(row[h] ?? "")}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

/* ─── Metric Card ─── */

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        {trend && (
          <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─── */

export default function AdminNutriAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [days, setDays] = useState("30");
  const [activeTab, setActiveTab] = useState("overview");

  const daysNum = parseInt(days, 10);

  const { data, isLoading } = trpc.nutritionist.analyticsExtended.useQuery(
    { days: daysNum },
    { enabled: isAdmin }
  );

  /* ─── Derived data ─── */

  const userTypePieData = useMemo(() => {
    if (!data?.userTypeBreakdown) return [];
    return data.userTypeBreakdown.map((item: { userType: string; count: number }) => ({
      name: USER_TYPE_LABELS[item.userType] || item.userType,
      value: Number(item.count),
      fill: USER_TYPE_COLORS[item.userType] || "#94a3b8",
    }));
  }, [data?.userTypeBreakdown]);

  const chatTrendData = useMemo(() => {
    if (!data?.chatTrend) return [];
    return (data.chatTrend as Array<{ day: string; sessions: number; messages: number }>).map((row) => ({
      date: row.day,
      sessions: Number(row.sessions),
      messages: Number(row.messages),
    }));
  }, [data?.chatTrend]);

  const knowledgePieData = useMemo(() => {
    if (!data?.knowledgeByCategory) return [];
    return data.knowledgeByCategory.map((item: { category: string; count: number }, i: number) => ({
      name: CATEGORY_LABELS[item.category] || item.category,
      value: Number(item.count),
      fill: COLORS[i % COLORS.length],
    }));
  }, [data?.knowledgeByCategory]);

  /* ─── Topic frequency from recent questions ─── */
  const topicFrequency = useMemo(() => {
    if (!data?.recentQuestions?.length) return [];
    const keywords: Record<string, number> = {};
    const stopWords = new Set([
      "и", "в", "на", "с", "для", "что", "как", "это", "не", "а", "о", "из", "по", "к",
      "от", "за", "у", "до", "мне", "мой", "моя", "моё", "мои", "ли", "же", "бы", "то",
      "я", "ты", "он", "она", "мы", "вы", "они", "его", "её", "их", "нас", "вас",
      "можно", "нужно", "есть", "будет", "какие", "какой", "какая", "какое",
      "чем", "чего", "кто", "где", "когда", "почему", "зачем", "очень",
    ]);

    for (const q of data.recentQuestions) {
      const words = (q as string)
        .toLowerCase()
        .replace(/[^\wа-яё\s]/gi, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !stopWords.has(w));
      for (const w of words) {
        keywords[w] = (keywords[w] || 0) + 1;
      }
    }

    return Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([word, count]) => ({ word, count }));
  }, [data?.recentQuestions]);

  /* ─── Auth guard ─── */

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
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Доступ только для администратора
            </CardContent>
          </Card>
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
            { label: "Аналитика нутрициологии" },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Leaf className="h-6 w-6 text-emerald-600" />
              Аналитика нутрициологии
            </h1>
            <p className="text-sm text-muted-foreground">
              Зоя AI — чат-сессии, вовлечённость, контент и шеринг
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
                <SelectItem value="90">90 дней</SelectItem>
                <SelectItem value="365">Год</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (data) {
                  const exportData = [
                    {
                      metric: "Сессии",
                      value: data.sessions,
                      period: `${daysNum} дней`,
                    },
                    { metric: "Сообщения", value: data.messages, period: `${daysNum} дней` },
                    { metric: "Ср. сообщ./сессию", value: data.avgMessagesPerSession, period: `${daysNum} дней` },
                    { metric: "Профили", value: data.totalProfiles, period: "всего" },
                    { metric: "Планы питания", value: data.mealPlansCreated, period: `${daysNum} дней` },
                    { metric: "Рецепты (активные)", value: data.activeRecipes, period: "всего" },
                    { metric: "Шеринги", value: data.sharesCreated, period: `${daysNum} дней` },
                    { metric: "Просмотры шерингов", value: data.totalShareViews, period: `${daysNum} дней` },
                    { metric: "Гости", value: data.guestSessions, period: `${daysNum} дней` },
                    { metric: "Зарегистрированные", value: data.registeredSessions, period: `${daysNum} дней` },
                    { metric: "Владельцы", value: data.ownerSessions, period: `${daysNum} дней` },
                    { metric: "База знаний", value: data.activeKnowledgeEntries, period: "всего" },
                  ];
                  downloadCsv(exportData, `nutri-analytics-${daysNum}d.csv`);
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Нет данных за выбранный период
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Чат-сессии"
                value={Number(data.sessions).toLocaleString()}
                icon={<MessageCircle className="h-4 w-4" />}
                subtitle={`${Number(data.userMessages).toLocaleString()} вопросов`}
              />
              <MetricCard
                title="Сообщения"
                value={Number(data.messages).toLocaleString()}
                icon={<Brain className="h-4 w-4" />}
                subtitle={`Ср. ${data.avgMessagesPerSession} / сессию`}
              />
              <MetricCard
                title="Планы питания"
                value={Number(data.mealPlansCreated).toLocaleString()}
                icon={<Utensils className="h-4 w-4" />}
                subtitle={`${Number(data.favoriteMealPlans)} в избранном`}
              />
              <MetricCard
                title="Шеринги"
                value={Number(data.sharesCreated).toLocaleString()}
                icon={<Share2 className="h-4 w-4" />}
                subtitle={`${Number(data.totalShareViews).toLocaleString()} просмотров`}
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="users">Пользователи</TabsTrigger>
                <TabsTrigger value="content">Контент</TabsTrigger>
                <TabsTrigger value="shares">Шеринг</TabsTrigger>
                <TabsTrigger value="topics">Вопросы</TabsTrigger>
              </TabsList>

              {/* ─── Overview Tab ─── */}
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Динамика чатов</CardTitle>
                    <CardDescription>Сессии и сообщения по дням</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chatTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chatTrendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: string) => {
                              const d = new Date(v);
                              return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                            }}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            labelFormatter={(v: string) => {
                              const d = new Date(v);
                              return d.toLocaleDateString("ru-RU");
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="sessions"
                            name="Сессии"
                            stroke="#10b981"
                            fill="#10b98133"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="messages"
                            name="Сообщения"
                            stroke="#3b82f6"
                            fill="#3b82f633"
                            strokeWidth={2}
                          />
                          <Legend />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-10">
                        Нет данных за выбранный период
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Quick stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    title="Профили пользователей"
                    value={Number(data.totalProfiles).toLocaleString()}
                    icon={<Users className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="Активные рецепты"
                    value={Number(data.activeRecipes).toLocaleString()}
                    icon={<Utensils className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="База знаний"
                    value={Number(data.activeKnowledgeEntries).toLocaleString()}
                    icon={<BookOpen className="h-4 w-4" />}
                    subtitle="активных записей"
                  />
                  <MetricCard
                    title="Избранные планы"
                    value={Number(data.favoriteMealPlans).toLocaleString()}
                    icon={<Star className="h-4 w-4" />}
                  />
                </div>
              </TabsContent>

              {/* ─── Users Tab ─── */}
              <TabsContent value="users" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* User type pie chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Типы пользователей</CardTitle>
                      <CardDescription>Распределение сессий по типу</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {userTypePieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie
                              data={userTypePieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={3}
                              dataKey="value"
                              label={({ name, percent }: { name: string; percent: number }) =>
                                `${name} ${fmtNum(percent * 100)}%`
                              }
                            >
                              {userTypePieData.map((entry: { fill: string }, i: number) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-10">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* User engagement stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Вовлечённость</CardTitle>
                      <CardDescription>Ключевые метрики по сегментам</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-400" />
                            <span className="text-sm font-medium">Гости</span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{Number(data.guestSessions).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">сессий</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm font-medium">Зарегистрированные</span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{Number(data.registeredSessions).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">сессий</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-sm font-medium">Владельцы</span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{Number(data.ownerSessions).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">сессий</p>
                          </div>
                        </div>
                      </div>

                      {/* Conversion hint */}
                      {Number(data.guestSessions) > 0 && Number(data.sessions) > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            <Sparkles className="h-3 w-3 inline mr-1" />
                            Конверсия гость → регистрация:{" "}
                            <strong>
                              {fmtNum(
                                ((Number(data.registeredSessions) + Number(data.ownerSessions)) /
                                  Number(data.sessions)) *
                                100
                              )}
                              %
                            </strong>{" "}
                            сессий от авторизованных пользователей
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ─── Content Tab ─── */}
              <TabsContent value="content" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Knowledge base by category */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">База знаний по категориям</CardTitle>
                      <CardDescription>
                        {Number(data.activeKnowledgeEntries).toLocaleString()} активных записей
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {knowledgePieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie
                              data={knowledgePieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={95}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, value }: { name: string; value: number }) =>
                                `${name}: ${value}`
                              }
                            >
                              {knowledgePieData.map((entry: { fill: string }, i: number) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-10">Нет записей</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Content stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Контент-метрики</CardTitle>
                      <CardDescription>Созданный контент за период</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Utensils className="h-4 w-4 text-amber-500" />
                            <span className="text-sm">Планы питания</span>
                          </div>
                          <Badge variant="secondary">{Number(data.mealPlansCreated)}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-rose-500" />
                            <span className="text-sm">В избранном</span>
                          </div>
                          <Badge variant="secondary">{Number(data.favoriteMealPlans)}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">Активные рецепты</span>
                          </div>
                          <Badge variant="secondary">{Number(data.activeRecipes)}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-violet-500" />
                            <span className="text-sm">Профили пользователей</span>
                          </div>
                          <Badge variant="secondary">{Number(data.totalProfiles)}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm">Ответы Зои</span>
                          </div>
                          <Badge variant="secondary">{Number(data.assistantMessages)}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ─── Shares Tab ─── */}
              <TabsContent value="shares" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard
                    title="Ссылки созданы"
                    value={Number(data.sharesCreated).toLocaleString()}
                    icon={<Share2 className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="Всего просмотров"
                    value={Number(data.totalShareViews).toLocaleString()}
                    icon={<Eye className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="Ср. просмотров/ссылку"
                    value={
                      Number(data.sharesCreated) > 0
                        ? fmtNum(Number(data.totalShareViews) / Number(data.sharesCreated))
                        : "0"
                    }
                    icon={<TrendingUp className="h-4 w-4" />}
                  />
                </div>

                {/* Popular shares table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Популярные ссылки</CardTitle>
                    <CardDescription>Топ по просмотрам за период</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.popularShares && data.popularShares.length > 0 ? (
                      <ScrollRemaining totalItems={data.popularShares.length} itemHeight={48}>
                        <div className="max-h-[400px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="pb-2 font-medium">Заголовок</th>
                                <th className="pb-2 font-medium text-right">Просмотры</th>
                                <th className="pb-2 font-medium text-right">Дата</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.popularShares.map((share: {
                                id: number;
                                title: string | null;
                                shareToken: string;
                                viewCount: number;
                                createdAt: Date;
                              }) => (
                                <tr key={share.id} className="border-b border-muted/50">
                                  <td className="py-2.5">
                                    <a
                                      href={`/zoya/share/${share.shareToken}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      {share.title || `Ссылка #${share.id}`}
                                    </a>
                                  </td>
                                  <td className="py-2.5 text-right font-mono">
                                    <Badge variant="outline">{Number(share.viewCount)}</Badge>
                                  </td>
                                  <td className="py-2.5 text-right text-muted-foreground text-xs">
                                    {new Date(share.createdAt).toLocaleDateString("ru-RU")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ScrollRemaining>
                    ) : (
                      <p className="text-center text-muted-foreground py-10">
                        Нет расшаренных ссылок за период
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Topics Tab ─── */}
              <TabsContent value="topics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Популярные темы вопросов</CardTitle>
                    <CardDescription>
                      Частотный анализ слов из последних {data.recentQuestions?.length ?? 0} вопросов
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topicFrequency.length > 0 ? (
                      <>
                        {/* Visual tag cloud */}
                        <div className="flex flex-wrap gap-2 mb-6">
                          {topicFrequency.map((item, i) => {
                            const maxCount = topicFrequency[0].count;
                            const scale = 0.7 + (item.count / maxCount) * 0.8;
                            return (
                              <Badge
                                key={item.word}
                                variant="outline"
                                className="cursor-default transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                style={{
                                  fontSize: `${scale}rem`,
                                  borderColor: COLORS[i % COLORS.length] + "66",
                                  color: COLORS[i % COLORS.length],
                                }}
                              >
                                {item.word}
                                <span className="ml-1 text-muted-foreground text-xs">
                                  {item.count}
                                </span>
                              </Badge>
                            );
                          })}
                        </div>

                        {/* Bar chart */}
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={topicFrequency.slice(0, 15)}
                            layout="vertical"
                            margin={{ left: 80 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="word"
                              tick={{ fontSize: 11 }}
                              width={75}
                            />
                            <Tooltip />
                            <Bar dataKey="count" name="Упоминания" fill="#10b981" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground py-10">
                        Нет вопросов за выбранный период
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent questions list */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Последние вопросы</CardTitle>
                    <CardDescription>Что спрашивают пользователи</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.recentQuestions && data.recentQuestions.length > 0 ? (
                      <ScrollRemaining totalItems={data.recentQuestions.length} itemHeight={36}>
                        <div className="max-h-[400px] overflow-y-auto space-y-1">
                          {data.recentQuestions.slice(0, 30).map((q: string, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm"
                            >
                              <MessageCircle className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                              <span className="line-clamp-2">{q}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollRemaining>
                    ) : (
                      <p className="text-center text-muted-foreground py-10">
                        Нет вопросов за период
                      </p>
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
