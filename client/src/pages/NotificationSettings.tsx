import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Bell, Camera, Newspaper, CalendarHeart, Loader2, CheckCircle2, Milk, BarChart3, Truck, MessageCircle, LinkIcon, Unlink, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const NOTIFICATION_TYPES = [
  {
    key: "photoApproved" as const,
    label: "Одобрение фото",
    description: "Уведомление, когда ваше фото прошло модерацию и опубликовано в галерее",
    icon: Camera,
    iconColor: "text-emerald-500",
  },
  {
    key: "photoRejected" as const,
    label: "Отклонение фото",
    description: "Уведомление, когда ваше фото не прошло модерацию с указанием причины",
    icon: Camera,
    iconColor: "text-rose-500",
  },
  {
    key: "clubPost" as const,
    label: "Новые посты в клубе",
    description: "Уведомление о новых публикациях в клубе — новости фермы, истории, рецепты",
    icon: Newspaper,
    iconColor: "text-sky-500",
  },
  {
    key: "clubEvent" as const,
    label: "Новые события клуба",
    description: "Уведомление о предстоящих событиях — визиты на ферму, мастер-классы, ужины",
    icon: CalendarHeart,
    iconColor: "text-amber-500",
  },
  {
    key: "compositionUpdate" as const,
    label: "Обновление состава молока",
    description: "Уведомление, когда обновляется состав молока вашего животного — жирность, белок, лактоза",
    icon: Milk,
    iconColor: "text-teal-500",
  },
  {
    key: "metricsUpdate" as const,
    label: "Обновление сезонного ритма",
    description: "Уведомление, когда обновляются помесячные метрики вашего животного — объём молока, сезонность",
    icon: BarChart3,
    iconColor: "text-indigo-500",
  },
  {
    key: "deliveryStatus" as const,
    label: "Статус доставки",
    description: "Уведомление, когда доставка переходит в статус «Готово» или «Доставлено»",
    icon: Truck,
    iconColor: "text-orange-500",
  },
];

function TelegramConnectionCard() {
  const utils = trpc.useUtils();
  const { data: tgStatus, isLoading: tgLoading } = trpc.telegram.status.useQuery();
  const generateLink = trpc.telegram.generateLinkToken.useMutation({
    onError: () => toast.error("Не удалось создать ссылку"),
  });
  const disconnect = trpc.telegram.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Telegram отключён");
      utils.telegram.status.invalidate();
      setDeepLink(null);
    },
    onError: () => toast.error("Не удалось отключить"),
  });

  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleConnect() {
    const result = await generateLink.mutateAsync();
    setDeepLink(result.deepLink);
  }

  function handleCopy() {
    if (deepLink) {
      navigator.clipboard.writeText(deepLink);
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isConnected = tgStatus?.connected;

  return (
    <Card className="border-border/50 mt-6">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#229ED9]/10">
            <MessageCircle className="h-5 w-5 text-[#229ED9]" />
          </div>
          <div>
            <CardTitle className="text-lg">Telegram-бот</CardTitle>
            <CardDescription>
              {isConnected
                ? "Аккаунт подключён — вы получаете уведомления в Telegram"
                : "Подключите Telegram для быстрых уведомлений и команд прямо в мессенджере"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tgLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Проверка статуса...
          </div>
        ) : isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-600 font-medium">Подключён</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Вы можете использовать команды /status, /delivery, /balance, /events, /zoya, /masha прямо в боте @sherkozu_bot
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
              Отключить Telegram
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              После подключения вы сможете получать уведомления о доставках, событиях клуба, а также общаться с Зоей и Машей прямо в Telegram.
            </p>
            {!deepLink ? (
              <Button
                onClick={handleConnect}
                disabled={generateLink.isPending}
                className="bg-[#229ED9] hover:bg-[#1a8bc2] text-white"
              >
                {generateLink.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Подключить Telegram
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Нажмите кнопку ниже или откройте ссылку в Telegram:
                </p>
                <div className="flex gap-2">
                  <Button
                    asChild
                    className="bg-[#229ED9] hover:bg-[#1a8bc2] text-white"
                  >
                    <a href={deepLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Открыть в Telegram
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Скопировать ссылку"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ссылка действительна 15 минут. После подключения обновите эту страницу.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NotificationSettings() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: prefs, isLoading } = trpc.notifications.getPreferences.useQuery(undefined, {
    enabled: !!user,
  });

  const updateMutation = trpc.notifications.updatePreferences.useMutation({
    onMutate: async (newPrefs) => {
      // Optimistic update
      await utils.notifications.getPreferences.cancel();
      const previous = utils.notifications.getPreferences.getData();
      utils.notifications.getPreferences.setData(undefined, (old) => ({
        ...(old ?? { photoApproved: true, photoRejected: true, clubPost: true, clubEvent: true, compositionUpdate: true, metricsUpdate: true, deliveryStatus: true }),
        ...newPrefs,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.notifications.getPreferences.setData(undefined, context.previous);
      }
      toast.error("Не удалось сохранить настройки");
    },
    onSuccess: () => {
      toast.success("Настройки сохранены", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
    },
    onSettled: () => {
      utils.notifications.getPreferences.invalidate();
    },
  });

  function handleToggle(key: "photoApproved" | "photoRejected" | "clubPost" | "clubEvent" | "compositionUpdate" | "metricsUpdate" | "deliveryStatus", value: boolean) {
    updateMutation.mutate({ [key]: value });
  }

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-2xl py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Настройки уведомлений
              </h1>
              <p className="text-sm text-muted-foreground">
                Выберите, какие уведомления вы хотите получать
              </p>
            </div>
          </div>
        </div>

        {/* Settings Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Типы уведомлений</CardTitle>
            <CardDescription>
              Отключённые уведомления не будут приходить в колокольчик. Вы можете изменить настройки в любой момент.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {NOTIFICATION_TYPES.map((item, index) => {
              const Icon = item.icon;
              const isEnabled = prefs?.[item.key] ?? true;

              return (
                <div key={item.key}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex items-start justify-between gap-4 py-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 shrink-0 mt-0.5">
                        <Icon className={`h-4.5 w-4.5 ${item.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <Label
                          htmlFor={`toggle-${item.key}`}
                          className="text-sm font-medium text-foreground cursor-pointer"
                        >
                          {item.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`toggle-${item.key}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      disabled={updateMutation.isPending}
                      className="shrink-0"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Telegram Connection */}
        <TelegramConnectionCard />

        {/* Info note */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Настройки применяются мгновенно. Уже полученные уведомления не удаляются.
        </p>
      </div>
    </DashboardLayout>
  );
}
