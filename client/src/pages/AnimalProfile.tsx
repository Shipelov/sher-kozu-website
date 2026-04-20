import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, navigateToLogin } from "@/const";
import Navbar from "@/components/Navbar";
import LazyImage from "@/components/LazyImage";
import { useCoverCache, clearCachedCover } from "@/hooks/useCoverCache";
import AnimalShareCard from "@/components/AnimalShareCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Heart,
  Thermometer,
  Milk,
  Cake,
  Camera,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Calendar,
  Dna,
  MapPin,
  Images,
  Upload,
  X,
  Link2,
  Facebook,
  MessageCircle,
  Instagram,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Package,
  Leaf,
  Clock3,
  Zap,
  BookOpen,
  Gift,
  ArrowLeftRight,
  CheckCircle2,
  FileText,
  CircleDot,
  Trash2,
  XCircle,
  Users,
} from "lucide-react";
import { formatOwnerNamePublic } from "@shared/formatOwnerName";
import OwnerProductPlanSection from "./OwnerProductPlanSection";
import WellnessRadarChart from "@/components/WellnessRadarChart";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import ImageCropDialog from "@/components/ImageCropDialog";
import type { CropResult } from "@/components/ImageCropDialog";

/* ── constants ── */
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  farm: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/cms/150001-5t4v0ner-Главная_ШК1-Photoroom_cropped.jpg",
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
};

/* ── types ── */
type GalleryImage = {
  id: string;
  src: string;
  title: string;
  meta: string;
  isUploaded?: boolean;
  photoId?: number;
  isCover?: boolean;
  sortOrder?: number;
};

type PhotoActivity = {
  id: string;
  action: "upload" | "remove";
  title: string;
  timestamp: number;
};

/* ── helpers ── */
function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function getSpeciesLabel(species?: string) {
  if (species === "sheep") return "Овца";
  if (species === "goat") return "Коза";
  return "Животное";
}

function formatCurrency(minor?: number | null, currencyCode: string = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format((minor ?? 0) / 100);
}

function getAnimalStatusLabel(status?: string | null) {
  if (status === "fully_booked") return "В заботливых руках";
  if (status === "public_limited") return "Осталось мало свободных долей";
  if (status === "hidden") return "Скрыто";
  if (status === "archived") return "Архив";
  return "Ждёт свою семью";
}

function getDefaultGallery(name: string): GalleryImage[] {
  return [
    { id: "cover", src: CDN.hero, title: `Портрет ${name}`, meta: "Знакомьтесь — это ваше животное", isUploaded: false },
    { id: "farm", src: CDN.farm, title: `Ферма ${name}`, meta: "Семейная ферма Шерь Козу", isUploaded: false },
    { id: "milk", src: CDN.milk, title: `Именная коробка ${name}`, meta: "Молоко, сыры и йогурты с историей", isUploaded: false },
    { id: "club", src: CDN.club, title: `Визит на ферму`, meta: "Семейные мероприятия и встречи", isUploaded: false },
    { id: "live", src: CDN.liveCam, title: `${name} на ферме`, meta: "Наблюдайте в реальном времени", isUploaded: false },
  ];
}

function getDiaryEntries(name: string) {
  return [
    { date: "13 марта 2026", mood: "😊", title: `Спокойное утро`, text: `${name} провёл(а) утро на свежем воздухе с дополнительной порцией заботы от фермера.`, tags: ["дневник", "забота"] },
    { date: "12 марта 2026", mood: "✨", title: "Новый рацион", text: `Фермер обновил рацион ${name} — больше зелени и витаминов для здорового молока.`, tags: ["питание"] },
    { date: "11 марта 2026", mood: "🌿", title: "Прогулка по лугу", text: `${name} провёл(а) несколько часов на лугу — любимое время дня.`, tags: ["прогулка"] },
    { date: "8 марта 2026", mood: "🎉", title: "Семейный визит", text: `Семья приехала навестить ${name} — новые фотографии и тёплые впечатления.`, tags: ["семья", "визит"] },
  ];
}

function getHealthHistory(name: string) {
  return [
    { date: "10 марта", event: "Плановый осмотр ветеринара", status: "ok" as const, note: `${name} здоров(а), все показатели в норме` },
    { date: "1 марта", event: "Обновление рациона", status: "ok" as const, note: "Рацион подобран с учётом сезона и породы" },
    { date: "15 февраля", event: "Анализ молока", status: "ok" as const, note: "Жирность и белок соответствуют стандартам элитных пород" },
    { date: "1 февраля", event: "Профилактический уход", status: "ok" as const, note: "Все процедуры завершены, животное чувствует себя прекрасно" },
  ];
}

function useAnimalSlug() {
  const [, paramsByAnimals] = useRoute("/animals/:slug");
  const [, paramsByLegacy] = useRoute("/animal/:slug");
  return paramsByAnimals?.slug ?? paramsByLegacy?.slug ?? null;
}

/* ── Collapsible section helper ── */
function ProfileSection({
  id,
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="rounded-2xl border border-border/70 bg-card overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/30"
      >
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{badge}</span>
        ) : null}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 px-5 pb-5 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── component ── */
