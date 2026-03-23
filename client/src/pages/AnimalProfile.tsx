import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import AnimalShareCard from "@/components/AnimalShareCard";
import {
  Heart,
  Thermometer,
  Milk,
  Camera,
  Star,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
import OwnerProductPlanSection from "./OwnerProductPlanSection";
import WellnessRadarChart from "@/components/WellnessRadarChart";

/* ── constants ── */
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  farm: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
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

type CropDraft = {
  file: File;
  previewUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
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

/* ── component ── */
export default function AnimalProfile() {
  const [, setLocation] = useLocation();
  const animalSlug = useAnimalSlug();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<"diary" | "health">("diary");
  const [selectedImageId, setSelectedImageId] = useState("cover");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoActivity, setPhotoActivity] = useState<PhotoActivity[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [coverImageId, setCoverImageId] = useState("cover");

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
    { enabled: Boolean(animalSlug) && isAuthenticated && hasOwnerAccess },
  );

  const initialSharePercent = useMemo(() => {
    if (typeof window === "undefined") return 10;
    const value = Number(new URLSearchParams(window.location.search).get("share"));
    return Number.isFinite(value) && value > 0 ? value : 10;
  }, []);
  const [selectedSharePercent, setSelectedSharePercent] = useState(initialSharePercent);

  const availableSharePercents = data?.availableSharePercents ?? [];
  const fullPriceMinor = data?.fullPriceMinor ?? data?.baseMonthlyPriceMinor ?? 0;
  const shareUnitPercent = data?.shareUnitPercent ?? 10;
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

  /* ── gallery logic ── */
  const galleryImages = useMemo<GalleryImage[]>(() => {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const coverFromServer = persistent.find((image) => image.isCover)?.id;
    const fallbackCoverId = persistent.length > 0 ? persistent[0].id : coverImageId;
    const merged = [
      ...persistent.map((image, index) => ({ ...image, sortOrder: image.sortOrder ?? index })),
      ...defaultGallery.map((image, index) => ({ ...image, sortOrder: persistent.length + index })),
    ];
    return merged.map((image) => ({
      ...image,
      isCover: coverFromServer ? image.id === coverFromServer : image.id === fallbackCoverId,
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
    if (!availableSharePercents.length) { setSelectedSharePercent(shareUnitPercent); return; }
    if (!availableSharePercents.includes(selectedSharePercent)) setSelectedSharePercent(availableSharePercents[0]);
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
    if (typeof window === "undefined") return `https://sherkozu.manus.space/animals/${animalSlug}`;
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

  function openCropperForFile(file?: File) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) { toast.error("Неподдерживаемый формат"); return; }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) { toast.error("Файл слишком большой (макс. 8 МБ)"); return; }
    setCropDraft({ file, previewUrl: URL.createObjectURL(file), zoom: 1, offsetX: 0, offsetY: 0 });
  }

  async function handleGalleryUpload(event: ChangeEvent<HTMLInputElement>) { openCropperForFile(event.target.files?.[0]); event.target.value = ""; }
  function handleDropZoneDragOver(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setIsDragActive(true); }
  function handleDropZoneDragLeave(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setIsDragActive(false); }
  function handleDropZoneDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setIsDragActive(false); openCropperForFile(event.dataTransfer.files?.[0]); }
  function closeCropDraft() { setCropDraft((c) => { if (c?.previewUrl) URL.revokeObjectURL(c.previewUrl); return null; }); }

  async function handleConfirmCrop() {
    if (!cropDraft) return;
    const image = new Image();
    image.src = cropDraft.previewUrl;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Ошибка")); });
    const canvas = document.createElement("canvas");
    const size = 1200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { toast.error("Ошибка редактора"); return; }
    const minSide = Math.min(image.width, image.height);
    const cropSide = minSide / cropDraft.zoom;
    const maxOX = Math.max((image.width - cropSide) / 2, 0);
    const maxOY = Math.max((image.height - cropSide) / 2, 0);
    ctx.drawImage(image, (image.width - cropSide) / 2 + cropDraft.offsetX * maxOX, (image.height - cropSide) / 2 + cropDraft.offsetY * maxOY, cropSide, cropSide, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { toast.error("Ошибка кадрирования"); return; }
    const processedFile = new File([blob], cropDraft.file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg", { type: "image/jpeg" });
    await uploadPhoto.mutateAsync({ animalSlug: animalSlug!, fileName: processedFile.name, mimeType: processedFile.type, sizeBytes: processedFile.size, base64Data: await fileToBase64(processedFile) });
    closeCropDraft();
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
    const hasSession = typeof document !== "undefined" && document.cookie.includes("manus_session=");
    if (!isAuthenticated && !hasSession) { window.location.href = getLoginUrl(`/animals/${animalSlug}?share=${selectedSharePercent}`); return; }
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

  /* redirect if slug not found */
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

  /* ── key facts for hero ── */
  const keyFacts = [
    { label: "Вид", value: speciesLabel, icon: Dna },
    { label: "Порода", value: breedLabel, icon: Leaf },
    { label: "Доли занято", value: `${ownedPercent}%`, icon: Heart },
    { label: "Доступно", value: `${availablePercent}%`, icon: Package },
  ];

  const healthScore = data?.healthScore ?? 94;
  const happinessScore = data?.happinessScore ?? 87;

  /* ── passport rows ── */
  const passportRows = [
    { label: "Вид", value: speciesLabel },
    { label: "Порода", value: breedLabel },
    { label: "Имя", value: displayName },
    { label: "Здоровье", value: `${healthScore}/100` },
    { label: "Настроение", value: `${happinessScore}/100` },
    ...(data?.shortDescription ? [{ label: "Описание", value: data.shortDescription }] : []),
    ...(data?.story ? [{ label: "История", value: data.story }] : []),
  ];

  const coverUrl = data?.coverImageUrl ?? selectedImage?.src ?? CDN.hero;

  /* ────────────────────────── RENDER ────────────────────────── */
  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />

        {/* ═══ SECTION 1: Hero — name, photo, key facts ═══ */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-background via-secondary/30 to-background pb-12 pt-24 md:pb-16 md:pt-28">
          <div className="container">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
              {/* Left: info */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
                <Link href="/animals" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
                  <ChevronLeft className="h-4 w-4" /> Каталог животных
                </Link>

                <div className="mt-2 flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${data?.status === "fully_booked" ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {getAnimalStatusLabel(data?.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">{speciesLabel} · {breedLabel}</span>
                </div>

                <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
                  {displayName}
                </h1>

                {data?.shortDescription ? (
                  <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">{data.shortDescription}</p>
                ) : null}

                {/* Key facts grid */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {keyFacts.map((fact) => {
                    const Icon = fact.icon;
                    return (
                      <div key={fact.label} className="rounded-2xl border border-border/70 bg-card p-3 text-center">
                        <Icon className="mx-auto h-4 w-4 text-primary" />
                        <div className="mt-1.5 text-lg font-semibold text-foreground">{fact.value}</div>
                        <div className="text-xs text-muted-foreground">{fact.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick CTA */}
                <div className="mt-6 flex flex-wrap gap-3">
                  {hasOwnerAccess ? (
                    <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95">
                      Кабинет владельца <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => document.getElementById("share-purchase")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95">
                      Выбрать долю <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => document.getElementById("gallery-section")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted">
                    <Images className="h-4 w-4" /> Галерея
                  </button>
                  <Link href={`/compare?animal=${animalSlug}`} className={`group/cmp relative inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition ${hasOwnerAccess ? 'border-2 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20' : 'border border-border bg-card text-foreground hover:bg-muted'}`}>
                    <ArrowLeftRight className="h-4 w-4" /> Сравнить
                    <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2.5 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover/cmp:opacity-100">Сравните метрики с другим животным</span>
                  </Link>
                </div>
              </motion.div>

              {/* Right: main photo */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="relative">
                <div className="overflow-hidden rounded-3xl border border-border/60 shadow-lg">
                  <img src={coverUrl} alt={displayName} className="h-[400px] w-full object-cover md:h-[480px]" />
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

        {/* ═══ SECTION 2: Share purchase ═══ */}
        <section id="share-purchase" className="border-b border-border/60 bg-card/50 py-10 md:py-14">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 text-center">
                <p className="text-xs uppercase tracking-widest text-primary">Персональное участие</p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">Станьте частью истории {displayName}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Минимальная доля — {shareUnitPercent}%. Полная стоимость участия — {formatCurrency(fullPriceMinor, currencyCode)}.
                </p>
              </div>

              {isGuestPreview ? (
                <div data-testid="animal-guest-preview-banner" className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center">
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
                onShareSelect={setSelectedSharePercent}
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
          </div>
        </section>

        {/* ═══ SECTION 3: Gallery ═══ */}
        <section id="gallery-section" className="border-b border-border/60 py-10 md:py-14">
          <div className="container">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">Галерея</p>
                <h2 className="mt-1 text-2xl font-semibold text-foreground">Фотографии {displayName}</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <Images className="h-3.5 w-3.5" /> {galleryImages.length} фото
              </span>
            </div>

            {/* Main viewer */}
            <div className="mt-6 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
              <div className="relative">
                <img src={selectedImage?.src ?? CDN.hero} alt={selectedImage?.title ?? displayName} className="h-[360px] w-full object-cover md:h-[480px]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 text-white">
                  <h4 className="text-xl font-semibold">{selectedImage?.title}</h4>
                  <p className="mt-1 text-sm text-white/75">{selectedImage?.meta}</p>
                </div>
                <button type="button" onClick={() => moveGallery("prev")} className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow transition hover:bg-white">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => moveGallery("next")} className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow transition hover:bg-white">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {galleryImages.map((img) => (
                <button key={img.id} type="button" onClick={() => setSelectedImageId(img.id)} className={`shrink-0 overflow-hidden rounded-2xl border-2 transition ${selectedImageId === img.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}>
                  <img src={img.src} alt={img.title} className="h-20 w-28 object-cover" />
                </button>
              ))}
            </div>

            {/* Owner gallery actions */}
            {hasOwnerAccess ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {selectedImage?.isUploaded && selectedImage?.photoId ? (
                    <>
                      <button type="button" onClick={() => handleSetCoverImage(selectedImage)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                        <Star className="h-3.5 w-3.5" /> Сделать обложкой
                      </button>
                      <button type="button" onClick={() => moveUploadedPhoto(selectedImage.photoId!, "left")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                        <ChevronLeft className="h-3.5 w-3.5" /> Влево
                      </button>
                      <button type="button" onClick={() => moveUploadedPhoto(selectedImage.photoId!, "right")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                        <ChevronRight className="h-3.5 w-3.5" /> Вправо
                      </button>
                      <button type="button" onClick={() => handleRemoveUploadedImage(selectedImage)} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-100">
                        <X className="h-3.5 w-3.5" /> Удалить
                      </button>
                    </>
                  ) : selectedImage ? (
                    <button type="button" onClick={() => handleSetCoverImage(selectedImage)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                      <Star className="h-3.5 w-3.5" /> Сделать обложкой
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setLightboxOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">
                    <Play className="h-3.5 w-3.5" /> Полный размер
                  </button>
                </div>

                <label onDragOver={handleDropZoneDragOver} onDragLeave={handleDropZoneDragLeave} onDrop={handleDropZoneDrop} className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-5 py-4 transition ${isDragActive ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-muted/30"}`}>
                  <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="hidden" onChange={handleGalleryUpload} />
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Загрузить фото</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP до 8 МБ</p>
                  </div>
                </label>

                {photoActivity.length ? (
                  <div className="rounded-2xl border border-border/70 bg-card p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Последние действия</p>
                    <ScrollRemaining totalItems={photoActivity.length} itemHeight={40} className="max-h-[260px] overflow-y-auto">
                    {photoActivity.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${item.action === "upload" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {item.action === "upload" ? <Upload className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        </span>
                        <span className="text-foreground">{item.action === "upload" ? "Загружено" : "Удалено"}: {item.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString("ru-RU")}</span>
                      </div>
                    ))}
                    </ScrollRemaining>
                  </div>
                ) : null}
              </div>
            ) : !isAuthenticated ? (
              <div className="mt-4 rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-5 text-center">
                <p className="text-sm text-muted-foreground">Управление галереей доступно владельцам доли.</p>
                <a data-testid="animal-guest-preview-register-cta-secondary" href={getLoginUrl(`/animals/${animalSlug}`)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5">
                  Войти или зарегистрироваться
                </a>
              </div>
            ) : null}

            {/* Share buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={handleCopyShareLink} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition hover:bg-muted">
                <Link2 className="h-4 w-4" /> Скопировать ссылку
              </button>
              <button type="button" onClick={() => handleShare("facebook")} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm transition hover:bg-muted">
                <Facebook className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => handleShare("vk")} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm transition hover:bg-muted">
                <MessageCircle className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => handleShare("instagram")} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm transition hover:bg-muted">
                <Instagram className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 4: Diary & Health ═══ */}
        <section className="border-b border-border/60 py-10 md:py-14">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setActiveTab("diary")} className={`rounded-full px-5 py-2 text-sm font-medium transition ${activeTab === "diary" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  <BookOpen className="mr-1.5 inline h-4 w-4" /> Дневник
                </button>
                <button type="button" onClick={() => setActiveTab("health")} className={`rounded-full px-5 py-2 text-sm font-medium transition ${activeTab === "health" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  <Thermometer className="mr-1.5 inline h-4 w-4" /> Здоровье
                </button>
              </div>

              {activeTab === "diary" ? (
                <ScrollRemaining totalItems={diaryEntries.length} itemHeight={120} className="mt-6 space-y-4 max-h-[520px] overflow-y-auto pr-1">
                  {diaryEntries.map((entry) => (
                    <motion.div key={entry.date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/70 bg-card p-5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{entry.mood}</span>
                        <div>
                          <h4 className="font-semibold text-foreground">{entry.title}</h4>
                          <p className="text-xs text-muted-foreground">{entry.date}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.text}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">#{tag}</span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </ScrollRemaining>
              ) : (
                <ScrollRemaining totalItems={healthHistory.length} itemHeight={80} className="mt-6 space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {healthHistory.map((item) => (
                    <div key={item.date + item.event} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-4">
                      <div className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{item.event}</h4>
                          <span className="text-xs text-muted-foreground">{item.date}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </ScrollRemaining>
              )}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 4.5: Product Plan (owners only) ═══ */}
        {hasOwnerAccess && data?.id ? (
          <OwnerProductPlanSection
            animalId={data.id}
            animalSlug={animalSlug!}
            animalName={displayName}
            mySharePercent={mySharePercent}
          />
        ) : null}

        {/* ═══ SECTION 4.7: Wellness Metrics (owners only) ═══ */}
        {hasOwnerAccess && wellnessData && (
          <section className="border-b border-border/60 py-10 md:py-14">
            <div className="container">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5 text-rose-500" />
                    <h2 className="text-2xl font-semibold text-foreground">Благополучие {displayName}</h2>
                  </div>
                  <Link href="/marketplace">
                    <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                      <Gift className="h-4 w-4" /> Позаботиться
                    </button>
                  </Link>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-6">
                  <WellnessRadarChart
                    metrics={{
                      happiness: wellnessData.happiness ?? 50,
                      health: wellnessData.health ?? 50,
                      attachment: wellnessData.attachment ?? 50,
                      mood: wellnessData.mood ?? 50,
                      obedience: wellnessData.obedience ?? 50,
                    }}
                    size={260}
                  />
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    Покупайте подарки и угощения в маркетплейсе, чтобы улучшить показатели
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ SECTION 5: Passport ═══ */}
        <section className="border-b border-border/60 py-10 md:py-14">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-3">
                <Dna className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Паспорт {displayName}</h2>
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-border/70">
                {passportRows.map((row, idx) => (
                  <div key={row.label} className={`flex items-start gap-4 px-5 py-3.5 text-sm ${idx % 2 === 0 ? "bg-card" : "bg-muted/30"}`}>
                    <span className="w-28 shrink-0 font-medium text-muted-foreground">{row.label}</span>
                    <span className="text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 6: Navigation links ═══ */}
        <section className="py-10 md:py-14">
          <div className="container">
            <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-3">
              <Link href="/dashboard" className="group rounded-2xl border border-border/70 bg-card p-5 transition hover:bg-muted/30">
                <Package className="h-6 w-6 text-primary" />
                <h4 className="mt-3 font-semibold text-foreground">Ваш личный кабинет</h4>
                <p className="mt-1 text-sm text-muted-foreground">Всё о ваших животных, именной коробке и жизни фермы.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Открыть <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
              <Link href={`/tracker?animal=${animalSlug}`} className="group rounded-2xl border border-border/70 bg-card p-5 transition hover:bg-muted/30">
                <Milk className="h-6 w-6 text-primary" />
                <h4 className="mt-3 font-semibold text-foreground">Путь продукта</h4>
                <p className="mt-1 text-sm text-muted-foreground">От молока {displayName} до вашей именной коробки — каждый шаг прозрачен.</p>
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
                <img src={selectedImage.src} alt={selectedImage.title} className="max-h-[80vh] w-full object-cover" />
                <div className="border-t border-border/70 p-5">
                  <h4 className="text-xl font-semibold text-foreground">{selectedImage.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedImage.meta}</p>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ═══ Crop modal ═══ */}
        <AnimatePresence>
          {cropDraft ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10" onClick={closeCropDraft}>
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="w-full max-w-3xl rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Кадрирование фото</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Настройте масштаб и положение перед загрузкой.</p>
                  </div>
                  <button type="button" onClick={closeCropDraft} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img src={cropDraft.previewUrl} alt="Предпросмотр" className="h-full w-full object-cover" style={{ transform: `scale(${cropDraft.zoom}) translate(${cropDraft.offsetX * 18}%, ${cropDraft.offsetY * 18}%)` }} />
                    </div>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Масштаб</label>
                      <input type="range" min={1} max={2.4} step={0.05} value={cropDraft.zoom} onChange={(e) => setCropDraft((c) => c ? { ...c, zoom: Number(e.target.value) } : c)} className="mt-2 w-full" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Смещение X</label>
                      <input type="range" min={-1} max={1} step={0.05} value={cropDraft.offsetX} onChange={(e) => setCropDraft((c) => c ? { ...c, offsetX: Number(e.target.value) } : c)} className="mt-2 w-full" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Смещение Y</label>
                      <input type="range" min={-1} max={1} step={0.05} value={cropDraft.offsetY} onChange={(e) => setCropDraft((c) => c ? { ...c, offsetY: Number(e.target.value) } : c)} className="mt-2 w-full" />
                    </div>
                    <button type="button" onClick={handleConfirmCrop} disabled={uploadPhoto.isPending} className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95 disabled:opacity-70">
                      {uploadPhoto.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Сохранить фото"}
                    </button>
                    <button type="button" onClick={closeCropDraft} className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted">
                      Отменить
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
