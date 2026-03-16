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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Milk,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  Users,
  Camera,
  BookOpen,
  Bot,
  RefreshCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
    href: "/animal/marta",
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
};

const MAX_PARTNER_FILES = 3;
const MAX_PARTNER_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

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
  const [partnerLeadForm, setPartnerLeadForm] = useState<PartnerLeadFormState>(defaultPartnerLeadForm);
  const [partnerAttachments, setPartnerAttachments] = useState<PartnerAttachmentDraft[]>([]);
  const [latestSubmission, setLatestSubmission] = useState<{
    id: number;
    syncStatus: string | null;
    bitrixDealId: string | null;
    assignedManagerName: string | null;
    nextActivityAt: Date | number | string | null;
    lastSyncError: string | null;
    attachmentsJson?: string | null;
  } | null>(null);

  const createPartnerLead = trpc.bitrix24.createPartnerLead.useMutation({
    onSuccess: (result) => {
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
        toast.success("Заявка отправлена в Bitrix24", {
                          description: "Партнёрская заявка создана, синхронизирована с CRM пилота и включает ссылки на прикреплённые файлы.",

        });
      } else {
        toast.error("Заявка сохранена, но CRM требует повторной синхронизации", {
          description: result.errorMessage ?? "Проверьте статус в админ-панели Bitrix24 pilot.",
        });
      }

      setPartnerLeadForm(defaultPartnerLeadForm());
      setPartnerAttachments([]);
    },
    onError: (error) => {
      toast.error("Не удалось отправить партнёрскую заявку", {
        description: error.message,
      });
    },
  });

  const latestSubmissionStatus = useMemo(() => getStatusCopy(latestSubmission?.syncStatus), [latestSubmission?.syncStatus]);

  const handlePartnerAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (!incomingFiles.length) return;

    setPartnerAttachments((current) => {
      const next = [...current];

      for (const file of incomingFiles) {
        if (next.length >= MAX_PARTNER_FILES) {
          toast.error("Достигнут лимит файлов", {
            description: `Можно приложить не более ${MAX_PARTNER_FILES} файлов к одной заявке.`,
          });
          break;
        }

        if (file.size > MAX_PARTNER_FILE_SIZE_BYTES) {
          toast.error("Файл слишком большой", {
            description: `${file.name} превышает лимит ${formatAttachmentSize(MAX_PARTNER_FILE_SIZE_BYTES)}.`,
          });
          continue;
        }

        next.push({
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          file,
        });
      }

      return next;
    });

    event.target.value = "";
  };

  const removePartnerAttachment = (name: string, size: number) => {
    setPartnerAttachments((current) => current.filter((item) => !(item.name === name && item.size === size)));
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
                className="mt-6 max-w-xl font-display text-5xl leading-[0.95] text-foreground md:text-7xl"
              >
                Не подписка на молоко,
                <span className="block text-primary">а личная фермерская история.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground"
              >
                <strong className="text-foreground">Шерь Козу</strong> соединяет семью с конкретным животным, фермой и именными продуктами.
                Вы входите в одну экосистему: профиль питомца, дашборд владельца, трекер происхождения и клубную жизнь.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Link href="/dashboard" className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95">
                  Открыть дашборд владельца
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/animal/marta" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-7 py-4 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                  Открыть профиль Марты
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <a href="#partner-pilot" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-secondary/70 px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary">
                  Стать партнёром
                  <Building2 className="h-4 w-4" />
                </a>
              </motion.div>

              <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                {signals.map((signal, index) => (
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
                      <img src={CDN.goat} alt="Коза Марта" className="h-28 w-24 rounded-2xl object-cover object-center" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">Животное недели</p>
                        <h3 className="mt-2 text-2xl font-semibold text-foreground">Коза Марта</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Англо-нубийская, 3 года, мягкий темперамент, выразительный профиль и высокий премиальный потенциал продуктовой линии.</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-secondary p-3">
                        <div className="text-muted-foreground">Счастье</div>
                        <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">87%</div>
                      </div>
                      <div className="rounded-2xl bg-accent/15 p-3">
                        <div className="text-muted-foreground">Надой сегодня</div>
                        <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">1.8 л</div>
                      </div>
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Как это работает</p>
              <h2 className="mt-4 max-w-md font-display text-4xl text-foreground md:text-5xl">
                Новая категория между фермерством, сервисом и клубом.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Пользователь выбирает животное, наблюдает за ним и получает продукты как материальный результат этой связи.
              </p>
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
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Почему это ценно</p>
                <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">Шерь Козу соединяет сердце, прозрачность и продукт.</h2>
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

      <section id="partner-pilot" className="py-18 md:py-24">
        <div className="container">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-stone-200 bg-[linear-gradient(135deg,rgba(255,250,244,0.96),rgba(247,242,234,0.9))] shadow-sm">
              <CardHeader className="space-y-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-900">
                  <Building2 className="h-3.5 w-3.5" />
                  Pilot Bitrix24 CRM
                </div>
                <CardTitle className="text-3xl text-stone-950">Стать партнёром Sher Kozu</CardTitle>
                <CardDescription className="max-w-xl text-base leading-7 text-stone-600">
                  Для дистрибуции, horeca, розницы и специальных коллабораций мы уже подключили пилотную CRM-синхронизацию.
                  Заявка с этой страницы создаётся в системе Sher Kozu и сразу отправляется в Bitrix24.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-stone-700">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <div className="flex items-center gap-2 text-stone-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold">Что уже в pilot</span>
                    </div>
                    <p className="mt-2 leading-6 text-stone-600">Приём заявок, синхронизация сделки в Bitrix24, аудит событий интеграции и повторная отправка при ошибке.</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <div className="flex items-center gap-2 text-stone-950">
                      <Clock3 className="h-4 w-4 text-amber-700" />
                      <span className="font-semibold">Что вернётся обратно</span>
                    </div>
                    <p className="mt-2 leading-6 text-stone-600">Стадия сделки, назначенный менеджер и ближайшая активность подтягиваются обратно в Sher Kozu для мониторинга.</p>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-stone-200 bg-white/90 p-5">
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partner-phone">Телефон</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
                        <Input id="partner-phone" className="pl-10" value={partnerLeadForm.phone} onChange={(event) => setPartnerLeadForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+7 701 000 00 00" />
                      </div>
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
                        <p className="mt-1 text-xs leading-5 text-stone-500">
                          Можно приложить до {MAX_PARTNER_FILES} файлов размером до {formatAttachmentSize(MAX_PARTNER_FILE_SIZE_BYTES)} каждый: реквизиты, презентацию, прайс или PDF-коммерческое предложение.
                        </p>
                      </div>
                      <Upload className="mt-0.5 h-5 w-5 text-stone-400" />
                    </div>
                    <Input id="partner-attachments" type="file" multiple onChange={handlePartnerAttachmentSelect} className="cursor-pointer bg-white" />
                    {partnerAttachments.length ? (
                      <div className="space-y-2">
                        {partnerAttachments.map((item) => (
                          <div key={`${item.name}-${item.size}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-stone-800">{item.name}</p>
                              <p className="text-xs text-stone-500">{formatAttachmentSize(item.size)} · {item.mimeType}</p>
                            </div>
                            <Button type="button" variant="ghost" className="shrink-0 text-stone-500 hover:text-stone-900" onClick={() => removePartnerAttachment(item.name, item.size)}>
                              Удалить
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-500">Файлы пока не выбраны.</p>
                    )}
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-6 text-stone-500">
                      Отправляя форму, вы инициируете pilot-сценарий двусторонней интеграции Sher Kozu ↔ Bitrix24 только для партнёрских заявок.
                    </p>
                    <Button type="button" onClick={() => void handlePartnerLeadSubmit()} disabled={createPartnerLead.isPending} className="rounded-full px-6">
                      {createPartnerLead.isPending ? "Отправляем в CRM..." : "Отправить партнёрскую заявку"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6">
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Маршруты внутри продукта</p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl text-foreground md:text-5xl">Лендинг не заканчивает историю, а открывает вход в экосистему.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Смысл Day 2 — превратить главную страницу в объясняющий интерфейс и маршрутизатор. Отсюда пользователь должен
                естественно переходить в кабинет владельца, профиль животного, трекер продукта и клубную ленту.
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
                <h3 className="mt-4 font-display text-3xl">AI-куратор владельца</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  В Sprint 2 продукт расширяется за счёт умного куратора, storyteller-логики и голоса животного.
                  Уже сейчас архитектура сайта готовит для этого естественные точки входа, не перегружая первую версию MVP лишней сложностью.
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
                  Первая версия MVP уже ведёт в рабочие слои продукта: владелец может понять модель, увидеть животное, проследить продукт и почувствовать клубную среду без разрывов маршрута.
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
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Следующий шаг</p>
                <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">Войдите в цифровое сердце фермы и посмотрите, как выглядит персональное фермерство на практике.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
                  Дальше пользователь должен не теряться, а сразу попадать в рабочее ядро продукта: дашборд владельца,
                  профиль животного, прозрачность продукции и клубную жизнь.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-white/95">
                  Перейти в кабинет
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/club" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Открыть клубную ленту
                  <Users className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
