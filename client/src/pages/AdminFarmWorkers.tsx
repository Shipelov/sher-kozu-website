import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import ScrollRemaining from "@/components/ScrollRemaining";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  milker: "Дояр",
  cheesemaker: "Сыродел",
  controller: "Контролёр",
  vet: "Ветеринар",
  manager: "Менеджер",
};

const ROLE_COLORS: Record<string, string> = {
  milker: "bg-blue-100 text-blue-700 border-blue-200",
  cheesemaker: "bg-amber-100 text-amber-700 border-amber-200",
  controller: "bg-indigo-100 text-indigo-700 border-indigo-200",
  vet: "bg-emerald-100 text-emerald-700 border-emerald-200",
  manager: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function AdminFarmWorkers() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  // ─── State ───
  const [showCreate, setShowCreate] = useState(false);
  const [showResetPw, setShowResetPw] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [showResetPwText, setShowResetPwText] = useState(false);

  // Create form state
  const [newLogin, setNewLogin] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("milker");
  const [showNewPw, setShowNewPw] = useState(false);

  // Edit dialog state
  const [editWorker, setEditWorker] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTelegram, setEditTelegram] = useState("");

  // ─── Queries & Mutations ───
  const workersQuery = trpc.farmAdmin.listWorkers.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const utils = trpc.useUtils();

  const createMutation = trpc.farmAdmin.createWorker.useMutation({
    onSuccess: (data) => {
      toast.success("Сотрудник создан", {
        description: `${data.name} (${data.login}) — ${ROLE_LABELS[data.role] ?? data.role}`,
      });
      setShowCreate(false);
      setNewLogin("");
      setNewName("");
      setNewPassword("");
      setNewRole("milker");
      void utils.farmAdmin.listWorkers.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  const toggleMutation = trpc.farmAdmin.toggleActive.useMutation({
    onSuccess: () => {
      toast.success("Статус обновлён");
      void utils.farmAdmin.listWorkers.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  const resetPwMutation = trpc.farmAdmin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Пароль сброшен", {
        description: "Сотрудник должен сменить пароль при следующем входе",
      });
      setShowResetPw(null);
      setResetPwValue("");
      void utils.farmAdmin.listWorkers.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  const updateMutation = trpc.farmAdmin.updateWorker.useMutation({
    onSuccess: () => {
      toast.success("Данные обновлены");
      setEditWorker(null);
      void utils.farmAdmin.listWorkers.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  const deleteMutation = trpc.farmAdmin.deleteWorker.useMutation({
    onSuccess: () => {
      toast.success("Сотрудник удалён");
      void utils.farmAdmin.listWorkers.invalidate();
    },
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  // ─── Derived ───
  const workers = workersQuery.data ?? [];
  // Filter out soft-deleted workers (login starts with __deleted_)
  const visibleWorkers = useMemo(
    () => workers.filter((w) => !w.login.startsWith("__deleted_")),
    [workers],
  );
  const activeCount = useMemo(() => visibleWorkers.filter((w) => w.isActive).length, [visibleWorkers]);

  // ─── Auth guards ───
  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container max-w-md py-20 text-center space-y-4">
          <h1 className="text-xl font-semibold">Вход в админ-панель</h1>
          <p className="text-sm text-muted-foreground">Для доступа необходимо авторизоваться.</p>
          <Button asChild className="rounded-full">
            <a href={getLoginUrl("/admin/farm-workers")}>Войти</a>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="container max-w-md py-20 text-center space-y-4">
          <h1 className="text-xl font-semibold">Доступ ограничен</h1>
          <p className="text-sm text-muted-foreground">
            Нужна роль{" "}
            <Badge variant="outline" className="rounded-full text-[10px]">
              admin
            </Badge>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  };

  const openEditDialog = (w: any) => {
    setEditWorker(w);
    setEditName(w.name);
    setEditRole(w.role);
    setEditPhone(w.phone ?? "");
    setEditTelegram(w.telegramChatId ?? "");
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6efe6_0%,#f7f2ea_35%,#faf7f3_100%)] text-foreground">
        <div className="container py-8 space-y-6">
          <PageBreadcrumbs
            className="mb-1"
            items={[
              { label: "Главная", href: "/" },
              { label: "Админ-панель", href: "/admin" },
              { label: "Сотрудники фермы" },
            ]}
          />

          {/* ── Header ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  <UserCog className="h-6 w-6 text-primary" />
                  Сотрудники фермы
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {visibleWorkers.length} всего · {activeCount} активных
                </p>
              </div>
            </div>
            <Button
              className="rounded-full gap-2 self-start"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Добавить сотрудника
            </Button>
          </div>

          {/* ── Workers Table ── */}
          <Card className="rounded-2xl border-border/70 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Список сотрудников
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {workersQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…
                </div>
              ) : visibleWorkers.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <UserCog className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p>Нет сотрудников</p>
                  <p className="text-xs mt-1">Нажмите «Добавить сотрудника» для создания</p>
                </div>
              ) : (
                <ScrollRemaining totalItems={visibleWorkers.length} itemHeight={56}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-border/70 bg-muted/30">
                          <TableHead className="text-xs font-medium uppercase tracking-wider">Имя</TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider">Логин</TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider">Роль</TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider">Статус</TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider">Telegram</TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider">Последний вход</TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider text-center">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleWorkers.map((w) => (
                          <TableRow key={w.id} className="border-b border-border/40 last:border-0">
                            <TableCell className="font-medium whitespace-nowrap">
                              {w.name}
                              {w.mustChangePassword && (
                                <Badge variant="outline" className="ml-2 rounded-full text-[9px] border-amber-300 text-amber-600">
                                  смена пароля
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {w.login}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`rounded-full text-[10px] ${ROLE_COLORS[w.role] ?? ""}`}
                              >
                                {ROLE_LABELS[w.role] ?? w.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {w.isActive ? (
                                <Badge variant="outline" className="rounded-full text-[10px] border-emerald-200 text-emerald-600">
                                  Активен
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full text-[10px] border-red-200 text-red-500">
                                  Отключён
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {w.telegramChatId ? (
                                <span className="font-mono text-xs">{w.telegramChatId}</span>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {w.lastLoginAt
                                ? new Date(w.lastLoginAt).toLocaleString("ru-RU", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                {/* Edit */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  title="Редактировать"
                                  onClick={() => openEditDialog(w)}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-blue-600" />
                                </Button>
                                {/* Toggle active */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  title={w.isActive ? "Отключить" : "Включить"}
                                  disabled={toggleMutation.isPending}
                                  onClick={() =>
                                    toggleMutation.mutate({
                                      workerId: w.id,
                                      isActive: !w.isActive,
                                    })
                                  }
                                >
                                  {w.isActive ? (
                                    <PowerOff className="h-3.5 w-3.5 text-red-500" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5 text-emerald-600" />
                                  )}
                                </Button>
                                {/* Reset password */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  title="Сбросить пароль"
                                  onClick={() => {
                                    setShowResetPw(w.id);
                                    const tmp = generateTempPassword();
                                    setResetPwValue(tmp);
                                  }}
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                                </Button>
                                {/* Delete */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  title="Удалить"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => {
                                    if (confirm(`Удалить сотрудника «${w.name}»? Это действие нельзя отменить.`)) {
                                      deleteMutation.mutate({ workerId: w.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollRemaining>
              )}
            </CardContent>
          </Card>

          {/* ── Hint: /myid ── */}
          <Card className="rounded-2xl border-border/70 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Привязка Telegram</p>
                  <p>
                    Сотрудник может получить свой chat_id, отправив команду{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/myid</code>{" "}
                    боту <strong>@sherkozu_bot</strong>. После этого администратор вносит chat_id в
                    профиль сотрудника для получения уведомлений.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Create Worker Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый сотрудник</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Имя</label>
              <Input
                placeholder="Иван Петров"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Логин</label>
              <Input
                placeholder="ivan"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Латиница, цифры, подчёркивание. Для входа на /farm
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Роль</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="milker">Дояр</SelectItem>
                  <SelectItem value="cheesemaker">Сыродел</SelectItem>
                  <SelectItem value="controller">Контролёр</SelectItem>
                  <SelectItem value="vet">Ветеринар</SelectItem>
                  <SelectItem value="manager">Менеджер</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Временный пароль</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNewPw ? "text" : "password"}
                    placeholder="Минимум 6 символов"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowNewPw(!showNewPw)}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setNewPassword(generateTempPassword())}
                >
                  Сгенерировать
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Сотрудник обязан сменить пароль при первом входе
              </p>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Отмена
            </Button>
            <Button
              disabled={
                !newLogin.trim() ||
                !newName.trim() ||
                newPassword.length < 6 ||
                createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  login: newLogin.trim(),
                  name: newName.trim(),
                  password: newPassword,
                  role: newRole as any,
                })
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Worker Dialog ── */}
      <Dialog open={editWorker !== null} onOpenChange={(open) => { if (!open) setEditWorker(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать сотрудника</DialogTitle>
          </DialogHeader>
          {editWorker && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Имя</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Роль</label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="milker">Дояр</SelectItem>
                    <SelectItem value="cheesemaker">Сыродел</SelectItem>
                    <SelectItem value="controller">Контролёр</SelectItem>
                    <SelectItem value="vet">Ветеринар</SelectItem>
                    <SelectItem value="manager">Менеджер</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Телефон</label>
                <Input
                  placeholder="+7 (999) 123-45-67"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Telegram Chat ID</label>
                <Input
                  placeholder="123456789"
                  value={editTelegram}
                  onChange={(e) => setEditTelegram(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Сотрудник получает ID командой /myid у @sherkozu_bot
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setEditWorker(null)}>
              Отмена
            </Button>
            <Button
              disabled={!editName.trim() || updateMutation.isPending}
              onClick={() => {
                if (!editWorker) return;
                updateMutation.mutate({
                  workerId: editWorker.id,
                  name: editName.trim(),
                  role: editRole as any,
                  phone: editPhone.trim() || null,
                  telegramChatId: editTelegram.trim() || null,
                });
              }}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={showResetPw !== null} onOpenChange={() => setShowResetPw(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Сброс пароля</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Новый временный пароль для сотрудника. Он должен будет сменить его при следующем входе.
            </p>
            <div className="relative">
              <Input
                type={showResetPwText ? "text" : "password"}
                value={resetPwValue}
                onChange={(e) => setResetPwValue(e.target.value)}
                className="pr-20 font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  className="text-muted-foreground p-1"
                  onClick={() => setShowResetPwText(!showResetPwText)}
                >
                  {showResetPwText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground p-1"
                  onClick={() => {
                    navigator.clipboard.writeText(resetPwValue);
                    toast.success("Скопировано");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setShowResetPw(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={resetPwValue.length < 6 || resetPwMutation.isPending}
              onClick={() => {
                if (showResetPw !== null) {
                  resetPwMutation.mutate({
                    workerId: showResetPw,
                    newPassword: resetPwValue,
                  });
                }
              }}
            >
              {resetPwMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Сбросить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
