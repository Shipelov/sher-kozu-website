import DashboardLayout from "@/components/DashboardLayout";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Users,
  X,
  Wallet,
  Lock,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import UserDetailDrawer from "@/components/UserDetailDrawer";

// ─── Password Cell (show/hide) ───────────────────────────────
function PasswordCell({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-foreground">
        {visible ? password : "••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={visible ? "Скрыть" : "Показать"}
      >
        {visible ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function AdminUsers() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin =
    user?.role === "admin" ||
    user?.openId === import.meta.env.VITE_OWNER_OPEN_ID;

  // ─── Query state ───
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loginMethodFilter, setLoginMethodFilter] = useState<string>("all");
  const [bitrixFilter, setBitrixFilter] = useState<string>("all");
  const [passwordFilter, setPasswordFilter] = useState<string>("all");
  const [lastLoginFilter, setLastLoginFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
    },
    [],
  );

  // Build query input
  const queryInput = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      role:
        roleFilter !== "all"
          ? (roleFilter as "user" | "admin")
          : undefined,
      loginMethod: loginMethodFilter !== "all" ? loginMethodFilter : undefined,
      hasBitrix:
        bitrixFilter === "yes"
          ? true
          : bitrixFilter === "no"
            ? false
            : undefined,
      hasPassword:
        passwordFilter === "yes"
          ? true
          : passwordFilter === "no"
            ? false
            : undefined,
      lastLogin:
        lastLoginFilter !== "all"
          ? (lastLoginFilter as "today" | "week" | "month" | "inactive" | "never")
          : undefined,
      sortBy: sortBy as "createdAt" | "name" | "email" | "lastSignedIn",
      sortOrder,
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      roleFilter,
      loginMethodFilter,
      bitrixFilter,
      passwordFilter,
      lastLoginFilter,
      sortBy,
      sortOrder,
    ],
  );

  const usersQuery = trpc.adminAnalytics.listUsers.useQuery(queryInput, {
    enabled: isAdmin,
    placeholderData: (prev) => prev,
  });

  const utils = trpc.useUtils();

  // Bitrix sync mutation
  const syncBitrix = trpc.adminSync.syncBitrixContacts.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Синхронизация завершена: ${data.synced} обработано, ${data.created} создано, ${data.updated} обновлено`,
      );
      utils.adminAnalytics.listUsers.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка синхронизации: ${err.message}`);
    },
  });

  // Reset password mutation
  const resetPassword = trpc.adminSync.resetUserPassword.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Пароль для ${data.userName || data.userEmail} сброшен: ${data.newPassword}`,
        { duration: 15000 },
      );
      utils.adminAnalytics.listUsers.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка сброса пароля: ${err.message}`);
    },
  });

  // ─── Tab state (active vs trash) ───
  const [activeTab, setActiveTab] = useState<"active" | "trash">("active");

  // Soft-delete mutation
  const softDelete = trpc.adminTrash.softDelete.useMutation({
    onSuccess: () => {
      toast.success("Пользователь перемещён в корзину");
      utils.adminAnalytics.listUsers.invalidate();
      utils.adminTrash.list.invalidate();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  // Restore mutation
  const restoreUser = trpc.adminTrash.restore.useMutation({
    onSuccess: () => {
      toast.success("Пользователь восстановлен");
      utils.adminAnalytics.listUsers.invalidate();
      utils.adminTrash.list.invalidate();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  // Permanent delete mutation
  const permanentDelete = trpc.adminTrash.permanentDelete.useMutation({
    onSuccess: (data) => {
      const msg = data.deletedOwnerships.length > 0
        ? `Пользователь удалён. ${data.deletedOwnerships.length} долей возвращены ферме.`
        : "Пользователь окончательно удалён.";
      toast.success(msg);
      utils.adminTrash.list.invalidate();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  // Auto-cleanup mutation
  const autoCleanup = trpc.adminTrash.autoCleanup.useMutation({
    onSuccess: (data) => {
      if (data.cleaned === 0) {
        toast.info("Нет записей для очистки (все менее 30 дней)");
      } else {
        toast.success(`Очищено ${data.cleaned} пользователей. ${data.deletedOwnerships.length} долей возвращены ферме.`);
      }
      utils.adminTrash.list.invalidate();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  // Freeze wallet mutation
  const freezeWalletMut = trpc.gamification.farmAccounts.freezeWallet.useMutation({
    onSuccess: () => {
      toast.success("Счёт заблокирован");
      utils.adminAnalytics.listUsers.invalidate();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  // Unfreeze wallet mutation
  const unfreezeWalletMut = trpc.gamification.farmAccounts.unfreezeWallet.useMutation({
    onSuccess: () => {
      toast.success("Счёт разблокирован");
      utils.adminAnalytics.listUsers.invalidate();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  // Trash list query
  const trashQuery = trpc.adminTrash.list.useQuery(undefined, {
    enabled: isAdmin && activeTab === "trash",
  });

  // Confirmation state for permanent delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // User detail drawer state
  const [selectedUserOpenId, setSelectedUserOpenId] = useState<string | null>(null);

  // ─── Export helpers ───
  const exportFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      role:
        roleFilter !== "all"
          ? (roleFilter as "user" | "admin")
          : undefined,
      loginMethod: loginMethodFilter !== "all" ? loginMethodFilter : undefined,
      hasBitrix:
        bitrixFilter === "yes"
          ? true
          : bitrixFilter === "no"
            ? false
            : undefined,
      hasPassword:
        passwordFilter === "yes"
          ? true
          : passwordFilter === "no"
            ? false
            : undefined,
      lastLogin:
        lastLoginFilter !== "all"
          ? (lastLoginFilter as "today" | "week" | "month" | "inactive" | "never")
          : undefined,
      sortBy: sortBy as "createdAt" | "name" | "email" | "lastSignedIn",
      sortOrder,
    }),
    [debouncedSearch, roleFilter, loginMethodFilter, bitrixFilter, passwordFilter, lastLoginFilter, sortBy, sortOrder],
  );

  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const EXPORT_COLUMNS = [
    { key: "id", label: "ID" },
    { key: "name", label: "Имя" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Телефон" },
    { key: "role", label: "Роль" },
    { key: "loginMethod", label: "Метод входа" },
    { key: "preferredContact", label: "Предпочтительный контакт" },
    { key: "bitrix24ContactId", label: "Bitrix24 ID" },
    { key: "onboardingCompleted", label: "Онбординг" },
    { key: "createdAt", label: "Дата регистрации" },
    { key: "lastSignedIn", label: "Последний вход" },
  ] as const;

  const formatExportValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (key === "createdAt" || key === "lastSignedIn") {
      return new Date(value as string).toLocaleString("ru-RU");
    }
    if (key === "onboardingCompleted") return value ? "Да" : "Нет";
    if (key === "role") return value === "admin" ? "Админ" : "Пользователь";
    if (key === "loginMethod") {
      const methods: Record<string, string> = { local: "Локальный", oauth: "OAuth", bitrix: "Bitrix" };
      return methods[value as string] ?? String(value);
    }
    return String(value);
  };

  const handleExportCSV = async () => {
    setExporting("csv");
    try {
      const rows = await utils.adminAnalytics.exportUsers.fetch(exportFilters);
      if (!rows.length) {
        toast.info("Нет данных для экспорта");
        return;
      }
      const BOM = "\uFEFF";
      const header = EXPORT_COLUMNS.map((c) => c.label).join(";");
      const lines = rows.map((row: Record<string, unknown>) =>
        EXPORT_COLUMNS.map((c) => {
          const val = formatExportValue(c.key, row[c.key]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(";"),
      );
      const csv = BOM + header + "\n" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `пользователи_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано ${rows.length} записей в CSV`);
    } catch (err: unknown) {
      toast.error(`Ошибка экспорта: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting("xlsx");
    try {
      const rows = await utils.adminAnalytics.exportUsers.fetch(exportFilters);
      if (!rows.length) {
        toast.info("Нет данных для экспорта");
        return;
      }
      const XLSX = await import("xlsx");
      const wsData = [
        EXPORT_COLUMNS.map((c) => c.label),
        ...rows.map((row: Record<string, unknown>) =>
          EXPORT_COLUMNS.map((c) => formatExportValue(c.key, row[c.key])),
        ),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Auto-width columns
      ws["!cols"] = EXPORT_COLUMNS.map((c, i) => ({
        wch: Math.max(
          c.label.length,
          ...rows.map((r: Record<string, unknown>) => formatExportValue(c.key, r[c.key]).length),
        ) + 2,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Пользователи");
      XLSX.writeFile(wb, `пользователи_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Экспортировано ${rows.length} записей в Excel`);
    } catch (err: unknown) {
      toast.error(`Ошибка экспорта: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
    } finally {
      setExporting(null);
    }
  };

  // Sort toggle
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Clear all filters
  const hasActiveFilters =
    roleFilter !== "all" ||
    loginMethodFilter !== "all" ||
    bitrixFilter !== "all" ||
    passwordFilter !== "all" ||
    lastLoginFilter !== "all" ||
    search !== "";

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setLoginMethodFilter("all");
    setBitrixFilter("all");
    setPasswordFilter("all");
    setLastLoginFilter("all");
    setPage(1);
  };

  // ─── Auth guards ───
  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка…
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container max-w-4xl py-10 space-y-4">
          <Card className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-semibold">Нужен вход в аккаунт</span>
              </div>
              <Button asChild className="rounded-full">
                <a href={getLoginUrl("/admin/users")}>Войти</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="container max-w-4xl py-10">
          <Card className="rounded-2xl border-red-200 bg-red-50 text-red-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-semibold">Доступ запрещён</span>
              </div>
              <p className="mt-2 text-sm">
                Эта страница доступна только администраторам.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const data = usersQuery.data;
  const users_list = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Управление пользователями
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activeTab === "active"
                  ? `${total} пользовател${total === 1 ? "ь" : total < 5 ? "я" : "ей"} в системе`
                  : `${trashQuery.data?.length ?? 0} в корзине`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={handleExportCSV}
              disabled={exporting !== null}
            >
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={handleExportExcel}
              disabled={exporting !== null}
            >
              {exporting === "xlsx" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={() => syncBitrix.mutate()}
              disabled={syncBitrix.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncBitrix.isPending ? "animate-spin" : ""}`}
              />
              Bitrix24
            </Button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 border-b border-border/50 pb-1">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "active"
                ? "bg-white border border-b-white border-border/70 text-foreground -mb-[1px]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Активные
          </button>
          <button
            onClick={() => setActiveTab("trash")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "trash"
                ? "bg-white border border-b-white border-border/70 text-foreground -mb-[1px]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trash2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Корзина
            {trashQuery.data && trashQuery.data.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] rounded-full px-1.5 py-0">
                {trashQuery.data.length}
              </Badge>
            )}
          </button>
        </div>

        {activeTab === "active" && (
        <>
        {/* Search + Filters */}
        <Card className="rounded-2xl border-border/70 bg-white/95 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени, email или телефону…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Фильтры:
              </div>

              <Select
                value={roleFilter}
                onValueChange={handleFilterChange(setRoleFilter)}
              >
                <SelectTrigger className="w-[140px] rounded-xl h-9 text-sm">
                  <SelectValue placeholder="Роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все роли</SelectItem>
                  <SelectItem value="user">Пользователь</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={loginMethodFilter}
                onValueChange={handleFilterChange(setLoginMethodFilter)}
              >
                <SelectTrigger className="w-[160px] rounded-xl h-9 text-sm">
                  <SelectValue placeholder="Метод входа" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все методы</SelectItem>
                  <SelectItem value="local">Локальный</SelectItem>
                  <SelectItem value="bitrix">Bitrix</SelectItem>
                  <SelectItem value="manus">Manus OAuth</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={bitrixFilter}
                onValueChange={handleFilterChange(setBitrixFilter)}
              >
                <SelectTrigger className="w-[160px] rounded-xl h-9 text-sm">
                  <SelectValue placeholder="Bitrix24" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все (Bitrix)</SelectItem>
                  <SelectItem value="yes">Привязан</SelectItem>
                  <SelectItem value="no">Не привязан</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={passwordFilter}
                onValueChange={handleFilterChange(setPasswordFilter)}
              >
                <SelectTrigger className="w-[160px] rounded-xl h-9 text-sm">
                  <SelectValue placeholder="Пароль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все (пароль)</SelectItem>
                  <SelectItem value="yes">Есть пароль</SelectItem>
                  <SelectItem value="no">Без пароля</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={lastLoginFilter}
                onValueChange={handleFilterChange(setLastLoginFilter)}
              >
                <SelectTrigger className="w-[180px] rounded-xl h-9 text-sm">
                  <SelectValue placeholder="Последний вход" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все (вход)</SelectItem>
                  <SelectItem value="today">Сегодня</SelectItem>
                  <SelectItem value="week">За неделю</SelectItem>
                  <SelectItem value="month">За месяц</SelectItem>
                  <SelectItem value="inactive">Неактивные (&gt;30 дн.)</SelectItem>
                  <SelectItem value="never">Никогда не входили</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="rounded-xl h-9 text-sm gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Сбросить
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-2xl border-border/70 bg-white/95 shadow-sm overflow-hidden">
          {usersQuery.isLoading ? (
            <CardContent className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка пользователей…
            </CardContent>
          ) : users_list.length === 0 ? (
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Пользователи не найдены</p>
              <p className="text-sm mt-1">
                Попробуйте изменить параметры поиска или фильтры
              </p>
            </CardContent>
          ) : (
            <ScrollRemaining totalItems={users_list.length} itemHeight={52} className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Имя
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("email")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Email
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Метод</TableHead>
                    <TableHead>Bitrix</TableHead>
                    <TableHead>Пароль</TableHead>
                    <TableHead>Счёт</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("createdAt")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Регистрация
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("lastSignedIn")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Последний вход
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users_list.map((u: any, idx: number) => (
                    <TableRow
                      key={u.id}
                      className="hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => setSelectedUserOpenId(u.openId)}
                    >
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {(page - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[180px] truncate">
                        {u.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {u.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className="text-[10px] rounded-full"
                        >
                          {u.role === "admin" ? "Админ" : "Пользователь"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.loginMethod || "—"}
                      </TableCell>
                      <TableCell>
                        {u.bitrix24ContactId ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] rounded-full border-green-300 text-green-700 bg-green-50"
                          >
                            #{u.bitrix24ContactId}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {u.plainPassword ? (
                          <PasswordCell password={u.plainPassword} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Wallet status indicator */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {u.walletStatus ? (
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] rounded-full ${
                                u.walletStatus === "active"
                                  ? "border-green-300 text-green-700 bg-green-50"
                                  : u.walletStatus === "frozen"
                                    ? "border-red-300 text-red-700 bg-red-50"
                                    : "border-gray-300 text-gray-500 bg-gray-50"
                              }`}
                            >
                              {u.walletStatus === "active" ? (
                                <><Wallet className="h-3 w-3 mr-0.5" />{((u.walletBalance ?? 0) / 100).toLocaleString()} SKC</>
                              ) : u.walletStatus === "frozen" ? (
                                <><Lock className="h-3 w-3 mr-0.5" />Заблок.</>
                              ) : (
                                <>Архив</>
                              )}
                            </Badge>
                            {u.walletStatus === "active" && u.role !== "admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-muted-foreground hover:text-red-500"
                                title="Заблокировать счёт"
                                onClick={() => {
                                  if (confirm(`Заблокировать счёт ${u.name || u.email}? Пользователь не сможет тратить и получать токены.`)) {
                                    freezeWalletMut.mutate({ ownerOpenId: u.openId });
                                  }
                                }}
                                disabled={freezeWalletMut.isPending}
                              >
                                <Lock className="h-3 w-3" />
                              </Button>
                            )}
                            {u.walletStatus === "frozen" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-muted-foreground hover:text-green-600"
                                title="Разблокировать счёт"
                                onClick={() => {
                                  unfreezeWalletMut.mutate({ ownerOpenId: u.openId });
                                }}
                                disabled={unfreezeWalletMut.isPending}
                              >
                                <Unlock className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {u.lastSignedIn
                          ? new Date(u.lastSignedIn).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-orange-600"
                            title="Сбросить пароль"
                            onClick={() => resetPassword.mutate({ userId: u.id })}
                            disabled={resetPassword.isPending}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500"
                            title="В корзину"
                            onClick={() => {
                              if (confirm(`Переместить ${u.name || u.email} в корзину? Доступ в кабинет будет заблокирован.`)) {
                                softDelete.mutate({ userId: u.id });
                              }
                            }}
                            disabled={softDelete.isPending || u.role === "admin"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollRemaining>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Страница {page} из {totalPages} · {total} записей
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  title="Первая страница"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Предыдущая"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                {(() => {
                  const pages: number[] = [];
                  const start = Math.max(1, page - 2);
                  const end = Math.min(totalPages, page + 2);
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages.map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-full text-sm"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ));
                })()}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  title="Следующая"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  title="Последняя страница"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
        </>
        )}

        {/* Trash Tab */}
        {activeTab === "trash" && (
          <Card className="rounded-2xl border-border/70 bg-white/95 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Корзина
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => autoCleanup.mutate()}
                    disabled={autoCleanup.isPending}
                  >
                    {autoCleanup.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Очистить (старше 30 дней)
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Пользователи в корзине не могут войти в свой кабинет. Через 30 дней данные удаляются окончательно, а доли возвращаются ферме.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {trashQuery.isLoading ? (
                <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Загрузка…
                </div>
              ) : !trashQuery.data?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Корзина пуста</p>
                  <p className="text-sm mt-1">Удалённые пользователи появятся здесь</p>
                </div>
              ) : (
                <ScrollRemaining totalItems={trashQuery.data?.length ?? 0} itemHeight={52} className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50/50">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Имя</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>Удалён</TableHead>
                        <TableHead>Осталось дней</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trashQuery.data.map((u: any, idx: number) => {
                        const deletedDate = new Date(u.deletedAt);
                        const daysInTrash = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
                        const daysRemaining = Math.max(0, 30 - daysInTrash);
                        return (
                          <TableRow key={u.id} className="hover:bg-red-50/30">
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-sm max-w-[180px] truncate">
                              {u.name || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {u.email || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.phone || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={u.role === "admin" ? "default" : "secondary"}
                                className="text-[10px] rounded-full"
                              >
                                {u.role === "admin" ? "Админ" : "Пользователь"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {deletedDate.toLocaleDateString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={daysRemaining <= 7 ? "destructive" : "secondary"}
                                className="text-[10px] rounded-full"
                              >
                                {daysRemaining} дн.
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Восстановить"
                                  onClick={() => restoreUser.mutate({ userId: u.id })}
                                  disabled={restoreUser.isPending}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                                {confirmDeleteId === u.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 rounded-full text-xs gap-1"
                                      onClick={() => {
                                        permanentDelete.mutate({ userId: u.id });
                                        setConfirmDeleteId(null);
                                      }}
                                      disabled={permanentDelete.isPending}
                                    >
                                      <AlertTriangle className="h-3 w-3" />
                                      Да, удалить
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 rounded-full text-xs"
                                      onClick={() => setConfirmDeleteId(null)}
                                    >
                                      Отмена
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="Удалить окончательно"
                                    onClick={() => setConfirmDeleteId(u.id)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollRemaining>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Detail Drawer */}
      <UserDetailDrawer
        userOpenId={selectedUserOpenId}
        onClose={() => setSelectedUserOpenId(null)}
      />
    </DashboardLayout>
  );
}
