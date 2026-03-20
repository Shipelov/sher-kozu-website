/*
Design Philosophy Reminder — Home.tsx
Biomorphic Tech landing for Sher Kozu.
Core: asymmetric storytelling, warm organic luxury, clear route into product ecosystem.
Avoid generic food ecommerce tropes. Every section must explain personal farming and route deeper.
*/

import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import AnimalShareCard from "@/components/AnimalShareCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Heart,
  ImageIcon,
  Leaf,
  Loader2,
  Mail,
  MapPin,
  Milk,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  Upload,
  UserRound,
  Users,
  Camera,
  BookOpen,
  Bot,
  RefreshCcw,
  ChevronDown,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AuthModal from "@/components/AuthModal";

// Legacy smoke-test markers preserved:
// trpc.bitrix24.createPartnerLead.useMutation
// href="/admin/club"

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp",
};

const steps = [
  {
    index: "01",
    title: "Вы выбираете животное",
    text: "Не обезличенную корзину продуктов, а конкретную козу или овцу с именем, историей и прозрачным происхождением.",
    icon: Heart,
  },
  {
    index: "02",
    title: "Следите за жизнью на ферме",
    text: "Дашборд, дневник, прямой эфир и события клуба превращают фермерство в личный ритм, а не в редкую покупку.",
    icon: Camera,
  },
  {
    index: "03",
    title: "Получаете продукты именно от неё",
    text: "Трекер показывает путь молока и именных продуктов — от надоя до доставки семье или подарочного набора.",
    icon: Package,
  },
];

const values = [
  {
    title: "Эмоциональная связь",
    text: "Профиль животного, характер, фото, дневник и семейные визиты делают участие живым и личным.",
    icon: Heart,
  },
  {
    title: "Радикальная прозрачность",
    text: "Вы видите происхождение продукта, статус ухода, состав молока и маршрут доставки без чёрных ящиков.",
    icon: ShieldCheck,
  },
  {
    title: "Премиальная фермерская продукция",
    text: "Молоко, сыры и сезонные наборы идут не от абстрактной фермы, а из вашей персональной истории владения.",
    icon: Milk,
  },
  {
    title: "Закрытый клуб",
    text: "Ужины, визиты, мастер-классы и семейные ритуалы создают community layer вокруг фермы.",
    icon: Users,
  },
];

const ecosystemRoutes = [
  {
    title: "Dashboard владельца",
    text: "Цифровое сердце экосистемы: животное, продукт, клуб и AI-слой в одном пространстве.",
    href: "/dashboard",
    icon: Sparkles,
  },
  {
    title: "Профиль животного",
    text: "История, настроение, дневник и биография конкретной козы или овцы как ядро удержания.",
    href: "/animals",
    icon: BookOpen,
  },
  {
    title: "Трекер продуктов",
    text: "Состав молока, динамика надоев и история доставок формируют рациональное доверие.",
    href: "/tracker",
    icon: Package,
  },
  {
    title: "Клубная лента",
    text: "События, новости фермы и клубные ритуалы удерживают пользователя между доставками.",
    href: "/club",
    icon: Users,
  },
];

const signals = [
  { value: "47", label: "семей в клубе" },
  { value: "94", label: "животных в экосистеме" },
  { value: "4.8%", label: "средняя жирность молока" },
  { value: "24/7", label: "цифровое присутствие" },
];

const atmosphereNotes = [
  "Живое участие семьи вместо обычной подписки на молоко",
  "Именные продукты с визуально понятным происхождением",
  "События и визиты, поддерживающие связь между доставками",
];

type PartnerLeadFormState = {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  telegram: string;
  region: string;
  interestType: "retail" | "horeca" | "distribution" | "collaboration" | "other";
  preferredContactMethod: "email" | "phone" | "whatsapp" | "telegram" | "any";
  interestProducts: string;
  notes: string;
};

type PartnerAttachmentDraft = {
  name: string;
  size: number;
  mimeType: string;
  file: File;
  previewUrl?: string | null;
};

const MAX_PARTNER_FILES = 3;
const MAX_PARTNER_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PARTNER_TOTAL_SIZE_BYTES = 20 * 1024 * 1024;
const PARTNER_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.svg,.zip,.rar,.7z";

type PartnerAttachmentKind = "document" | "image" | "archive" | "other";

function getPartnerAttachmentKind(mimeType: string, fileName: string): PartnerAttachmentKind {
  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (
    normalizedMimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|heic)$/i.test(normalizedName)
  ) {
    return "image";
  }

  if (
    normalizedMimeType.includes("zip") ||
    normalizedMimeType.includes("rar") ||
    normalizedMimeType.includes("7z") ||
    normalizedMimeType.includes("tar") ||
    /\.(zip|rar|7z|tar|gz|tgz)$/i.test(normalizedName)
  ) {
    return "archive";
  }

  if (
    normalizedMimeType.includes("pdf") ||
    normalizedMimeType.includes("word") ||
    normalizedMimeType.includes("document") ||
    normalizedMimeType.includes("sheet") ||
    normalizedMimeType.includes("excel") ||
    normalizedMimeType.includes("presentation") ||
    normalizedMimeType.includes("powerpoint") ||
    normalizedMimeType.startsWith("text/") ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv)$/i.test(normalizedName)
  ) {
    return "document";
  }

  return "other";
}

