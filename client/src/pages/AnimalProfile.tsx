/*
Design Philosophy Reminder — AnimalProfile.tsx
Biomorphic Tech emotional core page.
Core: one animal must feel alive, valuable and connected to dashboard, product and club routes.
Hardening priority: no dead ends, calm mobile rhythm, consistent CTA logic.
*/

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Heart, Thermometer, Milk, Camera, BookOpen, Star, Award,
  ChevronLeft, ChevronRight, Play, Calendar, Dna, MapPin, Zap, ChevronDown, Images, Upload, X, Share2, Link2,
  Facebook, MessageCircle, Instagram
} from "lucide-react";

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

const defaultGallery = [
  { id: "cover", src: CDN.goat, title: "Портрет Марты", meta: "Основной профиль" },
  { id: "live", src: CDN.liveCam, title: "Марта в стойле", meta: "Утренний эфир" },
  { id: "family", src: CDN.family, title: "День с семьёй", meta: "Визит на ферму" },
];

export default function AnimalProfile() {
  const [activeTab, setActiveTab] = useState<"diary" | "health" | "milk">("diary");
  const [showFullBio, setShowFullBio] = useState(false);
  const [galleryImages, setGalleryImages] = useState(defaultGallery);
  const [selectedImageId, setSelectedImageId] = useState(defaultGallery[0].id);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  function handleGalleryUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const uploadedImages = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      src: URL.createObjectURL(file),
      title: file.name.replace(/\.[^.]+$/, "") || `Фото ${galleryImages.length + index + 1}`,
      meta: `Загружено владельцем · ${Math.round(file.size / 1024)} KB`,
    }));

    setGalleryImages((current) => [...uploadedImages, ...current]);
    setSelectedImageId(uploadedImages[0].id);
    event.target.value = "";
  }

  function handleRemoveUploadedImage(imageId: string) {
    setGalleryImages((current) => {
      const target = current.find((item) => item.id === imageId);
      if (target && target.src.startsWith("blob:")) {
        URL.revokeObjectURL(target.src);
      }

      const next = current.filter((item) => item.id !== imageId);
      if (selectedImageId === imageId && next.length) {
        setSelectedImageId(next[0].id);
      }
      return next;
    });
  }

  useEffect(() => {
    return () => {
      galleryImages.forEach((item) => {
        if (item.src.startsWith("blob:")) {
          URL.revokeObjectURL(item.src);
        }
      });
    };
  }, [galleryImages]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        {/* Hero */}
        <div className="relative h-72 md:h-96 overflow-hidden">
          <img src={CDN.family} alt="Ферма" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
          <div className="absolute top-4 left-4">
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-3 py-2 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </motion.button>
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="container">
              <div className="flex items-end gap-4">
                <div className="relative">
                  <img
                    src={CDN.goat}
                    alt="Марта"
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-xl"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                </div>
                <div className="text-white pb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="pulse-dot" />
                    <span className="text-xs">Онлайн · Стойло №3</span>
                  </div>
                  <h1 className="text-3xl font-bold">Коза Марта</h1>
                  <p className="text-white/80">Англо-нубийская · 3 года · #МК-2023-047</p>
                </div>
                <div className="ml-auto flex items-center gap-2 pb-1">
                  <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    Элита
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mt-6">
          <div className="grid grid-cols-12 gap-5">

            {/* Left column */}
            <div className="col-span-12 md:col-span-4 space-y-4">

              {/* Vital stats */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5"
              >
                <h3 className="font-bold text-foreground mb-4">Показатели здоровья</h3>
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
                            <Icon className="w-4 h-4" style={{ color: stat.color }} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                        <p className="font-mono-data text-sm font-semibold">{stat.value}%</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Passport */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl border border-border shadow-sm p-5"
              >
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-primary" />
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
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {showFullBio
                      ? "Англо-нубийская коза — одна из самых продуктивных молочных пород мира. Отличается высокой жирностью молока (до 5%), отсутствием специфического запаха и дружелюбным характером. Марта — дочь чемпиона выставки «АгроФерм 2022», обладатель золотой медали по надою."
                      : "Одна из самых продуктивных молочных пород мира..."}
                  </p>
                  <button
                    onClick={() => setShowFullBio(!showFullBio)}
                    className="text-xs text-primary mt-1 flex items-center gap-1 hover:underline"
                  >
                    {showFullBio ? "Свернуть" : "Читать полностью"}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showFullBio ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 }}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="border-b border-border p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <Images className="h-4 w-4 text-primary" />
                        Галерея Марты
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">Фотоистория Марты с быстрым переходом между кадрами.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92">
                      <Upload className="h-4 w-4" />
                      Добавить фото
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    </label>
                  </div>
                </div>

                <div className="p-5">
                  {selectedImage && (
                    <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/30">
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="group relative block w-full text-left"
                      >
                        <img src={selectedImage.src} alt={selectedImage.title} className="h-56 w-full object-cover md:h-72" />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/12" />
                        <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                          Открыть крупно
                        </div>
                      </button>
                      <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-foreground">{selectedImage.title}</div>
                          <div className="text-sm text-muted-foreground">{selectedImage.meta}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                            {galleryImages.length} фото в истории
                          </div>
                          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-1 py-1">
                            <button
                              type="button"
                              onClick={() => moveGallery("prev")}
                              aria-label="Предыдущее фото"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGallery("next")}
                              aria-label="Следующее фото"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                            >
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
                        <button
                          type="button"
                          aria-label="Поделиться в Facebook"
                          title="Facebook"
                          onClick={() => handleShare("facebook")}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-[#1877F2] transition-colors hover:bg-muted"
                        >
                          <Facebook className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Поделиться во ВКонтакте"
                          title="VK"
                          onClick={() => handleShare("vk")}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-[#0077FF] transition-colors hover:bg-muted"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Поделиться в Instagram"
                          title="Instagram"
                          onClick={() => handleShare("instagram")}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-[#E1306C] transition-colors hover:bg-muted"
                        >
                          <Instagram className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Скопировать ссылку"
                          title="Копировать ссылку"
                          onClick={handleCopyShareLink}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:bg-primary/10"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 truncate rounded-full border border-border/60 bg-card px-4 py-2 text-xs text-muted-foreground">
                      {shareUrl}
                    </div>
                  </div>

                  <div className="mt-3 rounded-[1.5rem] border border-border bg-card/85 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Фотографии</p>
                        <p className="mt-1 text-xs text-muted-foreground">Быстрый переход к нужному снимку.</p>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                        {galleryImages.length} фото
                      </div>
                    </div>
                    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                      {galleryImages.map((image) => {
                        const isSelected = image.id === selectedImageId;
                        const isUploaded = image.src.startsWith("blob:");

                        return (
                          <div
                            key={image.id}
                            className={`group relative min-w-[120px] max-w-[120px] snap-start overflow-hidden rounded-[1rem] border transition-all ${
                              isSelected ? "border-primary shadow-md shadow-primary/10" : "border-border bg-card"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedImageId(image.id)}
                              className="block w-full text-left"
                            >
                              <img src={image.src} alt={image.title} className="h-20 w-full object-cover" />
                              <div className="p-2.5">
                                <div className="truncate text-[11px] font-semibold text-foreground">{image.title}</div>
                              </div>
                            </button>

                            {isUploaded && galleryImages.length > 1 && (
                              <button
                                type="button"
                                aria-label="Удалить фото"
                                onClick={() => handleRemoveUploadedImage(image.id)}
                                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition-colors hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.24 }}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="relative h-56 cursor-pointer group md:h-64">
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

            {/* Right column */}
            <div className="col-span-12 md:col-span-8 space-y-4">

              {/* Quick actions */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3 lg:grid-cols-4"
              >
                {[
                  { emoji: "🥕", label: "Покормить", sub: "морковкой", color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
                  { emoji: "🛁", label: "SPA-уход", sub: "груминг", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
                  { emoji: "🚶", label: "Прогулка", sub: "1 час", color: "bg-green-50 border-green-200 hover:bg-green-100" },
                  { emoji: "🎂", label: "День рождения", sub: "через 32 дня", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
                ].map((action, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex flex-col items-center p-3 rounded-xl border text-center transition-colors ${action.color}`}
                  >
                    <span className="text-2xl mb-1">{action.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.sub}</span>
                  </motion.button>
                ))}
              </motion.div>

              {/* Tabs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <div className="flex border-b border-border">
                  {(["diary", "health", "milk"] as const).map((tab) => {
                    const labels = { diary: "Дневник", health: "Здоровье", milk: "Надои" };
                    const icons = { diary: BookOpen, health: Award, milk: Milk };
                    const Icon = icons[tab];
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                          activeTab === tab
                            ? "text-primary border-b-2 border-primary bg-primary/5"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5"
                  >
                    {activeTab === "diary" && (
                      <div className="space-y-4">
                        {diaryEntries.map((entry, i) => (
                          <div key={i} className="flex gap-4 p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                            <div className="text-3xl">{entry.mood}</div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-foreground">{entry.title}</h4>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {entry.date}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{entry.text}</p>
                              <div className="flex gap-1.5 mt-2">
                                {entry.tags.map((tag) => (
                                  <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
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
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">{item.event}</p>
                                <span className="text-xs text-muted-foreground">{item.date}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
                          <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            Следующий плановый осмотр: 10 апреля 2026
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === "milk" && (
                      <div>
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          {[
                            { label: "Сегодня", value: "1.8 л", trend: "+12%" },
                            { label: "Эта неделя", value: "11.4 л", trend: "+8%" },
                            { label: "Этот месяц", value: "47.2 л", trend: "+5%" },
                          ].map((stat, i) => (
                            <div key={i} className="bg-muted/50 rounded-xl p-3 text-center">
                              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                              <p className="font-mono-data text-xl font-bold text-foreground">{stat.value}</p>
                              <p className="text-xs text-green-600 font-medium">{stat.trend}</p>
                            </div>
                          ))}
                        </div>
                        <div className="h-32 flex items-end gap-1.5">
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
                        <p className="text-xs text-muted-foreground text-center mt-2">Надой за последние 14 дней (л)</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* NFT Passport */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Цифровой паспорт животного</p>
                    <h3 className="text-lg font-bold">Марта #МК-2023-047</h3>
                    <p className="text-sm text-white/70 mt-1">Цифровая карточка с историей животного. Подтверждает происхождение, статус и связь владельца с Мартой.</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="font-mono-data text-xs bg-white/10 px-2 py-1 rounded">0x7f3a...c9b2</span>
                      <span className="text-xs text-white/60">Выдан: 14.02.2025</span>
                    </div>
                  </div>
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white/20">
                    <img src={CDN.goat} alt="NFT" className="h-full w-full object-cover" />
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
        </div>
        <AnimatePresence>
          {lightboxOpen && selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/82 px-4 py-6 backdrop-blur-sm"
            >
              <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center">
                <div className="mb-4 flex items-center justify-between text-white">
                  <div>
                    <div className="text-lg font-semibold">{selectedImage.title}</div>
                    <div className="text-sm text-white/70">{selectedImage.meta}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Закрыть просмотр"
                    onClick={() => setLightboxOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 transition-colors hover:bg-white/15"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 shadow-2xl">
                  <img src={selectedImage.src} alt={selectedImage.title} className="max-h-[72vh] w-full object-contain bg-black/30" />

                  {galleryImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Предыдущее фото"
                        onClick={() => moveGallery("prev")}
                        className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition-colors hover:bg-black/60"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Следующее фото"
                        onClick={() => moveGallery("next")}
                        className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition-colors hover:bg-black/60"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-5">
                  {galleryImages.map((image) => {
                    const isActive = image.id === selectedImageId;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImageId(image.id)}
                        className={`overflow-hidden rounded-2xl border transition-all ${
                          isActive ? "border-white shadow-lg shadow-white/10" : "border-white/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={image.src} alt={image.title} className="h-20 w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
