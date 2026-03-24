import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Move,
} from "lucide-react";

/* ─── Constants ─── */
const MAX_FILE_SIZE_MB = 10;
const COMPRESS_THRESHOLD_MB = 2;
const TARGET_MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

/* ─── Types ─── */
interface ImageCropEditorProps {
  /** Called with the final cropped image as base64 data, fileName, and mimeType */
  onCropComplete: (data: {
    base64Data: string;
    fileName: string;
    mimeType: string;
  }) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Aspect ratio for the crop frame (width / height). Default: 16/9 */
  aspectRatio?: number;
  /** Maximum output width in pixels. Default: 1200 */
  maxOutputWidth?: number;
  /** Label for the crop frame */
  frameLabel?: string;
}

interface Position {
  x: number;
  y: number;
}

/**
 * ImageCropEditor — visual image editor for CMS.
 *
 * Flow:
 * 1. User selects a file → auto-compressed if > 2MB
 * 2. Shows crop frame overlay — user drags image inside or zooms
 * 3. On confirm → exports cropped region as base64
 */
export default function ImageCropEditor({
  onCropComplete,
  onCancel,
  aspectRatio = 16 / 9,
  maxOutputWidth = 1200,
  frameLabel = "Область обрезки",
}: ImageCropEditorProps) {
  const [step, setStep] = useState<"select" | "compress" | "crop" | "export">("select");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);

  // Crop state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<Position>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Frame dimensions (responsive to container) ─── */
  const CONTAINER_W = 560;
  const CONTAINER_H = 400;
  const frameW = Math.min(CONTAINER_W - 40, 480);
  const frameH = frameW / aspectRatio;
  const frameX = (CONTAINER_W - frameW) / 2;
  const frameY = (CONTAINER_H - frameH) / 2;

  /* ─── Step 1: File selection ─── */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_MB} МБ.`);
        return;
      }

      if (!file.type.startsWith("image/")) {
        alert("Пожалуйста, выберите изображение.");
        return;
      }

      setOriginalFile(file);

      // Check if compression needed
      if (file.size > COMPRESS_THRESHOLD_MB * 1024 * 1024) {
        setStep("compress");
        await compressImage(file);
      } else {
        // Load directly
        const url = URL.createObjectURL(file);
        loadImage(url, file.size, file.size);
      }
    },
    []
  );

  /* ─── Compression ─── */
  const compressImage = useCallback(async (file: File) => {
    const originalSize = file.size;

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if too large
      if (width > TARGET_MAX_DIMENSION || height > TARGET_MAX_DIMENSION) {
        const scale = TARGET_MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const compressedUrl = URL.createObjectURL(blob);
          setCompressionInfo({
            originalSize,
            compressedSize: blob.size,
          });
          loadImage(compressedUrl, originalSize, blob.size);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.src = url;
  }, []);

  /* ─── Load image for cropping ─── */
  const loadImage = useCallback(
    (url: string, _origSize: number, _compSize: number) => {
      const img = new Image();
      img.onload = () => {
        setImageSize({ w: img.width, h: img.height });
        setImageSrc(url);

        // Calculate initial zoom to fill the frame
        const scaleX = frameW / img.width;
        const scaleY = frameH / img.height;
        const initialZoom = Math.max(scaleX, scaleY);
        setZoom(initialZoom);

        // Center the image
        const scaledW = img.width * initialZoom;
        const scaledH = img.height * initialZoom;
        setPosition({
          x: frameX + (frameW - scaledW) / 2,
          y: frameY + (frameH - scaledH) / 2,
        });

        setStep("crop");
      };
      img.src = url;
    },
    [frameW, frameH, frameX, frameY]
  );

  /* ─── Drag handlers ─── */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (step !== "crop") return;
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartPos({ ...position });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [step, position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPosition({
        x: dragStartPos.x + dx,
        y: dragStartPos.y + dy,
      });
    },
    [isDragging, dragStart, dragStartPos]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /* ─── Zoom handler ─── */
  const handleZoomChange = useCallback(
    (newZoom: number) => {
      if (!imageSrc) return;
      const oldZoom = zoom;

      // Zoom around the center of the frame
      const centerX = frameX + frameW / 2;
      const centerY = frameY + frameH / 2;

      const imgCenterX = (centerX - position.x) / oldZoom;
      const imgCenterY = (centerY - position.y) / oldZoom;

      setZoom(newZoom);
      setPosition({
        x: centerX - imgCenterX * newZoom,
        y: centerY - imgCenterY * newZoom,
      });
    },
    [zoom, position, imageSrc, frameX, frameY, frameW, frameH]
  );

  /* ─── Mouse wheel zoom ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || step !== "crop") return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const minZoom = Math.max(frameW / imageSize.w, frameH / imageSize.h) * 0.5;
      const newZoom = Math.max(minZoom, Math.min(5, zoom + delta));
      handleZoomChange(newZoom);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [step, zoom, handleZoomChange, frameW, frameH, imageSize]);

  /* ─── Reset position ─── */
  const handleReset = useCallback(() => {
    if (!imageSize.w) return;
    const scaleX = frameW / imageSize.w;
    const scaleY = frameH / imageSize.h;
    const initialZoom = Math.max(scaleX, scaleY);
    setZoom(initialZoom);

    const scaledW = imageSize.w * initialZoom;
    const scaledH = imageSize.h * initialZoom;
    setPosition({
      x: frameX + (frameW - scaledW) / 2,
      y: frameY + (frameH - scaledH) / 2,
    });
  }, [imageSize, frameW, frameH, frameX, frameY]);

  /* ─── Export cropped image ─── */
  const handleExport = useCallback(() => {
    if (!imageSrc || !canvasRef.current) return;
    setStep("export");

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;

      // Calculate the crop region in image coordinates
      const cropX = (frameX - position.x) / zoom;
      const cropY = (frameY - position.y) / zoom;
      const cropW = frameW / zoom;
      const cropH = frameH / zoom;

      // Output dimensions
      const outW = Math.min(maxOutputWidth, Math.round(cropW));
      const outH = Math.round(outW / aspectRatio);

      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];

      const fileName = originalFile
        ? originalFile.name.replace(/\.[^.]+$/, "") + "_cropped.jpg"
        : "cropped.jpg";

      onCropComplete({
        base64Data: base64,
        fileName,
        mimeType: "image/jpeg",
      });
    };
    img.src = imageSrc;
  }, [
    imageSrc,
    position,
    zoom,
    frameX,
    frameY,
    frameW,
    frameH,
    maxOutputWidth,
    aspectRatio,
    originalFile,
    onCropComplete,
  ]);

  /* ─── Zoom limits ─── */
  const minZoom = imageSize.w
    ? Math.max(frameW / imageSize.w, frameH / imageSize.h) * 0.5
    : 0.1;
  const maxZoom = 5;

  /* ─── Format file size ─── */
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Step: Select file */}
      {step === "select" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
            <Move className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">
              Выберите изображение
            </p>
            <p className="text-xs text-muted-foreground">
              Макс. {MAX_FILE_SIZE_MB} МБ. Большие файлы будут автоматически сжаты.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            Выбрать файл
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Отмена
          </Button>
        </div>
      )}

      {/* Step: Compressing */}
      {step === "compress" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Сжатие изображения...</p>
        </div>
      )}

      {/* Step: Crop */}
      {step === "crop" && imageSrc && (
        <div className="space-y-3">
          {/* Compression info */}
          {compressionInfo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-amber-800 dark:text-amber-200">
                Изображение сжато: {formatSize(compressionInfo.originalSize)} →{" "}
                {formatSize(compressionInfo.compressedSize)} (
                {Math.round(
                  (1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100
                )}
                % экономии)
              </span>
            </div>
          )}

          {/* Crop area */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-xl border border-border bg-neutral-900 select-none"
            style={{
              width: CONTAINER_W,
              height: CONTAINER_H,
              maxWidth: "100%",
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Image layer */}
            <img
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                width: imageSize.w * zoom,
                height: imageSize.h * zoom,
                pointerEvents: "none",
                userSelect: "none",
              }}
            />

            {/* Dark overlay outside crop frame */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={CONTAINER_W}
              height={CONTAINER_H}
            >
              <defs>
                <mask id="crop-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect
                    x={frameX}
                    y={frameY}
                    width={frameW}
                    height={frameH}
                    rx={8}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.55)"
                mask="url(#crop-mask)"
              />
              {/* Frame border */}
              <rect
                x={frameX}
                y={frameY}
                width={frameW}
                height={frameH}
                rx={8}
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
              {/* Corner handles */}
              {[
                [frameX, frameY],
                [frameX + frameW, frameY],
                [frameX, frameY + frameH],
                [frameX + frameW, frameY + frameH],
              ].map(([cx, cy], i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill="white"
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={1}
                />
              ))}
            </svg>

            {/* Frame label */}
            <div
              className="absolute pointer-events-none text-white/80 text-xs font-medium bg-black/40 px-2 py-0.5 rounded"
              style={{
                left: frameX + 8,
                top: frameY + 8,
              }}
            >
              {frameLabel}
            </div>

            {/* Drag hint */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none text-white/60 text-xs bg-black/40 px-2 py-0.5 rounded flex items-center gap-1">
              <Move className="h-3 w-3" />
              Перетащите фото · Колёсико для зума
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-3 px-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleZoomChange(Math.max(minZoom, zoom - 0.1))}
              disabled={zoom <= minZoom}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <div className="flex-1">
              <Slider
                value={[zoom]}
                min={minZoom}
                max={maxZoom}
                step={0.01}
                onValueChange={([v]) => handleZoomChange(v)}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleZoomChange(Math.min(maxZoom, zoom + 0.1))}
              disabled={zoom >= maxZoom}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Сбросить
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4 mr-1" />
                Отмена
              </Button>
            </div>
            <Button size="sm" onClick={handleExport}>
              <Check className="h-4 w-4 mr-1" />
              Обрезать и загрузить
            </Button>
          </div>
        </div>
      )}

      {/* Step: Exporting */}
      {step === "export" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Обработка и загрузка...</p>
        </div>
      )}
    </div>
  );
}