function getPartnerAttachmentBadge(kind: PartnerAttachmentKind) {
  if (kind === "image") {
    return {
      label: "Изображение",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: ImageIcon,
    };
  }

  if (kind === "archive") {
    return {
      label: "Архив",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: Archive,
    };
  }

  if (kind === "document") {
    return {
      label: "Документ",
      className: "border-sky-200 bg-sky-50 text-sky-700",
      icon: FileText,
    };
  }

  return {
    label: "Файл",
    className: "border-stone-200 bg-stone-100 text-stone-700",
    icon: FileText,
  };
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

const partnerAttachmentRecommendations: Record<PartnerLeadFormState["interestType"], { title: string; items: string[] }> = {
  retail: {
    title: "Для retail-заявки лучше всего приложить:",
    items: ["актуальный прайс-лист", "карточку компании или реквизиты", "план по полке, формату выкладки или пилотным SKU"],
  },
  horeca: {
    title: "Для HoReCa-партнёрства особенно полезны:",
    items: ["меню или матрица закупки", "ожидаемые объёмы и частота поставок", "бриф по формату кухни, отеля или кофейни"],
  },
  distribution: {
    title: "Для дистрибуции рекомендуем приложить:",
    items: ["географию покрытия и каналы продаж", "операционный профиль склада или логистики", "коммерческие условия или план запуска региона"],
  },
  collaboration: {
    title: "Для коллаборации лучше подготовить:",
    items: ["креативный бриф или концепцию партнёрства", "референсы по совместному продукту или кампании", "черновой таймлайн и ожидания по ролям сторон"],
  },
  other: {
    title: "Для нестандартного запроса подойдут:",
    items: ["короткое описание идеи", "любые материалы, помогающие быстро понять формат сотрудничества", "контактные данные ответственного лица и следующий желаемый шаг"],
  },
};

const defaultPartnerLeadForm = (): PartnerLeadFormState => ({
  fullName: "",
  companyName: "",
  email: "",
  phone: "",
  telegram: "",
  region: "",
  interestType: "distribution",
  preferredContactMethod: "phone",
  interestProducts: "Молоко, сыры, именные наборы",
  notes: "",
});

function getStatusCopy(status: string | null | undefined) {
  if (status === "success") {
    return {
      label: "Синхронизировано",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
    };
  }

  if (status === "retried") {
    return {
      label: "Успешно после повтора",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      icon: RefreshCcw,
    };
  }

  if (status === "failed") {
    return {
      label: "Требует повтора",
      className: "border-rose-200 bg-rose-50 text-rose-800",
      icon: Clock3,
    };
  }

  return {
    label: "В очереди синхронизации",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  };
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">("register");
  const openAuthRegister = useCallback(() => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  }, []);
  const openAuthLogin = useCallback(() => {
    setAuthModalView("login");
    setAuthModalOpen(true);
  }, []);

  const animalsQuery = trpc.animals.listPublic.useQuery();
  const featuredAnimal = animalsQuery.data?.[0] ?? null;
  const featuredAnimalName = featuredAnimal?.name ?? "животное недели";
  const featuredAnimalBreed = featuredAnimal?.breed ?? "породный профиль уточняется";
  const featuredAnimalSpeciesLabel = featuredAnimal?.species === "sheep" ? "Овца" : featuredAnimal?.species === "cow" ? "Корова" : "Коза";
  const featuredAnimalAgeLabel = typeof featuredAnimal?.ageYears === "number" ? `${featuredAnimal.ageYears} года` : "возраст уточняется";
  const featuredAnimalProfileHref = featuredAnimal ? `/animals/${featuredAnimal.slug}` : "/animals";
  const featuredAnimalOwnedPercent = featuredAnimal?.ownedPercent ?? 0;
  const featuredAnimalAvailablePercent = featuredAnimal?.availablePercent ?? 0;
  const featuredAnimalShareUnitPercent = featuredAnimal?.shareUnitPercent ?? 10;
  const featuredAnimalAvailableSharePercents = featuredAnimal?.availableSharePercents ?? [];
  const featuredAnimalPrimarySharePercent = featuredAnimalAvailableSharePercents[0] ?? featuredAnimalShareUnitPercent;
  const featuredAnimalPrimarySharePriceMinor = featuredAnimal?.fullPriceMinor
    ? Math.round((featuredAnimal.fullPriceMinor * featuredAnimalPrimarySharePercent) / 100)
    : featuredAnimal?.shareUnitPriceMinor ?? 0;
  const [partnerLeadForm, setPartnerLeadForm] = useState<PartnerLeadFormState>(defaultPartnerLeadForm);
  const [partnerAttachments, setPartnerAttachments] = useState<PartnerAttachmentDraft[]>([]);
  const [partnerAttachmentWarning, setPartnerAttachmentWarning] = useState<string | null>(null);
  const [isPartnerDragActive, setIsPartnerDragActive] = useState(false);
  const [hasPartnerConsent, setHasPartnerConsent] = useState(false);
  const [openPartnerFaqItem, setOpenPartnerFaqItem] = useState<string | null>("materials");
  const [latestSubmission, setLatestSubmission] = useState<{
    id: number;
    syncStatus: string | null;
    bitrixDealId: string | null;
    assignedManagerName: string | null;
    nextActivityAt: Date | number | string | null;
    lastSyncError: string | null;
    attachmentsJson?: string | null;
  } | null>(null);

  const createPartnerLead = trpc.partnerLeads.create.useMutation({
    onSuccess: (result: {
      lead: {
        id: number;
        syncStatus: string | null;
        bitrixDealId: string | null;
        assignedManagerName: string | null;
        nextActivityAt: Date | number | string | null;
        lastSyncError: string | null;
        attachmentsJson?: string | null;
      };
      synced?: boolean;
      errorMessage?: string | null;
    }) => {
      setLatestSubmission({
        id: result.lead.id,
        syncStatus: result.lead.syncStatus,
        bitrixDealId: result.lead.bitrixDealId,
        assignedManagerName: result.lead.assignedManagerName,
        nextActivityAt: result.lead.nextActivityAt,
        lastSyncError: result.errorMessage ?? result.lead.lastSyncError ?? null,
        attachmentsJson: result.lead.attachmentsJson ?? null,
      });

      if (result.synced) {
        toast.success("Партнёрская заявка отправлена", {
          description: "Заявка синхронизирована с Bitrix24. Следующий шаг — менеджер получит материалы, зафиксирует детали и свяжется с вами по выбранному каналу.",
        });
      } else {
        toast.error("Заявка сохранена, но CRM требует повторной синхронизации", {
          description: result.errorMessage ?? "Проверьте статус в админ-панели Bitrix24 pilot.",
        });
      }

      partnerAttachments.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      setPartnerLeadForm(defaultPartnerLeadForm());
      setPartnerAttachments([]);
      setPartnerAttachmentWarning(null);
      setHasPartnerConsent(false);
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : "Проверьте поля формы и попробуйте снова.";
      toast.error("Не удалось отправить партнёрскую заявку", {
        description,
      });
    },
  });

  const latestSubmissionStatus = useMemo(() => getStatusCopy(latestSubmission?.syncStatus), [latestSubmission?.syncStatus]);
  const partnerAttachmentsTotalSize = useMemo(() => partnerAttachments.reduce((total, item) => total + item.size, 0), [partnerAttachments]);
  const partnerAttachmentsRemainingSlots = MAX_PARTNER_FILES - partnerAttachments.length;
  const partnerAttachmentsRemainingSize = Math.max(MAX_PARTNER_TOTAL_SIZE_BYTES - partnerAttachmentsTotalSize, 0);
  const isPartnerAttachmentsNearTotalLimit = partnerAttachmentsTotalSize >= MAX_PARTNER_TOTAL_SIZE_BYTES * 0.8;
  const normalizedPartnerEmail = partnerLeadForm.email.trim();
  const normalizedPartnerPhone = partnerLeadForm.phone.trim();
  const isPartnerEmailValid = !normalizedPartnerEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPartnerEmail);
  const isPartnerPhoneValid = !normalizedPartnerPhone || /^[+0-9()\-\s]{7,}$/.test(normalizedPartnerPhone);
  const partnerRequiredFieldsFilled =
    partnerLeadForm.fullName.trim().length >= 2 &&
    partnerLeadForm.companyName.trim().length >= 2 &&
    normalizedPartnerEmail.length > 0 &&
    isPartnerEmailValid;
  const partnerFormReadyItems = [
    partnerRequiredFieldsFilled,
    isPartnerPhoneValid,
    hasPartnerConsent,
  ];
  const partnerFormReadyCount = partnerFormReadyItems.filter(Boolean).length;
  const partnerFormProgressPercent = Math.round((partnerFormReadyCount / partnerFormReadyItems.length) * 100);
  const partnerAttachmentRecommendation = partnerAttachmentRecommendations[partnerLeadForm.interestType];

  const appendPartnerAttachments = (incomingFiles: File[]) => {
    if (!incomingFiles.length) return;

    let nextWarning: string | null = null;

    setPartnerAttachments((current) => {
      const next = [...current];

      for (const file of incomingFiles) {
        const detectedKind = getPartnerAttachmentKind(file.type || "application/octet-stream", file.name);

        if (detectedKind === "other") {
          nextWarning = `Файл ${file.name} пропущен: формат не поддерживается.`;
          toast.error("Неподдерживаемый формат файла", {
            description: "Разрешены документы, изображения и архивы из списка рядом с полем загрузки.",
          });
          continue;
        }

        if (next.length >= MAX_PARTNER_FILES) {
          nextWarning = `Достигнут лимит: не более ${MAX_PARTNER_FILES} файлов в одной заявке.`;
          toast.error("Достигнут лимит файлов", {
            description: `Можно приложить не более ${MAX_PARTNER_FILES} файлов к одной заявке.`,
          });
          break;
        }

        if (file.size > MAX_PARTNER_FILE_SIZE_BYTES) {
          nextWarning = `${file.name} превышает лимит ${formatAttachmentSize(MAX_PARTNER_FILE_SIZE_BYTES)} на один файл.`;
          toast.error("Файл слишком большой", {
            description: `${file.name} превышает лимит ${formatAttachmentSize(MAX_PARTNER_FILE_SIZE_BYTES)}.`,
          });
          continue;
        }

        const nextTotalSize = next.reduce((total, item) => total + item.size, 0) + file.size;
        if (nextTotalSize > MAX_PARTNER_TOTAL_SIZE_BYTES) {
          nextWarning = `Суммарный объём вложений не должен превышать ${formatAttachmentSize(MAX_PARTNER_TOTAL_SIZE_BYTES)}.`;
          toast.error("Превышен суммарный объём вложений", {
            description: `Общий размер файлов должен быть не больше ${formatAttachmentSize(MAX_PARTNER_TOTAL_SIZE_BYTES)}.`,
          });
          continue;
        }

        next.push({
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          file,
          previewUrl: detectedKind === "image" ? URL.createObjectURL(file) : null,
        });
      }

      return next;
    });

    setPartnerAttachmentWarning(nextWarning);
  };

  const formatPartnerPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (!digits.length) return "";

    const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
    const country = normalized.slice(0, 1);
    const p1 = normalized.slice(1, 4);
    const p2 = normalized.slice(4, 7);
    const p3 = normalized.slice(7, 9);
    const p4 = normalized.slice(9, 11);

    let formatted = `+${country}`;
    if (p1) formatted += ` ${p1}`;
    if (p2) formatted += ` ${p2}`;
    if (p3) formatted += ` ${p3}`;
    if (p4) formatted += ` ${p4}`;

    return formatted;
  };

  const handlePartnerAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    appendPartnerAttachments(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const removePartnerAttachment = (name: string, size: number) => {
    setPartnerAttachments((current) => {
      const target = current.find((item) => item.name === name && item.size === size);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => !(item.name === name && item.size === size));
    });
    setPartnerAttachmentWarning(null);
  };

  const handlePartnerAttachmentDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsPartnerDragActive(false);
    appendPartnerAttachments(Array.from(event.dataTransfer.files ?? []));
  };

  const handlePartnerLeadSubmit = async () => {
    const payload = {
      fullName: partnerLeadForm.fullName.trim(),
      companyName: partnerLeadForm.companyName.trim(),
      email: partnerLeadForm.email.trim(),
      phone: partnerLeadForm.phone.trim() || null,
      telegram: partnerLeadForm.telegram.trim() || null,
      region: partnerLeadForm.region.trim() || null,
      source: "website" as const,
      interestType: partnerLeadForm.interestType,
      preferredContactMethod: partnerLeadForm.preferredContactMethod,
      interestProducts: partnerLeadForm.interestProducts.trim() || null,
      notes: partnerLeadForm.notes.trim() || null,
    };

    if (payload.fullName.length < 2 || payload.companyName.length < 2 || !payload.email.includes("@")) {
      toast.error("Проверьте обязательные поля", {
        description: "Укажите имя, компанию и корректный email перед отправкой заявки.",
      });
      return;
    }

    if (!hasPartnerConsent) {
      toast.error("Нужно согласие на обработку данных", {
        description: "Подтвердите согласие перед отправкой партнёрской заявки.",
      });
      return;
    }

    const attachments = await Promise.all(
      partnerAttachments.map(async (item) => {
        const buffer = await item.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let index = 0; index < bytes.length; index += 1) {
          binary += String.fromCharCode(bytes[index]);
        }

        return {
          name: item.name,
          size: item.size,
          mimeType: item.mimeType,
          base64: btoa(binary),
        };
      })
    );

    await createPartnerLead.mutateAsync({
      ...payload,
      attachments,
    });
  };

  const LatestStatusIcon = latestSubmissionStatus.icon;

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),rgba(244,240,232,0.48)_35%,rgba(235,230,220,0)_70%)] pt-28 pb-16 md:pt-34 md:pb-24">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden>
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="container relative">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-sm text-primary shadow-sm backdrop-blur"
              >
                <Leaf className="h-4 w-4" />
                Первый в России клуб персонального фермерства
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-6 max-w-2xl font-display text-5xl leading-[0.95] text-foreground md:text-7xl"
              >
                Выберите животное,
                <span className="block text-primary">а потом войдите в его фермерскую историю.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground"
              >
                <strong className="text-foreground">Шерь Козу</strong> помогает сначала понять идею персонального фермерства,
                затем открыть галерею животных, выбрать конкретную козу или овцу и только после этого перейти к профилю,
                долям, продуктам и клубному опыту без лишнего шума на первом экране.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
              >
                <Link href="/animals" className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95">
                  Открыть галерею животных
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href={featuredAnimalProfileHref} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-7 py-4 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                  Открыть профиль {featuredAnimalName}
                  <ChevronRight className="h-4 w-4" />
                </Link>
                {isAuthenticated ? (
                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-secondary/70 px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary">
                    Открыть дашборд владельца
                    <Sparkles className="h-4 w-4" />
                  </Link>
                ) : (
                  <button type="button" onClick={openAuthRegister} className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-secondary/70 px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary">
                    Стать участником
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
                <a href="#partner-pilot" className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/70 px-7 py-4 text-sm font-semibold text-stone-700 backdrop-blur transition-colors hover:bg-white">
                  Стать партнёром
                  <Building2 className="h-4 w-4" />
                </a>
              </motion.div>

              <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                {signals.map((signal, index) => (
                  <motion.div
                    key={signal.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.45, delay: 0.15 + index * 0.08 }}
                    className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-[0_22px_50px_-38px_rgba(25,35,28,0.45)] backdrop-blur"
                  >
                    <div className="text-2xl font-semibold tracking-tight text-foreground">{signal.value}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">{signal.label}</div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                id="animal-gallery"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.55, delay: 0.22 }}
                className="mt-12 rounded-[2rem] border border-border/65 bg-white/82 p-6 shadow-[0_28px_80px_-50px_rgba(33,29,24,0.45)] backdrop-blur"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                      Галерея животных
                    </div>
                    <h3 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                      Сначала выберите тип животного, затем откройте его профиль так же подробно, как профиль Марты.
                    </h3>
                    <p className="text-sm leading-7 text-muted-foreground md:text-base">
                      Галерея разделена на две понятные зоны: козы и овцы. Внутри каждой — компактные карточки с аватаркой, статусом и именем.
                      Любая карточка ведёт в полный профиль животного с историей, визуалами и параметрами участия.
                    </p>
                  </div>
                  <Link href="/animals" className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-100">
                    Открыть всю галерею животных
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <Link href="/animals#goats" className="group rounded-[1.75rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-[#fff5dd] p-5 transition-transform duration-300 hover:-translate-y-1">
                    <div className="flex items-start gap-4">
                      <img src={CDN.goat} alt="Козы Sher Kozu" className="h-24 w-20 rounded-2xl object-cover" />
                      <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-medium text-amber-900">
                          Козы
                        </div>
                        <h4 className="text-2xl font-semibold text-foreground">Энергичные, контактные, с ярким премиальным профилем</h4>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Подборка коз для семей, которым важны характер, молочный потенциал и узнаваемая визуальная идентичность профиля.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3 text-sm text-stone-700">
                      <span>Перейти в раздел коз</span>
                      <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </Link>

                  <Link href="/animals#sheep" className="group rounded-[1.75rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-[#eefbf4] p-5 transition-transform duration-300 hover:-translate-y-1">
                    <div className="flex items-start gap-4">
                      <img src={CDN.family} alt="Овцы Sher Kozu" className="h-24 w-20 rounded-2xl object-cover" />
                      <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-900">
                          Овцы
                        </div>
                        <h4 className="text-2xl font-semibold text-foreground">Овцы как более спокойный и рациональный путь в выбор</h4>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Отдельная витрина помогает сравнить животных без визуального шума и быстро открыть полный профиль там, где решение строится на статусе, доле и маршруте владения.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3 text-sm text-stone-700">
                      <span>Перейти в раздел овец</span>
                      <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </Link>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="relative"
            >
              <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-card shadow-[0_30px_70px_-35px_rgba(33,30,24,0.35)]">
                  <img src={CDN.hero} alt="Семейная ферма Шерь Козу" className="h-[520px] w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/85 via-dark-oak/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                      <MapPin className="h-3.5 w-3.5" />
                      Семейная ферма в живом цифровом формате
                    </div>
                    <h2 className="mt-3 font-display text-3xl leading-none md:text-4xl">Ваше участие начинается с одного живого существа.</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-white/78">
                      Визуальный слой теперь показывает не абстрактный rural lifestyle, а премиальную семейную ферму с личным присутствием и атмосферой редкости.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <img src={CDN.goat} alt={`${featuredAnimalSpeciesLabel} ${featuredAnimalName}`} className="h-28 w-24 rounded-2xl object-cover object-center" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">Животное недели</p>
                        <h3 className="mt-2 text-2xl font-semibold text-foreground">{featuredAnimalSpeciesLabel} {featuredAnimalName}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{featuredAnimalBreed}, {featuredAnimalAgeLabel}, мягкий темперамент, выразительный профиль и высокий премиальный потенциал продуктовой линии.</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <AnimalShareCard
                        statusLabel={featuredAnimal ? (featuredAnimalAvailablePercent === 0 ? "Полностью распределено" : featuredAnimalAvailablePercent <= featuredAnimalShareUnitPercent * 2 ? "Осталось мало долей" : "Доступно для выбора") : "Выбор доли"}
                        statusClassName={featuredAnimalAvailablePercent === 0 ? "border-stone-300 bg-stone-100 text-stone-700" : featuredAnimalAvailablePercent <= featuredAnimalShareUnitPercent * 2 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}
                        name={featuredAnimal?.name ?? "Животное недели"}
                        breedLabel={featuredAnimal?.breed ?? "Sher Kozu"}
                        priceLabel={new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format((featuredAnimal?.fullPriceMinor ?? 0) / 100)}
                        occupiedPercent={featuredAnimalOwnedPercent}
                        availablePercent={featuredAnimalAvailablePercent}
                        shareUnitPercent={featuredAnimalShareUnitPercent}
                        primarySharePercent={featuredAnimalPrimarySharePercent}
                        primarySharePriceLabel={new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(featuredAnimalPrimarySharePriceMinor / 100)}
                        availableSharePercents={featuredAnimalAvailableSharePercents}
                        helperText={`Карточка на главной теперь ведёт в тот же сценарий, что и в каталоге: свободные доли шагом ${featuredAnimalShareUnitPercent}% и один основной CTA в профиле животного.`}
                        description={`Сначала вы видите статус и стартовую долю ${featuredAnimal?.name ?? "животного"}, затем переходите в профиль с теми же ценой, доступностью и следующим шагом.`}
                        ctaLabel="Открыть профиль и продолжить с выбранной долей"
                        ctaHref={`${featuredAnimalProfileHref}?share=${featuredAnimalPrimarySharePercent}`}
                        title="Один и тот же сценарий выбора доли на всей витрине"
                        eyebrow="Статус, доля и цена"
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">

                    <img src={CDN.milk} alt="Именные молочные продукты" className="h-48 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary">Продуктовый слой</p>
                      <h3 className="mt-2 text-xl font-semibold text-foreground">Именная коробка делает происхождение зримым.</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Пользователь видит не просто молочную продукцию, а красиво упакованный результат своей связи с конкретным животным и конкретной фермой.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-18 md:py-24">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Core conversion spine</p>
              <h2 className="mt-4 max-w-xl font-display text-4xl text-foreground md:text-5xl">
                Главная теперь объясняет не «всё обо всём», а один ясный сценарий: понять продукт, выбрать животное, увидеть долю, войти во владение.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Это и есть основной consumer flow Sher Kozu на текущем этапе. Пользователь должен пройти его последовательно, не смешивая вдохновляющий слой бренда,
                логику выбора в каталоге и следующий шаг участия после выбора животного.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="#animal-gallery" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_32px_-20px_rgba(26,58,42,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95">
                  Перейти к галерее на странице
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/animals" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                  Открыть весь каталог животных
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.07 }}
                    className="grid gap-4 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:grid-cols-[88px_minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="font-mono-data text-xs uppercase tracking-[0.24em] text-primary/70">Шаг {step.index}</div>
                      <h3 className="mt-1 text-xl font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{step.text}</p>
                    </div>
                    <div className="text-left font-display text-4xl leading-none text-primary/15 md:text-right md:text-5xl">{step.index}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/45 py-18 md:py-24">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-card shadow-sm">
              <img src={CDN.club} alt="Семья на клубном визите" className="h-full min-h-[360px] w-full object-cover" />
            </div>
            <div>
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Почему пользователь доходит до решения</p>
                <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">Решение о доле становится легче, когда ценность считывается как личная, прозрачная и продолжимая после оплаты.</h2>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {values.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.06 }}
                      className="min-w-0 rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-sm md:p-6"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="partner-pilot" className="py-14 md:py-18">
        <div className="container max-w-5xl">
          <div className="mb-6 flex flex-col gap-3 rounded-[2rem] border border-stone-200/80 bg-stone-50/70 px-5 py-5 text-sm text-stone-600 shadow-sm md:flex-row md:items-center md:justify-between md:px-7">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600">
                <Building2 className="h-3.5 w-3.5" />
                B2B и партнёрства
              </div>
              <p className="text-base font-semibold text-stone-900">Для retail, HoReCa и дистрибуции мы оставили отдельный компактный вход.</p>
              <p className="leading-6 text-stone-600">
                Этот блок вторичен по отношению к consumer-сценарию: он нужен тем, кто уже пришёл с коммерческим запросом и хочет быстро отправить материалы команде Sher Kozu.
              </p>
            </div>
            <a href="#partner-lead-form" className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-100">
              Открыть партнёрскую форму
              <ChevronDown className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <Card className="border-stone-200 bg-stone-50/80 shadow-none xl:self-start">
              <CardHeader className="space-y-3 pb-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600">
                  <Building2 className="h-3.5 w-3.5" />
                  Партнёрский вход
                </div>
                <CardTitle className="text-2xl text-stone-900">Коммерческий запрос для Sher Kozu</CardTitle>
                <CardDescription className="max-w-lg text-sm leading-6 text-stone-600">
                  Если вам нужен опт, ресторанный формат или коллаборация, оставьте короткую заявку. Мы сохранили эту точку входа компактной, чтобы она не конкурировала с выбором животного на главной.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm text-stone-700">
                <div className="space-y-3 rounded-2xl border border-white/80 bg-white/90 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-stone-900">Что происходит после отправки</p>
                      <p className="mt-1 leading-6 text-stone-600">Заявка создаётся в системе Sher Kozu и уходит в CRM, чтобы менеджер быстро забрал её в работу.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-amber-700" />
                    <div>
                      <p className="font-semibold text-stone-900">Когда ждать ответ</p>
                      <p className="mt-1 leading-6 text-stone-600">Обычно первичный ответ приходит в течение одного рабочего дня после квалификации запроса.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white/80 p-4 text-xs leading-6 text-stone-500">
                  Для быстрого старта достаточно имени, компании, email и короткого описания запроса. Остальные материалы можно приложить сразу или дослать позже.
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200 bg-white/95 shadow-sm">
              <CardHeader className="space-y-3 pb-4">
                <CardTitle className="text-2xl text-stone-950">Короткая партнёрская заявка</CardTitle>
                <CardDescription className="text-sm leading-6 text-stone-600">
                  Форма остаётся доступной для коммерческих запросов, но оформлена как вторичный инструмент после consumer-сценария выбора животного.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div id="partner-lead-form" className="rounded-[1.75rem] border border-stone-200 bg-white/90 p-5 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="partner-full-name">Имя и фамилия</Label>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
                        <Input id="partner-full-name" className="pl-10" value={partnerLeadForm.fullName} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Алексей Иванов" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partner-company">Компания</Label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
                        <Input id="partner-company" className="pl-10" value={partnerLeadForm.companyName} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="ООО Премиум Ритейл" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partner-email">Email</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
                        <Input id="partner-email" type="email" className="pl-10" value={partnerLeadForm.email} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, email: event.target.value }))} placeholder="buyer@company.kz" />
                      </div>
                      {!isPartnerEmailValid ? (
                        <p className="text-xs text-rose-600">Укажите email в формате name@company.com.</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partner-phone">Телефон</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
                        <Input id="partner-phone" className="pl-10" value={partnerLeadForm.phone} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, phone: formatPartnerPhoneInput(event.target.value) }))} placeholder="+7 701 000 00 00" />
                      </div>
                      {!isPartnerPhoneValid ? (
                        <p className="text-xs text-rose-600">Телефон должен содержать не меньше 7 символов и состоять из цифр, пробелов или знаков +()-.</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partner-region">Регион</Label>
                      <Input id="partner-region" value={partnerLeadForm.region} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, region: event.target.value }))} placeholder="Алматы" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partner-telegram">Telegram</Label>
                      <Input id="partner-telegram" value={partnerLeadForm.telegram} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, telegram: event.target.value }))} placeholder="@alex_partner" />
                    </div>
                    <div className="space-y-2">
                      <Label>Тип партнёрства</Label>
                      <Select value={partnerLeadForm.interestType} onValueChange={(value: PartnerLeadFormState["interestType"]) => setPartnerLeadForm((current) => ({ ...current, interestType: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите направление" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="horeca">HoReCa</SelectItem>
                          <SelectItem value="distribution">Дистрибуция</SelectItem>
                          <SelectItem value="collaboration">Коллаборация</SelectItem>
                          <SelectItem value="other">Другое</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Предпочтительный канал</Label>
                      <Select value={partnerLeadForm.preferredContactMethod} onValueChange={(value: PartnerLeadFormState["preferredContactMethod"]) => setPartnerLeadForm((current) => ({ ...current, preferredContactMethod: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Как лучше связаться" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Телефон</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                          <SelectItem value="any">Любой канал</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">Готовность заявки</p>
                        <p className="mt-1 text-xs leading-5 text-stone-500">Показывает, можно ли отправлять форму без дополнительных исправлений.</p>
                      </div>
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700">{partnerFormProgressPercent}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${partnerFormProgressPercent}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className={`rounded-xl px-3 py-2 text-xs ${partnerRequiredFieldsFilled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
                        Имя, компания и email заполнены корректно
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs ${isPartnerPhoneValid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        Телефон соответствует базовому формату
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs ${hasPartnerConsent ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
                        Согласие на обработку данных подтверждено
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="partner-products">Интересующие продукты</Label>
                    <Input id="partner-products" value={partnerLeadForm.interestProducts} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, interestProducts: event.target.value }))} placeholder="Молоко A2, крафтовые сыры, branded boxes" />
                  </div>

                   <div className="mt-4 space-y-2">
                    <Label htmlFor="partner-notes">Комментарий</Label>
                    <Textarea id="partner-notes" className="min-h-28" value={partnerLeadForm.notes} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Опишите формат поставки, объёмы или совместную идею." />
                  </div>
                  <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label htmlFor="partner-attachments" className="text-sm font-medium text-stone-900">Файлы для заявки</Label>
                        <div className="mt-2 space-y-2 text-xs leading-5 text-stone-500">
                          <p>
                            Можно приложить до {MAX_PARTNER_FILES} файлов размером до {formatAttachmentSize(MAX_PARTNER_FILE_SIZE_BYTES)} каждый: реквизиты, презентацию, прайс или PDF-коммерческое предложение.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">Документы: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV</span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Изображения: JPG, PNG, WEBP, SVG</span>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">Архивы: ZIP, RAR, 7Z</span>
                          </div>
                          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3 text-xs leading-5 text-stone-700">
                            <p className="font-semibold text-stone-900">{partnerAttachmentRecommendation.title}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {partnerAttachmentRecommendation.items.map((item) => (
                                <span key={item} className="rounded-full border border-primary/15 bg-white px-2.5 py-1 text-stone-700">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Upload className="mt-0.5 h-5 w-5 text-stone-400" />
                    </div>
                    <label
                      htmlFor="partner-attachments"
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsPartnerDragActive(true);
                      }}
                      onDragLeave={() => setIsPartnerDragActive(false)}
                      onDrop={handlePartnerAttachmentDrop}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition-colors ${isPartnerDragActive ? "border-primary bg-primary/5" : "border-stone-300 bg-white"} ${createPartnerLead.isPending ? "pointer-events-none opacity-60" : "hover:border-primary/40 hover:bg-stone-50"}`}
                    >
                      <Upload className={`mb-2 h-5 w-5 ${isPartnerDragActive ? "text-primary" : "text-stone-400"}`} />
                      <span className="text-sm font-medium text-stone-800">Перетащите файлы сюда или нажмите, чтобы выбрать</span>
                      <span className="mt-1 text-xs text-stone-500">Поддерживаются документы, изображения и архивы. Зона работает и для drag-and-drop.</span>
                    </label>
                    <Input id="partner-attachments" type="file" accept={PARTNER_ATTACHMENT_ACCEPT} multiple onChange={handlePartnerAttachmentSelect} className="sr-only" disabled={createPartnerLead.isPending} />
                    <div className="space-y-3">
                      {partnerAttachmentWarning ? (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>{partnerAttachmentWarning}</p>
                        </div>
                      ) : null}
                      {isPartnerAttachmentsNearTotalLimit && partnerAttachments.length ? (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>Вы близки к суммарному лимиту вложений: осталось {formatAttachmentSize(partnerAttachmentsRemainingSize)}.</p>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm font-medium text-stone-800">Выбранные вложения</p>
                          <span className="text-xs text-stone-500">{partnerAttachments.length} шт.</span>
                          <span className="text-xs text-stone-400">{formatAttachmentSize(partnerAttachmentsTotalSize)}</span>
                          <span className="text-xs text-stone-400">Осталось файлов: {partnerAttachmentsRemainingSlots}</span>
                          <span className="text-xs text-stone-400">Осталось объёма: {formatAttachmentSize(partnerAttachmentsRemainingSize)}</span>
                        </div>
                        {partnerAttachments.length ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-2 py-1 text-xs text-stone-500 hover:text-rose-700"
                            onClick={() => {
                              const clearedCount = partnerAttachments.length;
                              if (clearedCount > 1) {
                                const confirmed = window.confirm("Удалить все выбранные вложения? Это действие нельзя отменить.");
                                if (!confirmed) {
                                  return;
                                }
                              }
                              const clearedSize = partnerAttachments.reduce((total, item) => total + item.size, 0);
                              setPartnerAttachments([]);
                              setPartnerAttachmentWarning(null);
                              toast.success(
                                clearedCount > 1
                                  ? `Список вложений очищен: ${clearedCount} файл(ов)`
                                  : "Вложение удалено из списка",
                                {
                                  description: `Удалено ${formatAttachmentSize(clearedSize)} материалов из черновика заявки.`,
                                }
                              );
                            }}
                          >
                            Очистить все вложения
                          </Button>
                        ) : null}
                      </div>
                      {partnerAttachments.length ? (
                        <div className="space-y-2">
                          {partnerAttachments.map((item) => {
                            const attachmentKind = getPartnerAttachmentKind(item.mimeType, item.name);
                            const attachmentBadge = getPartnerAttachmentBadge(attachmentKind);
                            const AttachmentIcon = attachmentBadge.icon;

                            return (
                              <div key={`${item.name}-${item.size}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {item.previewUrl ? (
                                    <img src={item.previewUrl} alt={`Превью файла ${item.name}`} className="h-12 w-12 rounded-xl border border-stone-200 object-cover" />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate font-medium text-stone-800">{item.name}</p>
                                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${attachmentBadge.className}`}>
                                        <AttachmentIcon className="h-3 w-3" />
                                        {attachmentBadge.label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-stone-500">{formatAttachmentSize(item.size)} · {item.mimeType}</p>
                                  </div>
                                </div>
                                <Button type="button" variant="ghost" className="shrink-0 text-rose-600 hover:text-rose-700" onClick={() => removePartnerAttachment(item.name, item.size)} aria-label={`Удалить файл ${item.name}`} disabled={createPartnerLead.isPending}>
                                  Удалить
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-500">
                          Файлы пока не выбраны. После выбора они появятся в списке ниже, и каждый файл можно будет удалить до отправки заявки.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary"
                        checked={hasPartnerConsent}
                        onChange={(event) => setHasPartnerConsent(event.target.checked)}
                        disabled={createPartnerLead.isPending}
                      />
                      <span className="leading-6">
                        Подтверждаю согласие на обработку контактных данных для связи по партнёрской заявке и передачи информации в CRM-процесс Sher Kozu.
                      </span>
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs leading-6 text-stone-500">
                          Отправляя форму, вы инициируете pilot-сценарий двусторонней интеграции Sher Kozu ↔ Bitrix24 только для партнёрских заявок.
                        </p>
                        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          <Clock3 className="h-3.5 w-3.5" />
                          Обычно первичный ответ менеджера приходит в течение 1 рабочего дня после квалификации заявки.
                        </div>
                        {createPartnerLead.isPending ? (
                          <p className="text-xs font-medium text-primary">Заявка отправляется, пожалуйста не закрывайте страницу и не меняйте список вложений.</p>
                        ) : null}
                      </div>
                      <Button type="button" onClick={() => void handlePartnerLeadSubmit()} disabled={createPartnerLead.isPending || !hasPartnerConsent} className="rounded-full px-6">
                        {createPartnerLead.isPending ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Отправляем в CRM...
                          </span>
                        ) : "Отправить партнёрскую заявку"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="border-stone-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-stone-950">FAQ для партнёров</CardTitle>
                  <CardDescription className="text-stone-600">
                    Короткие ответы на вопросы, которые чаще всего тормозят отправку первой заявки.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-stone-700">
                  {[
                    {
                      id: "materials",
                      question: "Какие материалы лучше приложить?",
                      answer: "Лучше всего работают прайс, краткая презентация компании, реквизиты и примеры формата сотрудничества.",
                    },
                    {
                      id: "files",
                      question: "Обязательно ли прикладывать файлы?",
                      answer: "Нет, заявку можно отправить и без вложений. Но документы и визуалы помогают менеджеру быстрее оценить формат пилота.",
                    },
                    {
                      id: "timing",
                      question: "Когда ждать ответ?",
                      answer: "После синхронизации с CRM менеджер получает заявку и связывается по выбранному каналу, как правило, после первичной квалификации.",
                    },
                  ].map((item) => {
                    const isOpen = openPartnerFaqItem === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setOpenPartnerFaqItem((current) => (current === item.id ? null : item.id))}
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left transition-colors hover:bg-stone-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-stone-900">{item.question}</p>
                          <ChevronDown className={`h-4 w-4 text-stone-500 transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                        </div>
                        <div className={`grid transition-all duration-200 ${isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70"}`}>
                          <div className="overflow-hidden">
                            <p className="leading-6 text-stone-600">{item.answer}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
              <Card className="border-stone-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-stone-950">Последняя заявка и статус pilot-синхронизации</CardTitle>
                  <CardDescription className="text-stone-600">
                    После отправки здесь сразу показывается, попала ли заявка в Bitrix24 и какие поля уже вернулись назад из CRM.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {latestSubmission ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${latestSubmissionStatus.className}`}>
                          <LatestStatusIcon className="h-3.5 w-3.5" />
                          {latestSubmissionStatus.label}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                          Lead ID: {latestSubmission.id}
                        </span>
                        {latestSubmission.bitrixDealId ? (
                          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                            Deal ID: {latestSubmission.bitrixDealId}
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Назначенный менеджер</p>
                          <p className="mt-2 text-sm font-semibold text-stone-950">{latestSubmission.assignedManagerName || "Будет подтянут после обработки в CRM"}</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Следующая активность</p>
                          <p className="mt-2 text-sm font-semibold text-stone-950">
                            {latestSubmission.nextActivityAt ? new Date(latestSubmission.nextActivityAt).toLocaleString("ru-RU") : "Пока не назначена"}
                          </p>
                        </div>
                      </div>

                      {latestSubmission.lastSyncError ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                          <p className="font-semibold">Последняя ошибка синхронизации</p>
                          <p className="mt-2 leading-6">{latestSubmission.lastSyncError}</p>
                          <p className="mt-2 text-xs leading-5 text-rose-700/80">Администратор может повторить отправку и обновить snapshot сделки в панели управления CRM.</p>
                        </div>
                      ) : null}
                      {latestSubmission.attachmentsJson ? (
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                          К этой заявке прикреплены файлы: ссылки на них сохранены и передаются в Bitrix24 вместе с CRM-комментарием.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-stone-200 bg-stone-50/80 px-5 py-8 text-sm leading-7 text-stone-500">
                      Пока ещё нет отправленной партнёрской заявки в текущей сессии. Заполните форму слева, и здесь появится live-статус интеграции с Bitrix24.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-stone-950">Что видит администратор</CardTitle>
                  <CardDescription className="text-stone-600">
                    Внутри админ-панели pilot-мониторинг показывает заявки, аудиты интеграции, статусы retry и back-sync поля CRM.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-stone-600">
                  <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-stone-950">Интеграционный аудит</p>
                      <p className="mt-1 leading-6">Каждая отправка, повтор и pull snapshot фиксируются как отдельные audit-записи для быстрой диагностики.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                    <div>
                      <p className="font-semibold text-stone-950">Retry без дублей</p>
                      <p className="mt-1 leading-6">Повторная отправка запускается вручную только для нужной заявки, а idempotency держится на стороне Sher Kozu lead record.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div>
                      <p className="font-semibold text-stone-950">Back-sync полей CRM</p>
                      <p className="mt-1 leading-6">Стадия сделки, ответственный менеджер и next activity возвращаются в Sher Kozu для управленческого контроля.</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Link href="/admin/club" className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80">
                      Открыть админ-панель
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-18 md:py-24">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Что происходит после выбора</p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl text-foreground md:text-5xl">Лендинг должен не обрывать интерес, а направлять его в правильный следующий слой продукта.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                После каталога и профиля пользователь может пойти в разные сценарии: кабинет владельца, трекер происхождения продукта, клубный слой или обратно в профиль животного.
                Главная страница должна заранее объяснять эти маршруты, чтобы внутри продукта не возникало тупиков.
              </p>

              <div className="mt-8 grid gap-4">
                {ecosystemRoutes.map((route, index) => {
                  const Icon = route.icon;
                  return (
                    <Link key={route.title} href={route.href} className="group block">
                      <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.06 }}
                        className="flex flex-col items-start gap-4 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg sm:flex-row"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-semibold text-foreground">{route.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{route.text}</p>
                        </div>
                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 sm:self-start" />
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid gap-4"
            >
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
                <img src={CDN.family} alt="Семейная ферма на закате" className="h-72 w-full object-cover" />
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Атмосфера бренда</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">Семейная ферма остаётся человеческой по масштабу, но цифровой по качеству опыта.</p>
                  <div className="mt-4 space-y-2">
                    {atmosphereNotes.map((note) => (
                      <div key={note} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Star className="mt-0.5 h-4 w-4 text-accent" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-dark-oak p-5 text-white shadow-[0_24px_60px_-35px_rgba(20,18,16,0.7)] md:p-6">
                <div className="flex items-center gap-2 text-amber-300">
                  <Bot className="h-5 w-5" />
                  <span className="text-sm font-medium">Следующий слой ценности</span>
                </div>
                <h3 className="mt-4 font-display text-3xl">Следующий слой после стабилизации конверсии</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  AI-куратор, storyteller-логика и голос животного остаются сильным следующим шагом, но теперь они показаны как надстройка над уже понятным conversion spine,
                  а не как конкурирующая идея на первом экране.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/60">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Основа для Sprint 2 готова
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Точки входа для AI уже заложены
                  </span>
                </div>
                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/8 p-4 text-sm text-white/78">
                  Первая версия MVP должна прежде всего доводить до понятного выбора животного и доли, а затем уже мягко расширять опыт в клуб, трекер и кабинет владельца без разрывов маршрута.
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="container">
          <div className="overflow-hidden rounded-[2.25rem] border border-border/70 bg-[linear-gradient(135deg,rgba(26,58,42,0.96),rgba(45,70,54,0.92))] px-6 py-8 text-white shadow-[0_34px_80px_-45px_rgba(26,58,42,0.8)] md:px-10 md:py-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Выберите свой сценарий продолжения</p>
                <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">Если вы уже поняли механику, следующий шаг должен быть предельно конкретным: каталог, профиль, кабинет или клуб.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
                  Финальный блок теперь работает как развилка после понимания модели: перейти к выбору животного, вернуться к галерее на странице,
                  открыть кабинет владельца или посмотреть клубный слой как продолжение membership-опыта.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/animals" className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-7 py-4 text-sm font-semibold text-stone-950 transition-colors hover:bg-amber-200">
                  Открыть галерею животных
                  <Heart className="h-4 w-4" />
                </Link>
                <Link href="#animal-gallery" className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/85 px-7 py-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100">
                  Перейти к разделу галереи на странице
                  <ChevronDown className="h-4 w-4" />
                </Link>
                {isAuthenticated ? (
                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-white/95">
                    Перейти в кабинет
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button type="button" onClick={openAuthRegister} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-white/95">
                    Стать участником
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <Link href="/club" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Открыть клубную ленту
                  <Users className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultView={authModalView}
      />
    </div>
  );
}
