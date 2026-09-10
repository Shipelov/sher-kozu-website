import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  Bell,
  Coins,
  Crown,
  FileText,
  BookOpen,
  Bot,
  FlaskConical,
  Gauge,
  Gamepad2,
  Leaf,
  KeyRound,
  Loader2,
  Milk,
  PawPrint,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type AdminSection = {
  title: string;
  path: string;
  icon: typeof PawPrint;
  stat?: string;
};

export default function AdminHub() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  const animalsQuery = trpc.adminAnimals.list.useQuery(undefined, { enabled: isAdmin, retry: false });
  const clubQuery = trpc.adminClub.dashboard.useQuery(undefined, { enabled: isAdmin, retry: false });
  const funnelQuery = trpc.adminAnalytics.userFunnel.useQuery(undefined, { enabled: isAdmin, retry: false });
  const pendingCountQuery = trpc.adminAnalytics.pendingApplicationsCount.useQuery(undefined, { enabled: isAdmin, retry: false, staleTime: 0 });

  const funnel = funnelQuery.data;
  const pendingCount = pendingCountQuery.data ?? 0;
  const utils = trpc.useUtils();

  const [resetPendingId, setResetPendingId] = useState<number | null>(null);

  const resetPasswordMutation = trpc.adminSync.resetUserPassword.useMutation({
    onSuccess: (data) => {
      toast.success(`Пароль сброшен`, {
        description: `Новый пароль для ${data.userName || data.userEmail || "пользователя"}: ${data.newPassword}`,
        duration: 15000,
      });
      setResetPendingId(null);
      void utils.adminAnalytics.userFunnel.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка сброса пароля", { description: err.message });
      setResetPendingId(null);
    },
  });

  const syncBitrixMutation = trpc.adminSync.syncBitrixContacts.useMutation({
    onSuccess: (data) => {
      toast.success("Синхронизация завершена", {
        description: `Обработано: ${data.synced}, создано: ${data.created}, обновлено: ${data.updated}`,
      });
      void utils.adminAnalytics.userFunnel.invalidate();
    },
    onError: (err) => {
      toast.error("Ошибка синхронизации", { description: err.message });
    },
  });

  const animalCount = animalsQuery.data?.length ?? 0;
  const clubPosts = clubQuery.data?.summary.totalPosts ?? 0;
  const clubEvents = clubQuery.data?.summary.totalEvents ?? 0;
  const clubMembers = clubQuery.data?.summary.totalMembers ?? 0;

  const sections: AdminSection[] = [
    { title: "Животные", path: "/admin/animals", icon: PawPrint, stat: isAdmin ? `${animalCount}` : undefined },
    { title: "Клуб", path: "/admin/club", icon: Crown, stat: isAdmin ? `${clubPosts} п · ${clubEvents} с · ${clubMembers} уч` : undefined },
    { title: "Пользователи", path: "/admin/users", icon: Users, stat: isAdmin ? `${funnel?.totalUsers ?? 0}` : undefined },
    { title: "Маркетплейс", path: "/admin/marketplace", icon: ShoppingBag },
    { title: "Токены SKC", path: "/admin/tokens", icon: Coins },
    { title: "Аналитика «Забота»", path: "/admin/analytics", icon: Gamepad2 },
    { title: "Аналитика сайта", path: "/admin/site-analytics", icon: Activity },
    { title: "FAQ аналитика", path: "/admin/faq-analytics", icon: TrendingUp },
    { title: "Контент (CMS)", path: "/admin/content", icon: FileText },
    { title: "Уведомления аналитики", path: "/admin/analytics-alerts", icon: Bell },
    { title: "A/B тестирование", path: "/admin/ab-experiments", icon: FlaskConical },
    { title: "Управление ценами", path: "/admin/pricing", icon: Tag },
    { title: "База знаний Зои", path: "/admin/nutri-knowledge", icon: BookOpen },
    { title: "База знаний Маши", path: "/admin/assistant-knowledge", icon: Bot },
    { title: "Аналитика нутрициологии", path: "/admin/nutri-analytics", icon: Leaf },
    { title: "Производительность", path: "/admin/performance", icon: Gauge },
    { title: "Сотрудники фермы", path: "/admin/farm-workers", icon: Milk },
    { title: "Контроль молока", path: "/admin/milk", icon: Leaf },
  ];

  // ── Loading ──
  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
        </div>
      </DashboardLayout>
    );
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <DashboardLayout>
        <div className="container max-w-md py-20 text-center space-y-4">
          <h1 className="text-xl font-semibold">Вход в админ-панель</h1>
          <p className="text-sm text-muted-foreground">Для доступа необходимо авторизоваться.</p>
          <Button asChild className="rounded-full">
            <a href={getLoginUrl("/admin")}>Войти</a>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Not admin ──
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="container max-w-md py-20 text-center space-y-4">
          <h1 className="text-xl font-semibold">Доступ ограничен</h1>
          <p className="text-sm text-muted-foreground">
            Вы вошли как <span className="font-medium text-foreground">{user.name}</span>, но для доступа к админ-панели нужна роль <Badge variant="outline" className="ml-1 rounded-full text-[10px]">admin</Badge>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6efe6_0%,#f7f2ea_35%,#faf7f3_100%)] text-foreground">
        <div className="container py-8 space-y-6">
          <PageBreadcrumbs
            className="mb-1"
            items={[
              { label: "Главная", href: "/" },
              { label: "Админ-панель" },
            ]}
          />

          {/* ── Header ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Админ-панель</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {user.name} · <Badge variant="outline" className="rounded-full text-[10px] border-primary/30 text-primary">admin</Badge>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 self-start"
              disabled={syncBitrixMutation.isPending}
              onClick={() => syncBitrixMutation.mutate()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncBitrixMutation.isPending && "animate-spin")} />
              {syncBitrixMutation.isPending ? "Синхронизация…" : "Синхронизация Bitrix24"}
            </Button>
          </div>

          {/* ── Funnel ── */}
          {funnel && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold">Воронка</h2>
                {pendingCount > 0 && (
                  <Badge className="rounded-full border-amber-200 bg-amber-50 text-amber-700 text-xs">
                    <Bell className="mr-1 h-3 w-3" /> {pendingCount} заявок
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Всего", value: funnel.totalUsers, color: "bg-blue-500" },
                  { label: "Ожидают оплату", value: funnel.pendingPayment, color: "bg-amber-500" },
                  { label: "Владельцев", value: funnel.activeOwners, color: "bg-emerald-500" },
                  { label: "С планами", value: funnel.withPlans, color: "bg-purple-500" },
                ].map((step) => {
                  const pct = funnel.totalUsers > 0 ? Math.round((step.value / funnel.totalUsers) * 100) : 0;
                  return (
                    <Card key={step.label} className="rounded-2xl border-border/70 shadow-none">
                      <CardContent className="p-4">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{step.label}</p>
                        <p className="mt-1.5 text-2xl font-bold">{step.value}</p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                          <div className={cn("h-1.5 rounded-full transition-all", step.color)} style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{pct}%</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Recent registrations */}
              {funnel.recentUsers.length > 0 && (
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Последние регистрации</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollRemaining totalItems={funnel.recentUsers.length} itemHeight={44} className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/70 bg-muted/30">
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Имя</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Контакты</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Связь</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Роль</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Дата</th>
                            <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Пароль</th>
                          </tr>
                        </thead>
                        <tbody>
                          {funnel.recentUsers.map((u: any) => (
                            <tr key={u.id} className="border-b border-border/40 last:border-0">
                              <td className="px-4 py-2 font-medium whitespace-nowrap">{u.name || "—"}</td>
                              <td className="px-4 py-2">
                                <div className="flex flex-col gap-0.5 text-xs">
                                  {u.email && <span>{u.email}</span>}
                                  {u.phone && <span className="text-muted-foreground">{u.phone}</span>}
                                  {!u.email && !u.phone && <span className="text-muted-foreground/60">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                {u.preferredContact ? (
                                  <Badge variant="outline" className="rounded-full text-[10px]">{u.preferredContact}</Badge>
                                ) : <span className="text-xs text-muted-foreground/60">—</span>}
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="outline" className={cn("rounded-full text-[10px]", u.role === "admin" ? "border-primary/30 text-primary" : "")}>
                                  {u.role || "user"}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  disabled={resetPendingId === u.id}
                                  onClick={() => {
                                    setResetPendingId(u.id);
                                    resetPasswordMutation.mutate({ userId: u.id });
                                  }}
                                  title="Сбросить пароль"
                                >
                                  {resetPendingId === u.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <KeyRound className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollRemaining>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* ── Section grid ── */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sections.map((s) => (
              <button
                key={s.path}
                type="button"
                onClick={() => setLocation(s.path)}
                className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-white/95 p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                  {s.stat && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{s.stat}</p>
                  )}
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:text-primary" />
              </button>
            ))}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