export default function AnimalProfile() {
  const [, setLocation] = useLocation();
  const animalSlug = useAnimalSlug();
  const { isAuthenticated } = useAuth();

  const [selectedImageId, setSelectedImageId] = useState("cover");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoActivity, setPhotoActivity] = useState<PhotoActivity[]>([]);

  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [coverImageId, setCoverImageId] = useState("cover");
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [passportDialogOpen, setPassportDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const animalQuery = trpc.animals.getBySlug.useQuery(
    { slug: animalSlug! },
    { enabled: Boolean(animalSlug) },
  );

  const data = animalQuery.data;
  const displayName = data?.name ?? "Животное";
  const speciesLabel = getSpeciesLabel(data?.species);
  const breedLabel = data?.breed ?? (speciesLabel === "Овца" ? "Молочная овца" : "Англо-нубийская");
  const mySharePercent = data?.mySharePercent ?? 0;
  const hasOwnerAccess = mySharePercent > 0;
  const isGuestPreview = !isAuthenticated && !hasOwnerAccess;

  const wellnessQuery = trpc.gamification.wellness.get.useQuery(
    { animalId: data?.id ?? 0 },
    { enabled: Boolean(data?.id) && hasOwnerAccess },
  );
  const wellnessData = wellnessQuery.data;

  const photosQuery = trpc.animalPhotos.list.useQuery(
    { animalSlug: animalSlug! },
    { enabled: Boolean(animalSlug) && isAuthenticated },
  );

  const initialSharePercent = useMemo((): 50 | 100 => {
    if (typeof window === "undefined") return 50;
    const value = Number(new URLSearchParams(window.location.search).get("share"));
    return value === 100 ? 100 : 50;
  }, []);
  const [selectedSharePercent, setSelectedSharePercent] = useState<50 | 100>(initialSharePercent);

  const availableSharePercents = data?.availableSharePercents ?? [];
  const fullPriceMinor = data?.fullPriceMinor ?? data?.baseMonthlyPriceMinor ?? 0;
  const shareUnitPercent = data?.shareUnitPercent ?? 50;
  const ownedPercent = data?.ownedPercent ?? 0;
  const availablePercent = data?.availablePercent ?? 100;
  const currencyCode = data?.currencyCode ?? "RUB";
  const selectedSharePriceMinor = useMemo(
    () => Math.round((fullPriceMinor * selectedSharePercent) / 100),
    [fullPriceMinor, selectedSharePercent],
  );

  const defaultGallery = useMemo(() => getDefaultGallery(displayName), [displayName]);
  const diaryEntries = useMemo(() => getDiaryEntries(displayName), [displayName]);
  const healthHistory = useMemo(() => getHealthHistory(displayName), [displayName]);

  /* ── mutations ── */
  const purchaseShare = trpc.animals.purchaseShare.useMutation({
    onSuccess: async (result) => {
      await utils.animals.getBySlug.invalidate({ slug: animalSlug! });
      await utils.animals.listPublic.invalidate();
      toast.success("Доля забронирована", {
        description: `Вы выбрали ${result.sharePercent}% ${displayName} на сумму ${formatCurrency(result.priceMinor, currencyCode)}.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось оформить долю", { description: error.message });
    },
  });

  const uploadPhoto = trpc.animalPhotos.upload.useMutation({
    onSuccess: async (created) => {
      await utils.animalPhotos.list.invalidate({ animalSlug: animalSlug! });
      await utils.animalPhotos.uploadLimit.invalidate({ animalSlug: animalSlug! });
      await utils.animals.getBySlug.invalidate({ slug: animalSlug! });
      await utils.animals.listPublic.invalidate();
      setSelectedImageId(created.id);
      setPhotoActivity((current) =>
        [{ id: `upload-${created.photoId}-${Date.now()}`, action: "upload" as const, title: created.title, timestamp: Date.now() }, ...current].slice(0, 4),
      );
      toast.success("Фото сохранено");
    },
    onError: (error) => {
      toast.error("Не удалось сохранить фото", { description: error.message });
    },
  });

  const setCoverPhoto = trpc.animalPhotos.setCover.useMutation({
    onSuccess: async ({ photoId }) => {
      const nextCoverId = `user-${photoId}`;
      setCoverImageId(nextCoverId);
      setSelectedImageId(nextCoverId);
      await utils.animalPhotos.list.invalidate({ animalSlug: animalSlug! });
      await utils.animals.getBySlug.invalidate({ slug: animalSlug! });
      await utils.animals.listPublic.invalidate();
      clearCachedCover(animalSlug);
      toast.success("Обложка обновлена");
    },
    onError: (error) => {
      toast.error("Не удалось сохранить обложку", { description: error.message });
    },
  });

  const reorderPhotos = trpc.animalPhotos.reorder.useMutation({
    onSuccess: async ({ items }) => {
      utils.animalPhotos.list.setData({ animalSlug: animalSlug! }, (current: typeof photosQuery.data) => {
        if (!current) return current;
        const sortMap = new Map(items.map((item: { photoId: number; sortOrder: number }) => [item.photoId, item.sortOrder] as const));
        return [...current]
          .map((image) => ({ ...image, sortOrder: image.photoId ? (sortMap.get(image.photoId) ?? image.sortOrder) : image.sortOrder }))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      });
      await utils.animalPhotos.list.invalidate({ animalSlug: animalSlug! });
      toast.success("Порядок фото сохранён");
    },
    onError: (error) => {
      toast.error("Не удалось сохранить порядок", { description: error.message });
    },
  });

  const removePhoto = trpc.animalPhotos.remove.useMutation({
    onSuccess: async ({ photoId }) => {
      const removedImage = galleryImages.find((image) => image.photoId === photoId);
      await utils.animalPhotos.list.invalidate({ animalSlug: animalSlug! });
      await utils.animalPhotos.uploadLimit.invalidate({ animalSlug: animalSlug! });
      await utils.animals.getBySlug.invalidate({ slug: animalSlug! });
      await utils.animals.listPublic.invalidate();
      setSelectedImageId((current) => (current === `user-${photoId}` ? defaultGallery[0].id : current));
      if (removedImage) {
        setPhotoActivity((current) =>
          [{ id: `remove-${photoId}-${Date.now()}`, action: "remove" as const, title: removedImage.title, timestamp: Date.now() }, ...current].slice(0, 4),
        );
      }
      toast.success("Фото удалено");
    },
    onError: (error) => {
      toast.error("Не удалось удалить фото", { description: error.message });
    },
  });

  /* ── upload limit ── */
  const uploadLimitQuery = trpc.animalPhotos.uploadLimit.useQuery(
    { animalSlug: animalSlug! },
    { enabled: Boolean(animalSlug) && isAuthenticated },
  );
  const uploadLimitData = uploadLimitQuery.data;

  /* ── gallery logic ── */
  const galleryImages = useMemo<GalleryImage[]>(() => {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (persistent.length > 0) {
      const coverFromServer = persistent.find((image) => image.isCover)?.id;
      const fallbackCoverId = persistent[0].id;
      return persistent.map((image, index) => ({
        ...image,
        sortOrder: image.sortOrder ?? index,
        isCover: coverFromServer ? image.id === coverFromServer : image.id === fallbackCoverId,
      }));
    }
    // Fallback to default gallery only when no uploaded photos exist
    return defaultGallery.map((image, index) => ({
      ...image,
      sortOrder: index,
    }));
  }, [coverImageId, photosQuery.data, defaultGallery]);

  useEffect(() => {
    if (!galleryImages.length) return;
    const hasSelected = galleryImages.some((item) => item.id === selectedImageId);
    if (!hasSelected) setSelectedImageId(galleryImages[0].id);
  }, [galleryImages, selectedImageId]);

  useEffect(() => {
    if (!galleryImages.length) return;
    const persistedCover = galleryImages.find((item) => item.isCover)?.id;
    if (persistedCover && persistedCover !== coverImageId) { setCoverImageId(persistedCover); return; }
    const hasCover = galleryImages.some((item) => item.id === coverImageId);
    if (!hasCover) setCoverImageId(photosQuery.data?.[0]?.id ?? galleryImages[0].id);
  }, [coverImageId, galleryImages, photosQuery.data]);

  useEffect(() => {
    const photoParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("photo");
    if (photoParam && galleryImages.some((item) => item.id === photoParam)) setSelectedImageId(photoParam);
  }, [galleryImages]);

  useEffect(() => {
    if (!availableSharePercents.length) { setSelectedSharePercent(shareUnitPercent as 50 | 100); return; }
    if (!availableSharePercents.includes(selectedSharePercent)) setSelectedSharePercent((availableSharePercents[0] ?? 50) as 50 | 100);
  }, [availableSharePercents, selectedSharePercent, shareUnitPercent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("share", String(selectedSharePercent));
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [selectedSharePercent]);

  const selectedImage = useMemo(() => galleryImages.find((item) => item.id === selectedImageId) ?? galleryImages[0], [galleryImages, selectedImageId]);
  const selectedImageIndex = useMemo(() => galleryImages.findIndex((item) => item.id === selectedImageId), [galleryImages, selectedImageId]);

  function moveGallery(direction: "prev" | "next") {
    if (!galleryImages.length) return;
    const idx = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const next = direction === "next" ? (idx + 1) % galleryImages.length : (idx - 1 + galleryImages.length) % galleryImages.length;
    setSelectedImageId(galleryImages[next].id);
  }

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://koza.vip/animals/${animalSlug}`;
    return `${window.location.origin}/animals/${animalSlug}?photo=${selectedImageId}`;
  }, [animalSlug, selectedImageId]);

  const shareText = useMemo(
    () => `Посмотрите профиль ${displayName} на ферме Шерь Козу`,
    [displayName],
  );

  function openShareWindow(url: string) { window.open(url, "_blank", "noopener,noreferrer,width=720,height=720"); }

  async function handleCopyShareLink() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Ссылка скопирована"); } catch { toast.error("Не удалось скопировать ссылку"); }
  }

  function handleShare(platform: "facebook" | "vk" | "instagram") {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    if (platform === "facebook") { openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`); return; }
    if (platform === "vk") { openShareWindow(`https://vk.com/share.php?url=${encodedUrl}&title=${encodedText}`); return; }
    toast.info("Instagram не поддерживает web-share по ссылке", { description: "Скопируйте ссылку и вставьте в публикацию." });
  }

  async function handleCropConfirm(result: CropResult) {
    await uploadPhoto.mutateAsync({
      animalSlug: animalSlug!,
      fileName: result.originalName,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      base64Data: result.base64,
    });
    setCropDialogOpen(false);
  }

  function handleRemoveUploadedImage(img: GalleryImage) { if (img.isUploaded && img.photoId) removePhoto.mutate({ photoId: img.photoId }); }
  function handleSetCoverImage(img: GalleryImage) {
    setCoverImageId(img.id);
    setSelectedImageId(img.id);
    if (!img.isUploaded || !img.photoId) { toast.success("Обложка обновлена"); return; }
    setCoverPhoto.mutate({ photoId: img.photoId });
  }

  function moveUploadedPhoto(photoId: number, direction: "left" | "right") {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (persistent.length < 2) { toast.info("Добавьте ещё фото"); return; }
    const idx = persistent.findIndex((i) => i.photoId === photoId);
    if (idx < 0) return;
    const next = direction === "left" ? idx - 1 : idx + 1;
    if (next < 0 || next >= persistent.length) { toast.info("Фото уже на краю"); return; }
    const reordered = [...persistent];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(next, 0, moved);
    const ids = reordered.map((i) => i.photoId).filter((v): v is number => typeof v === "number");
    utils.animalPhotos.list.setData({ animalSlug: animalSlug! }, (current: typeof photosQuery.data) => {
      if (!current) return current;
      const sortMap = new Map(ids.map((id, i) => [id, i] as const));
      return [...current].map((img) => ({ ...img, sortOrder: img.photoId ? (sortMap.get(img.photoId) ?? img.sortOrder) : img.sortOrder })).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });
    reorderPhotos.mutate({ animalSlug: animalSlug!, photoIds: ids });
  }

  async function handlePurchaseShare() {
    if (!data?.id) { toast.error("Профиль ещё загружается"); return; }
    const hasSession = typeof document !== "undefined" && document.cookie.includes("session=");
    if (!isAuthenticated && !hasSession) { navigateToLogin(`/animals/${animalSlug}?share=${selectedSharePercent}`); return; }
    const plan = data?.plans?.[0] ?? null;
    const dur = plan?.durations?.[0] ?? null;
    await purchaseShare.mutateAsync({
      animalId: data.id,
      sharePercent: selectedSharePercent,
      ...(plan?.id ? { planId: plan.id } : {}),
      ...(dur?.id ? { planDurationId: dur.id } : {}),
      notes: `Бронь ${selectedSharePercent}% через профиль животного`,
    });
  }

  /* Early returns moved below all hooks — see after useEffect block */

  /* ── key facts for hero ── */
  const keyFacts = [
    { label: "Вид", value: speciesLabel, icon: Dna },
    { label: "Порода", value: breedLabel, icon: Leaf },
    { label: "Доли занято", value: `${ownedPercent}%`, icon: Heart },
    { label: "Доступно", value: `${availablePercent}%`, icon: Package },
  ];

  const healthScore = data?.healthScore ?? 94;
  const happinessScore = data?.happinessScore ?? 87;

  /* ── age & birthday countdown ── */
  const ageInfo = useMemo(() => {
    if (!data?.birthDate) return null;
    const birth = new Date(typeof data.birthDate === "number" ? data.birthDate : data.birthDate);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();

    // Calculate age in years and months (rounded down for months)
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) { years--; months += 12; }
    if (now.getDate() < birth.getDate()) {
      months--;
      if (months < 0) { years--; months += 12; }
    }

    // Format age string
    const yLabel = years === 1 ? "год" : (years >= 2 && years <= 4) ? "года" : "лет";
    const mLabel = months === 1 ? "месяц" : (months >= 2 && months <= 4) ? "месяца" : "месяцев";
    let ageStr = "";
    if (years > 0) ageStr += `${years} ${yLabel}`;
    if (months > 0) ageStr += `${ageStr ? ", " : ""}${months} ${mLabel}`;
    if (!ageStr) ageStr = "менее месяца";

    // Days until next birthday
    const nextBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    if (nextBirthday <= now) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
    const diffMs = nextBirthday.getTime() - now.getTime();
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const dLabel = daysUntil === 1 ? "день" : (daysUntil >= 2 && daysUntil <= 4) ? "дня" : "дней";
    const birthdayStr = daysUntil === 0 ? "Сегодня день рождения!" : `До дня рождения: ${daysUntil} ${dLabel}`;

    return { ageStr, birthdayStr, daysUntil };
  }, [data?.birthDate]);

  /* ── passport rows ── */
  const passportRows = [
    { label: "Вид", value: speciesLabel },
    { label: "Порода", value: breedLabel },
    { label: "Имя", value: displayName },
    ...(ageInfo ? [{ label: "Возраст", value: ageInfo.ageStr }] : []),
    ...(ageInfo ? [{ label: "День рождения", value: ageInfo.birthdayStr }] : []),
    { label: "Здоровье", value: `${healthScore}/100` },
    { label: "Настроение", value: `${happinessScore}/100` },
    ...(data?.shortDescription ? [{ label: "Описание", value: data.shortDescription }] : []),
    ...(data?.story ? [{ label: "История", value: data.story }] : []),
  ];

    const serverCoverUrl = (data?.coverImageUrl && data.coverImageUrl !== "NULL")
      ? data.coverImageUrl
      : (photosQuery.isLoading ? undefined : (selectedImage?.src ?? data?.coverImageUrl ?? undefined));
    const cachedCover = useCoverCache(animalSlug, serverCoverUrl ?? null);
    const coverUrl = serverCoverUrl ?? cachedCover ?? undefined;

  /* ── Profile completeness (animated) ── */
  const profileChecks = useMemo(() => [
    { label: "Фото в галерее", done: (photosQuery.data?.length ?? 0) > 0, tip: "Загрузите фото в галерею" },
    { label: "Доля оформлена", done: hasOwnerAccess, tip: "Оформите долю в животном" },
    { label: "Дневник заполнен", done: diaryEntries.length > 0, tip: "Подождите первых записей в дневнике" },
    { label: "Метрики благополучия", done: Boolean(wellnessData), tip: "Метрики появятся после оформления доли" },
    { label: "Паспорт заполнен", done: passportRows.length >= 3, tip: "Данные паспорта заполняются фермером" },
  ], [photosQuery.data?.length, hasOwnerAccess, diaryEntries.length, wellnessData, passportRows.length]);

  const profileDoneCount = useMemo(() => profileChecks.filter(c => c.done).length, [profileChecks]);
  const profilePercent = useMemo(() => Math.round((profileDoneCount / profileChecks.length) * 100), [profileDoneCount, profileChecks.length]);
  const profileIncomplete = useMemo(() => profileChecks.filter(c => !c.done), [profileChecks]);

  // Animated percent display
  const [animatedPercent, setAnimatedPercent] = useState(profilePercent);
  const prevPercentRef = useRef(profilePercent);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const prev = prevPercentRef.current;
    if (prev === profilePercent) return;
    prevPercentRef.current = profilePercent;

    // Animate the number counting up/down
    const start = prev;
    const end = profilePercent;
    const diff = end - start;
    const duration = 800; // ms
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPercent(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Show celebration if reached 100%
    if (profilePercent === 100 && prev < 100) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [profilePercent]);

  /* ── Early returns (after all hooks to satisfy Rules of Hooks) ── */
  if (animalQuery.isLoading) {
    return (
      <>
        <Navbar />
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-background via-secondary/30 to-background pb-10 pt-24 md:pb-14 md:pt-28">
          <div className="container">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
              <div className="min-w-0 space-y-4">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-12 w-64 animate-pulse rounded bg-muted" />
                <div className="h-5 w-80 animate-pulse rounded bg-muted" />
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[1,2,3,4].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
                </div>
              </div>
              <div className="h-[360px] animate-pulse rounded-3xl bg-muted md:h-[440px]" />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!animalQuery.isLoading && !data && animalSlug) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-2xl font-semibold text-foreground">Животное не найдено</h2>
          <p className="max-w-md text-muted-foreground">Профиль «{animalSlug}» не найден — возможно, животное уже нашло свою семью или страница была перемещена.</p>
          <Link href="/animals" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95">
            Перейти в каталог <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </>
    );
  }

  if (!animalSlug) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Выберите животное</h2>
          <Link href="/animals" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Перейти в каталог <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </>
    );
  }

  /* ────────────────────────── RENDER ──────────────────────── */
  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />

        {/* ═══ HERO: Compact name, photo, key facts ═══ */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-background via-secondary/30 to-background pb-10 pt-24 md:pb-14 md:pt-28">
          <div className="container">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
              {/* Left: info */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
                <PageBreadcrumbs
                  className="mb-3"
                  items={[
                    { label: "Главная", href: "/" },
                    { label: "Каталог", href: "/animals" },
                    { label: displayName },
                  ]}
                />

                <div className="mt-2 flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${data?.status === "fully_booked" ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {getAnimalStatusLabel(data?.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">{speciesLabel} · {breedLabel}</span>
                </div>

                <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
                  {displayName}
                  {ageInfo && (
                    <span className="ml-3 align-middle text-lg font-normal text-muted-foreground md:text-xl">
                      {ageInfo.ageStr}
                    </span>
                  )}
                </h1>

                {ageInfo && (
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Cake className="h-4 w-4 text-primary/70" />
                    <span>{ageInfo.daysUntil === 0 ? <span className="font-semibold text-primary">{ageInfo.birthdayStr}</span> : ageInfo.birthdayStr}</span>
                  </div>
                )}

                {data?.shortDescription ? (
                  <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">{data.shortDescription}</p>
                ) : null}

                {/* Key facts — compact 2x2 grid */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {keyFacts.map((fact) => {
                    const Icon = fact.icon;
                    return (
                      <div key={fact.label} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 text-center">
                        <Icon className="mx-auto h-3.5 w-3.5 text-primary" />
                        <div className="mt-1 text-base font-semibold text-foreground">{fact.value}</div>
                        <div className="text-[11px] text-muted-foreground">{fact.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick CTA */}
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {hasOwnerAccess ? (
                    <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95">
                      Кабинет владельца <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => document.getElementById("share-purchase")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95">
                      Выбрать долю <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => setGalleryDialogOpen(true)} className="group/gal relative inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted">
                    <Images className="h-4 w-4" /> Галерея
                    <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2.5 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover/gal:opacity-100">{galleryImages.length} фото</span>
                  </button>
                  {isAuthenticated && (
                    <button type="button" onClick={() => setCropDialogOpen(true)} className="group/upl relative inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50">
                      <Camera className="h-4 w-4" /> Добавить фото
                      <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2.5 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover/upl:opacity-100">Загрузить фото в галерею</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setPassportDialogOpen(true)} className="group/pas relative inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted">
                    <FileText className="h-4 w-4" /> Паспорт
                    <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2.5 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover/pas:opacity-100">Документы и данные</span>
                  </button>
                  <Link href={`/compare?animal=${animalSlug}`} className={`group/cmp relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${hasOwnerAccess ? 'border-2 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20' : 'border border-border bg-card text-foreground hover:bg-muted'}`}>
                    <ArrowLeftRight className="h-4 w-4" /> Сравнить
                    <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2.5 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover/cmp:opacity-100">Сравните метрики с другим животным</span>
                  </Link>
                </div>
              </motion.div>

              {/* Right: main photo */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="relative">
                <div className="overflow-hidden rounded-3xl border border-border/60 shadow-lg">
                  {coverUrl ? (
                    <LazyImage
                      src={coverUrl}
                      alt={displayName}
                      className="h-[360px] w-full object-contain bg-muted/30 md:h-[440px]"
                      wrapperClassName="h-[360px] w-full md:h-[440px]"
                    />
                  ) : (
                    <div className="h-[360px] w-full animate-pulse bg-muted/30 md:h-[440px]" />
                  )}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    Онлайн · Ферма Шерь Козу
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══ SHARE PURCHASE ═══ */}
        <section id="share-purchase" className="border-b border-border/60 bg-card/50 py-8 md:py-12">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-5 text-center">
                <p className="text-xs uppercase tracking-widest text-primary">Персональное участие</p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">Станьте частью истории {displayName}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Минимальная доля — {shareUnitPercent}%. Полная стоимость участия — {formatCurrency(fullPriceMinor, currencyCode)}.
                </p>
              </div>

              {isGuestPreview ? (
                <div data-testid="animal-guest-preview-banner" className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Чтобы стать частью истории {displayName}, войдите в аккаунт или зарегистрируйтесь.</p>
                  <a href={getLoginUrl(`/animals/${animalSlug}`)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                    Войти или зарегистрироваться
                  </a>
                </div>
              ) : null}

              <AnimalShareCard
                statusLabel={getAnimalStatusLabel(data?.status)}
                statusClassName={data?.status === "fully_booked" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-primary/20 bg-primary/10 text-primary"}
                name={displayName}
                breedLabel={breedLabel}
                priceLabel={formatCurrency(fullPriceMinor, currencyCode)}
                occupiedPercent={ownedPercent}
                availablePercent={availablePercent}
                shareUnitPercent={shareUnitPercent}
                primarySharePercent={availableSharePercents[0] ?? shareUnitPercent}
                primarySharePriceLabel={formatCurrency(data?.primarySharePriceMinor ?? Math.round((fullPriceMinor * (availableSharePercents[0] ?? shareUnitPercent)) / 100), currencyCode)}
                availableSharePercents={availableSharePercents}
                helperText={hasOwnerAccess ? `Вы уже заботитесь о ${displayName} — ваша доля ${mySharePercent}%.` : `Выберите долю — и начните свою историю с ${displayName}.`}
                description={hasOwnerAccess ? "Хотите увеличить участие? Оформите дополнительную долю, пока она свободна." : "После оформления вам откроется личный кабинет, дневник и именная коробка с продуктами."}
                ctaLabel={hasOwnerAccess ? "Увеличить свою долю" : isAuthenticated ? "Забронировать долю" : "Войдите, чтобы познакомиться"}
                onCtaClick={handlePurchaseShare}
                ctaDisabled={!availableSharePercents.length || purchaseShare.isPending}
                ctaPending={purchaseShare.isPending}
                ctaLoginRequired={!isAuthenticated}
                selectedSharePercent={selectedSharePercent}
                onShareSelect={(percent: number) => setSelectedSharePercent(percent === 100 ? 100 : 50)}
                selectable
                defaultPlanLabel={data?.plans?.[0]?.name ?? "Базовый план"}
                defaultPlanMeta={data?.plans?.[0]?.durations?.[0] ? `${data.plans[0].durations[0].months} мес. · ${data.plans[0].durations[0].label}` : "Срок будет подтверждён фермером"}
                footer={
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Стоимость вашей доли</div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(selectedSharePriceMinor, currencyCode)}</div>
                    <p className="mt-1 text-sm text-muted-foreground">Бронирование с подтверждением — фермер свяжется с вами лично.</p>
                  </div>
                }
              />
            </div>

            {/* Owner names - public view */}
            {data?.shareDistribution && data.shareDistribution.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Владельцы</span>
                </div>
                <div className="space-y-2">
                  {data.shareDistribution.map((entry: { familyName: string; percent: number; planLabel: string }, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground">{formatOwnerNamePublic(entry.familyName)}</span>
                      <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5">{entry.percent}%</span>
                    </div>
                  ))}
                  {(data?.availablePercent ?? 0) > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                      <span className="text-sm text-muted-foreground">Свободно</span>
                      <span className="text-xs text-muted-foreground">{data?.availablePercent}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══ COLLAPSIBLE SECTIONS — organized, friendly ═══ */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="mx-auto max-w-5xl space-y-3">

              {/* ── Profile Completeness Indicator ── */}
              {isAuthenticated ? (
                  <div className="rounded-2xl border border-border/70 bg-card p-5 relative overflow-hidden">
                    {/* Celebration pulse overlay */}
                    <AnimatePresence>
                      {showCelebration && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.1 }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-emerald-400/20 to-emerald-500/10 rounded-2xl pointer-events-none z-10"
                        />
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={showCelebration ? { rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 0.6 }}
                        >
                          <CircleDot className={`h-4 w-4 ${profilePercent === 100 ? 'text-emerald-600' : 'text-primary'}`} />
                        </motion.div>
                        <span className="text-sm font-semibold text-foreground">
                          Профиль заполнен на{" "}
                          <motion.span
                            key={profilePercent}
                            className={`inline-block tabular-nums ${profilePercent === 100 ? 'text-emerald-600' : ''}`}
                          >
                            {animatedPercent}%
                          </motion.span>
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{profileDoneCount}/{profileChecks.length}</span>
                    </div>

                    {/* Animated progress bar */}
                    <div className="relative h-2 mb-3 bg-primary/20 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${profilePercent === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                        initial={false}
                        animate={{ width: `${profilePercent}%` }}
                        transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {profileChecks.map((c, i) => (
                        <motion.div
                          key={c.label}
                          initial={false}
                          animate={c.done ? { backgroundColor: 'rgb(236 253 245)', color: 'rgb(4 120 87)' } : {}}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${c.done ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/40 text-muted-foreground'}`}
                        >
                          <AnimatePresence mode="wait">
                            {c.done ? (
                              <motion.div
                                key="done"
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              </motion.div>
                            ) : (
                              <motion.div key="pending" exit={{ scale: 0 }}>
                                <CircleDot className="h-3.5 w-3.5 shrink-0 opacity-40" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <span className={c.done ? 'line-through opacity-70' : ''}>{c.label}</span>
                        </motion.div>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {profileIncomplete.length > 0 ? (
                        <motion.p
                          key="tip"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.3 }}
                          className="mt-3 text-xs text-muted-foreground"
                        >
                          Совет: {profileIncomplete[0].tip}
                        </motion.p>
                      ) : (
                        <motion.p
                          key="complete"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.3 }}
                          className="mt-3 text-xs text-emerald-600 font-medium"
                        >
                          Профиль полностью заполнен!
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
              ) : null}

              {/* ── Diary & Health ── */}
              <ProfileSection id="diary-section" icon={BookOpen} title={`Дневник и здоровье`} badge="4 записи" defaultOpen={false}>
                <Tabs defaultValue="diary" className="w-full">
                  <TabsList className="mb-4 w-full">
                    <TabsTrigger value="diary" className="flex-1 gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" /> Дневник
                    </TabsTrigger>
                    <TabsTrigger value="health" className="flex-1 gap-1.5">
                      <Thermometer className="h-3.5 w-3.5" /> Здоровье
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="diary">
                    <ScrollRemaining totalItems={diaryEntries.length} itemHeight={110} className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {diaryEntries.map((entry) => (
                        <div key={entry.date} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{entry.mood}</span>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{entry.title}</h4>
                              <p className="text-[11px] text-muted-foreground">{entry.date}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.text}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {entry.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">{tag}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </ScrollRemaining>
                  </TabsContent>

                  <TabsContent value="health">
                    <div className="space-y-3">
                      {/* Health scores */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-center">
                          <Heart className="mx-auto h-5 w-5 text-rose-500" />
                          <div className="mt-2 text-2xl font-bold text-foreground">{healthScore}</div>
                          <p className="text-[11px] text-muted-foreground">Здоровье</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-center">
                          <Star className="mx-auto h-5 w-5 text-amber-500" />
                          <div className="mt-2 text-2xl font-bold text-foreground">{happinessScore}</div>
                          <p className="text-[11px] text-muted-foreground">Настроение</p>
                        </div>
                      </div>

                      {/* Health history */}
                      <ScrollRemaining totalItems={healthHistory.length} itemHeight={80} className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {healthHistory.map((item) => (
                          <div key={item.date} className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                            <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-medium text-foreground">{item.event}</h5>
                                <span className="text-[11px] text-muted-foreground">{item.date}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                            </div>
                          </div>
                        ))}
                      </ScrollRemaining>
                    </div>
                  </TabsContent>
                </Tabs>
              </ProfileSection>

              {/* ── Wellness Radar ── */}
              {hasOwnerAccess ? (
                <ProfileSection id="wellness-section" icon={Zap} title="Благополучие" badge={wellnessData ? `${Math.round(((wellnessData.happiness ?? 0) + (wellnessData.health ?? 0) + (wellnessData.attachment ?? 0) + (wellnessData.mood ?? 0) + (wellnessData.obedience ?? 0)) / 5)} / 100` : undefined} defaultOpen={false}>
                  {wellnessData ? (
                    <div className="flex flex-col items-center gap-4">
                      <WellnessRadarChart metrics={{
                        happiness: wellnessData.happiness ?? 0,
                        health: wellnessData.health ?? 0,
                        attachment: wellnessData.attachment ?? 0,
                        mood: wellnessData.mood ?? 0,
                        obedience: wellnessData.obedience ?? 0,
                      }} size={260} />
                      <p className="text-center text-sm text-muted-foreground">Метрики обновляются ежедневно на основе данных фермера.</p>
                      <Link href="/marketplace" className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20">
                        <Heart className="h-4 w-4" /> Позаботиться
                      </Link>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">Данные о благополучии пока не доступны.</p>
                    </div>
                  )}
                </ProfileSection>
              ) : null}

              {/* ── Product Plan (owners only) ── */}
              {hasOwnerAccess && data?.id ? (
                <ProfileSection id="product-plan-section" icon={Milk} title="Продуктовый план" defaultOpen={false}>
                  <OwnerProductPlanSection animalId={data.id} animalSlug={animalSlug!} animalName={displayName} mySharePercent={mySharePercent} species={(data?.species as "goat" | "sheep") ?? "goat"} />
                </ProfileSection>
              ) : null}



              {/* ── Quick Links ── */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Link href="/dashboard" className="group rounded-2xl border border-border/70 bg-card p-5 transition hover:bg-muted/30">
                  <Calendar className="h-6 w-6 text-primary" />
                  <h4 className="mt-3 font-semibold text-foreground">Кабинет владельца</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Управляйте долями, следите за рейтингом и получайте обновления.</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Открыть <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
                <Link href={`/tracker?animal=${animalSlug}`} className="group rounded-2xl border border-border/70 bg-card p-5 transition hover:bg-muted/30">
                  <MapPin className="h-6 w-6 text-primary" />
                  <h4 className="mt-3 font-semibold text-foreground">Трекер продуктов</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Отслеживайте путь молока и продуктов от фермы до вашего дома.</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Открыть <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
                <Link href={`/club?animal=${animalSlug}`} className="group rounded-2xl border border-border/70 bg-card p-5 transition hover:bg-muted/30">
                  <Heart className="h-6 w-6 text-primary" />
                  <h4 className="mt-3 font-semibold text-foreground">Клуб Шерь Козу</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Семейные визиты, мастер-классы и встречи с вашим животным.</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Открыть <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Guest sticky CTA ═══ */}
        {isGuestPreview ? (
          <div data-testid="animal-guest-preview-sticky-register" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4">
            <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-white/92 px-5 py-3 shadow-lg backdrop-blur">
              <p className="text-sm text-muted-foreground">Войдите, чтобы стать частью истории {displayName}</p>
              <a href={getLoginUrl(`/animals/${animalSlug}`)} className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                Войти
              </a>
            </div>
          </div>
        ) : null}

        {/* ═══ Lightbox ═══ */}
        <AnimatePresence>
          {lightboxOpen && selectedImage ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10" onClick={() => setLightboxOpen(false)}>
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setLightboxOpen(false)} className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow transition hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
                <img src={selectedImage.src} alt={selectedImage.title} className="max-h-[80vh] w-full object-contain bg-muted/30" />
                <div className="border-t border-border/70 p-5">
                  <h4 className="text-xl font-semibold text-foreground">{selectedImage.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedImage.meta}</p>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ═══ Crop Dialog ═══ */}
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          onConfirm={handleCropConfirm}
          isUploading={uploadPhoto.isPending}
          title="Загрузить фото"
          description="Перетащите изображение для позиционирования. Фото автоматически сжимается до 1200×1200px JPEG."
        />

        {/* ═══ Gallery Dialog ═══ */}
        <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Images className="h-5 w-5 text-primary" />
                Галерея {displayName}
              </DialogTitle>
              <DialogDescription>{galleryImages.length} фото</DialogDescription>
            </DialogHeader>

            {/* Empty gallery state */}
            {(photosQuery.data?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <Camera className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Галерея пуста</h3>
                {isAuthenticated && uploadLimitData && uploadLimitData.limit > 0 ? (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Загрузите первое фото! У вас {uploadLimitData.limit} {uploadLimitData.limit === 1 ? "слот" : uploadLimitData.limit < 5 ? "слота" : "слотов"} для фото (по количеству долей).
                    </p>
                    <button
                      type="button"
                      onClick={() => setCropDialogOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      <Camera className="h-4 w-4" />
                      Загрузить фото
                    </button>
                  </>
                ) : isAuthenticated && uploadLimitData && uploadLimitData.limit === 0 ? (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Чтобы загружать фото, приобретите долю. Количество фото = количеству долей.
                    </p>
                    <a
                      href={`/animals/${animalSlug}`}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                      <Heart className="h-4 w-4" />
                      Приобрести долю
                    </a>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Войдите в аккаунт, чтобы загружать фото.
                  </p>
                )}
              </div>
            )}

            {/* Main viewer */}
            {(photosQuery.data?.length ?? 0) > 0 && (<div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
              <div className="relative">
                <img src={selectedImage?.src} alt={selectedImage?.title ?? displayName} className="h-[280px] w-full object-contain bg-muted/30 md:h-[380px]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                  <h4 className="text-lg font-semibold">{selectedImage?.title}</h4>
                  <p className="mt-0.5 text-xs text-white/75">{selectedImage?.meta}</p>
                </div>
                <button type="button" onClick={() => moveGallery("prev")} className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow transition hover:bg-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => moveGallery("next")} className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow transition hover:bg-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>)}

            {/* Thumbnails + Upload button */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img) => (
                  <button key={img.id} type="button" onClick={() => setSelectedImageId(img.id)} className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition ${selectedImageId === img.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"} ${(img as any).moderationStatus === "pending" ? "opacity-60" : ""}`}>
                    <img src={img.src} alt={img.title} className="h-16 w-24 object-cover" />
                    {(img as any).moderationStatus === "pending" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20">
                        <div className="rounded-full bg-amber-500/90 p-0.5" title="На проверке">
                          <Clock3 className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    {(img as any).moderationStatus === "rejected" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
                        <div className="rounded-full bg-rose-500/90 p-0.5" title="Отклонено">
                          <XCircle className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    {(img as any).isAdminCover && (img as any).moderationStatus !== "pending" && (img as any).moderationStatus !== "rejected" && (
                      <div className="absolute top-0.5 right-0.5 rounded-full bg-amber-400/90 p-0.5" title="Обложка фермы">
                        <ShieldCheck className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    {(img as any).isOwnPhoto && !(img as any).isAdminCover && (img as any).moderationStatus !== "pending" && (img as any).moderationStatus !== "rejected" && (
                      <div className="absolute top-0.5 left-0.5 rounded-full bg-primary/80 p-0.5" title="Ваше фото">
                        <Camera className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {/* Upload button inline with thumbnails */}
              {isAuthenticated && uploadLimitData && uploadLimitData.remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setCropDialogOpen(true)}
                  className="shrink-0 flex flex-col items-center justify-center h-16 w-20 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 hover:border-emerald-400 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                  title={`Загрузить фото (${uploadLimitData.used}/${uploadLimitData.limit})`}
                >
                  <Camera className="h-5 w-5" />
                  <span className="mt-0.5 text-[10px] font-medium">{uploadLimitData.used}/{uploadLimitData.limit}</span>
                </button>
              )}
              {isAuthenticated && uploadLimitData && uploadLimitData.remaining <= 0 && uploadLimitData.limit > 0 && (
                <div
                  className="shrink-0 flex flex-col items-center justify-center h-16 w-20 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground cursor-not-allowed"
                  title={`Все ${uploadLimitData.limit} слотов использованы`}
                >
                  <Camera className="h-5 w-5 opacity-40" />
                  <span className="mt-0.5 text-[10px] font-medium">{uploadLimitData.used}/{uploadLimitData.limit}</span>
                </div>
              )}
            </div>

            {/* Gallery actions — available to all authenticated users */}
            {isAuthenticated ? (
              <div className="mt-3 space-y-2.5">
                {/* Moderation status: pending */}
                {selectedImage && (selectedImage as any).moderationStatus === "pending" && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                    <span>Это фото ожидает проверки администратором. После одобрения оно появится в галерее для всех.</span>
                  </div>
                )}

                {/* Moderation status: rejected */}
                {selectedImage && (selectedImage as any).moderationStatus === "rejected" && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-300 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-700 dark:text-rose-300">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Фото отклонено администратором. Вы можете удалить его и загрузить новое.</span>
                  </div>
                )}

                {/* Admin-cover badge */}
                {selectedImage && (selectedImage as any).isAdminCover && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Обложка установлена администратором фермы — удалить или изменить нельзя</span>
                  </div>
                )}

                {/* Upload limit info */}
                {isAuthenticated && uploadLimitData && uploadLimitData.limit > 0 && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${uploadLimitData.remaining > 0 ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300" : "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300"}`}>
                    <Camera className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {uploadLimitData.isAdmin
                        ? `Админ: ${uploadLimitData.used}/1 фото-обложка`
                        : uploadLimitData.remaining > 0
                          ? `Фото: ${uploadLimitData.used} из ${uploadLimitData.limit} (по количеству долей). Можно загрузить ещё ${uploadLimitData.remaining}.`
                          : `Все ${uploadLimitData.limit} слотов использованы. Удалите фото, чтобы загрузить новое.`
                      }
                    </span>
                  </div>
                )}
                {isAuthenticated && uploadLimitData && uploadLimitData.limit === 0 && !uploadLimitData.isAdmin && (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300">
                    <Camera className="h-3.5 w-3.5 shrink-0" />
                    <span>Чтобы загружать фото, приобретите долю. Количество фото = количеству долей.</span>
                  </div>
                )}

                {/* Action buttons for selected photo */}
                <div className="flex flex-wrap gap-2">
                  {selectedImage?.isUploaded && selectedImage?.photoId ? (
                    <>
                      {/* Cover button — only for admins (owner) */}
                      {(selectedImage as any).canEdit && (
                        <button type="button" onClick={() => handleSetCoverImage(selectedImage)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                          <Star className="h-3.5 w-3.5" /> Сделать обложкой
                        </button>
                      )}
                      {/* Reorder — only for own photos or admin */}
                      {(selectedImage as any).canEdit && (
                        <>
                          <button type="button" onClick={() => moveUploadedPhoto(selectedImage.photoId!, "left")} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs transition hover:bg-muted" title="Переместить влево">
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => moveUploadedPhoto(selectedImage.photoId!, "right")} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs transition hover:bg-muted" title="Переместить вправо">
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </>
                      )}
                      {/* Delete — prominent red button */}
                      {(selectedImage as any).canDelete && (
                        <button type="button" onClick={() => handleRemoveUploadedImage(selectedImage)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-600 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/40">
                          <Trash2 className="h-4 w-4" /> Удалить фото
                        </button>
                      )}
                    </>
                  ) : null}
                  <button type="button" onClick={() => { setGalleryDialogOpen(false); setLightboxOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                    <Play className="h-3.5 w-3.5" /> Полный размер
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground">Войдите, чтобы загружать фото в галерею.</p>
                <a data-testid="animal-guest-preview-register-cta-secondary" href={getLoginUrl(`/animals/${animalSlug}`)} className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5">
                  Войти или зарегистрироваться
                </a>
              </div>
            )}

            {/* Share buttons */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={handleCopyShareLink} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                <Link2 className="h-3.5 w-3.5" /> Скопировать ссылку
              </button>
              <button type="button" onClick={() => handleShare("facebook")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs transition hover:bg-muted">
                <Facebook className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => handleShare("vk")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs transition hover:bg-muted">
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => handleShare("instagram")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs transition hover:bg-muted">
                <Instagram className="h-3.5 w-3.5" />
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ Passport Dialog ═══ */}
        <Dialog open={passportDialogOpen} onOpenChange={setPassportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Dna className="h-5 w-5 text-primary" />
                Паспорт {displayName}
              </DialogTitle>
              <DialogDescription>{speciesLabel} · {breedLabel}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {passportRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3 rounded-lg bg-muted/20 px-4 py-2.5">
                  <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</span>
                  <span className="text-sm text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

