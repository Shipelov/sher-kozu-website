/**
 * Admin Knowledge Base — Zoya AI Nutritionist
 *
 * Full CRUD for knowledge entries, file imports (PDF/DOCX),
 * URL imports, conflict resolution, auto-search ("Найди новые знания"),
 * and search settings management.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { fmtNum } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Search,
  Upload,
  Link2,
  Sparkles,
  Trash2,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Archive,
  FileText,
  Globe,
  Settings,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Download,
  Filter,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
// File upload handled via /api/upload-nutri-file endpoint

// ═══════════════════════════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════════════════════════

const CATEGORIES = [
  { value: "nutrition_science", label: "Наука о питании", color: "bg-blue-100 text-blue-700" },
  { value: "breed_profile", label: "Профиль породы", color: "bg-green-100 text-green-700" },
  { value: "product_info", label: "Продукция", color: "bg-amber-100 text-amber-700" },
  { value: "recipe", label: "Рецепт", color: "bg-pink-100 text-pink-700" },
  { value: "health_goal", label: "Здоровье", color: "bg-purple-100 text-purple-700" },
  { value: "general", label: "Общее", color: "bg-gray-100 text-gray-700" },
] as const;

const STATUSES = [
  { value: "active", label: "Активна", icon: CheckCircle2, color: "text-green-600" },
  { value: "pending_review", label: "На проверке", icon: Clock, color: "text-amber-600" },
  { value: "conflict", label: "Конфликт", icon: AlertTriangle, color: "text-red-600" },
  { value: "archived", label: "Архив", icon: Archive, color: "text-gray-500" },
] as const;

const CONFIDENCE_LEVELS = [
  { value: "verified", label: "Проверено", color: "bg-green-100 text-green-700" },
  { value: "trusted", label: "Доверенный", color: "bg-blue-100 text-blue-700" },
  { value: "unverified", label: "Не проверено", color: "bg-amber-100 text-amber-700" },
] as const;

function getCategoryInfo(cat: string) {
  return CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];
}
function getStatusInfo(status: string) {
  return STATUSES.find((s) => s.value === status) || STATUSES[0];
}
function getConfidenceInfo(conf: string) {
  return CONFIDENCE_LEVELS.find((c) => c.value === conf) || CONFIDENCE_LEVELS[2];
}

export default function AdminNutriKnowledge() {
  const { user, loading } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || (user as any).role !== "admin") {
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">База знаний Зои</h1>
            <p className="text-sm text-muted-foreground">
              Управление знаниями AI-нутрициолога
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="entries" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="entries" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Записи
            </TabsTrigger>
            <TabsTrigger value="imports" className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Импорт
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Автопоиск
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entries">
            <KnowledgeEntriesTab />
          </TabsContent>
          <TabsContent value="imports">
            <ImportsTab />
          </TabsContent>
          <TabsContent value="search">
            <AutoSearchTab />
          </TabsContent>
          <TabsContent value="settings">
            <SearchSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 1: Knowledge Entries CRUD
// ═══════════════════════════════════════════════════════════════════

function KnowledgeEntriesTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.nutritionist.knowledge.list.useQuery({
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const deleteMutation = trpc.nutritionist.knowledge.delete.useMutation({
    onSuccess: () => {
      toast.success("Запись удалена");
      utils.nutritionist.knowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const entries = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по записям..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setShowCreateDialog(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>Всего: <strong className="text-foreground">{total}</strong></span>
      </div>

      {/* Entries list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-40" />
            <p>Записи не найдены</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: any) => {
            const catInfo = getCategoryInfo(entry.category || entry.nutriKnowledgeCategory);
            const statusInfo = getStatusInfo(entry.status || entry.nutriKnowledgeStatus);
            const confInfo = getConfidenceInfo(entry.confidence || entry.nutriConfidence);
            const isExpanded = expandedId === entry.id;
            const isConflict =
              (entry.status || entry.nutriKnowledgeStatus) === "pending_review" &&
              entry.title?.startsWith("[КОНФЛИКТ]");

            return (
              <Card
                key={entry.id}
                className={`transition-all ${
                  isConflict ? "border-red-200 bg-red-50/30" : ""
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`mt-0.5 ${statusInfo.color}`}>
                      <statusInfo.icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate max-w-md">
                          {entry.title}
                        </h3>
                        <Badge variant="outline" className={`text-[10px] ${catInfo.color}`}>
                          {catInfo.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${confInfo.color}`}>
                          {confInfo.label}
                        </Badge>
                        {entry.createdAt && (
                          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                            {new Date(entry.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {entry.content}
                          </p>
                          {entry.sourceName && (
                            <p className="text-xs text-muted-foreground">
                              Источник: {entry.sourceName}
                              {entry.sourceUrl && (
                                <a
                                  href={entry.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-primary underline"
                                >
                                  ↗
                                </a>
                              )}
                            </p>
                          )}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {(Array.isArray(entry.tags) ? entry.tags : []).map(
                                (tag: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">
                                    {tag}
                                  </Badge>
                                )
                              )}
                            </div>
                          )}
                          {(entry.createdAt || entry.updatedAt) && (
                            <p className="text-xs text-muted-foreground">
                              Добавлено: {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                              {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
                                <> · Обновлено: {new Date(entry.updatedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditEntry(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {isConflict && (
                        <ConflictResolveButton
                          entry={entry}
                          onResolved={() => utils.nutritionist.knowledge.list.invalidate()}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Удалить запись?")) {
                            deleteMutation.mutate({ id: entry.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreateDialog || editEntry) && (
        <KnowledgeEntryDialog
          entry={editEntry}
          onClose={() => {
            setShowCreateDialog(false);
            setEditEntry(null);
          }}
          onSaved={() => {
            utils.nutritionist.knowledge.list.invalidate();
            setShowCreateDialog(false);
            setEditEntry(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Create/Edit Dialog ──────────────────────────────────────────

function KnowledgeEntryDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!entry;
  const [title, setTitle] = useState(entry?.title || "");
  const [content, setContent] = useState(entry?.content || "");
  const [category, setCategory] = useState(
    entry?.category || entry?.nutriKnowledgeCategory || "general"
  );
  const [confidence, setConfidence] = useState(
    entry?.confidence || entry?.nutriConfidence || "verified"
  );
  const [status, setStatus] = useState(
    entry?.status || entry?.nutriKnowledgeStatus || "active"
  );
  const [sourceName, setSourceName] = useState(entry?.sourceName || "");
  const [sourceUrl, setSourceUrl] = useState(entry?.sourceUrl || "");
  const [tags, setTags] = useState(
    Array.isArray(entry?.tags) ? entry.tags.join(", ") : ""
  );

  const createMutation = trpc.nutritionist.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success("Запись создана");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.nutritionist.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success("Запись обновлена");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const parsedTags = tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    if (isEdit) {
      updateMutation.mutate({
        id: entry.id,
        title,
        content,
        category: category as any,
        confidence: confidence as any,
        status: status as any,
        sourceName: sourceName || undefined,
        sourceUrl: sourceUrl || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });
    } else {
      createMutation.mutate({
        title,
        content,
        category: category as any,
        confidence: confidence as any,
        sourceName: sourceName || undefined,
        sourceUrl: sourceUrl || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать запись" : "Новая запись"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Заголовок</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок записи..."
            />
          </div>

          <div>
            <Label>Содержание</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Полное содержание записи..."
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Достоверность</Label>
              <Select value={confidence} onValueChange={setConfidence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_LEVELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && (
            <div>
              <Label>Статус</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Источник (название)</Label>
              <Input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Название источника..."
              />
            </div>
            <div>
              <Label>URL источника</Label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <Label>Теги (через запятую)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="козье молоко, кальций, A2 казеин..."
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending || !title || !content}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Conflict Resolve Button ─────────────────────────────────────

function ConflictResolveButton({
  entry,
  onResolved,
}: {
  entry: any;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);

  const approveMutation = trpc.nutritionist.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success("Запись одобрена и активирована");
      onResolved();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.nutritionist.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success("Запись отклонена и архивирована");
      onResolved();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-amber-600 hover:text-amber-800 gap-1"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs">Решить</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Разрешение конфликта
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <p className="text-sm font-medium">Новая запись:</p>
              <p className="text-sm text-muted-foreground mt-1">{entry.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-4">
                {entry.content}
              </p>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Эта запись помечена как конфликтующая с существующими данными.
                Выберите действие:
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                rejectMutation.mutate({
                  id: entry.id,
                  status: "archived",
                });
              }}
              disabled={rejectMutation.isPending}
              className="text-red-600"
            >
              {rejectMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Отклонить
            </Button>
            <Button
              onClick={() => {
                // Remove [КОНФЛИКТ] prefix and activate
                const cleanTitle = entry.title
                  .replace(/^\[КОНФЛИКТ\]\s*/, "")
                  .replace(/^\[АВТО-ПОИСК\/КОНФЛИКТ\]\s*/, "");
                approveMutation.mutate({
                  id: entry.id,
                  title: cleanTitle,
                  status: "active",
                  confidence: "verified",
                });
              }}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Одобрить и активировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 2: File & URL Imports
