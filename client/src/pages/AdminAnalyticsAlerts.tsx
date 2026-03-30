import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  Clock,
  Loader2,
  Plus,
  Play,
  Trash2,
  History,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/* ── Metric & operator labels ── */

const METRIC_OPTIONS = [
  { value: "page_views", label: "Просмотры страниц" },
  { value: "unique_visitors", label: "Уникальные посетители" },
  { value: "sessions", label: "Сессии" },
  { value: "bounce_rate", label: "Показатель отказов (%)" },
  { value: "avg_time", label: "Среднее время на странице (сек)" },
];

const OPERATOR_OPTIONS = [
  { value: "gt", label: "Больше чем (абс.)" },
  { value: "lt", label: "Меньше чем (абс.)" },
  { value: "change_pct_up", label: "Рост более чем на %" },
  { value: "change_pct_down", label: "Падение более чем на %" },
];

const METRIC_LABELS: Record<string, string> = Object.fromEntries(METRIC_OPTIONS.map((m) => [m.value, m.label]));
const OPERATOR_LABELS: Record<string, string> = Object.fromEntries(OPERATOR_OPTIONS.map((o) => [o.value, o.label]));

export default function AdminAnalyticsAlerts() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState<"rules" | "history">("rules");

  // Form state
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("page_views");
  const [operator, setOperator] = useState("gt");
  const [threshold, setThreshold] = useState("100");
  const [windowHours, setWindowHours] = useState("24");

  const rulesQ = trpc.analyticsAlerts.listRules.useQuery(undefined, { enabled: isAdmin });
  const historyQ = trpc.analyticsAlerts.history.useQuery({ limit: 50 }, { enabled: isAdmin });

  const createMut = trpc.analyticsAlerts.createRule.useMutation({
    onSuccess: () => {
      toast.success("Правило создано");
      utils.analyticsAlerts.listRules.invalidate();
      setShowCreate(false);
      resetForm();
    },
  });

  const updateMut = trpc.analyticsAlerts.updateRule.useMutation({
    onSuccess: () => {
      toast.success("Правило обновлено");
      utils.analyticsAlerts.listRules.invalidate();
    },
  });

  const deleteMut = trpc.analyticsAlerts.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Правило удалено");
      utils.analyticsAlerts.listRules.invalidate();
    },
  });

  const checkNowMut = trpc.analyticsAlerts.checkNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Проверка завершена: проверено ${data.checked}, сработало ${data.triggered}`);
      utils.analyticsAlerts.history.invalidate();
    },
  });

  function resetForm() {
    setName("");
    setMetric("page_views");
    setOperator("gt");
    setThreshold("100");
    setWindowHours("24");
  }

  function handleCreate() {
    createMut.mutate({
      name,
      metric: metric as any,
      operator: operator as any,
      threshold: Number(threshold),
      windowHours: Number(windowHours),
      enabled: true,
    });
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Доступ только для администраторов</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-5xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Уведомления по аналитике
            </h1>
            <p className="text-muted-foreground mt-1">
              Настройте правила мониторинга и получайте уведомления при аномалиях
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkNowMut.mutate()}
              disabled={checkNowMut.isPending}
            >
              {checkNowMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Проверить сейчас
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Новое правило
            </Button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <Button
            variant={activeView === "rules" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("rules")}
          >
            <Settings className="h-4 w-4 mr-1" />
            Правила ({rulesQ.data?.length ?? 0})
          </Button>
          <Button
            variant={activeView === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("history")}
          >
            <History className="h-4 w-4 mr-1" />
            История ({historyQ.data?.length ?? 0})
          </Button>
        </div>

        {/* Create rule form */}
        {showCreate && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Новое правило мониторинга</CardTitle>
              <CardDescription>Задайте метрику, условие и порог для срабатывания</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название правила</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Резкий рост трафика"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Метрика</Label>
                  <Select value={metric} onValueChange={setMetric}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METRIC_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Условие</Label>
                  <Select value={operator} onValueChange={setOperator}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Порог {operator.includes("pct") ? "(%)" : ""}</Label>
                  <Input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Окно сравнения (часов)</Label>
                  <Input
                    type="number"
                    value={windowHours}
                    onChange={(e) => setWindowHours(e.target.value)}
                    min={1}
                    max={720}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>
                  Отмена
                </Button>
                <Button onClick={handleCreate} disabled={!name || createMut.isPending}>
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Создать
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules list */}
        {activeView === "rules" && (
          <div className="space-y-3">
            {rulesQ.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : rulesQ.data && rulesQ.data.length > 0 ? (
              rulesQ.data.map((rule: {
                id: number;
                name: string;
                metric: string;
                operator: string;
                threshold: number;
                windowHours: number;
                enabled: boolean;
                createdAt: Date;
              }) => (
                <Card key={rule.id} className={!rule.enabled ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge variant={rule.enabled ? "default" : "secondary"} className="text-xs">
                            {rule.enabled ? "Активно" : "Отключено"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {METRIC_LABELS[rule.metric] || rule.metric}{" "}
                          <span className="font-medium">{OPERATOR_LABELS[rule.operator] || rule.operator}</span>{" "}
                          {rule.threshold}{rule.operator.includes("pct") ? "%" : ""}{" "}
                          <span className="text-xs">(окно: {rule.windowHours}ч)</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            updateMut.mutate({ id: rule.id, enabled: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Удалить это правило?")) {
                              deleteMut.mutate({ id: rule.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <BellOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Нет правил мониторинга</p>
                  <p className="text-sm mt-1">Создайте первое правило для отслеживания аномалий</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Alert history */}
        {activeView === "history" && (
          <div className="space-y-3">
            {historyQ.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : historyQ.data && historyQ.data.length > 0 ? (
              historyQ.data.map((alert: {
                id: number;
                ruleName: string;
                metric: string;
                currentValue: number;
                previousValue: number | null;
                changePct: number | null;
                message: string;
                notified: boolean;
                createdAt: Date;
              }) => (
                <Card key={alert.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <h3 className="font-semibold text-sm">{alert.ruleName}</h3>
                          <Badge variant={alert.notified ? "default" : "secondary"} className="text-xs">
                            {alert.notified ? "Уведомлено" : "Не уведомлено"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Текущее: {alert.currentValue}</span>
                          {alert.previousValue !== null && <span>Предыдущее: {alert.previousValue}</span>}
                          {alert.changePct !== null && <span>Изменение: {alert.changePct.toFixed(1)}%</span>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.createdAt).toLocaleString("ru-RU")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Нет сработавших уведомлений</p>
                  <p className="text-sm mt-1">Здесь будет история аномалий, обнаруженных системой</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
