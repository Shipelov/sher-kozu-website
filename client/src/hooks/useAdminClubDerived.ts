import {
  filterEvents,
  filterMembers,
  filterPosts,
  sortEvents,
  sortMembers,
  sortPosts,
  uniqueValues,
  type ClubAdminPreset,
  type EventFilterState,
  type MemberFilterState,
  type PaginationState,
  type PendingDeleteState,
  type PostFilterState,
  type SelectionState,
} from "@/pages/adminClubShared";
import type {
  AdminActionLogEntry,
  AdminActionType,
  AdminTabValue,
  CriticalNotificationHistoryEntry,
  EntityAdminTabValue,
} from "@/lib/adminClubActivity";
import { useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

// ── Utility functions (pure, no hooks) ──

export function buildBulkDeleteSummaryItems(items: Array<{ title?: string; name?: string }>) {
  return items
    .map((item) => item.title ?? item.name ?? "Без названия")
    .filter(Boolean)
    .slice(0, 5);
}

export function formatUnknownDate(value: unknown, locale: string = "ru-RU", options?: Intl.DateTimeFormatOptions) {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale, options);
}

export function getDeleteDialogCopy(pendingDelete: PendingDeleteState) {
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

export function getBulkActionToastCopy(entity: "post" | "event" | "member", action: "delete" | "pin" | "unpin", count: number) {
  if (entity === "post") {
    if (action === "pin") return { title: "Посты закреплены", description: `Закрепление применено к ${count} постам.` };
    if (action === "unpin") return { title: "Посты откреплены", description: `Обычный режим ленты восстановлен для ${count} постов.` };
    return { title: "Посты удалены", description: `Из ленты удалено ${count} постов.` };
  }
  if (entity === "event") return { title: "События удалены", description: `Из расписания удалено ${count} событий.` };
  return { title: "Участники удалены", description: `Из клуба удалено ${count} профилей участников.` };
}

export function getActionTypeBadgeConfig(actionType: AdminActionType) {
  if (actionType === "create") return { label: "Создание", className: "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-emerald-700" };
  if (actionType === "update") return { label: "Изменение", className: "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-sky-700" };
  if (actionType === "delete") return { label: "Удаление", className: "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-rose-700" };
  if (actionType === "bulk") return { label: "Массово", className: "rounded-full border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-violet-700" };
  return { label: "Пресет", className: "rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-amber-700" };
}

// ── Action log filter presets (static) ──

export const actionLogFilterPresets: Array<{
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

// ── Derived data hook ──

interface DerivedDeps {
  // Data from query
  posts: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  members: Array<Record<string, unknown>>;
  presets: ClubAdminPreset[];

  // Filters
  postFilters: PostFilterState;
  eventFilters: EventFilterState;
  memberFilters: MemberFilterState;

  // Selection
  selectedIds: SelectionState;

  // Pagination
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;

  // Delete
  pendingDelete: PendingDeleteState;
  deletePostPending: boolean;
  deleteEventPending: boolean;
  deleteMemberPending: boolean;

  // Action log
  actionLog: AdminActionLogEntry[];
  actionLogAreaFilter: "all" | AdminTabValue;
  actionLogTypeFilter: "all" | AdminActionType;
  actionLogExportScope: "filtered" | "all";

  // Critical notifications
  criticalNotificationHistory: CriticalNotificationHistoryEntry[];

  // Bitrix
  bitrixLeads: Array<Record<string, unknown>>;
  bitrixAudits: Array<Record<string, unknown>>;
  bitrixErrorFilter: "all" | "with_error" | "without_error";
  selectedBitrixLeadId: number | null;
}

export function useAdminClubDerived(deps: DerivedDeps) {
  const {
    posts, events, members, presets,
    postFilters, eventFilters, memberFilters,
    selectedIds, pagination, setPagination,
    pendingDelete, deletePostPending, deleteEventPending, deleteMemberPending,
    actionLog, actionLogAreaFilter, actionLogTypeFilter, actionLogExportScope,
    criticalNotificationHistory,
    bitrixLeads, bitrixAudits, bitrixErrorFilter, selectedBitrixLeadId,
  } = deps;

  // ── Counts ──
  const counts = useMemo(() => ({
    posts: (posts as unknown[]).length,
    events: (events as unknown[]).length,
    members: (members as unknown[]).length,
  }), [(posts as unknown[]).length, (events as unknown[]).length, (members as unknown[]).length]);

  // ── Filtered & sorted ──
  const filteredPosts = useMemo(() => sortPosts(filterPosts(posts as any, postFilters), postFilters), [posts, postFilters]);
  const filteredEvents = useMemo(() => sortEvents(filterEvents(events as any, eventFilters), eventFilters), [events, eventFilters]);
  const filteredMembers = useMemo(() => sortMembers(filterMembers(members as any, memberFilters), memberFilters), [members, memberFilters]);

  // ── Paginated ──
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

  // ── Total pages ──
  const totalPages = useMemo(() => ({
    posts: Math.max(1, Math.ceil(filteredPosts.length / pagination.posts.pageSize)),
    events: Math.max(1, Math.ceil(filteredEvents.length / pagination.events.pageSize)),
    members: Math.max(1, Math.ceil(filteredMembers.length / pagination.members.pageSize)),
  }), [filteredPosts.length, filteredEvents.length, filteredMembers.length, pagination.posts.pageSize, pagination.events.pageSize, pagination.members.pageSize]);

  // ── Auto-clamp pagination ──
  useEffect(() => {
    setPagination((current) => {
      const nextPage = Math.min(current.posts.page, Math.max(1, Math.ceil(filteredPosts.length / current.posts.pageSize)));
      return nextPage === current.posts.page ? current : { ...current, posts: { ...current.posts, page: nextPage } };
    });
  }, [filteredPosts.length, setPagination]);

  useEffect(() => {
    setPagination((current) => {
      const nextPage = Math.min(current.events.page, Math.max(1, Math.ceil(filteredEvents.length / current.events.pageSize)));
      return nextPage === current.events.page ? current : { ...current, events: { ...current.events, page: nextPage } };
    });
  }, [filteredEvents.length, setPagination]);

  useEffect(() => {
    setPagination((current) => {
      const nextPage = Math.min(current.members.page, Math.max(1, Math.ceil(filteredMembers.length / current.members.pageSize)));
      return nextPage === current.members.page ? current : { ...current, members: { ...current.members, page: nextPage } };
    });
  }, [filteredMembers.length, setPagination]);

  // ── Unique values for filter chips ──
  const postCategories = useMemo(() => uniqueValues(posts as any, "category"), [posts]);
  const eventStatuses = useMemo(() => uniqueValues(events as any, "status"), [events]);
  const eventTones = useMemo(() => uniqueValues(events as any, "tone"), [events]);
  const memberBadges = useMemo(() => uniqueValues(members as any, "badge"), [members]);

  // ── Selection derived ──
  const selectedPosts = useMemo(() => filteredPosts.filter((post: any) => selectedIds.posts.includes(post.id)), [filteredPosts, selectedIds.posts]);
  const selectedEvents = useMemo(() => filteredEvents.filter((event: any) => selectedIds.events.includes(event.id)), [filteredEvents, selectedIds.events]);
  const selectedMembers = useMemo(() => filteredMembers.filter((member: any) => selectedIds.members.includes(member.id)), [filteredMembers, selectedIds.members]);

  const allVisiblePostsSelected = filteredPosts.length > 0 && filteredPosts.every((post: any) => selectedIds.posts.includes(post.id));
  const allVisibleEventsSelected = filteredEvents.length > 0 && filteredEvents.every((event: any) => selectedIds.events.includes(event.id));
  const allVisibleMembersSelected = filteredMembers.length > 0 && filteredMembers.every((member: any) => selectedIds.members.includes(member.id));

  // ── Presets by tab ──
  const presetsByTab = useMemo(() => ({
    posts: presets.filter((preset) => preset.tab === "posts"),
    events: presets.filter((preset) => preset.tab === "events"),
    members: presets.filter((preset) => preset.tab === "members"),
  }), [presets]);

  // ── Delete state ──
  const isDeleting = deletePostPending || deleteEventPending || deleteMemberPending;
  const deleteDialogCopy = getDeleteDialogCopy(pendingDelete);
  const deleteSummaryOverflow = pendingDelete && "summaryItems" in pendingDelete
    ? Math.max(0, pendingDelete.totalCount - pendingDelete.summaryItems.length)
    : 0;

  // ── Action log derived ──
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
  const exportableActionLogIds = new Set(exportableActionLog.map((entry) => entry.id));

  const groupedActionLog = filteredActionLog.reduce<Array<{ key: string; dateLabel: string; hourLabel: string; entries: AdminActionLogEntry[] }>>((groups, entry) => {
    const dateLabel = formatUnknownDate(entry.timestamp, "ru-RU", { day: "2-digit", month: "long", year: "numeric" });
    const hourLabel = formatUnknownDate(entry.timestamp, "ru-RU", { hour: "2-digit", minute: "2-digit" });
    const key = `${dateLabel}-${hourLabel}`;
    const currentGroup = groups.at(-1);
    if (currentGroup?.key === key) {
      currentGroup.entries.push(entry);
      return groups;
    }
    groups.push({ key, dateLabel, hourLabel, entries: [entry] });
    return groups;
  }, []);

  const actionLogTypeStats = filteredActionLog.reduce<Record<AdminActionType, number>>((acc, entry) => {
    acc[entry.actionType] += 1;
    return acc;
  }, { create: 0, update: 0, delete: 0, bulk: 0, preset: 0, sync: 0, refresh: 0 });

  const actionLogTypeStatsItems = [
    { key: "create", label: "Создание", value: actionLogTypeStats.create },
    { key: "update", label: "Изменение", value: actionLogTypeStats.update },
    { key: "delete", label: "Удаление", value: actionLogTypeStats.delete },
    { key: "bulk", label: "Массовые", value: actionLogTypeStats.bulk },
    { key: "preset", label: "Пресеты", value: actionLogTypeStats.preset },
  ];

  // ── Critical notification derived ──
  const deliveredCriticalCount = criticalNotificationHistory.filter((entry) => entry.delivered).length;
  const failedCriticalCount = criticalNotificationHistory.length - deliveredCriticalCount;

  // ── Bitrix derived ──
  const visibleBitrixLeads = useMemo(() => {
    return (bitrixLeads as any[]).filter((lead: any) => {
      const hasError = Boolean(lead.lastSyncError);
      return bitrixErrorFilter === "all" ? true : bitrixErrorFilter === "with_error" ? hasError : !hasError;
    });
  }, [bitrixErrorFilter, bitrixLeads]);

  const selectedBitrixLead = useMemo(() => {
    if (!visibleBitrixLeads.length) return null;
    return visibleBitrixLeads.find((lead: any) => lead.id === selectedBitrixLeadId) ?? visibleBitrixLeads[0] ?? null;
  }, [visibleBitrixLeads, selectedBitrixLeadId]);

  const selectedBitrixLeadAudits = useMemo(() => {
    if (!selectedBitrixLead) return [];
    return (bitrixAudits as any[]).filter((audit: any) => Number(audit.entityId) === Number(selectedBitrixLead.id));
  }, [bitrixAudits, selectedBitrixLead]);

  return {
    counts,
    filteredPosts, filteredEvents, filteredMembers,
    paginatedPosts, paginatedEvents, paginatedMembers,
    totalPages,
    postCategories, eventStatuses, eventTones, memberBadges,
    selectedPosts, selectedEvents, selectedMembers,
    allVisiblePostsSelected, allVisibleEventsSelected, allVisibleMembersSelected,
    presetsByTab,
    isDeleting, deleteDialogCopy, deleteSummaryOverflow,
    filteredActionLog, actionLogAreaStatsItems, exportableActionLog, exportableActionLogIds,
    groupedActionLog, actionLogTypeStatsItems,
    deliveredCriticalCount, failedCriticalCount,
    visibleBitrixLeads, selectedBitrixLead, selectedBitrixLeadAudits,
  };
}

export type AdminClubDerived = ReturnType<typeof useAdminClubDerived>;