// ═══════════════════════════════════════════════════════════════════

function ImportsTab() {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const utils = trpc.useUtils();

  const { data: imports, isLoading } = trpc.nutritionist.knowledge.listImports.useQuery({
    limit: 50,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3">
        <Button onClick={() => setShowUploadDialog(true)} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Загрузить файл
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowUrlDialog(true)}
          className="gap-1.5"
        >
          <Link2 className="h-4 w-4" />
          Добавить URL
        </Button>
      </div>

      {/* Imports list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !imports || imports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Upload className="h-10 w-10 mb-3 opacity-40" />
            <p>Нет импортов</p>
            <p className="text-xs mt-1">
              Загрузите PDF/DOCX файл или добавьте URL для извлечения знаний
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {imports.map((imp: any) => {
            const isProcessing = imp.status === "processing";
            const isApproved =
              imp.status === "approved" || imp.status === "partially_approved";
            const isRejected = imp.status === "rejected";

            return (
              <Card key={imp.id}>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`shrink-0 ${
                        isProcessing
                          ? "text-blue-500"
                          : isApproved
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : imp.sourceType === "url_import" ? (
                        <Globe className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {imp.fileName || imp.sourceUrl || "Импорт"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isProcessing
                              ? "bg-blue-50 text-blue-600"
                              : isApproved
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {imp.status === "processing"
                            ? "Обработка..."
                            : imp.status === "approved"
                            ? "Одобрено"
                            : imp.status === "partially_approved"
                            ? "Частично"
                            : "Отклонено"}
                        </Badge>
                        {imp.factsExtracted > 0 && (
                          <span>
                            Фактов: {imp.factsNew || 0} новых
                            {imp.factsConflict > 0 && (
                              <span className="text-amber-600">
                                , {imp.factsConflict} конфликтов
                              </span>
                            )}
                          </span>
                        )}
                        {imp.createdAt && (
                          <span>
                            {new Date(imp.createdAt).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Report summary */}
                  {imp.report?.summary && (
                    <p className="mt-2 text-xs text-muted-foreground pl-8">
                      {imp.report.summary}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <FileUploadDialog
          onClose={() => setShowUploadDialog(false)}
          onUploaded={() => {
            utils.nutritionist.knowledge.listImports.invalidate();
            setShowUploadDialog(false);
          }}
        />
      )}

      {/* URL Dialog */}
      {showUrlDialog && (
        <UrlImportDialog
          onClose={() => setShowUrlDialog(false)}
          onImported={() => {
            utils.nutritionist.knowledge.listImports.invalidate();
            setShowUrlDialog(false);
          }}
        />
      )}
    </div>
  );
}

