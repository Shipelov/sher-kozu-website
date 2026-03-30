import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  User,
  Heart,
  Package,
  Truck,
  MessageCircle,
  History,
  Wallet,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Calendar,
  Shield,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

interface UserDetailDrawerProps {
  userOpenId: string | null;
  onClose: () => void;
}

function formatDate(d: string | number | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return (minor / 100).toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  });
}

function formatSKC(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `${amount.toLocaleString()} SKC`;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "default", label: "Активно" },
    confirmed: { variant: "default", label: "Подтверждено" },
    pending: { variant: "secondary", label: "Ожидание" },
    draft: { variant: "outline", label: "Черновик" },
    cancelled: { variant: "destructive", label: "Отменено" },
    expired: { variant: "destructive", label: "Истекло" },
    delivered: { variant: "default", label: "Доставлено" },
    scheduled: { variant: "secondary", label: "Запланировано" },
    preparing: { variant: "secondary", label: "Подготовка" },
  };
  const info = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export default function UserDetailDrawer({ userOpenId, onClose }: UserDetailDrawerProps) {
  const [showPassword, setShowPassword] = useState(false);

  const { data, isLoading, error } = trpc.adminUserDetails.getDetails.useQuery(
    { userOpenId: userOpenId! },
    { enabled: !!userOpenId }
  );

  if (!userOpenId) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto w-full max-w-3xl bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Карточка пользователя
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-20 text-red-500">
              Ошибка загрузки: {error.message}
            </div>
          )}

          {data && (
            <>
              {/* Profile Card */}
              <Card className="rounded-2xl border-border/70">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0">
                      {data.user.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <h3 className="text-xl font-semibold">{data.user.name || "Без имени"}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={data.user.role === "admin" ? "default" : "secondary"}>
                            {data.user.role === "admin" ? "Администратор" : "Пользователь"}
                          </Badge>
                          <Badge variant="outline">{data.user.loginMethod || "—"}</Badge>
                          {data.user.bitrix24ContactId && (
                            <Badge variant="outline" className="gap-1">
                              <ExternalLink className="h-3 w-3" />
                              Bitrix #{data.user.bitrix24ContactId}
                            </Badge>
                          )}
                          {data.user.deletedAt && (
                            <Badge variant="destructive">В корзине</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{data.user.email || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span>{data.user.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span>Регистрация: {formatDate(data.user.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="h-4 w-4 shrink-0" />
                          <span>Последний вход: {formatDate(data.user.lastSignedIn)}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="ownerships" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto flex-nowrap rounded-xl bg-muted/50 p-1">
                  <TabsTrigger value="ownerships" className="gap-1.5 rounded-lg text-xs">
                    <Heart className="h-3.5 w-3.5" />
                    Владения ({data.ownerships.length})
                  </TabsTrigger>
                  <TabsTrigger value="plans" className="gap-1.5 rounded-lg text-xs">
                    <Package className="h-3.5 w-3.5" />
                    Планы ({data.productPlans.length})
                  </TabsTrigger>
                  <TabsTrigger value="deliveries" className="gap-1.5 rounded-lg text-xs">
                    <Truck className="h-3.5 w-3.5" />
                    Доставки ({data.deliveries.length})
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="gap-1.5 rounded-lg text-xs">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Чат ({data.chatMessages.length})
                  </TabsTrigger>
                  <TabsTrigger value="wallet" className="gap-1.5 rounded-lg text-xs">
                    <Wallet className="h-3.5 w-3.5" />
                    Кошелёк ({data.wallets.length})
                  </TabsTrigger>
                  <TabsTrigger value="log" className="gap-1.5 rounded-lg text-xs">
                    <History className="h-3.5 w-3.5" />
                    Лог ({data.changeLog.length})
                  </TabsTrigger>
                </TabsList>

                {/* Ownerships Tab */}
                <TabsContent value="ownerships" className="mt-4">
                  {data.ownerships.length === 0 ? (
                    <EmptyState icon={Heart} text="Нет владений животными" />
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Животное</TableHead>
                            <TableHead>Вид</TableHead>
                            <TableHead>Слот</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Цена</TableHead>
                            <TableHead>Дата начала</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.ownerships.map((o: any) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-medium">{o.animalName || `#${o.animalId}`}</TableCell>
                              <TableCell>{o.animalSpecies || "—"}</TableCell>
                              <TableCell>{o.slotIndex ?? "—"}</TableCell>
                              <TableCell><StatusBadge status={o.status} /></TableCell>
                              <TableCell>{formatMoney(o.priceMinor)}</TableCell>
                              <TableCell>{formatDate(o.startsAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Product Plans Tab */}
                <TabsContent value="plans" className="mt-4">
                  {data.productPlans.length === 0 ? (
                    <EmptyState icon={Package} text="Нет продуктовых планов" />
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Животное</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Молоко (л)</TableHead>
                            <TableHead>Подтверждён</TableHead>
                            <TableHead>Создан</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.productPlans.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.animalName || `#${p.animalId}`}</TableCell>
                              <TableCell><StatusBadge status={p.status} /></TableCell>
                              <TableCell>{p.totalMilkUsed ?? "—"}</TableCell>
                              <TableCell>{formatDate(p.confirmedAt)}</TableCell>
                              <TableCell>{formatDate(p.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Deliveries Tab */}
                <TabsContent value="deliveries" className="mt-4">
                  {data.deliveries.length === 0 ? (
                    <EmptyState icon={Truck} text="Нет доставок" />
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Животное</TableHead>
                            <TableHead>Период</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Доставлено</TableHead>
                            <TableHead>Заметка</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.deliveries.map((d: any) => (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium">{d.animalName || `#${d.animalId}`}</TableCell>
                              <TableCell>{d.month}/{d.year}</TableCell>
                              <TableCell><StatusBadge status={d.status} /></TableCell>
                              <TableCell>{formatDate(d.deliveredAt)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{d.adminNote || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Chat Tab */}
                <TabsContent value="chat" className="mt-4">
                  {data.chatMessages.length === 0 ? (
                    <EmptyState icon={MessageCircle} text="Нет сообщений" />
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {data.chatMessages.map((m: any) => (
                        <div
                          key={m.id}
                          className={`flex gap-3 ${m.sender === "admin" ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm ${
                              m.sender === "admin"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-xs opacity-80">
                                {m.sender === "admin" ? "Админ" : "Владелец"}
                              </span>
                              {m.animalName && (
                                <Badge variant="outline" className="text-[10px] h-4">
                                  {m.animalName}
                                </Badge>
                              )}
                            </div>
                            <p>{m.text}</p>
                            {m.photoUrl && (
                              <img
                                src={m.photoUrl}
                                alt="Фото"
                                className="mt-2 rounded-lg max-w-[200px] max-h-[150px] object-cover"
                              />
                            )}
                            <span className="text-[10px] opacity-60 mt-1 block">
                              {formatDate(m.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Wallet Tab */}
                <TabsContent value="wallet" className="mt-4">
                  {data.wallets.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {data.wallets.map((w: any) => (
                        <Card key={w.id} className="rounded-xl">
                          <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground">Баланс</div>
                            <div className="text-2xl font-bold">{formatSKC(w.balanceMinor)}</div>
                            <Badge variant={w.status === "active" ? "default" : "secondary"} className="mt-1">
                              {w.status}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {data.walletTransactions.length === 0 ? (
                    <EmptyState icon={Wallet} text="Нет транзакций" />
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Тип</TableHead>
                            <TableHead>Направление</TableHead>
                            <TableHead>Сумма</TableHead>
                            <TableHead>Баланс после</TableHead>
                            <TableHead>Описание</TableHead>
                            <TableHead>Дата</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.walletTransactions.map((tx: any) => (
                            <TableRow key={tx.id}>
                              <TableCell>{tx.transactionType}</TableCell>
                              <TableCell>
                                <Badge variant={tx.direction === "credit" ? "default" : "destructive"}>
                                  {tx.direction === "credit" ? "+" : "−"}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatSKC(tx.amountMinor)}</TableCell>
                              <TableCell>{formatSKC(tx.balanceAfterMinor)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{tx.memo || "—"}</TableCell>
                              <TableCell>{formatDate(tx.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Change Log Tab */}
                <TabsContent value="log" className="mt-4">
                  {data.changeLog.length === 0 ? (
                    <EmptyState icon={History} text="Нет записей в логе" />
                  ) : (
                    <div className="space-y-3">
                      {data.changeLog.map((entry: any) => (
                        <div key={entry.id} className="flex gap-3 items-start">
                          <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{entry.action}</span>
                              {entry.animalName && (
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.animalName}
                                </Badge>
                              )}
                            </div>
                            {(entry.previousStatus || entry.newStatus) && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {entry.previousStatus || "—"} → {entry.newStatus || "—"}
                              </div>
                            )}
                            {entry.note && (
                              <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
