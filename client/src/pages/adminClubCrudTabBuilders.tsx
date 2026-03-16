import { ArrowDown, CalendarRange, CheckSquare, Crown, Pin, Square, Trash2 } from "lucide-react";
import {
  defaultEventFilters,
  defaultEventForm,
  defaultMemberFilters,
  defaultMemberForm,
  defaultPostFilters,
  defaultPostForm,
  type ClubAdminPreset,
  type EventFilterState,
  type EventFormField,
  type EventFormState,
  type EventSortField,
  type FormErrors,
  type MemberFilterState,
  type MemberFormField,
  type MemberFormState,
  type MemberSortField,
  type PostFilterState,
  type PostFormField,
  type PostFormState,
  type PostSortField,
  type SortDirection,
  type PendingDeleteState,
} from "./adminClubShared";
import type {
  AdminClubEventsTabContentProps,
  AdminClubMembersTabContentProps,
  AdminClubPostsTabContentProps,
} from "./adminClubCrudTabs";
import type { FilterChip } from "./adminClubUi";
import type { AdminActionLogEntry, AdminActionType, AdminTabValue } from "@/lib/adminClubActivity";
import type { ReactNode } from "react";

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
};

type SharedPresetNameState = Record<"posts" | "events" | "members", string>;
type SharedSelectedIdsState = { posts: number[]; events: number[]; members: number[] };

type InlineActionToastInput = {
  title?: string;
  name?: string;
  pinned?: boolean;
  status?: string;
  sortOrder: number;
  badge?: string;
};

type InlineActionToastResult = {
  sortOrder: { title: string; description: string };
  status: { title: string; description: string };
  pin?: { title: string; description: string };
};

type InlineActionToastFactory = (
  entity: "post" | "event" | "member",
  input: InlineActionToastInput,
) => InlineActionToastResult;

type BulkActionToastFactory = (
  entity: "post" | "event" | "member",
  action: "delete" | "pin" | "unpin",
  count: number,
) => { title: string; description: string };

