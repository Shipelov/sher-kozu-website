import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import ShareSelectionPreviewCard from "@/components/ShareSelectionPreviewCard";
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

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DEFAULT_SLUG = "marta";
const DEFAULT_ROUTE_SLUG = "marta";

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

type AnimalProfileContent = {
  speciesLabel: string;
  heroLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  originTitle: string;
  originText: string;
  productTitle: string;
  productText: string;
  biographyShort: string;
  biographyLong: string;
  stableLabel: string;
  breedLabel: string;
  diaryTitle: string;
  diaryIntro: string;
  clubTitle: string;
  trackerTitle: string;
  defaultGallery: GalleryImage[];
  diaryEntries: Array<{ date: string; mood: string; title: string; text: string; tags: string[] }>;
  healthHistory: Array<{ date: string; event: string; status: "ok" | "attention"; note: string }>;
  premiumSignals: Array<{ value: string; label: string }>;
  routeCards: Array<{ title: string; text: string; href: string; icon: typeof Sparkles }>;
  statCards: Array<{ label: string; value: number; color: string; icon: typeof Heart }>;
  passportRows: Array<{ label: string; value: string }>;
  milkCards: Array<{ label: string; value: string; note: string }>;
  quickFacts: Array<{ label: string; value: string }>;
};

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

function formatCurrency(minor?: number | null) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format((minor ?? 0) / 100);
}

function getAnimalStatusLabel(status?: string | null) {
  if (status === "fully_booked") return "Выкуплено полностью";
  if (status === "public_limited") return "Осталось мало долей";
  if (status === "hidden") return "Скрыто";
  if (status === "archived") return "Архив";
  return "Доступно для шеринга";
}

function formatAnimalName(name?: string) {
  if (!name) return "Животное";
  const speciesName = name.toLowerCase().startsWith("коза ") || name.toLowerCase().startsWith("овца ")
    ? name
    : name;
  return speciesName;
}

