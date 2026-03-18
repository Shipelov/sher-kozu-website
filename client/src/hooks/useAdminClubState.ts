import {
  defaultEventFilters,
  defaultEventForm,
  defaultMemberFilters,
  defaultMemberForm,
  defaultPostFilters,
  defaultPostForm,
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
  readAdminClubStateFromUrl,
  buildAdminClubUrl,
} from "@/pages/adminClubUrlState";
import {
  defaultCriticalNotificationSettings,
  type AdminActionLogEntry,
  type AdminActionType,
  type AdminTabValue,
  type CriticalNotificationHistoryEntry,
  type CriticalNotificationSettings,
  type EntityAdminTabValue,
} from "@/lib/adminClubActivity";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export function useAdminClubState() {
  const initialUrlState = useMemo(() => readAdminClubStateFromUrl(), []);
  const [location, setLocation] = useLocation();

  // ── Tab navigation ──
  const [activeTab, setActiveTab] = useState<AdminTabValue>(initialUrlState.activeTab);
  const [lastEntityTab, setLastEntityTab] = useState<EntityAdminTabValue>(
    initialUrlState.activeTab === "posts" || initialUrlState.activeTab === "events" || initialUrlState.activeTab === "members"
      ? initialUrlState.activeTab
      : "posts"
  );

  // ── Entity forms ──
  const [postForm, setPostForm] = useState<PostFormState>(defaultPostForm);
  const [eventForm, setEventForm] = useState<EventFormState>(defaultEventForm);
  const [memberForm, setMemberForm] = useState<MemberFormState>(defaultMemberForm);

  // ── Entity filters ──
  const [postFilters, setPostFilters] = useState<PostFilterState>(initialUrlState.postFilters);
  const [eventFilters, setEventFilters] = useState<EventFilterState>(initialUrlState.eventFilters);
  const [memberFilters, setMemberFilters] = useState<MemberFilterState>(initialUrlState.memberFilters);

  // ── Delete dialog ──
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);

  // ── Form errors ──
  const [postErrors, setPostErrors] = useState<FormErrors<PostFormField>>({});
  const [eventErrors, setEventErrors] = useState<FormErrors<EventFormField>>({});
  const [memberErrors, setMemberErrors] = useState<FormErrors<MemberFormField>>({});

  // ── Presets ──
  const [presetName, setPresetName] = useState<Record<EntityAdminTabValue, string>>({ posts: "", events: "", members: "" });

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<SelectionState>({ posts: [], events: [], members: [] });

  // ── Pagination ──
  const [pagination, setPagination] = useState<PaginationState>(initialUrlState.pagination);

  // ── Action log ──
  const [actionLog, setActionLog] = useState<AdminActionLogEntry[]>([]);
  const [actionLogCollapsed, setActionLogCollapsed] = useState(initialUrlState.actionLogCollapsed);
  const [actionLogAreaFilter, setActionLogAreaFilter] = useState<"all" | AdminTabValue>("all");
  const [actionLogTypeFilter, setActionLogTypeFilter] = useState<"all" | AdminActionType>("all");
  const [actionLogExportScope, setActionLogExportScope] = useState<"filtered" | "all">("filtered");

  // ── Critical notifications ──
  const [criticalNotificationSettings, setCriticalNotificationSettings] = useState<CriticalNotificationSettings>(defaultCriticalNotificationSettings);
  const [criticalNotificationHistory, setCriticalNotificationHistory] = useState<CriticalNotificationHistoryEntry[]>([]);

  // ── Bitrix state ──
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
  const [bitrixErrorFilter, setBitrixErrorFilter] = useState<"all" | "with_error" | "without_error">("all");
  const [selectedBitrixLeadId, setSelectedBitrixLeadId] = useState<number | null>(null);

  // ── URL sync ──
  useEffect(() => {
    if (activeTab === "posts" || activeTab === "events" || activeTab === "members") {
      setLastEntityTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const nextUrl = buildAdminClubUrl(activeTab, postFilters, eventFilters, memberFilters, pagination, actionLogCollapsed);
    if (location !== nextUrl) {
      setLocation(nextUrl, { replace: true });
    }
  }, [actionLogCollapsed, activeTab, eventFilters, location, memberFilters, pagination, postFilters, setLocation]);

  return {
    // Tab navigation
    activeTab, setActiveTab,
    lastEntityTab, setLastEntityTab,

    // Entity forms
    postForm, setPostForm,
    eventForm, setEventForm,
    memberForm, setMemberForm,

    // Entity filters
    postFilters, setPostFilters,
    eventFilters, setEventFilters,
    memberFilters, setMemberFilters,

    // Delete dialog
    pendingDelete, setPendingDelete,

    // Form errors
    postErrors, setPostErrors,
    eventErrors, setEventErrors,
    memberErrors, setMemberErrors,

    // Presets
    presetName, setPresetName,

    // Selection
    selectedIds, setSelectedIds,

    // Pagination
    pagination, setPagination,

    // Action log
    actionLog, setActionLog,
    actionLogCollapsed, setActionLogCollapsed,
    actionLogAreaFilter, setActionLogAreaFilter,
    actionLogTypeFilter, setActionLogTypeFilter,
    actionLogExportScope, setActionLogExportScope,

    // Critical notifications
    criticalNotificationSettings, setCriticalNotificationSettings,
    criticalNotificationHistory, setCriticalNotificationHistory,

    // Bitrix state
    bitrixQuery, setBitrixQuery,
    bitrixErrorFilter, setBitrixErrorFilter,
    selectedBitrixLeadId, setSelectedBitrixLeadId,
  };
}

export type AdminClubState = ReturnType<typeof useAdminClubState>;
