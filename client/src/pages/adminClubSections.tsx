import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange, Crown, Users } from "lucide-react";

export type AdminClubSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export type AdminClubOverviewSectionProps = {
  counts: {
    posts: number;
    events: number;
    members: number;
  };
  user: {
    name?: string | null;
    role: string;
  };
  isLoading: boolean;
};

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/85 px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm text-stone-500">
        <span>{label}</span>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

export function AdminClubSectionCard({
  title,
  description,
  children,
  className,
}: AdminClubSectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdminClubOverviewSection({
  counts,
  user,
  isLoading,
}: AdminClubOverviewSectionProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="border-stone-200 bg-gradient-to-br from-amber-50 via-white to-stone-50 shadow-sm">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit border-amber-300 bg-white/80 text-amber-900">
            Простая админ-панель клуба
          </Badge>
          <CardTitle className="text-3xl text-stone-950">Управление клубными постами, событиями и участниками</CardTitle>
          <CardDescription className="max-w-2xl text-base text-stone-600">
            Панель помогает быстро обновлять клубную ленту без редактирования базы вручную: можно создавать, править, удалять, искать и фильтровать ключевые сущности клуба.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Посты" value={counts.posts} icon={<Crown className="h-4 w-4" />} />
          <MetricCard label="События" value={counts.events} icon={<CalendarRange className="h-4 w-4" />} />
          <MetricCard label="Участники" value={counts.members} icon={<Users className="h-4 w-4" />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Состояние</CardTitle>
          <CardDescription>Текущий пользователь и статус загрузки данных.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-stone-600">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 px-4 py-3">
            <span>Администратор</span>
            <span className="font-medium text-stone-950">{user.name || "Без имени"}</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 px-4 py-3">
            <span>Роль</span>
            <Badge>{user.role}</Badge>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 px-4 py-3">
            <span>Данные</span>
            <span className="font-medium text-stone-950">{isLoading ? "Загружаются" : "Готово"}</span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
