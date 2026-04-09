/**
 * ZoyaExportActions — Export & Share actions for Zoya AI responses.
 *
 * Renders after substantive Zoya responses with options to:
 * - Download as PDF
 * - Download as DOCX
 * - Share via link (copy or messenger)
 *
 * Designed to match the Zoya chat visual language (emerald accents).
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  FileType,
  Share2,
  Copy,
  Check,
  Loader2,
  X,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ExportFormat = "pdf" | "docx";

interface ZoyaExportActionsProps {
  /** The assistant's markdown content to export */
  content: string;
  /** The user's question that prompted this response */
  userQuestion?: string;
  /** User's name for personalization */
  userName?: string;
  /** Compact mode for floating chat (smaller buttons) */
  compact?: boolean;
}

/** Minimum content length to show export actions (skip short greetings) */
const MIN_CONTENT_LENGTH = 200;

/** Keywords that indicate substantive content worth exporting */
const EXPORT_KEYWORDS = [
  "рацион",
  "меню",
  "план",
  "рекомендац",
  "калор",
  "белк",
  "витамин",
  "минерал",
  "питани",
  "продукт",
  "завтрак",
  "обед",
  "ужин",
  "перекус",
  "диет",
  "норм",
  "грамм",
  "порци",
  "рецепт",
  "состав",
  "польз",
  "молок",
  "сыр",
  "творог",
  "кефир",
  "йогурт",
];