function buildProfileContent(params: {
  name: string;
  speciesLabel: string;
  breed?: string | null;
  story?: string | null;
  shortDescription?: string | null;
  slug: string;
  healthScore: number;
  happinessScore: number;
  milkPotentialScore: number;
  careLevelScore: number;
}): AnimalProfileContent {
  const {
    name,
    speciesLabel,
    breed,
    story,
    shortDescription,
    slug,
    healthScore,
    happinessScore,
    milkPotentialScore,
    careLevelScore,
  } = params;

  const displayName = formatAnimalName(name);
  const breedLabel = breed ?? (speciesLabel === "Овца" ? "Молочная овца" : "Англо-нубийская");
  const stableLabel = slug === DEFAULT_SLUG ? "стойло №3" : `стойло профиля ${slug}`;
  const baseShort = shortDescription?.trim() || `${displayName} — живой центр персонального фермерства, заботы и прозрачного происхождения продукции.`;
  const baseStory = story?.trim() || `${displayName} соединяет ежедневный уход, эмоциональную связь семьи и происхождение именной молочной продукции в одном цифровом профиле.`;

  return {
    speciesLabel,
    heroLabel: "Профиль животного как эмоциональное ядро экосистемы",
    heroTitle: `${displayName} — не карточка товара,` ,
    heroSubtitle: "а живая причина вернуться на ферму.",
    originTitle: "Ферма с живым контекстом",
    originText: `${displayName} показывает не только само животное, но и среду, в которой рождаются доверие, редкость и премиальный продукт.`,
    productTitle: `От ${displayName} к именной коробке`,
    productText: `Профиль связывает эмоцию с рациональным доверием: видно, как конкретное животное связано с молоком, сыром и сезонными наборами для семьи.`,
    biographyShort: `Профиль ${displayName} удерживает баланс между тёплой личной связью и доказательной прозрачностью ухода.`,
    biographyLong: baseStory,
    stableLabel,
    breedLabel,
    diaryTitle: `История ${displayName}`,
    diaryIntro: `${displayName} остаётся точкой ежедневного контакта между семьёй, фермой и продуктовым маршрутом.`,
    clubTitle: `Перейти в клуб ${displayName}`,
    trackerTitle: `Открыть трекер продукции ${displayName}`,
    defaultGallery: [
      { id: "cover", src: CDN.hero, title: `Портрет ${displayName}`, meta: "Главный образ профиля", isUploaded: false },
      { id: "farm", src: CDN.farm, title: `Среда и происхождение ${displayName}`, meta: "Контекст происхождения", isUploaded: false },
      { id: "milk", src: CDN.milk, title: `Именной молочный набор ${displayName}`, meta: "Продуктовый маршрут", isUploaded: false },
      { id: "club", src: CDN.club, title: `Клубный визит к ${displayName}`, meta: "Community layer бренда", isUploaded: false },
      { id: "live", src: CDN.liveCam, title: `${displayName} в стойле`, meta: "Live-наблюдение", isUploaded: false },
    ],
    diaryEntries: [
      { date: "13 марта 2026", mood: "😊", title: `Новый ритм дня ${displayName}`, text: `${displayName} провёл(а) спокойное утро, получил(а) дополнительный уход и стал(а) главным героем нового семейного контента.`, tags: ["дневник", "ритм"] },
      { date: "12 марта 2026", mood: "✨", title: "День заботы", text: `Команда фермы обновила уходовый протокол, чтобы профиль ${displayName} оставался прозрачным и доверительным для семьи.`, tags: ["уход", "прозрачность"] },
      { date: "11 марта 2026", mood: "🌿", title: "Прогулка и наблюдение", text: `${displayName} провёл(а) несколько часов на свежем воздухе, а семья получила новые визуальные сигналы и историю для клуба.`, tags: ["прогулка", "контент"] },
      { date: "8 марта 2026", mood: "🎉", title: "Семейный визит", text: `Профиль ${displayName} снова сработал как точка возврата: визит семьи превратился в фотографии, дневник и будущий продуктовый заказ.`, tags: ["семья", "визит"] },
    ],
    healthHistory: [
      { date: "10 марта", event: "Плановый осмотр ветеринара", status: "ok", note: `Состояние ${displayName.toLowerCase()} стабильное` },
      { date: "1 марта", event: "Проверка кормления", status: "ok", note: "Рацион соответствует рекомендованному режиму" },
      { date: "15 февраля", event: "Контроль молока", status: "ok", note: "Параметры в ожидаемом диапазоне" },
      { date: "1 февраля", event: "Профилактический уход", status: "ok", note: "Регулярная процедура завершена" },
    ],
    premiumSignals: [
      { value: `${milkPotentialScore}%`, label: "молочный потенциал" },
      { value: `${healthScore}%`, label: "здоровье" },
      { value: `${happinessScore}%`, label: "эмоциональная связь" },
      { value: `${careLevelScore}%`, label: "уровень care" },
    ],
    routeCards: [
      { title: "Вернуться в кабинет", text: "Отсюда начинается управление животным, продуктовым циклом и участием семьи в ферме.", href: "/dashboard", icon: Sparkles },
      { title: `Открыть трекер ${displayName}`, text: `Посмотреть, как путь ${displayName.toLowerCase()} связан с именной продукцией и доставкой для семьи.`, href: `/tracker?animal=${slug}`, icon: Package },
      { title: `Перейти в клуб ${displayName}`, text: "Продолжить эмоциональную связь через события, визиты и контент вокруг фермы.", href: `/club?animal=${slug}`, icon: Heart },
    ],
    statCards: [
      { label: "Счастье", value: happinessScore, color: "#d9465f", icon: Heart },
      { label: "Здоровье", value: healthScore, color: "#1A3A2A", icon: Thermometer },
      { label: "Активность", value: Math.max(55, Math.min(98, Math.round((happinessScore + careLevelScore) / 2))), color: "#F0A500", icon: Zap },
      { label: "Питание", value: Math.max(55, Math.min(98, Math.round((milkPotentialScore + healthScore) / 2))), color: "#5A7A4A", icon: Milk },
    ],
    passportRows: [
      { label: "Вид", value: speciesLabel },
      { label: "Порода", value: breedLabel },
      { label: "Профиль", value: displayName },
      { label: "Точка ухода", value: stableLabel },
      { label: "Короткое описание", value: baseShort },
      { label: "Сюжет профиля", value: baseStory },
    ],
    milkCards: [
      { label: "Потенциал молока", value: `${milkPotentialScore}/100`, note: "Используется как ориентир качества для именного маршрута." },
      { label: "Рейтинг care", value: `${careLevelScore}/100`, note: "Показывает устойчивость и прозрачность ухода." },
      { label: "Статус продукта", value: "Готов к маршрутизации", note: `Профиль ${displayName} можно связать с трекером и клубной лентой.` },
    ],
    quickFacts: [
      { label: "Профиль", value: displayName },
      { label: "Маршрут", value: `/animals/${slug}` },
      { label: "Трекер", value: `/tracker?animal=${slug}` },
      { label: "Клуб", value: `/club?animal=${slug}` },
    ],
  };
}

