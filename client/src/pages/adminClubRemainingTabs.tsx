import type { Dispatch, SetStateAction } from "react";

import ScrollRemaining from "@/components/ScrollRemaining";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import type { AdminActionType, AdminTabValue } from "@/lib/adminClubActivity";
import { Field } from "./adminClubUi";

type BitrixLead = {
  id: number;
  companyName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  interestType?: string | null;
  source?: string | null;
  syncStatus: string;
  syncAttemptCount: number;
  assignedManagerName?: string | null;
  bitrixDealId?: number | string | null;
  bitrixLeadId?: number | string | null;
  bitrixContactId?: number | string | null;
  bitrixStageId?: string | null;
  lastSyncError?: string | null;
  nextActivityAt?: number | string | Date | null;
  lastSyncAt?: number | string | Date | null;
  createdAt?: number | string | Date | null;
  telegram?: string | null;
  region?: string | null;
  preferredContactMethod?: string | null;
  interestProducts?: unknown;
  notes?: string | null;
  assignedManagerId?: number | string | null;
};

type BitrixAudit = {
  id: string | number;
  operation: string;
  entityType: string;
  entityId?: string | number | null;
  externalId?: string | number | null;
  status: string;
  errorMessage?: string | null;
  createdAt: number | string | Date;
  requestPayload?: string | null;
  responsePayload?: string | null;
};

type CriticalNotificationSettings = {
  enabled: boolean;
  notifyOnDelete: boolean;
  notifyOnBulk: boolean;
  notifyOnPreset: boolean;
  minBulkCount: number;
};

type CriticalNotificationEntry = {
  id: string;
  title: string;
  area: string;
  description: string;
  actionType: string;
  severityLabel: string;
  actorLabel: string;
  affectedCount?: number | null;
  reason: string;
  timestamp: number;
};

type ActivityLogEntry = {
  id: string;
  area: string;
  title: string;
  description: string;
  timestamp: number;
  actionType: AdminActionType;
};

type ActivityGroup = {
  key: string;
  dateLabel: string;
  hourLabel: string;
  entries: ActivityLogEntry[];
};

const formatDateTime = (value: number | string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ru-RU");
};

type SetBitrixQuery = Dispatch<
  SetStateAction<{
    search: string;
    syncStatus: string;
    source: string;
    failuresOnly: boolean;
    page: number;
  }>
>;

export type AdminClubBitrixTabContentProps = {
  bitrixSummaryItems: Array<{ key: string; label: string; value: string | number }>;
  bitrixStatusOptions: string[];
  bitrixSourceOptions: string[];
  bitrixQuery: {
    search: string;
    syncStatus: string;
    source: string;
    failuresOnly: boolean;
    page: number;
  };
  setBitrixQuery: SetBitrixQuery;
  bitrixLeads: BitrixLead[];
  bitrixPagination?: { page: number; pageCount: number; total: number; pageSize?: number } | null;
  bitrixAdminQuery: { isFetching: boolean };
  selectedBitrixLead: BitrixLead | null;
  setSelectedBitrixLeadId: (value: number) => void;
  retryLeadSync: { isPending: boolean; mutateAsync: (input: { leadId: number }) => Promise<unknown> };
  refreshDealSnapshot: { isPending: boolean; mutateAsync: (input: { leadId: number }) => Promise<unknown> };
  selectedBitrixLeadAudits: BitrixAudit[];
  bitrixAudits: BitrixAudit[];
};

