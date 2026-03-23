/*
  Partners.tsx — Partner Program Page

  Dedicated page for B2B partnerships (retail, HoReCa, distribution, collaboration).
  Contains:
  - Hero section explaining the partner program
  - CRM lead form with validation, drag-drop attachments
  - FAQ for partners
  - Live sync status with Bitrix24
  - Navigation back to main site

  Moved from Home.tsx to keep the main page focused on consumer journey.
*/

import { trpc } from "@/lib/trpc";
import ScrollRemaining from "@/components/ScrollRemaining";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Archive,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  ImageIcon,
  Leaf,
  Loader2,
  Mail,
  Phone,
  RefreshCcw,
  TriangleAlert,
  Upload,
  UserRound,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";

/* ─── Types ─── */

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

/* ─── Constants ─── */

const MAX_PARTNER_FILES = 3;
const MAX_PARTNER_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PARTNER_TOTAL_SIZE_BYTES = 20 * 1024 * 1024;
const PARTNER_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.svg,.zip,.rar,.7z";

/* ─── Helpers ─── */

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
  interestProducts: "Молоко, именные сыры, сезонные наборы",
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

/* ─── Component ─── */

export default function Partners() {
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
          description: "Заявка синхронизирована с Bitrix24. Менеджер получит материалы и свяжется с вами по выбранному каналу.",
        });
      } else {
        toast.error("Заявка сохранена, но CRM требует повторной синхронизации", {
          description: result.errorMessage ?? "Проверьте статус в админ-панели Bitrix24.",
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

  const appendPartnerAttachments = useCallback((incomingFiles: File[]) => {
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
  }, []);

  const formatPartnerPhoneInput = useCallback((value: string) => {
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
  }, []);

  const handlePartnerAttachmentSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    appendPartnerAttachments(Array.from(event.target.files ?? []));
    event.target.value = "";
  }, [appendPartnerAttachments]);

  const removePartnerAttachment = useCallback((name: string, size: number) => {
    setPartnerAttachments((current) => {
      const target = current.find((item) => item.name === name && item.size === size);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => !(item.name === name && item.size === size));
    });
    setPartnerAttachmentWarning(null);
  }, []);

  const handlePartnerAttachmentDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsPartnerDragActive(false);
    appendPartnerAttachments(Array.from(event.dataTransfer.files ?? []));
  }, [appendPartnerAttachments]);

  const handlePartnerLeadSubmit = useCallback(async () => {
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
  }, [partnerLeadForm, partnerAttachments, hasPartnerConsent, createPartnerLead]);

  const LatestStatusIcon = latestSubmissionStatus.icon;

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      {/* ═══════════════════════════════════════════════════════
          HERO — Partner Program Introduction
          ═══════════════════════════════════════════════════════ */}
      <section className="relative border-b border-border/60 bg-stone-50/60 pt-28 pb-14 md:pt-36 md:pb-18">
        <div className="container max-w-5xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Вернуться на главную
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 shadow-sm">
              <Building2 className="h-4 w-4" />
              B2B и партнёрства
            </div>

            <h1 className="mt-6 font-display text-4xl text-foreground md:text-5xl">
              Партнёрская программа{" "}
              <span className="text-primary">Шерь Козу</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Рестораны, магазины, отели и корпоративные клиенты — мы создаём уникальные продуктовые решения на основе элитных пород с прозрачной историей происхождения. Оставьте заявку — менеджер свяжется с вами в течение одного рабочего дня.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT — Form + Sidebar
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 md:py-18">
        <div className="container max-w-5xl">
          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            {/* Left sidebar: info */}
            <Card className="border-stone-200 bg-stone-50/80 shadow-none xl:self-start">
              <CardHeader className="space-y-3 pb-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600">
                  <Building2 className="h-3.5 w-3.5" />
                  Партнёрский вход
                </div>
                <CardTitle className="text-2xl text-stone-900">Коммерческий запрос</CardTitle>
                <CardDescription className="max-w-lg text-sm leading-6 text-stone-600">
                  Если вам нужен опт, ресторанный формат или коллаборация, оставьте короткую заявку.
                  Мы ответим в течение одного рабочего дня.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm text-stone-700">
                <div className="space-y-3 rounded-2xl border border-white/80 bg-white/90 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-stone-900">Что происходит после отправки</p>
                      <p className="mt-1 leading-6 text-stone-600">Заявка создаётся в системе и уходит в CRM, чтобы менеджер быстро забрал её в работу.</p>
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

            {/* Right: form */}
            <Card className="border-stone-200 bg-white/95 shadow-sm">
              <CardHeader className="space-y-3 pb-4">
                <CardTitle className="text-2xl text-stone-950">Партнёрская заявка</CardTitle>
                <CardDescription className="text-sm leading-6 text-stone-600">
                  Заполните форму, и мы свяжемся с вами для обсуждения деталей сотрудничества.
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

                  {/* Progress indicator */}
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
                        Имя, компания и email заполнены
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs ${isPartnerPhoneValid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        Телефон в корректном формате
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs ${hasPartnerConsent ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
                        Согласие на обработку данных
                      </div>
                    </div>
                  </div>

                  {/* Products & notes */}
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="partner-products">Интересующие продукты</Label>
                    <Input id="partner-products" value={partnerLeadForm.interestProducts} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, interestProducts: event.target.value }))} placeholder="Молоко A2, крафтовые сыры, branded boxes" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="partner-notes">Комментарий</Label>
                    <Textarea id="partner-notes" className="min-h-28" value={partnerLeadForm.notes} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Опишите формат поставки, объёмы или совместную идею." />
                  </div>

                  {/* Attachments */}
                  <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label htmlFor="partner-attachments" className="text-sm font-medium text-stone-900">Файлы для заявки</Label>
                        <div className="mt-2 space-y-2 text-xs leading-5 text-stone-500">
                          <p>
                            Можно приложить до {MAX_PARTNER_FILES} файлов размером до {formatAttachmentSize(MAX_PARTNER_FILE_SIZE_BYTES)} каждый.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">Документы: PDF, DOC, XLS, PPT, TXT</span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Изображения: JPG, PNG, WEBP</span>
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
                      <span className="mt-1 text-xs text-stone-500">Поддерживаются документы, изображения и архивы.</span>
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
                          <span className="text-xs text-stone-400">Осталось: {partnerAttachmentsRemainingSlots} файл(ов), {formatAttachmentSize(partnerAttachmentsRemainingSize)}</span>
                        </div>
                        {partnerAttachments.length ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-2 py-1 text-xs text-stone-500 hover:text-rose-700"
                            onClick={() => {
                              const clearedCount = partnerAttachments.length;
                              if (clearedCount > 1) {
                                const confirmed = window.confirm("Удалить все выбранные вложения?");
                                if (!confirmed) return;
                              }
                              const clearedSize = partnerAttachments.reduce((total, item) => total + item.size, 0);
                              setPartnerAttachments([]);
                              setPartnerAttachmentWarning(null);
                              toast.success(
                                clearedCount > 1
                                  ? `Список вложений очищен: ${clearedCount} файл(ов)`
                                  : "Вложение удалено из списка",
                                { description: `Удалено ${formatAttachmentSize(clearedSize)} материалов.` }
                              );
                            }}
                          >
                            Очистить все
                          </Button>
                        ) : null}
                      </div>
                      {partnerAttachments.length ? (
                        <ScrollRemaining totalItems={partnerAttachments.length} itemHeight={60} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {partnerAttachments.map((item) => {
                            const attachmentKind = getPartnerAttachmentKind(item.mimeType, item.name);
                            const attachmentBadge = getPartnerAttachmentBadge(attachmentKind);
                            const AttachmentIcon = attachmentBadge.icon;

                            return (
                              <div key={`${item.name}-${item.size}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {item.previewUrl ? (
                                    <img src={item.previewUrl} alt={`Превью ${item.name}`} className="h-12 w-12 rounded-xl border border-stone-200 object-cover" />
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
                        </ScrollRemaining>
                      ) : (
                        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-500">
                          Файлы пока не выбраны. После выбора они появятся здесь.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consent + Submit */}
                  <div className="mt-4 space-y-4">
                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary"
                        checked={hasPartnerConsent}
                        onChange={(event) => setHasPartnerConsent(event.target.checked)}
                        disabled={createPartnerLead.isPending}
                      />
                      <span className="leading-6">
                        Подтверждаю согласие на обработку контактных данных для связи по партнёрской заявке и передачи информации в CRM-процесс Шерь Козу.
                      </span>
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          <Clock3 className="h-3.5 w-3.5" />
                          Обычно первичный ответ менеджера приходит в течение 1 рабочего дня.
                        </div>
                        {createPartnerLead.isPending ? (
                          <p className="text-xs font-medium text-primary">Заявка отправляется, пожалуйста не закрывайте страницу.</p>
                        ) : null}
                      </div>
                      <Button type="button" onClick={() => void handlePartnerLeadSubmit()} disabled={createPartnerLead.isPending || !hasPartnerConsent} className="rounded-full px-6">
                        {createPartnerLead.isPending ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Отправляем в CRM...
                          </span>
                        ) : "Отправить заявку"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════════════════
              FAQ + STATUS CARDS
              ═══════════════════════════════════════════════════════ */}
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {/* FAQ */}
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
                    answer: "Лучше всего работают прайс, краткая презентация компании, реквизиты и примеры формата сотрудничества. Это поможет менеджеру подобрать оптимальный продуктовый набор из нашей линейки.",
                  },
                  {
                    id: "files",
                    question: "Обязательно ли прикладывать файлы?",
                    answer: "Нет, заявку можно отправить и без вложений. Но документы и визуалы помогают менеджеру быстрее оценить формат пилота.",
                  },
                  {
                    id: "timing",
                    question: "Когда ждать ответ?",
                    answer: "После синхронизации с CRM менеджер получает заявку и связывается по выбранному каналу, как правило, в течение одного рабочего дня.",
                  },
                  {
                    id: "products",
                    question: "Какие продукты доступны для партнёров?",
                    answer: "Козье и овечье молоко от элитных пород (англо-нубийские, альпийские козы, остфризские овцы), именные сыры ручной работы, сезонные подарочные наборы. Формат и объёмы обсуждаются индивидуально.",
                  },
                  {
                    id: "regions",
                    question: "В каких регионах работает доставка?",
                    answer: "Основная логистика — Новорижское направление и Москва. Для других регионов обсуждаем индивидуальные условия доставки.",
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

            {/* Sync status */}
            <Card className="border-stone-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-stone-950">Статус заявки</CardTitle>
                <CardDescription className="text-stone-600">
                  После отправки здесь появится статус синхронизации с CRM.
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
                        <p className="mt-2 text-sm font-semibold text-stone-950">{latestSubmission.assignedManagerName || "Будет подтянут после обработки"}</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Следующая активность</p>
                        <p className="mt-2 text-sm font-semibold text-stone-950">
                          {latestSubmission.nextActivityAt ? new Date(latestSubmission.nextActivityAt as string | number).toLocaleString("ru-RU") : "Пока не назначена"}
                        </p>
                      </div>
                    </div>

                    {latestSubmission.lastSyncError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                        <p className="font-semibold">Последняя ошибка синхронизации</p>
                        <p className="mt-2 leading-6">{latestSubmission.lastSyncError}</p>
                      </div>
                    ) : null}
                    {latestSubmission.attachmentsJson ? (
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                        К этой заявке прикреплены файлы: ссылки сохранены и передаются в Bitrix24 вместе с CRM-комментарием.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-stone-200 bg-stone-50/80 px-5 py-8 text-sm leading-7 text-stone-500">
                    Пока нет отправленной партнёрской заявки. Заполните форму выше, и здесь появится статус интеграции с Bitrix24.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border/60 bg-card py-10">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-display text-lg text-foreground">Шерь Козу</span>
              <span className="text-sm text-muted-foreground">Персональное фермерство</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Главная</Link>
              <Link href="/animals" className="transition-colors hover:text-foreground">Животные</Link>
              <Link href="/club" className="transition-colors hover:text-foreground">Клуб</Link>
              <Link href="/tracker" className="transition-colors hover:text-foreground">Трекер</Link>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Шерь Козу. Семейная ферма персонального фермерства.
          </div>
        </div>
      </footer>
    </div>
  );
}
