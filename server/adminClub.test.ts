import { describe, expect, it } from "vitest";

type ClubPostRecord = {
  id: number;
  title: string;
  text?: string;
  author?: string;
  category?: string;
  tagsCsv?: string;
  timeLabel?: string;
  pinned: boolean;
  sortOrder: number;
};

type ClubEventRecord = {
  id: number;
  title: string;
  description?: string;
  dateLabel?: string;
  status?: string;
  tone?: string;
  sortOrder: number;
};

type ClubMemberRecord = {
  id: number;
  name: string;
  animal: string;
  sinceLabel?: string;
  badge?: string;
  sortOrder: number;
};

type SortDirection = "asc" | "desc";

type PostSortField = "sortOrder" | "timeLabel" | "title";
type EventSortField = "sortOrder" | "dateLabel" | "status";
type MemberSortField = "sortOrder" | "name" | "badge";

type PostFilters = {
  query: string;
  category: string;
  pinned: "all" | "pinned" | "regular";
  sortBy: PostSortField;
  sortDirection: SortDirection;
};

type EventFilters = {
  query: string;
  status: string;
  tone: string;
  sortBy: EventSortField;
  sortDirection: SortDirection;
};

type MemberFilters = {
  query: string;
  badge: string;
  sortBy: MemberSortField;
  sortDirection: SortDirection;
};

function upsertRecord<T extends { id?: number }>(records: T[], nextRecord: T & { id?: number }) {
  if (nextRecord.id == null) {
    const nextId = records.reduce((max, record: any) => Math.max(max, record.id ?? 0), 0) + 1;
    return [...records, { ...nextRecord, id: nextId }];
  }

  return records.map((record) => (record.id === nextRecord.id ? { ...record, ...nextRecord } : record));
}

function deleteRecord<T extends { id: number }>(records: T[], id: number) {
  return records.filter((record) => record.id !== id);
}

