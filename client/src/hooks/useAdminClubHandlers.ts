import {
  defaultEventForm,
  defaultMemberForm,
  defaultPostForm,
  hasFormErrors,
  validateEventForm,
  validateMemberForm,
  validatePostForm,
  type ClubAdminPreset,
  type EventFilterState,
  type EventFormField,
  type EventFormState,
  type FormErrors,
  type MemberFilterState,
  type MemberFormField,
  type MemberFormState,
  type PaginationState,
  type PendingDeleteState,
  type PostFilterState,
  type PostFormField,
  type PostFormState,
  type SelectionState,
} from "@/pages/adminClubShared";
import {
  applyPresetToFilters,
  buildAdminClubUrl,
  getPresetConfigForTab,
  parsePresetConfig,
} from "@/pages/adminClubUrlState";
import { getBulkActionToastCopy, formatUnknownDate } from "./useAdminClubDerived";
import type { AdminActionLogEntry, AdminActionType, AdminTabValue, EntityAdminTabValue } from "@/lib/adminClubActivity";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

interface HandlerDeps {
  // State setters
  setActiveTab: Dispatch<SetStateAction<AdminTabValue>>;
  setPostForm: Dispatch<SetStateAction<PostFormState>>;
  setPostErrors: Dispatch<SetStateAction<FormErrors<PostFormField>>>;
  setEventForm: Dispatch<SetStateAction<EventFormState>>;
  setEventErrors: Dispatch<SetStateAction<FormErrors<EventFormField>>>;
  setMemberForm: Dispatch<SetStateAction<MemberFormState>>;
  setMemberErrors: Dispatch<SetStateAction<FormErrors<MemberFormField>>>;
  setPostFilters: Dispatch<SetStateAction<PostFilterState>>;
  setEventFilters: Dispatch<SetStateAction<EventFilterState>>;
  setMemberFilters: Dispatch<SetStateAction<MemberFilterState>>;
  setSelectedIds: Dispatch<SetStateAction<SelectionState>>;
  setPendingDelete: Dispatch<SetStateAction<PendingDeleteState>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setActionLog: Dispatch<SetStateAction<AdminActionLogEntry[]>>;
  setActionLogAreaFilter: Dispatch<SetStateAction<"all" | AdminTabValue>>;
  setActionLogTypeFilter: Dispatch<SetStateAction<"all" | AdminActionType>>;
  setActionLogExportScope: Dispatch<SetStateAction<"filtered" | "all">>;

  // Current state
  postForm: PostFormState;
  eventForm: EventFormState;
  memberForm: MemberFormState;
  postFilters: PostFilterState;
  eventFilters: EventFilterState;
  memberFilters: MemberFilterState;
  activeTab: AdminTabValue;
  pagination: PaginationState;
  actionLogCollapsed: boolean;
  pendingDelete: PendingDeleteState;
  presetsByTab: { posts: ClubAdminPreset[]; events: ClubAdminPreset[]; members: ClubAdminPreset[] };
  presetName: Record<EntityAdminTabValue, string>;
  setPresetName: Dispatch<SetStateAction<Record<EntityAdminTabValue, string>>>;
  selectedIds: SelectionState;
  totalPages: { posts: number; events: number; members: number };

  // Mutations
  createPost: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  updatePost: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  deletePost: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  createEvent: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  updateEvent: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  deleteEvent: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  createMember: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  updateMember: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  deleteMember: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  createPreset: { isPending: boolean; mutateAsync: (input: any) => Promise<unknown> };
  processCriticalAdminNotification: (
    area: AdminTabValue,
    actionType: AdminActionType,
    title: string,
    description: string,
    affectedCount?: number,
  ) => Promise<void>;

  // Derived
  exportableActionLog: AdminActionLogEntry[];
  actionLogExportScope: "filtered" | "all";
}

export function useAdminClubHandlers(deps: HandlerDeps) {
  const {
    setActiveTab, setPostForm, setPostErrors, setEventForm, setEventErrors,
    setMemberForm, setMemberErrors, setPostFilters, setEventFilters, setMemberFilters,
    setSelectedIds, setPendingDelete, setPagination,
    setActionLog, setActionLogAreaFilter, setActionLogTypeFilter, setActionLogExportScope,
    postForm, eventForm, memberForm,
    postFilters, eventFilters, memberFilters,
    activeTab, pagination, actionLogCollapsed,
    pendingDelete, presetsByTab, presetName, setPresetName,
    selectedIds, totalPages,
    createPost, updatePost, deletePost,
    createEvent, updateEvent, deleteEvent,
    createMember, updateMember, deleteMember,
    createPreset, processCriticalAdminNotification,
    exportableActionLog, actionLogExportScope,
  } = deps;

  // ── Selection ──
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
    setSelectedIds((current) => ({ ...current, [tab]: [] }));
  };

  // ── Pagination ──
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
      [tab]: { page: 1, pageSize },
    }));
  };

  // ── Presets ──
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

    const nextState = applyPresetToFilters(preset.tab, config);
    setActiveTab(nextState.activeTab);
    if (nextState.postFilters) setPostFilters(nextState.postFilters);
    if (nextState.eventFilters) setEventFilters(nextState.eventFilters);
    if (nextState.memberFilters) setMemberFilters(nextState.memberFilters);
  };

  // ── Form submits ──
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

  // ── Delete confirm ──
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
      toast.success(toastCopy.title, { description: toastCopy.description });
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
      toast.success(toastCopy.title, { description: toastCopy.description });
      await processCriticalAdminNotification("events", "bulk", toastCopy.title, toastCopy.description, pendingDelete.ids.length);
      return;
    }

    for (const id of pendingDelete.ids) {
      await deleteMember.mutateAsync({ id });
    }
    clearSelection("members");
    setPendingDelete(null);
    const toastCopy = getBulkActionToastCopy("member", "delete", pendingDelete.ids.length);
    toast.success(toastCopy.title, { description: toastCopy.description });
    await processCriticalAdminNotification("members", "bulk", toastCopy.title, toastCopy.description, pendingDelete.ids.length);
  };

  // ── Copy current view link ──
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

  // ── Export action log to CSV ──
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
      formatUnknownDate(entry.timestamp, "sv-SE").replace(" ", "T"),
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

  // ── Action log filter presets ──
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
    if (!preset) return;

    setActionLogAreaFilter(preset.area);
    setActionLogTypeFilter(preset.actionType ?? "all");
  };

  return {
    // Selection
    toggleSelection,
    toggleSelectAllVisible,
    clearSelection,

    // Pagination
    setTabPage,
    setTabPageSize,

    // Presets
    handleSavePreset,
    applyPreset,

    // Form submits
    handlePostSubmit,
    handleEventSubmit,
    handleMemberSubmit,

    // Delete
    confirmDelete,

    // Clipboard
    copyCurrentViewLink,

    // Action log
    exportActionLogToCsv,
    actionLogFilterPresets,
    applyActionLogPreset,
  };
}

export type AdminClubHandlers = ReturnType<typeof useAdminClubHandlers>;
