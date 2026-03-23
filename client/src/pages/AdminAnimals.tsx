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
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
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
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type AdminAnimalStatus = "public_available" | "public_limited" | "fully_booked" | "hidden" | "archived";
type AdminAnimalSpecies = "goat" | "sheep";
type AdminOwnershipFilter = "all" | "has_free" | "fully_booked" | "no_owners";
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
  ownedPercent: number;
  availablePercent: number;
  shareUnitPercent: number;
  shareUnitPriceMinor: number;
  fullPriceMinor: number;
  availableSharePercents: number[];
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
  occupiedValueMinor?: number;
  ownersCount?: number;
  pendingOwnerships?: number;
  shareDistribution?: { familyName: string; percent: number; slots: number[]; planLabel: string }[];
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

type AnimalProfilePreset = {
  label: string;
  values: AnimalFormValues;
  media: AdminAnimalMediaItem[];
};

const DEMO_ANIMAL_PRESETS: Record<"goat" | "sheep", AnimalProfilePreset> = {
  goat: {
    label: "Демо-профиль козы",
    values: {
      name: "Мира",
      slug: "mira",
      species: "goat",
      breed: "Зааненская",
      shortDescription: "Контактная молочная коза для семейного участия, визитов на ферму и прозрачного пути от ухода до продукции.",
      story: "Мира любит подходить первой к гостям, спокойно реагирует на детей и лучше всего чувствует себя в ритме регулярных визитов семьи. Её карточка подходит для демонстрации полного сценария Sher Kozu: выбор животного, наблюдение за жизнью на ферме, участие в уходе и получение именной молочной продукции.",
      coverImageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
      galleryIntro: "История Миры через фотогалерею: портрет, прогулка по ферме и контекст семейного персонального фермерства.",
      status: "public_available",
      totalOwnershipSlots: 10,
      baseMonthlyPriceMinor: 135000,
      healthScore: 94,
      happinessScore: 92,
      milkPotentialScore: 96,
      careLevelScore: 71,
      isFeatured: true,
      sortOrder: 0,
      publishedAt: "2026-03-16T10:30",
    },
    media: [
      {
        kind: "image",
        title: "Портрет Миры",
        alt: "Коза Мира в профиль на фоне фермы",
        fileKey: "preset/mira-cover",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isCover: true,
      },
      {
        kind: "image",
        title: "Мира на прогулке",
        alt: "Коза Мира гуляет по ферме рядом с пастбищем",
        fileKey: "preset/mira-walk",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/hero_farm_ab0d054b.jpg",
        mimeType: "image/jpeg",
        sortOrder: 1,
        isCover: false,
      },
      {
        kind: "image",
        title: "Продуктовый контекст Миры",
        alt: "Молочная продукция, связанная с профилем козы Миры",
        fileKey: "preset/mira-products",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/milk_products_d3f8c13d.jpg",
        mimeType: "image/jpeg",
        sortOrder: 2,
        isCover: false,
      },
    ],
  },
  sheep: {
    label: "Демо-профиль овцы",
    values: {
      name: "Лана",
      slug: "lana-sheep",
      species: "sheep",
      breed: "Романовская",
      shortDescription: "Спокойная овца для мягкого семейного сценария знакомства с фермой, наблюдения и клубных визитов.",
      story: "Лана подходит семьям, которым важен более спокойный ритм знакомства с персональным фермерством. В её карточке акцент сделан на доверии, регулярном наблюдении и понятной клиентской навигации: от выбора в каталоге до открытия подробного профиля и дальнейшего участия.",
      coverImageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
      galleryIntro: "Галерея Ланы показывает спокойный семейный сценарий участия: ферма, уход и визуальный контекст выбора животного.",
      status: "public_available",
      totalOwnershipSlots: 10,
      baseMonthlyPriceMinor: 118000,
      healthScore: 90,
      happinessScore: 93,
      milkPotentialScore: 76,
      careLevelScore: 63,
      isFeatured: false,
      sortOrder: 1,
      publishedAt: "2026-03-16T10:45",
    },
    media: [
      {
        kind: "image",
        title: "Лана и семейная ферма",
        alt: "Овца Лана в атмосфере семейной фермы",
        fileKey: "preset/lana-cover",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isCover: true,
      },
      {
        kind: "image",
        title: "Лана в общем пейзаже фермы",
        alt: "Спокойный ландшафт фермы для профиля овцы Ланы",
        fileKey: "preset/lana-landscape",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/hero_farm_ab0d054b.jpg",
        mimeType: "image/jpeg",
        sortOrder: 1,
        isCover: false,
      },
      {
        kind: "image",
        title: "Клубный день с Ланой",
        alt: "Клубный семейный визит на ферму в контексте профиля овцы Ланы",
        fileKey: "preset/lana-club",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/club_event_3bef2b1e.jpg",
        mimeType: "image/jpeg",
        sortOrder: 2,
        isCover: false,
      },
    ],
  },
};

