import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getLoginUrl } from "@/const";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Crown,
  Loader2,
  PawPrint,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useLocation } from "wouter";

type AdminSectionCard = {
  title: string;
  description: string;
  path: string;
  icon: typeof PawPrint;
  statusLabel: string;
  adminOnly: boolean;
};

const adminSections: AdminSectionCard[] = [
  {
    title: "Admin overview",
    description: "Единая точка входа в служебные разделы фермы с быстрым переходом к каталогам, операциям и ручным проверкам доступа.",
    path: "/admin",
    icon: ShieldCheck,
    statusLabel: "Маршрут активен",
    adminOnly: true,
  },
  {
    title: "Admin Animals",
    description: "Управление каталогом животных, статусами карточек, метаданными и визуальной витриной профилей.",
    path: "/admin/animals",
    icon: PawPrint,
    statusLabel: "CRUD и галерея",
    adminOnly: true,
  },
  {
    title: "Admin Club",
    description: "Операции клуба, события, посты, участники и служебные процессы контентной и CRM-команды.",
    path: "/admin/club",
    icon: Crown,
    statusLabel: "Контент и CRM",
    adminOnly: true,
  },
];

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
                    </div>
                    <div className="rounded-[1.25rem] border border-border/70 bg-stone-50/80 p-4 text-sm leading-6 text-muted-foreground">
                      {canOpen
                        ? "Раздел готов к открытию из общего admin overview и sidebar-навигации."
                        : "Маршрут зарегистрирован, но интерфейс предупредит о нехватке прав до получения роли admin."}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full rounded-full"
                      variant={canOpen ? "default" : "outline"}
                      onClick={() => setLocation(section.path)}
                    >
                      {canOpen ? "Открыть раздел" : "Посмотреть статус доступа"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
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
