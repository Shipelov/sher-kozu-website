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
  Heart,
  Thermometer,
  Milk,
  Camera,
  BookOpen,
  Star,
  Award,
  ChevronLeft,
  ChevronRight,
  Play,
  Calendar,
  Dna,
  MapPin,
  Zap,
  ChevronDown,
  Images,
  Upload,
  X,
  Share2,
  Link2,
  Facebook,
  MessageCircle,
  Instagram,
  Loader2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Package,
  Leaf,
  Clock3,
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
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
  liveCam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/live_cam_07e872b4.jpg",
  farm: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
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
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
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
  { date: "8 марта 2026", mood: "🎉", title: "Семейный визит", text: "Хозяева приехали всей семьёй с детьми. Дети кормили меня с руки, сделали фотографии и записали маленький видеодневник.", tags: ["семья", "праздник"] },
];

const healthHistory = [
  { date: "10 марта", event: "Плановый осмотр ветеринара", status: "ok", note: "Всё в норме, вес 52 кг" },
  { date: "1 марта", event: "Вакцинация (ящур)", status: "ok", note: "Плановая вакцинация" },
  { date: "15 февраля", event: "Анализ молока", status: "ok", note: "Жирность 4.8%, белок 3.2%" },
  { date: "1 февраля", event: "Обрезка копыт", status: "ok", note: "Плановая процедура" },
];

const defaultGallery: GalleryImage[] = [
  { id: "cover", src: CDN.hero, title: "Портрет Марты", meta: "Главный образ профиля", isUploaded: false },
  { id: "farm", src: CDN.farm, title: "Семейное утро на ферме", meta: "Контекст происхождения", isUploaded: false },
  { id: "milk", src: CDN.milk, title: "Именной молочный набор", meta: "Продуктовый маршрут Марты", isUploaded: false },
  { id: "club", src: CDN.club, title: "Клубный визит к Марте", meta: "Community layer бренда", isUploaded: false },
  { id: "live", src: CDN.liveCam, title: "Марта в стойле", meta: "Утренний эфир", isUploaded: false },
];

const premiumSignals = [
  { value: "4.8%", label: "жирность молока" },
  { value: "650 л", label: "годовой надой" },
  { value: "24/7", label: "живое присутствие" },
  { value: "47", label: "семей в клубе" },
];

