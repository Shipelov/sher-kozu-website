/**
 * ZoyaSharedView — Public page for viewing shared Zoya AI recommendations.
 *
 * Accessible via /zoya/share/:token
 * Shows the shared content with branding, export options, expiry countdown, and CTA to try Zoya.
 * Handles expired links gracefully with a re-creation CTA.
 */

import { useState, useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Streamdown } from "streamdown";
import {
  Leaf,
  FileText,
  FileType,
  Download,
  Loader2,
  ArrowRight,
  Eye,
  Calendar,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ZOYA_AVATAR =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/zoya_avatar_chat_80047a81.png";

interface SharedContent {
  id: number;
  shareToken: string;
  content: string;
  title: string | null;
  userQuestion: string | null;
  viewCount: number;
  createdAt: string;
  expiresAt: string | null;
  expired?: boolean;
}

function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Истекла";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days} д. ${remainHours} ч.`;
  }
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${minutes} мин.`;
}

function pluralViews(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "просмотр";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return "просмотра";
  return "просмотров";
}

export default function ZoyaSharedView() {
  const [, params] = useRoute("/zoya/share/:token");
  const token = params?.token;

  const [data, setData] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/zoya/share/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [token]);

  // Update countdown every minute
  useEffect(() => {
    if (!data?.expiresAt || data.expired) return;
    setTimeRemaining(formatTimeRemaining(data.expiresAt));
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(data.expiresAt!));
    }, 60_000);
    return () => clearInterval(interval);
  }, [data?.expiresAt, data?.expired]);

  const isExpired = useMemo(() => {
    if (data?.expired) return true;
    if (data?.expiresAt) return new Date(data.expiresAt).getTime() < Date.now();
    return false;
  }, [data, timeRemaining]);

  const handleExport = async (format: "pdf" | "docx") => {
    if (!data) return;
    setDownloading(format);
    try {
      const response = await fetch(`/api/zoya/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: data.content,
          title: data.title,
          userQuestion: data.userQuestion,
        }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Зоя_рекомендации.${format}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toast.success(format === "pdf" ? "PDF скачан!" : "DOCX скачан!");
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setDownloading(null);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Ссылка скопирована!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShareTelegram = () => {
    const text = "Рекомендации AI-нутрициолога фермы «Шерь Козу» 🌿";
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  const handleShareWhatsApp = () => {
    const text = "Рекомендации AI-нутрициолога фермы «Шерь Козу» 🌿";
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${window.location.href}`)}`,
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container max-w-3xl">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            </div>
          )}

          {/* Not found / fetch error */}
          {error && !data && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Leaf className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Контент не найден
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Эта ссылка недействительна или срок её действия истёк.
                Попробуйте попросить отправителя создать новую ссылку.
              </p>
              <Link href="/nutritionist">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2">
                  Попробовать Зою — AI-нутрициолога
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          {/* Expired link — show content but with warning banner */}
          {data && isExpired && (
            <div className="space-y-6">
              {/* Expiry warning banner */}
              <div className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-amber-800">
                      Срок действия ссылки истёк
                    </h2>
                    <p className="text-sm text-amber-700 mt-1">
                      Эта ссылка была активна 3 дня с момента создания. Чтобы
                      получить актуальные рекомендации, обратитесь к Зое напрямую.
                    </p>
                    <Link href="/nutritionist">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white mt-3"
                      >
                        Получить новые рекомендации
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Faded content preview */}
              <div className="relative">
                <div className="rounded-2xl border border-border bg-card p-6 md:p-8 opacity-50 pointer-events-none select-none">
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={ZOYA_AVATAR}
                      alt="Зоя"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-200/60"
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {data.title || "Рекомендации нутрициолога"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Создано{" "}
                        {new Date(data.createdAt).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-6">
                    <Streamdown>{data.content}</Streamdown>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background rounded-2xl" />
              </div>

              {/* CTA */}
              <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-center text-white">
                <h3 className="text-lg font-bold mb-2">
                  Хотите персональные рекомендации?
                </h3>
                <p className="text-sm text-emerald-100 mb-4 max-w-md mx-auto">
                  Зоя — AI-нутрициолог фермы «Шерь Козу». Она составит рацион,
                  подберёт продукты и ответит на вопросы о здоровом питании.
                </p>
                <Link href="/nutritionist">
                  <Button
                    size="lg"
                    className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold"
                  >
                    Попробовать бесплатно
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Active (non-expired) content */}
          {data && !isExpired && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white p-6">
                <div className="flex items-start gap-4">
                  <img
                    src={ZOYA_AVATAR}
                    alt="Зоя"
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-200/60 shadow-md shrink-0"
                  />
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-foreground leading-tight">
                      {data.title || "Рекомендации нутрициолога"}
                    </h1>
                    <p className="text-sm text-emerald-700 font-medium mt-1 flex items-center gap-1.5">
                      <Leaf className="h-3.5 w-3.5" />
                      Зоя — AI-нутрициолог фермы «Шерь Козу»
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(data.createdAt).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {data.viewCount} {pluralViews(data.viewCount)}
                      </span>
                      {data.expiresAt && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" />
                          Действует ещё {timeRemaining}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* User question */}
                {data.userQuestion && (
                  <div className="mt-4 rounded-xl bg-emerald-100/40 px-4 py-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Вопрос:{" "}
                    </span>
                    {data.userQuestion}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{data.content}</Streamdown>
                </div>
              </div>

              {/* Actions bar */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Download className="h-3.5 w-3.5" />
                    Сохранить:
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("pdf")}
                    disabled={downloading !== null}
                    className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 gap-1.5"
                  >
                    {downloading === "pdf" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("docx")}
                    disabled={downloading !== null}
                    className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 gap-1.5"
                  >
                    {downloading === "docx" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileType className="h-3.5 w-3.5" />
                    )}
                    DOCX
                  </Button>

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="rounded-full border-border gap-1.5"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Скопировано" : "Ссылка"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleShareTelegram}
                      className="rounded-full h-8 w-8 border-border"
                      title="Telegram"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#0088cc]" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleShareWhatsApp}
                      className="rounded-full h-8 w-8 border-border"
                      title="WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                    </Button>
                  </div>
                </div>

                {/* Expiry notice */}
                {data.expiresAt && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-amber-600">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      Ссылка действительна до{" "}
                      {new Date(data.expiresAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      . Скачайте файл, чтобы сохранить рекомендации навсегда.
                    </span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-center text-white">
                <h3 className="text-lg font-bold mb-2">
                  Хотите персональные рекомендации?
                </h3>
                <p className="text-sm text-emerald-100 mb-4 max-w-md mx-auto">
                  Зоя — AI-нутрициолог фермы «Шерь Козу». Она составит рацион,
                  подберёт продукты и ответит на вопросы о здоровом питании.
                </p>
                <Link href="/nutritionist">
                  <Button
                    size="lg"
                    className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold"
                  >
                    Попробовать бесплатно
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-muted-foreground text-center">
                Рекомендации AI-нутрициолога носят информационный характер и не
                заменяют консультацию врача.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
