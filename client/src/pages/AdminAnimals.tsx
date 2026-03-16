import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  ImagePlus,
  Leaf,
  Loader2,
  Milk,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type AdminAnimalStatus = "public_available" | "public_limited" | "fully_booked" | "hidden" | "archived";
type AdminAnimalSpecies = "goat" | "sheep";
type AdminVisibilityMode = "public" | "hidden" | "archived";

type AdminAnimalMediaItem = {
  kind: "image" | "video" | "document";
  title: string;
  alt?: string | null;
  fileKey: string;
  url: string;
  mimeType: string;
  sortOrder: number;
  isCover: boolean;
};

type AdminAnimalRecord = {
  id: number;
  slug: string;
  name: string;
  species: AdminAnimalSpecies;
  breed: string | null;
  shortDescription?: string | null;
  story?: string | null;
  galleryIntro?: string | null;
  status: AdminAnimalStatus;
  totalOwnershipSlots: number;
  activeOwnerships: number;
  availableSlots: number;
  baseMonthlyPriceMinor: number;
  healthScore: number;
  happinessScore: number;
  milkPotentialScore: number;
  careLevelScore?: number;
  isFeatured: number | boolean;
  sortOrder?: number;
  coverImageUrl: string | null;
  publishedAt?: string | number | null;
  media?: AdminAnimalMediaItem[];
};

type AnimalFormValues = {
  id?: number;
  name: string;
  slug: string;
  species: AdminAnimalSpecies;
  breed: string;
  shortDescription: string;
  story: string;
  coverImageUrl: string;
  galleryIntro: string;
  status: AdminAnimalStatus;
  totalOwnershipSlots: number;
  baseMonthlyPriceMinor: number;
  healthScore: number;
  happinessScore: number;
  milkPotentialScore: number;
  careLevelScore: number;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string;
};

type GalleryPhoto = {
  id: string;
  photoId: number;
  src: string;
  title: string;
  meta: string;
  alt?: string | null;
  isUploaded: true;
  ownerOpenId: string;
  createdAt: string | number | Date;
  isCover: boolean;
  sortOrder: number;
};

type GalleryPhotoDrafts = Record<number, { title: string; alt: string }>;

export function createPhotoDraft(photo: Pick<GalleryPhoto, "title" | "alt" | "meta">) {
  return {
    title: photo.title,
    alt: photo.alt ?? photo.meta ?? "",
  };
}

