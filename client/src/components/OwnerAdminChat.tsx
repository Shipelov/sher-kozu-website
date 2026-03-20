/**
 * OwnerAdminChat
 *
 * Real-time-ish chat between an animal owner and the farm admin.
 * Supports text messages and photo uploads (via S3).
 * Polls for new messages every 8 seconds.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Camera,
  ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ── Constants ── */

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POLL_INTERVAL = 8000;

/* ── Types ── */

type ChatMsg = {
  id: number;
  animalId: number;
  ownerOpenId: string;
  sender: "owner" | "admin";
  text: string | null;
  photoUrl: string | null;
  photoKey: string | null;
  isRead: number;
  createdAt: string;
  updatedAt: string;
};

/* ── Helpers ── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:...;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function groupMessagesByDate(messages: ChatMsg[]): Array<{ date: string; msgs: ChatMsg[] }> {
  const groups: Array<{ date: string; msgs: ChatMsg[] }> = [];
  let currentDate = "";

  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      groups.push({ date: formatDate(msg.createdAt), msgs: [] });
    }
    groups[groups.length - 1].msgs.push(msg);
  }

  return groups;
}

/* ── Photo Preview ── */

function PhotoPreview({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="relative max-h-[85vh] max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow"
        >
          <X className="h-4 w-4" />
        </button>
        <img src={url} alt="Фото" className="max-h-[85vh] rounded-xl object-contain" />
      </motion.div>
    </motion.div>
  );
}

/* ── Message Bubble ── */

function MessageBubble({
  msg,
  isMine,
  onPhotoClick,
}: {
  msg: ChatMsg;
  isMine: boolean;
  onPhotoClick: (url: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        }`}
      >
        {msg.photoUrl && (
          <button
            type="button"
            onClick={() => onPhotoClick(msg.photoUrl!)}
            className="mb-2 block overflow-hidden rounded-xl"
          >
            <img
              src={msg.photoUrl}
              alt="Фото"
              className="max-h-48 max-w-full rounded-xl object-cover transition hover:opacity-90"
            />
          </button>
        )}
        {msg.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        )}
        <p
          className={`mt-1 text-[10px] ${
            isMine ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          {formatTime(msg.createdAt)}
          {!isMine && (
            <span className="ml-1.5 font-medium">
              {msg.sender === "admin" ? "Ферма" : "Владелец"}
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Main Component ── */

export default function OwnerAdminChat({
  animalId,
  ownerOpenId,
  animalName,
}: {
  animalId: number;
  ownerOpenId: string;
  animalName?: string;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const isAdmin = user?.role === "admin";
  const mySender = isAdmin ? "admin" : "owner";

  // Queries
  const messagesQuery = trpc.productTrack.listMessages.useQuery(
    { animalId, ownerOpenId },
    { refetchInterval: POLL_INTERVAL },
  );

  const messages = (messagesQuery.data ?? []) as ChatMsg[];

  // Mark as read when messages arrive
  const markRead = trpc.productTrack.markRead.useMutation();

  useEffect(() => {
    if (messages.length > 0) {
      const hasUnread = messages.some(
        (m) => m.sender !== mySender && !m.isRead,
      );
      if (hasUnread) {
        markRead.mutate({ animalId, ownerOpenId });
      }
    }
  }, [messages, mySender, animalId, ownerOpenId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Send message mutation
  const sendMessage = trpc.productTrack.sendMessage.useMutation({
    onSuccess: () => {
      utils.productTrack.listMessages.invalidate({ animalId, ownerOpenId });
      setText("");
      clearPhoto();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handlePhotoSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Поддерживаются только JPEG, PNG и WebP");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      toast.error("Максимальный размер фото — 5 МБ");
      return;
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [photoPreviewUrl]);

  const handleSend = useCallback(async () => {
    if (!text.trim() && !photoFile) return;
    setIsSending(true);

    try {
      let photoBase64: string | null = null;
      let photoMimeType: string | null = null;
      let photoFileName: string | null = null;

      if (photoFile) {
        photoBase64 = await fileToBase64(photoFile);
        photoMimeType = photoFile.type;
        photoFileName = photoFile.name;
      }

      sendMessage.mutate({
        animalId,
        ownerOpenId,
        text: text.trim() || null,
        photoBase64,
        photoMimeType,
        photoFileName,
      });
    } catch {
      toast.error("Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  }, [text, photoFile, animalId, ownerOpenId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const grouped = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden" style={{ height: "min(560px, 70vh)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-3">
        <MessageCircle className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {isAdmin ? `Чат с владельцем` : "Чат с фермой"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {animalName ? `По животному: ${animalName}` : "Обсуждение продуктового плана и доставки"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messagesQuery.isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Загрузка сообщений…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Нет сообщений</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin
                ? "Владелец ещё не написал."
                : "Напишите ферме, чтобы обсудить план или доставку."}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="space-y-2">
                {group.msgs.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.sender === mySender}
                    onPhotoClick={setLightboxUrl}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Photo attachment preview */}
      {photoPreviewUrl && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/70">
              <img src={photoPreviewUrl} alt="Прикреплённое фото" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground truncate">{photoFile?.name}</p>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Photo upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            <Camera className="h-4 w-4" />
          </Button>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/70 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ maxHeight: "100px" }}
            disabled={isSending}
          />

          {/* Send button */}
          <Button
            type="button"
            size="icon"
            className="shrink-0 h-9 w-9 rounded-full"
            onClick={handleSend}
            disabled={isSending || (!text.trim() && !photoFile)}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <PhotoPreview url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </AnimatePresence>

      {/* Retention footnote */}
      <p className="mt-2 text-[10px] text-muted-foreground/60 text-center px-4">
        Сообщения хранятся 30 дней и автоматически удаляются после истечения срока.
      </p>
    </div>
  );
}
