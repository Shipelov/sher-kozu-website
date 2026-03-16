import {
  defaultEventFilters,
  defaultMemberFilters,
  defaultPostFilters,
  type EventFilterState,
  type EventSortField,
  type MemberFilterState,
  type MemberSortField,
  type PaginationState,
  type PostFilterState,
  type PostSortField,
  type PresetConfig,
} from "./adminClubShared";

type EntityAdminTabValue = "posts" | "events" | "members";
type AdminTabValue = EntityAdminTabValue | "bitrix" | "activity";

export function parsePresetConfig(configJson: string): PresetConfig | null {
  try {
    return JSON.parse(configJson) as PresetConfig;
  } catch {
    return null;
  }
}

export function getPresetConfigForTab(
  tab: EntityAdminTabValue,
  postFilters: PostFilterState,
  eventFilters: EventFilterState,
  memberFilters: MemberFilterState,
): PresetConfig {
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

export function buildAdminClubUrl(
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

export function applyPresetToFilters(
  presetTab: EntityAdminTabValue,
  config: PresetConfig,
): {
  activeTab: EntityAdminTabValue;
  postFilters?: PostFilterState;
  eventFilters?: EventFilterState;
  memberFilters?: MemberFilterState;
} {
  if (presetTab === "posts") {
    return {
      activeTab: "posts",
      postFilters: {
        query: config.query ?? "",
        category: config.category ?? "all",
        pinned: config.pinned ?? "all",
        sortBy: (config.sortBy === "timeLabel" || config.sortBy === "title" ? config.sortBy : "sortOrder") as PostSortField,
        sortDirection: config.sortDirection === "desc" ? "desc" : "asc",
      },
    };
  }

  if (presetTab === "events") {
    return {
      activeTab: "events",
      eventFilters: {
        query: config.query ?? "",
        status: config.status ?? "all",
        tone: config.tone ?? "all",
        sortBy: (config.sortBy === "dateLabel" || config.sortBy === "status" ? config.sortBy : "sortOrder") as EventSortField,
        sortDirection: config.sortDirection === "desc" ? "desc" : "asc",
      },
    };
  }

  return {
    activeTab: "members",
    memberFilters: {
      query: config.query ?? "",
      badge: config.badge ?? "all",
      sortBy: (config.sortBy === "name" || config.sortBy === "badge" ? config.sortBy : "sortOrder") as MemberSortField,
      sortDirection: config.sortDirection === "desc" ? "desc" : "asc",
    },
  };
}

export function readAdminClubStateFromUrl(): {
  activeTab: AdminTabValue;
  postFilters: PostFilterState;
  eventFilters: EventFilterState;
  memberFilters: MemberFilterState;
  pagination: PaginationState;
  actionLogCollapsed: boolean;
} {
  if (typeof window === "undefined") {
    return {
      activeTab: "posts",
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
  const activeTab: AdminTabValue = tabParam === "events" || tabParam === "members" || tabParam === "bitrix" || tabParam === "activity"
    ? tabParam
    : "posts";

  const positiveNumber = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    activeTab,
    postFilters: {
      query: params.get("postQuery") ?? "",
      category: params.get("postCategory") ?? "all",
      pinned: (() => {
        const value = params.get("postPinned");
        return value === "pinned" || value === "regular" ? value : "all";
      })(),
      sortBy: (() => {
        const value = params.get("postSortBy");
        return value === "timeLabel" || value === "title" ? value : "sortOrder";
      })(),
      sortDirection: params.get("postSortDirection") === "desc" ? "desc" : "asc",
    },
    eventFilters: {
      query: params.get("eventQuery") ?? "",
      status: params.get("eventStatus") ?? "all",
      tone: params.get("eventTone") ?? "all",
      sortBy: (() => {
        const value = params.get("eventSortBy");
        return value === "dateLabel" || value === "status" ? value : "sortOrder";
      })(),
      sortDirection: params.get("eventSortDirection") === "desc" ? "desc" : "asc",
    },
    memberFilters: {
      query: params.get("memberQuery") ?? "",
      badge: params.get("memberBadge") ?? "all",
      sortBy: (() => {
        const value = params.get("memberSortBy");
        return value === "name" || value === "badge" ? value : "sortOrder";
      })(),
      sortDirection: params.get("memberSortDirection") === "desc" ? "desc" : "asc",
    },
    pagination: {
      posts: {
        page: positiveNumber(params.get("postPage"), 1),
        pageSize: positiveNumber(params.get("postPageSize"), 10),
      },
      events: {
        page: positiveNumber(params.get("eventPage"), 1),
        pageSize: positiveNumber(params.get("eventPageSize"), 10),
      },
      members: {
        page: positiveNumber(params.get("memberPage"), 1),
        pageSize: positiveNumber(params.get("memberPageSize"), 10),
      },
    },
    actionLogCollapsed: params.get("log") === "collapsed",
  };
}
