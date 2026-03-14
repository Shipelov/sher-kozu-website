import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { CalendarRange, Crown, Pencil, ShieldAlert, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type PostFormState = {
  id?: number;
  category: string;
  author: string;
  avatar: string;
  role: string;
  timeLabel: string;
  title: string;
  text: string;
  imageUrl: string;
  likes: number;
  comments: number;
  tagsCsv: string;
  pinned: boolean;
  sortOrder: number;
};

type EventFormState = {
  id?: number;
  title: string;
  dateLabel: string;
  description: string;
  status: string;
  tone: string;
  sortOrder: number;
};

type MemberFormState = {
  id?: number;
  name: string;
  animal: string;
  sinceLabel: string;
  badge: string;
  sortOrder: number;
};

const defaultPostForm = (): PostFormState => ({
  category: "journal",
  author: "Команда фермы",
  avatar: "SK",
  role: "Редакция клуба",
  timeLabel: "Сегодня, 10:00",
  title: "",
  text: "",
  imageUrl: "",
  likes: 0,
  comments: 0,
  tagsCsv: "",
  pinned: false,
  sortOrder: 0,
});

const defaultEventForm = (): EventFormState => ({
  title: "",
  dateLabel: "",
  description: "",
  status: "Открыта регистрация",
  tone: "warm",
  sortOrder: 0,
});

const defaultMemberForm = (): MemberFormState => ({
  name: "",
  animal: "",
  sinceLabel: "",
  badge: "",
  sortOrder: 0,
});

export default function AdminClub() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [postForm, setPostForm] = useState<PostFormState>(defaultPostForm);
  const [eventForm, setEventForm] = useState<EventFormState>(defaultEventForm);
  const [memberForm, setMemberForm] = useState<MemberFormState>(defaultMemberForm);

  const adminQuery = trpc.adminClub.dashboard.useQuery(undefined, {
    enabled: Boolean(user?.role === "admin"),
  });

  const refreshAdminData = async () => {
    await Promise.all([
      utils.adminClub.dashboard.invalidate(),
      utils.club.feed.invalidate(),
    ]);
  };

  const createPost = trpc.adminClub.createPost.useMutation({ onSuccess: refreshAdminData });
  const updatePost = trpc.adminClub.updatePost.useMutation({ onSuccess: refreshAdminData });
  const deletePost = trpc.adminClub.deletePost.useMutation({ onSuccess: refreshAdminData });

  const createEvent = trpc.adminClub.createEvent.useMutation({ onSuccess: refreshAdminData });
  const updateEvent = trpc.adminClub.updateEvent.useMutation({ onSuccess: refreshAdminData });
  const deleteEvent = trpc.adminClub.deleteEvent.useMutation({ onSuccess: refreshAdminData });

  const createMember = trpc.adminClub.createMember.useMutation({ onSuccess: refreshAdminData });
  const updateMember = trpc.adminClub.updateMember.useMutation({ onSuccess: refreshAdminData });
  const deleteMember = trpc.adminClub.deleteMember.useMutation({ onSuccess: refreshAdminData });

  const counts = useMemo(() => ({
    posts: adminQuery.data?.posts.length ?? 0,
    events: adminQuery.data?.events.length ?? 0,
    members: adminQuery.data?.members.length ?? 0,
  }), [adminQuery.data]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Загрузка админ-панели</CardTitle>
              <CardDescription>Проверяем права доступа и подтягиваем данные клуба.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="container py-10 max-w-3xl">
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Доступ ограничен</AlertTitle>
            <AlertDescription>
              Эта панель доступна только администраторам. Вы можете вернуться в клубную ленту или на дашборд владельца.
            </AlertDescription>
          </Alert>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => setLocation("/club")}>Перейти в Club Feed</Button>
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>Вернуться в Dashboard</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isForbidden = adminQuery.error?.message === NOT_ADMIN_ERR_MSG;

  return (
    <DashboardLayout>
      <div className="container py-6 md:py-8 space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-stone-200 bg-gradient-to-br from-amber-50 via-white to-stone-50 shadow-sm">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit border-amber-300 bg-white/80 text-amber-900">
                Простая админ-панель клуба
              </Badge>
              <CardTitle className="text-3xl text-stone-950">Управление клубными постами, событиями и участниками</CardTitle>
              <CardDescription className="max-w-2xl text-base text-stone-600">
                Панель помогает быстро обновлять клубную ленту без редактирования базы вручную: можно создавать, править и удалять посты, события и карточки участников.
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
                <span className="font-medium text-stone-950">{adminQuery.isLoading ? "Загружаются" : "Готово"}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {isForbidden ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Недостаточно прав</AlertTitle>
            <AlertDescription>Сервер вернул ограничение по роли. Проверьте, что ваш пользователь имеет роль admin в таблице users.</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto">
            <TabsTrigger value="posts">Посты</TabsTrigger>
            <TabsTrigger value="events">События</TabsTrigger>
            <TabsTrigger value="members">Участники</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={postForm.id ? "Редактировать пост" : "Новый пост"}
              description="Заполняйте только основные поля. Изменения сразу попадут в club feed после сохранения."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={async () => {
                      if (postForm.id) {
                        await updatePost.mutateAsync({ ...postForm, id: postForm.id });
                      } else {
                        await createPost.mutateAsync(postForm);
                      }
                      setPostForm(defaultPostForm());
                    }}
                    disabled={createPost.isPending || updatePost.isPending}
                  >
                    {postForm.id ? "Сохранить пост" : "Создать пост"}
                  </Button>
                  <Button variant="outline" onClick={() => setPostForm(defaultPostForm())}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Категория"><Input value={postForm.category} onChange={(e) => setPostForm({ ...postForm, category: e.target.value })} /></Field>
                <Field label="Автор"><Input value={postForm.author} onChange={(e) => setPostForm({ ...postForm, author: e.target.value })} /></Field>
                <Field label="Аватар"><Input value={postForm.avatar} onChange={(e) => setPostForm({ ...postForm, avatar: e.target.value.slice(0, 8) })} /></Field>
                <Field label="Роль автора"><Input value={postForm.role} onChange={(e) => setPostForm({ ...postForm, role: e.target.value })} /></Field>
                <Field label="Время"><Input value={postForm.timeLabel} onChange={(e) => setPostForm({ ...postForm, timeLabel: e.target.value })} /></Field>
                <Field label="Порядок"><Input type="number" value={postForm.sortOrder} onChange={(e) => setPostForm({ ...postForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
                <Field label="Лайки"><Input type="number" value={postForm.likes} onChange={(e) => setPostForm({ ...postForm, likes: Number(e.target.value) || 0 })} /></Field>
                <Field label="Комментарии"><Input type="number" value={postForm.comments} onChange={(e) => setPostForm({ ...postForm, comments: Number(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="Заголовок"><Input value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} /></Field>
              <Field label="Изображение (URL)"><Input value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Теги CSV"><Input value={postForm.tagsCsv} onChange={(e) => setPostForm({ ...postForm, tagsCsv: e.target.value })} placeholder="утро,марта,клуб" /></Field>
              <Field label="Текст поста"><Textarea value={postForm.text} onChange={(e) => setPostForm({ ...postForm, text: e.target.value })} className="min-h-32" /></Field>
              <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
                <div>
                  <p className="font-medium text-stone-950">Закрепить пост</p>
                  <p className="text-sm text-stone-500">Закреплённые посты поднимаются вверх в ленте.</p>
                </div>
                <Switch checked={postForm.pinned} onCheckedChange={(checked) => setPostForm({ ...postForm, pinned: checked })} />
              </div>
            </EntityFormCard>

            <EntityListCard
              title="Текущие посты"
              description="Быстрое редактирование и удаление существующих материалов клуба."
              items={adminQuery.data?.posts ?? []}
              renderItem={(post: any) => (
                <ListRow
                  title={post.title}
                  subtitle={`${post.author} · ${post.timeLabel}`}
                  meta={`Категория: ${post.category} · Порядок: ${post.sortOrder}`}
                  badge={post.pinned ? "Pinned" : undefined}
                  onEdit={() => setPostForm({
                    id: post.id,
                    category: post.category,
                    author: post.author,
                    avatar: post.avatar,
                    role: post.role,
                    timeLabel: post.timeLabel,
                    title: post.title,
                    text: post.text,
                    imageUrl: post.imageUrl,
                    likes: post.likes,
                    comments: post.comments,
                    tagsCsv: post.tagsCsv,
                    pinned: Boolean(post.pinned),
                    sortOrder: post.sortOrder,
                  })}
                  onDelete={() => deletePost.mutate({ id: post.id })}
                  deleting={deletePost.isPending}
                />
              )}
            />
          </TabsContent>

          <TabsContent value="events" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={eventForm.id ? "Редактировать событие" : "Новое событие"}
              description="Используйте короткие формулировки, чтобы карточки легко читались в Club Feed."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={async () => {
                      if (eventForm.id) {
                        await updateEvent.mutateAsync({ ...eventForm, id: eventForm.id });
                      } else {
                        await createEvent.mutateAsync(eventForm);
                      }
                      setEventForm(defaultEventForm());
                    }}
                    disabled={createEvent.isPending || updateEvent.isPending}
                  >
                    {eventForm.id ? "Сохранить событие" : "Создать событие"}
                  </Button>
                  <Button variant="outline" onClick={() => setEventForm(defaultEventForm())}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название"><Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></Field>
                <Field label="Дата"><Input value={eventForm.dateLabel} onChange={(e) => setEventForm({ ...eventForm, dateLabel: e.target.value })} /></Field>
                <Field label="Статус"><Input value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })} /></Field>
                <Field label="Тон"><Input value={eventForm.tone} onChange={(e) => setEventForm({ ...eventForm, tone: e.target.value })} /></Field>
                <Field label="Порядок"><Input type="number" value={eventForm.sortOrder} onChange={(e) => setEventForm({ ...eventForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="Описание"><Textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="min-h-32" /></Field>
            </EntityFormCard>

            <EntityListCard
              title="События клуба"
              description="Редактируйте даты, статусы и тексты без вмешательства в базу данных вручную."
              items={adminQuery.data?.events ?? []}
              renderItem={(event: any) => (
                <ListRow
                  title={event.title}
                  subtitle={event.dateLabel}
                  meta={`${event.status} · ${event.tone} · Порядок: ${event.sortOrder}`}
                  onEdit={() => setEventForm({
                    id: event.id,
                    title: event.title,
                    dateLabel: event.dateLabel,
                    description: event.description,
                    status: event.status,
                    tone: event.tone,
                    sortOrder: event.sortOrder,
                  })}
                  onDelete={() => deleteEvent.mutate({ id: event.id })}
                  deleting={deleteEvent.isPending}
                />
              )}
            />
          </TabsContent>

          <TabsContent value="members" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={memberForm.id ? "Редактировать участника" : "Новый участник"}
              description="Поддерживайте клубный список актуальным и аккуратно отсортированным."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={async () => {
                      if (memberForm.id) {
                        await updateMember.mutateAsync({ ...memberForm, id: memberForm.id });
                      } else {
                        await createMember.mutateAsync(memberForm);
                      }
                      setMemberForm(defaultMemberForm());
                    }}
                    disabled={createMember.isPending || updateMember.isPending}
                  >
                    {memberForm.id ? "Сохранить участника" : "Добавить участника"}
                  </Button>
                  <Button variant="outline" onClick={() => setMemberForm(defaultMemberForm())}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Имя"><Input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} /></Field>
                <Field label="Животное"><Input value={memberForm.animal} onChange={(e) => setMemberForm({ ...memberForm, animal: e.target.value })} /></Field>
                <Field label="С клубом с"><Input value={memberForm.sinceLabel} onChange={(e) => setMemberForm({ ...memberForm, sinceLabel: e.target.value })} /></Field>
                <Field label="Бейдж"><Input value={memberForm.badge} onChange={(e) => setMemberForm({ ...memberForm, badge: e.target.value })} /></Field>
                <Field label="Порядок"><Input type="number" value={memberForm.sortOrder} onChange={(e) => setMemberForm({ ...memberForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
              </div>
            </EntityFormCard>

            <EntityListCard
              title="Участники клуба"
              description="Панель помогает обновлять состав сообщества и подписи карточек в ленте."
              items={adminQuery.data?.members ?? []}
              renderItem={(member: any) => (
                <ListRow
                  title={member.name}
                  subtitle={member.animal}
                  meta={`${member.sinceLabel} · ${member.badge} · Порядок: ${member.sortOrder}`}
                  onEdit={() => setMemberForm({
                    id: member.id,
                    name: member.name,
                    animal: member.animal,
                    sinceLabel: member.sinceLabel,
                    badge: member.badge,
                    sortOrder: member.sortOrder,
                  })}
                  onDelete={() => deleteMember.mutate({ id: member.id })}
                  deleting={deleteMember.isPending}
                />
              )}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
      <div className="flex items-center justify-between text-stone-500">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function EntityFormCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Separator />
        {footer}
      </CardContent>
    </Card>
  );
}

function EntityListCard({
  title,
  description,
  items,
  renderItem,
}: {
  title: string;
  description: string;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item) => <div key={item.id}>{renderItem(item)}</div>) : <p className="text-sm text-stone-500">Пока нет записей.</p>}
      </CardContent>
    </Card>
  );
}

function ListRow({
  title,
  subtitle,
  meta,
  badge,
  onEdit,
  onDelete,
  deleting,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-stone-950">{title}</p>
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          </div>
          <p className="text-sm text-stone-600">{subtitle}</p>
          <p className="text-xs text-stone-500">{meta}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Править</Button>
          <Button variant="outline" size="sm" onClick={onDelete} disabled={deleting}><Trash2 className="mr-2 h-4 w-4" />Удалить</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