function useAnimalSlug() {
  const [, paramsByAnimals] = useRoute("/animals/:slug");
  const [, paramsByLegacy] = useRoute("/animal/:slug");
  return paramsByAnimals?.slug ?? paramsByLegacy?.slug ?? DEFAULT_ROUTE_SLUG;
}

export default function AnimalProfile() {
  const [, setLocation] = useLocation();
  const animalSlug = useAnimalSlug();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"diary" | "health" | "milk">("diary");
  const [showFullBio, setShowFullBio] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState("cover");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoActivity, setPhotoActivity] = useState<PhotoActivity[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [coverImageId, setCoverImageId] = useState("cover");

  const utils = trpc.useUtils();
  const animalQuery = trpc.animals.getBySlug.useQuery({ slug: animalSlug }, { enabled: Boolean(animalSlug) });
  const photosQuery = trpc.animalPhotos.list.useQuery({ animalSlug }, { enabled: Boolean(animalSlug) && isAuthenticated });
  const [selectedSharePercent, setSelectedSharePercent] = useState(10);

  const availableSharePercents = animalQuery.data?.availableSharePercents ?? [];
  const fullPriceMinor = animalQuery.data?.fullPriceMinor ?? animalQuery.data?.baseMonthlyPriceMinor ?? 0;
  const shareUnitPercent = animalQuery.data?.shareUnitPercent ?? 10;
  const ownedPercent = animalQuery.data?.ownedPercent ?? 0;
  const availablePercent = animalQuery.data?.availablePercent ?? 100;
  const selectedSharePriceMinor = useMemo(
    () => Math.round((fullPriceMinor * selectedSharePercent) / 100),
    [fullPriceMinor, selectedSharePercent],
  );

  const profileContent = useMemo(() => {
    const data = animalQuery.data;
    return buildProfileContent({
      name: data?.name ?? "Марта",
      speciesLabel: getSpeciesLabel(data?.species),
      breed: data?.breed,
      story: data?.story,
      shortDescription: data?.shortDescription,
      slug: animalSlug || DEFAULT_SLUG,
      healthScore: data?.healthScore ?? 94,
      happinessScore: data?.happinessScore ?? 87,
      milkPotentialScore: data?.milkPotentialScore ?? 91,
      careLevelScore: data?.careLevelScore ?? 89,
    });
  }, [animalQuery.data, animalSlug]);

  const purchaseShare = trpc.animals.purchaseShare.useMutation({
    onSuccess: async (result) => {
      await utils.animals.getBySlug.invalidate({ slug: animalSlug });
      await utils.animals.listPublic.invalidate();
      toast.success("Доля забронирована", {
        description: `Вы выбрали ${result.sharePercent}% ${animalQuery.data?.name ?? "животного"} на сумму ${formatCurrency(result.priceMinor)}.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось оформить долю", { description: error.message });
    },
  });

  const uploadPhoto = trpc.animalPhotos.upload.useMutation({
    onSuccess: async (created) => {
      await utils.animalPhotos.list.invalidate({ animalSlug });
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
        description: `Снимок теперь хранится в профиле ${animalQuery.data?.name ?? "животного"} и останется после перезагрузки.`,
      });
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
      const cover = galleryImages.find((image) => image.photoId === photoId);
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Обложка обновлена", {
        description: cover ? `Главным фото выбрано: ${cover.title}.` : "Новое фото закреплено как обложка галереи.",
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить обложку", { description: error.message });
    },
  });

  const reorderPhotos = trpc.animalPhotos.reorder.useMutation({
    onSuccess: async ({ items }) => {
      utils.animalPhotos.list.setData({ animalSlug }, (current: typeof photosQuery.data) => {
        if (!current) return current;
        const sortMap = new Map(items.map((item: { photoId: number; sortOrder: number }) => [item.photoId, item.sortOrder] as const));
        return [...current]
          .map((image) => ({
            ...image,
            sortOrder: image.photoId ? (sortMap.get(image.photoId) ?? image.sortOrder) : image.sortOrder,
          }))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      });
      await utils.animalPhotos.list.invalidate({ animalSlug });
      toast.success("Порядок фото сохранён", {
        description: `Новая последовательность миниатюр записана в профиль ${animalQuery.data?.name ?? "животного"}.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось сохранить порядок фото", { description: error.message });
    },
  });

  const removePhoto = trpc.animalPhotos.remove.useMutation({
    onSuccess: async ({ photoId }) => {
      const removedImage = galleryImages.find((image) => image.photoId === photoId);
      await utils.animalPhotos.list.invalidate({ animalSlug });
      setSelectedImageId((current) => (current === `user-${photoId}` ? profileContent.defaultGallery[0].id : current));
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
        description: `Снимок убран из постоянной галереи ${animalQuery.data?.name ?? "животного"}.`,
      });
    },
    onError: (error) => {
      toast.error("Не удалось удалить фото", { description: error.message });
    },
  });

  const galleryImages = useMemo<GalleryImage[]>(() => {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const coverFromServer = persistent.find((image) => image.isCover)?.id;
    const fallbackCoverId = persistent.length > 0 ? persistent[0].id : coverImageId;

    const merged = [
      ...persistent.map((image, index) => ({ ...image, sortOrder: image.sortOrder ?? index })),
      ...profileContent.defaultGallery.map((image, index) => ({ ...image, sortOrder: persistent.length + index })),
    ];

    return merged.map((image) => ({
      ...image,
      isCover: coverFromServer ? image.id === coverFromServer : image.id === fallbackCoverId,
    }));
  }, [coverImageId, photosQuery.data, profileContent.defaultGallery]);

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

  useEffect(() => {
    const photoParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("photo");
    if (photoParam && galleryImages.some((item) => item.id === photoParam)) {
      setSelectedImageId(photoParam);
    }
  }, [galleryImages]);

  useEffect(() => {
    if (!availableSharePercents.length) {
      setSelectedSharePercent(shareUnitPercent);
      return;
    }

    if (!availableSharePercents.includes(selectedSharePercent)) {
      setSelectedSharePercent(availableSharePercents[0]);
    }
  }, [availableSharePercents, selectedSharePercent, shareUnitPercent]);


  const selectedImage = useMemo(() => galleryImages.find((item) => item.id === selectedImageId) ?? galleryImages[0], [galleryImages, selectedImageId]);
  const selectedImageIndex = useMemo(() => galleryImages.findIndex((item) => item.id === selectedImageId), [galleryImages, selectedImageId]);

  function moveGallery(direction: "prev" | "next") {
    if (!galleryImages.length) return;
    const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const nextIndex = direction === "next"
      ? (currentIndex + 1) % galleryImages.length
      : (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    setSelectedImageId(galleryImages[nextIndex].id);
  }

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://sherkozu.manus.space/animals/${animalSlug || DEFAULT_ROUTE_SLUG}`;
    return `${window.location.origin}/animals/${animalSlug || DEFAULT_ROUTE_SLUG}?photo=${selectedImageId}`;
  }, [animalSlug, selectedImageId]);

  const shareText = useMemo(
    () => `Посмотрите профиль ${animalQuery.data?.name ?? "животного"}${selectedImage?.title ? ` и фото «${selectedImage.title}»` : ""} на ферме Шерь Козу`,
    [animalQuery.data?.name, selectedImage],
  );

  function openShareWindow(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=720");
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Ссылка скопирована", { description: "Теперь её можно вставить в любой мессенджер или пост." });
    } catch {
      toast.error("Не удалось скопировать ссылку", { description: "Попробуйте ещё раз или используйте кнопки публикации." });
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
      description: "Скопируйте ссылку и вставьте её в публикацию или Direct.",
    });
  }

  function openCropperForFile(file?: File) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      toast.error("Неподдерживаемый формат файла", { description: "Загрузите JPG, PNG или WebP." });
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Файл слишком большой", { description: "Выберите изображение размером до 8 МБ." });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setCropDraft({ file, previewUrl, zoom: 1, offsetX: 0, offsetY: 0 });
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
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
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

    const processedFile = new File([blob], cropDraft.file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg", { type: "image/jpeg" });
    const base64Data = await fileToBase64(processedFile);
    await uploadPhoto.mutateAsync({
      animalSlug,
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
      toast.success("Обложка обновлена", { description: `Главным фото выбрано: ${image.title}.` });
      return;
    }
    setCoverPhoto.mutate({ photoId: image.photoId });
  }

  function moveUploadedPhoto(photoId: number, direction: "left" | "right") {
    const persistent = [...(photosQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (persistent.length < 2) {
      toast.info("Пока нечего переставлять", { description: "Добавьте ещё одно пользовательское фото, чтобы изменить порядок миниатюр." });
      return;
    }
    const currentIndex = persistent.findIndex((image) => image.photoId === photoId);
    if (currentIndex < 0) return;
    const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= persistent.length) {
      toast.info("Фото уже находится на краю", {
        description: direction === "left" ? "Этот снимок уже первый среди пользовательских фото." : "Этот снимок уже последний среди пользовательских фото.",
      });
      return;
    }

    const reordered = [...persistent];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    const reorderedIds = reordered.map((image) => image.photoId).filter((value): value is number => typeof value === "number");

    utils.animalPhotos.list.setData({ animalSlug }, (current: typeof photosQuery.data) => {
      if (!current) return current;
      const sortMap = new Map(reorderedIds.map((id, index) => [id, index] as const));
      return [...current]
        .map((image) => ({
          ...image,
          sortOrder: image.photoId ? (sortMap.get(image.photoId) ?? image.sortOrder) : image.sortOrder,
        }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });

    reorderPhotos.mutate({ animalSlug, photoIds: reorderedIds });
  }

  if (!animalQuery.isLoading && !animalQuery.data && animalSlug !== DEFAULT_SLUG) {
    setLocation(`/animals/${DEFAULT_SLUG}`);
  }

  async function handlePurchaseShare() {
    if (!animalQuery.data?.id) {
      toast.error("Профиль ещё загружается", { description: "Дождитесь загрузки данных животного и повторите попытку." });
      return;
    }

    if (!isAuthenticated) {
      toast.error("Нужен вход в аккаунт", { description: "Авторизуйтесь, чтобы выбрать и забронировать долю животного." });
      return;
    }

    const defaultPlan = animalQuery.data?.plans?.[0] ?? null;
    const defaultDuration = defaultPlan?.durations?.[0] ?? null;

    if (!defaultPlan || !defaultDuration) {
      toast.error("Сценарий временно недоступен", { description: "Для этого животного ещё не настроен базовый формат участия." });
      return;
    }

    await purchaseShare.mutateAsync({
      animalId: animalQuery.data.id,
      sharePercent: selectedSharePercent,
      planId: defaultPlan.id,
      planDurationId: defaultDuration.id,
      notes: `Бронь ${selectedSharePercent}% через единый сценарий профиля животного`,
    });
  }

  const displayName = animalQuery.data?.name ?? "Марта";
  const selectedLabel = selectedImage?.title ?? displayName;

  return (
    <>
      <div className="min-h-screen overflow-hidden bg-background text-foreground">
        <Navbar />

        <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),rgba(244,240,232,0.55)_36%,rgba(235,230,220,0)_70%)] pb-14 pt-28 md:pb-20 md:pt-32">
          <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden>
            <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-[26rem] w-[26rem] rounded-full bg-accent/20 blur-3xl" />
          </div>

          <div className="container relative">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center">
              <div className="min-w-0 max-w-2xl">
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-sm text-primary shadow-sm backdrop-blur">
                  <Leaf className="h-4 w-4" />
                  {profileContent.heroLabel}
                </motion.div>

                <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-6 max-w-2xl font-display text-5xl leading-[0.95] text-foreground md:text-7xl">
                  {profileContent.heroTitle}
                  <span className="block text-primary">{profileContent.heroSubtitle}</span>
                </motion.h1>

                <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                  {animalQuery.data?.shortDescription ?? profileContent.biographyLong}
                  <strong className="text-foreground"> Sher Kozu</strong>.
                </motion.p>

                <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href={`/tracker?animal=${animalSlug}`} className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95">
                    {profileContent.trackerTitle}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link href={`/club?animal=${animalSlug}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-7 py-4 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                    {profileContent.clubTitle}
                    <Heart className="h-4 w-4" />
                  </Link>
                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-secondary/70 px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary">
                    Вернуться в кабинет
                    <Sparkles className="h-4 w-4" />
                  </Link>
                </motion.div>

                <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                  {profileContent.premiumSignals.map((signal, index) => (
                    <motion.div key={signal.label} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 + index * 0.05 }} className="rounded-2xl border border-border/70 bg-white/75 p-4 shadow-sm backdrop-blur">
                      <div className="font-mono-data text-2xl font-semibold text-foreground">{signal.value}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{signal.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }} className="relative min-w-0">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                  <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-card shadow-[0_30px_70px_-35px_rgba(33,30,24,0.35)]">
                    <img src={selectedImage?.src ?? CDN.hero} alt={selectedImage?.title ?? displayName} className="h-[520px] w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/90 via-dark-oak/18 to-transparent" />
                    <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      Онлайн · {profileContent.stableLabel}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                        <MapPin className="h-3.5 w-3.5" />
                        {profileContent.breedLabel} · #{animalSlug.toUpperCase()}
                      </div>
                      <h2 className="mt-3 font-display text-3xl leading-none md:text-4xl">{displayName}</h2>
                      <p className="mt-3 max-w-md text-sm leading-6 text-white/78">{profileContent.biographyShort}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <img src={CDN.farm} alt="Семейная ферма Шерь Козу" className="h-28 w-24 rounded-2xl object-cover object-center" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-primary">Происхождение</p>
                          <h3 className="mt-2 text-2xl font-semibold text-foreground">{profileContent.originTitle}</h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{profileContent.originText}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-secondary p-3">
                          <div className="text-muted-foreground">Счастье</div>
                          <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">{animalQuery.data?.happinessScore ?? 87}%</div>
                        </div>
                        <div className="rounded-2xl bg-secondary p-3">
                          <div className="text-muted-foreground">Статус ухода</div>
                          <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">{animalQuery.data ? "OK" : "База"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.75rem] border border-primary/15 bg-card p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-primary">Долевое участие</p>
                          <h3 className="mt-2 text-2xl font-semibold text-foreground">Цена и занятость {displayName}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Полная цена животного показывается в профиле, а покупка доступна только свободными долями шагом {shareUnitPercent}%.
                          </p>
                        </div>
                        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {getAnimalStatusLabel(animalQuery.data?.status)}
                        </div>
                      </div>

                      <div className="mt-5">
                        <ShareSelectionPreviewCard
                          priceLabel={formatCurrency(fullPriceMinor)}
                          occupiedPercent={ownedPercent}
                          availablePercent={availablePercent}
                          shareUnitPercent={shareUnitPercent}
                          primarySharePercent={availableSharePercents[0] ?? shareUnitPercent}
                          primarySharePriceLabel={formatCurrency(Math.round((fullPriceMinor * (availableSharePercents[0] ?? shareUnitPercent)) / 100))}
                          availableSharePercents={availableSharePercents}
                          helperText={`Следующий шаг всегда один: забронировать выбранный процент ${displayName} и перейти к подтверждению участия без лишних развилок.`}
                          description="Вы выбираете только долю, а базовый формат участия подставляется автоматически."
                          ctaLabel={isAuthenticated ? "Продолжить с выбранной долей" : "Войдите, чтобы продолжить"}
                          onCtaClick={handlePurchaseShare}
                          ctaDisabled={!availableSharePercents.length || purchaseShare.isPending || !isAuthenticated}
                          ctaPending={purchaseShare.isPending}
                          ctaLoginRequired={!isAuthenticated}
                          selectedSharePercent={selectedSharePercent}
                          onShareSelect={setSelectedSharePercent}
                          selectable
                          defaultPlanLabel={animalQuery.data?.plans?.[0]?.name ?? "Базовый план"}
                          defaultPlanMeta={animalQuery.data?.plans?.[0]?.durations?.[0] ? `${animalQuery.data.plans[0].durations[0].months} мес. · ${animalQuery.data.plans[0].durations[0].label}` : "Срок будет подтверждён фермером"}
                          footer={
                            <div className="rounded-[1.25rem] border border-primary/10 bg-primary/5 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Стоимость выбранной доли</div>
                              <div className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(selectedSharePriceMinor)}</div>
                              <p className="mt-2 text-sm text-muted-foreground">Оформляется как бронь доли с последующим подтверждением оплаты и учётом занятых слотов.</p>
                            </div>
                          }
                        />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                      <img src={CDN.milk} alt={`Продуктовый маршрут ${displayName}`} className="h-48 w-full object-cover" />
                      <div className="p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">Продуктовый слой</p>
                        <h3 className="mt-2 text-xl font-semibold text-foreground">{profileContent.productTitle}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{profileContent.productText}</p>
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
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{profileContent.biographyShort}</p>
                  </div>
                  <div className="shrink-0 rounded-full bg-primary/10 p-3 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {profileContent.statCards.map((stat) => {
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
                      {profileContent.passportRows.map((item) => (
                        <div key={item.label} className="flex flex-col items-start gap-1 rounded-2xl bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="max-w-full break-words text-left font-medium text-foreground sm:text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-[1.25rem] border border-primary/10 bg-primary/5 p-4">
                      <p className="text-sm leading-7 text-muted-foreground">
                        {showFullBio ? profileContent.biographyLong : profileContent.biographyShort}
                      </p>
                      <button type="button" onClick={() => setShowFullBio((current) => !current)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
                        {showFullBio ? "Свернуть описание" : "Показать полную историю"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${showFullBio ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                    <h4 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Milk className="h-4 w-4 text-primary" />
                      Продуктовый потенциал
                    </h4>
                    <div className="mt-4 space-y-3">
                      {profileContent.milkCards.map((item) => (
                        <div key={item.label} className="rounded-2xl bg-card p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                            <span className="font-semibold text-foreground">{item.value}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Дневник и прозрачность</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">{profileContent.diaryTitle}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{profileContent.diaryIntro}</p>
                  </div>
                  <div className="inline-flex rounded-full border border-border bg-background p-1 text-sm">
                    {[
                      { key: "diary", label: "Дневник", icon: BookOpen },
                      { key: "health", label: "Здоровье", icon: Heart },
                      { key: "milk", label: "Молоко", icon: Milk },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.key;
                      return (
                        <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as "diary" | "health" | "milk")} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          <Icon className="h-4 w-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeTab === "diary" ? (
                  <div className="mt-6 grid gap-4">
                    {profileContent.diaryEntries.map((entry) => (
                      <div key={entry.title} className="rounded-[1.5rem] border border-border/60 bg-background/70 p-5">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xl">{entry.mood}</span>
                          <div>
                            <p className="font-semibold text-foreground">{entry.title}</p>
                            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{entry.date}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">{entry.text}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {entry.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeTab === "health" ? (
                  <div className="mt-6 grid gap-4">
                    {profileContent.healthHistory.map((entry) => (
                      <div key={`${entry.date}-${entry.event}`} className="rounded-[1.5rem] border border-border/60 bg-background/70 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{entry.event}</p>
                            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{entry.date}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${entry.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {entry.status === "ok" ? "В норме" : "Нужно внимание"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{entry.note}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeTab === "milk" ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {profileContent.milkCards.map((item) => (
                      <div key={item.label} className="rounded-[1.5rem] border border-border/60 bg-background/70 p-5">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.note}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            </div>

            <div className="min-w-0 space-y-6">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Галерея профиля</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Все действия профиля животного</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">Здесь повторён весь рабочий слой кабинета: загрузка, удаление, смена обложки, reorder, lightbox и share-сценарии.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    <Images className="h-3.5 w-3.5" />
                    {galleryImages.length} изображений
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/70">
                  <div className="relative">
                    <img src={selectedImage?.src ?? CDN.hero} alt={selectedLabel} className="h-[360px] w-full object-cover md:h-[440px]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dark-oak/85 to-transparent p-5 text-white">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-white/65">Выбрано</p>
                          <h4 className="mt-1 text-2xl font-semibold">{selectedLabel}</h4>
                          <p className="mt-1 text-sm text-white/75">{selectedImage?.meta}</p>
                        </div>
                        {selectedImage?.isCover ? <span className="rounded-full bg-white/15 px-3 py-1 text-xs">Обложка профиля</span> : null}
                      </div>
                    </div>
                    <button type="button" onClick={() => moveGallery("prev")} className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm transition hover:bg-white">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => moveGallery("next")} className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm transition hover:bg-white">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {galleryImages.map((image) => (
                    <div key={image.id} className={`rounded-[1.5rem] border p-3 transition ${selectedImageId === image.id ? "border-primary bg-primary/5" : "border-border/70 bg-background/70"}`}>
                      <button type="button" onClick={() => setSelectedImageId(image.id)} className="w-full overflow-hidden rounded-[1.2rem]">
                        <img src={image.src} alt={image.title} className="h-28 w-full object-cover" />
                      </button>
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="font-medium text-foreground">{image.title}</p>
                          <p className="text-xs leading-5 text-muted-foreground">{image.meta}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleSetCoverImage(image)} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground transition hover:bg-muted">
                            <Star className="h-3.5 w-3.5" />
                            Обложка
                          </button>
                          <button type="button" onClick={() => setLightboxOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground transition hover:bg-muted">
                            <Play className="h-3.5 w-3.5" />
                            Просмотр
                          </button>
                          {image.isUploaded && image.photoId ? (
                            <>
                              <button type="button" onClick={() => moveUploadedPhoto(image.photoId!, "left")} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground transition hover:bg-muted">
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Влево
                              </button>
                              <button type="button" onClick={() => moveUploadedPhoto(image.photoId!, "right")} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground transition hover:bg-muted">
                                <ChevronRight className="h-3.5 w-3.5" />
                                Вправо
                              </button>
                              <button type="button" onClick={() => handleRemoveUploadedImage(image)} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 transition hover:bg-rose-100">
                                <X className="h-3.5 w-3.5" />
                                Удалить
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <label onDragOver={handleDropZoneDragOver} onDragLeave={handleDropZoneDragLeave} onDrop={handleDropZoneDrop} className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-6 py-8 text-center transition ${isDragActive ? "border-primary bg-primary/5" : "border-border/70 bg-background/70 hover:bg-muted/30"}`}>
                  <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="hidden" onChange={handleGalleryUpload} />
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="mt-4 font-medium text-foreground">Загрузить новое фото</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Поддерживаются JPG, PNG и WebP до 8 МБ. После кадрирования фото попадёт в профиль выбранного животного.</p>
                </label>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button type="button" onClick={handleCopyShareLink} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted">
                    <Link2 className="h-4 w-4" />
                    Скопировать ссылку на профиль
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => handleShare("facebook")} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted">
                      <Facebook className="h-4 w-4" />
                      Facebook
                    </button>
                    <button type="button" onClick={() => handleShare("vk")} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted">
                      <MessageCircle className="h-4 w-4" />
                      VK
                    </button>
                    <button type="button" onClick={() => handleShare("instagram")} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted">
                      <Instagram className="h-4 w-4" />
                      IG
                    </button>
                  </div>
                </div>

                {photoActivity.length ? (
                  <div className="mt-5 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Последние действия</p>
                    <div className="mt-3 space-y-3">
                      {photoActivity.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${item.action === "upload" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {item.action === "upload" ? <Upload className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </span>
                            <div>
                              <p className="font-medium text-foreground">{item.action === "upload" ? "Загружено" : "Удалено"}: {item.title}</p>
                              <p className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString("ru-RU")}</p>
                            </div>
                          </div>
                          <Clock3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Связанные маршруты</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Куда ведёт профиль животного</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">Логика кабинета Марты теперь повторяется как универсальный сценарий: профиль связан с дашбордом, продуктовым трекером и клубной лентой через текущий slug животного.</p>
                  </div>
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Share2 className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {profileContent.routeCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <Link key={card.title} href={card.href} className="group rounded-[1.6rem] border border-border/70 bg-background/70 p-5 transition hover:bg-muted/30">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h4 className="mt-4 text-lg font-semibold text-foreground">{card.title}</h4>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.text}</p>
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                          Открыть маршрут
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {profileContent.quickFacts.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm">
                      <div className="text-muted-foreground">{item.label}</div>
                      <div className="mt-1 font-medium text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {lightboxOpen && selectedImage ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10" onClick={() => setLightboxOpen(false)}>
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => setLightboxOpen(false)} className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
                <img src={selectedImage.src} alt={selectedImage.title} className="max-h-[80vh] w-full object-cover" />
                <div className="border-t border-border/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xl font-semibold text-foreground">{selectedImage.title}</h4>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{selectedImage.meta}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" />
                      Профиль {displayName}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {cropDraft ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10" onClick={closeCropDraft}>
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="w-full max-w-3xl rounded-[2rem] bg-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">Кадрирование</p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Подготовьте фото перед загрузкой</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">Смещение и масштаб помогают привести изображение к квадратному формату профиля.</p>
                  </div>
                  <button type="button" onClick={closeCropDraft} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/70">
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img src={cropDraft.previewUrl} alt="Предпросмотр перед загрузкой" className="h-full w-full object-cover" style={{ transform: `scale(${cropDraft.zoom}) translate(${cropDraft.offsetX * 18}%, ${cropDraft.offsetY * 18}%)` }} />
                    </div>
                  </div>

                  <div className="space-y-5 rounded-[1.75rem] border border-border/70 bg-background/70 p-5">
                    <div>
                      <label className="text-sm font-medium text-foreground">Масштаб</label>
                      <input type="range" min={1} max={2.4} step={0.05} value={cropDraft.zoom} onChange={(event) => setCropDraft((current) => current ? { ...current, zoom: Number(event.target.value) } : current)} className="mt-3 w-full" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Смещение по X</label>
                      <input type="range" min={-1} max={1} step={0.05} value={cropDraft.offsetX} onChange={(event) => setCropDraft((current) => current ? { ...current, offsetX: Number(event.target.value) } : current)} className="mt-3 w-full" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Смещение по Y</label>
                      <input type="range" min={-1} max={1} step={0.05} value={cropDraft.offsetY} onChange={(event) => setCropDraft((current) => current ? { ...current, offsetY: Number(event.target.value) } : current)} className="mt-3 w-full" />
                    </div>
                    <div className="grid gap-3">
                      <button type="button" onClick={handleConfirmCrop} disabled={uploadPhoto.isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/95 disabled:cursor-not-allowed disabled:opacity-70">
                        {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Сохранить фото
                      </button>
                      <button type="button" onClick={closeCropDraft} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted">
                        Отменить
                      </button>
                    </div>
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
