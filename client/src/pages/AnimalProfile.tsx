/*
Design Philosophy Reminder — AnimalProfile.tsx
Biomorphic Tech emotional core page.
Core: one animal must feel alive, valuable and connected to dashboard, product and club routes.
Hardening priority: no dead ends, calm mobile rhythm, consistent CTA logic.
*/

import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Heart, Thermometer, Milk, Camera, BookOpen, Star, Award,
  ChevronLeft, ChevronRight, Play, Calendar, Dna, MapPin, Zap, ChevronDown, Images, Upload, X, Share2, Link2,
  Facebook, MessageCircle, Instagram, Loader2
} from "lucide-react";

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

const ANIMAL_SLUG = "marta";
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const CDN = {
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
};

function ProgressRing({ value, size = 80, strokeWidth = 6, color = "#1A3A2A" }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const [animValue, setAnimValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animValue / 100) * circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimValue(value), 400);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

const diaryEntries = [
  { date: "13 марта 2026", mood: "😊", title: "Угостили морковкой!", text: "Сегодня хозяин приехал и принёс целую корзину морковки. Я так рада! Надой сегодня 1.8 л — рекорд недели.", tags: ["корм", "рекорд"] },
  { date: "12 марта 2026", mood: "✨", title: "SPA-день", text: "Провела SPA-процедуры: расчёсывание, ванна с травами, обрезка копыт. Шерсть блестит, настроение отличное!", tags: ["уход", "SPA"] },
  { date: "11 марта 2026", mood: "🌿", title: "Прогулка на лугу", text: "Гуляла на свежем воздухе 3 часа. Весна чувствуется — трава уже пробивается. Нашла особенно вкусный клевер.", tags: ["прогулка", "весна"] },
  { date: "8 марта 2026", mood: "🎉", title: "Праздник!", text: "Хозяева приехали всей семьёй с детьми. Дети кормили меня с руки — так весело! Сделали много фотографий.", tags: ["семья", "праздник"] },
];

const healthHistory = [
  { date: "10 марта", event: "Плановый осмотр ветеринара", status: "ok", note: "Всё в норме, вес 52 кг" },
  { date: "1 марта", event: "Вакцинация (ящур)", status: "ok", note: "Плановая вакцинация" },
  { date: "15 февраля", event: "Анализ молока", status: "ok", note: "Жирность 4.8%, белок 3.2%" },
  { date: "1 февраля", event: "Обрезка копыт", status: "ok", note: "Плановая процедура" },
];

const defaultGallery: GalleryImage[] = [
  { id: "cover", src: CDN.goat, title: "Портрет Марты", meta: "Основной профиль", isUploaded: false },
  { id: "live", src: CDN.liveCam, title: "Марта в стойле", meta: "Утренний эфир", isUploaded: false },
  { id: "family", src: CDN.family, title: "День с семьёй", meta: "Визит на ферму", isUploaded: false },
];

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

