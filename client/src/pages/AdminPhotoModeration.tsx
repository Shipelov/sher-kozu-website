import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, navigateToLogin } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Camera,
  Clock3,
  User,
  ImageIcon,
  Loader2,
  AlertTriangle,
  CheckCheck,
  XOctagon,
} from "lucide-react";

export default function AdminPhotoModeration() {
  const { user, loading, isAuthenticated } = useAuth();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectPhotoId, setRejectPhotoId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchRejectDialogOpen, setBatchRejectDialogOpen] = useState(false);
  const [batchRejectionReason, setBatchRejectionReason] = useState("");

  const pendingPhotos = trpc.animalPhotos.pendingList.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const pendingCount = trpc.animalPhotos.pendingCount.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const utils = trpc.useUtils();

  const moderateMutation = trpc.animalPhotos.moderate.useMutation({
    onSuccess: (_data, variables) => {
      const actionLabel = variables.action === "approve" ? "одобрено" : "отклонено";
      toast.success(`Фото ${actionLabel}`);
      utils.animalPhotos.pendingList.invalidate();
      utils.animalPhotos.pendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка модерации");
    },
  });

  const batchModerateMutation = trpc.animalPhotos.batchModerate.useMutation({
    onSuccess: (data, variables) => {
      const actionLabel = variables.action === "approve" ? "одобрено" : "отклонено";
      toast.success(`${data.succeeded} из ${data.processed} фото ${actionLabel}`);
      setSelectedIds(new Set());
      utils.animalPhotos.pendingList.invalidate();
      utils.animalPhotos.pendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка пакетной модерации");
    },
  });

  const photos = pendingPhotos.data ?? [];
  const count = pendingCount.data ?? 0;

  const allSelected = useMemo(
    () => photos.length > 0 && photos.every((p: any) => selectedIds.has(p.id)),
    [photos, selectedIds],
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map((p: any) => p.id)));
    }
  };

  const handleApprove = (photoId: number) => {
    moderateMutation.mutate({ photoId, action: "approve" });
  };

  const handleRejectStart = (photoId: number) => {
    setRejectPhotoId(photoId);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (rejectPhotoId === null) return;
    moderateMutation.mutate({
      photoId: rejectPhotoId,
      action: "reject",
      rejectionReason: rejectionReason.trim() || undefined,
    });
    setRejectDialogOpen(false);
    setRejectPhotoId(null);
  };

  const handleBatchApprove = () => {
    if (selectedIds.size === 0) return;
    batchModerateMutation.mutate({
      photoIds: Array.from(selectedIds),
      action: "approve",
    });
  };

  const handleBatchRejectStart = () => {
    if (selectedIds.size === 0) return;
    setBatchRejectionReason("");
    setBatchRejectDialogOpen(true);
  };

  const handleBatchRejectConfirm = () => {
    batchModerateMutation.mutate({
      photoIds: Array.from(selectedIds),
      action: "reject",
      rejectionReason: batchRejectionReason.trim() || undefined,
    });
    setBatchRejectDialogOpen(false);
  };

  const isBusy = moderateMutation.isPending || batchModerateMutation.isPending;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated || !user) {
    navigateToLogin("/admin/photo-moderation");
    return null;
  }

  if (user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">{NOT_ADMIN_ERR_MSG}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-5xl py-6">
        <PageBreadcrumbs
          items={[
            { label: "Админ-панель", href: "/admin" },
            { label: "Модерация фото" },
          ]}
        />

        <div className="mt-4 flex items-center gap-3">
          <Camera className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Модерация фото</h1>
          {count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <Clock3 className="h-3 w-3" />
              {count} на проверке
            </span>
          )}
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Фото, загруженные пользователями, ожидают вашей проверки перед публикацией в галерее.
        </p>

        {pendingPhotos.isLoading ? (
          <div className="mt-8 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-lg font-medium">Все фото проверены</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Новые загрузки от пользователей появятся здесь автоматически.
            </p>
          </div>
        ) : (
          <>
            {/* Batch action bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="select-none">
                  {allSelected ? "Снять выделение" : "Выбрать все"}
                </span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  Выбрано: {selectedIds.size}
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={selectedIds.size === 0 || isBusy}
                  onClick={handleBatchApprove}
                >
                  {batchModerateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  )}
                  Одобрить ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/20"
                  disabled={selectedIds.size === 0 || isBusy}
                  onClick={handleBatchRejectStart}
                >
                  {batchModerateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <XOctagon className="h-3.5 w-3.5 mr-1" />
                  )}
                  Отклонить ({selectedIds.size})
                </Button>
              </div>
            </div>

            {/* Photo grid */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo: any) => {
                const isSelected = selectedIds.has(photo.id);
                return (
                  <Card
                    key={photo.id}
                    className={`overflow-hidden transition ${isSelected ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(photo.url)}
                        className="block w-full"
                      >
                        <img
                          src={photo.url}
                          alt={photo.title}
                          className="h-48 w-full object-cover transition hover:opacity-90"
                        />
                      </button>
                      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
                        <Clock3 className="h-2.5 w-2.5" />
                        На проверке
                      </div>
                      <div className="absolute top-2 right-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(photo.id)}
                          className="h-5 w-5 border-2 border-white bg-white/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{photo.uploaderName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {photo.animalSlug} · {photo.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {photo.createdAt
                          ? new Date(photo.createdAt).toLocaleString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleApprove(photo.id)}
                          disabled={isBusy}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/20"
                          onClick={() => handleRejectStart(photo.id)}
                          disabled={isBusy}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Отклонить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Single reject reason dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                Отклонить фото
              </DialogTitle>
              <DialogDescription>
                Укажите причину отклонения (необязательно). Пользователь увидит причину в галерее.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Причина отклонения..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              maxLength={255}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={isBusy}
              >
                Отклонить
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Batch reject reason dialog */}
        <Dialog open={batchRejectDialogOpen} onOpenChange={setBatchRejectDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XOctagon className="h-5 w-5 text-rose-500" />
                Отклонить {selectedIds.size} фото
              </DialogTitle>
              <DialogDescription>
                Укажите общую причину отклонения (необязательно). Все выбранные фото будут отклонены.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Причина отклонения..."
              value={batchRejectionReason}
              onChange={(e) => setBatchRejectionReason(e.target.value)}
              maxLength={255}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchRejectDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBatchRejectConfirm}
                disabled={batchModerateMutation.isPending}
              >
                {batchModerateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : null}
                Отклонить {selectedIds.size} фото
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full-size preview dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Предпросмотр фото</DialogTitle>
              <DialogDescription>Полноразмерное фото на модерации</DialogDescription>
            </DialogHeader>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Предпросмотр"
                className="w-full max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
