import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { BulkActionConfig, ClubAdminPreset, InlineActionConfig } from "./adminClubShared";
import ScrollRemaining from "@/components/ScrollRemaining";
import { CheckSquare, Pencil, Save, Search, Square, Trash2, X } from "lucide-react";

export function MetricCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
      <div className="flex items-center justify-between text-stone-500">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

export function EntityFormCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Separator />
        {footer}
      </CardContent>
    </Card>
  );
}

export function EntityListCard({
  title,
  description,
  toolbar,
  items,
  renderItem,
  emptyText,
  sortIndicator,
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  title: string;
  description: string;
  toolbar?: ReactNode;
  items: any[];
  renderItem: (item: any) => ReactNode;
  emptyText?: string;
  sortIndicator?: {
    fieldLabel: string;
    directionLabel: string;
  };
  pagination?: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
    startItem: number;
    endItem: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {sortIndicator ? (
            <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Сортировка: по {sortIndicator.fieldLabel} {sortIndicator.directionLabel}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {toolbar}
        <ScrollRemaining totalItems={items.length} itemHeight={80} className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {items.length ? items.map((item) => <div key={item.id}>{renderItem(item)}</div>) : <p className="text-sm text-stone-500">{emptyText ?? "Пока нет записей."}</p>}
        </ScrollRemaining>
        {pagination && onPageChange && onPageSizeChange ? (
          <PaginationToolbar
            totalItems={pagination.totalItems}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            startItem={pagination.startItem}
            endItem={pagination.endItem}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export type FilterChip = {
  label: string;
  onRemove: () => void;
};

export function buildPaginationMeta(totalItems: number, page: number, pageSize: number, totalPages: number) {
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

export function PaginationToolbar({
  totalItems,
  page,
  pageSize,
  totalPages,
  startItem,
  endItem,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-stone-900">
          Показаны записи {startItem}-{endItem} из {totalItems}
        </p>
        <p className="text-xs text-stone-500">
          Страница {page} из {totalPages}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-stone-600">На странице</Label>
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="flex h-9 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            Назад
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            Вперёд
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FilterToolbar({
  searchPlaceholder,
  searchValue,
  resultCount,
  resultLabel,
  resetLabel,
  activeFilterChips,
  presetPanel,
  onSearchChange,
  onReset,
  hasActiveFilters,
  selectionCount,
  bulkActions,
  onClearSelection,
  children,
}: {
  searchPlaceholder: string;
  searchValue: string;
  resultCount: number;
  resultLabel: string;
  resetLabel: string;
  activeFilterChips?: FilterChip[];
  presetPanel?: ReactNode;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  selectionCount?: number;
  bulkActions?: BulkActionConfig[];
  onClearSelection?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Поиск</Label>
            <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600">
              Найдено: {resultCount} {resultLabel}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input className="pl-9" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} />
          </div>
        </div>
        <Button variant="outline" onClick={onReset} disabled={!hasActiveFilters}>
          <X className="mr-2 h-4 w-4" />{resetLabel}
        </Button>
      </div>
      {selectionCount ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-950">Выбрано записей: {selectionCount}</p>
              <p className="text-xs text-amber-800">Массовые действия применяются только к текущим выбранным позициям.</p>
            </div>
            {onClearSelection ? (
              <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
                <X className="mr-2 h-4 w-4" />Очистить выбор
              </Button>
            ) : null}
          </div>
          {bulkActions?.length ? (
            <div className="flex flex-wrap gap-2">
              {bulkActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? "outline"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={action.destructive ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" : undefined}
                >
                  {action.icon ? <span className="mr-2">{action.icon}</span> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {presetPanel}
      {activeFilterChips?.length ? (
        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
              aria-label={`Убрать фильтр ${chip.label}`}
              title="Нажмите, чтобы убрать этот фильтр"
            >
              <span>{chip.label}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      ) : null}
      {children ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div> : null}
    </div>
  );
}

export function PresetToolbar({
  presetName,
  onPresetNameChange,
  onSave,
  saveDisabled,
  presets,
  onApplyPreset,
  onDeletePreset,
  deletePending,
}: {
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSave: () => void;
  saveDisabled: boolean;
  presets: ClubAdminPreset[];
  onApplyPreset: (preset: ClubAdminPreset) => void;
  onDeletePreset: (presetId: number) => void;
  deletePending: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-amber-200 bg-white/80 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-2">
          <Label>Сохранить текущий набор</Label>
          <Input
            value={presetName}
            onChange={(e) => onPresetNameChange(e.target.value)}
            placeholder="Например: Публикации для витрины"
          />
        </div>
        <Button type="button" onClick={onSave} disabled={saveDisabled} className="lg:self-end">
          <Save className="mr-2 h-4 w-4" />Сохранить пресет
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Сохранённые пресеты</Label>
          <span className="text-xs text-stone-500">{presets.length} шт.</span>
        </div>
        {presets.length ? (
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1">
                <button
                  type="button"
                  onClick={() => onApplyPreset(preset)}
                  className="text-xs font-medium text-stone-800 transition-colors hover:text-stone-950"
                  title="Применить пресет"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  disabled={deletePending}
                  className="rounded-full p-0.5 text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                  aria-label={`Удалить пресет ${preset.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">Пока нет сохранённых пресетов для этой вкладки.</p>
        )}
      </div>
    </div>
  );
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  badge,
  hidden,
  selected,
  onToggleSelected,
  inlineActions,
  onEdit,
  onDelete,
  deleting,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  hidden?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  inlineActions?: InlineActionConfig[];
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${selected ? "border-amber-300 bg-amber-50/50" : "border-stone-200"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {onToggleSelected ? (
            <button
              type="button"
              onClick={onToggleSelected}
              className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${selected ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300 bg-white text-stone-400 hover:border-stone-400"}`}
              aria-pressed={selected}
              aria-label={selected ? `Снять выбор с ${title}` : `Выбрать ${title}`}
            >
              {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-stone-950">{title}</p>
              {badge ? <Badge variant="secondary">{badge}</Badge> : null}
              {hidden ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Скрыт</Badge> : null}
            </div>
            <p className="text-sm text-stone-600">{subtitle}</p>
            <p className="text-xs text-stone-500">{meta}</p>
            {inlineActions?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {inlineActions.map((action) => (
                  <Button
                    key={`${action.label}-${String(action.value ?? "")}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="h-8 rounded-full border-stone-300 bg-white px-3 text-xs text-stone-700 hover:bg-stone-50"
                  >
                    {action.icon ? <span className="mr-1.5">{action.icon}</span> : null}
                    <span>{action.label}</span>
                    {action.value !== undefined ? <span className="ml-1 font-medium text-stone-950">{action.value}</span> : null}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" size="sm" onClick={onEdit} className="w-full justify-center sm:min-w-[132px] sm:w-[132px]">
            <Pencil className="mr-2 h-4 w-4" />Править
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} disabled={deleting} className="w-full justify-center sm:min-w-[132px] sm:w-[132px]">
            <Trash2 className="mr-2 h-4 w-4" />{deleting ? "Удаление..." : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