const routeCards = [
  {
    title: "Вернуться в кабинет",
    text: "Отсюда начинается управление животным, продуктовым циклом и участием семьи в ферме.",
    href: "/dashboard",
    icon: Sparkles,
  },
  {
    title: "Открыть трекер продукта",
    text: "Посмотреть, как молоко Марты превращается в именной набор и доставку для семьи.",
    href: "/tracker",
    icon: Package,
  },
  {
    title: "Перейти в клуб",
    text: "Продолжить эмоциональную связь через события, визиты и контент вокруг фермы.",
    href: "/club",
    icon: Heart,
  },
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
    onSuccess: async ({ items }) => {
      utils.animalPhotos.list.setData({ animalSlug: ANIMAL_SLUG }, (current: typeof photosQuery.data) => {
        if (!current) return current;
        const sortMap = new Map(items.map((item: { photoId: number; sortOrder: number }) => [item.photoId, item.sortOrder] as const));
        return [...current]
          .map((image) => ({
            ...image,
            sortOrder: image.photoId ? (sortMap.get(image.photoId) ?? image.sortOrder) : image.sortOrder,
          }))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      });
      await utils.animalPhotos.list.invalidate({ animalSlug: ANIMAL_SLUG });
      toast.success("Порядок фото сохранён", {
        description: "Новая последовательность миниатюр записана в профиль Марты.",
      });
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
    setCropDraft((current: CropDraft | null) => {
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
    if (persistent.length < 2) {
      toast.info("Пока нечего переставлять", {
        description: "Добавьте ещё одно пользовательское фото, чтобы изменить порядок миниатюр.",
      });
      return;
    }

    const currentIndex = persistent.findIndex((image) => image.photoId === photoId);
    if (currentIndex < 0) return;

    const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= persistent.length) {
      toast.info("Фото уже находится на краю", {
        description: direction === "left"
          ? "Этот снимок уже первый среди пользовательских фото."
          : "Этот снимок уже последний среди пользовательских фото.",
      });
      return;
    }

    const reordered = [...persistent];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    const reorderedIds = reordered
      .map((image) => image.photoId)
      .filter((value): value is number => typeof value === "number");

    utils.animalPhotos.list.setData({ animalSlug: ANIMAL_SLUG }, (current: typeof photosQuery.data) => {
      if (!current) return current;
      const sortMap = new Map(reorderedIds.map((id, index) => [id, index] as const));
      return [...current]
        .map((image) => ({
          ...image,
          sortOrder: image.photoId ? (sortMap.get(image.photoId) ?? image.sortOrder) : image.sortOrder,
        }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });

    reorderPhotos.mutate({
      animalSlug: ANIMAL_SLUG,
      photoIds: reorderedIds,
    });
  }

  return (
    <>
      <div className="min-h-screen overflow-hidden bg-background text-foreground">
        <Navbar />

        <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),rgba(244,240,232,0.55)_36%,rgba(235,230,220,0)_70%)] pt-28 pb-14 md:pt-32 md:pb-20">
          <div className="absolute inset-0 opacity-50 pointer-events-none" aria-hidden>
            <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-[26rem] w-[26rem] rounded-full bg-accent/20 blur-3xl" />
          </div>

          <div className="container relative">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center">
              <div className="min-w-0 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-sm text-primary shadow-sm backdrop-blur"
                >
                  <Leaf className="h-4 w-4" />
                  Профиль животного как эмоциональное ядро экосистемы
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="mt-6 max-w-2xl font-display text-5xl leading-[0.95] text-foreground md:text-7xl"
                >
                  Марта — не карточка товара,
                  <span className="block text-primary">а живая причина вернуться на ферму.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground"
                >
                  Здесь соединяются ежедневная эмоциональная связь, прозрачность ухода, цифровой паспорт
                  и путь к именным продуктам. Именно профиль животного удерживает семью внутри
                  <strong className="text-foreground"> Sher Kozu</strong> между визитами, доставками и клубными событиями.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                  className="mt-8 flex flex-col gap-3 sm:flex-row"
                >
                  <Link href="/tracker" className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95">
                    Открыть трекер продукта
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link href="/club" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-7 py-4 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                    Перейти в клуб Марты
                    <Heart className="h-4 w-4" />
                  </Link>
                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-secondary/70 px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary">
                    Вернуться в кабинет
                    <Sparkles className="h-4 w-4" />
                  </Link>
                </motion.div>

                <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                  {premiumSignals.map((signal, index) => (
                    <motion.div
                      key={signal.label}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.28 + index * 0.05 }}
                      className="rounded-2xl border border-border/70 bg-white/75 p-4 shadow-sm backdrop-blur"
                    >
                      <div className="font-mono-data text-2xl font-semibold text-foreground">{signal.value}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{signal.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 }}
                className="relative min-w-0"
              >
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                  <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-card shadow-[0_30px_70px_-35px_rgba(33,30,24,0.35)]">
                    <img src={selectedImage?.src ?? CDN.hero} alt={selectedImage?.title ?? "Марта"} className="h-[520px] w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/90 via-dark-oak/18 to-transparent" />
                    <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      Онлайн · стойло №3
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                        <MapPin className="h-3.5 w-3.5" />
                        Англо-нубийская · #МК-2023-047
                      </div>
                      <h2 className="mt-3 font-display text-3xl leading-none md:text-4xl">Коза Марта</h2>
                      <p className="mt-3 max-w-md text-sm leading-6 text-white/78">
                        Точка входа в личное фермерство: характер, здоровье, дневник, визуальная история и продуктовая ценность в одном профиле.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <img src={CDN.farm} alt="Семейная ферма Шерь Козу" className="h-28 w-24 rounded-2xl object-cover object-center" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-primary">Происхождение</p>
                          <h3 className="mt-2 text-2xl font-semibold text-foreground">Ферма с живым контекстом</h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Профиль Марты показывает не только животное, но и среду, в которой рождаются доверие, редкость и премиальный продукт.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-secondary p-3">
                          <div className="text-muted-foreground">Счастье</div>
                          <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">87%</div>
                        </div>
                        <div className="rounded-2xl bg-secondary p-3">
                          <div className="text-muted-foreground">Статус ухода</div>
                          <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">OK</div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                      <img src={CDN.milk} alt="Именной набор молочной продукции" className="h-48 w-full object-cover" />
                      <div className="p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">Продуктовый слой</p>
                        <h3 className="mt-2 text-xl font-semibold text-foreground">От Марты к именной коробке</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Профиль соединяет эмоцию с рациональным доверием: пользователь видит, как конкретное животное связано с молоком, сыром и набором для семьи.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="container py-10 md:py-14">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
            <div className="min-w-0 space-y-6">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Паспорт и статус</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Премиальный профиль животного</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                      Страница Марты должна удерживать баланс между тёплой личной связью и доказательной прозрачностью ухода.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full bg-primary/10 p-3 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Счастье", value: 87, color: "#d9465f", icon: Heart },
                    { label: "Здоровье", value: 94, color: "#1A3A2A", icon: Thermometer },
                    { label: "Активность", value: 78, color: "#F0A500", icon: Zap },
                    { label: "Питание", value: 91, color: "#5A7A4A", icon: Milk },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4 text-center">
                        <div className="mx-auto flex w-fit items-center justify-center">
                          <div className="relative">
                            <ProgressRing value={stat.value} size={80} strokeWidth={6} color={stat.color} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Icon className="h-4 w-4" style={{ color: stat.color }} />
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 font-mono-data text-xl font-semibold text-foreground">{stat.value}%</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                    <h4 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Dna className="h-4 w-4 text-primary" />
                      Паспорт животного
                    </h4>
                    <div className="mt-4 space-y-3 text-sm">
                      {[
                        { label: "Порода", value: "Англо-нубийская" },
                        { label: "Дата рождения", value: "14 апреля 2023" },
                        { label: "Вес", value: "52 кг" },
                        { label: "Жирность молока", value: "4.8%" },
                        { label: "Белок молока", value: "3.2%" },
                        { label: "Годовой надой", value: "~650 л" },
                        { label: "Стойло", value: "№3, Ферма Шерь Козу" },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col items-start gap-1 rounded-2xl bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="max-w-full break-words text-left font-medium text-foreground sm:text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-[1.25rem] border border-primary/10 bg-primary/5 p-4">
                      <p className="text-sm leading-7 text-muted-foreground">
                        {showFullBio
                          ? "Англо-нубийская коза — одна из самых продуктивных молочных пород мира. Марта сочетает высокую жирность молока, мягкий характер и устойчивую визуальную идентичность для премиального семейного бренда. Её профиль важен не только как биография, но и как точка происхождения именной продукции и клубных сценариев."
                          : "Одна из самых продуктивных молочных пород мира с высоким потенциалом для премиального продуктового маршрута."}
                      </p>
                      <button onClick={() => setShowFullBio(!showFullBio)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        {showFullBio ? "Свернуть" : "Читать полностью"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${showFullBio ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm">
                    <img src={CDN.club} alt="Клубный визит на ферму" className="h-52 w-full object-cover" />
                    <div className="p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary">Community layer</p>
                      <h4 className="mt-2 text-xl font-semibold text-foreground">Клуб удерживает связь с Мартой между доставками</h4>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        Фотографии, визиты, семейные ужины и сезонные события усиливают восприятие Марты как части живой фермерской истории, а не как абстрактной единицы каталога.
                      </p>
                      <Link href="/club" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                        Открыть клубную ленту
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/70 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-primary">Галерея</p>
                      <h3 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-foreground">
                        <Images className="h-5 w-5 text-primary" />
                        Визуальная история Марты
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                        Галерея объединяет системные кадры Sher Kozu и пользовательские фотографии: отсюда начинается личная связь, которая затем ведёт в продуктовый трекер и клуб.
                      </p>
                    </div>

                    <label
                      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors lg:self-start ${isDragActive ? "bg-primary/15 text-primary ring-2 ring-primary/30" : "bg-primary text-primary-foreground hover:bg-primary/92"}`}
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

                <div className="p-6">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                    <div className="space-y-4">
                      <label
                        className={`block rounded-[1.5rem] border border-dashed p-5 transition-all ${isDragActive ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-emerald-200 bg-emerald-50/80"}`}
                        onDragOver={handleDropZoneDragOver}
                        onDragLeave={handleDropZoneDragLeave}
                        onDrop={handleDropZoneDrop}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 rounded-full p-2 ${isDragActive ? "bg-primary/15 text-primary ring-4 ring-primary/10" : "bg-emerald-100 text-emerald-700"}`}>
                            {uploadPhoto.isPending || removePhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${isDragActive ? "text-primary" : "text-emerald-900"}`}>
                              {uploadPhoto.isPending
                                ? "Сохраняем новые фото в постоянную галерею Марты."
                                : removePhoto.isPending
                                  ? "Удаляем фото из постоянной галереи."
                                  : isDragActive
                                    ? "Отпустите файл, чтобы открыть кадрирование перед сохранением."
                                    : "Добавьте семейный кадр, визит на ферму или новый портрет Марты."}
                            </p>
                            <p className={`mt-1 text-sm ${isDragActive ? "text-primary/80" : "text-emerald-800"}`}>
                              Галерея поддерживает drag-and-drop, квадратное кадрирование и постоянное сохранение пользовательских фотографий в профиле.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">Drag-and-drop</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">JPG, PNG, WebP</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">До 8 МБ</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">Квадратное кадрирование</span>
                              <span className="rounded-full bg-white/80 px-3 py-1 text-foreground">Постоянное хранение</span>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={uploadPhoto.isPending} />
                          </div>
                        </div>
                      </label>

                      {selectedImage && (
                        <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-muted/30">
                          <button type="button" onClick={() => setLightboxOpen(true)} className="group relative block w-full text-left">
                            <img src={selectedImage.src} alt={selectedImage.title} className="h-64 w-full object-cover md:h-[26rem]" />
                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/12" />
                            <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                              Открыть крупно
                            </div>
                          </button>
                          <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-lg font-semibold text-foreground">{selectedImage.title}</div>
                                {selectedImage.isCover && (
                                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                    Обложка галереи
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">{selectedImage.meta}</div>
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
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">Последние действия</p>
                          <span className="text-xs text-muted-foreground">До 4 записей</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {photoActivity.length ? photoActivity.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-3 py-3 text-sm">
                              <div>
                                <div className="font-medium text-foreground">{entry.action === "upload" ? "Добавлено фото" : "Удалено фото"}</div>
                                <div className="text-xs text-muted-foreground">{entry.title}</div>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
                              После первой загрузки или удаления здесь появится короткая история действий.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Share2 className="h-4 w-4 text-primary" />
                            Поделиться профилем
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
                          <div className="truncate rounded-full border border-border/60 bg-card px-4 py-2 text-xs text-muted-foreground">{shareUrl}</div>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Фотографии</p>
                            <p className="mt-1 text-xs text-muted-foreground">Быстрый переход, обложка и порядок пользовательских фото.</p>
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
                                <div key={image.id} className={`group relative min-w-[132px] max-w-[132px] snap-start overflow-hidden rounded-[1.15rem] border transition-all ${isSelected ? "border-primary shadow-md shadow-primary/10" : "border-border bg-card"}`}>
                                  <button type="button" onClick={() => setSelectedImageId(image.id)} className="block w-full text-left">
                                    <img src={image.src} alt={image.title} className="h-24 w-full object-cover" />
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
                                          Влево
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => moveUploadedPhoto(image.photoId!, "right")}
                                          disabled={reorderPhotos.isPending}
                                          className="flex-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                        >
                                          Вправо
                                        </button>
                                      </div>
                                    )}
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
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="group relative min-h-[20rem] overflow-hidden">
                    <img src={CDN.liveCam} alt="Прямой эфир Марты" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/20" />
                    <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      LIVE
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm">
                        <Play className="ml-1 h-7 w-7 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Прямой эфир и ритм ухода</p>
                    <h3 className="mt-2 text-3xl font-semibold text-foreground">Живое присутствие делает профиль убедительным.</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      Веб-камера, дневник и карточки здоровья работают как система доверия: пользователь не просто читает описание, а получает ритм реальной жизни животного.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] bg-secondary p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Локация</p>
                        <p className="mt-2 text-sm font-medium text-foreground">Стойло №3, Ферма Шерь Козу</p>
                      </div>
                      <div className="rounded-[1.25rem] bg-secondary p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Следующий ритуал</p>
                        <p className="mt-2 text-sm font-medium text-foreground">Семейный визит в субботу, 14:00</p>
                      </div>
                    </div>
                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Камера и diary-layer поддерживают ежедневное возвращение на страницу.
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="min-w-0 space-y-6">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { emoji: "🥕", label: "Покормить", sub: "морковкой", color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
                  { emoji: "🛁", label: "SPA-уход", sub: "груминг", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
                  { emoji: "🚶", label: "Прогулка", sub: "1 час", color: "bg-green-50 border-green-200 hover:bg-green-100" },
                  { emoji: "🎂", label: "День рождения", sub: "через 32 дня", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
                ].map((action) => (
                  <motion.button key={action.label} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-colors ${action.color}`}>
                    <span className="mb-1 text-2xl">{action.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.sub}</span>
                  </motion.button>
                ))}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
                <div className="flex border-b border-border">
                  {(["diary", "health", "milk"] as const).map((tab) => {
                    const labels = { diary: "Дневник", health: "Здоровье", milk: "Надои" };
                    const icons = { diary: BookOpen, health: Award, milk: Milk };
                    const Icon = icons[tab];
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === tab ? "border-b-2 border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="p-6">
                    {activeTab === "diary" && (
                      <div className="space-y-4">
                        {diaryEntries.map((entry) => (
                          <div key={`${entry.date}-${entry.title}`} className="flex gap-4 rounded-[1.5rem] bg-muted/40 p-4 transition-colors hover:bg-muted/70">
                            <div className="text-3xl">{entry.mood}</div>
                            <div className="flex-1">
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <h4 className="font-semibold text-foreground">{entry.title}</h4>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {entry.date}
                                </span>
                              </div>
                              <p className="text-sm leading-7 text-muted-foreground">{entry.text}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
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
                        {healthHistory.map((item) => (
                          <div key={`${item.date}-${item.event}`} className="flex items-start gap-3 rounded-[1.25rem] bg-muted/40 p-4">
                            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{item.event}</p>
                                <span className="text-xs text-muted-foreground">{item.date}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 rounded-[1.25rem] border border-green-200 bg-green-50 p-4">
                          <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                            <Award className="h-4 w-4" />
                            Следующий плановый осмотр: 10 апреля 2026
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === "milk" && (
                      <div>
                        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {[
                            { label: "Сегодня", value: "1.8 л", trend: "+12%" },
                            { label: "Эта неделя", value: "11.4 л", trend: "+8%" },
                            { label: "Этот месяц", value: "47.2 л", trend: "+5%" },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-[1.25rem] bg-muted/50 p-3 text-center">
                              <p className="mb-1 text-xs text-muted-foreground">{stat.label}</p>
                              <p className="font-mono-data text-xl font-bold text-foreground">{stat.value}</p>
                              <p className="text-xs font-medium text-green-600">{stat.trend}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex h-32 items-end gap-1.5">
                          {[0.8, 0.95, 1.1, 1.05, 1.12, 1.2, 1.28, 1.32, 1.4, 1.35, 1.45, 1.5, 1.62, 1.8].map((v, i) => (
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

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Маршруты после профиля</p>
                    <h3 className="mt-2 text-3xl font-semibold text-foreground">Профиль Марты не должен заканчиваться тупиком.</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                      Отсюда пользователь должен естественно продолжать путь в кабинет, продуктовый трекер и клубную жизнь. Поэтому нижний блок превращает эмоциональную страницу в связующий узел всей экосистемы.
                    </p>

                    <div className="mt-6 space-y-3">
                      {routeCards.map((card) => {
                        const Icon = card.icon;
                        return (
                          <Link key={card.title} href={card.href} className="group flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-background/75 px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="rounded-full bg-primary/10 p-2 text-primary">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">{card.title}</div>
                                <div className="mt-1 text-sm leading-6 text-muted-foreground">{card.text}</div>
                              </div>
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-hidden border-t border-border/70 lg:border-t-0 lg:border-l">
                    <img src={CDN.milk} alt="Связь животного с именной молочной продукцией" className="h-full min-h-[20rem] w-full object-cover" />
                  </div>
                </div>
              </motion.div>
            </div>
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
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Приближение</p>
                      <span className="text-xs text-muted-foreground">{cropDraft.zoom.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.1}
                      value={cropDraft.zoom}
                      onChange={(event) => setCropDraft((current: CropDraft | null) => current ? { ...current, zoom: Number(event.target.value) } : current)}
                      className="mt-3 w-full accent-primary"
                    />
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Смещение по горизонтали</p>
                      <span className="text-xs text-muted-foreground">{Math.round(cropDraft.offsetX * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={cropDraft.offsetX}
                      onChange={(event) => setCropDraft((current: CropDraft | null) => current ? { ...current, offsetX: Number(event.target.value) } : current)}
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
                      onChange={(event) => setCropDraft((current: CropDraft | null) => current ? { ...current, offsetY: Number(event.target.value) } : current)}
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
