import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Type,
  FileJson,
  Loader2,
  RotateCcw,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Crop,
  History,
  Undo2,
  Clock,
  User,
  Download,
} from "lucide-react";
import ImageCropEditor from "@/components/ImageCropEditor";

/* ─── Block type display helpers ─── */
const TYPE_LABELS: Record<string, { label: string; icon: typeof Type; color: string }> = {
  text: { label: "Текст", icon: Type, color: "bg-blue-100 text-blue-800" },
  richtext: { label: "Форматированный текст", icon: Type, color: "bg-violet-100 text-violet-800" },
  image: { label: "Изображение", icon: ImageIcon, color: "bg-emerald-100 text-emerald-800" },
  json: { label: "JSON", icon: FileJson, color: "bg-amber-100 text-amber-800" },
};

/* ─── Action labels for history ─── */
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  update_content: { label: "Изменение контента", color: "bg-blue-100 text-blue-800" },
  upload_image: { label: "Загрузка изображения", color: "bg-emerald-100 text-emerald-800" },
  toggle_visibility: { label: "Изменение видимости", color: "bg-amber-100 text-amber-800" },
  upsert_update: { label: "Обновление блока", color: "bg-purple-100 text-purple-800" },
  delete: { label: "Удаление", color: "bg-red-100 text-red-800" },
  rollback: { label: "Откат", color: "bg-orange-100 text-orange-800" },
};

/* ─── Page labels ─── */
const PAGE_LABELS: Record<string, string> = {
  home: "Главная страница",
  catalog: "Каталог животных",
};

