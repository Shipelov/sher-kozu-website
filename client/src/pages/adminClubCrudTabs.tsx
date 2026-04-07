import { ArrowDown, CalendarRange, CheckSquare, Crown, Pin, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultEventFilters,
  defaultMemberFilters,
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
} from "./adminClubShared";
import {
  EntityFormCard,
  EntityListCard,
  Field,
  FilterToolbar,
  ListRow,
  PresetToolbar,
  SelectFilter,
  type FilterChip,
} from "./adminClubUi";
import type { AdminActionLogEntry, AdminActionType, AdminTabValue } from "@/lib/adminClubActivity";

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
};

type InlineAction = {
  label: string;
  value?: string | number;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
};

type BulkAction = {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "outline";
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

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
  hidden: boolean;
};

type EventItem = {
  id: number;
  title: string;
  dateLabel: string;
  description: string;
  status: string;
  tone: string;
  sortOrder: number;
  hidden: boolean;
};

type MemberItem = {
  id: number;
  name: string;
  animal: string;
  sinceLabel: string;
  badge: string;
  sortOrder: number;
  hidden: boolean;
};

type PostsListRow = {
  id: number;
  selected: boolean;
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  hidden?: boolean;
  inlineActions: InlineAction[];
  onToggleSelected: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
};

type EventsListRow = {
  id: number;
  selected: boolean;
  title: string;
  subtitle: string;
  meta: string;
  hidden?: boolean;
  inlineActions: InlineAction[];
  onToggleSelected: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
};

type MembersListRow = {
  id: number;
  selected: boolean;
  title: string;
  subtitle: string;
  meta: string;
  hidden?: boolean;
  inlineActions: InlineAction[];
  onToggleSelected: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
};

type SharedPresetNameState = Record<"posts" | "events" | "members", string>;
type SharedSelectedIdsState = { posts: number[]; events: number[]; members: number[] };

type PostsTabFormProps = {
  postForm: PostFormState;
  postErrors: FormErrors<PostFormField>;
  onPostFormChange: (next: PostFormState) => void;
  onPostFieldErrorClear: (field: PostFormField) => void;
  onSubmit: () => void;
  onResetForm: () => void;
  submitDisabled: boolean;
};

