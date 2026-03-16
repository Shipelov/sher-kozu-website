import type { ReactNode } from "react";
import type { AdminActionType, AdminTabValue, EntityAdminTabValue } from "@/lib/adminClubActivity";

export type PostFormState = {
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

export type EventFormState = {
  id?: number;
  title: string;
  dateLabel: string;
  description: string;
  status: string;
  tone: string;
  sortOrder: number;
};

export type MemberFormState = {
  id?: number;
  name: string;
  animal: string;
  sinceLabel: string;
  badge: string;
  sortOrder: number;
};

export type SortDirection = "asc" | "desc";

export type PostSortField = "sortOrder" | "timeLabel" | "title";
export type EventSortField = "sortOrder" | "dateLabel" | "status";
export type MemberSortField = "sortOrder" | "name" | "badge";

export type PostFilterState = {
  query: string;
  category: string;
  pinned: "all" | "pinned" | "regular";
  sortBy: PostSortField;
  sortDirection: SortDirection;
};

export type EventFilterState = {
  query: string;
  status: string;
  tone: string;
  sortBy: EventSortField;
  sortDirection: SortDirection;
};

export type MemberFilterState = {
  query: string;
  badge: string;
  sortBy: MemberSortField;
  sortDirection: SortDirection;
};

export type PendingDeleteState =
  | { entity: "post"; id: number; title: string; description: string }
  | { entity: "event"; id: number; title: string; description: string }
  | { entity: "member"; id: number; title: string; description: string }
  | { entity: "bulk-post"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | { entity: "bulk-event"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | { entity: "bulk-member"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | null;

export type PresetConfig = {
  query?: string;
  category?: string;
  pinned?: "all" | "pinned" | "regular";
  status?: string;
  tone?: string;
  badge?: string;
  sortBy: string;
  sortDirection: SortDirection;
};

export type ClubAdminPreset = {
  id: number;
  tab: EntityAdminTabValue;
  name: string;
  configJson: string;
  sortOrder: number;
};

export type FormErrors<T extends string> = Partial<Record<T, string>>;

export type PostFormField = "category" | "author" | "role" | "timeLabel" | "title" | "text";
export type EventFormField = "title" | "dateLabel" | "description" | "status" | "tone";
export type MemberFormField = "name" | "animal" | "sinceLabel";

export type SelectionState = Record<EntityAdminTabValue, number[]>;
export type PaginationState = Record<EntityAdminTabValue, { page: number; pageSize: number }>;

export type BulkActionConfig = {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "outline";
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export type InlineActionConfig = {
  label: string;
  icon?: ReactNode;
  value?: string | number;
  onClick: () => void;
  disabled?: boolean;
};

export const defaultPostForm = (): PostFormState => ({
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

export const defaultEventForm = (): EventFormState => ({
  title: "",
  dateLabel: "",
  description: "",
  status: "Открыта регистрация",
  tone: "warm",
  sortOrder: 0,
});

export const defaultMemberForm = (): MemberFormState => ({
  name: "",
  animal: "",
  sinceLabel: "",
  badge: "",
  sortOrder: 0,
});

export const defaultPostFilters = (): PostFilterState => ({
  query: "",
  category: "all",
  pinned: "all",
  sortBy: "sortOrder",
  sortDirection: "asc",
});

export const defaultEventFilters = (): EventFilterState => ({
  query: "",
  status: "all",
  tone: "all",
  sortBy: "sortOrder",
  sortDirection: "asc",
});

export const defaultMemberFilters = (): MemberFilterState => ({
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

export function filterPosts(posts: any[], filters: PostFilterState) {
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

export function filterEvents(events: any[], filters: EventFilterState) {
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

export function filterMembers(members: any[], filters: MemberFilterState) {
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

export function uniqueValues(items: any[], key: string) {
  return Array.from(new Set(items.map((item) => String(item[key] ?? "")).filter(Boolean)));
}

function compareValues(left: string | number | null | undefined, right: string | number | null | undefined, direction: SortDirection) {
  const leftValue = typeof left === "number" ? left : String(left ?? "").toLowerCase();
  const rightValue = typeof right === "number" ? right : String(right ?? "").toLowerCase();

  if (leftValue < rightValue) return direction === "asc" ? -1 : 1;
  if (leftValue > rightValue) return direction === "asc" ? 1 : -1;
  return 0;
}

export function sortPosts(posts: any[], filters: PostFilterState) {
  return [...posts].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

export function sortEvents(events: any[], filters: EventFilterState) {
  return [...events].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

export function sortMembers(members: any[], filters: MemberFilterState) {
  return [...members].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

export function isAdminTabValue(value: string | null): value is AdminTabValue {
  return value === "posts" || value === "events" || value === "members" || value === "activity" || value === "bitrix";
}

function parsePageParam(value: string | null) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function parsePageSizeParam(value: string | null) {
  const parsed = Number(value ?? "10");
  return [5, 10, 20, 50].includes(parsed) ? parsed : 10;
}

export function readAdminClubStateFromUrl() {
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

export function validatePostForm(form: PostFormState): FormErrors<PostFormField> {
  return {
    category: validateRequiredText(form.category, "Укажите категорию поста."),
    author: validateRequiredText(form.author, "Укажите автора поста."),
    role: validateRequiredText(form.role, "Укажите роль автора."),
    timeLabel: validateRequiredText(form.timeLabel, "Укажите время публикации."),
    title: validateRequiredText(form.title, "Добавьте заголовок поста."),
    text: validateRequiredText(form.text, "Добавьте текст поста."),
  };
}

export function validateEventForm(form: EventFormState): FormErrors<EventFormField> {
  return {
    title: validateRequiredText(form.title, "Укажите название события."),
    dateLabel: validateRequiredText(form.dateLabel, "Укажите дату события."),
    description: validateRequiredText(form.description, "Добавьте описание события."),
    status: validateRequiredText(form.status, "Укажите статус события."),
    tone: validateRequiredText(form.tone, "Укажите тон карточки."),
  };
}

export function validateMemberForm(form: MemberFormState): FormErrors<MemberFormField> {
  return {
    name: validateRequiredText(form.name, "Укажите имя участника."),
    animal: validateRequiredText(form.animal, "Укажите животное участника."),
    sinceLabel: validateRequiredText(form.sinceLabel, "Укажите дату вступления."),
  };
}

export function hasFormErrors<T extends string>(errors: FormErrors<T>) {
  return Object.values(errors).some(Boolean);
}

export function getCrudToastCopy(entity: "post" | "event" | "member", action: "create" | "update" | "delete", title: string) {
  const safeTitle = title || (entity === "member" ? "Без имени" : "Без названия");
  if (entity === "post") {
    if (action === "create") {
      return {
        title: "Пост создан",
        description: `Материал «${safeTitle}» опубликован в клубной ленте.`,
      };
    }
    if (action === "update") {
      return {
        title: "Пост сохранён",
        description: `Изменения для поста «${safeTitle}» успешно записаны.`,
      };
    }
    return {
      title: "Пост удалён",
      description: `Материал «${safeTitle}» убран из клубной ленты.`,
    };
  }
  if (entity === "event") {
    if (action === "create") {
      return {
        title: "Событие создано",
        description: `Карточка «${safeTitle}» добавлена в Club Feed.`,
      };
    }
    if (action === "update") {
      return {
        title: "Событие сохранено",
        description: `Изменения для события «${safeTitle}» успешно применены.`,
      };
    }
    return {
      title: "Событие удалено",
      description: `Карточка «${safeTitle}» убрана из расписания клуба.`,
    };
  }
  if (action === "create") {
    return {
      title: "Участник добавлен",
      description: `Профиль «${safeTitle}» появился в составе клуба.`,
    };
  }
  if (action === "update") {
    return {
      title: "Участник сохранён",
      description: `Изменения для профиля «${safeTitle}» успешно записаны.`,
    };
  }
  return {
    title: "Участник удалён",
    description: `Профиль «${safeTitle}» убран из клубного состава.`,
  };
}

export function getInlineActionToastCopy(
  entity: "post" | "event" | "member",
  record: { title?: string; name?: string; sortOrder: number; pinned?: boolean; status?: string; badge?: string },
) {
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
}