type CmsBlock = {
  id: number;
  page: string;
  blockKey: string;
  contentType: string;
  content: string | null;
  imageUrl: string | null;
  sortOrder: number;
  visible: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type HistoryEntry = {
  id: number;
  blockId: number;
  page: string;
  blockKey: string;
  action: string;
  prevContent: string | null;
  prevImageUrl: string | null;
  prevVisible: boolean | null;
  newContent: string | null;
  newImageUrl: string | null;
  newVisible: boolean | null;
  changedByOpenId: string;
  changedByName: string | null;
  changedAt: Date | string;
};

export default function AdminCmsEditor() {
  const { user, loading: authLoading } = useAuth();
  const [activePage, setActivePage] = useState("home");
  const [editBlock, setEditBlock] = useState<CmsBlock | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const [historyBlock, setHistoryBlock] = useState<CmsBlock | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<HistoryEntry | null>(null);

  const utils = trpc.useUtils();

  /* ─── Queries ─── */
  const { data: allBlocks, isLoading } = trpc.cms.listAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  // History query — only fetches when historyBlock is set
  const { data: historyData, isLoading: historyLoading } = trpc.cms.getBlockHistory.useQuery(
    { blockId: historyBlock?.id ?? 0, limit: 50 },
    { enabled: !!historyBlock }
  );

  /* ─── Mutations ─── */
  const updateContent = trpc.cms.updateContent.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      if (historyBlock) utils.cms.getBlockHistory.invalidate();
      toast.success("Контент обновлён");
      setEditBlock(null);
      setShowCropEditor(false);
    },
    onError: (err: { message: string }) => toast.error(`Ошибка: ${err.message}`),
  });

  const toggleVisibility = trpc.cms.toggleVisibility.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      toast.success("Видимость изменена");
    },
    onError: (err: { message: string }) => toast.error(`Ошибка: ${err.message}`),
  });

  const uploadImage = trpc.cms.uploadImage.useMutation({
    onSuccess: (data: { url: string }) => {
      setEditImageUrl(data.url);
      setUploading(false);
      setShowCropEditor(false);
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      toast.success("Изображение загружено и сохранено");
      setEditBlock(null);
    },
    onError: (err: { message: string }) => {
      setUploading(false);
      toast.error(`Ошибка загрузки: ${err.message}`);
    },
  });

  const seedDefaults = trpc.cms.seedDefaults.useMutation({
    onSuccess: (data: { seeded: boolean; count?: number }) => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      setSeedDialogOpen(false);
      if (data.seeded) {
        toast.success(`Инициализировано ${data.count} блоков`);
      } else {
        toast.info("Блоки уже существуют");
      }
    },
    onError: (err: { message: string }) => toast.error(`Ошибка: ${err.message}`),
  });

  const deleteBlock = trpc.cms.deleteBlock.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      toast.success("Блок удалён");
    },
    onError: (err: { message: string }) => toast.error(`Ошибка: ${err.message}`),
  });

  const rollbackBlock = trpc.cms.rollbackBlock.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      utils.cms.getBlockHistory.invalidate();
      setRollbackConfirm(null);
      toast.success("Блок откачен к предыдущей версии");
    },
    onError: (err: { message: string }) => {
      toast.error(`Ошибка отката: ${err.message}`);
    },
  });

  /* ─── Filtered blocks for active page ─── */
  const pageBlocks = useMemo(
    () =>
      (allBlocks ?? [])
        .filter((b: CmsBlock) => b.page === activePage)
        .sort((a: CmsBlock, b: CmsBlock) => a.sortOrder - b.sortOrder),
    [allBlocks, activePage]
  );

  /* ─── Handlers ─── */
  const openEditor = useCallback((block: CmsBlock) => {
    setEditBlock(block);
    setEditContent(block.content ?? "");
    setEditImageUrl(block.imageUrl ?? "");
    setShowCropEditor(false);
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!editBlock) return;
    updateContent.mutate({
      id: editBlock.id,
      content: editContent || null,
      imageUrl: editImageUrl || null,
    });
  }, [editBlock, editContent, editImageUrl, updateContent]);

  const handleCropComplete = useCallback(
    (data: { base64Data: string; fileName: string; mimeType: string }) => {
      if (!editBlock) return;
      setUploading(true);
      uploadImage.mutate({
        blockId: editBlock.id,
        fileName: data.fileName,
        mimeType: data.mimeType,
        base64Data: data.base64Data,
      });
    },
    [editBlock, uploadImage]
  );

  const formatJsonContent = useCallback((content: string): string => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, []);

  /* ─── CSV Export handler ─── */
  const handleExportCsv = useCallback(async (blockId?: number) => {
    try {
      const result = await utils.client.cms.exportHistoryCsv.query(
        blockId ? { blockId } : undefined
      );
      if (result.rowCount === 0) {
        toast.info("Нет записей для экспорта");
        return;
      }
      // Add BOM for Excel UTF-8 compatibility
      const bom = "\uFEFF";
      const blob = new Blob([bom + result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = blockId
        ? `cms-history-block-${blockId}-${dateStr}.csv`
        : `cms-history-all-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано ${result.rowCount} записей`);
    } catch (err) {
      toast.error("Ошибка экспорта CSV");
      console.error("[CMS CSV Export]", err);
    }
  }, [utils]);

  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const truncateText = useCallback((text: string | null, maxLen: number = 80): string => {
    if (!text) return "—";
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "…";
  }, []);

  /* ─── Auth guard ─── */
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (user as any).role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <p className="text-lg text-muted-foreground">Доступ запрещён</p>
        <Link href="/">
          <Button variant="outline">На главную</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Админ
              </Button>
            </Link>
            <div className="h-5 w-px bg-border" />
            <h1 className="text-lg font-semibold">Управление контентом</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeedDialogOpen(true)}
              disabled={seedDefaults.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Инициализировать
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv()}
            >
              <Download className="h-4 w-4 mr-1" />
              Экспорт CSV
            </Button>
            <a href={activePage === "home" ? "/" : "/animals"} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Предпросмотр
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Page tabs */}
        <Tabs value={activePage} onValueChange={setActivePage}>
          <TabsList className="mb-6">
            <TabsTrigger value="home">Главная</TabsTrigger>
            <TabsTrigger value="catalog">Каталог</TabsTrigger>
          </TabsList>

          {["home", "catalog"].map((page) => (
            <TabsContent key={page} value={page}>
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : pageBlocks.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-muted-foreground mb-4">
                    Контент-блоки для страницы «{PAGE_LABELS[page]}» ещё не инициализированы.
                  </p>
                  <Button onClick={() => setSeedDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Инициализировать блоки
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pageBlocks.map((block: CmsBlock) => {
                    const typeInfo = TYPE_LABELS[block.contentType] ?? TYPE_LABELS.text;
                    const TypeIcon = typeInfo.icon;
                    const isExpanded = expandedBlocks.has(block.id);

                    return (
                      <div
                        key={block.id}
                        className={`rounded-xl border transition-colors ${
                          block.visible
                            ? "border-border bg-card"
                            : "border-dashed border-muted-foreground/30 bg-muted/30"
                        }`}
                      >
                        {/* Block header */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpand(block.id)}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          <Badge variant="secondary" className={`${typeInfo.color} text-xs shrink-0`}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {typeInfo.label}
                          </Badge>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {block.blockKey}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                              {block.visible ? (
                                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <Switch
                                checked={block.visible}
                                onCheckedChange={(checked: boolean) =>
                                  toggleVisibility.mutate({ id: block.id, visible: checked })
                                }
                              />
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setHistoryBlock(block)}
                            >
                              <History className="h-3.5 w-3.5 mr-1" />
                              История
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditor(block)}
                            >
                              Редактировать
                            </Button>
                          </div>
                        </div>

                        {/* Expanded preview */}
                        {isExpanded && (
                          <div className="border-t border-border/50 px-4 py-3 bg-muted/20">
                            {block.contentType === "image" && block.imageUrl && (
                              <div className="mb-3">
                                <img
                                  src={block.imageUrl}
                                  alt={block.blockKey}
                                  className="h-32 w-auto rounded-lg object-cover border border-border"
                                />
                              </div>
                            )}
                            {block.content && (
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono bg-background rounded-lg p-3 border border-border/50">
                                {block.contentType === "json"
                                  ? formatJsonContent(block.content)
                                  : block.content}
                              </pre>
                            )}
                            {!block.content && !block.imageUrl && (
                              <p className="text-xs text-muted-foreground italic">
                                Пусто — используется значение по умолчанию из кода
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Удалить блок "${block.blockKey}"?`)) {
                                    deleteBlock.mutate({ id: block.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Удалить
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ─── Edit dialog ─── */}
      <Dialog
        open={!!editBlock}
        onOpenChange={(open) => {
          if (!open) {
            setEditBlock(null);
            setShowCropEditor(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Редактирование: {editBlock?.blockKey}
              {editBlock && (
                <Badge
                  variant="secondary"
                  className={`${TYPE_LABELS[editBlock.contentType]?.color ?? ""} text-xs`}
                >
                  {TYPE_LABELS[editBlock.contentType]?.label ?? editBlock.contentType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {editBlock && (
            <div className="space-y-5">
              {/* Text / Richtext / JSON content */}
              {(editBlock.contentType === "text" || editBlock.contentType === "richtext" || editBlock.contentType === "json") && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {editBlock.contentType === "json" ? "JSON-контент" : editBlock.contentType === "richtext" ? "Форматированный текст" : "Текст"}
                  </label>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={editBlock.contentType === "json" ? 12 : editBlock.contentType === "richtext" ? 6 : 4}
                    className={editBlock.contentType === "json" ? "font-mono text-sm" : "text-sm"}
                    placeholder={
                      editBlock.contentType === "json"
                        ? 'Формат JSON, например: [{"title": "...", "text": "..."}]'
                        : editBlock.contentType === "richtext"
                        ? "Введите форматированный текст..."
                        : "Введите текст..."
                    }
                  />
                  {editBlock.contentType === "json" && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          try {
                            setEditContent(JSON.stringify(JSON.parse(editContent), null, 2));
                            toast.success("JSON отформатирован");
                          } catch {
                            toast.error("Невалидный JSON");
                          }
                        }}
                      >
                        Форматировать JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          try {
                            JSON.parse(editContent);
                            toast.success("JSON валиден");
                          } catch (e) {
                            toast.error(`Ошибка JSON: ${(e as Error).message}`);
                          }
                        }}
                      >
                        Проверить JSON
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Image content */}
              {(editBlock.contentType === "image" || editBlock.contentType === "text" || editBlock.contentType === "richtext") && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {editBlock.contentType === "image" ? "Изображение" : "Изображение (опционально)"}
                  </label>

                  {/* Current image preview */}
                  {editImageUrl && !showCropEditor && (
                    <div className="mb-3 relative inline-block">
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        className="h-40 w-auto rounded-lg object-cover border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setEditImageUrl("")}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:bg-destructive/90"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Crop editor or upload buttons */}
                  {showCropEditor ? (
                    <div className="border border-border rounded-xl p-4 bg-muted/30">
                      <ImageCropEditor
                        onCropComplete={handleCropComplete}
                        onCancel={() => setShowCropEditor(false)}
                        aspectRatio={16 / 9}
                        maxOutputWidth={1200}
                        frameLabel="Область обрезки"
                      />
                      {uploading && (
                        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Загрузка на сервер...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        value={editImageUrl}
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        placeholder="URL изображения или загрузите файл ниже"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowCropEditor(true)}
                      >
                        <Crop className="h-4 w-4 mr-2" />
                        Загрузить и обрезать изображение
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Большие изображения (&gt;2 МБ) будут автоматически сжаты. Вы сможете визуально обрезать фото перед загрузкой.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!showCropEditor && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBlock(null)}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={updateContent.isPending}>
                {updateContent.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Сохранить
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── History dialog ─── */}
      <Dialog
        open={!!historyBlock}
        onOpenChange={(open) => {
          if (!open) setHistoryBlock(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              История изменений: {historyBlock?.blockKey}
            </DialogTitle>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => historyBlock && handleExportCsv(historyBlock.id)}
                disabled={!historyData || historyData.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Экспорт CSV блока
              </Button>
              <span className="text-xs text-muted-foreground">
                История хранится 30 дней
              </span>
            </div>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Загрузка истории...</span>
            </div>
          ) : !historyData || historyData.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Нет записей об изменениях для этого блока.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                История будет записываться при каждом изменении контента, загрузке изображения или переключении видимости.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {historyData.map((entry: HistoryEntry) => {
                const actionInfo = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "bg-gray-100 text-gray-800" };

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border bg-card p-4 space-y-3"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`${actionInfo.color} text-xs`}>
                          {actionInfo.label}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(entry.changedAt)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {entry.changedByName || entry.changedByOpenId.slice(0, 8)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRollbackConfirm(entry)}
                        disabled={rollbackBlock.isPending}
                        className="shrink-0"
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Откатить
                      </Button>
                    </div>

                    {/* Changes diff */}
                    <div className="space-y-2">
                      {/* Content change */}
                      {entry.prevContent !== entry.newContent && (
                        <div className="text-xs space-y-1">
                          <p className="font-medium text-muted-foreground">Контент:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 p-2">
                              <p className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1">Было:</p>
                              <p className="text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                                {truncateText(entry.prevContent, 200)}
                              </p>
                            </div>
                            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 p-2">
                              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">Стало:</p>
                              <p className="text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                                {truncateText(entry.newContent, 200)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Image change */}
                      {entry.prevImageUrl !== entry.newImageUrl && (
                        <div className="text-xs space-y-1">
                          <p className="font-medium text-muted-foreground">Изображение:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 p-2">
                              <p className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1">Было:</p>
                              {entry.prevImageUrl ? (
                                <img
                                  src={entry.prevImageUrl}
                                  alt="Previous"
                                  className="h-16 w-auto rounded object-cover"
                                />
                              ) : (
                                <p className="text-muted-foreground italic">нет изображения</p>
                              )}
                            </div>
                            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 p-2">
                              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">Стало:</p>
                              {entry.newImageUrl ? (
                                <img
                                  src={entry.newImageUrl}
                                  alt="New"
                                  className="h-16 w-auto rounded object-cover"
                                />
                              ) : (
                                <p className="text-muted-foreground italic">нет изображения</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visibility change */}
                      {entry.prevVisible !== entry.newVisible && (
                        <div className="text-xs flex items-center gap-2">
                          <p className="font-medium text-muted-foreground">Видимость:</p>
                          <Badge variant="secondary" className={entry.prevVisible ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}>
                            {entry.prevVisible ? "Видим" : "Скрыт"}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="secondary" className={entry.newVisible ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}>
                            {entry.newVisible ? "Видим" : "Скрыт"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <p className="text-xs text-muted-foreground/60 text-center pt-2">
                Показаны последние {historyData.length} записей. История хранится 30 дней.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryBlock(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rollback confirmation dialog ─── */}
      <Dialog
        open={!!rollbackConfirm}
        onOpenChange={(open) => {
          if (!open) setRollbackConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Подтвердите откат
            </DialogTitle>
          </DialogHeader>

          {rollbackConfirm && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Вы собираетесь откатить блок <strong>{rollbackConfirm.blockKey}</strong> к состоянию
                до изменения «{ACTION_LABELS[rollbackConfirm.action]?.label ?? rollbackConfirm.action}»
                от {formatDate(rollbackConfirm.changedAt)}.
              </p>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                  Блок будет восстановлен к:
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><strong>Контент:</strong> {truncateText(rollbackConfirm.prevContent, 120)}</p>
                  {rollbackConfirm.prevImageUrl && (
                    <div>
                      <strong>Изображение:</strong>
                      <img
                        src={rollbackConfirm.prevImageUrl}
                        alt="Restore preview"
                        className="h-16 w-auto rounded mt-1 object-cover"
                      />
                    </div>
                  )}
                  <p><strong>Видимость:</strong> {rollbackConfirm.prevVisible ? "Видим" : "Скрыт"}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Текущее состояние блока будет сохранено в истории перед откатом.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (rollbackConfirm) {
                  rollbackBlock.mutate({ historyId: rollbackConfirm.id });
                }
              }}
              disabled={rollbackBlock.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {rollbackBlock.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Undo2 className="h-4 w-4 mr-1" />
              )}
              Откатить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Seed confirmation dialog ─── */}
      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Инициализация контент-блоков</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Будут созданы все контент-блоки для страницы «{PAGE_LABELS[activePage]}» с текущими
            значениями из кода. Существующие блоки не будут перезаписаны.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => seedDefaults.mutate({ page: activePage })}
              disabled={seedDefaults.isPending}
            >
              {seedDefaults.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Инициализировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
