import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { CalendarRange, Crown, Pencil, Search, ShieldAlert, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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

type PostFilterState = {
  query: string;
  category: string;
  pinned: "all" | "pinned" | "regular";
};

type EventFilterState = {
  query: string;
  status: string;
  tone: string;
};

type MemberFilterState = {
  query: string;
  badge: string;
};

type PendingDeleteState =
  | { entity: "post"; id: number; title: string; description: string }
  | { entity: "event"; id: number; title: string; description: string }
  | { entity: "member"; id: number; title: string; description: string }
  | null;

type AdminTabValue = "posts" | "events" | "members";

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

const defaultPostFilters = (): PostFilterState => ({
  query: "",
  category: "all",
  pinned: "all",
});

const defaultEventFilters = (): EventFilterState => ({
  query: "",
  status: "all",
  tone: "all",
});

const defaultMemberFilters = (): MemberFilterState => ({
  query: "",
  badge: "all",
});

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function includesQuery(fields: Array<string | number | null | undefined>, query: string) {
  if (!query) return true;
  return fields.some((field) => String(field ?? "").toLowerCase().includes(query));
}

function filterPosts(posts: any[], filters: PostFilterState) {
  const query = normalizeSearchValue(filters.query);
  return posts.filter((post) => {
    const matchesQuery = includesQuery([
      post.title,
      post.text,
      post.author,
      post.category,
      post.tagsCsv,
      post.timeLabel,
    ], query);
    const matchesCategory = filters.category === "all" || post.category === filters.category;
    const matchesPinned = filters.pinned === "all"
      || (filters.pinned === "pinned" && Boolean(post.pinned))
      || (filters.pinned === "regular" && !Boolean(post.pinned));

    return matchesQuery && matchesCategory && matchesPinned;
  });
}

function filterEvents(events: any[], filters: EventFilterState) {
  const query = normalizeSearchValue(filters.query);
  return events.filter((event) => {
    const matchesQuery = includesQuery([
      event.title,
      event.description,
      event.dateLabel,
      event.status,
      event.tone,
    ], query);
    const matchesStatus = filters.status === "all" || event.status === filters.status;
    const matchesTone = filters.tone === "all" || event.tone === filters.tone;

    return matchesQuery && matchesStatus && matchesTone;
  });
}

function filterMembers(members: any[], filters: MemberFilterState) {
  const query = normalizeSearchValue(filters.query);
  return members.filter((member) => {
    const matchesQuery = includesQuery([
      member.name,
      member.animal,
      member.sinceLabel,
      member.badge,
    ], query);
    const matchesBadge = filters.badge === "all" || member.badge === filters.badge;

    return matchesQuery && matchesBadge;
  });
}

function uniqueValues(items: any[], key: string) {
  return Array.from(new Set(items.map((item) => String(item[key] ?? "")).filter(Boolean)));
}

function isAdminTabValue(value: string | null): value is AdminTabValue {
  return value === "posts" || value === "events" || value === "members";
}

function readAdminClubStateFromUrl() {
  if (typeof window === "undefined") {
    return {
      activeTab: "posts" as AdminTabValue,
      postFilters: defaultPostFilters(),
      eventFilters: defaultEventFilters(),
      memberFilters: defaultMemberFilters(),
    };
  }

  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");

  return {
    activeTab: isAdminTabValue(tabParam) ? tabParam : "posts",
    postFilters: {
      query: params.get("postQuery") ?? "",
      category: params.get("postCategory") ?? "all",
      pinned: params.get("postPinned") === "pinned" || params.get("postPinned") === "regular"
        ? params.get("postPinned") as PostFilterState["pinned"]
        : "all",
    },
    eventFilters: {
      query: params.get("eventQuery") ?? "",
      status: params.get("eventStatus") ?? "all",
      tone: params.get("eventTone") ?? "all",
    },
    memberFilters: {
      query: params.get("memberQuery") ?? "",
      badge: params.get("memberBadge") ?? "all",
    },
  };
}

function buildAdminClubUrl(activeTab: AdminTabValue, postFilters: PostFilterState, eventFilters: EventFilterState, memberFilters: MemberFilterState) {
  const params = new URLSearchParams();

  if (activeTab !== "posts") params.set("tab", activeTab);
  if (postFilters.query) params.set("postQuery", postFilters.query);
  if (postFilters.category !== "all") params.set("postCategory", postFilters.category);
  if (postFilters.pinned !== "all") params.set("postPinned", postFilters.pinned);
  if (eventFilters.query) params.set("eventQuery", eventFilters.query);
  if (eventFilters.status !== "all") params.set("eventStatus", eventFilters.status);
  if (eventFilters.tone !== "all") params.set("eventTone", eventFilters.tone);
  if (memberFilters.query) params.set("memberQuery", memberFilters.query);
  if (memberFilters.badge !== "all") params.set("memberBadge", memberFilters.badge);

  const query = params.toString();
  return query ? `/admin/club?${query}` : "/admin/club";
}

export default function AdminClub() {
  const initialUrlState = useMemo(() => readAdminClubStateFromUrl(), []);
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<AdminTabValue>(initialUrlState.activeTab);
  const [postForm, setPostForm] = useState<PostFormState>(defaultPostForm);
  const [eventForm, setEventForm] = useState<EventFormState>(defaultEventForm);
  const [memberForm, setMemberForm] = useState<MemberFormState>(defaultMemberForm);
  const [postFilters, setPostFilters] = useState<PostFilterState>(initialUrlState.postFilters);
  const [eventFilters, setEventFilters] = useState<EventFilterState>(initialUrlState.eventFilters);
  const [memberFilters, setMemberFilters] = useState<MemberFilterState>(initialUrlState.memberFilters);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);

  const adminQuery = trpc.adminClub.dashboard.useQuery(undefined, {
    enabled: Boolean(user?.role === "admin"),
  });

  const refreshAdminData = async () => {
    await Promise.all([
      utils.adminClub.dashboard.invalidate(),
      utils.club.feed.invalidate(),
    ]);
  };

  const createPost = trpc.adminClub.createPost.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Пост создан", {
        description: `Материал «${variables.title || "Без названия"}» опубликован в клубной ленте.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось создать пост", {
        description: error.message,
      });
    },
  });
  const updatePost = trpc.adminClub.updatePost.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Пост сохранён", {
        description: `Изменения для поста «${variables.title || "Без названия"}» успешно записаны.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить пост", {
        description: error.message,
      });
    },
  });
  const deletePost = trpc.adminClub.deletePost.useMutation({
    onSuccess: async () => {
      const deletedTitle = pendingDelete?.title ?? "выбранный пост";
      setPendingDelete(null);
      await refreshAdminData();
      toast.success("Пост удалён", {
        description: `Материал «${deletedTitle}» убран из клубной ленты.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить пост", {
        description: error.message,
      });
    },
  });

  const createEvent = trpc.adminClub.createEvent.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Событие создано", {
        description: `Карточка «${variables.title || "Без названия"}» добавлена в Club Feed.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось создать событие", {
        description: error.message,
      });
    },
  });
  const updateEvent = trpc.adminClub.updateEvent.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Событие сохранено", {
        description: `Изменения для события «${variables.title || "Без названия"}» успешно применены.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить событие", {
        description: error.message,
      });
    },
  });
  const deleteEvent = trpc.adminClub.deleteEvent.useMutation({
    onSuccess: async () => {
      const deletedTitle = pendingDelete?.title ?? "выбранное событие";
      setPendingDelete(null);
      await refreshAdminData();
      toast.success("Событие удалено", {
        description: `Карточка «${deletedTitle}» убрана из расписания клуба.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить событие", {
        description: error.message,
      });
    },
  });

  const createMember = trpc.adminClub.createMember.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Участник добавлен", {
        description: `Профиль «${variables.name || "Без имени"}» появился в составе клуба.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось добавить участника", {
        description: error.message,
      });
    },
  });
  const updateMember = trpc.adminClub.updateMember.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Участник сохранён", {
        description: `Изменения для профиля «${variables.name || "Без имени"}» успешно записаны.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить участника", {
        description: error.message,
      });
    },
  });
  const deleteMember = trpc.adminClub.deleteMember.useMutation({
    onSuccess: async () => {
      const deletedTitle = pendingDelete?.title ?? "выбранный участник";
      setPendingDelete(null);
      await refreshAdminData();
      toast.success("Участник удалён", {
        description: `Профиль «${deletedTitle}» убран из клубного состава.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить участника", {
        description: error.message,
      });
    },
  });

  const posts = adminQuery.data?.posts ?? [];
  const events = adminQuery.data?.events ?? [];
  const members = adminQuery.data?.members ?? [];

  const counts = useMemo(() => ({
    posts: posts.length,
    events: events.length,
    members: members.length,
  }), [events.length, members.length, posts.length]);

  const filteredPosts = useMemo(() => filterPosts(posts, postFilters), [posts, postFilters]);
  const filteredEvents = useMemo(() => filterEvents(events, eventFilters), [events, eventFilters]);
  const filteredMembers = useMemo(() => filterMembers(members, memberFilters), [members, memberFilters]);

  const postCategories = useMemo(() => uniqueValues(posts, "category"), [posts]);
  const eventStatuses = useMemo(() => uniqueValues(events, "status"), [events]);
  const eventTones = useMemo(() => uniqueValues(events, "tone"), [events]);
  const memberBadges = useMemo(() => uniqueValues(members, "badge"), [members]);

  const isDeleting = deletePost.isPending || deleteEvent.isPending || deleteMember.isPending;

  useEffect(() => {
    const nextUrl = buildAdminClubUrl(activeTab, postFilters, eventFilters, memberFilters);
    if (location !== nextUrl) {
      setLocation(nextUrl, { replace: true });
    }
  }, [activeTab, eventFilters, location, memberFilters, postFilters, setLocation]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.entity === "post") {
      await deletePost.mutateAsync({ id: pendingDelete.id });
      return;
    }

    if (pendingDelete.entity === "event") {
      await deleteEvent.mutateAsync({ id: pendingDelete.id });
      return;
    }

    await deleteMember.mutateAsync({ id: pendingDelete.id });
  };

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
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setPendingDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Вы собираетесь удалить ${pendingDelete.description}. Действие нельзя отменить.`
                : "Вы собираетесь удалить запись. Действие нельзя отменить."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDelete ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p className="font-medium text-stone-950">{pendingDelete.title}</p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Удаляем..." : "Удалить запись"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container py-6 md:py-8 space-y-6">
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

        <Tabs value={activeTab} onValueChange={(value) => {
          if (isAdminTabValue(value)) {
            setActiveTab(value);
          }
        }} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-stone-100 p-1 sm:grid-cols-3 sm:gap-1 md:w-auto">
            <TabsTrigger value="posts" className="w-full whitespace-normal px-3 py-2 text-center">Посты</TabsTrigger>
            <TabsTrigger value="events" className="w-full whitespace-normal px-3 py-2 text-center">События</TabsTrigger>
            <TabsTrigger value="members" className="w-full whitespace-normal px-3 py-2 text-center">Участники</TabsTrigger>
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
              description="Быстрое редактирование, удаление, поиск и фильтрация материалов клуба."
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по заголовку, тексту, автору или тегам"
                  searchValue={postFilters.query}
                  resetLabel="Сбросить фильтры постов"
                  onSearchChange={(value) => setPostFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setPostFilters(defaultPostFilters())}
                  hasActiveFilters={postFilters.query !== "" || postFilters.category !== "all" || postFilters.pinned !== "all"}
                >
                  <SelectFilter
                    label="Категория"
                    value={postFilters.category}
                    onChange={(value) => setPostFilters((current) => ({ ...current, category: value }))}
                    options={[{ label: "Все категории", value: "all" }, ...postCategories.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Тип"
                    value={postFilters.pinned}
                    onChange={(value) => setPostFilters((current) => ({ ...current, pinned: value as PostFilterState["pinned"] }))}
                    options={[
                      { label: "Все посты", value: "all" },
                      { label: "Только pinned", value: "pinned" },
                      { label: "Только обычные", value: "regular" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={filteredPosts}
              emptyText="По текущим фильтрам посты не найдены."
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
                  onDelete={() => setPendingDelete({
                    entity: "post",
                    id: post.id,
                    title: post.title,
                    description: `пост «${post.title}»`,
                  })}
                  deleting={isDeleting && pendingDelete?.entity === "post" && pendingDelete.id === post.id}
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
              description="Редактируйте даты, статусы и тексты, а также быстро находите нужные записи."
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по названию, описанию или дате"
                  searchValue={eventFilters.query}
                  resetLabel="Сбросить фильтры событий"
                  onSearchChange={(value) => setEventFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setEventFilters(defaultEventFilters())}
                  hasActiveFilters={eventFilters.query !== "" || eventFilters.status !== "all" || eventFilters.tone !== "all"}
                >
                  <SelectFilter
                    label="Статус"
                    value={eventFilters.status}
                    onChange={(value) => setEventFilters((current) => ({ ...current, status: value }))}
                    options={[{ label: "Все статусы", value: "all" }, ...eventStatuses.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Тон"
                    value={eventFilters.tone}
                    onChange={(value) => setEventFilters((current) => ({ ...current, tone: value }))}
                    options={[{ label: "Все тона", value: "all" }, ...eventTones.map((value) => ({ label: value, value }))]}
                  />
                </FilterToolbar>
              }
              items={filteredEvents}
              emptyText="По текущим фильтрам события не найдены."
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
                  onDelete={() => setPendingDelete({
                    entity: "event",
                    id: event.id,
                    title: event.title,
                    description: `событие «${event.title}»`,
                  })}
                  deleting={isDeleting && pendingDelete?.entity === "event" && pendingDelete.id === event.id}
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
              description="Ищите по имени, животному или бейджу и быстро поддерживайте состав сообщества в порядке."
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по имени, животному или периоду участия"
                  searchValue={memberFilters.query}
                  resetLabel="Сбросить фильтры участников"
                  onSearchChange={(value) => setMemberFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setMemberFilters(defaultMemberFilters())}
                  hasActiveFilters={memberFilters.query !== "" || memberFilters.badge !== "all"}
                >
                  <SelectFilter
                    label="Бейдж"
                    value={memberFilters.badge}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, badge: value }))}
                    options={[{ label: "Все бейджи", value: "all" }, ...memberBadges.map((value) => ({ label: value, value }))]}
                  />
                </FilterToolbar>
              }
              items={filteredMembers}
              emptyText="По текущим фильтрам участники не найдены."
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
                  onDelete={() => setPendingDelete({
                    entity: "member",
                    id: member.id,
                    title: member.name,
                    description: `участника «${member.name}»`,
                  })}
                  deleting={isDeleting && pendingDelete?.entity === "member" && pendingDelete.id === member.id}
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
  toolbar,
  items,
  renderItem,
  emptyText,
}: {
  title: string;
  description: string;
  toolbar?: React.ReactNode;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  emptyText?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {toolbar}
        <div className="space-y-3">
          {items.length ? items.map((item) => <div key={item.id}>{renderItem(item)}</div>) : <p className="text-sm text-stone-500">{emptyText ?? "Пока нет записей."}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterToolbar({
  searchPlaceholder,
  searchValue,
  resetLabel,
  onSearchChange,
  onReset,
  hasActiveFilters,
  children,
}: {
  searchPlaceholder: string;
  searchValue: string;
  resetLabel: string;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label>Поиск</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input className="pl-9" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} />
          </div>
        </div>
        <Button variant="outline" onClick={onReset} disabled={!hasActiveFilters}>
          <X className="mr-2 h-4 w-4" />{resetLabel}
        </Button>
      </div>
      {children ? <div className="grid gap-3 md:grid-cols-2">{children}</div> : null}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" size="sm" onClick={onEdit} className="w-full justify-center sm:min-w-[132px] sm:w-[132px]">
            <Pencil className="mr-2 h-4 w-4" />Править
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} disabled={deleting} className="w-full justify-center sm:min-w-[132px] sm:w-[132px]">
            <Trash2 className="mr-2 h-4 w-4" />{deleting ? "Удаление..." : "Удалить"}
          </Button>
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
