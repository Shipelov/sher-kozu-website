import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  getCrudToastCopy,
  getInlineActionToastCopy,
  isAdminTabValue,
  type ClubAdminPreset,
} from "./adminClubShared";
import {
  AdminClubActivityTabSection,
  AdminClubBitrixTabSection,
  AdminClubEventsTabSection,
  AdminClubMembersTabSection,
  AdminClubOverviewSection,
  AdminClubPostsTabSection,
} from "./adminClubSections";
import {
  AdminClubEventsTabContent,
  AdminClubMembersTabContent,
  AdminClubPostsTabContent,
} from "./adminClubCrudTabs";
import {
  buildAdminClubEventsTabProps,
  buildAdminClubMembersTabProps,
  buildAdminClubPostsTabProps,
} from "./adminClubCrudTabBuilders";
import {
  AdminClubActivityTabContent,
  AdminClubBitrixTabContent,
} from "./adminClubRemainingTabs";
import { buildPaginationMeta } from "./adminClubUi";
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
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCriticalNotificationAreaLabel,
  getCriticalNotificationStatusCopy,
  recordAdminAction,
  type AdminTabValue,
} from "@/lib/adminClubActivity";
import { trpc } from "@/lib/trpc";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { useAdminClubState } from "@/hooks/useAdminClubState";
import { useAdminClubMutations } from "@/hooks/useAdminClubMutations";
import {
  useAdminClubDerived,
  buildBulkDeleteSummaryItems,
  getActionTypeBadgeConfig,
  getBulkActionToastCopy,
  getDeleteDialogCopy,
  formatUnknownDate,
} from "@/hooks/useAdminClubDerived";
import { useAdminClubHandlers } from "@/hooks/useAdminClubHandlers";

