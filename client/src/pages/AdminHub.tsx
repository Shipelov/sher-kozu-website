import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getLoginUrl } from "@/const";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bell,
  Coins,
  Crown,
  Eye,
  EyeOff,
  Gamepad2,
  KeyRound,
  Loader2,
  PawPrint,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type BreakdownItem = {
  label: string;
  href?: string;
};

type AdminSectionCard = {
  title: string;
  description: string;
  path: string;
  icon: typeof PawPrint;
  statusLabel: string;
  adminOnly: boolean;
  countLabel?: string;
  breakdownItems?: BreakdownItem[];
  quickActionLabel?: string;
  quickActionPath?: string;
};

function PasswordCell({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-foreground">{visible ? password : "••••••••"}</span>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={visible ? "Скрыть пароль" : "Показать пароль"}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  const className = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-border/70 bg-muted/40 text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]", className)}>
      {label}
    </Badge>
  );
}

export default function AdminHub() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const animalsQuery = trpc.adminAnimals.list.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const clubQuery = trpc.adminClub.dashboard.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const funnelQuery = trpc.adminAnalytics.userFunnel.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const pendingCountQuery = trpc.adminAnalytics.pendingApplicationsCount.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
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

  const animalStatusSummary = (animalsQuery.data ?? []).reduce(
    (accumulator, animal) => {
      if (animal.status === "hidden") accumulator.hidden += 1;
      if (animal.status === "archived") accumulator.archived += 1;
      if (["public_available", "public_limited", "fully_booked"].includes(animal.status)) {
        accumulator.published += 1;
      }
      return accumulator;
    },
    { hidden: 0, published: 0, archived: 0 },
  );

  const adminSections: AdminSectionCard[] = [
    {
      title: "Admin overview",
      description: "Единая точка входа в служебные разделы фермы с быстрым переходом к каталогам, операциям и ручным проверкам доступа.",
      path: "/admin",
      icon: ShieldCheck,
      statusLabel: "Маршрут активен",
      adminOnly: true,
      countLabel: "3 модуля в обзоре",
      quickActionLabel: "Перейти в dashboard",
      quickActionPath: "/dashboard",
    },
    {
      title: "Admin Animals",
      description: "Управление каталогом животных, статусами карточек, метаданными и визуальной витриной профилей.",
      path: "/admin/animals",
      icon: PawPrint,
      statusLabel: "CRUD и галерея",
      adminOnly: true,
      countLabel: isAdmin
        ? `${animalsQuery.data?.length ?? 0} животных в каталоге`
        : "Счётчик доступен после роли admin",
      breakdownItems: isAdmin
        ? [
            { label: `Опубликовано: ${animalStatusSummary.published}`, href: "/admin/animals?status=published" },
            { label: `Скрыто: ${animalStatusSummary.hidden}`, href: "/admin/animals?status=hidden" },
            { label: `В архиве: ${animalStatusSummary.archived}`, href: "/admin/animals?status=archived" },
          ]
        : [{ label: "Статусы появятся после подтверждения роли admin" }],
      quickActionLabel: "Открыть каталог животных",
      quickActionPath: "/admin/animals",
    },
    {
      title: "Admin Club",
      description: "Операции клуба, события, посты, участники и служебные процессы контентной и CRM-команды.",
      path: "/admin/club",
      icon: Crown,
      statusLabel: "Контент и CRM",
      adminOnly: true,
      countLabel: isAdmin
        ? `${clubQuery.data?.summary.totalPosts ?? 0} постов · ${clubQuery.data?.summary.totalEvents ?? 0} событий · ${clubQuery.data?.summary.totalMembers ?? 0} участников`
        : "Счётчик доступен после роли admin",
      quickActionLabel: "Открыть управление клубом",
      quickActionPath: "/admin/club",
    },
    {
      title: "Пользователи",
      description: "Полноценное управление пользователями: поиск, фильтры, пагинация, сброс паролей и синхронизация с Bitrix24.",
      path: "/admin/users",
      icon: Users,
      statusLabel: "Управление",
      adminOnly: true,
      countLabel: isAdmin
        ? `${funnelQuery.data?.totalUsers ?? 0} пользователей`
        : "Счётчик доступен после роли admin",
      quickActionLabel: "Открыть управление пользователями",
      quickActionPath: "/admin/users",
    },
    {
      title: "Маркетплейс фермы",
      description: "Управление категориями и товарами маркетплейса: корм, спа, прогулки, подарки. Цены в SKC, запасы, сезонность.",
      path: "/admin/marketplace",
      icon: ShoppingBag,
      statusLabel: "Забота",
      adminOnly: true,
      countLabel: "Категории и товары",
      quickActionLabel: "Открыть маркетплейс",
      quickActionPath: "/admin/marketplace",
    },
    {
      title: "Экономика токенов",
      description: "Банк и Выручка фермы, начисление SKC владельцам, массовые операции, журнал транзакций и настройки автоначислений.",
      path: "/admin/tokens",
      icon: Coins,
      statusLabel: "SKC",
      adminOnly: true,
      countLabel: "Банк · Выручка · Кошельки",
      quickActionLabel: "Открыть управление токенами",
      quickActionPath: "/admin/tokens",
    },
    {
      title: "Аналитика Заботы",
      description: "Чек-листы фермера, аналитика продаж маркетплейса, оборот токенов, метрики стада и рейтинги владельцев.",
      path: "/admin/gamification",
      icon: Gamepad2,
      statusLabel: "Аналитика",
      adminOnly: true,
      countLabel: "Чек-листы · Продажи · Метрики",
      quickActionLabel: "Открыть аналитику",
      quickActionPath: "/admin/gamification",
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Card className="rounded-[2rem] border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Проверяем статус доступа к admin-разделам…
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container max-w-4xl py-10 space-y-6">
          <Alert className="rounded-[2rem] border-amber-200 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Нужен вход в аккаунт</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>Страница `/admin` показывает доступ ко всем служебным разделам, поэтому сначала требуется авторизация.</p>
              <Button asChild className="rounded-full">
                <a href={getLoginUrl("/admin")}>Войти и открыть admin overview</a>
              </Button>
            </AlertDescription>
          </Alert>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Auth status</CardTitle>
                <CardDescription>Текущее состояние авторизации для служебного доступа.</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusPill label="Не авторизован" tone="warning" />
              </CardContent>
            </Card>
            <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Role status</CardTitle>
                <CardDescription>Роль пользователя будет показана после входа.</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusPill label="Роль неизвестна" />
              </CardContent>
            </Card>
            <Card className="rounded-[2rem] border-border/70 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Section access</CardTitle>
                <CardDescription>Admin-маршруты останутся закрыты до успешного входа.</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusPill label="Доступ не подтверждён" tone="warning" />
              </CardContent>
            </Card>
          </section>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6efe6_0%,#f7f2ea_35%,#faf7f3_100%)] text-foreground">
        <div className="container py-10 space-y-8">
          <section className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary">
                    Admin overview
                  </Badge>
                  <StatusPill label={user ? "Авторизован" : "Не авторизован"} tone={user ? "success" : "warning"} />
                  <StatusPill label={`Роль: ${String(user.role ?? "user")}`} tone={isAdmin ? "success" : "warning"} />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Служебный центр управления Sher Kozu</h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Эта страница собирает все admin-разделы в одном месте и сразу показывает, достаточно ли текущих прав,
                  чтобы открыть каталог животных, клубную операционку и следующие служебные модули.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="rounded-[1.5rem] border-border/70 bg-stone-50/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Auth</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">active</p>
                    <p className="mt-1 text-xs text-muted-foreground">Сессия распознана текущим auth-hook.</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-border/70 bg-stone-50/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Role</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{String(user.role ?? "user")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Роль читается напрямую из `auth.me`.</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-border/70 bg-stone-50/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Access</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{isAdmin ? "granted" : "limited"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Admin-модули требуют роль `admin`.</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-border/70 bg-stone-50/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Animals</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{isAdmin ? (animalsQuery.data?.length ?? 0) : "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Живой счётчик карточек из adminAnimals.list.</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-border/70 bg-stone-50/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Club</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{isAdmin ? `${clubQuery.data?.summary.totalPosts ?? 0}/${clubQuery.data?.summary.totalEvents ?? 0}/${clubQuery.data?.summary.totalMembers ?? 0}` : "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Посты, события и участники из adminClub.dashboard.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {!isAdmin ? (
            <Alert className="rounded-[2rem] border-amber-200 bg-amber-50 text-amber-900">
              <UserRound className="h-4 w-4" />
              <AlertTitle>Роль пользователя ограничивает доступ</AlertTitle>
              <AlertDescription className="mt-2 leading-6">
                Вы вошли в систему, но текущая роль не даёт полный доступ к admin-разделам. После назначения роли `admin`
                карточки ниже станут рабочими точками входа без дополнительных переходов.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* ── User Funnel Analytics ── */}
          {isAdmin && funnel && (
            <section className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Воронка пользователей</h2>
                  <p className="text-xs text-muted-foreground">Конверсия от регистрации до активного владения</p>
                </div>
                {pendingCount > 0 && (
                  <Badge className="ml-auto rounded-full border-amber-200 bg-amber-50 text-amber-700">
                    <Bell className="mr-1 h-3 w-3" />
                    {pendingCount} новых заявок
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("rounded-full gap-2", pendingCount === 0 && "ml-auto")}
                  disabled={syncBitrixMutation.isPending}
                  onClick={() => syncBitrixMutation.mutate()}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncBitrixMutation.isPending && "animate-spin")} />
                  {syncBitrixMutation.isPending ? "Синхронизация…" : "Синхронизация с Bitrix24"}
                </Button>
              </div>

              {/* Funnel bars */}
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Зарегистрировано", value: funnel.totalUsers, icon: Users, color: "bg-blue-500" },
                  { label: "Ожидают оплату", value: funnel.pendingPayment, icon: Bell, color: "bg-amber-500" },
                  { label: "Активных владельцев", value: funnel.activeOwners, icon: ShieldCheck, color: "bg-emerald-500" },
                  { label: "С планами", value: funnel.withPlans, icon: Crown, color: "bg-purple-500" },
                ].map((step) => {
                  const pct = funnel.totalUsers > 0 ? Math.round((step.value / funnel.totalUsers) * 100) : 0;
                  return (
                    <Card key={step.label} className="rounded-[1.5rem] border-border/70 bg-stone-50/80 shadow-none">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <step.icon className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{step.label}</p>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-foreground">{step.value}</p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                          <div className={cn("h-1.5 rounded-full transition-all", step.color)} style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{pct}% от всех</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Recent registrations table */}
              {funnel.recentUsers.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Последние регистрации</h3>
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/30">
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Имя</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Контакты</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Пароль</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Способ связи</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Роль</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Дата</th>
                          <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funnel.recentUsers.map((u: any) => (
                          <tr key={u.id} className="border-b border-border/40 last:border-0">
                            <td className="px-4 py-2.5 font-medium text-foreground">{u.name || "Без имени"}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col gap-0.5">
                                {u.email ? (
                                  <span className="text-xs text-foreground">{u.email}</span>
                                ) : null}
                                {u.phone ? (
                                  <span className="text-xs text-muted-foreground">{u.phone}</span>
                                ) : null}
                                {!u.email && !u.phone && (
                                  <span className="text-xs text-muted-foreground/60">Не указаны</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {u.plainPassword ? (
                                <PasswordCell password={u.plainPassword} />
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {u.preferredContact ? (
                                <Badge variant="outline" className="rounded-full text-[10px] border-border">
                                  {u.preferredContact === "email" ? "Email" : u.preferredContact === "phone" ? "Телефон" : "Мессенджер"}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={cn("rounded-full text-[10px]", u.role === "admin" ? "border-primary/30 text-primary" : "border-border text-muted-foreground")}>
                                {u.role || "user"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
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
                                Сбросить
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-3">
            {adminSections.map((section) => {
              const canOpen = isAdmin || !section.adminOnly;
              return (
                <Card key={section.path} className="rounded-[2rem] border-border/70 bg-white/95 shadow-sm">
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <section.icon className="h-6 w-6" />
                      </div>
                      <StatusPill label={canOpen ? "Доступ открыт" : "Требуется admin"} tone={canOpen ? "success" : "warning"} />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl text-foreground">{section.title}</CardTitle>
                      <CardDescription className="text-sm leading-6 text-muted-foreground">
                        {section.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={section.statusLabel} />
                      <StatusPill label={section.path} />
                      {section.countLabel ? <StatusPill label={section.countLabel} /> : null}
                    </div>
                    <div className="rounded-[1.25rem] border border-border/70 bg-stone-50/80 p-4 text-sm leading-6 text-muted-foreground space-y-3">
                      <p>
                        {canOpen
                          ? "Раздел готов к открытию из общего admin overview и sidebar-навигации."
                          : "Маршрут зарегистрирован, но интерфейс предупредит о нехватке прав до получения роли admin."}
                      </p>
                      {section.breakdownItems?.length ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {section.breakdownItems.map((item) => (
                            item.href && canOpen ? (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => setLocation(item.href!)}
                                className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-left text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                              >
                                {item.label}
                              </button>
                            ) : (
                              <div key={item.label} className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-foreground">
                                {item.label}
                              </div>
                            )
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <Button
                      className="w-full rounded-full"
                      variant={canOpen ? "default" : "outline"}
                      onClick={() => setLocation(section.path)}
                    >
                      {canOpen ? "Открыть раздел" : "Посмотреть статус доступа"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {section.quickActionPath ? (
                      <Button
                        className="w-full rounded-full"
                        variant="ghost"
                        onClick={() => setLocation(section.quickActionPath!)}
                      >
                        {section.quickActionLabel}
                      </Button>
                    ) : null}
                  </CardFooter>
                </Card>
              );
            })}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