export function createDemoAnimalPreset(species: "goat" | "sheep"): AnimalProfilePreset {
  const preset = DEMO_ANIMAL_PRESETS[species];
  return {
    label: preset.label,
    values: { ...preset.values },
    media: preset.media.map((item) => ({ ...item })),
  };
}

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

export const formatShareRevenue = (minor: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(minor / 100);

export const formatPrice = formatShareRevenue;


export function formatSharePercentLabel(percent: number) {
  return `${percent}%`;
}

export function buildShareSlots(animal: AdminAnimalRecord) {
  // Build a map: slotIndex → ownerName from shareDistribution
  const slotOwnerMap = new Map<number, string>();
  if (animal.shareDistribution) {
    for (const entry of animal.shareDistribution) {
      for (const slotIdx of entry.slots) {
        slotOwnerMap.set(slotIdx, entry.familyName);
      }
    }
  }

  return Array.from({ length: animal.totalOwnershipSlots }, (_, index) => {
    const slotIndex = index + 1;
    const filled = index < animal.activeOwnerships;
    const ownerName = filled ? (slotOwnerMap.get(slotIndex) ?? null) : null;
    const percent = slotIndex * animal.shareUnitPercent;
    return {
      index: slotIndex,
      filled,
      ownerName,
      label: filled ? (ownerName ?? "Занято") : "Свободно",
      state: filled ? "occupied" as const : "available" as const,
      percentLabel: formatSharePercentLabel(percent),
    };
  });
}

export function createAdminShareSummary(animals: AdminAnimalRecord[]) {
  const totalAnimals = animals.length;
  const totalOwnedPercent = animals.reduce((sum, animal) => sum + animal.ownedPercent, 0);
  const totalAvailablePercent = animals.reduce((sum, animal) => sum + animal.availablePercent, 0);
  const totalOwnersCount = animals.reduce((sum, animal) => {
    const distributionOwners = Array.isArray((animal as { shareDistribution?: unknown[] }).shareDistribution)
      ? (animal as { shareDistribution?: unknown[] }).shareDistribution?.length ?? 0
      : 0;
    return sum + distributionOwners;
  }, 0);
  const totalOccupiedValueMinor = animals.reduce((sum, animal) => {
    const occupiedValueMinor = (animal as { occupiedValueMinor?: number }).occupiedValueMinor;
    if (typeof occupiedValueMinor === "number") {
      return sum + occupiedValueMinor;
    }
    const fullPriceMinor = animal.fullPriceMinor || 0;
    const shareUnitPriceMinor = animal.shareUnitPriceMinor
      || Math.round(fullPriceMinor / Math.max(1, animal.totalOwnershipSlots || 10));
    return sum + shareUnitPriceMinor * animal.activeOwnerships;
  }, 0);
  const totalSlots = animals.reduce((sum, animal) => sum + animal.totalOwnershipSlots, 0);
  const occupiedSlots = animals.reduce((sum, animal) => sum + animal.activeOwnerships, 0);
  const freeSlots = Math.max(0, totalSlots - occupiedSlots);
  const loadedAnimals = animals.filter((animal) => animal.activeOwnerships > 0).length;
  const fullyBookedAnimals = animals.filter((animal) => animal.availablePercent === 0).length;
  const averageOccupancy = totalAnimals === 0
    ? 0
    : Math.round(animals.reduce((sum, animal) => sum + animal.ownedPercent, 0) / totalAnimals);

  return {
    totalAnimals,
    totalOwnedPercent,
    totalAvailablePercent,
    totalOwnersCount,
    totalOccupiedValueMinor,
    totalSlots,
    occupiedSlots,
    freeSlots,
    loadedAnimals,
    fullyBookedAnimals,
    averageOccupancy,
  };
}

export function getShareOccupancyTone(percent: number) {
  if (percent === 0) return "available";
  if (percent >= 100) return "full";
  return "partial";
}

export function getShareStatusTone(animal: AdminAnimalRecord) {
  if (animal.availablePercent === 0) {
    return {
      label: "Полностью распределено",
      className: "border-stone-300 bg-stone-100 text-stone-700",
    };
  }

  if (animal.availablePercent <= animal.shareUnitPercent * 2) {
    return {
      label: "Осталось мало долей",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: "Доли доступны",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

export function createEmptyAnimalForm(): AnimalFormValues {
  return {
    name: "",
    slug: "",
    species: "goat",
    breed: "",
    shortDescription: "",
    story: "",
    coverImageUrl: "",
    galleryIntro: "",
    status: "hidden",
    totalOwnershipSlots: 10,
    baseMonthlyPriceMinor: 120000,
    healthScore: 75,
    happinessScore: 75,
    milkPotentialScore: 75,
    careLevelScore: 75,
    isFeatured: false,
    sortOrder: 0,
    publishedAt: "",
  };
}

export function formatRublesFromMinor(minor: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format((Number.isFinite(minor) ? minor : 0) / 100);
}

export function toRublesInputValue(minor: number) {
  const rubles = Math.round((Number.isFinite(minor) ? minor : 0) / 100);
  return String(Math.max(0, rubles));
}

export function parseRublesToMinor(value: string) {
  const normalized = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(normalized) || normalized < 0) return 0;
  return Math.round(normalized * 100);
}

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
  species: AdminAnimalSpecies | "all",
  ownership: AdminOwnershipFilter = "all"
) {
  const normalizedQuery = query.trim().toLowerCase();

  return animals.filter((animal) => {
    const matchesQuery = !normalizedQuery
      || [animal.name, animal.slug, animal.breed ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === "all" || animal.status === status;
    const matchesSpecies = species === "all" || animal.species === species;

    let matchesOwnership = true;
    if (ownership === "has_free") {
      matchesOwnership = animal.activeOwnerships > 0 && animal.activeOwnerships < animal.totalOwnershipSlots;
    } else if (ownership === "fully_booked") {
      matchesOwnership = animal.activeOwnerships >= animal.totalOwnershipSlots;
    } else if (ownership === "no_owners") {
      matchesOwnership = animal.activeOwnerships === 0;
    }

    return matchesQuery && matchesStatus && matchesSpecies && matchesOwnership;
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

export function ShareSlotsGrid({ animal, compact = false }: { animal: AdminAnimalRecord; compact?: boolean }) {
  const slotItems = buildShareSlots(animal);
  const dotSize = compact ? "h-3.5 w-3.5" : "h-5 w-5";

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {slotItems.map((slot) => (
            <div
              key={slot.index}
              className={`${dotSize} rounded-full cursor-default ${slot.filled ? "bg-emerald-500" : "bg-stone-200 border border-stone-300"}`}
              title={slot.filled ? `Слот ${slot.index} · ${slot.ownerName ?? "Занято"}` : `Слот ${slot.index} · Свободно`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{animal.ownedPercent}% занято · {animal.activeOwnerships}/{animal.totalOwnershipSlots} слотов</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{animal.ownedPercent}%</span> занято · <span className="font-medium text-foreground">{animal.availablePercent}%</span> доступно
        </p>
        <p className="text-xs text-muted-foreground">{animal.activeOwnerships}/{animal.totalOwnershipSlots} слотов</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${animal.ownedPercent}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {slotItems.map((slot) => (
          <div
            key={slot.index}
            className={`${dotSize} rounded-full cursor-default ${slot.filled ? "bg-emerald-500" : "bg-stone-200 border border-stone-300"}`}
            title={slot.filled ? `Слот ${slot.index}: ${slot.index * animal.shareUnitPercent}% · ${slot.ownerName ?? "Занято"}` : `Слот ${slot.index}: ${slot.index * animal.shareUnitPercent}% · Свободно`}
          />
        ))}
      </div>
    </div>
  );
}

function ShareDistributionPanel({ animals }: { animals: AdminAnimalRecord[] }) {
  const summary = useMemo(() => createAdminShareSummary(animals), [animals]);

  return (
    <Card className="rounded-[2rem] border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle>Распределение долей</CardTitle>
        <CardDescription>
          Блок показывает, как в каталоге распределяются 10%-доли: сколько уже занято, сколько свободно и где нужно усилить продажи.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[1.5rem] border-emerald-100 bg-emerald-50/80 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-800/80">Занято слотов</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">{summary.occupiedSlots}</p>
              <p className="text-sm text-emerald-800/80">из {summary.totalSlots} доступных долей</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-stone-200 bg-stone-50/90 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-700/80">Свободно слотов</p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">{summary.freeSlots}</p>
              <p className="text-sm text-stone-700/80">готово к продаже в профилях животных</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-amber-100 bg-amber-50/80 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-800/80">Средняя занятость</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{summary.averageOccupancy}%</p>
              <p className="text-sm text-amber-800/80">по всем карточкам каталога</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-primary/15 bg-primary/5 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Полностью занято</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{summary.fullyBookedAnimals}</p>
              <p className="text-sm text-primary/80">животных из {summary.totalAnimals}</p>
            </CardContent>
          </Card>
        </div>

        <ScrollRemaining totalItems={animals.length} itemHeight={140} className="max-h-[640px] overflow-y-auto pr-1">
        <div className="grid gap-4 lg:grid-cols-2">
          {animals.map((animal) => {
            const shareTone = getShareStatusTone(animal);
            return (
              <div key={animal.id} className="rounded-[1.5rem] border border-border/70 bg-stone-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{animal.name}</p>
                      <Badge className={`rounded-full border ${shareTone.className}`}>{shareTone.label}</Badge>
                      {(animal.pendingOwnerships ?? 0) > 0 ? (
                        <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                          <Clock className="mr-1 h-3 w-3" />
                          {animal.pendingOwnerships} ожид. оплаты
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-white px-3 py-2 text-right">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Доля {animal.shareUnitPercent}%</p>
                    <p className="text-sm font-semibold text-foreground">{formatPrice(animal.shareUnitPriceMinor)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ShareSlotsGrid animal={animal} />
                </div>
              </div>
            );
          })}
        </div>
        </ScrollRemaining>

        {summary.loadedAnimals === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/80 px-5 py-4 text-sm text-muted-foreground">
            Пока ни у одного животного нет занятых долей. Как только появятся покупки или бронь, здесь отобразится распределение по слотам 10%.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Ownership Management Dialog ─────────────────────────────────────────────

type OwnershipRow = {
  id: number;
  ownerOpenId: string;
  slotIndex: number;
  status: string;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  priceMinor: number;
  paidAt: string | Date | null;
  cancelledAt: string | Date | null;
  notes: string | null;
  familyName: string | null;
  planCode: string | null;
  planName: string | null;
  durationMonths: number | null;
  durationLabel: string | null;
  createdAt: string | Date;
};

const OWNERSHIP_STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: "Активно", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  pending_payment: { label: "Ожидает оплаты", icon: Clock, className: "border-amber-200 bg-amber-50 text-amber-800" },
  expired: { label: "Истекло", icon: Clock, className: "border-stone-200 bg-stone-50 text-stone-600" },
  cancelled: { label: "Отменено", icon: XCircle, className: "border-rose-200 bg-rose-50 text-rose-700" },
};

function formatOwnershipDate(value: string | Date | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function OwnershipManagementDialog({
  animal,
  open,
  onOpenChange,
}: {
  animal: AdminAnimalRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const ownershipsQuery = trpc.adminOwnerships.listByAnimal.useQuery(
    { animalId: animal?.id ?? 0 },
    { enabled: open && Boolean(animal?.id) },
  );

  const updateStatus = trpc.adminOwnerships.updateStatus.useMutation({
    onSuccess: async () => {
      await ownershipsQuery.refetch();
      await utils.adminAnimals.list.invalidate();
      toast.success("Статус ownership обновлён");
    },
    onError: (err) => toast.error("Ошибка обновления", { description: err.message }),
  });

  const ownerships = (ownershipsQuery.data ?? []) as OwnershipRow[];
  const activeCount = ownerships.filter((o) => o.status === "active" || o.status === "pending_payment").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Владельцы — {animal?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            {activeCount} активных из {animal?.totalOwnershipSlots ?? 10} слотов.
            Здесь можно просмотреть все ownerships и изменить их статус.
          </DialogDescription>
        </DialogHeader>

        {ownershipsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем данные о владельцах…
          </div>
        ) : ownerships.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-5 py-8 text-center text-sm text-muted-foreground">
            У этого животного пока нет ни одного ownership. Покупки появятся здесь автоматически.
          </div>
        ) : (
          <ScrollRemaining totalItems={ownerships.length} itemHeight={100} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {ownerships.map((ownership) => {
              const statusInfo = OWNERSHIP_STATUS_MAP[ownership.status] ?? OWNERSHIP_STATUS_MAP.expired;
              const StatusIcon = statusInfo.icon;
              const isOccupied = ownership.status === "active" || ownership.status === "pending_payment";
              return (
                <div
                  key={ownership.id}
                  className="rounded-2xl border border-border/70 bg-white p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`rounded-full border ${statusInfo.className}`}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Слот #{ownership.slotIndex}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {ownership.familyName ?? "Без семьи"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ownership.durationLabel ?? ownership.planName ?? "Без плана"}
                        {" · "}
                        {formatPrice(ownership.priceMinor)}/мес
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-1">
                      <p>Начало: {formatOwnershipDate(ownership.startsAt)}</p>
                      <p>Конец: {formatOwnershipDate(ownership.endsAt)}</p>
                      {ownership.paidAt ? <p className="text-emerald-700">Оплачено: {formatOwnershipDate(ownership.paidAt)}</p> : null}
                      {ownership.cancelledAt ? <p className="text-rose-600">Отменено: {formatOwnershipDate(ownership.cancelledAt)}</p> : null}
                    </div>
                  </div>

                  {ownership.notes ? (
                    <p className="text-xs text-muted-foreground italic bg-stone-50 rounded-xl px-3 py-2">{ownership.notes}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {ownership.status === "pending_payment" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ ownershipId: ownership.id, status: "active" })}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Подтвердить оплату
                      </Button>
                    ) : null}
                    {isOccupied ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ ownershipId: ownership.id, status: "cancelled" })}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Отменить
                      </Button>
                    ) : null}
                    {ownership.status === "expired" || ownership.status === "cancelled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ ownershipId: ownership.id, status: "active" })}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Реактивировать
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </ScrollRemaining>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminAnimalsTable({
  animals,
  onToggleVisibility,
  onEdit,
  onArchive,
  onRestore,
  onViewOwnerships,
  isUpdating,
  archivingAnimalId,
  restoringAnimalId,
}: {
  animals: AdminAnimalRecord[];
  onToggleVisibility: (animal: AdminAnimalRecord) => void;
  onEdit: (animal: AdminAnimalRecord) => void;
  onArchive: (animal: AdminAnimalRecord) => void;
  onRestore: (animal: AdminAnimalRecord) => void;
  onViewOwnerships: (animal: AdminAnimalRecord) => void;
  isUpdating: boolean;
  archivingAnimalId: number | null;
  restoringAnimalId: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white shadow-sm max-h-[640px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Животное</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Доли</TableHead>
            <TableHead>Показатели</TableHead>
            <TableHead>Цена</TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animals.map((animal) => {
            const statusBadge = getStatusBadge(animal.status);
            const shareTone = getShareStatusTone(animal);
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
                  <div className="space-y-2">
                    <Badge className={`rounded-full border ${statusBadge.className}`}>{statusBadge.label}</Badge>
                    <Badge className={`rounded-full border ${shareTone.className}`}>{shareTone.label}</Badge>
                    {(animal.pendingOwnerships ?? 0) > 0 ? (
                      <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                        <Clock className="mr-1 h-3 w-3" />
                        {animal.pendingOwnerships} ожид. оплаты
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <ShareSlotsGrid animal={animal} compact />
                </TableCell>
                <TableCell>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <span>Здоровье: {animal.healthScore}</span>
                    <span>Счастье: {animal.happinessScore}</span>
                    <span>Молоко: {animal.milkPotentialScore}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground">{formatPrice(animal.fullPriceMinor)}</p>
                    <p className="text-xs text-muted-foreground">1 слот: {formatPrice(animal.shareUnitPriceMinor)}</p>
                    <p className="text-xs text-muted-foreground">sort: {animal.sortOrder ?? 0}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => onEdit(animal)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() => onViewOwnerships(animal)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Владельцы{animal.activeOwnerships > 0 ? ` (${animal.activeOwnerships})` : ""}
                      {(animal.pendingOwnerships ?? 0) > 0 ? (
                        <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          {animal.pendingOwnerships} ожид.
                        </span>
                      ) : null}
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
                    {animal.status === "archived" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        onClick={() => onRestore(animal)}
                        disabled={restoringAnimalId === animal.id}
                      >
                        {restoringAnimalId === animal.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
                        Восстановить
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => onArchive(animal)}
                        disabled={archivingAnimalId === animal.id}
                      >
                        {archivingAnimalId === animal.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Архивировать
                      </Button>
                    )}
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
  isCreateMode,
}: {
  animalSlug: string;
  values: AnimalFormValues;
  onCoverChange: (url: string) => void;
  isCreateMode: boolean;
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
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Фото загружено", {
        description: "Новое изображение добавлено в галерею животного.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось загрузить фото", { description: error.message });
    },
  });

  const removePhoto = trpc.animalPhotos.remove.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Фото удалено");
    },
    onError: (error) => {
      toast.error("Не удалось удалить фото", { description: error.message });
    },
  });

  const setCoverPhoto = trpc.animalPhotos.setCover.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Обложка обновлена");
    },
    onError: (error) => {
      toast.error("Не удалось обновить обложку", { description: error.message });
    },
  });

  const updatePhotoMeta = trpc.animalPhotos.updateMeta.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Подписи обновлены");
    },
    onError: (error) => {
      toast.error("Не удалось сохранить подписи", { description: error.message });
    },
  });

  const reorderPhotos = trpc.animalPhotos.reorder.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
    },
    onError: (error) => {
      toast.error("Не удалось изменить порядок", { description: error.message });
    },
  });

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateGalleryUpload(file.type, file.size);
    if (!validation.hasAllowedType) {
      toast.error("Поддерживаются только JPG, PNG и WebP");
      event.target.value = "";
      return;
    }
    if (!validation.hasAllowedSize) {
      toast.error("Максимальный размер файла — 8 МБ");
      event.target.value = "";
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
    } finally {
      event.target.value = "";
    }
  }

  function movePhoto(photoId: number, direction: "left" | "right") {
    const currentIndex = galleryImages.findIndex((photo) => photo.photoId === photoId);
    if (currentIndex === -1) return;

    const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= galleryImages.length) return;

    const nextOrder = [...galleryImages];
    const [item] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, item);

    reorderPhotos.mutate({
      animalSlug,
      photoIds: nextOrder.map((photo) => photo.photoId),
    });
  }

  function updateDraft(photo: GalleryPhoto, key: "title" | "alt", value: string) {
    setPhotoDrafts((current) => ({
      ...current,
      [photo.photoId]: {
        ...(current[photo.photoId] ?? createPhotoDraft(photo)),
        [key]: value,
      },
    }));
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
          Сначала укажите slug животного. Галерея привязывается к нему и становится доступной сразу после сохранения карточки.
        </div>
      ) : isCreateMode ? (
        <div className="grid gap-3 rounded-2xl border border-dashed border-border bg-background/80 p-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Сначала создайте карточку, затем загружайте фотографии</p>
            <p className="text-sm text-muted-foreground">
              После первого сохранения галерея привяжется к slug и здесь появятся загрузка, выбор обложки и управление порядком фото без поломки формы.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-stone-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Текущая цена</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatRublesFromMinor(values.baseMonthlyPriceMinor)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Один слот 10% будет рассчитан автоматически после сохранения карточки.</p>
          </div>
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
  onApplyPreset,
  isSubmitting,
}: {
  mode: "create" | "edit";
  values: AnimalFormValues;
  onChange: <K extends keyof AnimalFormValues>(key: K, value: AnimalFormValues[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onApplyPreset: (species: "goat" | "sheep") => void;
  isSubmitting: boolean;
}) {
  const gallerySlug = values.slug.trim();
  const sharePriceMinor = Math.round(values.baseMonthlyPriceMinor / 10);
  const hasSlug = gallerySlug.length > 0;
  const isCreateMode = mode === "create";

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
              placeholder="Короткий вводный текст для блока галереи"
              className="min-h-[96px]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
              <div className="min-w-0 lg:w-[180px] lg:flex-none">
                <Label htmlFor="animal-price">Полная цена животного в рублях</Label>
                <p className="mt-1 text-sm font-medium text-primary">Enter price in ₽</p>
              </div>
              <div className="min-w-0 lg:flex-[0_1_620px]">
                <div className="flex h-14 items-center overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  <Input
                    id="animal-price"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    autoComplete="off"
                    className="h-full min-w-0 w-full flex-1 border-0 bg-transparent px-5 text-xl tabular-nums shadow-none focus-visible:ring-0"
                    value={toRublesInputValue(values.baseMonthlyPriceMinor)}
                    onChange={(event) => onChange("baseMonthlyPriceMinor", parseRublesToMinor(event.target.value))}
                    placeholder="1500"
                  />
                  <div className="flex h-full shrink-0 items-center border-l border-border/70 px-5 text-base font-semibold text-muted-foreground">₽</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Вводите стоимость в ₽. Система автоматически переведёт её во внутренний формат и рассчитает цену доли 10%.</p>
          </div>

          <div className="rounded-[1.75rem] border border-primary/15 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">Предпросмотр цены</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">100% животного</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatRublesFromMinor(values.baseMonthlyPriceMinor)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Эта сумма увидится в admin и в карточке животного как полная цена.</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">1 доля · 10%</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatRublesFromMinor(sharePriceMinor)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Эту цену увидит семья при выборе одной доли в каталоге и профиле.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Модель шеринга фиксирована: 10 слотов по 10%, поэтому изменение полной цены сразу обновляет весь customer-facing сценарий.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="animal-published-at">Дата публикации</Label>
            <Input
              id="animal-published-at"
              type="datetime-local"
              value={values.publishedAt}
              onChange={(event) => onChange("publishedAt", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="animal-health">Здоровье</Label>
            <Input id="animal-health" type="number" min={0} max={100} value={values.healthScore} onChange={(event) => onChange("healthScore", Number(event.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-happiness">Счастье</Label>
            <Input id="animal-happiness" type="number" min={0} max={100} value={values.happinessScore} onChange={(event) => onChange("happinessScore", Number(event.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-milk">Молочный потенциал</Label>
            <Input id="animal-milk" type="number" min={0} max={100} value={values.milkPotentialScore} onChange={(event) => onChange("milkPotentialScore", Number(event.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-care">Уровень ухода</Label>
            <Input id="animal-care" type="number" min={0} max={100} value={values.careLevelScore} onChange={(event) => onChange("careLevelScore", Number(event.target.value || 0))} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <Label htmlFor="animal-sort-order">Порядок</Label>
            <Input id="animal-sort-order" type="number" min={0} value={values.sortOrder} onChange={(event) => onChange("sortOrder", Number(event.target.value || 0))} />
          </div>
          <div className="flex items-end rounded-2xl border border-border/70 bg-stone-50/70 px-4 py-3">
            <Label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <Checkbox checked={values.isFeatured} onCheckedChange={(checked) => onChange("isFeatured", Boolean(checked))} />
              Показать как featured
            </Label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onApplyPreset("goat")}>
            Демо-коза
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onApplyPreset("sheep")}>
            Демо-овца
          </Button>
        </div>

        <div className={`rounded-[1.75rem] border px-4 py-4 ${isCreateMode ? "border-amber-200 bg-amber-50/80" : "border-emerald-200 bg-emerald-50/70"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {isCreateMode ? "Следующий шаг после сохранения" : "Галерея подключена к карточке"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCreateMode
                  ? "Сначала сохраните карточку. После этого форма автоматически останется в режиме редактирования, и вы сможете сразу загружать фотографии, выбирать обложку и редактировать подписи."
                  : "Карточка уже сохранена. Загружайте новые фотографии, меняйте обложку и редактируйте подписи — изменения сразу синхронизируются с публичным профилем животного."}
              </p>
            </div>
            <Badge className={`w-fit rounded-full border ${isCreateMode ? "border-amber-200 bg-white text-amber-800" : "border-emerald-200 bg-white text-emerald-800"}`}>
              {isCreateMode ? (hasSlug ? "1. Сохранить карточку" : "Добавьте slug и сохраните") : "2. Управлять галереей"}
            </Badge>
          </div>
        </div>

        <AnimalGalleryManager
          animalSlug={gallerySlug}
          values={values}
          onCoverChange={(url) => onChange("coverImageUrl", url)}
          isCreateMode={isCreateMode}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" className="rounded-full" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Создать карточку" : "Сохранить изменения"}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
            Сбросить форму
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAnimalsPage() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminAnimalStatus | "all">("all");
  const [speciesFilter, setSpeciesFilter] = useState<AdminAnimalSpecies | "all">("all");
  const [ownershipFilter, setOwnershipFilter] = useState<AdminOwnershipFilter>("all");
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingAnimalId, setEditingAnimalId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<AnimalFormValues>(createEmptyAnimalForm());
  const [animalPendingArchive, setAnimalPendingArchive] = useState<AdminAnimalRecord | null>(null);
  const [restoringAnimalId, setRestoringAnimalId] = useState<number | null>(null);
  const [ownershipAnimal, setOwnershipAnimal] = useState<AdminAnimalRecord | null>(null);
  const [, navigate] = useState("");

  const animalsQuery = trpc.adminAnimals.list.useQuery(undefined, {
    retry: false,
  });

  const animals = useMemo(
    () => (animalsQuery.data ?? []) as AdminAnimalRecord[],
    [animalsQuery.data]
  );
  const filteredAnimals = useMemo(
    () => filterAdminAnimals(animals, searchQuery, statusFilter, speciesFilter, ownershipFilter),
    [animals, searchQuery, statusFilter, speciesFilter, ownershipFilter]
  );

  const portfolioValueMinor = useMemo(
    () => animals.reduce((sum, animal) => sum + animal.fullPriceMinor, 0),
    [animals]
  );

  const monthlyBookedMinor = useMemo(
    () => animals.reduce((sum, animal) => sum + animal.shareUnitPriceMinor * animal.activeOwnerships, 0),
    [animals]
  );

  const createAnimal = trpc.adminAnimals.create.useMutation({
    onSuccess: async (created) => {
      await utils.adminAnimals.list.invalidate();
      if (created?.id) {
        setEditorMode("edit");
        setEditingAnimalId(created.id);
        setFormValues(normalizeAnimalFormValues(created));
      } else {
        resetEditor();
      }
      toast.success("Животное создано", {
        description: "Новая карточка добавлена в каталог и доступна для дальнейшей настройки.",
      });
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

  const deleteAnimal = trpc.adminAnimals.delete.useMutation({
    onSuccess: async (archived) => {
      await utils.adminAnimals.list.invalidate();
      if (editingAnimalId === archived?.id) {
        resetEditor();
      }
      setAnimalPendingArchive(null);
      toast.success("Карточка архивирована", {
        description: archived?.name
          ? `Профиль «${archived.name}» скрыт из каталога и доступен для восстановления в админ-панели.`
          : "Профиль животного перемещён в архив.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось архивировать профиль", { description: error.message });
    },
  });

  const restoreAnimal = trpc.adminAnimals.restore.useMutation({
    onSuccess: async (restored) => {
      await utils.adminAnimals.list.invalidate();
      toast.success("Карточка восстановлена", {
        description: restored?.name
          ? `Профиль «${restored.name}» возвращён в админ-панель со статусом «Скрыто».`
          : "Профиль животного восстановлен из архива.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось восстановить профиль", { description: error.message });
    },
  });

  function resetEditor() {
    setEditorMode("create");
    setEditingAnimalId(null);
    setFormValues(createEmptyAnimalForm());
  }

  function applyDemoPreset(species: "goat" | "sheep") {
    const preset = createDemoAnimalPreset(species);
    setEditorMode("create");
    setEditingAnimalId(null);
    setFormValues(preset.values);
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

  function handleArchiveRequest(animal: AdminAnimalRecord) {
    setAnimalPendingArchive(animal);
  }

  async function handleRestore(animal: AdminAnimalRecord) {
    setRestoringAnimalId(animal.id);
    try {
      await restoreAnimal.mutateAsync({ id: animal.id });
    } finally {
      setRestoringAnimalId(null);
    }
  }

  async function confirmArchiveAnimal() {
    if (!animalPendingArchive) return;
    await deleteAnimal.mutateAsync({ id: animalPendingArchive.id });
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
        ...normalizeAnimalFormValues(freshAnimal),
        coverImageUrl: current.coverImageUrl || freshAnimal.coverImageUrl || "",
      }));
    }
  }, [animals, editorMode, editingAnimalId]);

  useEffect(() => {
    if (user && (user as { role?: string }).role !== "admin") {
      navigate("/");
    }
  }, [navigate, user]);

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
          <PageBreadcrumbs
            className="mb-5"
            items={[
              { label: "Главная", href: "/" },
              { label: "Admin", href: "/admin" },
              { label: "Животные" },
            ]}
          />
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
                      ключевые показатели и видеть фактическое распределение 10%-долей по каждому животному без обращения к базе вручную.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-700/80">Портфель</p>
                          <p className="text-lg font-semibold text-stone-900">{formatPrice(portfolioValueMinor)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-primary/15 bg-primary/5 shadow-none">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Wallet className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Занято в долях</p>
                          <p className="text-lg font-semibold text-primary">{formatPrice(monthlyBookedMinor)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>

              <ShareDistributionPanel animals={animals} />

              <Card className="rounded-[2rem] border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Каталог животных</CardTitle>
                  <CardDescription>
                    Используйте поиск и фильтры, чтобы быстро находить карточки и управлять их публичной доступностью.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px_200px_220px]">
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
                    <Select value={ownershipFilter} onValueChange={(value) => setOwnershipFilter(value as AdminOwnershipFilter)}>
                      <SelectTrigger className="h-11 rounded-full">
                        <SelectValue placeholder="Владение" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все доли</SelectItem>
                        <SelectItem value="has_free">Есть свободные</SelectItem>
                        <SelectItem value="fully_booked">Полностью занято</SelectItem>
                        <SelectItem value="no_owners">Без владельцев</SelectItem>
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
                        onArchive={handleArchiveRequest}
                        onRestore={handleRestore}
                        onViewOwnerships={setOwnershipAnimal}
                        isUpdating={setVisibility.isPending}
                        archivingAnimalId={deleteAnimal.isPending ? animalPendingArchive?.id ?? null : null}
                        restoringAnimalId={restoringAnimalId}
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
                onApplyPreset={applyDemoPreset}
                isSubmitting={createAnimal.isPending || updateAnimal.isPending}
              />
            </aside>
          </div>
        </div>
      </div>
      <AlertDialog open={Boolean(animalPendingArchive)} onOpenChange={(open) => !open && setAnimalPendingArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать профиль животного?</AlertDialogTitle>
            <AlertDialogDescription>
              {animalPendingArchive
                ? `Карточка «${animalPendingArchive.name}» будет скрыта из публичного каталога и страницы животного, но все связанные фото, медиа и доли сохранятся. При необходимости профиль можно будет восстановить из архива.`
                : "Профиль будет перемещён в архив с возможностью восстановления."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAnimal.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmArchiveAnimal();
              }}
              disabled={deleteAnimal.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleteAnimal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <OwnershipManagementDialog
        animal={ownershipAnimal}
        open={Boolean(ownershipAnimal)}
        onOpenChange={(open) => !open && setOwnershipAnimal(null)}
      />
    </DashboardLayout>
  );
}