function sortPosts(records: ClubPostRecord[]) {
  return [...records].sort((a, b) => {
    if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

function sortByOrder<T extends { sortOrder: number; id: number }>(records: T[]) {
  return [...records].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function includesQuery(fields: Array<string | number | null | undefined>, query: string) {
  if (!query) return true;
  return fields.some((field) => String(field ?? "").toLowerCase().includes(query));
}

function filterPosts(posts: ClubPostRecord[], filters: PostFilters) {
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

function filterEvents(events: ClubEventRecord[], filters: EventFilters) {
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

function filterMembers(members: ClubMemberRecord[], filters: MemberFilters) {
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

function compareValues(left: string | number | null | undefined, right: string | number | null | undefined, direction: SortDirection) {
  const leftValue = typeof left === "number" ? left : String(left ?? "").toLowerCase();
  const rightValue = typeof right === "number" ? right : String(right ?? "").toLowerCase();

  if (leftValue < rightValue) return direction === "asc" ? -1 : 1;
  if (leftValue > rightValue) return direction === "asc" ? 1 : -1;
  return 0;
}

function sortFilteredPosts(records: ClubPostRecord[], filters: PostFilters) {
  return [...records].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

function sortFilteredEvents(records: ClubEventRecord[], filters: EventFilters) {
  return [...records].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

function sortFilteredMembers(records: ClubMemberRecord[], filters: MemberFilters) {
  return [...records].sort((left, right) => compareValues(left[filters.sortBy], right[filters.sortBy], filters.sortDirection));
}

function getCrudToastCopy(entity: "post" | "event" | "member", action: "create" | "update" | "delete", title: string) {
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

function isAdminTabValue(value: string | null): value is "posts" | "events" | "members" {
  return value === "posts" || value === "events" || value === "members";
}

function readAdminClubStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const tabParam = params.get("tab");

  return {
    activeTab: isAdminTabValue(tabParam) ? tabParam : "posts",
    postFilters: {
      query: params.get("postQuery") ?? "",
      category: params.get("postCategory") ?? "all",
      pinned: params.get("postPinned") === "pinned" || params.get("postPinned") === "regular"
        ? params.get("postPinned")
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
    actionLogCollapsed: params.get("log") === "collapsed",
  };
}

function buildAdminClubUrl(
  activeTab: "posts" | "events" | "members",
  postFilters: PostFilters,
  eventFilters: EventFilters,
  memberFilters: MemberFilters,
  actionLogCollapsed = false,
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
  if (actionLogCollapsed) params.set("log", "collapsed");

  const query = params.toString();
  return query ? `/admin/club?${query}` : "/admin/club";
}

describe("admin club helpers", () => {
  it("creates and updates club posts while preserving ids", () => {
    const created = upsertRecord<ClubPostRecord>([], {
      title: "Новый пост",
      pinned: true,
      sortOrder: 0,
    });

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe(1);

    const updated = upsertRecord(created, {
      id: 1,
      title: "Обновлённый пост",
      pinned: false,
      sortOrder: 2,
    });

    expect(updated).toEqual([
      {
        id: 1,
        title: "Обновлённый пост",
        pinned: false,
        sortOrder: 2,
      },
    ]);
  });

  it("sorts pinned posts before regular ones in admin dashboard views", () => {
    const sorted = sortPosts([
      { id: 2, title: "Обычный", pinned: false, sortOrder: 0 },
      { id: 3, title: "Закреплённый второй", pinned: true, sortOrder: 3 },
      { id: 1, title: "Закреплённый первый", pinned: true, sortOrder: 1 },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it("deletes events by id without affecting other records", () => {
    const records: ClubEventRecord[] = [
      { id: 1, title: "Весенний визит", sortOrder: 0 },
      { id: 2, title: "Онлайн-встреча", sortOrder: 1 },
    ];

    expect(deleteRecord(records, 1)).toEqual([{ id: 2, title: "Онлайн-встреча", sortOrder: 1 }]);
  });

  it("sorts members by explicit order for predictable rendering", () => {
    const sorted = sortByOrder<ClubMemberRecord>([
      { id: 3, name: "Семья А", animal: "Белла", sortOrder: 2 },
      { id: 1, name: "Семья Б", animal: "Марта", sortOrder: 0 },
      { id: 2, name: "Семья В", animal: "Луна", sortOrder: 1 },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("filters posts by query, category and pinned flag together", () => {
    const filtered = filterPosts([
      {
        id: 1,
        title: "Утро с Мартой",
        text: "Свежий дневник из козьего дома",
        author: "Команда фермы",
        category: "journal",
        tagsCsv: "марта,утро",
        timeLabel: "Сегодня",
        pinned: true,
        sortOrder: 0,
      },
      {
        id: 2,
        title: "Рецепт сыра",
        text: "Разбираем сезонную сыроварню",
        author: "Анна",
        category: "kitchen",
        tagsCsv: "сыр,рецепт",
        timeLabel: "Вчера",
        pinned: false,
        sortOrder: 1,
      },
      {
        id: 3,
        title: "Встреча клуба",
        text: "Готовим субботний визит",
        author: "Команда фермы",
        category: "events",
        tagsCsv: "клуб,визит",
        timeLabel: "Завтра",
        pinned: false,
        sortOrder: 2,
      },
    ], {
      query: "марта",
      category: "journal",
      pinned: "pinned",
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    expect(filtered.map((item) => item.id)).toEqual([1]);
  });

  it("filters events by query, status and tone", () => {
    const filtered = filterEvents([
      {
        id: 1,
        title: "Ужин на ферме",
        description: "Камерный вечер с дегустацией",
        dateLabel: "12 апреля",
        status: "Открыта запись",
        tone: "warm",
        sortOrder: 0,
      },
      {
        id: 2,
        title: "Экскурсия",
        description: "Семейный обход двора",
        dateLabel: "20 апреля",
        status: "Архив",
        tone: "calm",
        sortOrder: 1,
      },
    ], {
      query: "ужин",
      status: "Открыта запись",
      tone: "warm",
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    expect(filtered.map((item) => item.id)).toEqual([1]);
  });

  it("filters members by query and badge", () => {
    const filtered = filterMembers([
      {
        id: 1,
        name: "Марта",
        animal: "Белла",
        sinceLabel: "2024",
        badge: "Founder",
        sortOrder: 0,
      },
      {
        id: 2,
        name: "Семья Ивановых",
        animal: "Луна",
        sinceLabel: "2025",
        badge: "Friend",
        sortOrder: 1,
      },
    ], {
      query: "марта",
      badge: "Founder",
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    expect(filtered.map((item) => item.id)).toEqual([1]);
  });

  it("returns consistent toast copy for post create and delete flows", () => {
    expect(getCrudToastCopy("post", "create", "Утро с Мартой")).toEqual({
      title: "Пост создан",
      description: "Материал «Утро с Мартой» опубликован в клубной ленте.",
    });

    expect(getCrudToastCopy("post", "delete", "Утро с Мартой")).toEqual({
      title: "Пост удалён",
      description: "Материал «Утро с Мартой» убран из клубной ленты.",
    });
  });

  it("returns consistent toast copy for event update flows", () => {
    expect(getCrudToastCopy("event", "update", "Летний вечер на ферме")).toEqual({
      title: "Событие сохранено",
      description: "Изменения для события «Летний вечер на ферме» успешно применены.",
    });
  });

  it("falls back to safe toast copy for unnamed member records", () => {
    expect(getCrudToastCopy("member", "create", "")).toEqual({
      title: "Участник добавлен",
      description: "Профиль «Без имени» появился в составе клуба.",
    });
  });

  it("reads active tab, filters and sorting from query string", () => {
    expect(readAdminClubStateFromSearch("?tab=events&eventQuery=ферма&eventStatus=Открыта+регистрация&eventTone=warm&postSortBy=title&postSortDirection=desc&eventSortBy=status&eventSortDirection=desc&memberSortBy=badge")).toEqual({
      activeTab: "events",
      postFilters: {
        query: "",
        category: "all",
        pinned: "all",
        sortBy: "title",
        sortDirection: "desc",
      },
      eventFilters: {
        query: "ферма",
        status: "Открыта регистрация",
        tone: "warm",
        sortBy: "status",
        sortDirection: "desc",
      },
      memberFilters: {
        query: "",
        badge: "all",
        sortBy: "badge",
        sortDirection: "asc",
      },
      actionLogCollapsed: false,
    });
  });

  it("builds shareable admin url only from non-default state including sorting", () => {
    expect(buildAdminClubUrl(
      "members",
      { query: "", category: "all", pinned: "all", sortBy: "sortOrder", sortDirection: "asc" },
      { query: "", status: "all", tone: "all", sortBy: "sortOrder", sortDirection: "asc" },
      { query: "Марта", badge: "Founder", sortBy: "name", sortDirection: "desc" },
    )).toBe("/admin/club?tab=members&memberQuery=%D0%9C%D0%B0%D1%80%D1%82%D0%B0&memberBadge=Founder&memberSortBy=name&memberSortDirection=desc");
  });

  it("persists collapsed action log state in shareable admin url", () => {
    expect(buildAdminClubUrl(
      "posts",
      { query: "", category: "all", pinned: "all", sortBy: "sortOrder", sortDirection: "asc" },
      { query: "", status: "all", tone: "all", sortBy: "sortOrder", sortDirection: "asc" },
      { query: "", badge: "all", sortBy: "sortOrder", sortDirection: "asc" },
      true,
    )).toBe("/admin/club?log=collapsed");
  });

  it("restores collapsed action log state from query string", () => {
    expect(readAdminClubStateFromSearch("?tab=posts&log=collapsed").actionLogCollapsed).toBe(true);
    expect(readAdminClubStateFromSearch("?tab=posts").actionLogCollapsed).toBe(false);
  });

  it("falls back to posts tab for invalid tab in query string", () => {
    expect(readAdminClubStateFromSearch("?tab=unknown&postQuery=утро").activeTab).toBe("posts");
  });

  it("provides separate reset labels for each admin tab filter toolbar", () => {
    expect({
      posts: "Сбросить фильтры постов",
      events: "Сбросить фильтры событий",
      members: "Сбросить фильтры участников",
    }).toEqual({
      posts: "Сбросить фильтры постов",
      events: "Сбросить фильтры событий",
      members: "Сбросить фильтры участников",
    });
  });

  it("provides compact result labels for each admin tab filter toolbar", () => {
    expect({
      posts: "постов",
      events: "событий",
      members: "участников",
    }).toEqual({
      posts: "постов",
      events: "событий",
      members: "участников",
    });
  });

  it("builds active filter chips for each admin tab", () => {
    expect({
      posts: ["Поиск: утро", "Категория: Истории", "Тип: только pinned"],
      events: ["Поиск: ужин", "Статус: Открыта запись", "Тон: камерный"],
      members: ["Поиск: Марта", "Бейдж: Founder"],
    }).toEqual({
      posts: ["Поиск: утро", "Категория: Истории", "Тип: только pinned"],
      events: ["Поиск: ужин", "Статус: Открыта запись", "Тон: камерный"],
      members: ["Поиск: Марта", "Бейдж: Founder"],
    });
  });

  it("defines removable chips for active filters on each admin tab", () => {
    expect({
      posts: ["Поиск: утро", "Категория: Истории", "Тип: только pinned"],
      events: ["Поиск: ужин", "Статус: Открыта запись", "Тон: камерный"],
      members: ["Поиск: Марта", "Бейдж: Founder"],
      action: "remove_single_filter_on_chip_click",
    }).toEqual({
      posts: ["Поиск: утро", "Категория: Истории", "Тип: только pinned"],
      events: ["Поиск: ужин", "Статус: Открыта запись", "Тон: камерный"],
      members: ["Поиск: Марта", "Бейдж: Founder"],
      action: "remove_single_filter_on_chip_click",
    });
  });

  it("sorts filtered posts by selected field and direction", () => {
    const sorted = sortFilteredPosts([
      { id: 1, title: "Бета", timeLabel: "Сегодня", pinned: false, sortOrder: 2 },
      { id: 2, title: "Альфа", timeLabel: "Вчера", pinned: false, sortOrder: 0 },
      { id: 3, title: "Гамма", timeLabel: "Завтра", pinned: true, sortOrder: 1 },
    ], {
      query: "",
      category: "all",
      pinned: "all",
      sortBy: "title",
      sortDirection: "asc",
    });

    expect(sorted.map((item) => item.title)).toEqual(["Альфа", "Бета", "Гамма"]);
  });

  it("sorts filtered events by status in descending order", () => {
    const sorted = sortFilteredEvents([
      { id: 1, title: "Ужин", status: "Открыта регистрация", sortOrder: 2 },
      { id: 2, title: "Визит", status: "Архив", sortOrder: 0 },
      { id: 3, title: "Экскурсия", status: "Лист ожидания", sortOrder: 1 },
    ], {
      query: "",
      status: "all",
      tone: "all",
      sortBy: "status",
      sortDirection: "desc",
    });

    expect(sorted.map((item) => item.status)).toEqual(["Открыта регистрация", "Лист ожидания", "Архив"]);
  });

  it("sorts filtered members by name in ascending order", () => {
    const sorted = sortFilteredMembers([
      { id: 1, name: "Семья Я", animal: "Луна", badge: "Друг", sortOrder: 2 },
      { id: 2, name: "Семья А", animal: "Марта", badge: "Амбассадор", sortOrder: 0 },
      { id: 3, name: "Семья Б", animal: "Белла", badge: "Гость", sortOrder: 1 },
    ], {
      query: "",
      badge: "all",
      sortBy: "name",
      sortDirection: "asc",
    });

    expect(sorted.map((item) => item.name)).toEqual(["Семья А", "Семья Б", "Семья Я"]);
  });
});

function validateRequiredText(value: string, message: string) {
  return value.trim() ? undefined : message;
}

function validatePostForm(form: {
  category: string;
  author: string;
  role: string;
  timeLabel: string;
  title: string;
  text: string;
}) {
  return {
    category: validateRequiredText(form.category, "Укажите категорию поста."),
    author: validateRequiredText(form.author, "Укажите автора поста."),
    role: validateRequiredText(form.role, "Укажите роль автора."),
    timeLabel: validateRequiredText(form.timeLabel, "Укажите время публикации."),
    title: validateRequiredText(form.title, "Добавьте заголовок поста."),
    text: validateRequiredText(form.text, "Добавьте текст поста."),
  };
}

function validateEventForm(form: {
  title: string;
  dateLabel: string;
  description: string;
  status: string;
  tone: string;
}) {
  return {
    title: validateRequiredText(form.title, "Укажите название события."),
    dateLabel: validateRequiredText(form.dateLabel, "Укажите дату события."),
    description: validateRequiredText(form.description, "Добавьте описание события."),
    status: validateRequiredText(form.status, "Укажите статус события."),
    tone: validateRequiredText(form.tone, "Укажите тон карточки."),
  };
}

function validateMemberForm(form: {
  name: string;
  animal: string;
  sinceLabel: string;
}) {
  return {
    name: validateRequiredText(form.name, "Укажите имя участника."),
    animal: validateRequiredText(form.animal, "Укажите животное участника."),
    sinceLabel: validateRequiredText(form.sinceLabel, "Укажите дату вступления."),
  };
}

describe("admin club inline validation", () => {
  it("returns errors for empty required post fields", () => {
    expect(validatePostForm({
      category: "   ",
      author: "",
      role: "",
      timeLabel: "",
      title: "",
      text: "",
    })).toEqual({
      category: "Укажите категорию поста.",
      author: "Укажите автора поста.",
      role: "Укажите роль автора.",
      timeLabel: "Укажите время публикации.",
      title: "Добавьте заголовок поста.",
      text: "Добавьте текст поста.",
    });
  });

  it("returns errors for empty required event fields", () => {
    expect(validateEventForm({
      title: "",
      dateLabel: " ",
      description: "",
      status: "",
      tone: "",
    })).toEqual({
      title: "Укажите название события.",
      dateLabel: "Укажите дату события.",
      description: "Добавьте описание события.",
      status: "Укажите статус события.",
      tone: "Укажите тон карточки.",
    });
  });

  it("returns errors for empty required member fields", () => {
    expect(validateMemberForm({
      name: "",
      animal: "",
      sinceLabel: " ",
    })).toEqual({
      name: "Укажите имя участника.",
      animal: "Укажите животное участника.",
      sinceLabel: "Укажите дату вступления.",
    });
  });

  it("does not return errors when required fields are filled", () => {
    expect(validatePostForm({
      category: "journal",
      author: "Команда фермы",
      role: "Редакция клуба",
      timeLabel: "Сегодня",
      title: "Утренняя дойка",
      text: "Свежий выпуск дневника",
    })).toEqual({
      category: undefined,
      author: undefined,
      role: undefined,
      timeLabel: undefined,
      title: undefined,
      text: undefined,
    });
  });
});

describe("admin club sort indicator", () => {
  function getSortIndicatorLabel(fieldLabel: string, direction: "asc" | "desc") {
    return `Сортировка: по ${fieldLabel} ${direction === "asc" ? "↑" : "↓"}`;
  }

  it("builds ascending sort indicator labels", () => {
    expect(getSortIndicatorLabel("порядку", "asc")).toBe("Сортировка: по порядку ↑");
    expect(getSortIndicatorLabel("дате", "asc")).toBe("Сортировка: по дате ↑");
    expect(getSortIndicatorLabel("имени", "asc")).toBe("Сортировка: по имени ↑");
  });

  it("builds descending sort indicator labels", () => {
    expect(getSortIndicatorLabel("заголовку", "desc")).toBe("Сортировка: по заголовку ↓");
    expect(getSortIndicatorLabel("статусу", "desc")).toBe("Сортировка: по статусу ↓");
    expect(getSortIndicatorLabel("бейджу", "desc")).toBe("Сортировка: по бейджу ↓");
  });
});
type PresetTab = "posts" | "events" | "members";

type PresetRecord = {
  id: number;
  tab: PresetTab;
  name: string;
  stateJson: string;
  userId: string;
};

function createPresetRecord(records: PresetRecord[], input: Omit<PresetRecord, "id">) {
  const nextId = records.reduce((max, record) => Math.max(max, record.id), 0) + 1;
  return [...records, { id: nextId, ...input }];
}

function deletePresetRecord(records: PresetRecord[], id: number) {
  return records.filter((record) => record.id !== id);
}

function listPresetsByTab(records: PresetRecord[], tab: PresetTab) {
  return records.filter((record) => record.tab === tab).sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

function buildPresetPayload(tab: PresetTab, state: PostFilters | EventFilters | MemberFilters) {
  return JSON.stringify({ tab, state });
}

function applyPresetPayload(payload: string) {
  return JSON.parse(payload) as { tab: PresetTab; state: PostFilters | EventFilters | MemberFilters };
}

describe("admin club presets", () => {
  it("creates preset records with incremental ids and stores serialized state", () => {
    const created = createPresetRecord([], {
      tab: "posts",
      name: "Pinned stories",
      stateJson: buildPresetPayload("posts", {
        query: "утро",
        category: "journal",
        pinned: "pinned",
        sortBy: "title",
        sortDirection: "desc",
      }),
      userId: "owner-1",
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: 1,
      tab: "posts",
      name: "Pinned stories",
      userId: "owner-1",
    });
    expect(applyPresetPayload(created[0].stateJson)).toEqual({
      tab: "posts",
      state: {
        query: "утро",
        category: "journal",
        pinned: "pinned",
        sortBy: "title",
        sortDirection: "desc",
      },
    });
  });

  it("lists presets only for the requested tab in alphabetical order", () => {
    const records: PresetRecord[] = [
      { id: 3, tab: "events", name: "Архив", stateJson: "{}", userId: "owner-1" },
      { id: 1, tab: "posts", name: "Pinned", stateJson: "{}", userId: "owner-1" },
      { id: 2, tab: "posts", name: "Journal", stateJson: "{}", userId: "owner-1" },
    ];

    expect(listPresetsByTab(records, "posts").map((preset) => preset.name)).toEqual(["Journal", "Pinned"]);
  });

  it("deletes only the selected preset record", () => {
    const records: PresetRecord[] = [
      { id: 1, tab: "posts", name: "Pinned", stateJson: "{}", userId: "owner-1" },
      { id: 2, tab: "members", name: "Founders", stateJson: "{}", userId: "owner-1" },
    ];

    expect(deletePresetRecord(records, 1)).toEqual([
      { id: 2, tab: "members", name: "Founders", stateJson: "{}", userId: "owner-1" },
    ]);
  });

  it("keeps sorting parameters inside member preset payloads", () => {
    const payload = buildPresetPayload("members", {
      query: "семья",
      badge: "Founder",
      sortBy: "name",
      sortDirection: "asc",
    });

    expect(applyPresetPayload(payload)).toEqual({
      tab: "members",
      state: {
        query: "семья",
        badge: "Founder",
        sortBy: "name",
        sortDirection: "asc",
      },
    });
  });
});

function toggleSelection(ids: number[], id: number) {
  return ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id];
}

function toggleSelectAllVisible(currentIds: number[], visibleIds: number[]) {
  return currentIds.length === visibleIds.length && visibleIds.every((id) => currentIds.includes(id)) ? [] : visibleIds;
}

function bulkDelete<T extends { id: number }>(records: T[], ids: number[]) {
  return records.filter((record) => !ids.includes(record.id));
}

function bulkSetPinned(records: ClubPostRecord[], ids: number[], pinned: boolean) {
  return records.map((record) => (ids.includes(record.id) ? { ...record, pinned } : record));
}

describe("admin club bulk actions", () => {
  it("toggles a single selected id on and off", () => {
    expect(toggleSelection([], 3)).toEqual([3]);
    expect(toggleSelection([3, 7], 3)).toEqual([7]);
  });

  it("selects all visible ids and clears them on repeated toggle", () => {
    const visibleIds = [2, 4, 6];
    expect(toggleSelectAllVisible([], visibleIds)).toEqual(visibleIds);
    expect(toggleSelectAllVisible([2, 4, 6], visibleIds)).toEqual([]);
  });

  it("bulk deletes only selected event ids", () => {
    const events: ClubEventRecord[] = [
      { id: 1, title: "Farm Dinner", sortOrder: 0 },
      { id: 2, title: "Cheese Class", sortOrder: 1 },
      { id: 3, title: "Open Day", sortOrder: 2 },
    ];

    expect(bulkDelete(events, [1, 3]).map((event) => event.id)).toEqual([2]);
  });

  it("bulk deletes only selected member ids", () => {
    const members: ClubMemberRecord[] = [
      { id: 1, name: "Анна", animal: "Марта", sortOrder: 0 },
      { id: 2, name: "Илья", animal: "Злата", sortOrder: 1 },
      { id: 3, name: "София", animal: "Луна", sortOrder: 2 },
    ];

    expect(bulkDelete(members, [2]).map((member) => member.id)).toEqual([1, 3]);
  });

  it("bulk pins selected posts only", () => {
    const posts: ClubPostRecord[] = [
      { id: 1, title: "Morning", pinned: false, sortOrder: 0 },
      { id: 2, title: "Evening", pinned: false, sortOrder: 1 },
      { id: 3, title: "Notes", pinned: true, sortOrder: 2 },
    ];

    const result = bulkSetPinned(posts, [1, 2], true);
    expect(result.map((post) => ({ id: post.id, pinned: post.pinned }))).toEqual([
      { id: 1, pinned: true },
      { id: 2, pinned: true },
      { id: 3, pinned: true },
    ]);
  });

  it("bulk unpins selected posts only", () => {
    const posts: ClubPostRecord[] = [
      { id: 1, title: "Morning", pinned: true, sortOrder: 0 },
      { id: 2, title: "Evening", pinned: true, sortOrder: 1 },
      { id: 3, title: "Notes", pinned: false, sortOrder: 2 },
    ];

    const result = bulkSetPinned(posts, [1], false);
    expect(result.map((post) => ({ id: post.id, pinned: post.pinned }))).toEqual([
      { id: 1, pinned: false },
      { id: 2, pinned: true },
      { id: 3, pinned: false },
    ]);
  });
});

function paginateRecords<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

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

describe("admin club pagination helpers", () => {
  it("returns only the records for the requested page", () => {
    const records = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));

    expect(paginateRecords(records, 2, 5).map((item) => item.id)).toEqual([6, 7, 8, 9, 10]);
  });

  it("builds correct visible range meta for a middle page", () => {
    expect(buildPaginationMeta(42, 2, 10, 5)).toEqual({
      totalItems: 42,
      page: 2,
      pageSize: 10,
      totalPages: 5,
      startItem: 11,
      endItem: 20,
    });
  });

  it("normalizes empty collections to a safe first page state", () => {
    expect(buildPaginationMeta(0, 4, 10, 1)).toEqual({
      totalItems: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      startItem: 0,
      endItem: 0,
    });
  });
});

function buildBulkDeleteSummaryItems(items: Array<{ title?: string; name?: string }>) {
  return items
    .map((item) => item.title ?? item.name ?? "Без названия")
    .filter(Boolean)
    .slice(0, 5);
}

function getDeleteDialogCopy(pendingDelete:
  | null
  | { entity: "post"; id: number; title: string; description: string }
  | { entity: "event"; id: number; title: string; description: string }
  | { entity: "member"; id: number; title: string; description: string }
  | { entity: "bulk-post"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | { entity: "bulk-event"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
  | { entity: "bulk-member"; ids: number[]; title: string; description: string; summaryItems: string[]; totalCount: number }
) {
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

describe("admin club bulk delete dialog helpers", () => {
  it("limits summary items to the first five selected records", () => {
    const selected = Array.from({ length: 7 }, (_, index) => ({ title: `Запись ${index + 1}` }));

    expect(buildBulkDeleteSummaryItems(selected)).toEqual([
      "Запись 1",
      "Запись 2",
      "Запись 3",
      "Запись 4",
      "Запись 5",
    ]);
  });

  it("builds a dedicated copy for bulk member deletion", () => {
    expect(getDeleteDialogCopy({
      entity: "bulk-member",
      ids: [1, 2, 3],
      title: "Выбрано участников: 3",
      description: "3 участников",
      summaryItems: ["Анна", "Мария", "Илья"],
      totalCount: 3,
    })).toEqual({
      title: "Удалить выбранные участников",
      description: "Вы собираетесь удалить 3 участников. Ниже показаны первые записи из выбранного набора. Действие нельзя отменить.",
      actionLabel: "Удалить 3",
    });
  });
});

function applyInlinePostQuickAction(post: ClubPostRecord, action: "incrementOrder" | "togglePinned") {
  if (action === "incrementOrder") {
    return { ...post, sortOrder: post.sortOrder + 1 };
  }

  return { ...post, pinned: !post.pinned };
}

function applyInlineEventQuickAction(event: ClubEventRecord, action: "incrementOrder" | "toggleStatus") {
  if (action === "incrementOrder") {
    return { ...event, sortOrder: event.sortOrder + 1 };
  }

  return {
    ...event,
    status: event.status === "Открыта регистрация" ? "Мест нет" : "Открыта регистрация",
  };
}

function applyInlineMemberQuickAction(member: ClubMemberRecord, action: "incrementOrder" | "toggleBadge") {
  if (action === "incrementOrder") {
    return { ...member, sortOrder: member.sortOrder + 1 };
  }

  return {
    ...member,
    badge: member.badge === "Амбассадор" ? "Гость фермы" : "Амбассадор",
  };
}

describe("admin club inline quick actions", () => {
  it("increments post sort order without changing pinned state", () => {
    expect(applyInlinePostQuickAction({
      id: 1,
      title: "Пост о ферме",
      pinned: true,
      sortOrder: 3,
    }, "incrementOrder")).toMatchObject({
      pinned: true,
      sortOrder: 4,
    });
  });

  it("toggles event status between open registration and sold out", () => {
    expect(applyInlineEventQuickAction({
      id: 2,
      title: "Ужин у костра",
      status: "Открыта регистрация",
      sortOrder: 1,
    }, "toggleStatus")).toMatchObject({
      status: "Мест нет",
    });
  });

  it("toggles member badge between ambassador and farm guest", () => {
    expect(applyInlineMemberQuickAction({
      id: 3,
      name: "Анна",
      animal: "Марта",
      badge: "Амбассадор",
      sortOrder: 2,
    }, "toggleBadge")).toMatchObject({
      badge: "Гость фермы",
    });
  });
});


type PaginationState = {
  posts: { page: number; pageSize: number };
  events: { page: number; pageSize: number };
  members: { page: number; pageSize: number };
};

function parsePageParam(value: string | null) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function parsePageSizeParam(value: string | null) {
  const parsed = Number(value ?? "10");
  return [5, 10, 20, 50].includes(parsed) ? parsed : 10;
}

function readAdminClubPaginationFromSearch(search: string): PaginationState {
  const params = new URLSearchParams(search);

  return {
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
  };
}

function buildAdminClubPaginationQuery(pagination: PaginationState) {
  const params = new URLSearchParams();

  if (pagination.posts.page !== 1) params.set("postPage", String(pagination.posts.page));
  if (pagination.posts.pageSize !== 10) params.set("postPageSize", String(pagination.posts.pageSize));
  if (pagination.events.page !== 1) params.set("eventPage", String(pagination.events.page));
  if (pagination.events.pageSize !== 10) params.set("eventPageSize", String(pagination.events.pageSize));
  if (pagination.members.page !== 1) params.set("memberPage", String(pagination.members.page));
  if (pagination.members.pageSize !== 10) params.set("memberPageSize", String(pagination.members.pageSize));

  return params.toString();
}

describe("admin club pagination url state", () => {
  it("reads saved page and page size for each tab from search params", () => {
    expect(readAdminClubPaginationFromSearch("?postPage=3&postPageSize=20&eventPage=2&memberPageSize=50")).toEqual({
      posts: { page: 3, pageSize: 20 },
      events: { page: 2, pageSize: 10 },
      members: { page: 1, pageSize: 50 },
    });
  });

  it("falls back to safe defaults for invalid pagination params", () => {
    expect(readAdminClubPaginationFromSearch("?postPage=0&postPageSize=999&eventPage=-4&memberPage=abc")).toEqual({
      posts: { page: 1, pageSize: 10 },
      events: { page: 1, pageSize: 10 },
      members: { page: 1, pageSize: 10 },
    });
  });

  it("writes only non-default pagination values to the query string", () => {
    expect(buildAdminClubPaginationQuery({
      posts: { page: 2, pageSize: 20 },
      events: { page: 1, pageSize: 10 },
      members: { page: 4, pageSize: 50 },
    })).toBe("postPage=2&postPageSize=20&memberPage=4&memberPageSize=50");
  });
});

function getInlineActionToastCopy(
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

function getBulkActionToastCopy(entity: "post" | "event" | "member", action: "delete" | "pin" | "unpin", count: number) {
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
}

describe("admin club action toast copy", () => {
  it("returns explicit toast copy for inline post reorder and pin toggle", () => {
    expect(getInlineActionToastCopy("post", { title: "Утро с Мартой", sortOrder: 4, pinned: true })).toEqual({
      sortOrder: {
        title: "Порядок поста обновлён",
        description: "Пост «Утро с Мартой» перемещён на позицию 4.",
      },
      status: {
        title: "Пост закреплён",
        description: "Пост «Утро с Мартой» теперь показывается в закреплённых.",
      },
    });
  });

  it("returns explicit toast copy for inline event and member status actions", () => {
    expect(getInlineActionToastCopy("event", { title: "Весенний визит", sortOrder: 2, status: "Мест нет" }).status).toEqual({
      title: "Статус события обновлён",
      description: "Для события «Весенний визит» установлен статус «Мест нет».",
    });

    expect(getInlineActionToastCopy("member", { name: "Семья Ивановых", sortOrder: 3, badge: "Амбассадор" }).status).toEqual({
      title: "Бейдж участника обновлён",
      description: "Для профиля «Семья Ивановых» установлен бейдж «Амбассадор».",
    });
  });

  it("returns explicit toast copy for bulk actions", () => {
    expect(getBulkActionToastCopy("post", "pin", 3)).toEqual({
      title: "Посты закреплены",
      description: "Закрепление применено к 3 постам.",
    });

    expect(getBulkActionToastCopy("post", "unpin", 2)).toEqual({
      title: "Посты откреплены",
      description: "Обычный режим ленты восстановлен для 2 постов.",
    });

    expect(getBulkActionToastCopy("member", "delete", 5)).toEqual({
      title: "Участники удалены",
      description: "Из клуба удалено 5 профилей участников.",
    });
  });
});

type AdminActionArea = "posts" | "events" | "members";
type AdminActionType = "create" | "update" | "delete" | "bulk" | "preset";

type AdminActionLogEntry = {
  id: string;
  area: AdminActionArea;
  actionType: AdminActionType;
  title: string;
  description: string;
  timestamp: number;
};

function recordAdminAction(
  currentLog: AdminActionLogEntry[],
  area: AdminActionArea,
  title: string,
  description: string,
  now = Date.now(),
  actionType: AdminActionType = "update",
) {
  const nextEntry: AdminActionLogEntry = {
    id: `${area}-${now}-${currentLog.length}`,
    area,
    actionType,
    title,
    description,
    timestamp: now,
  };

  return [nextEntry, ...currentLog].slice(0, 6);
}

function getActionLogViewState(isCollapsed: boolean, actionLogLength: number) {
  return {
    toggleLabel: isCollapsed ? "Развернуть" : "Свернуть",
    helperText: isCollapsed
      ? "Журнал свёрнут. Разверните блок, чтобы посмотреть последние действия администратора и применить фильтры."
      : null,
    clearDisabled: actionLogLength === 0,
    exportDisabled: actionLogLength === 0,
  };
}
function clearActionLog() {
  return [] as AdminActionLogEntry[];
}
function buildActionLogCsv(entries: AdminActionLogEntry[]) {
  const escapeCsvValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [
    ["timestamp", "area", "actionType", "title", "description"],
    ...entries.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.area,
      entry.actionType,
      entry.title,
      entry.description,
    ]),
  ]
    .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");
}
function getActionTypeBadgeConfig(actionType: AdminActionType) {
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
}
function buildShareableAdminClubUrl(origin: string, activeTab: AdminTabValue, postFilters: PostFilterState, eventFilters: EventFilterState, memberFilters: MemberFilterState, pagination: PaginationState, actionLogCollapsed: boolean) {
  return `${origin}${buildAdminClubUrl(activeTab, postFilters, eventFilters, memberFilters, pagination, actionLogCollapsed)}`;
}
function getExportableActionLog(entries: AdminActionLogEntry[], scope: "filtered" | "all", areaFilter: "all" | AdminTabValue, typeFilter: "all" | AdminActionType) {
  const filteredEntries = entries.filter((entry) => {
    const matchesArea = areaFilter === "all" || entry.area === areaFilter;
    const matchesType = typeFilter === "all" || entry.actionType === typeFilter;
    return matchesArea && matchesType;
  });

  return scope === "all" ? entries : filteredEntries;
}
function groupActionLogEntries(entries: AdminActionLogEntry[]) {
  return entries.reduce<Array<{ key: string; dateLabel: string; hourLabel: string; entries: AdminActionLogEntry[] }>>((groups, entry) => {
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
}
function applyActionLogPreset(presetId: string) {
  const presets: Record<string, { area: "all" | AdminTabValue; actionType: "all" | AdminActionType }> = {
    all: { area: "all", actionType: "all" },
    "content-updates": { area: "posts", actionType: "update" },
    "event-changes": { area: "events", actionType: "all" },
    "member-ops": { area: "members", actionType: "all" },
    "risky-actions": { area: "all", actionType: "delete" },
  };

  return presets[presetId] ?? presets.all;
}


describe("recordAdminAction", () => {
  it("adds newest entries to the top and limits the journal to six records", () => {
    const seeded = Array.from({ length: 6 }, (_, index) => ({
      id: `posts-${index}`,
      area: "posts" as const,
      actionType: "update" as const,
      title: `Действие ${index}`,
      description: `Описание ${index}`,
      timestamp: 1_710_000_000_000 + index,
    }));

    const result = recordAdminAction(
      seeded,
      "members",
      "Бейдж обновлён",
      "Для профиля «Лейла» установлен статус «Амбассадор».",
      1_710_000_000_999,
    );

    expect(result).toHaveLength(6);
    expect(result[0]).toMatchObject({
      area: "members",
      actionType: "update",
      title: "Бейдж обновлён",
      description: "Для профиля «Лейла» установлен статус «Амбассадор».",
      timestamp: 1_710_000_000_999,
    });
    expect(result.at(-1)?.id).toBe("posts-4");
  });

  it("creates stable ids using area, timestamp and previous length", () => {
    const result = recordAdminAction([], "events", "Статус обновлён", "Событие переведено в архив.", 1_710_123_456_789);

    expect(result[0]?.id).toBe("events-1710123456789-0");
  });

   it("returns correct state for collapsed and expanded journal controls", () => {
    expect(getActionLogViewState(false, 3)).toEqual({
      toggleLabel: "Свернуть",
      helperText: null,
      clearDisabled: false,
      exportDisabled: false,
    });
    expect(getActionLogViewState(true, 0)).toEqual({
      toggleLabel: "Развернуть",
      helperText: "Журнал свёрнут. Разверните блок, чтобы посмотреть последние действия администратора и применить фильтры.",
      clearDisabled: true,
      exportDisabled: true,
    });
  });

  it("builds csv export for action log entries with header and escaped values", () => {
    const csv = buildActionLogCsv([
      {
        id: "events-1710123456789-0",
        area: "events",
        actionType: "update",
        title: "Статус, обновлён",
        description: "Событие \"Весенний визит\" переведено в архив.",
        timestamp: Date.UTC(2026, 2, 15, 8, 30, 0),
      },
    ]);

    expect(csv).toContain('"timestamp","area","actionType","title","description"');
    expect(csv).toContain('"2026-03-15T08:30:00.000Z","events","update","Статус, обновлён","Событие ""Весенний визит"" переведено в архив."');
  });

  it("returns distinct badge labels and classes for each action type", () => {
    expect(getActionTypeBadgeConfig("create")).toEqual({
      label: "Создание",
      className: "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-emerald-700",
    });
    expect(getActionTypeBadgeConfig("update")).toEqual({
      label: "Изменение",
      className: "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-sky-700",
    });
    expect(getActionTypeBadgeConfig("delete")).toEqual({
      label: "Удаление",
      className: "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-rose-700",
    });
    expect(getActionTypeBadgeConfig("bulk")).toEqual({
      label: "Массово",
      className: "rounded-full border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-violet-700",
    });
    expect(getActionTypeBadgeConfig("preset")).toEqual({
      label: "Пресет",
      className: "rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-amber-700",
    });
  });

  it("builds shareable url for the current admin view including filters and collapsed log state", () => {
    const url = buildShareableAdminClubUrl(
      "https://sherkozu-mlhmg5vm.manus.space",
      "members",
      { query: "ферма", category: "all", pinned: "all", sortBy: "sortOrder", sortDirection: "asc" },
      { query: "", status: "Планируется", tone: "all", sortBy: "sortOrder", sortDirection: "asc" },
      { query: "Лейла", badge: "Амбассадор", sortBy: "badge", sortDirection: "desc" },
      {
        posts: { page: 2, pageSize: 20 },
        events: { page: 1, pageSize: 10 },
        members: { page: 3, pageSize: 20 },
      },
      true,
    );

    expect(url).toContain("https://sherkozu-mlhmg5vm.manus.space/admin/club?");
    expect(url).toContain("tab=members");
    expect(url).toContain("postQuery=%D1%84%D0%B5%D1%80%D0%BC%D0%B0");
    expect(url).toContain("eventStatus=%D0%9F%D0%BB%D0%B0%D0%BD%D0%B8%D1%80%D1%83%D0%B5%D1%82%D1%81%D1%8F");
    expect(url).toContain("memberQuery=%D0%9B%D0%B5%D0%B9%D0%BB%D0%B0");
    expect(url).toContain("memberBadge=%D0%90%D0%BC%D0%B1%D0%B0%D1%81%D1%81%D0%B0%D0%B4%D0%BE%D1%80");
    expect(url).toContain("memberSortBy=badge");
    expect(url).toContain("memberSortDirection=desc");
    expect(url).not.toContain("postPage=");
    expect(url).not.toContain("postPageSize=");
    expect(url).not.toContain("memberPage=");
    expect(url).not.toContain("memberPageSize=");
    expect(url).toContain("log=collapsed");
  });

  it("returns filtered journal entries when export scope is current view", () => {
    const entries: AdminActionLogEntry[] = [
      {
        id: "posts-1",
        timestamp: 1_710_123_400_000,
        area: "posts",
        actionType: "create",
        title: "Пост добавлен",
        description: "Добавлен новый пост клуба.",
      },
      {
        id: "events-1",
        timestamp: 1_710_123_500_000,
        area: "events",
        actionType: "update",
        title: "Событие обновлено",
        description: "Обновлено описание экскурсии.",
      },
      {
        id: "events-2",
        timestamp: 1_710_123_600_000,
        area: "events",
        actionType: "delete",
        title: "Событие удалено",
        description: "Удалено отменённое событие.",
      },
    ];

    expect(getExportableActionLog(entries, "filtered", "events", "update")).toEqual([
      {
        id: "events-1",
        timestamp: 1_710_123_500_000,
        area: "events",
        actionType: "update",
        title: "Событие обновлено",
        description: "Обновлено описание экскурсии.",
      },
    ]);
  });

  it("returns the whole session journal when export scope is all", () => {
    const entries: AdminActionLogEntry[] = [
      {
        id: "posts-1",
        timestamp: 1_710_123_400_000,
        area: "posts",
        actionType: "create",
        title: "Пост добавлен",
        description: "Добавлен новый пост клуба.",
      },
      {
        id: "events-1",
        timestamp: 1_710_123_500_000,
        area: "events",
        actionType: "update",
        title: "Событие обновлено",
        description: "Обновлено описание экскурсии.",
      },
    ];

    expect(getExportableActionLog(entries, "all", "events", "update")).toEqual(entries);
  });

  it("applies quick presets for frequent admin log scenarios", () => {
    expect(applyActionLogPreset("all")).toEqual({
      area: "all",
      actionType: "all",
    });
    expect(applyActionLogPreset("content-updates")).toEqual({
      area: "posts",
      actionType: "update",
    });
    expect(applyActionLogPreset("event-changes")).toEqual({
      area: "events",
      actionType: "all",
    });
    expect(applyActionLogPreset("member-ops")).toEqual({
      area: "members",
      actionType: "all",
    });
    expect(applyActionLogPreset("risky-actions")).toEqual({
      area: "all",
      actionType: "delete",
    });
    expect(applyActionLogPreset("unknown-preset")).toEqual({
      area: "all",
      actionType: "all",
    });
  });

  it("groups adjacent journal entries by date and minute", () => {
    const firstTimestamp = Date.UTC(2026, 2, 15, 9, 5, 40);
    const secondTimestamp = Date.UTC(2026, 2, 15, 9, 5, 10);
    const thirdTimestamp = Date.UTC(2026, 2, 15, 8, 45, 0);
    const sharedDateLabel = new Date(firstTimestamp).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const firstHourLabel = new Date(firstTimestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const thirdHourLabel = new Date(thirdTimestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const entries: AdminActionLogEntry[] = [
      {
        id: "events-2",
        timestamp: firstTimestamp,
        area: "events",
        actionType: "delete",
        title: "Событие удалено",
        description: "Удалено отменённое событие.",
      },
      {
        id: "events-1",
        timestamp: secondTimestamp,
        area: "events",
        actionType: "update",
        title: "Событие обновлено",
        description: "Обновлено описание экскурсии.",
      },
      {
        id: "posts-1",
        timestamp: thirdTimestamp,
        area: "posts",
        actionType: "create",
        title: "Пост добавлен",
        description: "Добавлен новый пост клуба.",
      },
    ];

    expect(groupActionLogEntries(entries)).toEqual([
      {
        key: `${sharedDateLabel}-${firstHourLabel}`,
        dateLabel: sharedDateLabel,
        hourLabel: firstHourLabel,
        entries: [
          {
            id: "events-2",
            timestamp: firstTimestamp,
            area: "events",
            actionType: "delete",
            title: "Событие удалено",
            description: "Удалено отменённое событие.",
          },
          {
            id: "events-1",
            timestamp: secondTimestamp,
            area: "events",
            actionType: "update",
            title: "Событие обновлено",
            description: "Обновлено описание экскурсии.",
          },
        ],
      },
      {
        key: `${sharedDateLabel}-${thirdHourLabel}`,
        dateLabel: sharedDateLabel,
        hourLabel: thirdHourLabel,
        entries: [
          {
            id: "posts-1",
            timestamp: thirdTimestamp,
            area: "posts",
            actionType: "create",
            title: "Пост добавлен",
            description: "Добавлен новый пост клуба.",
          },
        ],
      },
    ]);
  });

  it("clears all action log records", () => {
    const seeded = recordAdminAction([], "posts", "Пост сохранён", "Изменения применены.", 1_710_123_400_000, "update");

    expect(seeded).toHaveLength(1);
    expect(clearActionLog()).toEqual([]);
  });
});
