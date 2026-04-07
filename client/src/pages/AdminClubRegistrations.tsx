import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Calendar, CheckCircle2, Clock, Loader2, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

type Registration = {
  id: number;
  eventId: number;
  userOpenId: string;
  userName: string;
  status: "registered" | "waitlist" | "cancelled" | "rejected";
  adminNote: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  registered: { label: "Записан", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
  waitlist: { label: "Лист ожидания", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
  cancelled: { label: "Отменено", color: "text-stone-500 bg-stone-50 border-stone-200", icon: XCircle },
  rejected: { label: "Отклонено", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

function RegistrationCard({
  reg,
  onUpdate,
  isUpdating,
}: {
  reg: Registration;
  onUpdate: (id: number, status: string, note?: string) => void;
  isUpdating: boolean;
}) {
  const [editNote, setEditNote] = useState(reg.adminNote ?? "");
  const [editStatus, setEditStatus] = useState(reg.status);
  const config = STATUS_CONFIG[reg.status] ?? STATUS_CONFIG.cancelled;
  const StatusIcon = config.icon;

  const hasChanges = editStatus !== reg.status || editNote !== (reg.adminNote ?? "");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {reg.userName.slice(0, 2)}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {reg.userName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(reg.createdAt).toLocaleString("ru-RU")}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
              >
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              User ID: {reg.userOpenId}
            </p>
            {reg.adminNote && (
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium">Заметка:</span> {reg.adminNote}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2" style={{ minWidth: 200 }}>
            <Select
              value={editStatus}
              onValueChange={(v) => setEditStatus(v as Registration["status"])}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registered">Записан</SelectItem>
                <SelectItem value="waitlist">Лист ожидания</SelectItem>
                <SelectItem value="cancelled">Отменено</SelectItem>
                <SelectItem value="rejected">Отклонено</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Заметка администратора…"
              rows={2}
              className="text-xs"
            />

            {hasChanges && (
              <Button
                size="sm"
                onClick={() => onUpdate(reg.id, editStatus, editNote || undefined)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Сохранить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminClubRegistrations() {
  const { user, loading } = useAuth();
  const searchString = useSearch();
  const eventId = Number(new URLSearchParams(searchString).get("eventId")) || 0;

  const regsQuery = trpc.club.adminListRegistrations.useQuery(
    { eventId },
    { enabled: eventId > 0 && Boolean((user as any)?.role === "admin") }
  );

  const updateReg = trpc.club.adminUpdateRegistration.useMutation({
    onSuccess: () => {
      regsQuery.refetch();
      toast.success("Статус обновлён");
    },
    onError: (err) => toast.error(err.message),
  });

  const registrations = (regsQuery.data ?? []) as Registration[];
  const registered = registrations.filter((r) => r.status === "registered").length;
  const waitlist = registrations.filter((r) => r.status === "waitlist").length;
  const cancelled = registrations.filter((r) => r.status === "cancelled" || r.status === "rejected").length;

  const handleUpdate = (id: number, status: string, note?: string) => {
    updateReg.mutate({
      registrationId: id,
      status: status as "registered" | "waitlist" | "cancelled" | "rejected",
      adminNote: note,
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container space-y-6 py-6 md:py-8">
        <PageBreadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Admin", href: "/admin" },
            { label: "Клуб", href: "/admin/club" },
            { label: `Регистрации на событие #${eventId}` },
          ]}
        />

        <div className="flex items-center gap-3">
          <Link href="/admin/club?tab=events">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Назад к событиям
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">
            Регистрации на событие #{eventId}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-lg font-semibold">{registrations.length}</div>
                <div className="text-xs text-muted-foreground">Всего</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-lg font-semibold">{registered}</div>
                <div className="text-xs text-muted-foreground">Записано</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-lg font-semibold">{waitlist}</div>
                <div className="text-xs text-muted-foreground">Ожидание</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <XCircle className="h-5 w-5 text-stone-400" />
              <div>
                <div className="text-lg font-semibold">{cancelled}</div>
                <div className="text-xs text-muted-foreground">Отменено</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {regsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка регистраций…
          </div>
        ) : registrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-muted-foreground">
                На это событие пока никто не записался.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {registrations.map((reg) => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                onUpdate={handleUpdate}
                isUpdating={updateReg.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
