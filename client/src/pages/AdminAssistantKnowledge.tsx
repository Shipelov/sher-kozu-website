/**
 * Admin — база знаний AI-ассистентов (Маша). Записи читаются инструментами
 * get_farm_info / search_knowledge / get_delivery_info; здесь CRUD и проверка поиска.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ASSISTANTS = [
  { value: "masha", label: "Маша" },
  { value: "zoya", label: "Зоя" },
  { value: "shared", label: "Общие" },
] as const;
type AssistantValue = (typeof ASSISTANTS)[number]["value"];

const CATEGORIES = [
  { value: "farm", label: "О ферме" },
  { value: "breeds", label: "Породы" },
  { value: "nutrition", label: "Нутрициология" },
  { value: "market", label: "Рынок" },
  { value: "products", label: "Продукты" },
  { value: "delivery", label: "Доставка" },
  { value: "club", label: "Клуб" },
  { value: "platform", label: "Платформа" },
  { value: "audience", label: "Для кого" },
  { value: "values", label: "Ценности" },
  { value: "general", label: "Общее" },
] as const;
type CategoryValue = (typeof CATEGORIES)[number]["value"];

type KnowledgeEntry = {
  id: number;
  assistant: AssistantValue;
  category: string;
  title: string;
  content: string;
  tags: string[] | null;
  isActive: boolean;
  sortOrder: number;
};

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function isCategory(value: string): value is CategoryValue {
  return CATEGORIES.some((c) => c.value === value);
}

export default function AdminAssistantKnowledge() {
  const { user, loading } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Доступ ограничен</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">База знаний Маши</h1>
            <p className="text-sm text-muted-foreground">
              Факты о ферме, породах, продуктах и доставке, которые Маша читает через инструменты
            </p>
          </div>
        </div>
        <KnowledgeEntries />
        <SearchPreview />
      </div>
    </DashboardLayout>
  );
}

function KnowledgeEntries() {
  const [search, setSearch] = useState("");
  const [assistantFilter, setAssistantFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editEntry, setEditEntry] = useState<KnowledgeEntry | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.assistantKnowledge.list.useQuery({
    assistant: assistantFilter !== "all" ? (assistantFilter as AssistantValue) : undefined,
    category: categoryFilter !== "all" && isCategory(categoryFilter) ? categoryFilter : undefined,
    search: search || undefined,
    includeInactive: showInactive,
    limit: 200,
  });

  const deleteMutation = trpc.assistantKnowledge.delete.useMutation({
    onSuccess: () => {
      toast.success("Запись удалена");
      utils.assistantKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const entries = (data?.items ?? []) as KnowledgeEntry[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по заголовку и тексту…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={assistantFilter} onValueChange={setAssistantFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Ассистент" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все ассистенты</SelectItem>
            {ASSISTANTS.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          показывать выключенные
        </label>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Всего: <strong className="text-foreground">{data?.total ?? 0}</strong>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Записей нет. Стартовое наполнение: <code>pnpm db:seed-assistant-knowledge</code> на сервере.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <Card key={entry.id} className={entry.isActive ? "" : "opacity-60"}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{entry.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{categoryLabel(entry.category)}</Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {ASSISTANTS.find((a) => a.value === entry.assistant)?.label ?? entry.assistant}
                        </Badge>
                        {!entry.isActive && <Badge variant="destructive" className="text-[10px]">выключена</Badge>}
                        <span className="text-[10px] text-muted-foreground">#{entry.sortOrder}</span>
                      </div>
                      {!expanded && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{entry.content}</p>
                      )}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditEntry(entry)} aria-label="Редактировать">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label="Удалить"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Удалить запись «${entry.title}»?`)) deleteMutation.mutate({ id: entry.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expanded ? null : entry.id)} aria-label="Развернуть">
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 space-y-2">
                      <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/50 rounded-lg p-3">{entry.content}</pre>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(showCreate || editEntry) && (
        <KnowledgeEntryDialog
          entry={editEntry}
          onClose={() => {
            setShowCreate(false);
            setEditEntry(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditEntry(null);
            utils.assistantKnowledge.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

function KnowledgeEntryDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: KnowledgeEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = entry !== null;
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [assistant, setAssistant] = useState<AssistantValue>(entry?.assistant ?? "masha");
  const [category, setCategory] = useState<CategoryValue>(entry && isCategory(entry.category) ? entry.category : "general");
  const [tags, setTags] = useState((entry?.tags ?? []).join(", "));
  const [sortOrder, setSortOrder] = useState(String(entry?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(entry?.isActive ?? true);

  const createMutation = trpc.assistantKnowledge.create.useMutation({
    onSuccess: () => {
      toast.success("Запись создана");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.assistantKnowledge.update.useMutation({
    onSuccess: () => {
      toast.success("Запись обновлена");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const order = Number.parseInt(sortOrder, 10);
    const payload = {
      title,
      content,
      assistant,
      category,
      tags: parsedTags,
      sortOrder: Number.isFinite(order) && order >= 0 ? order : 0,
      isActive,
    };
    if (isEdit) updateMutation.mutate({ id: entry.id, ...payload });
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать запись" : "Новая запись"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Заголовок</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Зааненская коза" />
          </div>
          <div>
            <Label>Содержание</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Факты в свободной форме, markdown допустим" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ассистент</Label>
              <Select value={assistant} onValueChange={(v) => setAssistant(v as AssistantValue)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSISTANTS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Категория</Label>
              <Select value={category} onValueChange={(v) => isCategory(v) && setCategory(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Теги (через запятую)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="порода, коза, молоко" />
            </div>
            <div>
              <Label>Порядок</Label>
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            Запись активна (видна ассистенту)
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending || !title.trim() || !content.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Что вернёт инструмент search_knowledge на запрос — проверка глазами Маши. */
function SearchPreview() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const preview = trpc.assistantKnowledge.preview.useQuery(
    { assistant: "masha", query: submitted },
    { enabled: submitted.length >= 2 },
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">Проверка поиска (search_knowledge)</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Например: чем знамениты лаконы" />
          <Button type="submit" variant="secondary" disabled={query.trim().length < 2}>Найти</Button>
        </form>
        {preview.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {preview.data && preview.data.length === 0 && <p className="text-xs text-muted-foreground">Ничего не найдено — Маша скажет, что данных нет.</p>}
        {preview.data && preview.data.length > 0 && (
          <ol className="space-y-1 text-xs">
            {preview.data.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>{" "}
                <span className="text-muted-foreground">({categoryLabel(item.category)}, score {item.score})</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
