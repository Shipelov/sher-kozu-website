import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Crop, ImagePlus } from "lucide-react";

/* ── Constants ── */
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const OUTPUT_SIZE = 1200; // px — square output
const OUTPUT_QUALITY = 0.85; // JPEG quality

/* ── Types ── */
export type CropResult = {
  file: File;
  base64: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type ImageCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the cropped + compressed result */
  onConfirm: (result: CropResult) => void | Promise<void>;
  /** Aspect ratio for the crop area (default 1 = square) */
  aspect?: number;
  /** Output size in pixels (default 1200) */
  outputSize?: number;
  /** JPEG quality 0–1 (default 0.85) */
  quality?: number;
  /** Whether the confirm action is in progress */
  isUploading?: boolean;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
};

/* ── Helpers ── */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: number,
  quality: number,
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/* ── Component ── */
export default function ImageCropDialog({
  open,
  onOpenChange,
  onConfirm,
  aspect = 1,
  outputSize = OUTPUT_SIZE,
  quality = OUTPUT_QUALITY,
  isUploading = false,
  title = "Кадрирование фото",
  description = "Перетащите изображение мышкой или пальцем для позиционирования. Используйте колёсико мыши или слайдер для масштабирования.",
}: ImageCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewSize, setPreviewSize] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  function reset() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setOriginalFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewSize(null);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      return;
    }

    setOriginalFile(file);
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPreviewSize(null);
  }

  async function handlePreview() {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await getCroppedImage(imageSrc, croppedAreaPixels, outputSize, quality);
    if (blob) setPreviewSize(blob.size);
  }

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels || !originalFile) return;
    const blob = await getCroppedImage(imageSrc, croppedAreaPixels, outputSize, quality);
    if (!blob) return;

    const croppedName = originalFile.name.replace(/\.[^.]+$/, "") + "-cropped.jpg";
    const croppedFile = new File([blob], croppedName, { type: "image/jpeg" });
    const base64 = await fileToBase64(croppedFile);

    await onConfirm({
      file: croppedFile,
      base64,
      originalName: croppedName,
      mimeType: "image/jpeg",
      sizeBytes: croppedFile.size,
    });

    reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!imageSrc ? (
          /* ── File picker ── */
          <div className="px-6 pb-6">
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/70 bg-muted/20 px-6 py-16 transition-colors hover:border-primary/40 hover:bg-muted/40"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary/60", "bg-primary/5"); }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary/60", "bg-primary/5"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-primary/60", "bg-primary/5");
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) return;
                  if (file.size > MAX_FILE_SIZE) return;
                  setOriginalFile(file);
                  setImageSrc(URL.createObjectURL(file));
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setPreviewSize(null);
                }
              }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <ImagePlus className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">Перетащите фото сюда или нажмите для выбора</p>
                <p className="mt-1 text-sm text-muted-foreground">JPG, PNG или WebP · до 8 МБ</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        ) : (
          /* ── Crop editor ── */
          <div className="flex flex-col">
            {/* Crop area */}
            <div className="relative mx-6 aspect-square overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid
                style={{
                  containerStyle: { borderRadius: "1rem" },
                  cropAreaStyle: {
                    border: "2px solid rgba(255,255,255,0.7)",
                    borderRadius: "0.5rem",
                  },
                }}
              />
            </div>

            {/* Controls */}
            <div className="space-y-4 px-6 py-5">
              {/* Zoom slider */}
              <div className="flex items-center gap-3">
                <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Slider
                  min={1}
                  max={3}
                  step={0.05}
                  value={[zoom]}
                  onValueChange={([v]) => setZoom(v)}
                  className="flex-1"
                />
                <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">
                  {zoom.toFixed(1)}×
                </span>
              </div>

              {/* Info row */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {originalFile && (
                  <span>
                    Оригинал: <strong className="text-foreground">{formatFileSize(originalFile.size)}</strong>
                  </span>
                )}
                {previewSize !== null && (
                  <span>
                    → После сжатия: <strong className="text-foreground">{formatFileSize(previewSize)}</strong>
                  </span>
                )}
                <span className="ml-auto">Выход: {outputSize}×{outputSize}px · JPEG {Math.round(quality * 100)}%</span>
              </div>

              {/* Action buttons */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setPreviewSize(null); }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Сбросить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handlePreview}
                >
                  Предпросмотр размера
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={handleConfirm}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Crop className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? "Загрузка..." : "Сохранить фото"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Trigger button (optional helper) ── */
export function ImageCropTriggerButton({
  onOpen,
  isPending,
  label = "Добавить фото",
}: {
  onOpen: () => void;
  isPending?: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onOpen}
      disabled={isPending}
      className="rounded-full"
    >
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
      {isPending ? "Загрузка..." : label}
    </Button>
  );
}