export function hasPhotoDraftChanges(
  photo: Pick<GalleryPhoto, "title" | "alt" | "meta">,
  draft?: { title: string; alt: string }
) {
  if (!draft) return false;

  const initial = createPhotoDraft(photo);
  return draft.title.trim() !== initial.title.trim() || draft.alt.trim() !== initial.alt.trim();
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_UPLOAD_SIZE_BYTES = 8_000_000;

const formatPrice = (minor: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(minor / 100);

export const createEmptyAnimalForm = (): AnimalFormValues => ({
  name: "",
  slug: "",
  species: "goat",
  breed: "",
  shortDescription: "",
  story: "",
  coverImageUrl: "",
  galleryIntro: "",
  status: "hidden",
  totalOwnershipSlots: 3,
  baseMonthlyPriceMinor: 120000,
  healthScore: 75,
  happinessScore: 75,
  milkPotentialScore: 75,
  careLevelScore: 75,
  isFeatured: false,
  sortOrder: 0,
  publishedAt: "",
});

export function normalizeAnimalFormValues(animal?: AdminAnimalRecord | null): AnimalFormValues {
  if (!animal) return createEmptyAnimalForm();

  const publishedAtValue = animal.publishedAt
    ? new Date(typeof animal.publishedAt === "number" ? animal.publishedAt : animal.publishedAt).toISOString().slice(0, 16)
    : "";

  return {
    id: animal.id,
    name: animal.name,
    slug: animal.slug,
    species: animal.species,
    breed: animal.breed ?? "",
    shortDescription: animal.shortDescription ?? "",
    story: animal.story ?? "",
    coverImageUrl: animal.coverImageUrl ?? "",
    galleryIntro: animal.galleryIntro ?? "",
    status: animal.status,
    totalOwnershipSlots: animal.totalOwnershipSlots,
    baseMonthlyPriceMinor: animal.baseMonthlyPriceMinor,
    healthScore: animal.healthScore,
    happinessScore: animal.happinessScore,
    milkPotentialScore: animal.milkPotentialScore,
    careLevelScore: animal.careLevelScore ?? 50,
    isFeatured: Boolean(animal.isFeatured),
    sortOrder: animal.sortOrder ?? 0,
    publishedAt: publishedAtValue,
  };
}

export function slugifyAnimalName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function trimToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildAnimalMutationPayload(values: AnimalFormValues, media: AdminAnimalMediaItem[] = []) {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    species: values.species,
    breed: trimToNull(values.breed),
    shortDescription: values.shortDescription.trim(),
    story: trimToNull(values.story),
    coverImageUrl: trimToNull(values.coverImageUrl),
    galleryIntro: trimToNull(values.galleryIntro),
    status: values.status,
    totalOwnershipSlots: values.totalOwnershipSlots,
    baseMonthlyPriceMinor: values.baseMonthlyPriceMinor,
    healthScore: values.healthScore,
    happinessScore: values.happinessScore,
    milkPotentialScore: values.milkPotentialScore,
    careLevelScore: values.careLevelScore,
    isFeatured: values.isFeatured,
    sortOrder: values.sortOrder,
    publishedAt: values.publishedAt ? new Date(values.publishedAt).getTime() : null,
    media: media.map((item, index) => ({
      kind: "image" as const,
      title: item.title.trim() || `Фото ${index + 1}`,
      alt: trimToNull(item.alt ?? ""),
      fileKey: item.fileKey,
      url: item.url,
      mimeType: item.mimeType,
      sortOrder: index,
      isCover: Boolean(item.isCover),
    })),
  };
}

export function buildAnimalGalleryMedia(photos: GalleryPhoto[]): AdminAnimalMediaItem[] {
  return [...photos]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((photo, index) => ({
      kind: "image" as const,
      title: photo.title,
      alt: trimToNull(photo.alt ?? photo.meta ?? "") ?? photo.title,
      fileKey: photo.id,
      url: photo.src,
      mimeType: "image/jpeg",
      sortOrder: photo.sortOrder ?? index,
      isCover: photo.isCover,
    }));
}

export function validateGalleryUpload(type: string, sizeBytes: number) {
  return {
    hasAllowedType: ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number]),
    hasAllowedSize: sizeBytes <= MAX_UPLOAD_SIZE_BYTES,
  };
}

export function mergeCoverIntoForm(values: AnimalFormValues, photos: GalleryPhoto[]) {
  const cover = photos.find((photo) => photo.isCover) ?? photos[0];
  if (!cover) return values;
  return {
    ...values,
    coverImageUrl: cover.src,
  };
}