export default function AdminClub() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // ── State ──
  const state = useAdminClubState();

  // ── Queries ──
  const adminQuery = trpc.adminClub.dashboard.useQuery(undefined, {
    enabled: Boolean((user as { role?: string } | null)?.role === "admin"),
  });

  const bitrixAdminQuery = trpc.system.health.useQuery({ timestamp: Date.now() }, {
    enabled: false,
  });

  // ── Mutations ──
  const mutations = useAdminClubMutations({
    setPendingDelete: state.setPendingDelete,
    setActionLog: state.setActionLog,
    setCriticalNotificationHistory: state.setCriticalNotificationHistory,
    criticalNotificationSettings: state.criticalNotificationSettings,
    setPresetName: state.setPresetName,
  });

  // ── Raw data from query ──
  const posts = adminQuery.data?.posts ?? [];
  const events = adminQuery.data?.events ?? [];
  const members = adminQuery.data?.members ?? [];
  const presets = (adminQuery.data?.presets ?? []) as ClubAdminPreset[];
  const bitrixLeads: Array<Record<string, unknown>> = [];
  const bitrixAudits: Array<Record<string, unknown>> = [];
  const bitrixSummary = null;
  const bitrixPagination = null;

  // ── Derived ──
  const derived = useAdminClubDerived({
    posts, events, members, presets,
    postFilters: state.postFilters,
    eventFilters: state.eventFilters,
    memberFilters: state.memberFilters,
    selectedIds: state.selectedIds,
    pagination: state.pagination,
    setPagination: state.setPagination,
    pendingDelete: state.pendingDelete,
    deletePostPending: mutations.deletePost.isPending,
    deleteEventPending: mutations.deleteEvent.isPending,
    deleteMemberPending: mutations.deleteMember.isPending,
    actionLog: state.actionLog,
    actionLogAreaFilter: state.actionLogAreaFilter,
    actionLogTypeFilter: state.actionLogTypeFilter,
    actionLogExportScope: state.actionLogExportScope,
    criticalNotificationHistory: state.criticalNotificationHistory,
    bitrixLeads,
    bitrixAudits,
    bitrixErrorFilter: state.bitrixErrorFilter,
    selectedBitrixLeadId: state.selectedBitrixLeadId,
  });

  // ── Handlers ──
  const handlers = useAdminClubHandlers({
    // State setters
    setActiveTab: state.setActiveTab,
    setPostForm: state.setPostForm,
    setPostErrors: state.setPostErrors,
    setEventForm: state.setEventForm,
    setEventErrors: state.setEventErrors,
    setMemberForm: state.setMemberForm,
    setMemberErrors: state.setMemberErrors,
    setPostFilters: state.setPostFilters,
    setEventFilters: state.setEventFilters,
    setMemberFilters: state.setMemberFilters,
    setSelectedIds: state.setSelectedIds,
    setPendingDelete: state.setPendingDelete,
    setPagination: state.setPagination,
    setActionLog: state.setActionLog,
    setActionLogAreaFilter: state.setActionLogAreaFilter,
    setActionLogTypeFilter: state.setActionLogTypeFilter,
    setActionLogExportScope: state.setActionLogExportScope,

    // Current state
    postForm: state.postForm,
    eventForm: state.eventForm,
    memberForm: state.memberForm,
    postFilters: state.postFilters,
    eventFilters: state.eventFilters,
    memberFilters: state.memberFilters,
    activeTab: state.activeTab,
    pagination: state.pagination,
    actionLogCollapsed: state.actionLogCollapsed,
    pendingDelete: state.pendingDelete,
    presetsByTab: derived.presetsByTab,
    presetName: state.presetName,
    setPresetName: state.setPresetName,
    selectedIds: state.selectedIds,
    totalPages: derived.totalPages,

    // Mutations
    createPost: mutations.createPost,
    updatePost: mutations.updatePost,
    deletePost: mutations.deletePost,
    createEvent: mutations.createEvent,
    updateEvent: mutations.updateEvent,
    deleteEvent: mutations.deleteEvent,
    createMember: mutations.createMember,
    updateMember: mutations.updateMember,
    deleteMember: mutations.deleteMember,
    createPreset: mutations.createPreset,
    processCriticalAdminNotification: mutations.processCriticalAdminNotification,

    // Derived
    exportableActionLog: derived.exportableActionLog,
    actionLogExportScope: state.actionLogExportScope,
  });

  // ── Delete dialog copy ──
  const deleteDialogCopy = getDeleteDialogCopy(state.pendingDelete);
  const deleteSummaryOverflow = state.pendingDelete && "summaryItems" in state.pendingDelete
    ? Math.max(0, state.pendingDelete.totalCount - state.pendingDelete.summaryItems.length)
    : 0;

  // ── Loading states ──
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

  const isForbidden = adminQuery.error?.message === NOT_ADMIN_ERR_MSG;

  return (
    <DashboardLayout>
      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={Boolean(state.pendingDelete)} onOpenChange={(open) => {
        if (!open && !derived.isDeleting) {
          state.setPendingDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialogCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {state.pendingDelete ? (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p className="font-medium text-stone-950">{state.pendingDelete.title}</p>
              {"summaryItems" in state.pendingDelete ? (
                <>
                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Первые выбранные записи</p>
                    <div className="mt-2 space-y-2">
                      {state.pendingDelete.summaryItems.map((item) => (
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
            <AlertDialogCancel disabled={derived.isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handlers.confirmDelete();
              }}
              disabled={derived.isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {derived.isDeleting ? "Удаляем..." : deleteDialogCopy.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container py-6 md:py-8 space-y-6">
        <AdminClubOverviewSection counts={derived.counts} user={user} isLoading={adminQuery.isLoading} />

        {isForbidden ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Недостаточно прав</AlertTitle>
            <AlertDescription>Сервер вернул ограничение по роли. Проверьте, что ваш пользователь имеет роль admin в таблице users.</AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={state.activeTab} onValueChange={(value) => {
          if (isAdminTabValue(value)) {
            if (value === "posts" || value === "events" || value === "members") {
              state.setLastEntityTab(value);
            }
            state.setActiveTab(value);
          }
        }} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-stone-100 p-1 sm:grid-cols-2 sm:gap-1 lg:grid-cols-5 md:w-auto">
            <TabsTrigger value="posts" className="w-full whitespace-normal px-3 py-2 text-center">Посты</TabsTrigger>
            <TabsTrigger value="events" className="w-full whitespace-normal px-3 py-2 text-center">События</TabsTrigger>
            <TabsTrigger value="members" className="w-full whitespace-normal px-3 py-2 text-center">Участники</TabsTrigger>
            <TabsTrigger value="bitrix" className="w-full whitespace-normal px-3 py-2 text-center">Bitrix24 CRM</TabsTrigger>
            <TabsTrigger value="activity" className="w-full whitespace-normal px-3 py-2 text-center">Журнал действий</TabsTrigger>
          </TabsList>

          {/* ── Posts tab ── */}
          <AdminClubPostsTabSection>
            <AdminClubPostsTabContent
              {...buildAdminClubPostsTabProps({
                postForm: state.postForm,
                postErrors: state.postErrors,
                setPostForm: state.setPostForm,
                setPostErrors: state.setPostErrors,
                handlePostSubmit: handlers.handlePostSubmit,
                createPostPending: mutations.createPost.isPending,
                updatePostPending: mutations.updatePost.isPending,
                postFilters: state.postFilters,
                setPostFilters: state.setPostFilters,
                selectedPosts: derived.selectedPosts,
                allVisiblePostsSelected: derived.allVisiblePostsSelected,
                filteredPosts: derived.filteredPosts,
                toggleSelectAllVisible: handlers.toggleSelectAllVisible,
                clearSelection: handlers.clearSelection,
                selectedIds: state.selectedIds,
                toggleSelection: handlers.toggleSelection,
                presetName: state.presetName,
                setPresetName: state.setPresetName,
                handleSavePreset: handlers.handleSavePreset,
                createPresetPending: mutations.createPreset.isPending,
                presetsByTab: derived.presetsByTab,
                applyPreset: handlers.applyPreset,
                deletePreset: mutations.deletePreset,
                postCategories: derived.postCategories,
                paginatedPosts: derived.paginatedPosts,
                paginationMeta: buildPaginationMeta(derived.filteredPosts.length, state.pagination.posts.page, state.pagination.posts.pageSize, derived.totalPages.posts),
                setTabPage: handlers.setTabPage,
                setTabPageSize: handlers.setTabPageSize,
                isDeleting: derived.isDeleting,
                setPendingDelete: state.setPendingDelete,
                buildBulkDeleteSummaryItems,
                getBulkActionToastCopy,
                getInlineActionToastCopy,
                updatePost: mutations.updatePost,
                toast,
                pendingDelete: state.pendingDelete,
              })}
            />
          </AdminClubPostsTabSection>

          {/* ── Events tab ── */}
          <AdminClubEventsTabSection>
            <AdminClubEventsTabContent
              {...buildAdminClubEventsTabProps({
                eventForm: state.eventForm,
                eventErrors: state.eventErrors,
                setEventForm: state.setEventForm,
                setEventErrors: state.setEventErrors,
                handleEventSubmit: handlers.handleEventSubmit,
                createEventPending: mutations.createEvent.isPending,
                updateEventPending: mutations.updateEvent.isPending,
                eventFilters: state.eventFilters,
                setEventFilters: state.setEventFilters,
                selectedEvents: derived.selectedEvents,
                allVisibleEventsSelected: derived.allVisibleEventsSelected,
                filteredEvents: derived.filteredEvents,
                toggleSelectAllVisible: handlers.toggleSelectAllVisible,
                clearSelection: handlers.clearSelection,
                selectedIds: { events: state.selectedIds.events },
                toggleSelection: handlers.toggleSelection,
                presetName: state.presetName,
                setPresetName: state.setPresetName,
                handleSavePreset: handlers.handleSavePreset,
                createPresetPending: mutations.createPreset.isPending,
                presetsByTab: { events: derived.presetsByTab.events },
                applyPreset: handlers.applyPreset,
                deletePreset: mutations.deletePreset,
                eventStatuses: derived.eventStatuses,
                eventTones: derived.eventTones,
                paginatedEvents: derived.paginatedEvents,
                paginationMeta: buildPaginationMeta(derived.filteredEvents.length, state.pagination.events.page, state.pagination.events.pageSize, derived.totalPages.events),
                setTabPage: handlers.setTabPage,
                setTabPageSize: handlers.setTabPageSize,
                isDeleting: derived.isDeleting,
                setPendingDelete: state.setPendingDelete,
                buildBulkDeleteSummaryItems,
                getInlineActionToastCopy,
                updateEvent: mutations.updateEvent,
                toast,
                pendingDelete: state.pendingDelete,
                setActionLog: state.setActionLog,
                recordAdminAction,
              })}
            />
          </AdminClubEventsTabSection>

          {/* ── Members tab ── */}
          <AdminClubMembersTabSection>
            <AdminClubMembersTabContent
              {...buildAdminClubMembersTabProps({
                memberForm: state.memberForm,
                memberErrors: state.memberErrors,
                setMemberForm: state.setMemberForm,
                setMemberErrors: state.setMemberErrors,
                handleMemberSubmit: handlers.handleMemberSubmit,
                createMemberPending: mutations.createMember.isPending,
                updateMemberPending: mutations.updateMember.isPending,
                memberFilters: state.memberFilters,
                setMemberFilters: state.setMemberFilters,
                selectedMembers: derived.selectedMembers,
                allVisibleMembersSelected: derived.allVisibleMembersSelected,
                filteredMembers: derived.filteredMembers,
                toggleSelectAllVisible: handlers.toggleSelectAllVisible,
                clearSelection: handlers.clearSelection,
                selectedIds: { members: state.selectedIds.members },
                toggleSelection: handlers.toggleSelection,
                presetName: state.presetName,
                setPresetName: state.setPresetName,
                handleSavePreset: handlers.handleSavePreset,
                createPresetPending: mutations.createPreset.isPending,
                presetsByTab: { members: derived.presetsByTab.members },
                applyPreset: handlers.applyPreset,
                deletePreset: mutations.deletePreset,
                memberBadges: derived.memberBadges,
                paginatedMembers: derived.paginatedMembers,
                paginationMeta: buildPaginationMeta(derived.filteredMembers.length, state.pagination.members.page, state.pagination.members.pageSize, derived.totalPages.members),
                setTabPage: handlers.setTabPage,
                setTabPageSize: handlers.setTabPageSize,
                isDeleting: derived.isDeleting,
                setPendingDelete: state.setPendingDelete,
                buildBulkDeleteSummaryItems,
                getInlineActionToastCopy,
                updateMember: mutations.updateMember,
                toast,
                pendingDelete: state.pendingDelete,
                setActionLog: state.setActionLog,
                recordAdminAction,
              })}
            />
          </AdminClubMembersTabSection>

          {/* ── Bitrix tab ── */}
          <AdminClubBitrixTabSection>
            <AdminClubBitrixTabContent
              bitrixSummaryItems={[
                { key: "totalLeads", label: "Всего лидов", value: 0 },
                { key: "pendingRetry", label: "В очереди / retry", value: 0 },
                { key: "successful", label: "Успешно синхронизировано", value: 0 },
                { key: "failedAudits", label: "Ошибки аудита", value: 0 },
              ]}
              bitrixStatusOptions={["pending", "success", "failed", "retried"]}
              bitrixSourceOptions={["website", "club", "referral", "manual"]}
              bitrixQuery={{
                search: state.bitrixQuery.query,
                syncStatus: state.bitrixQuery.syncStatus,
                source: state.bitrixQuery.source,
                failuresOnly: state.bitrixQuery.onlyFailed,
                page: state.bitrixQuery.page,
              }}
              setBitrixQuery={(updater) => {
                if (typeof updater === "function") {
                  state.setBitrixQuery((current) => {
                    const mapped = {
                      search: current.query,
                      syncStatus: current.syncStatus,
                      source: current.source,
                      failuresOnly: current.onlyFailed,
                      page: current.page,
                    };
                    const next = updater(mapped);
                    return {
                      ...current,
                      query: next.search,
                      syncStatus: next.syncStatus as typeof current.syncStatus,
                      source: next.source as typeof current.source,
                      onlyFailed: next.failuresOnly,
                      page: next.page,
                    };
                  });
                } else {
                  state.setBitrixQuery((current) => ({
                    ...current,
                    query: updater.search,
                    syncStatus: updater.syncStatus as typeof current.syncStatus,
                    source: updater.source as typeof current.source,
                    onlyFailed: updater.failuresOnly,
                    page: updater.page,
                  }));
                }
              }}
              bitrixLeads={derived.visibleBitrixLeads as any}
              bitrixPagination={bitrixPagination}
              bitrixAdminQuery={{ isFetching: bitrixAdminQuery.isFetching }}
              selectedBitrixLead={derived.selectedBitrixLead as any}
              setSelectedBitrixLeadId={(id) => state.setSelectedBitrixLeadId(id)}
              retryLeadSync={mutations.retryLeadSync}
              refreshDealSnapshot={{
                isPending: false,
                mutateAsync: async (input: { leadId: number }) => {
                  await mutations.refreshDealSnapshot(String(input.leadId), input.leadId);
                },
              }}
              selectedBitrixLeadAudits={derived.selectedBitrixLeadAudits as any}
              bitrixAudits={bitrixAudits as any}
            />
          </AdminClubBitrixTabSection>

          {/* ── Activity tab ── */}
          <AdminClubActivityTabSection>
            <AdminClubActivityTabContent
              actionLog={state.actionLog as any}
              filteredActionLog={derived.filteredActionLog as any}
              actionLogCollapsed={state.actionLogCollapsed}
              setActionLogCollapsed={state.setActionLogCollapsed}
              copyCurrentViewLink={handlers.copyCurrentViewLink}
              actionLogExportScope={state.actionLogExportScope}
              setActionLogExportScope={state.setActionLogExportScope}
              exportableActionLog={derived.exportableActionLog as any}
              exportActionLogToCsv={handlers.exportActionLogToCsv}
              setActionLog={state.setActionLog as any}
              actionLogFilterPresets={handlers.actionLogFilterPresets}
              actionLogAreaFilter={state.actionLogAreaFilter}
              actionLogTypeFilter={state.actionLogTypeFilter}
              applyActionLogPreset={handlers.applyActionLogPreset}
              actionLogTypeStatsItems={derived.actionLogTypeStatsItems}
              actionLogAreaStatsItems={derived.actionLogAreaStatsItems}
              setActionLogAreaFilter={state.setActionLogAreaFilter as any}
              setActionLogTypeFilter={state.setActionLogTypeFilter as any}
              criticalNotificationSettings={state.criticalNotificationSettings}
              setCriticalNotificationSettings={state.setCriticalNotificationSettings}
              criticalNotificationHistory={state.criticalNotificationHistory as any}
              deliveredCriticalCount={derived.deliveredCriticalCount}
              failedCriticalCount={derived.failedCriticalCount}
              getCriticalNotificationStatusCopy={getCriticalNotificationStatusCopy as any}
              getCriticalNotificationAreaLabel={getCriticalNotificationAreaLabel as any}
              groupedActionLog={derived.groupedActionLog as any}
              getActionTypeBadgeConfig={getActionTypeBadgeConfig}
              exportableActionLogIds={derived.exportableActionLogIds as any}
              lastEntityTab={state.lastEntityTab}
              setActiveTab={state.setActiveTab as any}
            />
          </AdminClubActivityTabSection>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