export default function AnimalProfile() {
  const [activeTab, setActiveTab] = useState<"diary" | "health" | "milk">("diary");
  const [showFullBio, setShowFullBio] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(defaultGallery[0].id);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoActivity, setPhotoActivity] = useState<PhotoActivity[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [coverImageId, setCoverImageId] = useState(defaultGallery[0].id);

  const utils = trpc.useUtils();
  const photosQuery = trpc.animalPhotos.list.useQuery({ animalSlug: ANIMAL_SLUG });
  const uploadPhoto = trpc.animalPhotos.upload.useMutation({
    onSuccess: async (created) => {
      await utils.animalPhotos.list.invalidate({ animalSlug: ANIMAL_SLUG });
      setSelectedImageId(created.id);
      setPhotoActivity((current) => ([
        {
          id: `upload-${created.photoId}-${Date.now()}`,
          action: "upload" as const,
          title: created.title,
          timestamp: Date.now(),
        },
        ...current,
      ].slice(0, 4)));
      toast.success("Фото сохранено", {
        description: "Снимок теперь хранится в профиле Марты и останется после перезагрузки.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить фото", {
        description: error.message,
      });
    },
  });

  const setCoverPhoto = trpc.animalPhotos.setCover.useMutation({
    onSuccess: async ({ photoId }) => {
      const nextCoverId = `user-${photoId}`;
      setCoverImageId(nextCoverId);
      setSelectedImageId(nextCoverId);
      const cover = galleryImages.find((image) => image.photoId === photoId);
      await utils.animalPhotos.list.invalidate({ animalSlug: ANIMAL_SLUG });
      toast.success("Обложка обновлена", {
        description: cover ? `Главным фото выбрано: ${cover.title}.` : "Новое фото закреплено как обложка галереи.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить обложку", {
        description: error.message,
      });
    },
  });

  const reorderPhotos = trpc.animalPhotos.reorder.useMutation({
    onSuccess: async () => {
      await utils.animalPhotos.list.invalidate({ animalSlug: ANIMAL_SLUG });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить порядок фото", {
        description: error.message,
      });
    },
  });

  const removePhoto = trpc.animalPhotos.remove.useMutation({
    onSuccess: async ({ photoId }) => {
      const removedImage = galleryImages.find((image) => image.photoId === photoId);
      await utils.animalPhotos.list.invalidate({ animalSlug: ANIMAL_SLUG });
      setSelectedImageId((current) => (current === `user-${photoId}` ? defaultGallery[0].id : current));
      if (removedImage) {
        setPhotoActivity((current) => ([
          {
            id: `remove-${photoId}-${Date.now()}`,
            action: "remove" as const,
            title: removedImage.title,
            timestamp: Date.now(),
          },
          ...current,
        ].slice(0, 4)));
      }
      toast.success("Фото удалено", {
        description: "Снимок убран из постоянной галереи профиля.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить фото", {
        description: error.message,
      });
    },
  });

  const galleryImages = useMemo<GalleryImage[]>(() => {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const coverFromServer = persistent.find((image) => image.isCover)?.id;
    const fallbackCoverId = persistent.length > 0 ? persistent[0].id : coverImageId;
    const merged = [...persistent, ...defaultGallery];

    return merged.map((image, index) => ({
      ...image,
      sortOrder: image.sortOrder ?? persistent.length + index,
      isCover: coverFromServer
        ? image.id === coverFromServer
        : image.id === fallbackCoverId,
    }));
  }, [coverImageId, photosQuery.data]);

  useEffect(() => {
    if (!galleryImages.length) return;
    const hasSelected = galleryImages.some((item) => item.id === selectedImageId);
    if (!hasSelected) {
      setSelectedImageId(galleryImages[0].id);
    }
  }, [galleryImages, selectedImageId]);

  useEffect(() => {
    if (!galleryImages.length) return;
    const persistedCover = galleryImages.find((item) => item.isCover)?.id;
    if (persistedCover && persistedCover !== coverImageId) {
      setCoverImageId(persistedCover);
      return;
    }

    const hasCover = galleryImages.some((item) => item.id === coverImageId);
    if (!hasCover) {
      const persistentFallback = photosQuery.data?.[0]?.id ?? galleryImages[0].id;
      setCoverImageId(persistentFallback);
    }
  }, [coverImageId, galleryImages, photosQuery.data]);

  const selectedImage = useMemo(
    () => galleryImages.find((item) => item.id === selectedImageId) ?? galleryImages[0],
    [galleryImages, selectedImageId],
  );

  const selectedImageIndex = useMemo(
    () => galleryImages.findIndex((item) => item.id === selectedImageId),
    [galleryImages, selectedImageId],
  );

  function moveGallery(direction: "prev" | "next") {
    if (!galleryImages.length) return;

    const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const nextIndex = direction === "next"
      ? (currentIndex + 1) % galleryImages.length
      : (currentIndex - 1 + galleryImages.length) % galleryImages.length;

    setSelectedImageId(galleryImages[nextIndex].id);
  }

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://sherkozu-mlhmg5vm.manus.space/animal/marta";
    return `${window.location.origin}/animal/marta?photo=${selectedImageId}`;
  }, [selectedImageId]);

  const shareText = useMemo(
    () => `Посмотрите профиль ${selectedImage?.title ? `и фото «${selectedImage.title}»` : "Марты"} на ферме Шерь Козу`,
    [selectedImage],
  );

  function openShareWindow(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=720");
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Ссылка скопирована", {
        description: "Теперь её можно вставить в любой мессенджер или пост.",
      });
    } catch {
      toast.error("Не удалось скопировать ссылку", {
        description: "Попробуйте ещё раз или откройте ссылку через социальные сети.",
      });
    }
  }

  function handleShare(platform: "facebook" | "vk" | "instagram") {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    if (platform === "facebook") {
      openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
      return;
    }

    if (platform === "vk") {
      openShareWindow(`https://vk.com/share.php?url=${encodedUrl}&title=${encodedText}`);
      return;
    }

    toast.info("Instagram не поддерживает web-share по ссылке", {
      description: "Мы уже скопировали идею сценария: скачайте фото или скопируйте ссылку и вставьте её в публикацию или Direct.",
    });
  }

  function openCropperForFile(file?: File) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      toast.error("Неподдерживаемый формат файла", {
        description: "Загрузите JPG, PNG или WebP для галереи Марты.",
      });
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Файл слишком большой", {
        description: "Выберите изображение размером до 8 МБ, чтобы загрузка и кадрирование проходили стабильно.",
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCropDraft({
      file,
      previewUrl,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  }

  async function handleGalleryUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    openCropperForFile(file);
    event.target.value = "";
  }

  function handleDropZoneDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDropZoneDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDropZoneDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    openCropperForFile(file);
  }

  function closeCropDraft() {
    setCropDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
  }

  async function handleConfirmCrop() {
    if (!cropDraft) return;

    const image = new Image();
    image.src = cropDraft.previewUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Не удалось подготовить изображение"));
    });

    const canvas = document.createElement("canvas");
    const size = 1200;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Не удалось открыть редактор кадрирования");
      return;
    }

    const minSide = Math.min(image.width, image.height);
    const cropSide = minSide / cropDraft.zoom;
    const maxOffsetX = Math.max((image.width - cropSide) / 2, 0);
    const maxOffsetY = Math.max((image.height - cropSide) / 2, 0);
    const sourceX = (image.width - cropSide) / 2 + cropDraft.offsetX * maxOffsetX;
    const sourceY = (image.height - cropSide) / 2 + cropDraft.offsetY * maxOffsetY;

    context.drawImage(image, sourceX, sourceY, cropSide, cropSide, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      toast.error("Не удалось подготовить кадрированное фото");
      return;
    }

    const processedFile = new File([blob], cropDraft.file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg", {
      type: "image/jpeg",
    });

    const base64Data = await fileToBase64(processedFile);
    await uploadPhoto.mutateAsync({
      animalSlug: ANIMAL_SLUG,
      fileName: processedFile.name,
      mimeType: processedFile.type,
      sizeBytes: processedFile.size,
      base64Data,
    });

    closeCropDraft();
  }

  function handleRemoveUploadedImage(image: GalleryImage) {
    if (!image.isUploaded || !image.photoId) return;
    removePhoto.mutate({ photoId: image.photoId });
  }

  function handleSetCoverImage(image: GalleryImage) {
    setCoverImageId(image.id);
    setSelectedImageId(image.id);

    if (!image.isUploaded || !image.photoId) {
      toast.success("Обложка обновлена", {
        description: `Главным фото выбрано: ${image.title}.`,
      });
      return;
    }

    setCoverPhoto.mutate({ photoId: image.photoId });
  }

  function moveUploadedPhoto(photoId: number, direction: "left" | "right") {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const currentIndex = persistent.findIndex((image) => image.photoId === photoId);
    if (currentIndex < 0) return;

    const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= persistent.length) return;

    const reordered = [...persistent];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    reorderPhotos.mutate({
      animalSlug: ANIMAL_SLUG,
      photoIds: reordered.map((image) => image.photoId).filter((value): value is number => typeof value === "number"),
    });
  }

  return (
    <>
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="relative h-72 overflow-hidden md:h-96">
          <img src={CDN.family} alt="Ферма" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
          <div className="absolute top-4 left-4">
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Назад
              </motion.button>
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="container">
              <div className="flex items-end gap-4">
                <div className="relative">
                  <img src={CDN.goat} alt="Марта" className="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-xl" />
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-green-500 p-1.5">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                </div>
                <div className="pb-1 text-white">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="pulse-dot" />
                    <span className="text-xs">Онлайн · Стойло №3</span>
                  </div>
                  <h1 className="text-3xl font-bold">Коза Марта</h1>
                  <p className="text-white/80">Англо-нубийская · 3 года · #МК-2023-047</p>
                </div>
                <div className="ml-auto flex items-center gap-2 pb-1">
                  <div className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                    <Star className="h-3 w-3 fill-white" />
                    Элита
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mt-6">
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 space-y-4 md:col-span-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-foreground">Показатели здоровья</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Счастье", value: 87, color: "#e11d48", icon: Heart },
                    { label: "Здоровье", value: 94, color: "#1A3A2A", icon: Thermometer },
                    { label: "Активность", value: 78, color: "#F0A500", icon: Zap },
                    { label: "Питание", value: 91, color: "#5A7A4A", icon: Milk },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <div className="relative">
                          <ProgressRing value={stat.value} size={72} strokeWidth={5} color={stat.color} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Icon className="h-4 w-4" style={{ color: stat.color }} />
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                        <p className="font-mono-data text-sm font-semibold">{stat.value}%</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 font-bold text-foreground">
                  <Dna className="h-4 w-4 text-primary" />
                  Паспорт животного
                </h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Порода", value: "Англо-нубийская" },
                    { label: "Дата рождения", value: "14 апреля 2023" },
                    { label: "Вес", value: "52 кг" },
                    { label: "Жирность молока", value: "4.8%" },
                    { label: "Белок молока", value: "3.2%" },
                    { label: "Годовой надой", value: "~650 л" },
                    { label: "Стойло", value: "№3, Ферма Шерь Козу" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    {showFullBio
                      ? "Англо-нубийская коза — одна из самых продуктивных молочных пород мира. Отличается высокой жирностью молока (до 5%), отсутствием специфического запаха и дружелюбным характером. Марта — дочь чемпиона выставки «АгроФерм 2022», обладатель золотой медали по надою."
                      : "Одна из самых продуктивных молочных пород мира..."}
                  </p>
                  <button onClick={() => setShowFullBio(!showFullBio)} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                    {showFullBio ? "Свернуть" : "Читать полностью"}
                    <ChevronDown className={`h-3 w-3 transition-transform ${showFullBio ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="border-b border-border p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                          <Images className="h-4 w-4 text-primary" />
                          Галерея Марты
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">Фотоистория Марты с быстрым переходом между кадрами.</p>
                      </div>
                      <label
                        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors md:self-start ${isDragActive ? "bg-primary/15 text-primary ring-2 ring-primary/30" : "bg-primary text-primary-foreground hover:bg-primary/92"}`}
                        onDragOver={handleDropZoneDragOver}
                        onDragLeave={handleDropZoneDragLeave}
                        onDrop={handleDropZoneDrop}
                      >
                        {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploadPhoto.isPending ? "Сохраняем..." : "Добавить фото"}
                        <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={uploadPhoto.isPending} />
                      </label>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                      <label
                        className={`rounded-[1.25rem] border border-dashed p-4 transition-all ${isDragActive ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-emerald-200 bg-emerald-50/80"}`}
                        onDragOver={handleDropZoneDragOver}
                        onDragLeave={handleDropZoneDragLeave}
                        onDrop={handleDropZoneDrop}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 rounded-full p-2 ${isDragActive ? "bg-primary/15 text-primary ring-4 ring-primary/10" : "bg-emerald-100 text-emerald-700"}`}>
                            {uploadPhoto.isPending || removePhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${isDragActive ? "text-primary" : "text-emerald-900"}`}>Загрузка в галерею</p>
                            <p className={`mt-1 text-sm ${isDragActive ? "text-primary/80" : "text-emerald-800"}`}>
                              {uploadPhoto.isPending
                                ? "Сохраняем новые фото в постоянную галерею Марты."
                                : removePhoto.isPending
                                  ? "Удаляем фото из постоянной галереи."
                                  : isDragActive
                                    ? "Отпустите файл, чтобы открыть кадрирование перед сохранением."
                                    : "Перетащите фото сюда или выберите файл, а затем аккуратно кадрируйте снимок перед сохранением."}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">Drag-and-drop</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">JPG, PNG, WebP</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">До 8 МБ</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">Квадратное кадрирование</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">Постоянное хранение</span>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                              Лучше всего подходят вертикальные или квадратные снимки без мелкого текста: после выбора откроется простое кадрирование, а затем фото сохранится в постоянную галерею Марты.
                            </p>
                            <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={uploadPhoto.isPending} />
                          </div>
                        </div>
                      </label>

                      <div className="rounded-[1.25rem] border border-border bg-background/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">Последние действия</p>
                          <span className="text-xs text-muted-foreground">До 4 записей</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {photoActivity.length ? photoActivity.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-3 py-2 text-sm">
                              <div>
                                <div className="font-medium text-foreground">{entry.action === "upload" ? "Добавлено фото" : "Удалено фото"}</div>
                                <div className="text-xs text-muted-foreground">{entry.title}</div>
                              </div>
                              <div className="text-[11px] text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
                            </div>
                          )) : (
                            <div className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                              После первой загрузки или удаления здесь появится короткая история действий.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedImage && (

                    <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/30">
                      <button type="button" onClick={() => setLightboxOpen(true)} className="group relative block w-full text-left">
                        <img src={selectedImage.src} alt={selectedImage.title} className="h-56 w-full object-cover md:h-72" />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/12" />
                        <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                          Открыть крупно
                        </div>
                      </button>
                      <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-foreground">{selectedImage.title}</div>
                            {selectedImage.isCover && (
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                Обложка галереи
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{selectedImage.meta}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                            {galleryImages.length} фото в истории
                          </div>
                          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-1 py-1">
                            <button type="button" onClick={() => moveGallery("prev")} aria-label="Предыдущее фото" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted">
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => moveGallery("next")} aria-label="Следующее фото" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted">
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 rounded-[1.5rem] border border-border bg-background/70 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Share2 className="h-4 w-4 text-primary" />
                        Поделиться
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" aria-label="Поделиться в Facebook" title="Facebook" onClick={() => handleShare("facebook")} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-[#1877F2] transition-colors hover:bg-muted">
                          <Facebook className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Поделиться во ВКонтакте" title="VK" onClick={() => handleShare("vk")} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-[#0077FF] transition-colors hover:bg-muted">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Поделиться в Instagram" title="Instagram" onClick={() => handleShare("instagram")} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-[#E1306C] transition-colors hover:bg-muted">
                          <Instagram className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Скопировать ссылку" title="Копировать ссылку" onClick={handleCopyShareLink} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:bg-primary/10">
                          <Link2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 truncate rounded-full border border-border/60 bg-card px-4 py-2 text-xs text-muted-foreground">{shareUrl}</div>
                  </div>

                  <div className="mt-3 rounded-[1.5rem] border border-border bg-card/85 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Фотографии</p>
                        <p className="mt-1 text-xs text-muted-foreground">Быстрый переход к нужному снимку.</p>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">{galleryImages.length} фото</div>
                    </div>

                    {photosQuery.isLoading ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Загружаем сохранённые фотографии профиля...
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {galleryImages.map((image) => {
                          const isSelected = image.id === selectedImageId;

                          return (
                            <div key={image.id} className={`group relative min-w-[120px] max-w-[120px] snap-start overflow-hidden rounded-[1rem] border transition-all ${isSelected ? "border-primary shadow-md shadow-primary/10" : "border-border bg-card"}`}>
                              <div>
                                <button type="button" onClick={() => setSelectedImageId(image.id)} className="block w-full text-left">
                                  <img src={image.src} alt={image.title} className="h-20 w-full object-cover" />
                                </button>
                                <div className="space-y-2 p-2.5">
                                  <button type="button" onClick={() => setSelectedImageId(image.id)} className="block w-full text-left">
                                    <div className="truncate text-[11px] font-semibold text-foreground">{image.title}</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetCoverImage(image)}
                                    disabled={setCoverPhoto.isPending && image.isUploaded}
                                    className={`w-full rounded-full px-2 py-1 text-[10px] font-semibold transition-colors ${image.isCover ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
                                  >
                                    {image.isCover ? "Текущая обложка" : "Сделать обложкой"}
                                  </button>
                                  {image.isUploaded && image.photoId && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => moveUploadedPhoto(image.photoId!, "left")}
                                        disabled={reorderPhotos.isPending}
                                        className="flex-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                      >
                                        Сдвинуть влево
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveUploadedPhoto(image.photoId!, "right")}
                                        disabled={reorderPhotos.isPending}
                                        className="flex-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                      >
                                        Сдвинуть вправо
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {image.isUploaded && galleryImages.length > 1 && (
                                <button
                                  type="button"
                                  aria-label="Удалить фото"
                                  onClick={() => handleRemoveUploadedImage(image)}
                                  disabled={removePhoto.isPending}
                                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60 md:opacity-0 md:group-hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.24 }} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="group relative h-56 cursor-pointer md:h-64">
                  <img src={CDN.liveCam} alt="Прямой эфир" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    LIVE
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm">
                      <Play className="ml-1 h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Веб-камера 24/7</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        Стойло №3, Ферма Шерь Козу
                      </p>
                    </div>
                    <Camera className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="col-span-12 space-y-4 md:col-span-8">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { emoji: "🥕", label: "Покормить", sub: "морковкой", color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
                  { emoji: "🛁", label: "SPA-уход", sub: "груминг", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
                  { emoji: "🚶", label: "Прогулка", sub: "1 час", color: "bg-green-50 border-green-200 hover:bg-green-100" },
                  { emoji: "🎂", label: "День рождения", sub: "через 32 дня", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
                ].map((action, i) => (
                  <motion.button key={i} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} className={`flex flex-col items-center rounded-xl border p-3 text-center transition-colors ${action.color}`}>
                    <span className="mb-1 text-2xl">{action.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.sub}</span>
                  </motion.button>
                ))}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex border-b border-border">
                  {(["diary", "health", "milk"] as const).map((tab) => {
                    const labels = { diary: "Дневник", health: "Здоровье", milk: "Надои" };
                    const icons = { diary: BookOpen, health: Award, milk: Milk };
                    const Icon = icons[tab];
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${activeTab === tab ? "border-b-2 border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="p-5">
                    {activeTab === "diary" && (
                      <div className="space-y-4">
                        {diaryEntries.map((entry, i) => (
                          <div key={i} className="flex gap-4 rounded-xl bg-muted/40 p-4 transition-colors hover:bg-muted/70">
                            <div className="text-3xl">{entry.mood}</div>
                            <div className="flex-1">
                              <div className="mb-1 flex items-center justify-between">
                                <h4 className="font-semibold text-foreground">{entry.title}</h4>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {entry.date}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-muted-foreground">{entry.text}</p>
                              <div className="mt-2 flex gap-1.5">
                                {entry.tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === "health" && (
                      <div className="space-y-3">
                        {healthHistory.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
                            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">{item.event}</p>
                                <span className="text-xs text-muted-foreground">{item.date}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                          <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                            <Award className="h-4 w-4" />
                            Следующий плановый осмотр: 10 апреля 2026
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === "milk" && (
                      <div>
                        <div className="mb-5 grid grid-cols-3 gap-3">
                          {[
                            { label: "Сегодня", value: "1.8 л", trend: "+12%" },
                            { label: "Эта неделя", value: "11.4 л", trend: "+8%" },
                            { label: "Этот месяц", value: "47.2 л", trend: "+5%" },
                          ].map((stat, i) => (
                            <div key={i} className="rounded-xl bg-muted/50 p-3 text-center">
                              <p className="mb-1 text-xs text-muted-foreground">{stat.label}</p>
                              <p className="font-mono-data text-xl font-bold text-foreground">{stat.value}</p>
                              <p className="text-xs font-medium text-green-600">{stat.trend}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex h-32 items-end gap-1.5">
                          {[1.4, 1.6, 1.5, 1.7, 1.8, 1.6, 1.8, 1.7, 1.9, 1.8, 1.6, 1.8, 1.7, 1.8].map((v, i) => (
                            <motion.div
                              key={i}
                              initial={{ height: 0 }}
                              animate={{ height: `${(v / 2.2) * 100}%` }}
                              transition={{ delay: i * 0.04, duration: 0.5 }}
                              className={`flex-1 rounded-t-sm ${i === 13 ? "bg-primary" : "bg-primary/30"}`}
                            />
                          ))}
                        </div>
                        <p className="mt-2 text-center text-xs text-muted-foreground">Надой за последние 14 дней (л)</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-primary">История заботы</p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">Марта остаётся в центре маршрута владельца.</h2>
                  </div>
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  Профиль животного должен соединять ежедневную эмоциональную связь, рациональную прозрачность и переходы в продуктовый трекер и клубную жизнь без тупиковых маршрутов.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="mb-1 text-xs text-white/60">Цифровой паспорт животного</p>
                    <h3 className="text-lg font-bold">Марта #МК-2023-047</h3>
                    <p className="mt-1 text-sm text-white/70">Цифровая карточка с историей животного. Подтверждает происхождение, статус и связь владельца с Мартой.</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="rounded bg-white/10 px-2 py-1 font-mono-data text-xs">0x7f3a...c9b2</span>
                      <span className="text-xs text-white/60">Выдан: 14.02.2025</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-white/90">
                    Вернуться в кабинет
                  </Link>
                  <Link href="/tracker" className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                    Открыть трекер продукта
                  </Link>
                  <Link href="/club" className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                    Перейти в клуб
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
          {cropDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-background shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">Подготовка фото перед сохранением</p>
                  <p className="mt-1 text-sm text-muted-foreground">Сделайте аккуратный квадратный кадр для галереи Марты. Вы можете приблизить фото и сместить фокус.</p>
                </div>
                <button type="button" onClick={closeCropDraft} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="relative mx-auto aspect-square max-w-[28rem] overflow-hidden rounded-[1.75rem] border border-border bg-muted">
                    <img
                      src={cropDraft.previewUrl}
                      alt="Предпросмотр кадрирования"
                      className="h-full w-full object-cover"
                      style={{
                        transform: `translate(${cropDraft.offsetX * 18}%, ${cropDraft.offsetY * 18}%) scale(${cropDraft.zoom})`,
                        transformOrigin: "center",
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 border-[10px] border-white/50" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Приближение</p>
                      <span className="text-xs text-muted-foreground">{cropDraft.zoom.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.1}
                      value={cropDraft.zoom}
                      onChange={(event) => setCropDraft((current) => current ? { ...current, zoom: Number(event.target.value) } : current)}
                      className="mt-3 w-full accent-primary"
                    />
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Смещение по горизонтали</p>
                      <span className="text-xs text-muted-foreground">{Math.round(cropDraft.offsetX * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={cropDraft.offsetX}
                      onChange={(event) => setCropDraft((current) => current ? { ...current, offsetX: Number(event.target.value) } : current)}
                      className="mt-3 w-full accent-primary"
                    />

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Смещение по вертикали</p>
                      <span className="text-xs text-muted-foreground">{Math.round(cropDraft.offsetY * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={cropDraft.offsetY}
                      onChange={(event) => setCropDraft((current) => current ? { ...current, offsetY: Number(event.target.value) } : current)}
                      className="mt-3 w-full accent-primary"
                    />
                  </div>

                  <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
                    После подтверждения в профиль отправится уже кадрированная версия снимка. Исходный файл на сервер не загружается.
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeCropDraft} className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                  Отменить
                </button>
                <button type="button" onClick={handleConfirmCrop} disabled={uploadPhoto.isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92 disabled:cursor-not-allowed disabled:opacity-70">
                  {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadPhoto.isPending ? "Сохраняем фото..." : "Сохранить в галерею"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
      <AnimatePresence>
        {lightboxOpen && selectedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLightboxOpen(false)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-black/40 backdrop-blur" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => setLightboxOpen(false)} className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/60">
                <X className="h-4 w-4" />
              </button>
              <div className="grid gap-4 p-4 md:grid-cols-[1fr_320px] md:p-6">
                <div className="overflow-hidden rounded-[1.5rem] bg-black/30">
                  <img src={selectedImage.src} alt={selectedImage.title} className="max-h-[72vh] w-full object-contain" />
                </div>
                <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white/8 p-4 text-white">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Текущее фото</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedImage.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/70">{selectedImage.meta}</p>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4">
                    <p className="text-sm font-semibold text-white">Навигация</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => moveGallery("prev")} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                        <ChevronLeft className="h-4 w-4" />
                        Предыдущее
                      </button>
                      <button type="button" onClick={() => moveGallery("next")} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                        Следующее
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4">
                    <p className="text-sm font-semibold text-white">Быстрые переходы</p>
                    <div className="mt-3 space-y-2">
                      <Link href="/dashboard" className="block rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                        Вернуться в кабинет
                      </Link>
                      <Link href="/tracker" className="block rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                        Открыть трекер продукта
                      </Link>
                      <Link href="/club" className="block rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                        Перейти в клуб
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
