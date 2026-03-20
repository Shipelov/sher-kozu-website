/**
 * PuzzleCaptcha — Slider puzzle captcha component.
 * User drags a slider to fit a puzzle piece into the correct position.
 * Purely client-side verification (anti-bot, not cryptographic).
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface PuzzleCaptchaProps {
  onVerified: () => void;
  onReset?: () => void;
}

const CANVAS_W = 280;
const CANVAS_H = 160;
const PIECE_SIZE = 40;
const TOLERANCE = 5; // px tolerance for matching

export default function PuzzleCaptcha({ onVerified, onReset }: PuzzleCaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targetX, setTargetX] = useState(0);
  const [sliderX, setSliderX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);
  const dragStartX = useRef(0);
  const dragStartSlider = useRef(0);

  // Generate random target position
  const generatePuzzle = useCallback(() => {
    const x = Math.floor(Math.random() * (CANVAS_W - PIECE_SIZE - 80)) + 60;
    setTargetX(x);
    setSliderX(0);
    setVerified(false);
    setFailed(false);
  }, []);

  useEffect(() => {
    generatePuzzle();
  }, [generatePuzzle]);

  // Draw the puzzle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background gradient (nature-themed)
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    grad.addColorStop(0, "#e8f5e9");
    grad.addColorStop(0.5, "#c8e6c9");
    grad.addColorStop(1, "#a5d6a7");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw some decorative elements (hills)
    ctx.fillStyle = "#81c784";
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H);
    ctx.quadraticCurveTo(70, CANVAS_H - 60, 140, CANVAS_H - 30);
    ctx.quadraticCurveTo(210, CANVAS_H - 70, CANVAS_W, CANVAS_H - 20);
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#66bb6a";
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H);
    ctx.quadraticCurveTo(100, CANVAS_H - 40, 180, CANVAS_H - 15);
    ctx.quadraticCurveTo(230, CANVAS_H - 50, CANVAS_W, CANVAS_H - 10);
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    // Target slot (dark hole)
    const ty = (CANVAS_H - PIECE_SIZE) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    drawPuzzlePiece(ctx, targetX, ty, PIECE_SIZE);
    ctx.fill();
    ctx.stroke();

    // Draggable piece
    const pieceX = sliderX;
    ctx.fillStyle = verified
      ? "rgba(46, 125, 50, 0.85)"
      : failed
        ? "rgba(198, 40, 40, 0.75)"
        : "rgba(27, 94, 32, 0.75)";
    ctx.strokeStyle = verified ? "#2e7d32" : failed ? "#c62828" : "#1b5e20";
    ctx.lineWidth = 2;
    drawPuzzlePiece(ctx, pieceX, ty, PIECE_SIZE);
    ctx.fill();
    ctx.stroke();

    // Piece icon
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      verified ? "✓" : "◆",
      pieceX + PIECE_SIZE / 2,
      ty + PIECE_SIZE / 2
    );
  }, [targetX, sliderX, verified, failed]);

  function drawPuzzlePiece(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) {
    const r = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Top edge with tab
    ctx.lineTo(x + size * 0.35, y);
    ctx.arc(x + size * 0.5, y, r, Math.PI, 0, false);
    ctx.lineTo(x + size, y);
    // Right edge with tab
    ctx.lineTo(x + size, y + size * 0.35);
    ctx.arc(x + size, y + size * 0.5, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(x + size, y + size);
    // Bottom edge
    ctx.lineTo(x, y + size);
    ctx.closePath();
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (verified) return;
    setIsDragging(true);
    setFailed(false);
    dragStartX.current = e.clientX;
    dragStartSlider.current = sliderX;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (verified) return;
    setIsDragging(true);
    setFailed(false);
    dragStartX.current = e.touches[0].clientX;
    dragStartSlider.current = sliderX;
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || verified) return;
      const diff = clientX - dragStartX.current;
      const newX = Math.max(0, Math.min(CANVAS_W - PIECE_SIZE, dragStartSlider.current + diff));
      setSliderX(newX);
    },
    [isDragging, verified]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging || verified) return;
    setIsDragging(false);

    if (Math.abs(sliderX - targetX) <= TOLERANCE) {
      setVerified(true);
      setSliderX(targetX);
      setTimeout(() => onVerified(), 400);
    } else {
      setFailed(true);
      setTimeout(() => {
        setSliderX(0);
        setFailed(false);
      }, 600);
    }
  }, [isDragging, verified, sliderX, targetX, onVerified]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onMouseUp = () => handleEnd();
    const onTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchend", onTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const sliderPercent = (sliderX / (CANVAS_W - PIECE_SIZE)) * 100;

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full rounded-lg border border-border"
        style={{ maxWidth: CANVAS_W }}
      />

      {/* Slider track */}
      <div className="relative select-none" style={{ maxWidth: CANVAS_W }}>
        <div className="h-10 rounded-full bg-muted border border-border relative overflow-hidden">
          {/* Fill */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-colors ${
              verified
                ? "bg-green-500/30"
                : failed
                  ? "bg-red-500/20"
                  : "bg-primary/10"
            }`}
            style={{ width: `${sliderPercent}%` }}
          />

          {/* Label */}
          {!verified && sliderX < 10 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
              Перетащите ползунок →
            </span>
          )}

          {verified && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-green-700 font-medium pointer-events-none">
              ✓ Проверка пройдена
            </span>
          )}

          {/* Thumb */}
          <div
            className={`absolute top-0.5 bottom-0.5 w-10 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors shadow-md ${
              verified
                ? "bg-green-600 text-white"
                : failed
                  ? "bg-red-500 text-white"
                  : "bg-white border-2 border-primary text-primary"
            }`}
            style={{ left: `calc(${sliderPercent}% - ${sliderPercent * 0.4}px)` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {verified ? "✓" : "⇒"}
          </div>
        </div>
      </div>

      {failed && (
        <p className="text-xs text-red-600 text-center">
          Не совпало. Попробуйте ещё раз.
        </p>
      )}
    </div>
  );
}