export function AdminClubBitrixTabContent({
  bitrixSummaryItems,
  bitrixStatusOptions,
  bitrixSourceOptions,
  bitrixQuery,
  setBitrixQuery,
  bitrixLeads,
  bitrixPagination,
  bitrixAdminQuery,
  selectedBitrixLead,
  setSelectedBitrixLeadId,
  retryLeadSync,
  refreshDealSnapshot,
  selectedBitrixLeadAudits,
  bitrixAudits,
}: AdminClubBitrixTabContentProps) {
  const historyAudits = selectedBitrixLeadAudits.filter((audit) =>
    ["retry", "sync", "pull"].includes(String(audit.operation)),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card className="border-stone-200 bg-white/90 shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-stone-950">CRM-очередь и Bitrix24 sync</CardTitle>
                <CardDescription className="text-stone-600">
                  Операционный мониторинг лидов: здесь видно server-side статус, количество попыток sync и текущий CRM-контекст по каждой заявке.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700"
              >
                {bitrixLeads.length} лидов в выдаче
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {bitrixSummaryItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-600"
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Поиск по лидогенерации">
                <Input
                  value={bitrixQuery.search}
                  onChange={(event) =>
                    setBitrixQuery((current) => ({
                      ...current,
                      search: event.target.value,
                      page: 1,
                    }))
                  }
                  placeholder="Компания, email, менеджер"
                />
              </Field>
              <Field label="Server-side статус">
                <Select
                  value={bitrixQuery.syncStatus}
                  onValueChange={(value) =>
                    setBitrixQuery((current) => ({ ...current, syncStatus: value, page: 1 }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-stone-200 bg-white text-stone-700">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    {bitrixStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "all" ? "Все статусы" : status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Источник лида">
                <Select
                  value={bitrixQuery.source}
                  onValueChange={(value) =>
                    setBitrixQuery((current) => ({ ...current, source: value, page: 1 }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-stone-200 bg-white text-stone-700">
                    <SelectValue placeholder="Все источники" />
                  </SelectTrigger>
                  <SelectContent>
                    {bitrixSourceOptions.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source === "all" ? "Все источники" : source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-900">Только ошибки</p>
                    <p className="text-xs text-stone-500">Показать лиды с последней sync-ошибкой</p>
                  </div>
                  <Switch
                    checked={bitrixQuery.failuresOnly}
                    onCheckedChange={(checked) =>
                      setBitrixQuery((current) => ({ ...current, failuresOnly: checked, page: 1 }))
                    }
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {bitrixLeads.length ? (
              <ScrollRemaining totalItems={bitrixLeads.length} itemHeight={100} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {bitrixLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-950">
                            #{lead.id} · {lead.companyName}
                          </p>
                          <Badge
                            variant="outline"
                            className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-700"
                          >
                            {lead.syncStatus}
                          </Badge>
                          {lead.bitrixStageId ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700"
                            >
                              Stage: {lead.bitrixStageId}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-stone-600">
                          {lead.fullName} · {lead.email}
                          {lead.phone ? ` · ${lead.phone}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                          <span>Интерес: {lead.interestType || "—"}</span>
                          <span>Источник: {lead.source || "—"}</span>
                          <span>Попытки sync: {lead.syncAttemptCount}</span>
                          <span>Менеджер: {lead.assignedManagerName || "не назначен"}</span>
                          <span>Deal ID: {lead.bitrixDealId || "—"}</span>
                        </div>
                        {lead.lastSyncError ? (
                          <p className="text-xs leading-5 text-rose-700">Ошибка: {lead.lastSyncError}</p>
                        ) : null}
                        <p className="text-xs text-stone-500">
                          Следующая активность: {formatDateTime(lead.nextActivityAt) || "ещё не запланирована"}
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
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh snapshot
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollRemaining>
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
                  onClick={() =>
                    setBitrixQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
                  }
                  disabled={(bitrixPagination?.page ?? bitrixQuery.page) <= 1 || bitrixAdminQuery.isFetching}
                >
                  Предыдущая страница
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  onClick={() => setBitrixQuery((current) => ({ ...current, page: current.page + 1 }))}
                  disabled={Boolean(
                    bitrixPagination && bitrixPagination.page >= bitrixPagination.pageCount,
                  ) || bitrixAdminQuery.isFetching}
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
                          <p className="text-base font-semibold text-stone-950">
                            #{selectedBitrixLead.id} · {selectedBitrixLead.companyName}
                          </p>
                          <Badge
                            variant="outline"
                            className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-700"
                          >
                            {selectedBitrixLead.syncStatus}
                          </Badge>
                          {selectedBitrixLead.bitrixStageId ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700"
                            >
                              Stage: {selectedBitrixLead.bitrixStageId}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-stone-600">
                          {selectedBitrixLead.fullName} · {selectedBitrixLead.email}
                          {selectedBitrixLead.phone ? ` · ${selectedBitrixLead.phone}` : ""}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Менеджер</p>
                            <p className="mt-2 font-medium text-stone-950">
                              {selectedBitrixLead.assignedManagerName || "Не назначен"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Следующая активность</p>
                            <p className="mt-2 font-medium text-stone-950">
                              {formatDateTime(selectedBitrixLead.nextActivityAt) || "Не запланирована"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">CRM IDs</p>
                            <p className="mt-2 leading-6 text-stone-950">
                              Deal: {selectedBitrixLead.bitrixDealId || "—"}
                              <br />
                              Lead: {selectedBitrixLead.bitrixLeadId || "—"}
                              <br />
                              Contact: {selectedBitrixLead.bitrixContactId || "—"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Sync attempts</p>
                            <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.syncAttemptCount}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              Последний sync: {formatDateTime(selectedBitrixLead.lastSyncAt) || "ещё не запускался"}
                            </p>
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
                          onClick={() =>
                            void refreshDealSnapshot.mutateAsync({ leadId: selectedBitrixLead.id })
                          }
                          disabled={
                            !selectedBitrixLead.bitrixDealId || refreshDealSnapshot.isPending
                          }
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
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
                          <p className="text-xs text-stone-500">
                            Локальная временная шкала строится из CRM-счётчиков и связанных audit-записей по выбранному лиду.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700"
                        >
                          {selectedBitrixLeadAudits.length} audit events
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-3">
                          <p className="text-sm font-medium text-stone-900">Старт лидогенерации</p>
                          <p className="text-xs text-stone-500">
                            Создано: {formatDateTime(selectedBitrixLead.createdAt) || "дата недоступна"}
                          </p>
                        </div>
                        {selectedBitrixLeadAudits.slice(0, 6).map((audit) => (
                          <div
                            key={audit.id}
                            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-stone-950">
                                  {audit.operation} · {audit.entityType}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {audit.externalId
                                    ? `External ID: ${audit.externalId}`
                                    : "Без внешнего ID"}
                                </p>
                                {audit.errorMessage ? (
                                  <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p>
                                ) : null}
                              </div>
                              <Badge
                                variant="outline"
                                className={
                                  audit.status === "success"
                                    ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800"
                                    : audit.status === "failed"
                                      ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800"
                                      : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"
                                }
                              >
                                {audit.status}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-stone-500">{formatDateTime(audit.createdAt)}</p>
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
                            <p className="text-xs text-stone-500">
                              Быстрый просмотр ключевых полей заявки без обращения к базе или вебхуку вручную.
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700"
                          >
                            Lead #{selectedBitrixLead.id}
                          </Badge>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-4">
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-stone-700">
                            {JSON.stringify(
                              {
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
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-stone-950">Retry / snapshot history</p>
                            <p className="text-xs text-stone-500">
                              Полная история ручных sync-циклов и pull snapshot по выбранной заявке.
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700"
                          >
                            {historyAudits.length} relevant events
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {historyAudits.slice(0, 10).map((audit) => (
                            <div
                              key={`history-${audit.id}`}
                              className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-stone-950">
                                    {audit.operation === "pull"
                                      ? "Refresh snapshot"
                                      : audit.operation === "retry"
                                        ? "Retry sync"
                                        : "Первичная sync"}
                                  </p>
                                  <p className="text-xs text-stone-500">
                                    {audit.externalId
                                      ? `External ID: ${audit.externalId}`
                                      : "Без внешнего ID"}
                                  </p>
                                  {audit.errorMessage ? (
                                    <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p>
                                  ) : null}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={
                                    audit.status === "success"
                                      ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800"
                                      : audit.status === "failed"
                                        ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800"
                                        : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"
                                  }
                                >
                                  {audit.status}
                                </Badge>
                              </div>
                              {audit.requestPayload ? (
                                <details className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                  <summary className="cursor-pointer text-xs font-medium text-stone-700">
                                    Request payload
                                  </summary>
                                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-stone-600">
                                    {audit.requestPayload}
                                  </pre>
                                </details>
                              ) : null}
                              {audit.responsePayload ? (
                                <details className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                  <summary className="cursor-pointer text-xs font-medium text-stone-700">
                                    Response payload
                                  </summary>
                                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-stone-600">
                                    {audit.responsePayload}
                                  </pre>
                                </details>
                              ) : null}
                              <p className="mt-2 text-xs text-stone-500">{formatDateTime(audit.createdAt)}</p>
                            </div>
                          ))}
                          {!historyAudits.length ? (
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
                <ScrollRemaining totalItems={Math.min(bitrixAudits.length, 12)} itemHeight={80} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {bitrixAudits.slice(0, 12).map((audit) => (
                  <div
                    key={audit.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-950">
                            {audit.operation} · {audit.entityType}
                          </p>
                          <Badge
                            variant="outline"
                            className={
                              audit.status === "success"
                                ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800"
                                : audit.status === "failed"
                                  ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800"
                                  : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"
                            }
                          >
                            {audit.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-stone-500">
                          Lead #{audit.entityId || "—"} · External ID: {audit.externalId || "—"}
                        </p>
                        {audit.errorMessage ? (
                          <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p>
                        ) : null}
                      </div>
                      <span className="text-xs text-stone-500">{formatDateTime(audit.createdAt)}</span>
                    </div>
                  </div>
                ))}
                </ScrollRemaining>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                  Аудит интеграции пока пуст. После первой отправки или refresh snapshot здесь появятся push/pull записи.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export type AdminClubActivityTabContentProps = {
  actionLog: ActivityLogEntry[];
  filteredActionLog: ActivityLogEntry[];
  actionLogCollapsed: boolean;
  setActionLogCollapsed: Dispatch<SetStateAction<boolean>>;
  copyCurrentViewLink: () => void;
  actionLogExportScope: "filtered" | "all";
  setActionLogExportScope: Dispatch<SetStateAction<"filtered" | "all">>;
  exportableActionLog: ActivityLogEntry[];
  exportActionLogToCsv: () => void;
  setActionLog: Dispatch<SetStateAction<ActivityLogEntry[]>>;
  actionLogFilterPresets: Array<{
    id: string;
    label: string;
    area: string;
    actionType?: string;
    actionTypes?: string[];
  }>;
  actionLogAreaFilter: string;
  actionLogTypeFilter: string;
  applyActionLogPreset: (presetId: string) => void;
  actionLogTypeStatsItems: Array<{ key: string; label: string; value: string | number }>;
  actionLogAreaStatsItems: Array<{ key: string; label: string; value: string | number }>;
  setActionLogAreaFilter: Dispatch<SetStateAction<string>>;
  setActionLogTypeFilter: Dispatch<SetStateAction<string>>;
  criticalNotificationSettings: CriticalNotificationSettings;
  setCriticalNotificationSettings: Dispatch<SetStateAction<CriticalNotificationSettings>>;
  criticalNotificationHistory: CriticalNotificationEntry[];
  deliveredCriticalCount: number;
  failedCriticalCount: number;
  getCriticalNotificationStatusCopy: (
    entry: CriticalNotificationEntry,
  ) => { label: string; className: string };
  getCriticalNotificationAreaLabel: (area: string) => string;
  groupedActionLog: ActivityGroup[];
  getActionTypeBadgeConfig: (
    actionType: AdminActionType,
  ) => { label: string; className: string };
  exportableActionLogIds: Set<string>;
  lastEntityTab: Extract<AdminTabValue, "posts" | "events" | "members">;
  setActiveTab: Dispatch<SetStateAction<AdminTabValue>>;
};

export function AdminClubActivityTabContent({
  actionLog,
  filteredActionLog,
  actionLogCollapsed,
  setActionLogCollapsed,
  copyCurrentViewLink,
  actionLogExportScope,
  setActionLogExportScope,
  exportableActionLog,
  exportActionLogToCsv,
  setActionLog,
  actionLogFilterPresets,
  actionLogAreaFilter,
  actionLogTypeFilter,
  applyActionLogPreset,
  actionLogTypeStatsItems,
  actionLogAreaStatsItems,
  setActionLogAreaFilter,
  setActionLogTypeFilter,
  criticalNotificationSettings,
  setCriticalNotificationSettings,
  criticalNotificationHistory,
  deliveredCriticalCount,
  failedCriticalCount,
  getCriticalNotificationStatusCopy,
  getCriticalNotificationAreaLabel,
  groupedActionLog,
  getActionTypeBadgeConfig,
  exportableActionLogIds,
  lastEntityTab,
  setActiveTab,
}: AdminClubActivityTabContentProps) {
  return (
    <Card className="border-stone-200 bg-white/90">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Последние действия администратора</CardTitle>
            <CardDescription>
              Короткий локальный журнал последних операций в этой сессии для прозрачности изменений в клубной панели.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700"
            >
              {actionLog.length} записей
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-stone-300 px-3 text-stone-700"
              onClick={() => setActionLogCollapsed((current) => !current)}
            >
              {actionLogCollapsed ? (
                <ChevronDown className="mr-1.5 h-4 w-4" />
              ) : (
                <ChevronUp className="mr-1.5 h-4 w-4" />
              )}
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
            <Badge
              variant="outline"
              className="rounded-full border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
            >
              Видимо сейчас: {filteredActionLog.length}
            </Badge>
            <Select
              value={actionLogExportScope}
              onValueChange={(value) => setActionLogExportScope(value as "filtered" | "all")}
            >
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
          <p className="text-sm text-stone-500">
            Журнал свёрнут. Разверните блок, чтобы посмотреть последние действия администратора и применить фильтры.
          </p>
        </CardContent>
      ) : (
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="sticky top-3 z-10 -mx-1 space-y-3 rounded-2xl border border-stone-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
              <div className="flex flex-wrap gap-2">
                {actionLogFilterPresets.map((preset) => {
                  const matchesArea = actionLogAreaFilter === preset.area;
                  const matchesType = preset.actionTypes?.length
                    ? preset.actionTypes.includes(actionLogTypeFilter)
                    : actionLogTypeFilter === (preset.actionType ?? "all");
                  const isActive = matchesArea && matchesType;

                  return (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={
                        isActive
                          ? "rounded-full border-stone-900 bg-stone-900 px-3 text-white hover:bg-stone-800"
                          : "rounded-full border-stone-300 bg-white px-3 text-stone-700 hover:bg-stone-50"
                      }
                      onClick={() => applyActionLogPreset(preset.id)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-600">
                <span>
                  Текущий фильтр показывает {filteredActionLog.length} из {actionLog.length} записей журнала.
                </span>
                <span>
                  Режим экспорта: {actionLogExportScope === "all" ? "весь журнал сессии" : "только текущий вид"}.
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {actionLogTypeStatsItems.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600"
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {actionLogAreaStatsItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-dashed border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600"
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-stone-950">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Область журнала">
                <select
                  value={actionLogAreaFilter}
                  onChange={(event) => setActionLogAreaFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                >
                  <option value="all">Все области</option>
                  <option value="posts">Посты</option>
                  <option value="events">События</option>
                  <option value="members">Участники</option>
                  <option value="bitrix">Bitrix24</option>
                  <option value="activity">Журнал</option>
                </select>
              </Field>
              <Field label="Тип операции">
                <select
                  value={actionLogTypeFilter}
                  onChange={(event) => setActionLogTypeFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                >
                  <option value="all">Все типы</option>
                  <option value="create">Создание</option>
                  <option value="update">Изменение</option>
                  <option value="delete">Удаление</option>
                  <option value="bulk">Массовые операции</option>
                  <option value="preset">Пресеты</option>
                  <option value="sync">Синхронизация</option>
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
                    <CardTitle className="text-base text-stone-950">
                      Критические уведомления для администраторов
                    </CardTitle>
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
                      <p className="text-sm font-medium text-stone-900">
                        Включить критические уведомления
                      </p>
                      <p className="text-xs text-stone-500">
                        Если выключить, журнал останется локальным без отправки owner-оповещений.
                      </p>
                    </div>
                    <Switch
                      checked={criticalNotificationSettings.enabled}
                      onCheckedChange={(checked) =>
                        setCriticalNotificationSettings((current) => ({
                          ...current,
                          enabled: checked,
                        }))
                      }
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
                          onCheckedChange={(checked) =>
                            setCriticalNotificationSettings((current) => ({
                              ...current,
                              notifyOnDelete: checked,
                            }))
                          }
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
                          onCheckedChange={(checked) =>
                            setCriticalNotificationSettings((current) => ({
                              ...current,
                              notifyOnBulk: checked,
                            }))
                          }
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
                          onCheckedChange={(checked) =>
                            setCriticalNotificationSettings((current) => ({
                              ...current,
                              notifyOnPreset: checked,
                            }))
                          }
                          disabled={!criticalNotificationSettings.enabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-dashed border-amber-200 bg-white px-4 py-4">
                  <Label htmlFor="critical-bulk-threshold" className="text-sm font-medium text-stone-900">
                    Порог для массовых действий
                  </Label>
                  <Input
                    id="critical-bulk-threshold"
                    type="number"
                    min={1}
                    value={criticalNotificationSettings.minBulkCount}
                    onChange={(event) => {
                      const nextValue = Math.max(1, Number(event.target.value) || 1);
                      setCriticalNotificationSettings((current) => ({
                        ...current,
                        minBulkCount: nextValue,
                      }));
                    }}
                    disabled={
                      !criticalNotificationSettings.enabled ||
                      !criticalNotificationSettings.notifyOnBulk
                    }
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
                    <CardTitle className="text-base text-stone-950">
                      История критических уведомлений
                    </CardTitle>
                    <CardDescription className="text-stone-600">
                      Последние owner-уведомления по рискованным действиям: видно severity, статус доставки и связь с операцией журнала.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700"
                    >
                      Всего: {criticalNotificationHistory.length}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800"
                    >
                      Доставлено: {deliveredCriticalCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-800"
                    >
                      Сбой: {failedCriticalCount}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {criticalNotificationHistory.length ? (
                  <ScrollRemaining totalItems={criticalNotificationHistory.length} itemHeight={120} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {criticalNotificationHistory.map((entry) => {
                      const statusBadge = getCriticalNotificationStatusCopy(entry);

                      return (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-stone-950">{entry.title}</p>
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-600"
                                >
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
                                {typeof entry.affectedCount === "number" ? (
                                  <span>Затронуто: {entry.affectedCount}</span>
                                ) : null}
                              </div>
                              <p className="text-xs leading-5 text-stone-500">Причина: {entry.reason}</p>
                            </div>
                            <span className="text-xs text-stone-500">
                              {new Date(entry.timestamp).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </ScrollRemaining>
                ) : (
                  <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                    Пока критические уведомления не отправлялись. Как только администратор выполнит рискованное действие, здесь появится запись со статусом доставки.
                  </div>
                )}
              </CardContent>
            </Card>

            {filteredActionLog.length ? (
              <ScrollRemaining totalItems={filteredActionLog.length} itemHeight={80} className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {groupedActionLog.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-2">
                      <p className="text-sm font-semibold text-stone-900">{group.dateLabel}</p>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span className="rounded-full bg-white px-2.5 py-1 text-stone-600">
                          {group.hourLabel}
                        </span>
                        <span>
                          {group.entries.length} {group.entries.length === 1 ? "запись" : group.entries.length < 5 ? "записи" : "записей"}
                        </span>
                      </div>
                    </div>
                    {group.entries.map((entry) => {
                      const actionTypeBadge = getActionTypeBadgeConfig(entry.actionType);
                      const includedInExport = exportableActionLogIds.has(entry.id);

                      return (
                        <div
                          key={entry.id}
                          className={
                            includedInExport
                              ? "rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]"
                              : "rounded-2xl border border-stone-200 bg-stone-50/70 p-3"
                          }
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-stone-950">{entry.title}</p>
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-600"
                                >
                                  {entry.area === "posts"
                                    ? "Посты"
                                    : entry.area === "events"
                                      ? "События"
                                      : entry.area === "members"
                                        ? "Участники"
                                        : entry.area === "bitrix"
                                          ? "Bitrix24"
                                          : "Журнал"}
                                </Badge>
                                <Badge variant="outline" className={actionTypeBadge.className}>
                                  {actionTypeBadge.label}
                                </Badge>
                                {includedInExport ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-emerald-300 bg-emerald-100/80 px-2.5 py-0.5 text-[11px] text-emerald-800"
                                  >
                                    В экспорте
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-stone-600">{entry.description}</p>
                            </div>
                            <span className="text-xs text-stone-500">
                              {new Date(entry.timestamp).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </ScrollRemaining>
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-200 bg-stone-50/70 px-5 py-8">
                <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 text-left">
                  <div className="rounded-2xl bg-white p-3 text-stone-700 shadow-sm ring-1 ring-stone-200/80">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-stone-950">
                      По текущим фильтрам записи журнала не найдены
                    </p>
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
                      Вернуться к вкладке «
                      {lastEntityTab === "posts"
                        ? "Посты"
                        : lastEntityTab === "events"
                          ? "События"
                          : "Участники"}
                      »
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
