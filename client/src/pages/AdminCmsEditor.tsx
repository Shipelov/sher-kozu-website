import { useState, useRef, useCallback, useMemo } from "react";
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
} from "lucide-react";

/* ─── Block type display helpers ─── */
const TYPE_LABELS: Record<string, { label: string; icon: typeof Type; color: string }> = {
  text: { label: "Текст", icon: Type, color: "bg-blue-100 text-blue-800" },
  image: { label: "Изображение", icon: ImageIcon, color: "bg-emerald-100 text-emerald-800" },
  json: { label: "JSON", icon: FileJson, color: "bg-amber-100 text-amber-800" },
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

export default function AdminCmsEditor() {
  const { user, loading: authLoading } = useAuth();
  const [activePage, setActivePage] = useState("home");
  const [editBlock, setEditBlock] = useState<CmsBlock | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  /* ─── Queries ─── */
  const { data: allBlocks, isLoading } = trpc.cms.listAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  /* ─── Mutations ─── */
  const updateContent = trpc.cms.updateContent.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      toast.success("Контент обновлён");
      setEditBlock(null);
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const toggleVisibility = trpc.cms.toggleVisibility.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      toast.success("Видимость изменена");
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const uploadImage = trpc.cms.uploadImage.useMutation({
    onSuccess: (data) => {
      setEditImageUrl(data.url);
      setUploading(false);
      toast.success("Изображение загружено");
    },
    onError: (err) => {
      setUploading(false);
      toast.error(`Ошибка загрузки: ${err.message}`);
    },
  });

  const seedDefaults = trpc.cms.seedDefaults.useMutation({
    onSuccess: (data) => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      setSeedDialogOpen(false);
      toast.success(`Инициализировано ${data.seeded} блоков для страницы "${activePage}"`);
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const deleteBlock = trpc.cms.deleteBlock.useMutation({
    onSuccess: () => {
      utils.cms.listAll.invalidate();
      utils.cms.getPageBlocks.invalidate();
      toast.success("Блок удалён");
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  /* ─── Filtered blocks for active page ─── */
  const pageBlocks = useMemo(
    () => (allBlocks ?? []).filter((b: CmsBlock) => b.page === activePage).sort((a: CmsBlock, b: CmsBlock) => a.sortOrder - b.sortOrder),
    [allBlocks, activePage]
  );

  /* ─── Handlers ─── */
  const openEditor = useCallback((block: CmsBlock) => {
    setEditBlock(block);
    setEditContent(block.content ?? "");
    setEditImageUrl(block.imageUrl ?? "");
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

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editBlock) return;

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Файл слишком большой (макс. 5 МБ)");
        return;
      }

      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadImage.mutate({
          blockId: editBlock.id,
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64,
        });
      };
      reader.readAsDataURL(file);
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
                                onCheckedChange={(checked) =>
                                  toggleVisibility.mutate({ id: block.id, visible: checked })
                                }
                              />
                            </div>

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
      <Dialog open={!!editBlock} onOpenChange={(open) => !open && setEditBlock(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Редактирование: {editBlock?.blockKey}
              {editBlock && (
                <Badge variant="secondary" className={`${TYPE_LABELS[editBlock.contentType]?.color ?? ""} text-xs`}>
                  {TYPE_LABELS[editBlock.contentType]?.label ?? editBlock.contentType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {editBlock && (
            <div className="space-y-5">
              {/* Text / JSON content */}
              {(editBlock.contentType === "text" || editBlock.contentType === "json") && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {editBlock.contentType === "json" ? "JSON-контент" : "Текст"}
                  </label>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={editBlock.contentType === "json" ? 12 : 4}
                    className="font-mono text-sm"
                    placeholder={
                      editBlock.contentType === "json"
                        ? 'Формат JSON, например: [{"title": "...", "text": "..."}]'
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
              {(editBlock.contentType === "image" || editBlock.contentType === "text") && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {editBlock.contentType === "image" ? "Изображение" : "Изображение (опционально)"}
                  </label>

                  {editImageUrl && (
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

                  <div className="flex gap-2">
                    <Input
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="URL изображения или загрузите файл"
                      className="flex-1"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBlock(null)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateContent.isPending}
            >
              {updateContent.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Сохранить
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
            Будут созданы все контент-блоки для страницы «{PAGE_LABELS[activePage]}» с текущими значениями из кода.
            Существующие блоки не будут перезаписаны.
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
