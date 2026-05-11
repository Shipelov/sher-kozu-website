/**
 * Admin Performance Dashboard — monitors page load times, Web Vitals,
 * slow page alerts, GeoIP cache stats, and performance trends.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { fmtNum } from "@/lib/utils";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  Gauge,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  TrendingUp,
  Zap,
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


/* ─── Date range helpers ─── */

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 86400000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 86400000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 86400000);
      break;
    default:
      from = new Date(now.getTime() - 30 * 86400000);
  }
  return { from: from.toISOString(), to };
}

/* ─── Colors ─── */

const COLORS = {
  good: "#10b981",
  needsWork: "#f59e0b",
  poor: "#ef4444",
  primary: "#2D5016",
  accent: "#D4A017",
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
};

/* ─── Helpers ─── */

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${fmtNum(ms / 1000)}s`;
}

function getLoadBadge(ms: number | null | undefined) {
  if (ms == null) return <Badge variant="outline">—</Badge>;
  if (ms <= 1000) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Быстро</Badge>;
  if (ms <= 2000) return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Нормально</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-300">Медленно</Badge>;
}

function hitRatePercent(hits: number, misses: number): string {
  const total = hits + misses;
  if (total === 0) return "0%";
  return `${fmtNum((hits / total) * 100)}%`;
}

/* ─── Main Component ─── */

export default function AdminPerformance() {
  const [period, setPeriod] = useState("7d");
  const dateRange = useMemo(() => getDateRange(period), [period]);

  // Queries
  const overview = trpc.analytics.performanceOverview.useQuery(dateRange);
  const byPage = trpc.analytics.performanceByPage.useQuery({ ...dateRange, limit: 20 });
  const trend = trpc.analytics.performanceTrend.useQuery(dateRange);
  const vitals = trpc.analytics.webVitals.useQuery(dateRange);
  const slowPages = trpc.analytics.slowPages.useQuery({ ...dateRange, limit: 50 });
  const byDevice = trpc.analytics.performanceByDevice.useQuery(dateRange);
  const geoIpCache = trpc.analytics.geoIpCacheStats.useQuery();
  const pipeline = trpc.analytics.pipelineHealth.useQuery();

  const isLoading = overview.isLoading;

  return (
    <DashboardLayout>
        <div className="container py-6 space-y-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 64px)" }}>
          <PageBreadcrumbs
            items={[
              { label: "Админ", href: "/admin" },
              { label: "Производительность" },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Gauge className="h-6 w-6 text-primary" />
                Мониторинг производительности
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Web Vitals, время загрузки страниц, медленные запросы, кеш GeoIP
              </p>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="7d">7 дней</SelectItem>
                <SelectItem value="30d">30 дней</SelectItem>
                <SelectItem value="90d">90 дней</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="vitals">Web Vitals</TabsTrigger>
                <TabsTrigger value="pages">По страницам</TabsTrigger>
                <TabsTrigger value="slow">Медленные</TabsTrigger>
                <TabsTrigger value="infra">Инфраструктура</TabsTrigger>
              </TabsList>

              {/* ─── Overview Tab ─── */}
              <TabsContent value="overview" className="space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard
                    title="Замеров"
                    value={overview.data?.totalSamples ?? 0}
                    icon={<BarChart3 className="h-4 w-4" />}
                  />
                  <KpiCard
                    title="Ср. загрузка"
                    value={formatMs(overview.data?.avgPageLoad)}
                    icon={<Clock className="h-4 w-4" />}
                    badge={getLoadBadge(overview.data?.avgPageLoad)}
                  />
                  <KpiCard
                    title="P95 загрузка"
                    value={formatMs(overview.data?.p95PageLoad)}
                    icon={<TrendingUp className="h-4 w-4" />}
                    badge={getLoadBadge(overview.data?.p95PageLoad)}
                  />
                  <KpiCard
                    title="Медленных (>2с)"
                    value={overview.data?.slowPages ?? 0}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    alert={Number(overview.data?.slowPages ?? 0) > 0}
                  />
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="TTFB (ср.)" value={formatMs(overview.data?.avgTtfb)} />
                  <MetricCard label="FCP (ср.)" value={formatMs(overview.data?.avgFcp)} />
                  <MetricCard label="LCP (ср.)" value={formatMs(overview.data?.avgLcp)} />
                  <MetricCard label="CLS (ср.)" value={overview.data?.avgCls != null ? String(overview.data.avgCls) : "—"} />
                </div>

                {/* Trend Chart */}
                {trend.data && trend.data.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Тренд загрузки по дням</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trend.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} unit="ms" />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                `${value}ms`,
                                name === "avgPageLoad" ? "Ср. загрузка" :
                                name === "avgTtfb" ? "TTFB" :
                                name === "avgFcp" ? "FCP" :
                                name === "avgLcp" ? "LCP" :
                                name === "p95PageLoad" ? "P95" : name,
                              ]}
                            />
                            <Area type="monotone" dataKey="avgPageLoad" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.1} name="avgPageLoad" />
                            <Area type="monotone" dataKey="p95PageLoad" stroke={COLORS.poor} fill={COLORS.poor} fillOpacity={0.05} name="p95PageLoad" strokeDasharray="5 5" />
                            <Area type="monotone" dataKey="avgTtfb" stroke={COLORS.blue} fill="transparent" name="avgTtfb" />
                            <Area type="monotone" dataKey="avgLcp" stroke={COLORS.accent} fill="transparent" name="avgLcp" />
                            <Legend formatter={(value) =>
                              value === "avgPageLoad" ? "Ср. загрузка" :
                              value === "p95PageLoad" ? "P95" :
                              value === "avgTtfb" ? "TTFB" :
                              value === "avgLcp" ? "LCP" : value
                            } />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Device breakdown */}
                {byDevice.data && byDevice.data.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">По типу устройства</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {byDevice.data.map((d: any) => (
                          <div key={d.deviceType} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="p-2 rounded-md bg-background">
                              {DEVICE_ICONS[d.deviceType || "desktop"] || <Monitor className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium capitalize">{d.deviceType || "Неизвестно"}</p>
                              <p className="text-xs text-muted-foreground">{d.samples} замеров</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{formatMs(d.avgPageLoad)}</p>
                              <p className="text-xs text-muted-foreground">TTFB {formatMs(d.avgTtfb)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ─── Web Vitals Tab ─── */}
              <TabsContent value="vitals" className="space-y-4">
                {vitals.data && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <VitalCard
                      title="First Contentful Paint (FCP)"
                      description="Время до первого контента на экране"
                      good={vitals.data.fcpGood}
                      needsWork={vitals.data.fcpNeedsWork}
                      poor={vitals.data.fcpPoor}
                      thresholds="< 1.8с / 1.8–3с / > 3с"
                    />
                    <VitalCard
                      title="Largest Contentful Paint (LCP)"
                      description="Время до отрисовки основного контента"
                      good={vitals.data.lcpGood}
                      needsWork={vitals.data.lcpNeedsWork}
                      poor={vitals.data.lcpPoor}
                      thresholds="< 2.5с / 2.5–4с / > 4с"
                    />
                    <VitalCard
                      title="First Input Delay (FID)"
                      description="Задержка первого взаимодействия"
                      good={vitals.data.fidGood}
                      needsWork={vitals.data.fidNeedsWork}
                      poor={vitals.data.fidPoor}
                      thresholds="< 100мс / 100–300мс / > 300мс"
                    />
                    <VitalCard
                      title="Cumulative Layout Shift (CLS)"
                      description="Визуальная стабильность страницы"
                      good={vitals.data.clsGood}
                      needsWork={vitals.data.clsNeedsWork}
                      poor={vitals.data.clsPoor}
                      thresholds="< 0.1 / 0.1–0.25 / > 0.25"
                    />
                  </div>
                )}
              </TabsContent>

              {/* ─── Pages Tab ─── */}
              <TabsContent value="pages" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Производительность по страницам</CardTitle>
                    <CardDescription>Средние метрики за выбранный период</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {byPage.data && byPage.data.length > 0 ? (
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background border-b">
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-2 pr-4">Страница</th>
                              <th className="pb-2 pr-4 text-right">Замеров</th>
                              <th className="pb-2 pr-4 text-right">Ср. загрузка</th>
                              <th className="pb-2 pr-4 text-right">P95</th>
                              <th className="pb-2 pr-4 text-right">TTFB</th>
                              <th className="pb-2 pr-4 text-right">FCP</th>
                              <th className="pb-2 pr-4 text-right">LCP</th>
                              <th className="pb-2 text-right">Медл.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byPage.data.map((row: any) => (
                              <tr key={row.pagePath} className="border-b border-muted/30 hover:bg-muted/20">
                                <td className="py-2 pr-4 font-mono text-xs max-w-[200px] truncate">{row.pagePath}</td>
                                <td className="py-2 pr-4 text-right">{row.samples}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.avgPageLoad)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.p95PageLoad)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.avgTtfb)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.avgFcp)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.avgLcp)}</td>
                                <td className="py-2 text-right">
                                  {Number(row.slowCount) > 0 ? (
                                    <Badge className="bg-red-100 text-red-800 border-red-300">{row.slowCount}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-8 text-center">Нет данных за выбранный период</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Slow Pages Tab ─── */}
              <TabsContent value="slow" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Медленные загрузки (&gt;2 сек)
                    </CardTitle>
                    <CardDescription>Последние случаи медленной загрузки страниц</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {slowPages.data && slowPages.data.length > 0 ? (
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background border-b">
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-2 pr-4">Страница</th>
                              <th className="pb-2 pr-4 text-right">Загрузка</th>
                              <th className="pb-2 pr-4 text-right">TTFB</th>
                              <th className="pb-2 pr-4 text-right">FCP</th>
                              <th className="pb-2 pr-4 text-right">LCP</th>
                              <th className="pb-2 pr-4">Устройство</th>
                              <th className="pb-2 pr-4">Сеть</th>
                              <th className="pb-2">Время</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slowPages.data.map((row: any) => (
                              <tr key={row.id} className="border-b border-muted/30 hover:bg-muted/20">
                                <td className="py-2 pr-4 font-mono text-xs max-w-[200px] truncate">{row.pagePath}</td>
                                <td className="py-2 pr-4 text-right font-semibold text-red-600">{formatMs(row.pageLoadMs)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.ttfbMs)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.fcpMs)}</td>
                                <td className="py-2 pr-4 text-right">{formatMs(row.lcpMs)}</td>
                                <td className="py-2 pr-4 capitalize">{row.deviceType || "—"}</td>
                                <td className="py-2 pr-4">{row.connectionType || "—"}</td>
                                <td className="py-2 text-xs text-muted-foreground">
                                  {row.createdAt ? new Date(row.createdAt).toLocaleString("ru-RU") : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <Zap className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                        <p className="text-sm text-muted-foreground">Нет медленных загрузок за выбранный период</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Infrastructure Tab ─── */}
              <TabsContent value="infra" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* GeoIP Cache Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        GeoIP кеш
                      </CardTitle>
                      <CardDescription>Статистика in-memory кеша геолокации</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {geoIpCache.data ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <StatRow label="Размер кеша" value={`${geoIpCache.data.size} / ${geoIpCache.data.maxSize}`} />
                            <StatRow label="Hit rate" value={hitRatePercent(geoIpCache.data.hits, geoIpCache.data.misses)} highlight />
                            <StatRow label="Попаданий" value={String(geoIpCache.data.hits)} />
                            <StatRow label="Промахов" value={String(geoIpCache.data.misses)} />
                            <StatRow label="Вытеснений" value={String(geoIpCache.data.evictions)} />
                            <StatRow label="Ошибок" value={String(geoIpCache.data.errors)} alert={geoIpCache.data.errors > 0} />
                            <StatRow label="Ср. время запроса" value={`${geoIpCache.data.avgLookupMs}ms`} />
                            <StatRow label="TTL" value={`${Math.round(geoIpCache.data.ttlMs / 3600000)}ч`} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Загрузка...</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pipeline Health */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Здоровье пайплайна
                      </CardTitle>
                      <CardDescription>Статус операций аналитики</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {pipeline.data ? (
                        <div className="space-y-3">
                          {Object.entries(pipeline.data).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <span className="text-sm font-mono">{key}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {val.success}/{val.success + val.failure}
                                </span>
                                <Badge
                                  className={
                                    val.successRate === "100.0%" || val.failure === 0
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-amber-100 text-amber-800 border-amber-300"
                                  }
                                >
                                  {val.successRate}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Загрузка...</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
    </DashboardLayout>
  );
}

/* ─── Sub-components ─── */

function KpiCard({
  title,
  value,
  icon,
  badge,
  alert,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-red-300" : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${alert ? "text-red-600" : ""}`}>{value}</span>
          {badge}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}

function VitalCard({
  title,
  description,
  good,
  needsWork,
  poor,
  thresholds,
}: {
  title: string;
  description: string;
  good: number;
  needsWork: number;
  poor: number;
  thresholds: string;
}) {
  const total = good + needsWork + poor;
  const data = [
    { name: "Хорошо", value: good, color: COLORS.good },
    { name: "Средне", value: needsWork, color: COLORS.needsWork },
    { name: "Плохо", value: poor, color: COLORS.poor },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <div className="flex items-center gap-4">
            <div className="w-[120px] h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                    {data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {data.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span>{d.name}</span>
                  </div>
                  <span className="font-medium">
                    {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">Пороги: {thresholds}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Нет данных</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatRow({
  label,
  value,
  highlight,
  alert,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-emerald-600" : ""} ${alert ? "text-red-600" : ""}`}>
        {value}
      </span>
    </div>
  );
}