// ─── File Upload Dialog ──────────────────────────────────────────

function FileUploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const importMutation = trpc.nutritionist.knowledge.importFile.useMutation({
    onSuccess: () => {
      toast.success("Файл загружен и отправлен на анализ");
      onUploaded();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      // Read file as buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to S3 via server
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-nutri-file", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { fileKey, url } = await response.json();

      // Trigger import processing
      importMutation.mutate({
        fileName: file.name,
        fileKey,
        sourceUrl: url,
        sourceType: "file_upload",
      });
    } catch (err: any) {
      toast.error("Ошибка загрузки: " + (err.message || "Неизвестная ошибка"));
      setUploading(false);
    }
  };

  const acceptedTypes = ".pdf,.docx,.doc,.txt";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Загрузить файл
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept={acceptedTypes}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="nutri-file-upload"
            />
            <label htmlFor="nutri-file-upload" className="cursor-pointer">
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({fmtNum(file.size / 1024)} KB)
                  </span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Нажмите для выбора файла
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOCX, TXT (до 16 МБ)
                  </p>
                </div>
              )}
            </label>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Как это работает:</p>
            <p>1. Файл загружается в хранилище</p>
            <p>2. AI извлекает факты о нутрициологии</p>
            <p>3. Проверяет на конфликты с существующими данными</p>
            <p>4. Новые факты добавляются, конфликты — на модерацию</p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={handleUpload} disabled={!file || uploading || importMutation.isPending}>
            {(uploading || importMutation.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            )}
            Загрузить и анализировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── URL Import Dialog ───────────────────────────────────────────

function UrlImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [url, setUrl] = useState("");

  const importMutation = trpc.nutritionist.knowledge.importFile.useMutation({
    onSuccess: () => {
      toast.success("URL отправлен на анализ");
      onImported();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleImport = () => {
    if (!url) return;
    importMutation.mutate({
      fileName: new URL(url).hostname,
      fileKey: url,
      sourceUrl: url,
      sourceType: "url_import",
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Импорт с URL
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>URL страницы или документа</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://pubmed.ncbi.nlm.nih.gov/..."
              type="url"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Поддерживаемые источники:</p>
            <p>— Научные статьи (PubMed, Google Scholar)</p>
            <p>— Веб-страницы о нутрициологии</p>
            <p>— PDF-документы по прямой ссылке</p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!url || importMutation.isPending}>
            {importMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            )}
            Анализировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 3: Auto-Search ("Найди новые знания")
// ═══════════════════════════════════════════════════════════════════

function AutoSearchTab() {
  const [topics, setTopics] = useState("");
  const utils = trpc.useUtils();

  const { data: jobs, isLoading } = trpc.nutritionist.knowledge.listSearchJobs.useQuery({
    limit: 20,
  });

  const triggerMutation = trpc.nutritionist.knowledge.triggerSearch.useMutation({
    onSuccess: () => {
      toast.success("Поиск запущен! Зоя ищет новые знания...");
      utils.nutritionist.knowledge.listSearchJobs.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleTrigger = () => {
    const topicList = topics
      .split("\n")
      .map((t: string) => t.trim())
      .filter(Boolean);
    triggerMutation.mutate(topicList.length > 0 ? { topics: topicList } : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Trigger section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Найди новые знания
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Зоя проанализирует научные источники и добавит новые факты о козьем и овечьем
            молоке в базу знаний. Конфликтующие данные будут отправлены на модерацию.
          </p>

          <div>
            <Label>Темы для поиска (по одной на строку, необязательно)</Label>
            <Textarea
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder={"козье молоко и остеопороз\nA2 казеин исследования 2024\nовечий йогурт микробиом"}
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Если оставить пустым, Зоя использует приоритетные темы из настроек
            </p>
          </div>

          <Button
            onClick={handleTrigger}
            disabled={triggerMutation.isPending}
            className="gap-1.5"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Запустить поиск
          </Button>
        </CardContent>
      </Card>

      {/* Search jobs history */}
      <div>
        <h3 className="text-sm font-semibold mb-3">История поисков</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Поисков ещё не было</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {jobs.map((job: any) => {
              const isRunning = job.status === "running" || job.status === "pending";
              const isCompleted = job.status === "completed";
              const isFailed = job.status === "failed";

              return (
                <Card key={job.id}>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`shrink-0 ${
                          isRunning
                            ? "text-blue-500"
                            : isCompleted
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {isRunning ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              isRunning
                                ? "bg-blue-50 text-blue-600"
                                : isCompleted
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {isRunning
                              ? "Выполняется..."
                              : isCompleted
                              ? "Завершён"
                              : "Ошибка"}
                          </Badge>
                          {job.resultsFound > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Найдено: {job.resultsFound}, предложено:{" "}
                              {job.factsProposed || 0}
                            </span>
                          )}
                        </div>
                        {job.createdAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(job.createdAt).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    {job.report?.summary && (
                      <p className="mt-2 text-xs text-muted-foreground pl-8">
                        {job.report.summary}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 4: Search Settings
// ═══════════════════════════════════════════════════════════════════

function SearchSettingsTab() {
  const { data: settings, isLoading } =
    trpc.nutritionist.knowledge.getSearchSettings.useQuery();

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [cron, setCron] = useState("0 0 3 * * 1");
  const [priorityTopics, setPriorityTopics] = useState("");
  const [trustedSources, setTrustedSources] = useState("");
  const [excludedSources, setExcludedSources] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Sync state from server
  if (settings && !initialized) {
    setAutoEnabled(settings.autoSearchEnabled ?? false);
    setCron(settings.cronSchedule || "0 0 3 * * 1");
    setPriorityTopics(
      Array.isArray(settings.priorityTopics)
        ? (settings.priorityTopics as string[]).join("\n")
        : ""
    );
    setTrustedSources(
      Array.isArray(settings.trustedSources)
        ? (settings.trustedSources as string[]).join("\n")
        : ""
    );
    setExcludedSources(
      Array.isArray(settings.excludedSources)
        ? (settings.excludedSources as string[]).join("\n")
        : ""
    );
    setInitialized(true);
  }

  const saveMutation = trpc.nutritionist.knowledge.updateSearchSettings.useMutation({
    onSuccess: () => toast.success("Настройки сохранены"),
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    saveMutation.mutate({
      autoSearchEnabled: autoEnabled,
      cronSchedule: cron,
      priorityTopics: priorityTopics
        .split("\n")
        .map((t: string) => t.trim())
        .filter(Boolean),
      trustedSources: trustedSources
        .split("\n")
        .map((t: string) => t.trim())
        .filter(Boolean),
      excludedSources: excludedSources
        .split("\n")
        .map((t: string) => t.trim())
        .filter(Boolean),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Настройки автопоиска</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-search toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Автоматический поиск</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Зоя будет автоматически искать новые знания по расписанию
              </p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>

          {/* Cron schedule */}
          {autoEnabled && (
            <div>
              <Label>Расписание (cron)</Label>
              <Input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 0 3 * * 1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                По умолчанию: каждый понедельник в 3:00
              </p>
            </div>
          )}

          {/* Priority topics */}
          <div>
            <Label>Приоритетные темы (по одной на строку)</Label>
            <Textarea
              value={priorityTopics}
              onChange={(e) => setPriorityTopics(e.target.value)}
              placeholder={"козье молоко здоровье\nовечий сыр нутриенты\nA2 казеин исследования"}
              rows={4}
            />
          </div>

          {/* Trusted sources */}
          <div>
            <Label>Доверенные источники (по одному на строку)</Label>
            <Textarea
              value={trustedSources}
              onChange={(e) => setTrustedSources(e.target.value)}
              placeholder={"pubmed.ncbi.nlm.nih.gov\nscholar.google.com\nwho.int"}
              rows={3}
            />
          </div>

          {/* Excluded sources */}
          <div>
            <Label>Исключённые источники (по одному на строку)</Label>
            <Textarea
              value={excludedSources}
              onChange={(e) => setExcludedSources(e.target.value)}
              placeholder="example-spam-site.com"
              rows={2}
            />
          </div>

          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            )}
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