function isSubstantiveContent(content: string): boolean {
  if (content.length < MIN_CONTENT_LENGTH) return false;
  const lower = content.toLowerCase();
  return EXPORT_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function ZoyaExportActions({
  content,
  userQuestion,
  userName,
  compact = false,
}: ZoyaExportActionsProps) {
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Don't show for short/non-substantive responses
  if (!isSubstantiveContent(content)) return null;

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setDownloading(format);
      try {
        const response = await fetch(`/api/zoya/export/${format}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            content,
            userQuestion,
            userName,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Зоя_рекомендации_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        toast.success(
          format === "pdf" ? "PDF скачан!" : "DOCX скачан!",
          { description: "Файл сохранён на ваше устройство" }
        );
      } catch (err) {
        console.error(`Export ${format} error:`, err);
        toast.error("Ошибка экспорта", {
          description: "Попробуйте ещё раз через минутку",
        });
      } finally {
        setDownloading(null);
      }
    },
    [content, userQuestion, userName]
  );

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const response = await fetch("/api/zoya/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          userQuestion,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { shareToken, expiresAt } = await response.json();
      const shareUrl = `${window.location.origin}/zoya/share/${shareToken}`;

      // Try native share API first (mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Рекомендации нутрициолога Зои — Шерь Козу",
            text: "Посмотрите рекомендации AI-нутрициолога фермы «Шерь Козу»",
            url: shareUrl,
          });
          toast.success("Отправлено!", {
            description: "Ссылка действительна 3 дня",
          });
          return;
        } catch {
          // User cancelled native share — fall through to copy
        }
      }

      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Ссылка скопирована!", {
        description: "Действительна 3 дня. Отправьте друзьям или в мессенджер",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Share error:", err);
      toast.error("Ошибка", {
        description: "Не удалось создать ссылку для отправки",
      });
    } finally {
      setSharing(false);
    }
  }, [content, userQuestion]);

  const handleShareVia = useCallback(
    async (platform: "telegram" | "whatsapp" | "copy") => {
      setSharing(true);
      try {
        const response = await fetch("/api/zoya/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content, userQuestion }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const { shareToken } = await response.json();
        const shareUrl = `${window.location.origin}/zoya/share/${shareToken}`;
        const text = "Рекомендации AI-нутрициолога фермы «Шерь Козу» 🌿";

        switch (platform) {
          case "telegram":
            window.open(
              `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
              "_blank"
            );
            toast.success("Отправлено!", { description: "Ссылка действительна 3 дня" });
            break;
          case "whatsapp":
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`${text}\n${shareUrl}`)}`,
              "_blank"
            );
            toast.success("Отправлено!", { description: "Ссылка действительна 3 дня" });
            break;
          case "copy":
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success("Ссылка скопирована!", { description: "Действительна 3 дня" });
            setTimeout(() => setCopied(false), 3000);
            break;
        }

        setShareMenuOpen(false);
      } catch (err) {
        console.error("Share error:", err);
        toast.error("Ошибка создания ссылки");
      } finally {
        setSharing(false);
      }
    },
    [content, userQuestion]
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 ml-8">
        <button
          onClick={() => handleExport("pdf")}
          disabled={downloading !== null}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50/40 px-2 py-0.5 text-[10px] text-emerald-700 transition-all hover:bg-emerald-100/60 hover:border-emerald-300 disabled:opacity-50 cursor-pointer"
          title="Скачать PDF"
        >
          {downloading === "pdf" ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <FileText className="h-2.5 w-2.5" />
          )}
          PDF
        </button>
        <button
          onClick={() => handleExport("docx")}
          disabled={downloading !== null}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50/40 px-2 py-0.5 text-[10px] text-emerald-700 transition-all hover:bg-emerald-100/60 hover:border-emerald-300 disabled:opacity-50 cursor-pointer"
          title="Скачать DOCX"
        >
          {downloading === "docx" ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <FileType className="h-2.5 w-2.5" />
          )}
          DOCX
        </button>

        {/* Share button with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShareMenuOpen(!shareMenuOpen)}
            disabled={sharing}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50/40 px-2 py-0.5 text-[10px] text-emerald-700 transition-all hover:bg-emerald-100/60 hover:border-emerald-300 disabled:opacity-50 cursor-pointer"
            title="Поделиться"
          >
            {sharing ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : copied ? (
              <Check className="h-2.5 w-2.5" />
            ) : (
              <Share2 className="h-2.5 w-2.5" />
            )}
            {copied ? "Готово" : "Поделиться"}
          </button>

          {shareMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 z-50 rounded-lg border border-border bg-card shadow-lg p-1.5 min-w-[160px]">
              <button
                onClick={() => handleShareVia("copy")}
                className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                Скопировать ссылку
              </button>
              <button
                onClick={() => handleShareVia("telegram")}
                className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <MessageCircle className="h-3 w-3 text-[#0088cc]" />
                Telegram
              </button>
              <button
                onClick={() => handleShareVia("whatsapp")}
                className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <MessageCircle className="h-3 w-3 text-[#25D366]" />
                WhatsApp
              </button>
              <button
                onClick={() => setShareMenuOpen(false)}
                className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full (embedded) mode
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 ml-8 pt-2 border-t border-emerald-100/60">
      <span className="text-[11px] text-muted-foreground mr-1">
        <Download className="inline h-3 w-3 mr-0.5" />
        Сохранить:
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("pdf")}
        disabled={downloading !== null}
        className="h-7 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 text-[11px] gap-1 cursor-pointer"
      >
        {downloading === "pdf" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FileText className="h-3 w-3" />
        )}
        Скачать PDF
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("docx")}
        disabled={downloading !== null}
        className="h-7 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 text-[11px] gap-1 cursor-pointer"
      >
        {downloading === "docx" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FileType className="h-3 w-3" />
        )}
        Скачать DOCX
      </Button>

      <div className="relative ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShareMenuOpen(!shareMenuOpen)}
          disabled={sharing}
          className="h-7 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 text-[11px] gap-1 cursor-pointer"
        >
          {sharing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Share2 className="h-3 w-3" />
          )}
          {copied ? "Скопировано" : "Поделиться"}
        </Button>

        {shareMenuOpen && (
          <div className="absolute bottom-full right-0 mb-1 z-50 rounded-xl border border-border bg-card shadow-xl p-2 min-w-[180px]">
            <p className="text-[10px] text-muted-foreground px-2 mb-1.5 font-medium">
              Поделиться через:
            </p>
            <button
              onClick={() => handleShareVia("copy")}
              className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Скопировать ссылку
            </button>
            <button
              onClick={() => handleShareVia("telegram")}
              className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#0088cc]" />
              Telegram
            </button>
            <button
              onClick={() => handleShareVia("whatsapp")}
              className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
              WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
