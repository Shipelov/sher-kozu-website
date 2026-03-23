import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  Coins,
  Loader2,
  RefreshCw,
  Send,
  Users,
  Wallet,
  Settings,
  History,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AdminTokens() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("overview");
  const [allocateUserId, setAllocateUserId] = useState("");
  const [allocateAmount, setAllocateAmount] = useState(100);
  const [allocateReason, setAllocateReason] = useState("");
  const [bulkAmount, setBulkAmount] = useState(50);
  const [bulkReason, setBulkReason] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState<string>("all");

  // Queries
  const accountsQuery = trpc.gamification.farmAccounts.get.useQuery(undefined, { enabled: isAdmin });
  // For admin wallets view, we'll use the users list from admin panel
  // The wallet.balance is per-user, so we need a different approach for admin view
  const txQuery = trpc.gamification.farmAccounts.transactions.useQuery(
    { limit: 20, offset: (txPage - 1) * 20 },
    { enabled: isAdmin }
  );
  const autoSettingsQuery = trpc.gamification.farmAccounts.autoAllocation.get.useQuery(undefined, { enabled: isAdmin });

  // Mutations
  const allocate = trpc.gamification.farmAccounts.grantTokens.useMutation({
    onSuccess: () => {
      toast.success("Токены начислены");
      utils.gamification.farmAccounts.get.invalidate();
      utils.gamification.farmAccounts.transactions.invalidate();
      setAllocateUserId("");
      setAllocateAmount(100);
      setAllocateReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkAllocate = trpc.gamification.farmAccounts.bulkGrant.useMutation({
    onSuccess: () => {
      toast.success("Массовое начисление выполнено");
      utils.gamification.farmAccounts.get.invalidate();
      utils.gamification.farmAccounts.transactions.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateAutoSettings = trpc.gamification.farmAccounts.autoAllocation.update.useMutation({
    onSuccess: () => {
      toast.success("Настройки автоначислений обновлены");
      utils.gamification.farmAccounts.autoAllocation.get.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const farmData = accountsQuery.data;
  const overview = farmData ? {
    bank: farmData.bank?.balanceSKC ?? 0,
    revenue: farmData.revenue?.balanceSKC ?? 0,
    totalOwnerBalances: 0,
    ownerCount: 0,
  } : null;
  const wallets: any[] = [];
  const transactions = txQuery.data;
  const autoSettings = autoSettingsQuery.data;

  // Auto-allocation local state
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoAmount, setAutoAmount] = useState(100);
  const [autoMode, setAutoMode] = useState("monthly");

  // Sync auto settings when loaded
  useMemo(() => {
    if (autoSettings) {
      setAutoEnabled(autoSettings.isEnabled === 1);
      setAutoAmount(autoSettings.amountSKC);
    }
  }, [autoSettings]);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Экономика токенов</h1>
              <p className="text-sm text-muted-foreground">Банк, Выручка, кошельки владельцев и журнал транзакций</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <Coins className="h-3.5 w-3.5" />
            SKC
          </Badge>
        </div>

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Банк фермы</p>
                    <p className="text-2xl font-bold text-emerald-800">{overview.bank.toLocaleString()} SKC</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Выручка фермы</p>
                    <p className="text-2xl font-bold text-amber-800">{overview.revenue.toLocaleString()} SKC</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">У владельцев</p>
                    <p className="text-2xl font-bold text-blue-800">{overview.totalOwnerBalances.toLocaleString()} SKC</p>
                    <p className="text-[10px] text-blue-500">{overview.ownerCount} кошельков</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Кошельки</TabsTrigger>
            <TabsTrigger value="allocate">Начисление</TabsTrigger>
            <TabsTrigger value="transactions">Журнал</TabsTrigger>
            <TabsTrigger value="settings">Автоначисления</TabsTrigger>
          </TabsList>

          {/* ─── Wallets Tab ─── */}
          <TabsContent value="overview" className="space-y-4">
            {wallets.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Кошельков пока нет. Начислите токены первому владельцу.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {wallets.map((w: any) => (
                  <Card key={w.openId}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {(w.name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{w.name || w.openId}</p>
                          <p className="text-[10px] text-muted-foreground">{w.email || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-700">{w.balance.toLocaleString()} SKC</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setAllocateUserId(w.openId);
                            setActiveTab("allocate");
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" /> Начислить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Allocate Tab ─── */}
          <TabsContent value="allocate" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Individual allocation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="h-4 w-4" /> Индивидуальное начисление
                  </CardTitle>
                  <CardDescription>Начислить SKC конкретному владельцу</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Владелец</Label>
                    <Select value={allocateUserId} onValueChange={setAllocateUserId}>
                      <SelectTrigger><SelectValue placeholder="Выберите владельца" /></SelectTrigger>
                      <SelectContent>
                        {wallets.map((w: any) => (
                          <SelectItem key={w.openId} value={w.openId}>{w.name || w.openId} ({w.balance} SKC)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Сумма SKC</Label>
                    <Input type="number" min={1} value={allocateAmount} onChange={e => setAllocateAmount(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Причина</Label>
                    <Input value={allocateReason} onChange={e => setAllocateReason(e.target.value)} placeholder="Ежемесячное начисление" />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => allocate.mutate({ ownerOpenId: allocateUserId, amountSKC: allocateAmount, memo: allocateReason || "Ручное начисление" })}
                    disabled={allocate.isPending || !allocateUserId || allocateAmount < 1}
                  >
                    {allocate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Начислить {allocateAmount} SKC
                  </Button>
                </CardContent>
              </Card>

              {/* Bulk allocation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" /> Массовое начисление
                  </CardTitle>
                  <CardDescription>Начислить SKC всем владельцам с активными животными</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Сумма SKC каждому</Label>
                    <Input type="number" min={1} value={bulkAmount} onChange={e => setBulkAmount(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Причина</Label>
                    <Input value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="Ежемесячное начисление" />
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Начислить ${bulkAmount} SKC всем владельцам?`)) {
                        bulkAllocate.mutate({ ownerOpenIds: wallets.map((w: any) => w.openId), amountSKC: bulkAmount, memo: bulkReason || "Массовое начисление" });
                      }
                    }}
                    disabled={bulkAllocate.isPending || bulkAmount < 1}
                  >
                    {bulkAllocate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Начислить всем по {bulkAmount} SKC
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Transactions Tab ─── */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={txType} onValueChange={v => { setTxType(v); setTxPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="allocation">Начисление</SelectItem>
                  <SelectItem value="purchase">Покупка</SelectItem>
                  <SelectItem value="refund">Возврат</SelectItem>
                  <SelectItem value="bonus">Бонус</SelectItem>
                  <SelectItem value="adjustment">Корректировка</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => txQuery.refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {txQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : !transactions?.items?.length ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Транзакций пока нет</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {transactions.items.map((tx: any) => {
                    const isIncome = tx.type === "allocation" || tx.type === "refund" || tx.type === "bonus";
                    const typeLabels: Record<string, string> = {
                      allocation: "Начисление",
                      purchase: "Покупка",
                      refund: "Возврат",
                      bonus: "Бонус",
                      adjustment: "Корректировка",
                    };
                    const typeColors: Record<string, string> = {
                      allocation: "bg-emerald-100 text-emerald-700",
                      purchase: "bg-amber-100 text-amber-700",
                      refund: "bg-blue-100 text-blue-700",
                      bonus: "bg-purple-100 text-purple-700",
                      adjustment: "bg-gray-100 text-gray-700",
                    };

                    return (
                      <Card key={tx.id}>
                        <CardContent className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIncome ? "bg-emerald-100" : "bg-amber-100"}`}>
                              {isIncome ? <ArrowDownRight className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-amber-600" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] ${typeColors[tx.type] ?? ""}`}>
                                  {typeLabels[tx.type] ?? tx.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{tx.userName || tx.userId}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${isIncome ? "text-emerald-600" : "text-amber-600"}`}>
                              {isIncome ? "+" : "-"}{tx.amount} SKC
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Страница {txPage} из {Math.ceil((transactions.total ?? 0) / 20)}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>
                      Назад
                    </Button>
                    <Button variant="outline" size="sm" disabled={txPage >= Math.ceil((transactions.total ?? 0) / 20)} onClick={() => setTxPage(p => p + 1)}>
                      Далее
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ─── Auto-allocation Settings Tab ─── */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Автоматические начисления
                </CardTitle>
                <CardDescription>
                  Настройте регулярные начисления SKC всем владельцам с активными животными
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
                  <Label>{autoEnabled ? "Включено" : "Выключено"}</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Сумма SKC</Label>
                    <Input type="number" min={1} value={autoAmount} onChange={e => setAutoAmount(Number(e.target.value))} disabled={!autoEnabled} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Режим</Label>
                    <Select value={autoMode} onValueChange={setAutoMode} disabled={!autoEnabled}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Ежемесячно</SelectItem>
                        <SelectItem value="weekly">Еженедельно</SelectItem>
                        <SelectItem value="biweekly">Раз в 2 недели</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => updateAutoSettings.mutate({ isEnabled: autoEnabled ? 1 : 0, amountSKC: autoAmount })}
                  disabled={updateAutoSettings.isPending}
                >
                  {updateAutoSettings.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Сохранить настройки
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