type PostItem = {
  id: number;
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

type EventItem = {
  id: number;
  title: string;
  dateLabel: string;
  description: string;
  status: string;
  tone: string;
  sortOrder: number;
};

type MemberItem = {
  id: number;
  name: string;
  animal: string;
  sinceLabel: string;
  badge: string;
  sortOrder: number;
};

type MutationLike<TInput> = {
  isPending: boolean;
  mutateAsync: (input: TInput) => Promise<unknown>;
};

type ToastLike = {
  success: (title: string, options?: { description?: string }) => void;
};

type SetStateAction<T> = T | ((current: T) => T);
type StateSetter<T> = (value: SetStateAction<T>) => void;

type PostsBuilderProps = {
  postForm: PostFormState;
  postErrors: FormErrors<PostFormField>;
  setPostForm: StateSetter<PostFormState>;
  setPostErrors: StateSetter<FormErrors<PostFormField>>;
  handlePostSubmit: () => void;
  createPostPending: boolean;
  updatePostPending: boolean;
  postFilters: PostFilterState;
  setPostFilters: StateSetter<PostFilterState>;
  selectedPosts: PostItem[];
  allVisiblePostsSelected: boolean;
  filteredPosts: PostItem[];
  toggleSelectAllVisible: (entity: "posts" | "events" | "members", ids: number[]) => void;
  clearSelection: (entity: "posts" | "events" | "members") => void;
  selectedIds: Pick<SharedSelectedIdsState, "posts">;
  toggleSelection: (entity: "posts" | "events" | "members", id: number) => void;
  presetName: SharedPresetNameState;
  setPresetName: StateSetter<SharedPresetNameState>;
  handleSavePreset: (tab: "posts" | "events" | "members") => Promise<void>;
  createPresetPending: boolean;
  presetsByTab: { posts: ClubAdminPreset[] };
  applyPreset: (preset: ClubAdminPreset) => void;
  deletePreset: MutationLike<{ id: number }>;
  postCategories: string[];
  paginatedPosts: PostItem[];
  paginationMeta: PaginationMeta;
  setTabPage: (tab: "posts" | "events" | "members", page: number) => void;
  setTabPageSize: (tab: "posts" | "events" | "members", pageSize: number) => void;
  isDeleting: boolean;
  setPendingDelete: StateSetter<PendingDeleteState>;
  buildBulkDeleteSummaryItems: (items: Array<{ title?: string; name?: string }>) => string[];
  getBulkActionToastCopy: BulkActionToastFactory;
  getInlineActionToastCopy: InlineActionToastFactory;
  updatePost: MutationLike<PostItem>;
  toast: ToastLike;
  pendingDelete: PendingDeleteState;
};

type EventsBuilderProps = {
  eventForm: EventFormState;
  eventErrors: FormErrors<EventFormField>;
  setEventForm: StateSetter<EventFormState>;
  setEventErrors: StateSetter<FormErrors<EventFormField>>;
  handleEventSubmit: () => void;
  createEventPending: boolean;
  updateEventPending: boolean;
  eventFilters: EventFilterState;
  setEventFilters: StateSetter<EventFilterState>;
  selectedEvents: EventItem[];
  allVisibleEventsSelected: boolean;
  filteredEvents: EventItem[];
  toggleSelectAllVisible: (entity: "posts" | "events" | "members", ids: number[]) => void;
  clearSelection: (entity: "posts" | "events" | "members") => void;
  selectedIds: Pick<SharedSelectedIdsState, "events">;
  toggleSelection: (entity: "posts" | "events" | "members", id: number) => void;
  presetName: SharedPresetNameState;
  setPresetName: StateSetter<SharedPresetNameState>;
  handleSavePreset: (tab: "posts" | "events" | "members") => Promise<void>;
  createPresetPending: boolean;
  presetsByTab: { events: ClubAdminPreset[] };
  applyPreset: (preset: ClubAdminPreset) => void;
  deletePreset: MutationLike<{ id: number }>;
  eventStatuses: string[];
  eventTones: string[];
  paginatedEvents: EventItem[];
  paginationMeta: PaginationMeta;
  setTabPage: (tab: "posts" | "events" | "members", page: number) => void;
  setTabPageSize: (tab: "posts" | "events" | "members", pageSize: number) => void;
  isDeleting: boolean;
  setPendingDelete: StateSetter<PendingDeleteState>;
  buildBulkDeleteSummaryItems: (items: Array<{ title?: string; name?: string }>) => string[];
  getInlineActionToastCopy: InlineActionToastFactory;
  updateEvent: MutationLike<EventItem>;
  toast: ToastLike;
  pendingDelete: PendingDeleteState;
  setActionLog: StateSetter<AdminActionLogEntry[]>;
  recordAdminAction: (
    current: AdminActionLogEntry[],
    area: AdminTabValue,
    type: AdminActionType,
    title: string,
    description: string,
  ) => AdminActionLogEntry[];
};

type MembersBuilderProps = {
  memberForm: MemberFormState;
  memberErrors: FormErrors<MemberFormField>;
  setMemberForm: StateSetter<MemberFormState>;
  setMemberErrors: StateSetter<FormErrors<MemberFormField>>;
  handleMemberSubmit: () => void;
  createMemberPending: boolean;
  updateMemberPending: boolean;
  memberFilters: MemberFilterState;
  setMemberFilters: StateSetter<MemberFilterState>;
  selectedMembers: MemberItem[];
  allVisibleMembersSelected: boolean;
  filteredMembers: MemberItem[];
  toggleSelectAllVisible: (entity: "posts" | "events" | "members", ids: number[]) => void;
  clearSelection: (entity: "posts" | "events" | "members") => void;
  selectedIds: Pick<SharedSelectedIdsState, "members">;
  toggleSelection: (entity: "posts" | "events" | "members", id: number) => void;
  presetName: SharedPresetNameState;
  setPresetName: StateSetter<SharedPresetNameState>;
  handleSavePreset: (tab: "posts" | "events" | "members") => Promise<void>;
  createPresetPending: boolean;
  presetsByTab: { members: ClubAdminPreset[] };
  applyPreset: (preset: ClubAdminPreset) => void;
  deletePreset: MutationLike<{ id: number }>;
  memberBadges: string[];
  paginatedMembers: MemberItem[];
  paginationMeta: PaginationMeta;
  setTabPage: (tab: "posts" | "events" | "members", page: number) => void;
  setTabPageSize: (tab: "posts" | "events" | "members", pageSize: number) => void;
  isDeleting: boolean;
  setPendingDelete: StateSetter<PendingDeleteState>;
  buildBulkDeleteSummaryItems: (items: Array<{ title?: string; name?: string }>) => string[];
  getInlineActionToastCopy: InlineActionToastFactory;
  updateMember: MutationLike<MemberItem>;
  toast: ToastLike;
  pendingDelete: PendingDeleteState;
  setActionLog: StateSetter<AdminActionLogEntry[]>;
  recordAdminAction: (
    current: AdminActionLogEntry[],
    area: AdminTabValue,
    type: AdminActionType,
    title: string,
    description: string,
  ) => AdminActionLogEntry[];
};

export function buildAdminClubPostsTabProps(props: PostsBuilderProps): AdminClubPostsTabContentProps {
  return {
    postForm: props.postForm,
    postErrors: props.postErrors,
    onPostFormChange: props.setPostForm,
    onPostFieldErrorClear: (field) => props.setPostErrors((current) => ({ ...current, [field]: undefined })),
    onSubmit: props.handlePostSubmit,
    onResetForm: () => {
      props.setPostForm(defaultPostForm);
      props.setPostErrors({});
    },
    submitDisabled: props.createPostPending || props.updatePostPending,
    sortIndicator: {
      fieldLabel: props.postFilters.sortBy === "timeLabel" ? "времени" : props.postFilters.sortBy === "title" ? "названию" : "порядку",
      directionLabel: props.postFilters.sortDirection === "asc" ? "возрастанию" : "убыванию",
    },
    searchValue: props.postFilters.query,
    resultCount: props.filteredPosts.length,
    activeFilters: [
      props.postFilters.category !== "all" ? { label: `Категория: ${props.postFilters.category}`, onRemove: () => props.setPostFilters((current) => ({ ...current, category: "all" })) } : null,
      props.postFilters.pinned !== "all" ? { label: props.postFilters.pinned === "pinned" ? "Только закреплённые" : "Без закреплённых", onRemove: () => props.setPostFilters((current) => ({ ...current, pinned: "all" })) } : null,
      props.postFilters.sortBy !== "sortOrder" ? { label: `Сортировка: ${props.postFilters.sortBy}`, onRemove: () => props.setPostFilters((current) => ({ ...current, sortBy: "sortOrder" })) } : null,
      props.postFilters.sortDirection !== "asc" ? { label: "Порядок: по убыванию", onRemove: () => props.setPostFilters((current) => ({ ...current, sortDirection: "asc" })) } : null,
    ].filter(Boolean) as FilterChip[],
    selectedCount: props.selectedPosts.length,
    hasActiveFilters: props.postFilters.query !== "" || props.postFilters.category !== "all" || props.postFilters.pinned !== "all" || props.postFilters.sortBy !== "sortOrder" || props.postFilters.sortDirection !== "asc",
    onSearchChange: (value) => props.setPostFilters((current) => ({ ...current, query: value })),
    onResetFilters: () => props.setPostFilters(defaultPostFilters()),
    bulkActions: [
      {
        label: props.allVisiblePostsSelected ? "Снять выбор со всех" : "Выбрать все видимые",
        icon: props.allVisiblePostsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
        variant: "outline",
        disabled: props.filteredPosts.length === 0,
        onClick: () => props.toggleSelectAllVisible("posts", props.filteredPosts.map((post) => post.id)),
      },
      {
        label: "Удалить выбранные",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "outline",
        destructive: true,
        disabled: props.selectedPosts.length === 0 || props.isDeleting,
        onClick: () => props.setPendingDelete({
          entity: "bulk-post",
          ids: props.selectedPosts.map((post) => post.id),
          title: `Выбрано постов: ${props.selectedPosts.length}`,
          description: `${props.selectedPosts.length} постов`,
          summaryItems: props.buildBulkDeleteSummaryItems(props.selectedPosts),
          totalCount: props.selectedPosts.length,
        }),
      },
    ],
    onClearSelection: () => props.clearSelection("posts"),
    presetName: props.presetName.posts,
    onPresetNameChange: (value) => props.setPresetName((current) => ({ ...current, posts: value })),
    onSavePreset: () => {
      void props.handleSavePreset("posts");
    },
    savePresetDisabled: props.createPresetPending,
    presets: props.presetsByTab.posts,
    onApplyPreset: (preset) => props.applyPreset(preset),
    onDeletePreset: (presetId) => {
      void props.deletePreset.mutateAsync({ id: presetId });
    },
    deletePresetPending: props.deletePreset.isPending,
    categoryValue: props.postFilters.category,
    categoryOptions: [{ label: "Все категории", value: "all" }, ...props.postCategories.map((value) => ({ label: value, value }))],
    onCategoryChange: (value) => props.setPostFilters((current) => ({ ...current, category: value })),
    pinnedValue: props.postFilters.pinned,
    onPinnedChange: (value) => props.setPostFilters((current) => ({ ...current, pinned: value })),
    sortByValue: props.postFilters.sortBy,
    onSortByChange: (value) => props.setPostFilters((current) => ({ ...current, sortBy: value })),
    sortDirectionValue: props.postFilters.sortDirection,
    onSortDirectionChange: (value) => props.setPostFilters((current) => ({ ...current, sortDirection: value })),
    items: props.paginatedPosts.map((post) => ({
      id: post.id,
      selected: props.selectedIds.posts.includes(post.id),
      title: post.title,
      subtitle: `${post.author} · ${post.category}`,
      meta: `${post.timeLabel} · ${post.likes} лайков · ${post.comments} комментариев`,
      badge: post.pinned ? "Закреплён" : undefined,
      onToggleSelected: () => props.toggleSelection("posts", post.id),
      inlineActions: [
        {
          label: post.pinned ? "Открепить" : "Закрепить",
          value: post.pinned ? "вкл" : "выкл",
          icon: <Pin className="h-3.5 w-3.5" />,
          disabled: props.updatePost.isPending,
          onClick: async () => {
            const nextPinned = !post.pinned;
            await props.updatePost.mutateAsync({ ...post, pinned: nextPinned });
            const toastCopy = props.getInlineActionToastCopy("post", { title: post.title, pinned: nextPinned, sortOrder: post.sortOrder });
            if (toastCopy.pin) {
              props.toast.success(toastCopy.pin.title, { description: toastCopy.pin.description });
            }
          },
        },
        {
          label: "Порядок",
          value: post.sortOrder,
          icon: <ArrowDown className="h-3.5 w-3.5" />,
          disabled: props.updatePost.isPending,
          onClick: async () => {
            const nextSortOrder = post.sortOrder + 1;
            await props.updatePost.mutateAsync({ ...post, sortOrder: nextSortOrder });
            const toastCopy = props.getInlineActionToastCopy("post", { title: post.title, pinned: post.pinned, sortOrder: nextSortOrder });
            props.toast.success(toastCopy.sortOrder.title, { description: toastCopy.sortOrder.description });
          },
        },
      ],
      onEdit: () => props.setPostForm({
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
        sortOrder: post.sortOrder,
      }),
      onDelete: () => props.setPendingDelete({ entity: "post", id: post.id, title: post.title, description: `пост «${post.title}»` }),
      deleting: props.isDeleting && props.pendingDelete?.entity === "post" && props.pendingDelete.id === post.id,
    })),
    pagination: props.paginationMeta,
    onPageChange: (page) => props.setTabPage("posts", page),
    onPageSizeChange: (pageSize) => props.setTabPageSize("posts", pageSize),
  };
}

export function buildAdminClubEventsTabProps(props: EventsBuilderProps): AdminClubEventsTabContentProps {
  return {
    eventForm: props.eventForm,
    eventErrors: props.eventErrors,
    onEventFormChange: props.setEventForm,
    onEventFieldErrorClear: (field) => props.setEventErrors((current) => ({ ...current, [field]: undefined })),
    onSubmit: props.handleEventSubmit,
    onResetForm: () => {
      props.setEventForm(defaultEventForm);
      props.setEventErrors({});
    },
    submitDisabled: props.createEventPending || props.updateEventPending,
    sortIndicator: {
      fieldLabel: props.eventFilters.sortBy === "dateLabel" ? "дате" : "порядку",
      directionLabel: props.eventFilters.sortDirection === "asc" ? "возрастанию" : "убыванию",
    },
    searchValue: props.eventFilters.query,
    resultCount: props.filteredEvents.length,
    activeFilters: [
      props.eventFilters.status !== "all" ? { label: `Статус: ${props.eventFilters.status}`, onRemove: () => props.setEventFilters((current) => ({ ...current, status: "all" })) } : null,
      props.eventFilters.tone !== "all" ? { label: `Тональность: ${props.eventFilters.tone}`, onRemove: () => props.setEventFilters((current) => ({ ...current, tone: "all" })) } : null,
      props.eventFilters.sortBy !== "sortOrder" ? { label: `Сортировка: ${props.eventFilters.sortBy}`, onRemove: () => props.setEventFilters((current) => ({ ...current, sortBy: "sortOrder" })) } : null,
      props.eventFilters.sortDirection !== "asc" ? { label: "Порядок: по убыванию", onRemove: () => props.setEventFilters((current) => ({ ...current, sortDirection: "asc" })) } : null,
    ].filter(Boolean) as FilterChip[],
    selectedCount: props.selectedEvents.length,
    hasActiveFilters: props.eventFilters.query !== "" || props.eventFilters.status !== "all" || props.eventFilters.tone !== "all" || props.eventFilters.sortBy !== "sortOrder" || props.eventFilters.sortDirection !== "asc",
    onSearchChange: (value) => props.setEventFilters((current) => ({ ...current, query: value })),
    onResetFilters: () => props.setEventFilters(defaultEventFilters()),
    bulkActions: [
      {
        label: props.allVisibleEventsSelected ? "Снять выбор со всех" : "Выбрать все видимые",
        icon: props.allVisibleEventsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
        variant: "outline",
        disabled: props.filteredEvents.length === 0,
        onClick: () => props.toggleSelectAllVisible("events", props.filteredEvents.map((event) => event.id)),
      },
      {
        label: "Удалить выбранные",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "outline",
        destructive: true,
        disabled: props.selectedEvents.length === 0 || props.isDeleting,
        onClick: () => props.setPendingDelete({
          entity: "bulk-event",
          ids: props.selectedEvents.map((event) => event.id),
          title: `Выбрано событий: ${props.selectedEvents.length}`,
          description: `${props.selectedEvents.length} событий`,
          summaryItems: props.buildBulkDeleteSummaryItems(props.selectedEvents),
          totalCount: props.selectedEvents.length,
        }),
      },
    ],
    onClearSelection: () => props.clearSelection("events"),
    presetName: props.presetName.events,
    onPresetNameChange: (value) => props.setPresetName((current) => ({ ...current, events: value })),
    onSavePreset: () => {
      void props.handleSavePreset("events");
    },
    savePresetDisabled: props.createPresetPending,
    presets: props.presetsByTab.events,
    onApplyPreset: (preset) => props.applyPreset(preset),
    onDeletePreset: (presetId) => {
      void props.deletePreset.mutateAsync({ id: presetId });
    },
    deletePresetPending: props.deletePreset.isPending,
    statusValue: props.eventFilters.status,
    statusOptions: [{ label: "Все статусы", value: "all" }, ...props.eventStatuses.map((value) => ({ label: value, value }))],
    onStatusChange: (value) => props.setEventFilters((current) => ({ ...current, status: value })),
    toneValue: props.eventFilters.tone,
    toneOptions: [{ label: "Все тональности", value: "all" }, ...props.eventTones.map((value) => ({ label: value, value }))],
    onToneChange: (value) => props.setEventFilters((current) => ({ ...current, tone: value })),
    sortByValue: props.eventFilters.sortBy,
    onSortByChange: (value) => props.setEventFilters((current) => ({ ...current, sortBy: value })),
    sortDirectionValue: props.eventFilters.sortDirection,
    onSortDirectionChange: (value) => props.setEventFilters((current) => ({ ...current, sortDirection: value })),
    items: props.paginatedEvents.map((event) => ({
      id: event.id,
      selected: props.selectedIds.events.includes(event.id),
      title: event.title,
      subtitle: event.description,
      meta: `${event.dateLabel} · ${event.status} · ${event.tone} · Порядок: ${event.sortOrder}`,
      onToggleSelected: () => props.toggleSelection("events", event.id),
      inlineActions: [
        {
          label: "Статус",
          value: event.status,
          icon: <CalendarRange className="h-3.5 w-3.5" />,
          disabled: props.updateEvent.isPending,
          onClick: async () => {
            const nextStatus = event.status === "Анонс" ? "Набор открыт" : "Анонс";
            await props.updateEvent.mutateAsync({ ...event, status: nextStatus });
            const toastCopy = props.getInlineActionToastCopy("event", { title: event.title, status: nextStatus, sortOrder: event.sortOrder });
            props.toast.success(toastCopy.status.title, { description: toastCopy.status.description });
            props.setActionLog((current) => props.recordAdminAction(current, "events", "update", toastCopy.status.title, toastCopy.status.description));
          },
        },
        {
          label: "Порядок",
          value: event.sortOrder,
          icon: <ArrowDown className="h-3.5 w-3.5" />,
          disabled: props.updateEvent.isPending,
          onClick: async () => {
            const nextSortOrder = event.sortOrder + 1;
            await props.updateEvent.mutateAsync({ ...event, sortOrder: nextSortOrder });
            const toastCopy = props.getInlineActionToastCopy("event", { title: event.title, status: event.status, sortOrder: nextSortOrder });
            props.toast.success(toastCopy.sortOrder.title, { description: toastCopy.sortOrder.description });
            props.setActionLog((current) => props.recordAdminAction(current, "events", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description));
          },
        },
      ],
      onEdit: () => props.setEventForm({
        id: event.id,
        title: event.title,
        dateLabel: event.dateLabel,
        description: event.description,
        status: event.status,
        tone: event.tone,
        sortOrder: event.sortOrder,
      }),
      onDelete: () => props.setPendingDelete({ entity: "event", id: event.id, title: event.title, description: `событие «${event.title}»` }),
      deleting: props.isDeleting && props.pendingDelete?.entity === "event" && props.pendingDelete.id === event.id,
    })),
    pagination: props.paginationMeta,
    onPageChange: (page) => props.setTabPage("events", page),
    onPageSizeChange: (pageSize) => props.setTabPageSize("events", pageSize),
  };
}

export function buildAdminClubMembersTabProps(props: MembersBuilderProps): AdminClubMembersTabContentProps {
  return {
    memberForm: props.memberForm,
    memberErrors: props.memberErrors,
    onMemberFormChange: props.setMemberForm,
    onMemberFieldErrorClear: (field) => props.setMemberErrors((current) => ({ ...current, [field]: undefined })),
    onSubmit: props.handleMemberSubmit,
    onResetForm: () => {
      props.setMemberForm(defaultMemberForm);
      props.setMemberErrors({});
    },
    submitDisabled: props.createMemberPending || props.updateMemberPending,
    sortIndicator: {
      fieldLabel: props.memberFilters.sortBy === "name" ? "имени" : "порядку",
      directionLabel: props.memberFilters.sortDirection === "asc" ? "возрастанию" : "убыванию",
    },
    searchValue: props.memberFilters.query,
    resultCount: props.filteredMembers.length,
    activeFilters: [
      props.memberFilters.badge !== "all" ? { label: `Бейдж: ${props.memberFilters.badge}`, onRemove: () => props.setMemberFilters((current) => ({ ...current, badge: "all" })) } : null,
      props.memberFilters.sortBy !== "sortOrder" ? { label: `Сортировка: ${props.memberFilters.sortBy}`, onRemove: () => props.setMemberFilters((current) => ({ ...current, sortBy: "sortOrder" })) } : null,
      props.memberFilters.sortDirection !== "asc" ? { label: "Порядок: по убыванию", onRemove: () => props.setMemberFilters((current) => ({ ...current, sortDirection: "asc" })) } : null,
    ].filter(Boolean) as FilterChip[],
    selectedCount: props.selectedMembers.length,
    hasActiveFilters: props.memberFilters.query !== "" || props.memberFilters.badge !== "all" || props.memberFilters.sortBy !== "sortOrder" || props.memberFilters.sortDirection !== "asc",
    onSearchChange: (value) => props.setMemberFilters((current) => ({ ...current, query: value })),
    onResetFilters: () => props.setMemberFilters(defaultMemberFilters()),
    bulkActions: [
      {
        label: props.allVisibleMembersSelected ? "Снять выбор со всех" : "Выбрать все видимые",
        icon: props.allVisibleMembersSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
        variant: "outline",
        disabled: props.filteredMembers.length === 0,
        onClick: () => props.toggleSelectAllVisible("members", props.filteredMembers.map((member) => member.id)),
      },
      {
        label: "Удалить выбранных",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "outline",
        destructive: true,
        disabled: props.selectedMembers.length === 0 || props.isDeleting,
        onClick: () => props.setPendingDelete({
          entity: "bulk-member",
          ids: props.selectedMembers.map((member) => member.id),
          title: `Выбрано участников: ${props.selectedMembers.length}`,
          description: `${props.selectedMembers.length} участников`,
          summaryItems: props.buildBulkDeleteSummaryItems(props.selectedMembers),
          totalCount: props.selectedMembers.length,
        }),
      },
    ],
    onClearSelection: () => props.clearSelection("members"),
    presetName: props.presetName.members,
    onPresetNameChange: (value) => props.setPresetName((current) => ({ ...current, members: value })),
    onSavePreset: () => {
      void props.handleSavePreset("members");
    },
    savePresetDisabled: props.createPresetPending,
    presets: props.presetsByTab.members,
    onApplyPreset: (preset) => props.applyPreset(preset),
    onDeletePreset: (presetId) => {
      void props.deletePreset.mutateAsync({ id: presetId });
    },
    deletePresetPending: props.deletePreset.isPending,
    badgeValue: props.memberFilters.badge,
    badgeOptions: [{ label: "Все бейджи", value: "all" }, ...props.memberBadges.map((value) => ({ label: value, value }))],
    onBadgeChange: (value) => props.setMemberFilters((current) => ({ ...current, badge: value })),
    sortByValue: props.memberFilters.sortBy,
    onSortByChange: (value) => props.setMemberFilters((current) => ({ ...current, sortBy: value })),
    sortDirectionValue: props.memberFilters.sortDirection,
    onSortDirectionChange: (value) => props.setMemberFilters((current) => ({ ...current, sortDirection: value })),
    items: props.paginatedMembers.map((member) => ({
      id: member.id,
      selected: props.selectedIds.members.includes(member.id),
      title: member.name,
      subtitle: member.animal,
      meta: `${member.sinceLabel} · ${member.badge} · Порядок: ${member.sortOrder}`,
      onToggleSelected: () => props.toggleSelection("members", member.id),
      inlineActions: [
        {
          label: "Порядок",
          value: member.sortOrder,
          icon: <ArrowDown className="h-3.5 w-3.5" />,
          disabled: props.updateMember.isPending,
          onClick: async () => {
            const nextSortOrder = member.sortOrder + 1;
            await props.updateMember.mutateAsync({ ...member, sortOrder: nextSortOrder });
            const toastCopy = props.getInlineActionToastCopy("member", { name: member.name, sortOrder: nextSortOrder, badge: member.badge });
            props.toast.success(toastCopy.sortOrder.title, { description: toastCopy.sortOrder.description });
            props.setActionLog((current) => props.recordAdminAction(current, "members", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description));
          },
        },
        {
          label: "Бейдж",
          value: member.badge || "без бейджа",
          icon: <Crown className="h-3.5 w-3.5" />,
          disabled: props.updateMember.isPending,
          onClick: async () => {
            const nextBadge = member.badge === "Амбассадор" ? "Гость фермы" : "Амбассадор";
            await props.updateMember.mutateAsync({ ...member, badge: nextBadge });
            const toastCopy = props.getInlineActionToastCopy("member", { name: member.name, sortOrder: member.sortOrder, badge: nextBadge });
            props.toast.success(toastCopy.status.title, { description: toastCopy.status.description });
            props.setActionLog((current) => props.recordAdminAction(current, "members", "update", toastCopy.status.title, toastCopy.status.description));
          },
        },
      ],
      onEdit: () => props.setMemberForm({
        id: member.id,
        name: member.name,
        animal: member.animal,
        sinceLabel: member.sinceLabel,
        badge: member.badge,
        sortOrder: member.sortOrder,
      }),
    onDelete: () => props.setPendingDelete({ entity: "member", id: member.id, title: member.name, description: `участника «${member.name}»` }),
      deleting: props.isDeleting && props.pendingDelete?.entity === "member" && props.pendingDelete.id === member.id,
    })),
    pagination: props.paginationMeta,
    onPageChange: (page) => props.setTabPage("members", page),
    onPageSizeChange: (pageSize) => props.setTabPageSize("members", pageSize),
  };
}