type PostsTabListProps = {
  sortIndicator: { fieldLabel: string; directionLabel: string };
  searchValue: string;
  resultCount: number;
  activeFilters: FilterChip[];
  selectedCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
  bulkActions: BulkAction[];
  onClearSelection: () => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  savePresetDisabled: boolean;
  presets: ClubAdminPreset[];
  onApplyPreset: (preset: ClubAdminPreset) => void;
  onDeletePreset: (presetId: number) => void;
  deletePresetPending: boolean;
  categoryValue: string;
  categoryOptions: Array<{ label: string; value: string }>;
  onCategoryChange: (value: string) => void;
  pinnedValue: PostFilterState["pinned"];
  onPinnedChange: (value: PostFilterState["pinned"]) => void;
  visibilityValue: string;
  onVisibilityChange: (value: string) => void;
  sortByValue: PostSortField;
  onSortByChange: (value: PostSortField) => void;
  sortDirectionValue: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
  items: PostsListRow[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

type EventsTabFormProps = {
  eventForm: EventFormState;
  eventErrors: FormErrors<EventFormField>;
  onEventFormChange: (next: EventFormState) => void;
  onEventFieldErrorClear: (field: EventFormField) => void;
  onSubmit: () => void;
  onResetForm: () => void;
  submitDisabled: boolean;
};

type EventsTabListProps = {
  sortIndicator: { fieldLabel: string; directionLabel: string };
  searchValue: string;
  resultCount: number;
  activeFilters: FilterChip[];
  selectedCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
  bulkActions: BulkAction[];
  onClearSelection: () => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  savePresetDisabled: boolean;
  presets: ClubAdminPreset[];
  onApplyPreset: (preset: ClubAdminPreset) => void;
  onDeletePreset: (presetId: number) => void;
  deletePresetPending: boolean;
  statusValue: string;
  statusOptions: Array<{ label: string; value: string }>;
  onStatusChange: (value: string) => void;
  toneValue: string;
  toneOptions: Array<{ label: string; value: string }>;
  onToneChange: (value: string) => void;
  visibilityValue: string;
  onVisibilityChange: (value: string) => void;
  sortByValue: EventSortField;
  onSortByChange: (value: EventSortField) => void;
  sortDirectionValue: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
  items: EventsListRow[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

type MembersTabFormProps = {
  memberForm: MemberFormState;
  memberErrors: FormErrors<MemberFormField>;
  onMemberFormChange: (next: MemberFormState) => void;
  onMemberFieldErrorClear: (field: MemberFormField) => void;
  onSubmit: () => void;
  onResetForm: () => void;
  submitDisabled: boolean;
};

type MembersTabListProps = {
  sortIndicator: { fieldLabel: string; directionLabel: string };
  searchValue: string;
  resultCount: number;
  activeFilters: FilterChip[];
  selectedCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
  bulkActions: BulkAction[];
  onClearSelection: () => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  savePresetDisabled: boolean;
  presets: ClubAdminPreset[];
  onApplyPreset: (preset: ClubAdminPreset) => void;
  onDeletePreset: (presetId: number) => void;
  deletePresetPending: boolean;
  badgeValue: string;
  badgeOptions: Array<{ label: string; value: string }>;
  onBadgeChange: (value: string) => void;
  visibilityValue: string;
  onVisibilityChange: (value: string) => void;
  sortByValue: MemberSortField;
  onSortByChange: (value: MemberSortField) => void;
  sortDirectionValue: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
  items: MembersListRow[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export type AdminClubPostsTabContentProps = PostsTabFormProps & PostsTabListProps;
export type AdminClubEventsTabContentProps = EventsTabFormProps & EventsTabListProps;
export type AdminClubMembersTabContentProps = MembersTabFormProps & MembersTabListProps;

export function AdminClubPostsTabContent({
  postForm,
  postErrors,
  onPostFormChange,
  onPostFieldErrorClear,
  onSubmit,
  onResetForm,
  submitDisabled,
  sortIndicator,
  searchValue,
  resultCount,
  activeFilters,
  selectedCount,
  hasActiveFilters,
  onSearchChange,
  onResetFilters,
  bulkActions,
  onClearSelection,
  presetName,
  onPresetNameChange,
  onSavePreset,
  savePresetDisabled,
  presets,
  onApplyPreset,
  onDeletePreset,
  deletePresetPending,
  categoryValue,
  categoryOptions,
  onCategoryChange,
  pinnedValue,
  onPinnedChange,
  visibilityValue,
  onVisibilityChange,
  sortByValue,
  onSortByChange,
  sortDirectionValue,
  onSortDirectionChange,
  items,
  pagination,
  onPageChange,
  onPageSizeChange,
}: AdminClubPostsTabContentProps) {
  return (
    <>
      <EntityFormCard
        title={postForm.id ? "Редактировать пост" : "Новый пост"}
        description="Заполняйте только основные поля. Изменения сразу попадут в club feed после сохранения."
        footer={<div className="flex flex-wrap gap-3"><Button onClick={onSubmit} disabled={submitDisabled}>{postForm.id ? "Сохранить пост" : "Создать пост"}</Button><Button variant="outline" onClick={onResetForm}>Очистить</Button></div>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Категория" error={postErrors.category}><Input aria-invalid={Boolean(postErrors.category)} value={postForm.category} onChange={(e) => { onPostFormChange({ ...postForm, category: e.target.value }); if (postErrors.category) onPostFieldErrorClear("category"); }} /></Field>
          <Field label="Автор" error={postErrors.author}><Input aria-invalid={Boolean(postErrors.author)} value={postForm.author} onChange={(e) => { onPostFormChange({ ...postForm, author: e.target.value }); if (postErrors.author) onPostFieldErrorClear("author"); }} /></Field>
          <Field label="Аватар"><Input value={postForm.avatar} onChange={(e) => onPostFormChange({ ...postForm, avatar: e.target.value.slice(0, 8) })} /></Field>
          <Field label="Роль автора" error={postErrors.role}><Input aria-invalid={Boolean(postErrors.role)} value={postForm.role} onChange={(e) => { onPostFormChange({ ...postForm, role: e.target.value }); if (postErrors.role) onPostFieldErrorClear("role"); }} /></Field>
          <Field label="Время" error={postErrors.timeLabel}><Input aria-invalid={Boolean(postErrors.timeLabel)} value={postForm.timeLabel} onChange={(e) => { onPostFormChange({ ...postForm, timeLabel: e.target.value }); if (postErrors.timeLabel) onPostFieldErrorClear("timeLabel"); }} /></Field>
          <Field label="Порядок"><Input type="number" value={postForm.sortOrder} onChange={(e) => onPostFormChange({ ...postForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
          <Field label="Лайки"><Input type="number" value={postForm.likes} onChange={(e) => onPostFormChange({ ...postForm, likes: Number(e.target.value) || 0 })} /></Field>
          <Field label="Комментарии"><Input type="number" value={postForm.comments} onChange={(e) => onPostFormChange({ ...postForm, comments: Number(e.target.value) || 0 })} /></Field>
        </div>
        <Field label="Заголовок" error={postErrors.title}><Input aria-invalid={Boolean(postErrors.title)} value={postForm.title} onChange={(e) => { onPostFormChange({ ...postForm, title: e.target.value }); if (postErrors.title) onPostFieldErrorClear("title"); }} /></Field>
        <Field label="Изображение (URL)"><Input value={postForm.imageUrl} onChange={(e) => onPostFormChange({ ...postForm, imageUrl: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Теги CSV"><Input value={postForm.tagsCsv} onChange={(e) => onPostFormChange({ ...postForm, tagsCsv: e.target.value })} placeholder="утро,марта,клуб" /></Field>
        <Field label="Текст поста" error={postErrors.text}><Textarea aria-invalid={Boolean(postErrors.text)} value={postForm.text} onChange={(e) => { onPostFormChange({ ...postForm, text: e.target.value }); if (postErrors.text) onPostFieldErrorClear("text"); }} className="min-h-32" /></Field>
        <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3"><div><p className="font-medium text-stone-950">Закрепить пост</p><p className="text-sm text-stone-500">Закреплённые посты поднимаются вверх в ленте.</p></div><Switch checked={postForm.pinned} onCheckedChange={(checked) => onPostFormChange({ ...postForm, pinned: checked })} /></div>
        <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/30 px-4 py-3"><div><p className="font-medium text-stone-950">Скрыть пост</p><p className="text-sm text-stone-500">Скрытые посты не отображаются в публичной ленте.</p></div><Switch checked={postForm.hidden} onCheckedChange={(checked) => onPostFormChange({ ...postForm, hidden: checked })} /></div>
      </EntityFormCard>
      <EntityListCard title="Текущие посты" description="Быстрое редактирование, удаление, поиск и фильтрация материалов клуба." sortIndicator={sortIndicator} toolbar={<FilterToolbar searchPlaceholder="Искать по заголовку, тексту, автору или тегам" selectionCount={selectedCount} bulkActions={bulkActions} onClearSelection={onClearSelection} presetPanel={<PresetToolbar presetName={presetName} onPresetNameChange={onPresetNameChange} onSave={onSavePreset} saveDisabled={savePresetDisabled} presets={presets} onApplyPreset={onApplyPreset} onDeletePreset={onDeletePreset} deletePending={deletePresetPending} />} searchValue={searchValue} resultCount={resultCount} resultLabel="постов" resetLabel="Сбросить фильтры постов" activeFilterChips={activeFilters} onSearchChange={onSearchChange} onReset={onResetFilters} hasActiveFilters={hasActiveFilters}><SelectFilter label="Категория" value={categoryValue} onChange={onCategoryChange} options={categoryOptions} /><SelectFilter label="Тип" value={pinnedValue} onChange={(value) => onPinnedChange(value as PostFilterState["pinned"])} options={[{ label: "Все посты", value: "all" }, { label: "Только pinned", value: "pinned" }, { label: "Только обычные", value: "regular" }]} /><SelectFilter label="Видимость" value={visibilityValue} onChange={onVisibilityChange} options={[{ label: "Все", value: "all" }, { label: "Только видимые", value: "visible" }, { label: "Только скрытые", value: "hidden" }]} /><SelectFilter label="Сортировать по" value={sortByValue} onChange={(value) => onSortByChange(value as PostSortField)} options={[{ label: "Порядок", value: "sortOrder" }, { label: "Время", value: "timeLabel" }, { label: "Заголовок", value: "title" }]} /><SelectFilter label="Направление" value={sortDirectionValue} onChange={(value) => onSortDirectionChange(value as SortDirection)} options={[{ label: "По возрастанию", value: "asc" }, { label: "По убыванию", value: "desc" }]} /></FilterToolbar>} items={items} pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} emptyText="По текущим фильтрам посты не найдены." renderItem={(item: PostsListRow) => <ListRow selected={item.selected} onToggleSelected={item.onToggleSelected} title={item.title} subtitle={item.subtitle} meta={item.meta} badge={item.badge} hidden={item.hidden} inlineActions={item.inlineActions} onEdit={item.onEdit} onDelete={item.onDelete} deleting={item.deleting} />} />
    </>
  );
}

export function AdminClubEventsTabContent({
  eventForm,
  eventErrors,
  onEventFormChange,
  onEventFieldErrorClear,
  onSubmit,
  onResetForm,
  submitDisabled,
  sortIndicator,
  searchValue,
  resultCount,
  activeFilters,
  selectedCount,
  hasActiveFilters,
  onSearchChange,
  onResetFilters,
  bulkActions,
  onClearSelection,
  presetName,
  onPresetNameChange,
  onSavePreset,
  savePresetDisabled,
  presets,
  onApplyPreset,
  onDeletePreset,
  deletePresetPending,
  statusValue,
  statusOptions,
  onStatusChange,
  toneValue,
  toneOptions,
  onToneChange,
  visibilityValue,
  onVisibilityChange,
  sortByValue,
  onSortByChange,
  sortDirectionValue,
  onSortDirectionChange,
  items,
  pagination,
  onPageChange,
  onPageSizeChange,
}: AdminClubEventsTabContentProps) {
  return (
    <>
      <EntityFormCard title={eventForm.id ? "Редактировать событие" : "Новое событие"} description="Используйте короткие формулировки, чтобы карточки легко читались в Club Feed." footer={<div className="flex flex-wrap gap-3"><Button onClick={onSubmit} disabled={submitDisabled}>{eventForm.id ? "Сохранить событие" : "Создать событие"}</Button><Button variant="outline" onClick={onResetForm}>Очистить</Button></div>}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название" error={eventErrors.title}><Input aria-invalid={Boolean(eventErrors.title)} value={eventForm.title} onChange={(e) => { onEventFormChange({ ...eventForm, title: e.target.value }); if (eventErrors.title) onEventFieldErrorClear("title"); }} /></Field>
          <Field label="Дата" error={eventErrors.dateLabel}><Input aria-invalid={Boolean(eventErrors.dateLabel)} value={eventForm.dateLabel} onChange={(e) => { onEventFormChange({ ...eventForm, dateLabel: e.target.value }); if (eventErrors.dateLabel) onEventFieldErrorClear("dateLabel"); }} /></Field>
          <Field label="Статус" error={eventErrors.status}><Input aria-invalid={Boolean(eventErrors.status)} value={eventForm.status} onChange={(e) => { onEventFormChange({ ...eventForm, status: e.target.value }); if (eventErrors.status) onEventFieldErrorClear("status"); }} /></Field>
          <Field label="Тон" error={eventErrors.tone}><Input aria-invalid={Boolean(eventErrors.tone)} value={eventForm.tone} onChange={(e) => { onEventFormChange({ ...eventForm, tone: e.target.value }); if (eventErrors.tone) onEventFieldErrorClear("tone"); }} /></Field>
          <Field label="Порядок"><Input type="number" value={eventForm.sortOrder} onChange={(e) => onEventFormChange({ ...eventForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
        </div>
        <Field label="Описание" error={eventErrors.description}><Textarea aria-invalid={Boolean(eventErrors.description)} value={eventForm.description} onChange={(e) => { onEventFormChange({ ...eventForm, description: e.target.value }); if (eventErrors.description) onEventFieldErrorClear("description"); }} className="min-h-32" /></Field>
        <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/30 px-4 py-3"><div><p className="font-medium text-stone-950">Скрыть событие</p><p className="text-sm text-stone-500">Скрытые события не отображаются в публичной ленте.</p></div><Switch checked={eventForm.hidden} onCheckedChange={(checked) => onEventFormChange({ ...eventForm, hidden: checked })} /></div>
      </EntityFormCard>
      <EntityListCard title="События клуба" description="Редактируйте даты, статусы и тексты, а также быстро находите нужные записи." sortIndicator={sortIndicator} toolbar={<FilterToolbar searchPlaceholder="Искать по названию, описанию или дате" selectionCount={selectedCount} bulkActions={bulkActions} onClearSelection={onClearSelection} presetPanel={<PresetToolbar presetName={presetName} onPresetNameChange={onPresetNameChange} onSave={onSavePreset} saveDisabled={savePresetDisabled} presets={presets} onApplyPreset={onApplyPreset} onDeletePreset={onDeletePreset} deletePending={deletePresetPending} />} searchValue={searchValue} resultCount={resultCount} resultLabel="событий" resetLabel="Сбросить фильтры событий" activeFilterChips={activeFilters} onSearchChange={onSearchChange} onReset={onResetFilters} hasActiveFilters={hasActiveFilters}><SelectFilter label="Статус" value={statusValue} onChange={onStatusChange} options={statusOptions} /><SelectFilter label="Тон" value={toneValue} onChange={onToneChange} options={toneOptions} /><SelectFilter label="Видимость" value={visibilityValue} onChange={onVisibilityChange} options={[{ label: "Все", value: "all" }, { label: "Только видимые", value: "visible" }, { label: "Только скрытые", value: "hidden" }]} /><SelectFilter label="Сортировать по" value={sortByValue} onChange={(value) => onSortByChange(value as EventSortField)} options={[{ label: "Порядок", value: "sortOrder" }, { label: "Дату", value: "dateLabel" }, { label: "Статус", value: "status" }]} /><SelectFilter label="Направление" value={sortDirectionValue} onChange={(value) => onSortDirectionChange(value as SortDirection)} options={[{ label: "По возрастанию", value: "asc" }, { label: "По убыванию", value: "desc" }]} /></FilterToolbar>} items={items} pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} emptyText="По текущим фильтрам события не найдены." renderItem={(item: EventsListRow) => <ListRow selected={item.selected} onToggleSelected={item.onToggleSelected} title={item.title} subtitle={item.subtitle} meta={item.meta} hidden={item.hidden} inlineActions={item.inlineActions} onEdit={item.onEdit} onDelete={item.onDelete} deleting={item.deleting} />} />
    </>
  );
}

export function AdminClubMembersTabContent({
  memberForm,
  memberErrors,
  onMemberFormChange,
  onMemberFieldErrorClear,
  onSubmit,
  onResetForm,
  submitDisabled,
  sortIndicator,
  searchValue,
  resultCount,
  activeFilters,
  selectedCount,
  hasActiveFilters,
  onSearchChange,
  onResetFilters,
  bulkActions,
  onClearSelection,
  presetName,
  onPresetNameChange,
  onSavePreset,
  savePresetDisabled,
  presets,
  onApplyPreset,
  onDeletePreset,
  deletePresetPending,
  badgeValue,
  badgeOptions,
  onBadgeChange,
  visibilityValue,
  onVisibilityChange,
  sortByValue,
  onSortByChange,
  sortDirectionValue,
  onSortDirectionChange,
  items,
  pagination,
  onPageChange,
  onPageSizeChange,
}: AdminClubMembersTabContentProps) {
  return (
    <>
      <EntityFormCard title={memberForm.id ? "Редактировать участника" : "Новый участник"} description="Поддерживайте клубный список актуальным и аккуратно отсортированным." footer={<div className="flex flex-wrap gap-3"><Button onClick={onSubmit} disabled={submitDisabled}>{memberForm.id ? "Сохранить участника" : "Добавить участника"}</Button><Button variant="outline" onClick={onResetForm}>Очистить</Button></div>}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Имя" error={memberErrors.name}><Input aria-invalid={Boolean(memberErrors.name)} value={memberForm.name} onChange={(e) => { onMemberFormChange({ ...memberForm, name: e.target.value }); if (memberErrors.name) onMemberFieldErrorClear("name"); }} /></Field>
          <Field label="Животное" error={memberErrors.animal}><Input aria-invalid={Boolean(memberErrors.animal)} value={memberForm.animal} onChange={(e) => { onMemberFormChange({ ...memberForm, animal: e.target.value }); if (memberErrors.animal) onMemberFieldErrorClear("animal"); }} /></Field>
          <Field label="С нами с" error={memberErrors.sinceLabel}><Input aria-invalid={Boolean(memberErrors.sinceLabel)} value={memberForm.sinceLabel} onChange={(e) => { onMemberFormChange({ ...memberForm, sinceLabel: e.target.value }); if (memberErrors.sinceLabel) onMemberFieldErrorClear("sinceLabel"); }} /></Field>
          <Field label="Бейдж"><Input value={memberForm.badge} onChange={(e) => onMemberFormChange({ ...memberForm, badge: e.target.value })} /></Field>
          <Field label="Порядок"><Input type="number" value={memberForm.sortOrder} onChange={(e) => onMemberFormChange({ ...memberForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/30 px-4 py-3"><div><p className="font-medium text-stone-950">Скрыть участника</p><p className="text-sm text-stone-500">Скрытые участники не отображаются в публичной ленте.</p></div><Switch checked={memberForm.hidden} onCheckedChange={(checked) => onMemberFormChange({ ...memberForm, hidden: checked })} /></div>
      </EntityFormCard>
      <EntityListCard title="Участники клуба" description="Ищите по имени, животному или бейджу и быстро поддерживайте состав сообщества в порядке." sortIndicator={sortIndicator} toolbar={<FilterToolbar searchPlaceholder="Искать по имени, животному или периоду участия" selectionCount={selectedCount} bulkActions={bulkActions} onClearSelection={onClearSelection} presetPanel={<PresetToolbar presetName={presetName} onPresetNameChange={onPresetNameChange} onSave={onSavePreset} saveDisabled={savePresetDisabled} presets={presets} onApplyPreset={onApplyPreset} onDeletePreset={onDeletePreset} deletePending={deletePresetPending} />} searchValue={searchValue} resultCount={resultCount} resultLabel="участников" resetLabel="Сбросить фильтры участников" activeFilterChips={activeFilters} onSearchChange={onSearchChange} onReset={onResetFilters} hasActiveFilters={hasActiveFilters}><SelectFilter label="Бейдж" value={badgeValue} onChange={onBadgeChange} options={badgeOptions} /><SelectFilter label="Видимость" value={visibilityValue} onChange={onVisibilityChange} options={[{ label: "Все", value: "all" }, { label: "Только видимые", value: "visible" }, { label: "Только скрытые", value: "hidden" }]} /><SelectFilter label="Сортировать по" value={sortByValue} onChange={(value) => onSortByChange(value as MemberSortField)} options={[{ label: "Порядок", value: "sortOrder" }, { label: "Имени", value: "name" }, { label: "Бейджу", value: "badge" }]} /><SelectFilter label="Направление" value={sortDirectionValue} onChange={(value) => onSortDirectionChange(value as SortDirection)} options={[{ label: "По возрастанию", value: "asc" }, { label: "По убыванию", value: "desc" }]} /></FilterToolbar>} items={items} pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} emptyText="По текущим фильтрам участники не найдены." renderItem={(item: MembersListRow) => <ListRow selected={item.selected} onToggleSelected={item.onToggleSelected} title={item.title} subtitle={item.subtitle} meta={item.meta} hidden={item.hidden} inlineActions={item.inlineActions} onEdit={item.onEdit} onDelete={item.onDelete} deleting={item.deleting} />} />
    </>
  );
}

export type AdminClubPostsTabContainerProps = {
  postForm: PostFormState;
  postErrors: FormErrors<PostFormField>;
  setPostForm: React.Dispatch<React.SetStateAction<PostFormState>>;
  setPostErrors: React.Dispatch<React.SetStateAction<FormErrors<PostFormField>>>;
  handlePostSubmit: () => void;
  createPostPending: boolean;
  updatePostPending: boolean;
  postFilters: PostFilterState;
  setPostFilters: React.Dispatch<React.SetStateAction<PostFilterState>>;
  selectedPosts: PostItem[];
  allVisiblePostsSelected: boolean;
  filteredPosts: PostItem[];
  toggleSelectAllVisible: (tab: "posts", ids: number[]) => void;
  clearSelection: (tab: "posts") => void;
  selectedIds: Pick<SharedSelectedIdsState, "posts">;
  toggleSelection: (tab: "posts", id: number) => void;
  presetName: SharedPresetNameState;
  setPresetName: React.Dispatch<React.SetStateAction<SharedPresetNameState>>;
  handleSavePreset: (tab: "posts") => Promise<void>;
  createPresetPending: boolean;
  presetsByTab: { posts: ClubAdminPreset[] };
  applyPreset: (preset: ClubAdminPreset) => void;
  deletePreset: { mutateAsync: (args: { id: number }) => Promise<unknown>; isPending: boolean };
  postCategories: string[];
  paginatedPosts: PostItem[];
  paginationMeta: PaginationMeta;
  setTabPage: (tab: "posts", page: number) => void;
  setTabPageSize: (tab: "posts", pageSize: number) => void;
  isDeleting: boolean;
  setPendingDelete: React.Dispatch<React.SetStateAction<any>>;
  buildBulkDeleteSummaryItems: (items: Array<{ title?: string; name?: string }>) => string[];
  getBulkActionToastCopy: (entity: "post", action: "pin" | "unpin", count: number) => { title: string; description: string };
  getInlineActionToastCopy: (entity: "post", payload: { title: string; sortOrder: number; pinned: boolean }) => { sortOrder: { title: string; description: string }; status: { title: string; description: string } };
  updatePost: { mutateAsync: (input: PostItem) => Promise<unknown>; isPending: boolean };
  toast: { success: (title: string, options?: { description?: string }) => void };
  pendingDelete: any;
};

export type AdminClubEventsTabContainerProps = {
  eventForm: EventFormState;
  eventErrors: FormErrors<EventFormField>;
  setEventForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  setEventErrors: React.Dispatch<React.SetStateAction<FormErrors<EventFormField>>>;
  handleEventSubmit: () => void;
  createEventPending: boolean;
  updateEventPending: boolean;
  eventFilters: EventFilterState;
  setEventFilters: React.Dispatch<React.SetStateAction<EventFilterState>>;
  selectedEvents: EventItem[];
  allVisibleEventsSelected: boolean;
  filteredEvents: EventItem[];
  toggleSelectAllVisible: (tab: "events", ids: number[]) => void;
  clearSelection: (tab: "events") => void;
  selectedIds: Pick<SharedSelectedIdsState, "events">;
  toggleSelection: (tab: "events", id: number) => void;
  presetName: SharedPresetNameState;
  setPresetName: React.Dispatch<React.SetStateAction<SharedPresetNameState>>;
  handleSavePreset: (tab: "events") => Promise<void>;
  createPresetPending: boolean;
  presetsByTab: { events: ClubAdminPreset[] };
  applyPreset: (preset: ClubAdminPreset) => void;
  deletePreset: { mutateAsync: (args: { id: number }) => Promise<unknown>; isPending: boolean };
  eventStatuses: string[];
  eventTones: string[];
  paginatedEvents: EventItem[];
  paginationMeta: PaginationMeta;
  setTabPage: (tab: "events", page: number) => void;
  setTabPageSize: (tab: "events", pageSize: number) => void;
  isDeleting: boolean;
  setPendingDelete: React.Dispatch<React.SetStateAction<any>>;
  buildBulkDeleteSummaryItems: (items: Array<{ title?: string; name?: string }>) => string[];
  getInlineActionToastCopy: (entity: "event", payload: { title: string; sortOrder: number; status: string }) => { sortOrder: { title: string; description: string }; status: { title: string; description: string } };
  updateEvent: { mutateAsync: (input: EventItem) => Promise<unknown>; isPending: boolean };
  toast: { success: (title: string, options?: { description?: string }) => void };
  pendingDelete: any;
  setActionLog: React.Dispatch<React.SetStateAction<AdminActionLogEntry[]>>;
  recordAdminAction: (current: AdminActionLogEntry[], tab: AdminTabValue, type: AdminActionType, title: string, description: string, now?: number) => AdminActionLogEntry[];
};

export type AdminClubMembersTabContainerProps = {
  memberForm: MemberFormState;
  memberErrors: FormErrors<MemberFormField>;
  setMemberForm: React.Dispatch<React.SetStateAction<MemberFormState>>;
  setMemberErrors: React.Dispatch<React.SetStateAction<FormErrors<MemberFormField>>>;
  handleMemberSubmit: () => void;
  createMemberPending: boolean;
  updateMemberPending: boolean;
  memberFilters: MemberFilterState;
  setMemberFilters: React.Dispatch<React.SetStateAction<MemberFilterState>>;
  selectedMembers: MemberItem[];
  allVisibleMembersSelected: boolean;
  filteredMembers: MemberItem[];
  toggleSelectAllVisible: (tab: "members", ids: number[]) => void;
  clearSelection: (tab: "members") => void;
  selectedIds: Pick<SharedSelectedIdsState, "members">;
  toggleSelection: (tab: "members", id: number) => void;
  presetName: SharedPresetNameState;
  setPresetName: React.Dispatch<React.SetStateAction<SharedPresetNameState>>;
  handleSavePreset: (tab: "members") => Promise<void>;
  createPresetPending: boolean;
  presetsByTab: { members: ClubAdminPreset[] };
  applyPreset: (preset: ClubAdminPreset) => void;
  deletePreset: { mutateAsync: (args: { id: number }) => Promise<unknown>; isPending: boolean };
  memberBadges: string[];
  paginatedMembers: MemberItem[];
  paginationMeta: PaginationMeta;
  setTabPage: (tab: "members", page: number) => void;
  setTabPageSize: (tab: "members", pageSize: number) => void;
  isDeleting: boolean;
  setPendingDelete: React.Dispatch<React.SetStateAction<any>>;
  buildBulkDeleteSummaryItems: (items: Array<{ title?: string; name?: string }>) => string[];
  getInlineActionToastCopy: (entity: "member", payload: { name: string; sortOrder: number; badge: string }) => { sortOrder: { title: string; description: string }; status: { title: string; description: string } };
  updateMember: { mutateAsync: (input: MemberItem) => Promise<unknown>; isPending: boolean };
  toast: { success: (title: string, options?: { description?: string }) => void };
  pendingDelete: any;
  setActionLog: React.Dispatch<React.SetStateAction<AdminActionLogEntry[]>>;
  recordAdminAction: (current: AdminActionLogEntry[], tab: AdminTabValue, type: AdminActionType, title: string, description: string, now?: number) => AdminActionLogEntry[];
};

export function buildAdminClubPostsTabProps(props: AdminClubPostsTabContainerProps): AdminClubPostsTabContentProps {
  return {
    postForm: props.postForm,
    postErrors: props.postErrors,
    onPostFormChange: (next) => props.setPostForm(next),
    onPostFieldErrorClear: (field) => props.setPostErrors((current) => ({ ...current, [field]: undefined })),
    onSubmit: props.handlePostSubmit,
    onResetForm: () => { props.setPostForm(defaultPostForm()); props.setPostErrors({}); },
    submitDisabled: props.createPostPending || props.updatePostPending,
    sortIndicator: { fieldLabel: props.postFilters.sortBy === "timeLabel" ? "времени" : props.postFilters.sortBy === "title" ? "заголовку" : "порядку", directionLabel: props.postFilters.sortDirection === "asc" ? "↑" : "↓" },
    searchValue: props.postFilters.query,
    resultCount: props.filteredPosts.length,
    activeFilters: [props.postFilters.query ? { label: `Поиск: ${props.postFilters.query}`, onRemove: () => props.setPostFilters((current) => ({ ...current, query: "" })) } : null, props.postFilters.category !== "all" ? { label: `Категория: ${props.postFilters.category}`, onRemove: () => props.setPostFilters((current) => ({ ...current, category: "all" })) } : null, props.postFilters.pinned === "pinned" ? { label: "Тип: только pinned", onRemove: () => props.setPostFilters((current) => ({ ...current, pinned: "all" })) } : props.postFilters.pinned === "regular" ? { label: "Тип: только обычные", onRemove: () => props.setPostFilters((current) => ({ ...current, pinned: "all" })) } : null, props.postFilters.sortBy !== "sortOrder" ? { label: `Сортировка: ${props.postFilters.sortBy === "timeLabel" ? "время" : "заголовок"}`, onRemove: () => props.setPostFilters((current) => ({ ...current, sortBy: "sortOrder" })) } : null, props.postFilters.sortDirection !== "asc" ? { label: "Порядок: по убыванию", onRemove: () => props.setPostFilters((current) => ({ ...current, sortDirection: "asc" })) } : null].filter(Boolean) as FilterChip[],
    selectedCount: props.selectedPosts.length,
    hasActiveFilters: props.postFilters.query !== "" || props.postFilters.category !== "all" || props.postFilters.pinned !== "all" || props.postFilters.sortBy !== "sortOrder" || props.postFilters.sortDirection !== "asc",
    onSearchChange: (value) => props.setPostFilters((current) => ({ ...current, query: value })),
    onResetFilters: () => props.setPostFilters(defaultPostFilters()),
    bulkActions: [{ label: props.allVisiblePostsSelected ? "Снять выбор со всех" : "Выбрать все видимые", icon: props.allVisiblePostsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />, variant: "outline", disabled: props.filteredPosts.length === 0, onClick: () => props.toggleSelectAllVisible("posts", props.filteredPosts.map((post) => post.id)) }, { label: "Закрепить выбранные", icon: <Pin className="h-4 w-4" />, variant: "outline", disabled: props.selectedPosts.length === 0 || props.updatePost.isPending, onClick: () => { void (async () => { for (const post of props.selectedPosts) await props.updatePost.mutateAsync({ ...post, pinned: true }); props.clearSelection("posts"); const toastCopy = props.getBulkActionToastCopy("post", "pin", props.selectedPosts.length); props.toast.success(toastCopy.title, { description: toastCopy.description }); })(); } }, { label: "Открепить выбранные", icon: <Pin className="h-4 w-4" />, variant: "outline", disabled: props.selectedPosts.length === 0 || props.updatePost.isPending, onClick: () => { void (async () => { for (const post of props.selectedPosts) await props.updatePost.mutateAsync({ ...post, pinned: false }); props.clearSelection("posts"); const toastCopy = props.getBulkActionToastCopy("post", "unpin", props.selectedPosts.length); props.toast.success(toastCopy.title, { description: toastCopy.description }); })(); } }, { label: "Удалить выбранные", icon: <Trash2 className="h-4 w-4" />, variant: "outline", destructive: true, disabled: props.selectedPosts.length === 0 || props.isDeleting, onClick: () => props.setPendingDelete({ entity: "bulk-post", ids: props.selectedPosts.map((post) => post.id), title: `Выбрано постов: ${props.selectedPosts.length}`, description: `${props.selectedPosts.length} постов`, summaryItems: props.buildBulkDeleteSummaryItems(props.selectedPosts), totalCount: props.selectedPosts.length }) }],
    onClearSelection: () => props.clearSelection("posts"),
    presetName: props.presetName.posts,
    onPresetNameChange: (value) => props.setPresetName((current) => ({ ...current, posts: value })),
    onSavePreset: () => { void props.handleSavePreset("posts"); },
    savePresetDisabled: props.createPresetPending,
    presets: props.presetsByTab.posts,
    onApplyPreset: (preset) => props.applyPreset(preset),
    onDeletePreset: (presetId) => { void props.deletePreset.mutateAsync({ id: presetId }); },
    deletePresetPending: props.deletePreset.isPending,
    categoryValue: props.postFilters.category,
    categoryOptions: [{ label: "Все категории", value: "all" }, ...props.postCategories.map((value) => ({ label: value, value }))],
    onCategoryChange: (value) => props.setPostFilters((current) => ({ ...current, category: value })),
    pinnedValue: props.postFilters.pinned,
    onPinnedChange: (value) => props.setPostFilters((current) => ({ ...current, pinned: value })),
    visibilityValue: props.postFilters.visibility,
    onVisibilityChange: (value) => props.setPostFilters((current) => ({ ...current, visibility: value as "all" | "visible" | "hidden" })),
    sortByValue: props.postFilters.sortBy,
    onSortByChange: (value) => props.setPostFilters((current) => ({ ...current, sortBy: value })),
    sortDirectionValue: props.postFilters.sortDirection,
    onSortDirectionChange: (value) => props.setPostFilters((current) => ({ ...current, sortDirection: value })),
    items: props.paginatedPosts.map((post) => ({ id: post.id, selected: props.selectedIds.posts.includes(post.id), title: post.title, subtitle: `${post.author} · ${post.timeLabel}`, meta: `Категория: ${post.category} · Порядок: ${post.sortOrder}`, badge: post.pinned ? "Pinned" : undefined, onToggleSelected: () => props.toggleSelection("posts", post.id), inlineActions: [{ label: "Порядок", value: post.sortOrder, icon: <ArrowDown className="h-3.5 w-3.5" />, disabled: props.updatePost.isPending, onClick: async () => { const nextSortOrder = post.sortOrder + 1; await props.updatePost.mutateAsync({ ...post, sortOrder: nextSortOrder }); const toastCopy = props.getInlineActionToastCopy("post", { title: post.title, sortOrder: nextSortOrder, pinned: post.pinned }); props.toast.success(toastCopy.sortOrder.title, { description: toastCopy.sortOrder.description }); } }, { label: post.pinned ? "Pinned" : "Обычный", icon: <Pin className="h-3.5 w-3.5" />, disabled: props.updatePost.isPending, onClick: async () => { const nextPinned = !post.pinned; await props.updatePost.mutateAsync({ ...post, pinned: nextPinned }); const toastCopy = props.getInlineActionToastCopy("post", { title: post.title, sortOrder: post.sortOrder, pinned: nextPinned }); props.toast.success(toastCopy.status.title, { description: toastCopy.status.description }); } }], onEdit: () => props.setPostForm({ id: post.id, category: post.category, author: post.author, avatar: post.avatar, role: post.role, timeLabel: post.timeLabel, title: post.title, text: post.text, imageUrl: post.imageUrl, likes: post.likes, comments: post.comments, tagsCsv: post.tagsCsv, pinned: Boolean(post.pinned), sortOrder: post.sortOrder, hidden: Boolean(post.hidden) }), onDelete: () => props.setPendingDelete({ entity: "post", id: post.id, title: post.title, description: `пост «${post.title}»` }), deleting: props.isDeleting && props.pendingDelete?.entity === "post" && props.pendingDelete.id === post.id })),
    pagination: props.paginationMeta,
    onPageChange: (page) => props.setTabPage("posts", page),
    onPageSizeChange: (pageSize) => props.setTabPageSize("posts", pageSize),
  };
}

export function buildAdminClubEventsTabProps(props: AdminClubEventsTabContainerProps): AdminClubEventsTabContentProps {
  return {
    eventForm: props.eventForm,
    eventErrors: props.eventErrors,
    onEventFormChange: (next) => props.setEventForm(next),
    onEventFieldErrorClear: (field) => props.setEventErrors((current) => ({ ...current, [field]: undefined })),
    onSubmit: props.handleEventSubmit,
    onResetForm: () => { props.setEventForm({ id: undefined, title: "", dateLabel: "", description: "", status: "", tone: "", sortOrder: 0, hidden: false }); props.setEventErrors({}); },
    submitDisabled: props.createEventPending || props.updateEventPending,
    sortIndicator: { fieldLabel: props.eventFilters.sortBy === "dateLabel" ? "дате" : props.eventFilters.sortBy === "status" ? "статусу" : "порядку", directionLabel: props.eventFilters.sortDirection === "asc" ? "↑" : "↓" },
    searchValue: props.eventFilters.query,
    resultCount: props.filteredEvents.length,
    activeFilters: [props.eventFilters.query ? { label: `Поиск: ${props.eventFilters.query}`, onRemove: () => props.setEventFilters((current) => ({ ...current, query: "" })) } : null, props.eventFilters.status !== "all" ? { label: `Статус: ${props.eventFilters.status}`, onRemove: () => props.setEventFilters((current) => ({ ...current, status: "all" })) } : null, props.eventFilters.tone !== "all" ? { label: `Тон: ${props.eventFilters.tone}`, onRemove: () => props.setEventFilters((current) => ({ ...current, tone: "all" })) } : null, props.eventFilters.sortBy !== "sortOrder" ? { label: `Сортировка: ${props.eventFilters.sortBy === "dateLabel" ? "дата" : "статус"}`, onRemove: () => props.setEventFilters((current) => ({ ...current, sortBy: "sortOrder" })) } : null, props.eventFilters.sortDirection !== "asc" ? { label: "Порядок: по убыванию", onRemove: () => props.setEventFilters((current) => ({ ...current, sortDirection: "asc" })) } : null].filter(Boolean) as FilterChip[],
    selectedCount: props.selectedEvents.length,
    hasActiveFilters: props.eventFilters.query !== "" || props.eventFilters.status !== "all" || props.eventFilters.tone !== "all" || props.eventFilters.sortBy !== "sortOrder" || props.eventFilters.sortDirection !== "asc",
    onSearchChange: (value) => props.setEventFilters((current) => ({ ...current, query: value })),
    onResetFilters: () => props.setEventFilters(defaultEventFilters()),
    bulkActions: [{ label: props.allVisibleEventsSelected ? "Снять выбор со всех" : "Выбрать все видимые", icon: props.allVisibleEventsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />, variant: "outline", disabled: props.filteredEvents.length === 0, onClick: () => props.toggleSelectAllVisible("events", props.filteredEvents.map((event) => event.id)) }, { label: "Удалить выбранные", icon: <Trash2 className="h-4 w-4" />, variant: "outline", destructive: true, disabled: props.selectedEvents.length === 0 || props.isDeleting, onClick: () => props.setPendingDelete({ entity: "bulk-event", ids: props.selectedEvents.map((event) => event.id), title: `Выбрано событий: ${props.selectedEvents.length}`, description: `${props.selectedEvents.length} событий`, summaryItems: props.buildBulkDeleteSummaryItems(props.selectedEvents), totalCount: props.selectedEvents.length }) }],
    onClearSelection: () => props.clearSelection("events"),
    presetName: props.presetName.events,
    onPresetNameChange: (value) => props.setPresetName((current) => ({ ...current, events: value })),
    onSavePreset: () => { void props.handleSavePreset("events"); },
    savePresetDisabled: props.createPresetPending,
    presets: props.presetsByTab.events,
    onApplyPreset: (preset) => props.applyPreset(preset),
    onDeletePreset: (presetId) => { void props.deletePreset.mutateAsync({ id: presetId }); },
    deletePresetPending: props.deletePreset.isPending,
    statusValue: props.eventFilters.status,
    statusOptions: [{ label: "Все статусы", value: "all" }, ...props.eventStatuses.map((value) => ({ label: value, value }))],
    onStatusChange: (value) => props.setEventFilters((current) => ({ ...current, status: value })),
    toneValue: props.eventFilters.tone,
    toneOptions: [{ label: "Все тона", value: "all" }, ...props.eventTones.map((value) => ({ label: value, value }))],
    onToneChange: (value) => props.setEventFilters((current) => ({ ...current, tone: value })),
    visibilityValue: props.eventFilters.visibility,
    onVisibilityChange: (value) => props.setEventFilters((current) => ({ ...current, visibility: value as "all" | "visible" | "hidden" })),
    sortByValue: props.eventFilters.sortBy,
    onSortByChange: (value) => props.setEventFilters((current) => ({ ...current, sortBy: value })),
    sortDirectionValue: props.eventFilters.sortDirection,
    onSortDirectionChange: (value) => props.setEventFilters((current) => ({ ...current, sortDirection: value })),
    items: props.paginatedEvents.map((event) => ({ id: event.id, selected: props.selectedIds.events.includes(event.id), title: event.title, subtitle: event.dateLabel, meta: `${event.status} · ${event.tone} · Порядок: ${event.sortOrder}`, onToggleSelected: () => props.toggleSelection("events", event.id), inlineActions: [{ label: "Порядок", value: event.sortOrder, icon: <ArrowDown className="h-3.5 w-3.5" />, disabled: props.updateEvent.isPending, onClick: async () => { const nextSortOrder = event.sortOrder + 1; await props.updateEvent.mutateAsync({ ...event, sortOrder: nextSortOrder }); const toastCopy = props.getInlineActionToastCopy("event", { title: event.title, sortOrder: nextSortOrder, status: event.status }); props.toast.success(toastCopy.sortOrder.title, { description: toastCopy.sortOrder.description }); props.setActionLog((current) => props.recordAdminAction(current, "events", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description)); } }, { label: "Статус", value: event.status, icon: <CalendarRange className="h-3.5 w-3.5" />, disabled: props.updateEvent.isPending, onClick: async () => { const nextStatus = event.status === "Открыта регистрация" ? "Мест нет" : "Открыта регистрация"; await props.updateEvent.mutateAsync({ ...event, status: nextStatus }); const toastCopy = props.getInlineActionToastCopy("event", { title: event.title, sortOrder: event.sortOrder, status: nextStatus }); props.toast.success(toastCopy.status.title, { description: toastCopy.status.description }); props.setActionLog((current) => props.recordAdminAction(current, "events", "update", toastCopy.status.title, toastCopy.status.description)); } }], onEdit: () => props.setEventForm({ id: event.id, title: event.title, dateLabel: event.dateLabel, description: event.description, status: event.status, tone: event.tone, sortOrder: event.sortOrder, hidden: Boolean(event.hidden) }), onDelete: () => props.setPendingDelete({ entity: "event", id: event.id, title: event.title, description: `событие «${event.title}»` }), deleting: props.isDeleting && props.pendingDelete?.entity === "event" && props.pendingDelete.id === event.id })),
    pagination: props.paginationMeta,
    onPageChange: (page) => props.setTabPage("events", page),
    onPageSizeChange: (pageSize) => props.setTabPageSize("events", pageSize),
  };
}

export function buildAdminClubMembersTabProps(props: AdminClubMembersTabContainerProps): AdminClubMembersTabContentProps {
  return {
    memberForm: props.memberForm,
    memberErrors: props.memberErrors,
    onMemberFormChange: (next) => props.setMemberForm(next),
    onMemberFieldErrorClear: (field) => props.setMemberErrors((current) => ({ ...current, [field]: undefined })),
    onSubmit: props.handleMemberSubmit,
    onResetForm: () => { props.setMemberForm({ id: undefined, name: "", animal: "", sinceLabel: "", badge: "", sortOrder: 0, hidden: false }); props.setMemberErrors({}); },
    submitDisabled: props.createMemberPending || props.updateMemberPending,
    sortIndicator: { fieldLabel: props.memberFilters.sortBy === "name" ? "имени" : props.memberFilters.sortBy === "badge" ? "бейджу" : "порядку", directionLabel: props.memberFilters.sortDirection === "asc" ? "↑" : "↓" },
    searchValue: props.memberFilters.query,
    resultCount: props.filteredMembers.length,
    activeFilters: [props.memberFilters.query ? { label: `Поиск: ${props.memberFilters.query}`, onRemove: () => props.setMemberFilters((current) => ({ ...current, query: "" })) } : null, props.memberFilters.badge !== "all" ? { label: `Бейдж: ${props.memberFilters.badge}`, onRemove: () => props.setMemberFilters((current) => ({ ...current, badge: "all" })) } : null, props.memberFilters.sortBy !== "sortOrder" ? { label: `Сортировка: ${props.memberFilters.sortBy === "name" ? "имя" : "бейдж"}`, onRemove: () => props.setMemberFilters((current) => ({ ...current, sortBy: "sortOrder" })) } : null, props.memberFilters.sortDirection !== "asc" ? { label: "Порядок: по убыванию", onRemove: () => props.setMemberFilters((current) => ({ ...current, sortDirection: "asc" })) } : null].filter(Boolean) as FilterChip[],
    selectedCount: props.selectedMembers.length,
    hasActiveFilters: props.memberFilters.query !== "" || props.memberFilters.badge !== "all" || props.memberFilters.sortBy !== "sortOrder" || props.memberFilters.sortDirection !== "asc",
    onSearchChange: (value) => props.setMemberFilters((current) => ({ ...current, query: value })),
    onResetFilters: () => props.setMemberFilters(defaultMemberFilters()),
    bulkActions: [{ label: props.allVisibleMembersSelected ? "Снять выбор со всех" : "Выбрать все видимые", icon: props.allVisibleMembersSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />, variant: "outline", disabled: props.filteredMembers.length === 0, onClick: () => props.toggleSelectAllVisible("members", props.filteredMembers.map((member) => member.id)) }, { label: "Удалить выбранных", icon: <Trash2 className="h-4 w-4" />, variant: "outline", destructive: true, disabled: props.selectedMembers.length === 0 || props.isDeleting, onClick: () => props.setPendingDelete({ entity: "bulk-member", ids: props.selectedMembers.map((member) => member.id), title: `Выбрано участников: ${props.selectedMembers.length}`, description: `${props.selectedMembers.length} участников`, summaryItems: props.buildBulkDeleteSummaryItems(props.selectedMembers), totalCount: props.selectedMembers.length }) }],
    onClearSelection: () => props.clearSelection("members"),
    presetName: props.presetName.members,
    onPresetNameChange: (value) => props.setPresetName((current) => ({ ...current, members: value })),
    onSavePreset: () => { void props.handleSavePreset("members"); },
    savePresetDisabled: props.createPresetPending,
    presets: props.presetsByTab.members,
    onApplyPreset: (preset) => props.applyPreset(preset),
    onDeletePreset: (presetId) => { void props.deletePreset.mutateAsync({ id: presetId }); },
    deletePresetPending: props.deletePreset.isPending,
    badgeValue: props.memberFilters.badge,
    badgeOptions: [{ label: "Все бейджи", value: "all" }, ...props.memberBadges.map((value) => ({ label: value, value }))],
    onBadgeChange: (value) => props.setMemberFilters((current) => ({ ...current, badge: value })),
    visibilityValue: props.memberFilters.visibility,
    onVisibilityChange: (value) => props.setMemberFilters((current) => ({ ...current, visibility: value as "all" | "visible" | "hidden" })),
    sortByValue: props.memberFilters.sortBy,
    onSortByChange: (value) => props.setMemberFilters((current) => ({ ...current, sortBy: value })),
    sortDirectionValue: props.memberFilters.sortDirection,
    onSortDirectionChange: (value) => props.setMemberFilters((current) => ({ ...current, sortDirection: value })),
    items: props.paginatedMembers.map((member) => ({ id: member.id, selected: props.selectedIds.members.includes(member.id), title: member.name, subtitle: member.animal, meta: `${member.sinceLabel} · ${member.badge} · Порядок: ${member.sortOrder}`, onToggleSelected: () => props.toggleSelection("members", member.id), inlineActions: [{ label: "Порядок", value: member.sortOrder, icon: <ArrowDown className="h-3.5 w-3.5" />, disabled: props.updateMember.isPending, onClick: async () => { const nextSortOrder = member.sortOrder + 1; await props.updateMember.mutateAsync({ ...member, sortOrder: nextSortOrder }); const toastCopy = props.getInlineActionToastCopy("member", { name: member.name, sortOrder: nextSortOrder, badge: member.badge }); props.toast.success(toastCopy.sortOrder.title, { description: toastCopy.sortOrder.description }); props.setActionLog((current) => props.recordAdminAction(current, "members", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description)); } }, { label: "Бейдж", value: member.badge || "без бейджа", icon: <Crown className="h-3.5 w-3.5" />, disabled: props.updateMember.isPending, onClick: async () => { const nextBadge = member.badge === "Амбассадор" ? "Гость фермы" : "Амбассадор"; await props.updateMember.mutateAsync({ ...member, badge: nextBadge }); const toastCopy = props.getInlineActionToastCopy("member", { name: member.name, sortOrder: member.sortOrder, badge: nextBadge }); props.toast.success(toastCopy.status.title, { description: toastCopy.status.description }); props.setActionLog((current) => props.recordAdminAction(current, "members", "update", toastCopy.status.title, toastCopy.status.description)); } }], onEdit: () => props.setMemberForm({ id: member.id, name: member.name, animal: member.animal, sinceLabel: member.sinceLabel, badge: member.badge, sortOrder: member.sortOrder, hidden: Boolean(member.hidden) }), onDelete: () => props.setPendingDelete({ entity: "member", id: member.id, title: member.name, description: `участника «${member.name}»` }), deleting: props.isDeleting && props.pendingDelete?.entity === "member" && props.pendingDelete.id === member.id })),
    pagination: props.paginationMeta,
    onPageChange: (page) => props.setTabPage("members", page),
    onPageSizeChange: (pageSize) => props.setTabPageSize("members", pageSize),
  };
}
