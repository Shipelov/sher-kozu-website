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
  Activity,
  BarChart3,
  Clock,
  Download,
  Eye,
  Globe,
  Loader2,
  MapPin,
  Monitor,
  MousePointerClick,
  Smartphone,
  Tablet,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/Map";
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

/* ─── Chart colors ─── */

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16"];

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
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

function MetricCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─── */

export default function AdminSiteAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [period, setPeriod] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const geoQ = trpc.analytics.geoBreakdown.useQuery({ ...dateRange, limit: 30 }, { enabled: isAdmin });
  const locationsQ = trpc.analytics.visitorLocations.useQuery({ ...dateRange, limit: 200 }, { enabled: isAdmin });
  const overviewQ = trpc.analytics.overview.useQuery(dateRange, { enabled: isAdmin });
  const pageViewsQ = trpc.analytics.pageViewsByDay.useQuery(dateRange, { enabled: isAdmin });
  const topPagesQ = trpc.analytics.topPages.useQuery({ ...dateRange, limit: 20 }, { enabled: isAdmin });
  const referrersQ = trpc.analytics.referrers.useQuery({ ...dateRange, limit: 15 }, { enabled: isAdmin });
  const devicesQ = trpc.analytics.devices.useQuery(dateRange, { enabled: isAdmin });
  const utmQ = trpc.analytics.utmCampaigns.useQuery(dateRange, { enabled: isAdmin });
  const funnelQ = trpc.analytics.conversionFunnel.useQuery(dateRange, { enabled: isAdmin });
  const eventsQ = trpc.analytics.events.useQuery(dateRange, { enabled: isAdmin });
  const hourlyQ = trpc.analytics.hourlyTraffic.useQuery(dateRange, { enabled: isAdmin });

  const overview = overviewQ.data;
  const isLoading = overviewQ.isLoading;

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
            { label: "Аналитика сайта" },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Аналитика сайта
            </h1>
            <p className="text-sm text-muted-foreground">Посещаемость, поведение пользователей и конверсии</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="7d">7 дней</SelectItem>
                <SelectItem value="30d">30 дней</SelectItem>
                <SelectItem value="90d">90 дней</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (topPagesQ.data) {
                  downloadCsv(topPagesQ.data as any[], `site-analytics-pages-${period}.csv`);
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard
                title="Просмотры"
                value={(overview?.pageViews ?? 0).toLocaleString()}
                icon={<Eye className="h-4 w-4" />}
              />
              <MetricCard
                title="Уникальные"
                value={(overview?.uniqueVisitors ?? 0).toLocaleString()}
                icon={<Users className="h-4 w-4" />}
              />
              <MetricCard
                title="Сессии"
                value={(overview?.sessions ?? 0).toLocaleString()}
                icon={<Globe className="h-4 w-4" />}
              />
              <MetricCard
                title="Ср. время"
                value={`${overview?.avgTimeOnPage ?? 0} сек`}
                icon={<Clock className="h-4 w-4" />}
              />
              <MetricCard
                title="Отказы"
                value={`${overview?.bounceRate ?? 0}%`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="pages">Страницы</TabsTrigger>
                <TabsTrigger value="sources">Источники</TabsTrigger>
                <TabsTrigger value="devices">Устройства</TabsTrigger>
                <TabsTrigger value="geo">География</TabsTrigger>
                <TabsTrigger value="funnel">Воронка</TabsTrigger>
              </TabsList>

              {/* ─── Overview Tab ─── */}
              <TabsContent value="overview" className="space-y-4">
                {/* Traffic chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Трафик по дням</CardTitle>
                    <CardDescription>Просмотры и уникальные посетители</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pageViewsQ.isLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : pageViewsQ.data && pageViewsQ.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={pageViewsQ.data}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              const d = new Date(v);
                              return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                            }}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            labelFormatter={(v) => {
                              const d = new Date(v);
                              return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
                            }}
                          />
                          <Area type="monotone" dataKey="views" name="Просмотры" stroke="#3b82f6" fill="#3b82f680" />
                          <Area type="monotone" dataKey="visitors" name="Посетители" stroke="#10b981" fill="#10b98180" />
                          <Legend />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">Нет данных за выбранный период</p>
                    )}
                  </CardContent>
                </Card>

                {/* Hourly heatmap */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Активность по часам</CardTitle>
                    <CardDescription>Распределение трафика в течение недели</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hourlyQ.isLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : hourlyQ.data && hourlyQ.data.length > 0 ? (
                      <HourlyHeatmap data={hourlyQ.data} />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">Нет данных</p>
                    )}
                  </CardContent>
                </Card>

                {/* Events summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4" />
                      Ключевые события
                    </CardTitle>
                    <CardDescription>Взаимодействия пользователей</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {eventsQ.isLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : eventsQ.data && eventsQ.data.length > 0 ? (
                      <ScrollRemaining totalItems={eventsQ.data.length} itemHeight={40} className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {eventsQ.data.map((ev: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{ev.category}</Badge>
                              <span className="text-sm">{ev.action}</span>
                              {ev.label && <span className="text-xs text-muted-foreground">{ev.label}</span>}
                            </div>
                            <span className="text-sm font-medium">{ev.count}</span>
                          </div>
                        ))}
                      </ScrollRemaining>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Нет событий</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Pages Tab ─── */}
              <TabsContent value="pages" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Популярные страницы</CardTitle>
                    <CardDescription>Просмотры, уникальные посетители и среднее время</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topPagesQ.isLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : topPagesQ.data && topPagesQ.data.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={topPagesQ.data.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                              dataKey="pagePath"
                              type="category"
                              width={150}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => v.length > 25 ? v.slice(0, 22) + "..." : v}
                            />
                            <Tooltip />
                            <Bar dataKey="views" name="Просмотры" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>

                        <div className="mt-4">
                          <ScrollRemaining totalItems={topPagesQ.data.length} itemHeight={44} className="max-h-[400px] overflow-y-auto pr-1">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-muted-foreground">
                                  <th className="text-left py-2 font-medium">Страница</th>
                                  <th className="text-right py-2 font-medium">Просмотры</th>
                                  <th className="text-right py-2 font-medium">Посетители</th>
                                  <th className="text-right py-2 font-medium">Ср. время</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topPagesQ.data.map((page: any, i: number) => (
                                  <tr key={i} className="border-b last:border-0">
                                    <td className="py-2 max-w-[200px] truncate" title={page.pagePath}>{page.pagePath}</td>
                                    <td className="text-right py-2 font-medium">{page.views}</td>
                                    <td className="text-right py-2">{page.visitors}</td>
                                    <td className="text-right py-2 text-muted-foreground">{page.avgTime} сек</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </ScrollRemaining>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">Нет данных</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Sources Tab ─── */}
              <TabsContent value="sources" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Referrers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Источники трафика</CardTitle>
                      <CardDescription>Откуда приходят посетители</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {referrersQ.isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : referrersQ.data && referrersQ.data.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={referrersQ.data.slice(0, 8)}
                                dataKey="visits"
                                nameKey="referrer"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ referrer, percent }) =>
                                  `${(referrer as string).length > 15 ? (referrer as string).slice(0, 12) + "..." : referrer} ${fmtNum(percent * 100)}%`
                                }
                                labelLine={false}
                              >
                                {referrersQ.data.slice(0, 8).map((_: any, i: number) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <ScrollRemaining totalItems={referrersQ.data.length} itemHeight={36} className="mt-2 space-y-1 max-h-[200px] overflow-y-auto pr-1">
                            {referrersQ.data.map((ref: any, i: number) => (
                              <div key={i} className="flex items-center justify-between py-1 text-sm">
                                <span className="truncate max-w-[200px]" title={ref.referrer}>{ref.referrer}</span>
                                <span className="font-medium">{ref.visits}</span>
                              </div>
                            ))}
                          </ScrollRemaining>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-10">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* UTM Campaigns */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">UTM-кампании</CardTitle>
                      <CardDescription>Маркетинговые каналы</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {utmQ.isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : utmQ.data && utmQ.data.length > 0 ? (
                        <ScrollRemaining totalItems={utmQ.data.length} itemHeight={52} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {utmQ.data.map((utm: any, i: number) => (
                            <div key={i} className="p-2 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-medium">{utm.source}</span>
                                  <span className="text-xs text-muted-foreground ml-1">/ {utm.medium}</span>
                                </div>
                                <span className="text-sm font-medium">{utm.visits} визитов</span>
                              </div>
                              {utm.campaign !== "none" && (
                                <p className="text-xs text-muted-foreground mt-0.5">Кампания: {utm.campaign}</p>
                              )}
                            </div>
                          ))}
                        </ScrollRemaining>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-10">Нет UTM-данных</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ─── Devices Tab ─── */}
              <TabsContent value="devices" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Device types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Типы устройств</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {devicesQ.isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : devicesQ.data?.devices && devicesQ.data.devices.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={devicesQ.data.devices}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                              >
                                {devicesQ.data.devices.map((_: any, i: number) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="mt-2 space-y-1">
                            {devicesQ.data.devices.map((d: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  {DEVICE_ICONS[d.type] ?? <Monitor className="h-4 w-4" />}
                                  <span className="capitalize">{d.type}</span>
                                </div>
                                <span className="font-medium">{d.count}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-10">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Browsers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Браузеры</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {devicesQ.isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : devicesQ.data?.browsers && devicesQ.data.browsers.length > 0 ? (
                        <div className="space-y-2">
                          {devicesQ.data.browsers.map((b: any, i: number) => {
                            const maxCount = Math.max(...devicesQ.data!.browsers.map((x: any) => x.count));
                            const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between text-sm mb-0.5">
                                  <span>{b.name}</span>
                                  <span className="font-medium">{b.count}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-10">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* OS */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Операционные системы</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {devicesQ.isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : devicesQ.data?.os && devicesQ.data.os.length > 0 ? (
                        <div className="space-y-2">
                          {devicesQ.data.os.map((o: any, i: number) => {
                            const maxCount = Math.max(...devicesQ.data!.os.map((x: any) => x.count));
                            const pct = maxCount > 0 ? (o.count / maxCount) * 100 : 0;
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between text-sm mb-0.5">
                                  <span>{o.name}</span>
                                  <span className="font-medium">{o.count}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-10">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ─── Geography Tab ─── */}
              <TabsContent value="geo" className="space-y-4">
                <GeoMapSection locations={locationsQ.data ?? []} isLoading={locationsQ.isLoading} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Топ городов по посещениям
                    </CardTitle>
                    <CardDescription>Города, откуда приходят посетители</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {geoQ.isLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : geoQ.data && geoQ.data.length > 0 ? (
                      <ScrollRemaining totalItems={geoQ.data.length} itemHeight={40}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-2 font-medium">Город</th>
                              <th className="py-2 font-medium">Регион</th>
                              <th className="py-2 font-medium">Страна</th>
                              <th className="py-2 font-medium text-right">Просмотры</th>
                              <th className="py-2 font-medium text-right">Уникальные</th>
                            </tr>
                          </thead>
                          <tbody>
                            {geoQ.data.map((row: { city: string; region: string; country: string; views: number; visitors: number }, i: number) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="py-2 font-medium">{row.city || "—"}</td>
                                <td className="py-2 text-muted-foreground">{row.region || "—"}</td>
                                <td className="py-2">
                                  <Badge variant="outline" className="text-xs">{row.country}</Badge>
                                </td>
                                <td className="py-2 text-right">{row.views.toLocaleString()}</td>
                                <td className="py-2 text-right">{row.visitors.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollRemaining>
                    ) : (
                      <p className="text-center text-muted-foreground py-10">Нет данных о геолокации за выбранный период</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Funnel Tab ─── */}
              <TabsContent value="funnel" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Воронка конверсии</CardTitle>
                    <CardDescription>Путь пользователя по ключевым страницам</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {funnelQ.isLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : funnelQ.data && funnelQ.data.length > 0 ? (
                      <div className="space-y-3">
                        {funnelQ.data.map((step, i) => {
                          const maxVisitors = Math.max(...funnelQ.data!.map((s) => s.visitors));
                          const pct = maxVisitors > 0 ? (step.visitors / maxVisitors) * 100 : 0;
                          const dropOff = i > 0 && funnelQ.data![i - 1].visitors > 0
                            ? Math.round((1 - step.visitors / funnelQ.data![i - 1].visitors) * 100)
                            : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                                  <span className="text-sm font-medium">{step.step}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{step.visitors} посетителей</span>
                                  {dropOff > 0 && (
                                    <Badge variant="outline" className="text-xs text-rose-500">-{dropOff}%</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="h-6 bg-muted rounded overflow-hidden relative">
                                <div
                                  className="h-full rounded transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: COLORS[i % COLORS.length],
                                    opacity: 0.8,
                                  }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                  {Math.round(pct)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">Нет данных о конверсии</p>
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

/* ─── GeoMap Section Component ─── */

type GeoLocation = { lat: number; lng: number; city: string; region: string; country: string; pagePath: string };

function GeoMapSection({ locations, isLoading }: { locations: GeoLocation[]; isLoading: boolean }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (locations.length > 0) {
      addMarkers(map, locations);
    }
  }, [locations]);

  // Update markers when locations change
  const prevLocationsRef = useRef<GeoLocation[]>([]);
  if (mapRef.current && locations !== prevLocationsRef.current && locations.length > 0) {
    prevLocationsRef.current = locations;
    // Clear old markers
    for (const m of markersRef.current) {
      m.map = null;
    }
    markersRef.current = [];
    addMarkers(mapRef.current, locations);
  }

  function addMarkers(map: google.maps.Map, locs: GeoLocation[]) {
    // Aggregate by city to avoid too many markers
    const cityMap = new Map<string, { lat: number; lng: number; city: string; count: number }>();
    for (const loc of locs) {
      const key = `${fmtNum(loc.lat)},${fmtNum(loc.lng)}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        cityMap.set(key, { lat: loc.lat, lng: loc.lng, city: loc.city || loc.region || loc.country, count: 1 });
      }
    }

    const bounds = new google.maps.LatLngBounds();
    const entries = Array.from(cityMap.values());
    for (const entry of entries) {
      const pos = { lat: entry.lat, lng: entry.lng };
      bounds.extend(pos);

      // Create a custom pin element
      const pinEl = document.createElement("div");
      pinEl.style.cssText = `
        background: #10b981; color: white; border-radius: 50%; width: ${Math.min(16 + entry.count * 3, 40)}px;
        height: ${Math.min(16 + entry.count * 3, 40)}px; display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 600; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `;
      pinEl.textContent = entry.count > 1 ? String(entry.count) : "";
      pinEl.title = `${entry.city}: ${entry.count} посещений`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        content: pinEl,
        title: `${entry.city}: ${entry.count} посещений`,
      });
      markersRef.current.push(marker);
    }

    if (entries.length > 0) {
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Карта посещений
        </CardTitle>
        <CardDescription>География посетителей сайта за выбранный период</CardDescription>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Нет данных о геолокации. Данные появятся после накопления посещений.</p>
        ) : (
          <MapView
            className="h-[400px] rounded-lg overflow-hidden"
            initialCenter={{ lat: 55.75, lng: 37.62 }}
            initialZoom={4}
            onMapReady={handleMapReady}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Hourly Heatmap Component ─── */

function HourlyHeatmap({ data }: { data: Array<{ hour: number; dayOfWeek: number; count: number }> }) {
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Build a grid: 7 days x 24 hours
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const d of data) {
    const dayIdx = d.dayOfWeek - 1; // MySQL DAYOFWEEK: 1=Sunday
    if (dayIdx >= 0 && dayIdx < 7 && d.hour >= 0 && d.hour < 24) {
      grid[dayIdx][d.hour] = d.count;
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex items-center mb-1">
          <div className="w-8" />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">
              {h}
            </div>
          ))}
        </div>
        {/* Grid rows */}
        {grid.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center mb-0.5">
            <div className="w-8 text-xs text-muted-foreground text-right pr-1">{dayNames[dayIdx]}</div>
            {row.map((count, h) => {
              const intensity = count / maxCount;
              const bg = count === 0
                ? "bg-muted"
                : intensity > 0.75
                  ? "bg-emerald-500"
                  : intensity > 0.5
                    ? "bg-emerald-400"
                    : intensity > 0.25
                      ? "bg-emerald-300"
                      : "bg-emerald-200";
              return (
                <div
                  key={h}
                  className={`flex-1 h-5 ${bg} rounded-[2px] mx-[1px] transition-colors`}
                  title={`${dayNames[dayIdx]} ${h}:00 — ${count} визитов`}
                />
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
          <span>Меньше</span>
          <div className="w-3 h-3 bg-muted rounded-[2px]" />
          <div className="w-3 h-3 bg-emerald-200 rounded-[2px]" />
          <div className="w-3 h-3 bg-emerald-300 rounded-[2px]" />
          <div className="w-3 h-3 bg-emerald-400 rounded-[2px]" />
          <div className="w-3 h-3 bg-emerald-500 rounded-[2px]" />
          <span>Больше</span>
        </div>
      </div>
    </div>
  );
}
