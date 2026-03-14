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

type PostFilters = {
  query: string;
  category: string;
  pinned: "all" | "pinned" | "regular";
};

type EventFilters = {
  query: string;
  status: string;
  tone: string;
};

type MemberFilters = {
  query: string;
  badge: string;
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

function buildAdminClubUrl(
  activeTab: "posts" | "events" | "members",
  postFilters: PostFilters,
  eventFilters: EventFilters,
  memberFilters: MemberFilters,
) {
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
        timeLabel: "Пятница",
        pinned: true,
        sortOrder: 2,
      },
    ], {
      query: "марта",
      category: "journal",
      pinned: "pinned",
    });

    expect(filtered.map((item) => item.id)).toEqual([1]);
  });

  it("filters events by query, status and tone", () => {
    const filtered = filterEvents([
      {
        id: 1,
        title: "Весенний визит",
        description: "Семейный день на ферме",
        dateLabel: "20 апреля",
        status: "Открыта регистрация",
        tone: "warm",
        sortOrder: 0,
      },
      {
        id: 2,
        title: "Онлайн-дегустация",
        description: "Вечер с новыми сырами",
        dateLabel: "25 апреля",
        status: "Лист ожидания",
        tone: "calm",
        sortOrder: 1,
      },
    ], {
      query: "сырами",
      status: "Лист ожидания",
      tone: "calm",
    });

    expect(filtered.map((item) => item.id)).toEqual([2]);
  });

  it("filters members by query and badge", () => {
    const filtered = filterMembers([
      {
        id: 1,
        name: "Семья Петровых",
        animal: "Марта",
        sinceLabel: "С весны 2024",
        badge: "Founder",
        sortOrder: 0,
      },
      {
        id: 2,
        name: "Елена",
        animal: "Луна",
        sinceLabel: "С осени 2025",
        badge: "New",
        sortOrder: 1,
      },
    ], {
      query: "марта",
      badge: "Founder",
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

  it("reads active tab and filters from query string", () => {
    expect(readAdminClubStateFromSearch("?tab=events&eventQuery=ферма&eventStatus=Открыта+регистрация&eventTone=warm")).toEqual({
      activeTab: "events",
      postFilters: {
        query: "",
        category: "all",
        pinned: "all",
      },
      eventFilters: {
        query: "ферма",
        status: "Открыта регистрация",
        tone: "warm",
      },
      memberFilters: {
        query: "",
        badge: "all",
      },
    });
  });

  it("builds shareable admin url only from non-default state", () => {
    expect(buildAdminClubUrl(
      "members",
      { query: "", category: "all", pinned: "all" },
      { query: "", status: "all", tone: "all" },
      { query: "Марта", badge: "Founder" },
    )).toBe("/admin/club?tab=members&memberQuery=%D0%9C%D0%B0%D1%80%D1%82%D0%B0&memberBadge=Founder");
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
});
