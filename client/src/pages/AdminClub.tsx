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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildCriticalNotificationPayload,
  defaultCriticalNotificationSettings,
  getCriticalNotificationAreaLabel,
  getCriticalNotificationStatusCopy,
  recordAdminAction,
  recordCriticalNotificationHistory,
  shouldSendCriticalNotification,
  type AdminActionLogEntry,
  type AdminActionType,
  type AdminTabValue,
  type CriticalNotificationHistoryEntry,
  type CriticalNotificationSettings,
  type EntityAdminTabValue,
} from "@/lib/adminClubActivity";
import { trpc } from "@/lib/trpc";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { ArrowDown, ArrowLeft, CalendarRange, CheckSquare, ChevronDown, ChevronUp, Copy, Crown, Download, Pencil, Pin, RefreshCw, Save, Search, ShieldAlert, Square, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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

type SortDirection = "asc" | "desc";

type PostSortField = "sortOrder" | "timeLabel" | "title";
type EventSortField = "sortOrder" | "dateLabel" | "status";
type MemberSortField = "sortOrder" | "name" | "badge";

type PostFilterState = {
  query: string;
  category: string;
  pinned: "all" | "pinned" | "regular";
  sortBy: PostSortField;
  sortDirection: SortDirection;
};

type EventFilterState = {
  query: string;
  status: string;
  tone: string;
  sortBy: EventSortField;
  sortDirection: SortDirection;
};

type MemberFilterState = {
  query: string;
  badge: string;
  sortBy: MemberSortField;
  sortDirection: SortDirection;
};

type PendingDeleteState =
  | { entity: "post"; id: number; title: string; description: string }
  | { entity: "event"; id: number; title: string; description: string }
  | { entity: "member"; id: number; title: string; description: string }
  | { entity: "bulk-post"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | { entity: "bulk-event"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | { entity: "bulk-member"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | null;


type PresetConfig = {
  query?: string;
  category?: string;
  pinned?: "all" | "pinned" | "regular";
  status?: string;
  tone?: string;
  badge?: string;
  sortBy: string;
  sortDirection: SortDirection;
};

type ClubAdminPreset = {
  id: number;
  tab: EntityAdminTabValue;
  name: string;
  configJson: string;
  sortOrder: number;
};

type FormErrors<T extends string> = Partial<Record<T, string>>;

type PostFormField = "category" | "author" | "role" | "timeLabel" | "title" | "text";
type EventFormField = "title" | "dateLabel" | "description" | "status" | "tone";
type MemberFormField = "name" | "animal" | "sinceLabel";

type SelectionState = Record<EntityAdminTabValue, number[]>;
type PaginationState = Record<EntityAdminTabValue, { page: number; pageSize: number }>;

type BulkActionConfig = {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "outline";
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type InlineActionConfig = {
  label: string;
  icon?: ReactNode;
  value?: string | number;
  onClick: () => void;
  disabled?: boolean;
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

const defaultPostFilters = (): PostFilterState => ({
  query: "",
  category: "all",
  pinned: "all",
  sortBy: "sortOrder",
  sortDirection: "asc",
});

const defaultEventFilters = (): EventFilterState => ({
  query: "",
  status: "all",
  tone: "all",
  sortBy: "sortOrder",
  sortDirection: "asc",
});

const defaultMemberFilters = (): MemberFilterState => ({
  query: "",
  badge: "all",
  sortBy: "sortOrder",
  sortDirection: "asc",
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

function compareValues(left: string | number | null | undefined, right: string | number | null | undefined, direction: SortDirection) {
  const leftValue = typeof left === "number" ? left : String(left ?? "").toLowerCase();
  const rightValue = typeof right === "number" ? right : String(right ?? "").toLowerCase();

  if (leftValue < rightValue) return direction === "asc" ? -1 : 1;
  if (leftValue > rightValue) return direction === "asc" ? 1 : -1;
  return 0;
}

function sortPosts(posts: any[], filters: PostFilterState) {
  return [...posts].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

function sortEvents(events: any[], filters: EventFilterState) {
  return [...events].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

function sortMembers(members: any[], filters: MemberFilterState) {
  return [...members].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

function isAdminTabValue(value: string | null): value is AdminTabValue {
  return value === "posts" || value === "events" || value === "members" || value === "activity";
}

function parsePageParam(value: string | null) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function parsePageSizeParam(value: string | null) {
  const parsed = Number(value ?? "10");
  return [5, 10, 20, 50].includes(parsed) ? parsed : 10;
}

function readAdminClubStateFromUrl() {
  if (typeof window === "undefined") {
    return {
      activeTab: "posts" as AdminTabValue,
      postFilters: defaultPostFilters(),
      eventFilters: defaultEventFilters(),
      memberFilters: defaultMemberFilters(),
      pagination: {
        posts: { page: 1, pageSize: 10 },
        events: { page: 1, pageSize: 10 },
        members: { page: 1, pageSize: 10 },
      },
      actionLogCollapsed: false,
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
      sortBy: params.get("postSortBy") === "timeLabel" || params.get("postSortBy") === "title" ? params.get("postSortBy") as PostSortField : "sortOrder",
      sortDirection: (params.get("postSortDirection") === "desc" ? "desc" : "asc") as SortDirection,
    },
    eventFilters: {
      query: params.get("eventQuery") ?? "",
      status: params.get("eventStatus") ?? "all",
      tone: params.get("eventTone") ?? "all",
      sortBy: params.get("eventSortBy") === "dateLabel" || params.get("eventSortBy") === "status" ? params.get("eventSortBy") as EventSortField : "sortOrder",
      sortDirection: (params.get("eventSortDirection") === "desc" ? "desc" : "asc") as SortDirection,
    },
    memberFilters: {
      query: params.get("memberQuery") ?? "",
      badge: params.get("memberBadge") ?? "all",
      sortBy: params.get("memberSortBy") === "name" || params.get("memberSortBy") === "badge" ? params.get("memberSortBy") as MemberSortField : "sortOrder",
      sortDirection: (params.get("memberSortDirection") === "desc" ? "desc" : "asc") as SortDirection,
    },
    pagination: {
      posts: {
        page: parsePageParam(params.get("postPage")),
        pageSize: parsePageSizeParam(params.get("postPageSize")),
      },
      events: {
        page: parsePageParam(params.get("eventPage")),
        pageSize: parsePageSizeParam(params.get("eventPageSize")),
      },
      members: {
        page: parsePageParam(params.get("memberPage")),
        pageSize: parsePageSizeParam(params.get("memberPageSize")),
      },
    },
    actionLogCollapsed: params.get("log") === "collapsed",
  };
}

function validateRequiredText(value: string, message: string) {
  return value.trim() ? undefined : message;
}

function validatePostForm(form: PostFormState): FormErrors<PostFormField> {
  return {
    category: validateRequiredText(form.category, "Укажите категорию поста."),
    author: validateRequiredText(form.author, "Укажите автора поста."),
    role: validateRequiredText(form.role, "Укажите роль автора."),
    timeLabel: validateRequiredText(form.timeLabel, "Укажите время публикации."),
    title: validateRequiredText(form.title, "Добавьте заголовок поста."),
    text: validateRequiredText(form.text, "Добавьте текст поста."),
  };
}

function validateEventForm(form: EventFormState): FormErrors<EventFormField> {
  return {
    title: validateRequiredText(form.title, "Укажите название события."),
    dateLabel: validateRequiredText(form.dateLabel, "Укажите дату события."),
    description: validateRequiredText(form.description, "Добавьте описание события."),
    status: validateRequiredText(form.status, "Укажите статус события."),
    tone: validateRequiredText(form.tone, "Укажите тон карточки."),
  };
}

function validateMemberForm(form: MemberFormState): FormErrors<MemberFormField> {
  return {
    name: validateRequiredText(form.name, "Укажите имя участника."),
    animal: validateRequiredText(form.animal, "Укажите животное участника."),
    sinceLabel: validateRequiredText(form.sinceLabel, "Укажите дату вступления."),
  };
}

function hasFormErrors<T extends string>(errors: FormErrors<T>) {
  return Object.values(errors).some(Boolean);
}

function buildBulkDeleteSummaryItems(items: Array<{ title?: string; name?: string }>) {
  return items
    .map((item) => item.title ?? item.name ?? "Без названия")
    .filter(Boolean)
    .slice(0, 5);
}

function getDeleteDialogCopy(pendingDelete: PendingDeleteState) {
  if (!pendingDelete) {
    return {
      title: "Подтвердите удаление",
      description: "Вы собираетесь удалить запись. Действие нельзя отменить.",
      actionLabel: "Удалить запись",
    };
  }

  if (pendingDelete.entity === "bulk-post" || pendingDelete.entity === "bulk-event" || pendingDelete.entity === "bulk-member") {
    const entityLabel = pendingDelete.entity === "bulk-post"
      ? "постов"
      : pendingDelete.entity === "bulk-event"
        ? "событий"
        : "участников";

    return {
      title: `Удалить выбранные ${entityLabel}`,
      description: `Вы собираетесь удалить ${pendingDelete.totalCount} ${entityLabel}. Ниже показаны первые записи из выбранного набора. Действие нельзя отменить.`,
      actionLabel: `Удалить ${pendingDelete.totalCount}`,
    };
  }

  return {
    title: "Подтвердите удаление",
    description: `Вы собираетесь удалить ${pendingDelete.description}. Действие нельзя отменить.`,
    actionLabel: "Удалить запись",
  };
}

function parsePresetConfig(configJson: string): PresetConfig | null {
  try {
    return JSON.parse(configJson) as PresetConfig;
  } catch {
    return null;
  }
}

function getPresetConfigForTab(tab: EntityAdminTabValue, postFilters: PostFilterState, eventFilters: EventFilterState, memberFilters: MemberFilterState): PresetConfig {
  if (tab === "posts") {
    return {
      query: postFilters.query,
      category: postFilters.category,
      pinned: postFilters.pinned,
      sortBy: postFilters.sortBy,
      sortDirection: postFilters.sortDirection,
    };
  }

  if (tab === "events") {
    return {
      query: eventFilters.query,
      status: eventFilters.status,
      tone: eventFilters.tone,
      sortBy: eventFilters.sortBy,
      sortDirection: eventFilters.sortDirection,
    };
  }

  return {
    query: memberFilters.query,
    badge: memberFilters.badge,
    sortBy: memberFilters.sortBy,
    sortDirection: memberFilters.sortDirection,
  };
}

function buildAdminClubUrl(
  activeTab: AdminTabValue,
  postFilters: PostFilterState,
  eventFilters: EventFilterState,
  memberFilters: MemberFilterState,
  pagination: PaginationState,
  actionLogCollapsed: boolean,
) {
  const params = new URLSearchParams();

  if (activeTab !== "posts") params.set("tab", activeTab);
  if (postFilters.query) params.set("postQuery", postFilters.query);
  if (postFilters.category !== "all") params.set("postCategory", postFilters.category);
  if (postFilters.pinned !== "all") params.set("postPinned", postFilters.pinned);
  if (postFilters.sortBy !== "sortOrder") params.set("postSortBy", postFilters.sortBy);
  if (postFilters.sortDirection !== "asc") params.set("postSortDirection", postFilters.sortDirection);
  if (eventFilters.query) params.set("eventQuery", eventFilters.query);
  if (eventFilters.status !== "all") params.set("eventStatus", eventFilters.status);
  if (eventFilters.tone !== "all") params.set("eventTone", eventFilters.tone);
  if (eventFilters.sortBy !== "sortOrder") params.set("eventSortBy", eventFilters.sortBy);
  if (eventFilters.sortDirection !== "asc") params.set("eventSortDirection", eventFilters.sortDirection);
  if (memberFilters.query) params.set("memberQuery", memberFilters.query);
  if (memberFilters.badge !== "all") params.set("memberBadge", memberFilters.badge);
  if (memberFilters.sortBy !== "sortOrder") params.set("memberSortBy", memberFilters.sortBy);
  if (memberFilters.sortDirection !== "asc") params.set("memberSortDirection", memberFilters.sortDirection);
  if (pagination.posts.page !== 1) params.set("postPage", String(pagination.posts.page));
  if (pagination.posts.pageSize !== 10) params.set("postPageSize", String(pagination.posts.pageSize));
  if (pagination.events.page !== 1) params.set("eventPage", String(pagination.events.page));
  if (pagination.events.pageSize !== 10) params.set("eventPageSize", String(pagination.events.pageSize));
  if (pagination.members.page !== 1) params.set("memberPage", String(pagination.members.page));
  if (pagination.members.pageSize !== 10) params.set("memberPageSize", String(pagination.members.pageSize));
  if (actionLogCollapsed) params.set("log", "collapsed");

  const query = params.toString();
  return query ? `/admin/club?${query}` : "/admin/club";
}

export default function AdminClub() {
  const initialUrlState = useMemo(() => readAdminClubStateFromUrl(), []);
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<AdminTabValue>(initialUrlState.activeTab);
  const [lastEntityTab, setLastEntityTab] = useState<EntityAdminTabValue>(
    initialUrlState.activeTab === "posts" || initialUrlState.activeTab === "events" || initialUrlState.activeTab === "members"
      ? initialUrlState.activeTab
      : "posts"
  );
  const [postForm, setPostForm] = useState<PostFormState>(defaultPostForm);
  const [eventForm, setEventForm] = useState<EventFormState>(defaultEventForm);
  const [memberForm, setMemberForm] = useState<MemberFormState>(defaultMemberForm);
  const [postFilters, setPostFilters] = useState<PostFilterState>(initialUrlState.postFilters);
  const [eventFilters, setEventFilters] = useState<EventFilterState>(initialUrlState.eventFilters);
  const [memberFilters, setMemberFilters] = useState<MemberFilterState>(initialUrlState.memberFilters);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [postErrors, setPostErrors] = useState<FormErrors<PostFormField>>({});
  const [eventErrors, setEventErrors] = useState<FormErrors<EventFormField>>({});
  const [memberErrors, setMemberErrors] = useState<FormErrors<MemberFormField>>({});
  const [presetName, setPresetName] = useState<Record<EntityAdminTabValue, string>>({ posts: "", events: "", members: "" });
  const [selectedIds, setSelectedIds] = useState<SelectionState>({ posts: [], events: [], members: [] });
  const [pagination, setPagination] = useState<PaginationState>(initialUrlState.pagination);
  const [actionLog, setActionLog] = useState<AdminActionLogEntry[]>([]);
  const [actionLogCollapsed, setActionLogCollapsed] = useState(initialUrlState.actionLogCollapsed);
  const [actionLogAreaFilter, setActionLogAreaFilter] = useState<"all" | AdminTabValue>("all");
  const [actionLogTypeFilter, setActionLogTypeFilter] = useState<"all" | AdminActionType>("all");
  const [actionLogExportScope, setActionLogExportScope] = useState<"filtered" | "all">("filtered");
  const [criticalNotificationSettings, setCriticalNotificationSettings] = useState<CriticalNotificationSettings>(defaultCriticalNotificationSettings);
  const [criticalNotificationHistory, setCriticalNotificationHistory] = useState<CriticalNotificationHistoryEntry[]>([]);

  const adminQuery = trpc.adminClub.dashboard.useQuery(undefined, {
    enabled: Boolean(user?.role === "admin"),
  });

  const [bitrixQuery, setBitrixQuery] = useState<{
    page: number;
    pageSize: number;
    query: string;
    syncStatus: "all" | "pending" | "success" | "failed" | "retried";
    onlyFailed: boolean;
    source: "all" | "website" | "club" | "referral" | "manual";
  }>({
    page: 1,
    pageSize: 10,
    query: "",
    syncStatus: "all",
    onlyFailed: false,
    source: "all",
  });

  const bitrixAdminQuery = trpc.bitrix24.adminDashboard.useQuery(bitrixQuery, {
    enabled: Boolean(user?.role === "admin"),
  });

  const refreshAdminData = async () => {
    await Promise.all([
      utils.adminClub.dashboard.invalidate(),
      utils.club.feed.invalidate(),
      utils.bitrix24.adminDashboard.invalidate(),
    ]);
  };

  const notifyCriticalAction = trpc.adminClub.notifyCriticalAction.useMutation({
    onError: (error) => {
      toast.error("Критическое уведомление не отправлено", {
        description: error.message,
      });
    },
  });

  const processCriticalAdminNotification = async (
    area: AdminTabValue,
    actionType: AdminActionType,
    title: string,
    description: string,
    affectedCount?: number,
  ) => {
    setActionLog((current) => recordAdminAction(current, area, actionType, title, description));

    const decision = shouldSendCriticalNotification({
      area,
      actionType,
      title,
      description,
      affectedCount,
    }, criticalNotificationSettings);

    if (!decision.shouldNotify) {
      return;
    }

    const actorLabel = user?.name || user?.email || "Администратор фермы";
    const payload = buildCriticalNotificationPayload({
      area,
      actionType,
      title,
      description,
      affectedCount,
    }, decision, actorLabel);

    const result = await notifyCriticalAction.mutateAsync(payload);

    if (area === "posts" || area === "events" || area === "members") {
      setCriticalNotificationHistory((current) => recordCriticalNotificationHistory(current, {
        area,
        actionType,
        title,
        description,
        affectedCount,
      }, decision, actorLabel, result.delivered));
    }

    toast[decision.severityLabel === "high" ? "warning" : "info"]("Критическое уведомление отправлено", {
      description: result.delivered
        ? `Оповещение зафиксировано для действия «${title}».`
        : `Действие «${title}» помечено как критическое, но канал уведомлений временно недоступен.`,
    });
  };

  const getInlineActionToastCopy = (
    entity: "post" | "event" | "member",
    record: { title?: string; name?: string; sortOrder: number; pinned?: boolean; status?: string; badge?: string },
  ) => {
    if (entity === "post") {
      return {
        sortOrder: {
          title: "Порядок поста обновлён",
          description: `Пост «${record.title || "Без названия"}» перемещён на позицию ${record.sortOrder}.`,
        },
        status: {
          title: record.pinned ? "Пост закреплён" : "Пост откреплён",
          description: record.pinned
            ? `Пост «${record.title || "Без названия"}» теперь показывается в закреплённых.`
            : `Пост «${record.title || "Без названия"}» переведён в обычную ленту.`,
        },
      };
    }

    if (entity === "event") {
      return {
        sortOrder: {
          title: "Порядок события обновлён",
          description: `Событие «${record.title || "Без названия"}» перемещено на позицию ${record.sortOrder}.`,
        },
        status: {
          title: "Статус события обновлён",
          description: `Для события «${record.title || "Без названия"}» установлен статус «${record.status || "Без статуса"}».`,
        },
      };
    }

    return {
      sortOrder: {
        title: "Порядок участника обновлён",
        description: `Профиль «${record.name || "Без имени"}» перемещён на позицию ${record.sortOrder}.`,
      },
      status: {
        title: "Бейдж участника обновлён",
        description: `Для профиля «${record.name || "Без имени"}» установлен бейдж «${record.badge || "Без бейджа"}».`,
      },
    };
  };

  const filteredActionLog = actionLog.filter((entry) => {
    const matchesArea = actionLogAreaFilter === "all" || entry.area === actionLogAreaFilter;
    const matchesType = actionLogTypeFilter === "all" || entry.actionType === actionLogTypeFilter;
    return matchesArea && matchesType;
  });
  const actionLogAreaStatsItems = [
    { key: "posts", label: "Посты", value: filteredActionLog.filter((entry) => entry.area === "posts").length },
    { key: "events", label: "События", value: filteredActionLog.filter((entry) => entry.area === "events").length },
    { key: "members", label: "Участники", value: filteredActionLog.filter((entry) => entry.area === "members").length },
  ];
  const exportableActionLog = actionLogExportScope === "all" ? actionLog : filteredActionLog;
  const groupedActionLog = filteredActionLog.reduce<Array<{ key: string; dateLabel: string; hourLabel: string; entries: AdminActionLogEntry[] }>>((groups, entry) => {
    const dateLabel = new Date(entry.timestamp).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const hourLabel = new Date(entry.timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const key = `${dateLabel}-${hourLabel}`;
    const currentGroup = groups.at(-1);

    if (currentGroup?.key === key) {
      currentGroup.entries.push(entry);
      return groups;
    }

    groups.push({
      key,
      dateLabel,
      hourLabel,
      entries: [entry],
    });
    return groups;
  }, []);
  useEffect(() => {
    if (activeTab === "posts" || activeTab === "events" || activeTab === "members") {
      setLastEntityTab(activeTab);
    }
  }, [activeTab]);

  const actionLogFilterPresets: Array<{
    id: string;
    label: string;
    area: "all" | AdminTabValue;
    actionType?: "all" | AdminActionType;
    actionTypes?: AdminActionType[];
  }> = [
    { id: "all", label: "Все действия", area: "all", actionType: "all" },
    { id: "content-updates", label: "Обновления контента", area: "posts", actionType: "update" },
    { id: "event-changes", label: "Изменения событий", area: "events", actionType: "all" },
    { id: "member-ops", label: "Операции с участниками", area: "members", actionType: "all" },
    { id: "risky-actions", label: "Удаления и массовые", area: "all", actionTypes: ["delete", "bulk"] },
  ];
  const applyActionLogPreset = (presetId: string) => {
    if (presetId === "all") {
      setActionLogAreaFilter("all");
      setActionLogTypeFilter("all");
      return;
    }

    const preset = actionLogFilterPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setActionLogAreaFilter(preset.area);
    setActionLogTypeFilter(preset.actionType ?? "all");
  };
  const exportActionLogToCsv = () => {
    if (!exportableActionLog.length) {
      toast.error("Журнал пуст", {
        description: actionLogExportScope === "all"
          ? "В текущей сессии пока нет записей журнала для экспорта в CSV."
          : "Нет записей, подходящих под текущие фильтры, для экспорта в CSV.",
      });
      return;
    }

    const escapeCsvValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = exportableActionLog.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.area,
      entry.actionType,
      entry.title,
      entry.description,
    ]);
    const csv = [
      ["timestamp", "area", "actionType", "title", "description"],
      ...rows,
    ]
      .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download = `admin-club-action-log-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);

    toast.success("CSV выгружен", {
      description: actionLogExportScope === "all"
        ? `Экспортировано ${exportableActionLog.length} записей всего журнала текущей сессии.`
        : `Экспортировано ${exportableActionLog.length} записей журнала действий по текущему виду.`,
    });
  };

  const exportableActionLogIds = new Set(exportableActionLog.map((entry) => entry.id));

  const getActionTypeBadgeConfig = (actionType: AdminActionType) => {
    if (actionType === "create") {
      return {
        label: "Создание",
        className: "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-emerald-700",
      };
    }

    if (actionType === "update") {
      return {
        label: "Изменение",
        className: "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-sky-700",
      };
    }

    if (actionType === "delete") {
      return {
        label: "Удаление",
        className: "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-rose-700",
      };
    }

    if (actionType === "bulk") {
      return {
        label: "Массово",
        className: "rounded-full border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-violet-700",
      };
    }

    return {
      label: "Пресет",
      className: "rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-amber-700",
    };
  };

  const deliveredCriticalCount = criticalNotificationHistory.filter((entry) => entry.delivered).length;
  const failedCriticalCount = criticalNotificationHistory.length - deliveredCriticalCount;

  const actionLogTypeStats = filteredActionLog.reduce<Record<AdminActionType, number>>((accumulator, entry) => {
    accumulator[entry.actionType] += 1;
    return accumulator;
  }, {
    create: 0,
    update: 0,
    delete: 0,
    bulk: 0,
    preset: 0,
    sync: 0,
    refresh: 0,
  });
  const actionLogTypeStatsItems = [
    { key: "create", label: "Создание", value: actionLogTypeStats.create },
    { key: "update", label: "Изменение", value: actionLogTypeStats.update },
    { key: "delete", label: "Удаление", value: actionLogTypeStats.delete },
    { key: "bulk", label: "Массовые", value: actionLogTypeStats.bulk },
    { key: "preset", label: "Пресеты", value: actionLogTypeStats.preset },
  ] as const;
  const copyCurrentViewLink = async () => {
    const shareUrl = `${window.location.origin}${buildAdminClubUrl(activeTab, postFilters, eventFilters, memberFilters, pagination, actionLogCollapsed)}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = window.document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        window.document.body.appendChild(textArea);
        textArea.select();
        window.document.execCommand("copy");
        window.document.body.removeChild(textArea);
      }

      toast.success("Ссылка скопирована", {
        description: "Текущий вид админ-панели сохранён в буфере обмена вместе с фильтрами и состоянием журнала.",
      });
    } catch {
      toast.error("Не удалось скопировать ссылку", {
        description: "Попробуйте ещё раз или скопируйте адрес страницы вручную из браузера.",
      });
    }
  };

  const getBulkActionToastCopy = (entity: "post" | "event" | "member", action: "delete" | "pin" | "unpin", count: number) => {
    if (entity === "post") {
      if (action === "pin") {
        return {
          title: "Посты закреплены",
          description: `Закрепление применено к ${count} постам.`,
        };
      }

      if (action === "unpin") {
        return {
          title: "Посты откреплены",
          description: `Обычный режим ленты восстановлен для ${count} постов.`,
        };
      }

      return {
        title: "Посты удалены",
        description: `Из ленты удалено ${count} постов.`,
      };
    }

    if (entity === "event") {
      return {
        title: "События удалены",
        description: `Из расписания удалено ${count} событий.`,
      };
    }

    return {
      title: "Участники удалены",
      description: `Из клуба удалено ${count} профилей участников.`,
    };
  };

  const retryLeadSync = trpc.bitrix24.retryLeadSync.useMutation({
    onSuccess: async ({ lead }) => {
      await refreshAdminData();
      setActionLog((current) => recordAdminAction(current, "bitrix", "sync", "Повторная синхронизация Bitrix24", `Заявка #${lead?.id ?? "?"} повторно отправлена в CRM.`));
      toast.success("Повторная синхронизация запущена", {
        description: `Заявка #${lead?.id ?? "?"} повторно отправлена в Bitrix24 CRM.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось повторить синхронизацию", {
        description: error.message,
      });
    },
  });
  const refreshDealSnapshot = trpc.bitrix24.refreshDealSnapshot.useMutation({
    onSuccess: async ({ lead }) => {
      await refreshAdminData();
      setActionLog((current) => recordAdminAction(current, "bitrix", "refresh", "Обновлён snapshot сделки", `Для заявки #${lead?.id ?? "?"} обновлён статус сделки и следующей активности.`));
      toast.success("Snapshot сделки обновлён", {
        description: `Bitrix24 snapshot для заявки #${lead?.id ?? "?"} успешно обновлён.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось обновить snapshot сделки", {
        description: error.message,
      });
    },
  });

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

  const createPreset = trpc.adminClub.createPreset.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      setPresetName((current) => ({ ...current, [variables.tab]: "" }));
      toast.success("Пресет сохранён", {
        description: `Набор «${variables.name}» теперь доступен для вкладки ${variables.tab}.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить пресет", {
        description: error.message,
      });
    },
  });

  const deletePreset = trpc.adminClub.deletePreset.useMutation({
    onSuccess: async (_, variables) => {
      await refreshAdminData();
      toast.success("Пресет удалён", {
        description: `Сохранённый набор #${variables.id} удалён из панели.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить пресет", {
        description: error.message,
      });
    },
  });

  const posts = adminQuery.data?.posts ?? [];
  const events = adminQuery.data?.events ?? [];
  const members = adminQuery.data?.members ?? [];
  const presets = (adminQuery.data?.presets ?? []) as ClubAdminPreset[];
  const bitrixSummary = bitrixAdminQuery.data?.summary;
  const bitrixLeads = bitrixAdminQuery.data?.leads ?? [];
  const bitrixAudits = bitrixAdminQuery.data?.audits ?? [];
  const bitrixPagination = bitrixAdminQuery.data?.pagination;
  const bitrixRetryMonitoring = bitrixAdminQuery.data?.retryMonitoring;
  const [bitrixErrorFilter, setBitrixErrorFilter] = useState<"all" | "with_error" | "without_error">("all");
  const [selectedBitrixLeadId, setSelectedBitrixLeadId] = useState<number | null>(null);

  const counts = useMemo(
    () => ({
      posts: posts.length,
      events: events.length,
      members: members.length,
    }),
    [posts.length, events.length, members.length],
  );

  const filteredPosts = useMemo(
    () => sortPosts(filterPosts(posts, postFilters), postFilters),
    [posts, postFilters],
  );
  const filteredEvents = useMemo(
    () => sortEvents(filterEvents(events, eventFilters), eventFilters),
    [events, eventFilters],
  );
  const filteredMembers = useMemo(
    () => sortMembers(filterMembers(members, memberFilters), memberFilters),
    [members, memberFilters],
  );

  const paginatedPosts = useMemo(() => {
    const start = (pagination.posts.page - 1) * pagination.posts.pageSize;
    return filteredPosts.slice(start, start + pagination.posts.pageSize);
  }, [filteredPosts, pagination.posts.page, pagination.posts.pageSize]);
  const paginatedEvents = useMemo(() => {
    const start = (pagination.events.page - 1) * pagination.events.pageSize;
    return filteredEvents.slice(start, start + pagination.events.pageSize);
  }, [filteredEvents, pagination.events.page, pagination.events.pageSize]);
  const paginatedMembers = useMemo(() => {
    const start = (pagination.members.page - 1) * pagination.members.pageSize;
    return filteredMembers.slice(start, start + pagination.members.pageSize);
  }, [filteredMembers, pagination.members.page, pagination.members.pageSize]);

  const totalPages = useMemo(() => ({
    posts: Math.max(1, Math.ceil(filteredPosts.length / pagination.posts.pageSize)),
    events: Math.max(1, Math.ceil(filteredEvents.length / pagination.events.pageSize)),
    members: Math.max(1, Math.ceil(filteredMembers.length / pagination.members.pageSize)),
  }), [
    filteredPosts.length,
    filteredEvents.length,
    filteredMembers.length,
    pagination.posts.pageSize,
    pagination.events.pageSize,
    pagination.members.pageSize,
  ]);

  const visibleBitrixLeads = useMemo(() => {
    return bitrixLeads.filter((lead: any) => {
      const hasError = Boolean(lead.lastSyncError);
      return bitrixErrorFilter === "all"
        ? true
        : bitrixErrorFilter === "with_error"
          ? hasError
          : !hasError;
    });
  }, [bitrixErrorFilter, bitrixLeads]);

  const selectedBitrixLead = useMemo(() => {
    if (!visibleBitrixLeads.length) return null;
    return visibleBitrixLeads.find((lead: any) => lead.id === selectedBitrixLeadId) ?? visibleBitrixLeads[0] ?? null;
  }, [visibleBitrixLeads, selectedBitrixLeadId]);

  const selectedBitrixLeadAudits = useMemo(() => {
    if (!selectedBitrixLead) return [];
    return bitrixAudits.filter((audit: any) => Number(audit.entityId) === Number(selectedBitrixLead.id));
  }, [bitrixAudits, selectedBitrixLead]);

  const postCategories = useMemo(() => uniqueValues(posts, "category"), [posts]);
  const eventStatuses = useMemo(() => uniqueValues(events, "status"), [events]);
  const eventTones = useMemo(() => uniqueValues(events, "tone"), [events]);
  const memberBadges = useMemo(() => uniqueValues(members, "badge"), [members]);
  const selectedPosts = useMemo(() => filteredPosts.filter((post) => selectedIds.posts.includes(post.id)), [filteredPosts, selectedIds.posts]);
  const selectedEvents = useMemo(() => filteredEvents.filter((event) => selectedIds.events.includes(event.id)), [filteredEvents, selectedIds.events]);
  const selectedMembers = useMemo(() => filteredMembers.filter((member) => selectedIds.members.includes(member.id)), [filteredMembers, selectedIds.members]);
  const allVisiblePostsSelected = filteredPosts.length > 0 && filteredPosts.every((post) => selectedIds.posts.includes(post.id));
  const allVisibleEventsSelected = filteredEvents.length > 0 && filteredEvents.every((event) => selectedIds.events.includes(event.id));
  const allVisibleMembersSelected = filteredMembers.length > 0 && filteredMembers.every((member) => selectedIds.members.includes(member.id));
  const presetsByTab = useMemo(() => ({
    posts: presets.filter((preset) => preset.tab === "posts"),
    events: presets.filter((preset) => preset.tab === "events"),
    members: presets.filter((preset) => preset.tab === "members"),
  }), [presets]);

  const isDeleting = deletePost.isPending || deleteEvent.isPending || deleteMember.isPending;
  const deleteDialogCopy = getDeleteDialogCopy(pendingDelete);
  const deleteSummaryOverflow = pendingDelete && "summaryItems" in pendingDelete
    ? Math.max(0, pendingDelete.totalCount - pendingDelete.summaryItems.length)
    : 0;

  const setTabSelection = (tab: EntityAdminTabValue, ids: number[]) => {
    setSelectedIds((current) => ({ ...current, [tab]: ids }));
  };

  const toggleSelection = (tab: EntityAdminTabValue, id: number) => {
    setSelectedIds((current) => ({
      ...current,
      [tab]: current[tab].includes(id)
        ? current[tab].filter((currentId) => currentId !== id)
        : [...current[tab], id],
    }));
  };

  const toggleSelectAllVisible = (tab: EntityAdminTabValue, ids: number[]) => {
    setSelectedIds((current) => ({
      ...current,
      [tab]: current[tab].length === ids.length && ids.every((id) => current[tab].includes(id)) ? [] : ids,
    }));
  };

  const clearSelection = (tab: EntityAdminTabValue) => {
    setTabSelection(tab, []);
  };

  const setTabPage = (tab: EntityAdminTabValue, page: number) => {
    setPagination((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        page: Math.min(Math.max(page, 1), totalPages[tab]),
      },
    }));
  };

  const setTabPageSize = (tab: EntityAdminTabValue, pageSize: number) => {
    setPagination((current) => ({
      ...current,
      [tab]: {
        page: 1,
        pageSize,
      },
    }));
  };

  const handleSavePreset = async (tab: EntityAdminTabValue) => {
    const name = presetName[tab].trim();
    if (!name) {
      toast.error("Укажите название пресета", {
        description: "Название нужно, чтобы повторно использовать сохранённый набор фильтров и сортировки.",
      });
      return;
    }

    const sameTabPresets = presetsByTab[tab];
    await createPreset.mutateAsync({
      tab,
      name,
      config: getPresetConfigForTab(tab, postFilters, eventFilters, memberFilters),
      sortOrder: sameTabPresets.length,
    });

    await processCriticalAdminNotification(
      tab,
      "preset",
      `Сохранён пресет «${name}»`,
      `Администратор сохранил новый пресет для вкладки ${tab}.`,
    );
  };

  const applyPreset = (preset: ClubAdminPreset) => {
    const config = parsePresetConfig(preset.configJson);
    if (!config) {
      toast.error("Пресет повреждён", {
        description: "Не удалось прочитать сохранённую конфигурацию. Попробуйте сохранить её заново.",
      });
      return;
    }

    if (preset.tab === "posts") {
      setActiveTab("posts");
      setPostFilters({
        query: config.query ?? "",
        category: config.category ?? "all",
        pinned: config.pinned ?? "all",
        sortBy: (config.sortBy === "timeLabel" || config.sortBy === "title" ? config.sortBy : "sortOrder") as PostSortField,
        sortDirection: config.sortDirection === "desc" ? "desc" : "asc",
      });
      return;
    }

    if (preset.tab === "events") {
      setActiveTab("events");
      setEventFilters({
        query: config.query ?? "",
        status: config.status ?? "all",
        tone: config.tone ?? "all",
        sortBy: (config.sortBy === "dateLabel" || config.sortBy === "status" ? config.sortBy : "sortOrder") as EventSortField,
        sortDirection: config.sortDirection === "desc" ? "desc" : "asc",
      });
      return;
    }

    setActiveTab("members");
    setMemberFilters({
      query: config.query ?? "",
      badge: config.badge ?? "all",
      sortBy: (config.sortBy === "name" || config.sortBy === "badge" ? config.sortBy : "sortOrder") as MemberSortField,
      sortDirection: config.sortDirection === "desc" ? "desc" : "asc",
    });
  };

  useEffect(() => {
    const nextUrl = buildAdminClubUrl(activeTab, postFilters, eventFilters, memberFilters, pagination, actionLogCollapsed);
    if (location !== nextUrl) {
      setLocation(nextUrl, { replace: true });
    }
  }, [actionLogCollapsed, activeTab, eventFilters, location, memberFilters, pagination, postFilters, setLocation]);
  useEffect(() => {
    setPagination((current) => {
      const nextPage = Math.min(current.posts.page, Math.max(1, Math.ceil(filteredPosts.length / current.posts.pageSize)));
      if (nextPage === current.posts.page) {
        return current;
      }
      return {
        ...current,
        posts: { ...current.posts, page: nextPage },
      };
    });
  }, [filteredPosts.length]);

  useEffect(() => {
    setPagination((current) => {
      const nextPage = Math.min(current.events.page, Math.max(1, Math.ceil(filteredEvents.length / current.events.pageSize)));
      if (nextPage === current.events.page) {
        return current;
      }
      return {
        ...current,
        events: { ...current.events, page: nextPage },
      };
    });
  }, [filteredEvents.length]);

  useEffect(() => {
    setPagination((current) => {
      const nextPage = Math.min(current.members.page, Math.max(1, Math.ceil(filteredMembers.length / current.members.pageSize)));
      if (nextPage === current.members.page) {
        return current;
      }
      return {
        ...current,
        members: { ...current.members, page: nextPage },
      };
    });
  }, [filteredMembers.length]);

  const handlePostSubmit = async () => {
    const nextErrors = validatePostForm(postForm);
    setPostErrors(nextErrors);

    if (hasFormErrors(nextErrors)) {
      toast.error("Заполните обязательные поля поста", {
        description: "Проверьте подсвеченные поля перед сохранением.",
      });
      return;
    }

    if (postForm.id) {
      await updatePost.mutateAsync({ ...postForm, id: postForm.id });
    } else {
      await createPost.mutateAsync(postForm);
    }

    setPostForm(defaultPostForm());
    setPostErrors({});
  };

  const handleEventSubmit = async () => {
    const nextErrors = validateEventForm(eventForm);
    setEventErrors(nextErrors);

    if (hasFormErrors(nextErrors)) {
      toast.error("Заполните обязательные поля события", {
        description: "Проверьте подсвеченные поля перед сохранением.",
      });
      return;
    }

    if (eventForm.id) {
      await updateEvent.mutateAsync({ ...eventForm, id: eventForm.id });
    } else {
      await createEvent.mutateAsync(eventForm);
    }

    setEventForm(defaultEventForm());
    setEventErrors({});
  };

  const handleMemberSubmit = async () => {
    const nextErrors = validateMemberForm(memberForm);
    setMemberErrors(nextErrors);

    if (hasFormErrors(nextErrors)) {
      toast.error("Заполните обязательные поля участника", {
        description: "Проверьте подсвеченные поля перед сохранением.",
      });
      return;
    }

    if (memberForm.id) {
      await updateMember.mutateAsync({ ...memberForm, id: memberForm.id });
    } else {
      await createMember.mutateAsync(memberForm);
    }

    setMemberForm(defaultMemberForm());
    setMemberErrors({});
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.entity === "post") {
      await deletePost.mutateAsync({ id: pendingDelete.id });
      await processCriticalAdminNotification("posts", "delete", `Удалён пост «${pendingDelete.title}»`, `Администратор удалил ${pendingDelete.description}.`, 1);
      return;
    }

    if (pendingDelete.entity === "event") {
      await deleteEvent.mutateAsync({ id: pendingDelete.id });
      await processCriticalAdminNotification("events", "delete", `Удалено событие «${pendingDelete.title}»`, `Администратор удалил ${pendingDelete.description}.`, 1);
      return;
    }

    if (pendingDelete.entity === "member") {
      await deleteMember.mutateAsync({ id: pendingDelete.id });
      await processCriticalAdminNotification("members", "delete", `Удалён участник «${pendingDelete.title}»`, `Администратор удалил ${pendingDelete.description}.`, 1);
      return;
    }

    if (pendingDelete.entity === "bulk-post") {
      for (const id of pendingDelete.ids) {
        await deletePost.mutateAsync({ id });
      }
      clearSelection("posts");
      setPendingDelete(null);
      const toastCopy = getBulkActionToastCopy("post", "delete", pendingDelete.ids.length);
      toast.success(toastCopy.title, {
        description: toastCopy.description,
      });
      await processCriticalAdminNotification("posts", "bulk", toastCopy.title, toastCopy.description, pendingDelete.ids.length);

      return;
    }

    if (pendingDelete.entity === "bulk-event") {
      for (const id of pendingDelete.ids) {
        await deleteEvent.mutateAsync({ id });
      }
      clearSelection("events");
      setPendingDelete(null);
      const toastCopy = getBulkActionToastCopy("event", "delete", pendingDelete.ids.length);
      toast.success(toastCopy.title, {
        description: toastCopy.description,
      });
      await processCriticalAdminNotification("events", "bulk", toastCopy.title, toastCopy.description, pendingDelete.ids.length);

      return;
    }

    for (const id of pendingDelete.ids) {
      await deleteMember.mutateAsync({ id });
    }
    clearSelection("members");
    setPendingDelete(null);
    const toastCopy = getBulkActionToastCopy("member", "delete", pendingDelete.ids.length);
    toast.success(toastCopy.title, {
      description: toastCopy.description,
    });
    await processCriticalAdminNotification("members", "bulk", toastCopy.title, toastCopy.description, pendingDelete.ids.length);

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
            <AlertDialogTitle>{deleteDialogCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialogCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDelete ? (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p className="font-medium text-stone-950">{pendingDelete.title}</p>
              {"summaryItems" in pendingDelete ? (
                <>
                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Первые выбранные записи</p>
                    <div className="mt-2 space-y-2">
                      {pendingDelete.summaryItems.map((item) => (
                        <div key={item} className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  {deleteSummaryOverflow > 0 ? (
                    <p className="text-xs text-stone-500">И ещё {deleteSummaryOverflow} записей будут удалены вместе с показанными выше.</p>
                  ) : null}
                </>
              ) : null}
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
              {isDeleting ? "Удаляем..." : deleteDialogCopy.actionLabel}
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
            if (value === "posts" || value === "events" || value === "members") {
              setLastEntityTab(value);
            }
            setActiveTab(value);
          }
        }} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-stone-100 p-1 sm:grid-cols-2 sm:gap-1 lg:grid-cols-5 md:w-auto">
            <TabsTrigger value="posts" className="w-full whitespace-normal px-3 py-2 text-center">Посты</TabsTrigger>
            <TabsTrigger value="events" className="w-full whitespace-normal px-3 py-2 text-center">События</TabsTrigger>
            <TabsTrigger value="members" className="w-full whitespace-normal px-3 py-2 text-center">Участники</TabsTrigger>
            <TabsTrigger value="bitrix" className="w-full whitespace-normal px-3 py-2 text-center">Bitrix24 CRM</TabsTrigger>
            <TabsTrigger value="activity" className="w-full whitespace-normal px-3 py-2 text-center">Журнал действий</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={postForm.id ? "Редактировать пост" : "Новый пост"}
              description="Заполняйте только основные поля. Изменения сразу попадут в club feed после сохранения."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handlePostSubmit}
                    disabled={createPost.isPending || updatePost.isPending}
                  >
                    {postForm.id ? "Сохранить пост" : "Создать пост"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setPostForm(defaultPostForm());
                    setPostErrors({});
                  }}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Категория" error={postErrors.category}><Input aria-invalid={Boolean(postErrors.category)} value={postForm.category} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, category: value });
                  if (postErrors.category) setPostErrors((current) => ({ ...current, category: undefined }));
                }} /></Field>
                <Field label="Автор" error={postErrors.author}><Input aria-invalid={Boolean(postErrors.author)} value={postForm.author} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, author: value });
                  if (postErrors.author) setPostErrors((current) => ({ ...current, author: undefined }));
                }} /></Field>
                <Field label="Аватар"><Input value={postForm.avatar} onChange={(e) => setPostForm({ ...postForm, avatar: e.target.value.slice(0, 8) })} /></Field>
                <Field label="Роль автора" error={postErrors.role}><Input aria-invalid={Boolean(postErrors.role)} value={postForm.role} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, role: value });
                  if (postErrors.role) setPostErrors((current) => ({ ...current, role: undefined }));
                }} /></Field>
                <Field label="Время" error={postErrors.timeLabel}><Input aria-invalid={Boolean(postErrors.timeLabel)} value={postForm.timeLabel} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, timeLabel: value });
                  if (postErrors.timeLabel) setPostErrors((current) => ({ ...current, timeLabel: undefined }));
                }} /></Field>
                <Field label="Порядок"><Input type="number" value={postForm.sortOrder} onChange={(e) => setPostForm({ ...postForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
                <Field label="Лайки"><Input type="number" value={postForm.likes} onChange={(e) => setPostForm({ ...postForm, likes: Number(e.target.value) || 0 })} /></Field>
                <Field label="Комментарии"><Input type="number" value={postForm.comments} onChange={(e) => setPostForm({ ...postForm, comments: Number(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="Заголовок" error={postErrors.title}><Input aria-invalid={Boolean(postErrors.title)} value={postForm.title} onChange={(e) => {
                const value = e.target.value;
                setPostForm({ ...postForm, title: value });
                if (postErrors.title) setPostErrors((current) => ({ ...current, title: undefined }));
              }} /></Field>
              <Field label="Изображение (URL)"><Input value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Теги CSV"><Input value={postForm.tagsCsv} onChange={(e) => setPostForm({ ...postForm, tagsCsv: e.target.value })} placeholder="утро,марта,клуб" /></Field>
              <Field label="Текст поста" error={postErrors.text}><Textarea aria-invalid={Boolean(postErrors.text)} value={postForm.text} onChange={(e) => {
                const value = e.target.value;
                setPostForm({ ...postForm, text: value });
                if (postErrors.text) setPostErrors((current) => ({ ...current, text: undefined }));
              }} className="min-h-32" /></Field>
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
              sortIndicator={{
                fieldLabel: postFilters.sortBy === "timeLabel" ? "времени" : postFilters.sortBy === "title" ? "заголовку" : "порядку",
                directionLabel: postFilters.sortDirection === "asc" ? "↑" : "↓",
              }}
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по заголовку, тексту, автору или тегам"
                  selectionCount={selectedPosts.length}
                  bulkActions={[
                    {
                      label: allVisiblePostsSelected ? "Снять выбор со всех" : "Выбрать все видимые",
                      icon: allVisiblePostsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
                      variant: "outline",
                      disabled: filteredPosts.length === 0,
                      onClick: () => toggleSelectAllVisible("posts", filteredPosts.map((post) => post.id)),
                    },
                    {
                      label: "Закрепить выбранные",
                      icon: <Pin className="h-4 w-4" />,
                      variant: "outline",
                      disabled: selectedPosts.length === 0 || updatePost.isPending,
                      onClick: () => {
                        void (async () => {
                          for (const post of selectedPosts) {
                            await updatePost.mutateAsync({
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
                              pinned: true,
                              sortOrder: post.sortOrder,
                            });
                          }
                          clearSelection("posts");
                          const toastCopy = getBulkActionToastCopy("post", "pin", selectedPosts.length);
                          toast.success(toastCopy.title, {
                            description: toastCopy.description,
                          });

                        })();
                      },
                    },
                    {
                      label: "Открепить выбранные",
                      icon: <Pin className="h-4 w-4" />,
                      variant: "outline",
                      disabled: selectedPosts.length === 0 || updatePost.isPending,
                      onClick: () => {
                        void (async () => {
                          for (const post of selectedPosts) {
                            await updatePost.mutateAsync({
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
                              pinned: false,
                              sortOrder: post.sortOrder,
                            });
                          }
                          clearSelection("posts");
                          const toastCopy = getBulkActionToastCopy("post", "unpin", selectedPosts.length);
                          toast.success(toastCopy.title, {
                            description: toastCopy.description,
                          });

                        })();
                      },
                    },
                    {
                      label: "Удалить выбранные",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "outline",
                      destructive: true,
                      disabled: selectedPosts.length === 0 || isDeleting,
                      onClick: () => setPendingDelete({
                        entity: "bulk-post",
                        ids: selectedPosts.map((post) => post.id),
                        title: `Выбрано постов: ${selectedPosts.length}`,
                        description: `${selectedPosts.length} постов`,
                        summaryItems: buildBulkDeleteSummaryItems(selectedPosts),
                        totalCount: selectedPosts.length,
                      }),
                    },
                  ]}
                  onClearSelection={() => clearSelection("posts")}
                  presetPanel={
                    <PresetToolbar
                      presetName={presetName.posts}
                      onPresetNameChange={(value) => setPresetName((current) => ({ ...current, posts: value }))}
                      onSave={() => void handleSavePreset("posts")}
                      saveDisabled={createPreset.isPending}
                      presets={presetsByTab.posts}
                      onApplyPreset={applyPreset}
                      onDeletePreset={(presetId) => void deletePreset.mutateAsync({ id: presetId })}
                      deletePending={deletePreset.isPending}
                    />
                  }
                  searchValue={postFilters.query}
                  resultCount={filteredPosts.length}
                  resultLabel="постов"
                  resetLabel="Сбросить фильтры постов"
                  activeFilterChips={[
                    postFilters.query
                      ? { label: `Поиск: ${postFilters.query}`, onRemove: () => setPostFilters((current) => ({ ...current, query: "" })) }
                      : null,
                    postFilters.category !== "all"
                      ? { label: `Категория: ${postFilters.category}`, onRemove: () => setPostFilters((current) => ({ ...current, category: "all" })) }
                      : null,
                    postFilters.pinned === "pinned"
                      ? { label: "Тип: только pinned", onRemove: () => setPostFilters((current) => ({ ...current, pinned: "all" })) }
                      : postFilters.pinned === "regular"
                        ? { label: "Тип: только обычные", onRemove: () => setPostFilters((current) => ({ ...current, pinned: "all" })) }
                        : null,
                    postFilters.sortBy !== "sortOrder"
                      ? { label: `Сортировка: ${postFilters.sortBy === "timeLabel" ? "время" : "заголовок"}`, onRemove: () => setPostFilters((current) => ({ ...current, sortBy: "sortOrder" })) }
                      : null,
                    postFilters.sortDirection !== "asc"
                      ? { label: "Порядок: по убыванию", onRemove: () => setPostFilters((current) => ({ ...current, sortDirection: "asc" })) }
                      : null,
                  ].filter(Boolean) as FilterChip[]}
                  onSearchChange={(value) => setPostFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setPostFilters(defaultPostFilters())}
                  hasActiveFilters={postFilters.query !== "" || postFilters.category !== "all" || postFilters.pinned !== "all" || postFilters.sortBy !== "sortOrder" || postFilters.sortDirection !== "asc"}
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
                  <SelectFilter
                    label="Сортировать по"
                    value={postFilters.sortBy}
                    onChange={(value) => setPostFilters((current) => ({ ...current, sortBy: value as PostSortField }))}
                    options={[
                      { label: "Порядок", value: "sortOrder" },
                      { label: "Время", value: "timeLabel" },
                      { label: "Заголовок", value: "title" },
                    ]}
                  />
                  <SelectFilter
                    label="Направление"
                    value={postFilters.sortDirection}
                    onChange={(value) => setPostFilters((current) => ({ ...current, sortDirection: value as SortDirection }))}
                    options={[
                      { label: "По возрастанию", value: "asc" },
                      { label: "По убыванию", value: "desc" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={paginatedPosts}
              pagination={buildPaginationMeta(filteredPosts.length, pagination.posts.page, pagination.posts.pageSize, totalPages.posts)}
              onPageChange={(page) => setTabPage("posts", page)}
              onPageSizeChange={(pageSize) => setTabPageSize("posts", pageSize)}
              emptyText="По текущим фильтрам посты не найдены."
              renderItem={(post: any) => (
                <ListRow
                  selected={selectedIds.posts.includes(post.id)}
                  onToggleSelected={() => toggleSelection("posts", post.id)}
                  title={post.title}
                  subtitle={`${post.author} · ${post.timeLabel}`}
                  meta={`Категория: ${post.category} · Порядок: ${post.sortOrder}`}
                  badge={post.pinned ? "Pinned" : undefined}
                  inlineActions={[
                    {
                      label: "Порядок",
                      value: post.sortOrder,
                      icon: <ArrowDown className="h-3.5 w-3.5" />,
                      disabled: updatePost.isPending,
                      onClick: async () => {
                        const nextSortOrder = post.sortOrder + 1;
                        await updatePost.mutateAsync({
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
                          pinned: post.pinned,
                          sortOrder: nextSortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("post", { title: post.title, sortOrder: nextSortOrder, pinned: post.pinned });
                        toast.success(toastCopy.sortOrder.title, {
                          description: toastCopy.sortOrder.description,
                        });
                      },
                    },
                    {
                      label: post.pinned ? "Pinned" : "Обычный",
                      icon: <Pin className="h-3.5 w-3.5" />,
                      disabled: updatePost.isPending,
                      onClick: async () => {
                        const nextPinned = !post.pinned;
                        await updatePost.mutateAsync({
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
                          pinned: nextPinned,
                          sortOrder: post.sortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("post", { title: post.title, sortOrder: post.sortOrder, pinned: nextPinned });
                        toast.success(toastCopy.status.title, {
                          description: toastCopy.status.description,
                        });
                      },
                    },
                  ]}
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
                    onClick={handleEventSubmit}
                    disabled={createEvent.isPending || updateEvent.isPending}
                  >
                    {eventForm.id ? "Сохранить событие" : "Создать событие"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setEventForm(defaultEventForm());
                    setEventErrors({});
                  }}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название" error={eventErrors.title}><Input aria-invalid={Boolean(eventErrors.title)} value={eventForm.title} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, title: value });
                  if (eventErrors.title) setEventErrors((current) => ({ ...current, title: undefined }));
                }} /></Field>
                <Field label="Дата" error={eventErrors.dateLabel}><Input aria-invalid={Boolean(eventErrors.dateLabel)} value={eventForm.dateLabel} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, dateLabel: value });
                  if (eventErrors.dateLabel) setEventErrors((current) => ({ ...current, dateLabel: undefined }));
                }} /></Field>
                <Field label="Статус" error={eventErrors.status}><Input aria-invalid={Boolean(eventErrors.status)} value={eventForm.status} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, status: value });
                  if (eventErrors.status) setEventErrors((current) => ({ ...current, status: undefined }));
                }} /></Field>
                <Field label="Тон" error={eventErrors.tone}><Input aria-invalid={Boolean(eventErrors.tone)} value={eventForm.tone} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, tone: value });
                  if (eventErrors.tone) setEventErrors((current) => ({ ...current, tone: undefined }));
                }} /></Field>
                <Field label="Порядок"><Input type="number" value={eventForm.sortOrder} onChange={(e) => setEventForm({ ...eventForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="Описание" error={eventErrors.description}><Textarea aria-invalid={Boolean(eventErrors.description)} value={eventForm.description} onChange={(e) => {
                const value = e.target.value;
                setEventForm({ ...eventForm, description: value });
                if (eventErrors.description) setEventErrors((current) => ({ ...current, description: undefined }));
              }} className="min-h-32" /></Field>
            </EntityFormCard>

            <EntityListCard
              title="События клуба"
              description="Редактируйте даты, статусы и тексты, а также быстро находите нужные записи."
              sortIndicator={{
                fieldLabel: eventFilters.sortBy === "dateLabel" ? "дате" : eventFilters.sortBy === "status" ? "статусу" : "порядку",
                directionLabel: eventFilters.sortDirection === "asc" ? "↑" : "↓",
              }}
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по названию, описанию или дате"
                  selectionCount={selectedEvents.length}
                  bulkActions={[
                    {
                      label: allVisibleEventsSelected ? "Снять выбор со всех" : "Выбрать все видимые",
                      icon: allVisibleEventsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
                      variant: "outline",
                      disabled: filteredEvents.length === 0,
                      onClick: () => toggleSelectAllVisible("events", filteredEvents.map((event) => event.id)),
                    },
                    {
                      label: "Удалить выбранные",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "outline",
                      destructive: true,
                      disabled: selectedEvents.length === 0 || isDeleting,
                      onClick: () => setPendingDelete({
                        entity: "bulk-event",
                        ids: selectedEvents.map((event) => event.id),
                        title: `Выбрано событий: ${selectedEvents.length}`,
                        description: `${selectedEvents.length} событий`,
                        summaryItems: buildBulkDeleteSummaryItems(selectedEvents),
                        totalCount: selectedEvents.length,
                      }),
                    },
                  ]}
                  onClearSelection={() => clearSelection("events")}
                  presetPanel={
                    <PresetToolbar
                      presetName={presetName.events}
                      onPresetNameChange={(value) => setPresetName((current) => ({ ...current, events: value }))}
                      onSave={() => void handleSavePreset("events")}
                      saveDisabled={createPreset.isPending}
                      presets={presetsByTab.events}
                      onApplyPreset={applyPreset}
                      onDeletePreset={(presetId) => void deletePreset.mutateAsync({ id: presetId })}
                      deletePending={deletePreset.isPending}
                    />
                  }
                  searchValue={eventFilters.query}
                  resultCount={filteredEvents.length}
                  resultLabel="событий"
                  resetLabel="Сбросить фильтры событий"
                  activeFilterChips={[
                    eventFilters.query
                      ? { label: `Поиск: ${eventFilters.query}`, onRemove: () => setEventFilters((current) => ({ ...current, query: "" })) }
                      : null,
                    eventFilters.status !== "all"
                      ? { label: `Статус: ${eventFilters.status}`, onRemove: () => setEventFilters((current) => ({ ...current, status: "all" })) }
                      : null,
                    eventFilters.tone !== "all"
                      ? { label: `Тон: ${eventFilters.tone}`, onRemove: () => setEventFilters((current) => ({ ...current, tone: "all" })) }
                      : null,
                    eventFilters.sortBy !== "sortOrder"
                      ? { label: `Сортировка: ${eventFilters.sortBy === "dateLabel" ? "дата" : "статус"}`, onRemove: () => setEventFilters((current) => ({ ...current, sortBy: "sortOrder" })) }
                      : null,
                    eventFilters.sortDirection !== "asc"
                      ? { label: "Порядок: по убыванию", onRemove: () => setEventFilters((current) => ({ ...current, sortDirection: "asc" })) }
                      : null,
                  ].filter(Boolean) as FilterChip[]}
                  onSearchChange={(value) => setEventFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setEventFilters(defaultEventFilters())}
                  hasActiveFilters={eventFilters.query !== "" || eventFilters.status !== "all" || eventFilters.tone !== "all" || eventFilters.sortBy !== "sortOrder" || eventFilters.sortDirection !== "asc"}
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
                  <SelectFilter
                    label="Сортировать по"
                    value={eventFilters.sortBy}
                    onChange={(value) => setEventFilters((current) => ({ ...current, sortBy: value as EventSortField }))}
                    options={[
                      { label: "Порядок", value: "sortOrder" },
                      { label: "Дату", value: "dateLabel" },
                      { label: "Статус", value: "status" },
                    ]}
                  />
                  <SelectFilter
                    label="Направление"
                    value={eventFilters.sortDirection}
                    onChange={(value) => setEventFilters((current) => ({ ...current, sortDirection: value as SortDirection }))}
                    options={[
                      { label: "По возрастанию", value: "asc" },
                      { label: "По убыванию", value: "desc" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={paginatedEvents}
              pagination={buildPaginationMeta(filteredEvents.length, pagination.events.page, pagination.events.pageSize, totalPages.events)}
              onPageChange={(page) => setTabPage("events", page)}
              onPageSizeChange={(pageSize) => setTabPageSize("events", pageSize)}
              emptyText="По текущим фильтрам события не найдены."
              renderItem={(event: any) => (
                <ListRow
                  selected={selectedIds.events.includes(event.id)}
                  onToggleSelected={() => toggleSelection("events", event.id)}
                  title={event.title}
                  subtitle={event.dateLabel}
                  meta={`${event.status} · ${event.tone} · Порядок: ${event.sortOrder}`}
                  inlineActions={[
                    {
                      label: "Порядок",
                      value: event.sortOrder,
                      icon: <ArrowDown className="h-3.5 w-3.5" />,
                      disabled: updateEvent.isPending,
                      onClick: async () => {
                        const nextSortOrder = event.sortOrder + 1;
                        await updateEvent.mutateAsync({
                          id: event.id,
                          title: event.title,
                          dateLabel: event.dateLabel,
                          description: event.description,
                          status: event.status,
                          tone: event.tone,
                          sortOrder: nextSortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("event", { title: event.title, sortOrder: nextSortOrder, status: event.status });
                        toast.success(toastCopy.sortOrder.title, {
                          description: toastCopy.sortOrder.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "events", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description));
                      },
                    },
                    {
                      label: "Статус",
                      value: event.status,
                      icon: <CalendarRange className="h-3.5 w-3.5" />,
                      disabled: updateEvent.isPending,
                      onClick: async () => {
                        const nextStatus = event.status === "Открыта регистрация" ? "Мест нет" : "Открыта регистрация";
                        await updateEvent.mutateAsync({
                          id: event.id,
                          title: event.title,
                          dateLabel: event.dateLabel,
                          description: event.description,
                          status: nextStatus,
                          tone: event.tone,
                          sortOrder: event.sortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("event", { title: event.title, sortOrder: event.sortOrder, status: nextStatus });
                        toast.success(toastCopy.status.title, {
                          description: toastCopy.status.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "events", "update", toastCopy.status.title, toastCopy.status.description));
                      },
                    },
                  ]}
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
                    onClick={handleMemberSubmit}
                    disabled={createMember.isPending || updateMember.isPending}
                  >
                    {memberForm.id ? "Сохранить участника" : "Добавить участника"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setMemberForm(defaultMemberForm());
                    setMemberErrors({});
                  }}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Имя" error={memberErrors.name}><Input aria-invalid={Boolean(memberErrors.name)} value={memberForm.name} onChange={(e) => {
                  const value = e.target.value;
                  setMemberForm({ ...memberForm, name: value });
                  if (memberErrors.name) setMemberErrors((current) => ({ ...current, name: undefined }));
                }} /></Field>
                <Field label="Животное" error={memberErrors.animal}><Input aria-invalid={Boolean(memberErrors.animal)} value={memberForm.animal} onChange={(e) => {
                  const value = e.target.value;
                  setMemberForm({ ...memberForm, animal: value });
                  if (memberErrors.animal) setMemberErrors((current) => ({ ...current, animal: undefined }));
                }} /></Field>
                <Field label="С нами с" error={memberErrors.sinceLabel}><Input aria-invalid={Boolean(memberErrors.sinceLabel)} value={memberForm.sinceLabel} onChange={(e) => {
                  const value = e.target.value;
                  setMemberForm({ ...memberForm, sinceLabel: value });
                  if (memberErrors.sinceLabel) setMemberErrors((current) => ({ ...current, sinceLabel: undefined }));
                }} /></Field>
                <Field label="Бейдж"><Input value={memberForm.badge} onChange={(e) => setMemberForm({ ...memberForm, badge: e.target.value })} /></Field>
                <Field label="Порядок"><Input type="number" value={memberForm.sortOrder} onChange={(e) => setMemberForm({ ...memberForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
              </div>
            </EntityFormCard>

            <EntityListCard
              title="Участники клуба"
              description="Ищите по имени, животному или бейджу и быстро поддерживайте состав сообщества в порядке."
              sortIndicator={{
                fieldLabel: memberFilters.sortBy === "name" ? "имени" : memberFilters.sortBy === "badge" ? "бейджу" : "порядку",
                directionLabel: memberFilters.sortDirection === "asc" ? "↑" : "↓",
              }}
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по имени, животному или периоду участия"
                  selectionCount={selectedMembers.length}
                  bulkActions={[
                    {
                      label: allVisibleMembersSelected ? "Снять выбор со всех" : "Выбрать все видимые",
                      icon: allVisibleMembersSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
                      variant: "outline",
                      disabled: filteredMembers.length === 0,
                      onClick: () => toggleSelectAllVisible("members", filteredMembers.map((member) => member.id)),
                    },
                    {
                      label: "Удалить выбранных",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "outline",
                      destructive: true,
                      disabled: selectedMembers.length === 0 || isDeleting,
                      onClick: () => setPendingDelete({
                        entity: "bulk-member",
                        ids: selectedMembers.map((member) => member.id),
                        title: `Выбрано участников: ${selectedMembers.length}`,
                        description: `${selectedMembers.length} участников`,
                        summaryItems: buildBulkDeleteSummaryItems(selectedMembers),
                        totalCount: selectedMembers.length,
                      }),
                    },
                  ]}
                  onClearSelection={() => clearSelection("members")}
                  presetPanel={
                    <PresetToolbar
                      presetName={presetName.members}
                      onPresetNameChange={(value) => setPresetName((current) => ({ ...current, members: value }))}
                      onSave={() => void handleSavePreset("members")}
                      saveDisabled={createPreset.isPending}
                      presets={presetsByTab.members}
                      onApplyPreset={applyPreset}
                      onDeletePreset={(presetId) => void deletePreset.mutateAsync({ id: presetId })}
                      deletePending={deletePreset.isPending}
                    />
                  }
                  searchValue={memberFilters.query}
                  resultCount={filteredMembers.length}
                  resultLabel="участников"
                  resetLabel="Сбросить фильтры участников"
                  activeFilterChips={[
                    memberFilters.query
                      ? { label: `Поиск: ${memberFilters.query}`, onRemove: () => setMemberFilters((current) => ({ ...current, query: "" })) }
                      : null,
                    memberFilters.badge !== "all"
                      ? { label: `Бейдж: ${memberFilters.badge}`, onRemove: () => setMemberFilters((current) => ({ ...current, badge: "all" })) }
                      : null,
                    memberFilters.sortBy !== "sortOrder"
                      ? { label: `Сортировка: ${memberFilters.sortBy === "name" ? "имя" : "бейдж"}`, onRemove: () => setMemberFilters((current) => ({ ...current, sortBy: "sortOrder" })) }
                      : null,
                    memberFilters.sortDirection !== "asc"
                      ? { label: "Порядок: по убыванию", onRemove: () => setMemberFilters((current) => ({ ...current, sortDirection: "asc" })) }
                      : null,
                  ].filter(Boolean) as FilterChip[]}
                  onSearchChange={(value) => setMemberFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setMemberFilters(defaultMemberFilters())}
                  hasActiveFilters={memberFilters.query !== "" || memberFilters.badge !== "all" || memberFilters.sortBy !== "sortOrder" || memberFilters.sortDirection !== "asc"}
                >
                  <SelectFilter
                    label="Бейдж"
                    value={memberFilters.badge}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, badge: value }))}
                    options={[{ label: "Все бейджи", value: "all" }, ...memberBadges.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Сортировать по"
                    value={memberFilters.sortBy}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, sortBy: value as MemberSortField }))}
                    options={[
                      { label: "Порядок", value: "sortOrder" },
                      { label: "Имени", value: "name" },
                      { label: "Бейджу", value: "badge" },
                    ]}
                  />
                  <SelectFilter
                    label="Направление"
                    value={memberFilters.sortDirection}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, sortDirection: value as SortDirection }))}
                    options={[
                      { label: "По возрастанию", value: "asc" },
                      { label: "По убыванию", value: "desc" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={paginatedMembers}
              pagination={buildPaginationMeta(filteredMembers.length, pagination.members.page, pagination.members.pageSize, totalPages.members)}
              onPageChange={(page) => setTabPage("members", page)}
              onPageSizeChange={(pageSize) => setTabPageSize("members", pageSize)}
              emptyText="По текущим фильтрам участники не найдены."
              renderItem={(member: any) => (
                <ListRow
                  selected={selectedIds.members.includes(member.id)}
                  onToggleSelected={() => toggleSelection("members", member.id)}
                  title={member.name}
                  subtitle={member.animal}
                  meta={`${member.sinceLabel} · ${member.badge} · Порядок: ${member.sortOrder}`}
                  inlineActions={[
                    {
                      label: "Порядок",
                      value: member.sortOrder,
                      icon: <ArrowDown className="h-3.5 w-3.5" />,
                      disabled: updateMember.isPending,
                      onClick: async () => {
                        const nextSortOrder = member.sortOrder + 1;
                        await updateMember.mutateAsync({
                          id: member.id,
                          name: member.name,
                          animal: member.animal,
                          sinceLabel: member.sinceLabel,
                          badge: member.badge,
                          sortOrder: nextSortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("member", { name: member.name, sortOrder: nextSortOrder, badge: member.badge });
                        toast.success(toastCopy.sortOrder.title, {
                          description: toastCopy.sortOrder.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "members", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description));
                      },
                    },
                    {
                      label: "Бейдж",
                      value: member.badge || "без бейджа",
                      icon: <Crown className="h-3.5 w-3.5" />,
                      disabled: updateMember.isPending,
                      onClick: async () => {
                        const nextBadge = member.badge === "Амбассадор" ? "Гость фермы" : "Амбассадор";
                        await updateMember.mutateAsync({
                          id: member.id,
                          name: member.name,
                          animal: member.animal,
                          sinceLabel: member.sinceLabel,
                          badge: nextBadge,
                          sortOrder: member.sortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("member", { name: member.name, sortOrder: member.sortOrder, badge: nextBadge });
                        toast.success(toastCopy.status.title, {
                          description: toastCopy.status.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "members", "update", toastCopy.status.title, toastCopy.status.description));
                      },
                    },
                  ]}
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

          <TabsContent value="bitrix" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Всего лидов" value={bitrixSummary?.totalLeads ?? 0} icon={<Users className="h-4 w-4" />} />
              <MetricCard label="В очереди / retry" value={(bitrixSummary?.pendingLeads ?? 0) + (bitrixSummary?.retriedLeads ?? 0)} icon={<RefreshCw className="h-4 w-4" />} />
              <MetricCard label="Успешно синхронизировано" value={bitrixSummary?.successfulLeads ?? 0} icon={<CheckSquare className="h-4 w-4" />} />
              <MetricCard label="Ошибки аудита" value={bitrixSummary?.failedAudits ?? 0} icon={<ShieldAlert className="h-4 w-4" />} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-stone-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-stone-950">Операционные уведомления Bitrix24</CardTitle>
                      <CardDescription className="text-stone-600">
                        Последние сигналы по новым заявкам, failed sync, retry и refresh snapshot. Блок помогает быстро понять, что требует реакции менеджера.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                      Health score: {Math.max(0, 100 - ((bitrixSummary?.failedLeads ?? 0) * 12 + (bitrixSummary?.failedAudits ?? 0) * 7 + (bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0) * 9))}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Новые заявки</p>
                      <p className="mt-2 text-2xl font-semibold text-stone-950">{bitrixSummary?.totalLeads ?? 0}</p>
                      <p className="mt-1 text-xs text-stone-500">Все лиды, доступные в live CRM-ленте.</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-rose-500">Failed без retry</p>
                      <p className="mt-2 text-2xl font-semibold text-rose-900">{bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0}</p>
                      <p className="mt-1 text-xs text-rose-700/80">Заявки, которые сейчас сильнее всего требуют ручного действия.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-amber-600">Повторные попытки</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-900">{bitrixRetryMonitoring?.repeatedAttemptLeadCount ?? 0}</p>
                      <p className="mt-1 text-xs text-amber-800/80">Лиды, по которым уже шли retry-циклы.</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-emerald-600">Snapshot-ready</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-900">{visibleBitrixLeads.filter((lead: any) => Boolean(lead.bitrixDealId)).length}</p>
                      <p className="mt-1 text-xs text-emerald-800/80">Лиды на текущей выборке, где уже можно делать refresh snapshot.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      {
                        title: "Новые партнёрские заявки",
                        tone: "border-sky-200 bg-sky-50/80 text-sky-900",
                        body: `Зафиксировано лидов: ${bitrixSummary?.totalLeads ?? 0}. Последний проблемный lead ID: ${bitrixRetryMonitoring?.latestFailedLeadId ?? "—"}.`,
                      },
                      {
                        title: "Failed sync и delivery risk",
                        tone: (bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0) > 0 ? "border-rose-200 bg-rose-50/80 text-rose-900" : "border-emerald-200 bg-emerald-50/80 text-emerald-900",
                        body: (bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0) > 0
                          ? `Есть ${bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0} заявки без retry. Стоит открыть detail-view и повторить синхронизацию.`
                          : "Сейчас нет failed-заявок без retry; ручное вмешательство не требуется.",
                      },
                      {
                        title: "Retry и snapshot активность",
                        tone: "border-amber-200 bg-amber-50/80 text-amber-900",
                        body: `Retry lead count: ${bitrixRetryMonitoring?.retryLeadCount ?? 0}. Аудитов интеграции: ${bitrixSummary?.totalAudits ?? 0}, из них failed: ${bitrixSummary?.failedAudits ?? 0}.`,
                      },
                      {
                        title: "Операционный совет",
                        tone: "border-stone-200 bg-stone-50/80 text-stone-900",
                        body: selectedBitrixLead
                          ? `Сейчас в фокусе заявка #${selectedBitrixLead.id}. Ниже можно увидеть payload, полную историю retry/snapshot и audit trail по выбранному лиду.`
                          : "Выберите лид в live-ленте, чтобы справа открыть full payload, retry/snapshot history и связанный audit trail.",
                      },
                    ].map((item) => (
                      <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="mt-2 text-sm leading-6">{item.body}</p>
                          </div>
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-stone-950">Sync-health мониторинг</CardTitle>
                      <CardDescription className="text-stone-600">
                        Компактная операционная сводка по failed without retry, repeated attempts и качеству текущей выборки из server-side фильтров.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                      onClick={() => void refreshAdminData()}
                      disabled={bitrixAdminQuery.isLoading || bitrixAdminQuery.isRefetching}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Обновить CRM-ленту
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">Ключевые риски синхронизации</p>
                        <p className="text-xs text-stone-500">Подходит для ежедневного админ-контроля без перехода в отдельные отчёты.</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                        {visibleBitrixLeads.length} в текущей выборке
                      </Badge>
                    </div>
                    <div className="space-y-3 text-sm text-stone-700">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Failed without retry</span>
                        <strong className="text-stone-950">{bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Repeated attempt leads</span>
                        <strong className="text-stone-950">{bitrixRetryMonitoring?.repeatedAttemptLeadCount ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Retry lead count</span>
                        <strong className="text-stone-950">{bitrixRetryMonitoring?.retryLeadCount ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Failed audits</span>
                        <strong className="text-stone-950">{bitrixSummary?.failedAudits ?? 0}</strong>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-stone-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-stone-950">Live-лиды партнёрской воронки</CardTitle>
                      <CardDescription className="text-stone-600">
                        Видно CRM-статус, менеджера, stage сделки и действия для ручного retry или refresh snapshot прямо из админ-панели.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                      server-side filters active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Поиск по заявке">
                      <input
                        value={bitrixQuery.query}
                        onChange={(event) => setBitrixQuery((current) => ({ ...current, page: 1, query: event.target.value }))}
                        placeholder="Компания, контакт, email"
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      />
                    </Field>
                    <Field label="Sync status">
                      <select
                        value={bitrixQuery.syncStatus}
                        onChange={(event) => setBitrixQuery((current) => ({ ...current, page: 1, syncStatus: event.target.value as "all" | "pending" | "success" | "failed" | "retried" }))}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="all">Все статусы</option>
                        <option value="pending">pending</option>
                        <option value="success">success</option>
                        <option value="failed">failed</option>
                        <option value="retried">retried</option>
                      </select>
                    </Field>
                    <Field label="Источник">
                      <select
                        value={bitrixQuery.source}
                        onChange={(event) => setBitrixQuery((current) => ({ ...current, page: 1, source: event.target.value as "all" | "website" | "club" | "referral" | "manual" }))}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="all">Все источники</option>
                        <option value="website">website</option>
                        <option value="club">club</option>
                        <option value="referral">referral</option>
                        <option value="manual">manual</option>
                      </select>
                    </Field>
                    <Field label="Ошибки синхронизации">
                      <select
                        value={bitrixErrorFilter}
                        onChange={(event) => {
                          const nextValue = event.target.value as "all" | "with_error" | "without_error";
                          setBitrixErrorFilter(nextValue);
                          setBitrixQuery((current) => ({ ...current, page: 1, onlyFailed: nextValue === "with_error" }));
                        }}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="all">Все лиды</option>
                        <option value="with_error">Только с ошибками</option>
                        <option value="without_error">Без ошибок</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-600">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Показано лидов: <strong className="text-stone-950">{visibleBitrixLeads.length}</strong></span>
                      <span>Всего по серверным фильтрам: <strong className="text-stone-950">{bitrixPagination?.totalFilteredLeads ?? visibleBitrixLeads.length}</strong></span>
                      <span>Страница <strong className="text-stone-950">{bitrixPagination?.page ?? bitrixQuery.page}</strong> / {bitrixPagination?.pageCount ?? 1}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                        Повторные попытки: {bitrixSummary?.retriedLeads ?? 0}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                        Ошибки: {bitrixSummary?.failedLeads ?? 0}
                      </Badge>
                    </div>
                  </div>
                  {visibleBitrixLeads.length ? (
                    <div className="space-y-3">
                      {visibleBitrixLeads.map((lead: any) => {
                        const statusTone = lead.syncStatus === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : lead.syncStatus === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : lead.syncStatus === "retried"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-sky-200 bg-sky-50 text-sky-800";

                        return (
                          <div
                            key={lead.id}
                            className={selectedBitrixLead?.id === lead.id
                              ? "rounded-2xl border border-stone-900 bg-stone-100 p-4 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.08)]"
                              : "rounded-2xl border border-stone-200 bg-stone-50/80 p-4"}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-stone-950">#{lead.id} · {lead.companyName}</p>
                                  <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] ${statusTone}`}>
                                    {lead.syncStatus}
                                  </Badge>
                                  {lead.bitrixStageId ? (
                                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                      Stage: {lead.bitrixStageId}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm text-stone-600">{lead.fullName} · {lead.email}{lead.phone ? ` · ${lead.phone}` : ""}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                                  <span>Интерес: {lead.interestType}</span>
                                  <span>Источник: {lead.source}</span>
                                  <span>Попытки sync: {lead.syncAttemptCount}</span>
                                  <span>Менеджер: {lead.assignedManagerName || "не назначен"}</span>
                                  <span>Deal ID: {lead.bitrixDealId || "—"}</span>
                                </div>
                                {lead.lastSyncError ? (
                                  <p className="text-xs leading-5 text-rose-700">Ошибка: {lead.lastSyncError}</p>
                                ) : null}
                                <p className="text-xs text-stone-500">
                                  Следующая активность: {lead.nextActivityAt ? new Date(lead.nextActivityAt).toLocaleString("ru-RU") : "ещё не запланирована"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                  onClick={() => setSelectedBitrixLeadId(lead.id)}
                                >
                                  {selectedBitrixLead?.id === lead.id ? "Открыто" : "Открыть detail-view"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                  onClick={() => void retryLeadSync.mutateAsync({ leadId: lead.id })}
                                  disabled={retryLeadSync.isPending}
                                >
                                  Retry sync
                                </Button>
                                <Button
                                  type="button"
                                  className="rounded-full bg-stone-950 text-white hover:bg-stone-800"
                                  onClick={() => void refreshDealSnapshot.mutateAsync({ leadId: lead.id })}
                                  disabled={!lead.bitrixDealId || refreshDealSnapshot.isPending}
                                >
                                  Refresh snapshot
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                      По текущим фильтрам лиды не найдены. Измените server-side статус, поиск, источник или режим ошибок, чтобы вернуть заявки в CRM-мониторинг.
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-2">
                    <div className="text-sm text-stone-500">
                      Следующая страница доступна, если сервер вернёт больше лидов по текущему фильтру.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        onClick={() => setBitrixQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                        disabled={(bitrixPagination?.page ?? bitrixQuery.page) <= 1 || bitrixAdminQuery.isFetching}
                      >
                        Предыдущая страница
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        onClick={() => setBitrixQuery((current) => ({ ...current, page: current.page + 1 }))}
                        disabled={Boolean(bitrixPagination && (bitrixPagination.page >= bitrixPagination.pageCount)) || bitrixAdminQuery.isFetching}
                      >
                        Следующая страница
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-stone-200 bg-white/90 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-stone-950">Detail-view заявки</CardTitle>
                    <CardDescription className="text-stone-600">
                      Карточка выбранного лида: видно контакт, CRM-связки, next activity, ошибки sync, полный payload и ручные действия из текущего контекста.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedBitrixLead ? (
                      <>
                        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-stone-950">#{selectedBitrixLead.id} · {selectedBitrixLead.companyName}</p>
                                <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-700">
                                  {selectedBitrixLead.syncStatus}
                                </Badge>
                                {selectedBitrixLead.bitrixStageId ? (
                                  <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                    Stage: {selectedBitrixLead.bitrixStageId}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-stone-600">{selectedBitrixLead.fullName} · {selectedBitrixLead.email}{selectedBitrixLead.phone ? ` · ${selectedBitrixLead.phone}` : ""}</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Менеджер</p>
                                  <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.assignedManagerName || "Не назначен"}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Следующая активность</p>
                                  <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.nextActivityAt ? new Date(selectedBitrixLead.nextActivityAt).toLocaleString("ru-RU") : "Не запланирована"}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">CRM IDs</p>
                                  <p className="mt-2 leading-6 text-stone-950">Deal: {selectedBitrixLead.bitrixDealId || "—"}<br />Lead: {selectedBitrixLead.bitrixLeadId || "—"}<br />Contact: {selectedBitrixLead.bitrixContactId || "—"}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Sync attempts</p>
                                  <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.syncAttemptCount}</p>
                                  <p className="mt-1 text-xs text-stone-500">Последний sync: {selectedBitrixLead.lastSyncAt ? new Date(selectedBitrixLead.lastSyncAt).toLocaleString("ru-RU") : "ещё не запускался"}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                onClick={() => void retryLeadSync.mutateAsync({ leadId: selectedBitrixLead.id })}
                                disabled={retryLeadSync.isPending}
                              >
                                Retry sync
                              </Button>
                              <Button
                                type="button"
                                className="rounded-full bg-stone-950 text-white hover:bg-stone-800"
                                onClick={() => void refreshDealSnapshot.mutateAsync({ leadId: selectedBitrixLead.id })}
                                disabled={!selectedBitrixLead.bitrixDealId || refreshDealSnapshot.isPending}
                              >
                                Refresh snapshot
                              </Button>
                            </div>
                          </div>
                          {selectedBitrixLead.lastSyncError ? (
                            <Alert className="mt-4 border-rose-200 bg-rose-50/80 text-rose-900">
                              <ShieldAlert className="h-4 w-4" />
                              <AlertTitle>Последняя ошибка синхронизации</AlertTitle>
                              <AlertDescription>{selectedBitrixLead.lastSyncError}</AlertDescription>
                            </Alert>
                          ) : null}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-stone-950">Timeline sync attempts</p>
                                <p className="text-xs text-stone-500">Локальная временная шкала строится из CRM-счётчиков и связанных audit-записей по выбранному лиду.</p>
                              </div>
                              <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                {selectedBitrixLeadAudits.length} audit events
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-3">
                                <p className="text-sm font-medium text-stone-900">Старт лидогенерации</p>
                                <p className="text-xs text-stone-500">Создано: {selectedBitrixLead.createdAt ? new Date(selectedBitrixLead.createdAt).toLocaleString("ru-RU") : "дата недоступна"}</p>
                              </div>
                              {selectedBitrixLeadAudits.slice(0, 6).map((audit: any) => (
                                <div key={audit.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-stone-950">{audit.operation} · {audit.entityType}</p>
                                      <p className="text-xs text-stone-500">{audit.externalId ? `External ID: ${audit.externalId}` : "Без внешнего ID"}</p>
                                      {audit.errorMessage ? <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p> : null}
                                    </div>
                                    <Badge variant="outline" className={audit.status === "success" ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800" : audit.status === "failed" ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800" : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"}>
                                      {audit.status}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-xs text-stone-500">{new Date(audit.createdAt).toLocaleString("ru-RU")}</p>
                                </div>
                              ))}
                              {!selectedBitrixLeadAudits.length ? (
                                <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">
                                  Для этой заявки audit trail пока пуст. После retry sync или refresh snapshot здесь появятся события таймлайна.
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-stone-950">Полный payload и CRM metadata</p>
                                  <p className="text-xs text-stone-500">Быстрый просмотр ключевых полей заявки без обращения к базе или вебхуку вручную.</p>
                                </div>
                                <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                  Lead #{selectedBitrixLead.id}
                                </Badge>
                              </div>
                              <div className="rounded-2xl border border-stone-200 bg-white p-4">
                                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-stone-700">{JSON.stringify({
                                  id: selectedBitrixLead.id,
                                  companyName: selectedBitrixLead.companyName,
                                  fullName: selectedBitrixLead.fullName,
                                  email: selectedBitrixLead.email,
                                  phone: selectedBitrixLead.phone,
                                  telegram: selectedBitrixLead.telegram,
                                  region: selectedBitrixLead.region,
                                  source: selectedBitrixLead.source,
                                  interestType: selectedBitrixLead.interestType,
                                  preferredContactMethod: selectedBitrixLead.preferredContactMethod,
                                  interestProducts: selectedBitrixLead.interestProducts,
                                  notes: selectedBitrixLead.notes,
                                  syncStatus: selectedBitrixLead.syncStatus,
                                  syncAttemptCount: selectedBitrixLead.syncAttemptCount,
                                  lastSyncAt: selectedBitrixLead.lastSyncAt,
                                  lastSyncError: selectedBitrixLead.lastSyncError,
                                  bitrixStageId: selectedBitrixLead.bitrixStageId,
                                  bitrixDealId: selectedBitrixLead.bitrixDealId,
                                  bitrixLeadId: selectedBitrixLead.bitrixLeadId,
                                  bitrixContactId: selectedBitrixLead.bitrixContactId,
                                  assignedManagerId: selectedBitrixLead.assignedManagerId,
                                  assignedManagerName: selectedBitrixLead.assignedManagerName,
                                  nextActivityAt: selectedBitrixLead.nextActivityAt,
                                  createdAt: selectedBitrixLead.createdAt,
                                }, null, 2)}</pre>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-stone-950">Retry / snapshot history</p>
                                  <p className="text-xs text-stone-500">Полная история ручных sync-циклов и pull snapshot по выбранной заявке.</p>
                                </div>
                                <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                  {selectedBitrixLeadAudits.filter((audit: any) => ["retry", "sync", "pull"].includes(String(audit.operation))).length} relevant events
                                </Badge>
                              </div>
                              <div className="space-y-3">
                                {selectedBitrixLeadAudits.filter((audit: any) => ["retry", "sync", "pull"].includes(String(audit.operation))).slice(0, 10).map((audit: any) => (
                                  <div key={`history-${audit.id}`} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-stone-950">{audit.operation === "pull" ? "Refresh snapshot" : audit.operation === "retry" ? "Retry sync" : "Первичная sync"}</p>
                                        <p className="text-xs text-stone-500">{audit.externalId ? `External ID: ${audit.externalId}` : "Без внешнего ID"}</p>
                                        {audit.errorMessage ? <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p> : null}
                                      </div>
                                      <Badge variant="outline" className={audit.status === "success" ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800" : audit.status === "failed" ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800" : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"}>
                                        {audit.status}
                                      </Badge>
                                    </div>
                                    {audit.requestPayload ? (
                                      <details className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                        <summary className="cursor-pointer text-xs font-medium text-stone-700">Request payload</summary>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-stone-600">{audit.requestPayload}</pre>
                                      </details>
                                    ) : null}
                                    {audit.responsePayload ? (
                                      <details className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                        <summary className="cursor-pointer text-xs font-medium text-stone-700">Response payload</summary>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-stone-600">{audit.responsePayload}</pre>
                                      </details>
                                    ) : null}
                                    <p className="mt-2 text-xs text-stone-500">{new Date(audit.createdAt).toLocaleString("ru-RU")}</p>
                                  </div>
                                ))}
                                {!selectedBitrixLeadAudits.filter((audit: any) => ["retry", "sync", "pull"].includes(String(audit.operation))).length ? (
                                  <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">
                                    История retry/snapshot для этой заявки пока пустая. После новых ручных операций здесь появятся request/response payload и статусы доставки.
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                        Выберите лид слева, чтобы открыть detail-view, CRM-связки, timeline попыток синхронизации, полный payload и retry/snapshot history.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-stone-200 bg-white/90 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-stone-950">Audit trail Bitrix24</CardTitle>
                    <CardDescription className="text-stone-600">
                      Последние push/pull операции по интеграции: видно статус, entity, внешний ID и ошибки синхронизации.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bitrixAudits.length ? (
                      bitrixAudits.slice(0, 12).map((audit: any) => (
                        <div key={audit.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-stone-950">{audit.operation} · {audit.entityType}</p>
                                <Badge variant="outline" className={audit.status === "success" ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800" : audit.status === "failed" ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800" : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"}>
                                  {audit.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-stone-500">Lead #{audit.entityId} · External ID: {audit.externalId || "—"}</p>
                              {audit.errorMessage ? <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p> : null}
                            </div>
                            <span className="text-xs text-stone-500">{new Date(audit.createdAt).toLocaleString("ru-RU")}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                        Аудит интеграции пока пуст. После первой отправки или refresh snapshot здесь появятся push/pull записи.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="activity" className="space-y-6">
            <Card className="border-stone-200 bg-white/90">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Последние действия администратора</CardTitle>
                    <CardDescription>Короткий локальный журнал последних операций в этой сессии для прозрачности изменений в клубной панели.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700">
                      {actionLog.length} записей
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={() => setActionLogCollapsed((current) => !current)}
                    >
                      {actionLogCollapsed ? <ChevronDown className="mr-1.5 h-4 w-4" /> : <ChevronUp className="mr-1.5 h-4 w-4" />}
                      {actionLogCollapsed ? "Развернуть" : "Свернуть"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={copyCurrentViewLink}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      Скопировать ссылку
                    </Button>
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-3 py-1 text-xs text-stone-700">
                      Видимо сейчас: {filteredActionLog.length}
                    </Badge>
                    <Select value={actionLogExportScope} onValueChange={(value) => setActionLogExportScope(value as "filtered" | "all")}>
                      <SelectTrigger className="h-9 w-[220px] rounded-full border-stone-300 bg-white text-xs text-stone-700">
                        <SelectValue placeholder="Глубина экспорта" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="filtered">Экспорт: текущий вид</SelectItem>
                        <SelectItem value="all">Экспорт: весь журнал сессии</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={exportActionLogToCsv}
                      disabled={!exportableActionLog.length}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={() => setActionLog([])}
                      disabled={!actionLog.length}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Очистить
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {actionLogCollapsed ? (
                <CardContent>
                  <p className="text-sm text-stone-500">Журнал свёрнут. Разверните блок, чтобы посмотреть последние действия администратора и применить фильтры.</p>
                </CardContent>
              ) : (
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="sticky top-3 z-10 -mx-1 space-y-3 rounded-2xl border border-stone-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
                      <div className="flex flex-wrap gap-2">
                        {actionLogFilterPresets.map((preset) => {
                          const matchesArea = actionLogAreaFilter === preset.area;
                          const matchesType = preset.actionTypes?.length
                            ? preset.actionTypes.includes(actionLogTypeFilter as AdminActionType)
                            : actionLogTypeFilter === (preset.actionType ?? "all");
                          const isActive = matchesArea && matchesType;

                          return (
                            <Button
                              key={preset.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              className={isActive
                                ? "rounded-full border-stone-900 bg-stone-900 px-3 text-white hover:bg-stone-800"
                                : "rounded-full border-stone-300 bg-white px-3 text-stone-700 hover:bg-stone-50"}
                              onClick={() => applyActionLogPreset(preset.id)}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-600">
                        <span>Текущий фильтр показывает {filteredActionLog.length} из {actionLog.length} записей журнала.</span>
                        <span>Режим экспорта: {actionLogExportScope === "all" ? "весь журнал сессии" : "только текущий вид"}.</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {actionLogTypeStatsItems.map((item) => (
                          <div key={item.key} className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                            <p className="mt-2 text-2xl font-semibold text-stone-950">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {actionLogAreaStatsItems.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-dashed border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600">
                          <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                          <p className="mt-2 text-xl font-semibold text-stone-950">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Область журнала">
                        <select
                          value={actionLogAreaFilter}
                          onChange={(event) => setActionLogAreaFilter(event.target.value as "all" | AdminTabValue)}
                          className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                        >
                          <option value="all">Все области</option>
                          <option value="posts">Посты</option>
                          <option value="events">События</option>
                          <option value="members">Участники</option>
                        </select>
                      </Field>
                      <Field label="Тип операции">
                        <select
                          value={actionLogTypeFilter}
                          onChange={(event) => setActionLogTypeFilter(event.target.value as "all" | AdminActionType)}
                          className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                        >
                          <option value="all">Все типы</option>
                          <option value="create">Создание</option>
                          <option value="update">Изменение</option>
                          <option value="delete">Удаление</option>
                          <option value="bulk">Массовые операции</option>
                          <option value="preset">Пресеты</option>
                        </select>
                      </Field>
                    </div>
                    <Card className="border-amber-200 bg-amber-50/70 shadow-none">
                      <CardHeader className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base text-stone-950">Критические уведомления для администраторов</CardTitle>
                            <CardDescription className="text-stone-600">
                              Отправляйте owner-уведомления при удалениях и массовых действиях, которые требуют быстрого внимания.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-stone-900">Включить критические уведомления</p>
                              <p className="text-xs text-stone-500">Если выключить, журнал останется локальным без отправки owner-оповещений.</p>
                            </div>
                            <Switch
                              checked={criticalNotificationSettings.enabled}
                              onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, enabled: checked }))}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Удаления</p>
                                  <p className="text-xs text-stone-500">Оповещать о каждом одиночном удалении.</p>
                                </div>
                                <Switch
                                  checked={criticalNotificationSettings.notifyOnDelete}
                                  onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, notifyOnDelete: checked }))}
                                  disabled={!criticalNotificationSettings.enabled}
                                />
                              </div>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Массовые действия</p>
                                  <p className="text-xs text-stone-500">Учитывать порог затронутых записей.</p>
                                </div>
                                <Switch
                                  checked={criticalNotificationSettings.notifyOnBulk}
                                  onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, notifyOnBulk: checked }))}
                                  disabled={!criticalNotificationSettings.enabled}
                                />
                              </div>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Пресеты</p>
                                  <p className="text-xs text-stone-500">Отслеживать рискованные изменения пресетов вручную.</p>
                                </div>
                                <Switch
                                  checked={criticalNotificationSettings.notifyOnPreset}
                                  onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, notifyOnPreset: checked }))}
                                  disabled={!criticalNotificationSettings.enabled}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-dashed border-amber-200 bg-white px-4 py-4">
                          <Label htmlFor="critical-bulk-threshold" className="text-sm font-medium text-stone-900">Порог для массовых действий</Label>
                          <Input
                            id="critical-bulk-threshold"
                            type="number"
                            min={1}
                            value={criticalNotificationSettings.minBulkCount}
                            onChange={(event) => {
                              const nextValue = Math.max(1, Number(event.target.value) || 1);
                              setCriticalNotificationSettings((current) => ({ ...current, minBulkCount: nextValue }));
                            }}
                            disabled={!criticalNotificationSettings.enabled || !criticalNotificationSettings.notifyOnBulk}
                          />
                          <p className="text-xs leading-5 text-stone-500">
                            Сейчас owner-уведомление отправится, если массовое действие затронет не менее {criticalNotificationSettings.minBulkCount} записей.
                          </p>
                          <Alert className="border-amber-200 bg-amber-50/80 text-amber-900">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Критерии критичности</AlertTitle>
                            <AlertDescription>
                              Одиночные удаления считаются критическими сразу. Массовые операции сравниваются с порогом, а пресеты уведомляют только при ручном включении.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-stone-200 bg-white/90 shadow-none">
                      <CardHeader className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base text-stone-950">История критических уведомлений</CardTitle>
                            <CardDescription className="text-stone-600">
                              Последние owner-уведомления по рискованным действиям: видно severity, статус доставки и связь с операцией журнала.
                            </CardDescription>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700">
                              Всего: {criticalNotificationHistory.length}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
                              Доставлено: {deliveredCriticalCount}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-800">
                              Сбой: {failedCriticalCount}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {criticalNotificationHistory.length ? (
                          <div className="space-y-3">
                            {criticalNotificationHistory.map((entry) => {
                              const statusBadge = getCriticalNotificationStatusCopy(entry);

                              return (
                                <div key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-stone-950">{entry.title}</p>
                                        <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-600">
                                          {getCriticalNotificationAreaLabel(entry.area)}
                                        </Badge>
                                        <Badge variant="outline" className={statusBadge.className}>
                                          {statusBadge.label}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-stone-600">{entry.description}</p>
                                      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                                        <span>Действие: {entry.actionType}</span>
                                        <span>Severity: {entry.severityLabel}</span>
                                        <span>Автор: {entry.actorLabel}</span>
                                        {typeof entry.affectedCount === "number" ? <span>Затронуто: {entry.affectedCount}</span> : null}
                                      </div>
                                      <p className="text-xs leading-5 text-stone-500">Причина: {entry.reason}</p>
                                    </div>
                                    <span className="text-xs text-stone-500">
                                      {new Date(entry.timestamp).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                            Пока критические уведомления не отправлялись. Как только администратор выполнит рискованное действие, здесь появится запись со статусом доставки.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {filteredActionLog.length ? (
                      <div className="space-y-4">
                        {groupedActionLog.map((group) => (
                          <div key={group.key} className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-2">
                              <p className="text-sm font-semibold text-stone-900">{group.dateLabel}</p>
                              <div className="flex items-center gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-white px-2.5 py-1 text-stone-600">{group.hourLabel}</span>
                                <span>{group.entries.length} {group.entries.length === 1 ? "запись" : group.entries.length < 5 ? "записи" : "записей"}</span>
                              </div>
                            </div>
                            {group.entries.map((entry) => {
                              const actionTypeBadge = getActionTypeBadgeConfig(entry.actionType);
                              const includedInExport = exportableActionLogIds.has(entry.id);

                              return (
                                <div
                                  key={entry.id}
                                  className={includedInExport
                                    ? "rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]"
                                    : "rounded-2xl border border-stone-200 bg-stone-50/70 p-3"}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-stone-950">{entry.title}</p>
                                        <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-600">
                                          {entry.area === "posts" ? "Посты" : entry.area === "events" ? "События" : entry.area === "members" ? "Участники" : entry.area === "bitrix" ? "Bitrix24" : "Журнал"}
                                        </Badge>
                                        <Badge variant="outline" className={actionTypeBadge.className}>
                                          {actionTypeBadge.label}
                                        </Badge>
                                        {includedInExport ? (
                                          <Badge variant="outline" className="rounded-full border-emerald-300 bg-emerald-100/80 px-2.5 py-0.5 text-[11px] text-emerald-800">
                                            В экспорте
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="text-sm text-stone-600">{entry.description}</p>
                                    </div>
                                    <span className="text-xs text-stone-500">
                                      {new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-stone-200 bg-stone-50/70 px-5 py-8">
                        <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 text-left">
                          <div className="rounded-2xl bg-white p-3 text-stone-700 shadow-sm ring-1 ring-stone-200/80">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-base font-semibold text-stone-950">По текущим фильтрам записи журнала не найдены</p>
                            <p className="text-sm leading-6 text-stone-500">
                              Попробуйте сбросить фильтры или вернуться к последней рабочей вкладке, чтобы продолжить управление контентом без лишней навигации.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                              onClick={() => {
                                setActionLogAreaFilter("all");
                                setActionLogTypeFilter("all");
                              }}
                            >
                              Сбросить фильтры
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full bg-stone-950 text-white hover:bg-stone-800"
                              onClick={() => setActiveTab(lastEntityTab)}
                            >
                              <ArrowLeft className="mr-2 h-4 w-4" />
                              Вернуться к вкладке «{lastEntityTab === "posts" ? "Посты" : lastEntityTab === "events" ? "События" : "Участники"}»
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
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
  children: ReactNode;
  footer: ReactNode;
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
  sortIndicator,
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  title: string;
  description: string;
  toolbar?: ReactNode;
  items: any[];
  renderItem: (item: any) => ReactNode;
  emptyText?: string;
  sortIndicator?: {
    fieldLabel: string;
    directionLabel: string;
  };
  pagination?: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
    startItem: number;
    endItem: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {sortIndicator ? (
            <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Сортировка: по {sortIndicator.fieldLabel} {sortIndicator.directionLabel}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {toolbar}
        <div className="space-y-3">
          {items.length ? items.map((item) => <div key={item.id}>{renderItem(item)}</div>) : <p className="text-sm text-stone-500">{emptyText ?? "Пока нет записей."}</p>}
        </div>
        {pagination && onPageChange && onPageSizeChange ? (
          <PaginationToolbar
            totalItems={pagination.totalItems}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            startItem={pagination.startItem}
            endItem={pagination.endItem}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

type FilterChip = {
  label: string;
  onRemove: () => void;
};

function buildPaginationMeta(totalItems: number, page: number, pageSize: number, totalPages: number) {
  if (!totalItems) {
    return {
      totalItems,
      page: 1,
      pageSize,
      totalPages: 1,
      startItem: 0,
      endItem: 0,
    };
  }

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  return {
    totalItems,
    page: safePage,
    pageSize,
    totalPages,
    startItem,
    endItem,
  };
}

function PaginationToolbar({
  totalItems,
  page,
  pageSize,
  totalPages,
  startItem,
  endItem,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-stone-900">
          Показаны записи {startItem}-{endItem} из {totalItems}
        </p>
        <p className="text-xs text-stone-500">
          Страница {page} из {totalPages}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-stone-600">На странице</Label>
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="flex h-9 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            Назад
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            Вперёд
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterToolbar({
  searchPlaceholder,
  searchValue,
  resultCount,
  resultLabel,
  resetLabel,
  activeFilterChips,
  presetPanel,
  onSearchChange,
  onReset,
  hasActiveFilters,
  selectionCount,
  bulkActions,
  onClearSelection,
  children,
}: {
  searchPlaceholder: string;
  searchValue: string;
  resultCount: number;
  resultLabel: string;
  resetLabel: string;
  activeFilterChips?: FilterChip[];
  presetPanel?: ReactNode;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  selectionCount?: number;
  bulkActions?: BulkActionConfig[];
  onClearSelection?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Поиск</Label>
            <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600">
              Найдено: {resultCount} {resultLabel}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input className="pl-9" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} />
          </div>
        </div>
        <Button variant="outline" onClick={onReset} disabled={!hasActiveFilters}>
          <X className="mr-2 h-4 w-4" />{resetLabel}
        </Button>
      </div>
      {selectionCount ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-950">Выбрано записей: {selectionCount}</p>
              <p className="text-xs text-amber-800">Массовые действия применяются только к текущим выбранным позициям.</p>
            </div>
            {onClearSelection ? (
              <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
                <X className="mr-2 h-4 w-4" />Очистить выбор
              </Button>
            ) : null}
          </div>
          {bulkActions?.length ? (
            <div className="flex flex-wrap gap-2">
              {bulkActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? "outline"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={action.destructive ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" : undefined}
                >
                  {action.icon ? <span className="mr-2">{action.icon}</span> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {presetPanel}
      {activeFilterChips?.length ? (
        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
              aria-label={`Убрать фильтр ${chip.label}`}
              title="Нажмите, чтобы убрать этот фильтр"
            >
              <span>{chip.label}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      ) : null}
      {children ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div> : null}
    </div>
  );
}

function PresetToolbar({
  presetName,
  onPresetNameChange,
  onSave,
  saveDisabled,
  presets,
  onApplyPreset,
  onDeletePreset,
  deletePending,
}: {
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSave: () => void;
  saveDisabled: boolean;
  presets: ClubAdminPreset[];
  onApplyPreset: (preset: ClubAdminPreset) => void;
  onDeletePreset: (presetId: number) => void;
  deletePending: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-amber-200 bg-white/80 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-2">
          <Label>Сохранить текущий набор</Label>
          <Input
            value={presetName}
            onChange={(e) => onPresetNameChange(e.target.value)}
            placeholder="Например: Публикации для витрины"
          />
        </div>
        <Button type="button" onClick={onSave} disabled={saveDisabled} className="lg:self-end">
          <Save className="mr-2 h-4 w-4" />Сохранить пресет
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Сохранённые пресеты</Label>
          <span className="text-xs text-stone-500">{presets.length} шт.</span>
        </div>
        {presets.length ? (
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1">
                <button
                  type="button"
                  onClick={() => onApplyPreset(preset)}
                  className="text-xs font-medium text-stone-800 transition-colors hover:text-stone-950"
                  title="Применить пресет"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  disabled={deletePending}
                  className="rounded-full p-0.5 text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                  aria-label={`Удалить пресет ${preset.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">Пока нет сохранённых пресетов для этой вкладки.</p>
        )}
      </div>
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
  selected,
  onToggleSelected,
  inlineActions,
  onEdit,
  onDelete,
  deleting,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  selected?: boolean;
  onToggleSelected?: () => void;
  inlineActions?: InlineActionConfig[];
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${selected ? "border-amber-300 bg-amber-50/50" : "border-stone-200"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {onToggleSelected ? (
            <button
              type="button"
              onClick={onToggleSelected}
              className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${selected ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300 bg-white text-stone-400 hover:border-stone-400"}`}
              aria-pressed={selected}
              aria-label={selected ? `Снять выбор с ${title}` : `Выбрать ${title}`}
            >
              {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-stone-950">{title}</p>
              {badge ? <Badge variant="secondary">{badge}</Badge> : null}
            </div>
            <p className="text-sm text-stone-600">{subtitle}</p>
            <p className="text-xs text-stone-500">{meta}</p>
            {inlineActions?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {inlineActions.map((action) => (
                  <Button
                    key={`${action.label}-${String(action.value ?? "")}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="h-8 rounded-full border-stone-300 bg-white px-3 text-xs text-stone-700 hover:bg-stone-50"
                  >
                    {action.icon ? <span className="mr-1.5">{action.icon}</span> : null}
                    <span>{action.label}</span>
                    {action.value !== undefined ? <span className="ml-1 font-medium text-stone-950">{action.value}</span> : null}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
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

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
