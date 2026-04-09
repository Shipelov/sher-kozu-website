/**
 * ZoyaSharedView — Public page for viewing shared Zoya AI recommendations.
 *
 * Accessible via /zoya/share/:token
 * Shows the shared content with branding, export options, and CTA to try Zoya.
 */

import { useState, useEffect } from "react";
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
}

export default function ZoyaSharedView() {
  const [, params] = useRoute("/zoya/share/:token");
  const token = params?.token;

  const [data, setData] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [copied, setCopied] = useState(false);

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

          {error && (
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

          {data && (
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
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
                        {data.viewCount} просмотр
                        {data.viewCount % 10 === 1 && data.viewCount % 100 !== 11
                          ? ""
                          : data.viewCount % 10 >= 2 &&
                              data.viewCount % 10 <= 4 &&
                              (data.viewCount % 100 < 10 ||
                                data.viewCount % 100 >= 20)
                            ? "а"
                            : "ов"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User question */}
                {data.userQuestion && (
                  <div className="mt-4 rounded-xl bg-emerald-100/40 px-4 py-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Вопрос: </span>
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