export function getStatusBadge(status: AdminAnimalStatus) {
  if (status === "public_available") {
    return { label: "Доступно", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }
  if (status === "public_limited") {
    return { label: "Слотов мало", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  if (status === "fully_booked") {
    return { label: "Заполнено", className: "border-stone-300 bg-stone-100 text-stone-700" };
  }
  if (status === "archived") {
    return { label: "Архив", className: "border-slate-300 bg-slate-100 text-slate-700" };
  }
  return { label: "Скрыто", className: "border-rose-200 bg-rose-50 text-rose-800" };
}

function getSpeciesLabel(species: AdminAnimalSpecies) {
  return species === "goat" ? "Коза" : "Овца";
}

export function getNextVisibilityMode(status: AdminAnimalStatus): AdminVisibilityMode {
  if (status === "hidden") return "public";
  return "hidden";
}

function getVisibilityActionLabel(status: AdminAnimalStatus) {
  return status === "hidden" ? "Опубликовать" : "Скрыть";
}

export function filterAdminAnimals(
  animals: AdminAnimalRecord[],
  query: string,
  status: AdminAnimalStatus | "all",
  species: AdminAnimalSpecies | "all"
) {
  const normalizedQuery = query.trim().toLowerCase();

  return animals.filter((animal) => {
    const matchesQuery = !normalizedQuery
      || [animal.name, animal.slug, animal.breed ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === "all" || animal.status === status;
    const matchesSpecies = species === "all" || animal.species === species;

    return matchesQuery && matchesStatus && matchesSpecies;
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function AdminAnimalsTable({
  animals,
  onToggleVisibility,
  onEdit,
  isUpdating,
}: {
  animals: AdminAnimalRecord[];
  onToggleVisibility: (animal: AdminAnimalRecord) => void;
  onEdit: (animal: AdminAnimalRecord) => void;
  isUpdating: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Животное</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Слоты</TableHead>
            <TableHead>Показатели</TableHead>
            <TableHead>Цена</TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animals.map((animal) => {
            const statusBadge = getStatusBadge(animal.status);
            return (
              <TableRow key={animal.id} className="align-top">
                <TableCell>
                  <div className="flex gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-stone-100">
                      {animal.coverImageUrl ? (
                        <img src={animal.coverImageUrl} alt={animal.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-400">
                          {animal.species === "goat" ? <Milk className="h-5 w-5" /> : <Leaf className="h-5 w-5" />}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{animal.name}</p>
                        {animal.isFeatured ? (
                          <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary">Featured</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{getSpeciesLabel(animal.species)} · {animal.breed || "Порода уточняется"}</p>
                      <p className="text-xs text-muted-foreground">slug: {animal.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`rounded-full border ${statusBadge.className}`}>{statusBadge.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{animal.availableSlots} свободно / {animal.totalOwnershipSlots}</p>
                    <p className="text-muted-foreground">Активных: {animal.activeOwnerships}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <span>Здоровье: {animal.healthScore}</span>
                    <span>Счастье: {animal.happinessScore}</span>
                    <span>Молоко: {animal.milkPotentialScore}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{formatPrice(animal.baseMonthlyPriceMinor)}</p>
                  <p className="text-xs text-muted-foreground">sort: {animal.sortOrder ?? 0}</p>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => onEdit(animal)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </Button>
                    <Link href={`/animals/${animal.slug}`}>
                      <Button variant="outline" size="sm" className="rounded-full">
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Открыть
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => onToggleVisibility(animal)}
                      disabled={isUpdating || animal.status === "archived"}
                    >
                      {animal.status === "hidden" ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                      {getVisibilityActionLabel(animal.status)}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function AnimalGalleryManager({
  animalSlug,
  values,
  onCoverChange,
}: {
  animalSlug: string;
  values: AnimalFormValues;
  onCoverChange: (url: string) => void;
}) {
  const utils = trpc.useUtils();
  const [photoDrafts, setPhotoDrafts] = useState<GalleryPhotoDrafts>({});
  const photosQuery = trpc.animalPhotos.list.useQuery(
    { animalSlug },
    { enabled: Boolean(animalSlug.trim()) }
  );

  const galleryImages = useMemo(() => [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [photosQuery.data]);

  useEffect(() => {
    setPhotoDrafts((current) => {
      const next: GalleryPhotoDrafts = {};
      for (const image of galleryImages) {
        next[image.photoId] = current[image.photoId] ?? {
          title: image.title,
          alt: image.alt ?? image.meta ?? "",
        };
      }
      return next;
    });
  }, [galleryImages]);

  const uploadPhoto = trpc.animalPhotos.upload.useMutation({
    onSuccess: async (created) => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      if (galleryImages.length === 0) {
        onCoverChange(created.src);
      }
      toast.success("Фото сохранено", {
        description: "Изображение добавлено в постоянную галерею животного.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось загрузить фото", {
        description: error.message,
      });
    },
  });

  const setCoverPhoto = trpc.animalPhotos.setCover.useMutation({
    onSuccess: async ({ photoId }) => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      const cover = galleryImages.find((item) => item.photoId === photoId);
      if (cover) {
        onCoverChange(cover.src);
      }
      toast.success("Обложка обновлена", {
        description: "Главное фото карточки синхронизировано с галереей.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось обновить обложку", {
        description: error.message,
      });
    },
  });

  const removePhoto = trpc.animalPhotos.remove.useMutation({
    onSuccess: async ({ photoId }) => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      setPhotoDrafts((current) => {
        const next = { ...current };
        delete next[photoId];
        return next;
      });
      const remaining = galleryImages.filter((item) => item.photoId !== photoId);
      const cover = remaining.find((item) => item.isCover) ?? remaining[0];
      if (cover) {
        onCoverChange(cover.src);
      }
      toast.success("Фото удалено", {
        description: "Изображение убрано из постоянной галереи животного.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить фото", {
        description: error.message,
      });
    },
  });

  const updatePhotoMeta = trpc.animalPhotos.updateMeta.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Подписи фото обновлены", {
        description: "Название и alt-текст сохранены в галерее животного.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить подписи фото", {
        description: error.message,
      });
    },
  });

  const reorderPhotos = trpc.animalPhotos.reorder.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Порядок фото сохранён", {
        description: "Миниатюры галереи обновлены.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить порядок", {
        description: error.message,
      });
    },
  });

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validation = validateGalleryUpload(file.type, file.size);
    if (!validation.hasAllowedType) {
      toast.error("Неподдерживаемый формат", {
        description: "Загрузите JPG, PNG или WebP файл.",
      });
      return;
    }
    if (!validation.hasAllowedSize) {
      toast.error("Файл слишком большой", {
        description: "Максимальный размер изображения — 8 МБ.",
      });
      return;
    }

    try {
      const base64Data = await fileToBase64(file);
      await uploadPhoto.mutateAsync({
        animalSlug,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        base64Data,
      });
    } catch (error) {
      toast.error("Не удалось подготовить файл", {
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
      });
    }
  }

  function movePhoto(photoId: number, direction: "left" | "right") {
    const ids = galleryImages.map((item) => item.photoId);
    const currentIndex = ids.indexOf(photoId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;

    const reorderedIds = [...ids];
    const [moved] = reorderedIds.splice(currentIndex, 1);
    reorderedIds.splice(targetIndex, 0, moved);

    reorderPhotos.mutate({ animalSlug, photoIds: reorderedIds });
  }

  function updateDraft(photo: GalleryPhoto, key: "title" | "alt", value: string) {
    setPhotoDrafts((current) => {
      const initial = createPhotoDraft(photo);
      return {
        ...current,
        [photo.photoId]: {
          title: current[photo.photoId]?.title ?? initial.title,
          alt: current[photo.photoId]?.alt ?? initial.alt,
          [key]: value,
        },
      };
    });
  }

  async function savePhotoMeta(photo: GalleryPhoto) {
    const draft = photoDrafts[photo.photoId] ?? createPhotoDraft(photo);

    await updatePhotoMeta.mutateAsync({
      photoId: photo.photoId,
      title: draft.title.trim() || "Фото животного",
      alt: draft.alt.trim() || null,
    });

    setPhotoDrafts((current) => {
      const next = { ...current };
      delete next[photo.photoId];
      return next;
    });
  }

  return (
    <div className="space-y-4 rounded-[1.75rem] border border-border/70 bg-stone-50/60 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Галерея животного</h3>
          <p className="text-sm text-muted-foreground">
            Загрузите фотографии, задайте обложку и управляйте порядком показа миниатюр в карточке животного.
          </p>
        </div>
        <Label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploadPhoto.isPending ? "Загрузка..." : "Добавить фото"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploadPhoto.isPending} />
        </Label>
      </div>

      {!animalSlug ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/80 p-4 text-sm text-muted-foreground">
          Сначала укажите slug животного. Галерея привязывается к нему и становится доступной сразу после редактирования.
        </div>
      ) : photosQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загружаем фотографии...
        </div>
      ) : galleryImages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/80 p-5 text-sm text-muted-foreground">
          Пока нет загруженных изображений. Добавьте первое фото, чтобы сформировать обложку карточки и галерею.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {galleryImages.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-[1.5rem] border border-border bg-background shadow-sm">
              <div className="aspect-square overflow-hidden bg-stone-100">
                <img src={image.src} alt={image.title} className="h-full w-full object-cover" />
              </div>
                <div className="space-y-3 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 font-medium text-foreground">{image.title}</p>
                      {image.isCover ? (
                        <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary">
                          <Star className="mr-1 h-3 w-3" /> Обложка
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{image.meta}</p>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-border/70 bg-stone-50/80 p-3">
                    <div className="space-y-2">
                      <Label htmlFor={`photo-title-${image.photoId}`}>Название фото</Label>
                      <Input
                        id={`photo-title-${image.photoId}`}
                        value={photoDrafts[image.photoId]?.title ?? createPhotoDraft(image).title}
                        onChange={(event) => updateDraft(image, "title", event.target.value)}
                        placeholder="Утренний портрет"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`photo-alt-${image.photoId}`}>Alt-текст</Label>
                      <Textarea
                        id={`photo-alt-${image.photoId}`}
                        value={photoDrafts[image.photoId]?.alt ?? createPhotoDraft(image).alt}
                        onChange={(event) => updateDraft(image, "alt", event.target.value)}
                        placeholder="Коза Марта у деревянного загона на утреннем свете"
                        rows={3}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => void savePhotoMeta(image)}
                      disabled={updatePhotoMeta.isPending || !hasPhotoDraftChanges(image, photoDrafts[image.photoId])}
                    >
                      {updatePhotoMeta.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                      Сохранить подписи
                    </Button>
                  </div>

                  <div className="grid gap-2">

                  <Button
                    type="button"
                    variant={image.isCover ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setCoverPhoto.mutate({ photoId: image.photoId })}
                    disabled={setCoverPhoto.isPending || image.isCover}
                  >
                    <Star className="mr-2 h-4 w-4" />
                    {image.isCover ? "Текущая обложка" : "Сделать обложкой"}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => movePhoto(image.photoId, "left")}
                      disabled={reorderPhotos.isPending || index === 0}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Влево
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => movePhoto(image.photoId, "right")}
                      disabled={reorderPhotos.isPending || index === galleryImages.length - 1}
                    >
                      Вправо <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => removePhoto.mutate({ photoId: image.photoId })}
                    disabled={removePhoto.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
        Текущее cover image URL карточки: <span className="font-medium text-foreground">{values.coverImageUrl || "будет заполнен после выбора обложки"}</span>
      </div>
    </div>
  );
}

function AnimalEditorCard({
  mode,
  values,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  mode: "create" | "edit";
  values: AnimalFormValues;
  onChange: <K extends keyof AnimalFormValues>(key: K, value: AnimalFormValues[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const gallerySlug = values.slug.trim();

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {mode === "create" ? <Plus className="h-5 w-5 text-primary" /> : <Pencil className="h-5 w-5 text-primary" />}
          {mode === "create" ? "Создать животное" : "Редактировать животное"}
        </CardTitle>
        <CardDescription>
          Заполните базовую информацию карточки, а затем управляйте постоянной галереей прямо из этой формы без ручной вставки URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="animal-name">Имя</Label>
            <Input id="animal-name" value={values.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Марта" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-slug">Slug</Label>
            <div className="flex gap-2">
              <Input id="animal-slug" value={values.slug} onChange={(event) => onChange("slug", event.target.value)} placeholder="marta" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => onChange("slug", slugifyAnimalName(values.name))}>
                Из имени
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Вид</Label>
            <Select value={values.species} onValueChange={(value) => onChange("species", value as AdminAnimalSpecies)}>
              <SelectTrigger><SelectValue placeholder="Вид" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="goat">Коза</SelectItem>
                <SelectItem value="sheep">Овца</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-breed">Порода</Label>
            <Input id="animal-breed" value={values.breed} onChange={(event) => onChange("breed", event.target.value)} placeholder="Англо-нубийская" />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="animal-short-description">Короткое описание</Label>
            <Textarea
              id="animal-short-description"
              value={values.shortDescription}
              onChange={(event) => onChange("shortDescription", event.target.value)}
              placeholder="Короткое публичное описание для витрины и карточки животного"
              className="min-h-[96px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-story">История</Label>
            <Textarea
              id="animal-story"
              value={values.story}
              onChange={(event) => onChange("story", event.target.value)}
              placeholder="Развернутая история животного, происхождение, особенности характера"
              className="min-h-[132px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-gallery-intro">Вступление к галерее</Label>
            <Textarea
              id="animal-gallery-intro"
              value={values.galleryIntro}
              onChange={(event) => onChange("galleryIntro", event.target.value)}
              placeholder="Короткий текст перед блоком фотографий и медиа"
              className="min-h-[96px]"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="animal-cover">Cover image URL</Label>
            <Input id="animal-cover" value={values.coverImageUrl} onChange={(event) => onChange("coverImageUrl", event.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select value={values.status} onValueChange={(value) => onChange("status", value as AdminAnimalStatus)}>
              <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public_available">Доступно</SelectItem>
                <SelectItem value="public_limited">Слотов мало</SelectItem>
                <SelectItem value="fully_booked">Заполнено</SelectItem>
                <SelectItem value="hidden">Скрыто</SelectItem>
                <SelectItem value="archived">Архив</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-published-at">Дата публикации</Label>
            <Input id="animal-published-at" type="datetime-local" value={values.publishedAt} onChange={(event) => onChange("publishedAt", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-sort-order">Sort order</Label>
            <Input
              id="animal-sort-order"
              type="number"
              min={0}
              max={9999}
              value={values.sortOrder}
              onChange={(event) => onChange("sortOrder", Number(event.target.value || 0))}
            />
          </div>
        </div>

        <AnimalGalleryManager animalSlug={gallerySlug} values={values} onCoverChange={(url) => onChange("coverImageUrl", url)} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="animal-slots">Ownership slots</Label>
            <Input
              id="animal-slots"
              type="number"
              min={1}
              max={3}
              value={values.totalOwnershipSlots}
              onChange={(event) => onChange("totalOwnershipSlots", Number(event.target.value || 1))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-price">Цена в minor units</Label>
            <Input
              id="animal-price"
              type="number"
              min={0}
              max={100000000}
              value={values.baseMonthlyPriceMinor}
              onChange={(event) => onChange("baseMonthlyPriceMinor", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-health">Здоровье</Label>
            <Input
              id="animal-health"
              type="number"
              min={0}
              max={100}
              value={values.healthScore}
              onChange={(event) => onChange("healthScore", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-happiness">Счастье</Label>
            <Input
              id="animal-happiness"
              type="number"
              min={0}
              max={100}
              value={values.happinessScore}
              onChange={(event) => onChange("happinessScore", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-milk">Потенциал молока</Label>
            <Input
              id="animal-milk"
              type="number"
              min={0}
              max={100}
              value={values.milkPotentialScore}
              onChange={(event) => onChange("milkPotentialScore", Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-care">Уход</Label>
            <Input
              id="animal-care"
              type="number"
              min={0}
              max={100}
              value={values.careLevelScore}
              onChange={(event) => onChange("careLevelScore", Number(event.target.value || 0))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3">
          <Checkbox
            id="animal-featured"
            checked={values.isFeatured}
            onCheckedChange={(checked) => onChange("isFeatured", Boolean(checked))}
          />
          <div>
            <Label htmlFor="animal-featured" className="text-sm font-medium text-foreground">Показывать как featured</Label>
            <p className="text-xs text-muted-foreground">Помогает выделять животное в витрине и приоритетных подборках.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" className="rounded-full" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === "create" ? <Plus className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
            {mode === "create" ? "Создать карточку" : "Сохранить изменения"}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={isSubmitting}>
            Отменить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAnimals() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const animalsQuery = trpc.adminAnimals.list.useQuery(undefined, {
    enabled: !loading && Boolean(user),
    retry: false,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminAnimalStatus | "all">("all");
  const [speciesFilter, setSpeciesFilter] = useState<AdminAnimalSpecies | "all">("all");
  const [location] = useLocation();
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [formValues, setFormValues] = useState<AnimalFormValues>(createEmptyAnimalForm());
  const [editingAnimalId, setEditingAnimalId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const incomingStatus = params.get("status");

    if (incomingStatus === "published") {
      setStatusFilter("public_available");
      return;
    }

    if (incomingStatus === "hidden" || incomingStatus === "archived") {
      setStatusFilter(incomingStatus);
    }
  }, [location]);

  const animals = animalsQuery.data ?? [];
  const filteredAnimals = useMemo(
    () => filterAdminAnimals(animals as AdminAnimalRecord[], searchQuery, statusFilter, speciesFilter),
    [animals, searchQuery, statusFilter, speciesFilter]
  );

  const createAnimal = trpc.adminAnimals.create.useMutation({
    onSuccess: async () => {
      await utils.adminAnimals.list.invalidate();
      toast.success("Животное создано", {
        description: "Новая карточка добавлена в каталог и доступна для дальнейшей настройки.",
      });
      resetEditor();
    },
    onError: (error) => {
      toast.error("Не удалось создать карточку", {
        description: error.message,
      });
    },
  });

  const updateAnimal = trpc.adminAnimals.update.useMutation({
    onSuccess: async () => {
      await utils.adminAnimals.list.invalidate();
      toast.success("Изменения сохранены", {
        description: "Карточка животного обновлена.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить изменения", {
        description: error.message,
      });
    },
  });

  const setVisibility = trpc.adminAnimals.setVisibility.useMutation({
    onSuccess: async () => {
      await utils.adminAnimals.list.invalidate();
      toast.success("Статус обновлён", {
        description: "Видимость карточки животного изменена.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось изменить статус", {
        description: error.message,
      });
    },
  });

  function resetEditor() {
    setEditorMode("create");
    setEditingAnimalId(null);
    setFormValues(createEmptyAnimalForm());
  }

  function handleFormChange<K extends keyof AnimalFormValues>(key: K, value: AnimalFormValues[K]) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  function handleEdit(animal: AdminAnimalRecord) {
    setEditorMode("edit");
    setEditingAnimalId(animal.id);
    setFormValues(normalizeAnimalFormValues(animal));
  }

  function handleToggleVisibility(animal: AdminAnimalRecord) {
    const nextMode = getNextVisibilityMode(animal.status);
    setVisibility.mutate({ id: animal.id, mode: nextMode });
  }

  async function handleSubmit() {
    const payload = buildAnimalMutationPayload(formValues);

    if (!payload.name || !payload.slug || payload.shortDescription.length < 10) {
      toast.error("Проверьте обязательные поля", {
        description: "Имя, slug и короткое описание должны быть заполнены корректно.",
      });
      return;
    }

    if (editorMode === "create") {
      await createAnimal.mutateAsync(payload);
      return;
    }

    if (!editingAnimalId) {
      toast.error("Не найдено животное для редактирования");
      return;
    }

    await updateAnimal.mutateAsync({ id: editingAnimalId, ...payload });
  }

  useEffect(() => {
    if (!animals.length || editorMode !== "edit" || !editingAnimalId) return;
    const freshAnimal = animals.find((animal) => animal.id === editingAnimalId);
    if (freshAnimal) {
      setFormValues((current) => ({
        ...normalizeAnimalFormValues(freshAnimal as AdminAnimalRecord),
        coverImageUrl: current.coverImageUrl || freshAnimal.coverImageUrl || "",
      }));
    }
  }, [animals, editorMode, editingAnimalId]);

  const isForbidden = animalsQuery.error?.message === NOT_ADMIN_ERR_MSG;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Card className="rounded-[2rem] border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Проверяем доступ к админке животных…
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <Alert className="rounded-[2rem] border-amber-200 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Нужен вход в аккаунт</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>Маршрут `/admin/animals` доступен только после авторизации.</p>
              <Button asChild className="mt-1 rounded-full">
                <a href={getLoginUrl("/admin/animals")}>Войти и открыть админку животных</a>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7efe4_0%,#f4ede4_35%,#f9f6f2_100%)] text-foreground">
        <div className="container py-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_420px] xl:items-start">
            <section className="space-y-6">
              {isForbidden ? (
                <Alert variant="destructive" className="rounded-[2rem]">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Недостаточно прав</AlertTitle>
                  <AlertDescription>
                    Сервер вернул ограничение по роли. Проверьте, что у вашего пользователя в таблице `user` установлена роль `admin`.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary">
                        Операционный каталог
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]">
                        Роль: {String((user as { role?: string } | null)?.role ?? "user")}
                      </Badge>
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Управление животными Sprint 1</h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Команда фермы может управлять каталогом животных, быстро переключать видимость карточек, редактировать
                      ключевые показатели и наполнять витрину без обращения к базе данных вручную.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="rounded-[1.5rem] border-emerald-100 bg-emerald-50/80 shadow-none">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Sparkles className="h-5 w-5 text-emerald-700" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-emerald-800/80">В каталоге</p>
                          <p className="text-lg font-semibold text-emerald-900">{animals.length}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-amber-100 bg-amber-50/80 shadow-none">
                      <CardContent className="flex items-center gap-3 p-4">
                        <ShieldCheck className="h-5 w-5 text-amber-700" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-amber-800/80">Featured</p>
                          <p className="text-lg font-semibold text-amber-900">{animals.filter((animal) => Boolean(animal.isFeatured)).length}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-stone-200 bg-stone-50/90 shadow-none">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Milk className="h-5 w-5 text-stone-700" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-700/80">Доступно</p>
                          <p className="text-lg font-semibold text-stone-900">{animals.filter((animal) => animal.status === "public_available" || animal.status === "public_limited").length}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>

              <Card className="rounded-[2rem] border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Каталог животных</CardTitle>
                  <CardDescription>
                    Используйте поиск и фильтры, чтобы быстро находить карточки и управлять их публичной доступностью.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Поиск по имени, slug или породе"
                        className="h-11 rounded-full pl-11"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AdminAnimalStatus | "all")}>
                      <SelectTrigger className="h-11 rounded-full">
                        <SelectValue placeholder="Статус" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        <SelectItem value="public_available">Доступно</SelectItem>
                        <SelectItem value="public_limited">Слотов мало</SelectItem>
                        <SelectItem value="fully_booked">Заполнено</SelectItem>
                        <SelectItem value="hidden">Скрыто</SelectItem>
                        <SelectItem value="archived">Архив</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={speciesFilter} onValueChange={(value) => setSpeciesFilter(value as AdminAnimalSpecies | "all")}>
                      <SelectTrigger className="h-11 rounded-full">
                        <SelectValue placeholder="Вид" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все виды</SelectItem>
                        <SelectItem value="goat">Козы</SelectItem>
                        <SelectItem value="sheep">Овцы</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {animalsQuery.isLoading ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Загружаем каталог животных...
                    </div>
                  ) : filteredAnimals.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
                      По текущим фильтрам карточки не найдены. Попробуйте изменить условия поиска или создать новое животное справа.
                    </div>
                  ) : (
                    <AdminAnimalsTable
                      animals={filteredAnimals}
                      onEdit={handleEdit}
                      onToggleVisibility={handleToggleVisibility}
                      isUpdating={setVisibility.isPending}
                    />
                  )}
                </CardContent>
              </Card>
            </section>

            <aside className="space-y-6 xl:sticky xl:top-6">
              <AnimalEditorCard
                mode={editorMode}
                values={formValues}
                onChange={handleFormChange}
                onSubmit={handleSubmit}
                onCancel={resetEditor}
                isSubmitting={createAnimal.isPending || updateAnimal.isPending}
              />
            </aside>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
