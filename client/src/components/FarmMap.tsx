/**
 * FarmMap.tsx — Google Maps iframe embed for Sher Kozu farm
 *
 * Uses a simple iframe embed for maximum reliability on all devices.
 * Route building opens Google Maps / Yandex Navigator in a new tab.
 *
 * Improvements:
 * - Retry logic: attempts iframe load up to 3 times with different URLs
 * - Fallback: shows static map image with farm coordinates on failure
 */

import { useState, useCallback, useRef } from "react";
import { MapPin, Navigation, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Farm coordinates ─── */
const FARM_LAT = 56.0598821;
const FARM_LNG = 36.6134708;
const FARM_TITLE = "Ферма Шерь Козу, д. Назарово";

/* ─── Forge proxy for Google Maps Embed API ─── */
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";

/**
 * Multiple embed URL strategies for retry fallback.
 * Each attempt uses a different URL pattern for maximum reliability.
 */
const EMBED_URLS = [
  // Strategy 1: Simple Google Maps embed
  `https://www.google.com/maps?q=${FARM_LAT},${FARM_LNG}&z=12&hl=ru&output=embed`,
  // Strategy 2: Forge proxy embed
  `${FORGE_BASE_URL}/v1/maps/proxy/maps/embed/v1/place?key=${FORGE_API_KEY}&q=${FARM_LAT},${FARM_LNG}&zoom=12&language=ru`,
  // Strategy 3: Direct Google Maps embed with pb parameter
  `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d35000!2d${FARM_LNG}!3d${FARM_LAT}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTbCsDAzJzM1LjYiTiAzNsKwMzYnNDguNSJF!5e0!3m2!1sru!2sru!4v1`,
];

const MAX_RETRIES = EMBED_URLS.length;

/**
 * Static fallback map image using OpenStreetMap tile.
 * Shown when all iframe strategies fail.
 */
const STATIC_MAP_URL = `https://staticmap.openstreetmap.de/staticmap.php?center=${FARM_LAT},${FARM_LNG}&zoom=12&size=800x480&maptype=mapnik&markers=${FARM_LAT},${FARM_LNG},red-pushpin`;

export default function FarmMap({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [showStaticFallback, setShowStaticFallback] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* ─── Handle iframe load error with retry ─── */
  const handleIframeError = useCallback(() => {
    const nextAttempt = currentAttempt + 1;
    if (nextAttempt < MAX_RETRIES) {
      // Try next URL strategy
      setCurrentAttempt(nextAttempt);
      setIsLoading(true);
    } else {
      // All strategies exhausted — show static fallback
      setIsLoading(false);
      setHasError(true);
      setShowStaticFallback(true);
    }
  }, [currentAttempt]);

  /* ─── Manual retry from fallback state ─── */
  const handleRetry = useCallback(() => {
    setCurrentAttempt(0);
    setHasError(false);
    setShowStaticFallback(false);
    setIsLoading(true);
  }, []);

  /* ─── Open Google Maps for directions ─── */
  const openGoogleMapsRoute = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${FARM_LAT},${FARM_LNG}&travelmode=driving`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* ─── Open Yandex Navigator ─── */
  const openYandexNav = () => {
    window.open(
      `https://yandex.ru/maps/?rtext=~${FARM_LAT},${FARM_LNG}&rtt=auto`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className={cn("relative", className)}>
      {/* Map container */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm">
        {/* Loading state */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-secondary/50 rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">
                Загрузка карты…
              </p>
            </div>
          </div>
        )}

        {/* Static fallback image when all iframe strategies fail */}
        {showStaticFallback ? (
          <div className="relative w-full h-[400px] sm:h-[480px]">
            {/* Static map background */}
            <div
              className="absolute inset-0 bg-secondary/30"
              style={{
                backgroundImage: `url(${STATIC_MAP_URL})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Overlay with farm info */}
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <div className="bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-xl shadow-lg px-5 py-4 flex flex-col items-center gap-2 max-w-xs text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {FARM_TITLE}
                </p>
                <p className="text-xs text-muted-foreground">
                  {FARM_LAT.toFixed(4)}°N, {FARM_LNG.toFixed(4)}°E
                </p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors mt-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Попробовать снова
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Google Maps iframe with retry URLs */
          <iframe
            ref={iframeRef}
            src={EMBED_URLS[currentAttempt]}
            className="w-full h-[400px] sm:h-[480px] border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Расположение фермы Шерь Козу"
            onLoad={() => setIsLoading(false)}
            onError={handleIframeError}
          />
        )}
      </div>

      {/* Navigation buttons — below map */}
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <button
          onClick={openGoogleMapsRoute}
          className={cn(
            "inline-flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold shadow-sm transition-all",
            "bg-primary text-white hover:bg-primary/90 active:scale-[0.97]"
          )}
        >
          <Navigation className="h-4 w-4" />
          Построить маршрут
          <ExternalLink className="h-3 w-3 opacity-60" />
        </button>
        <button
          onClick={openYandexNav}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white/80 px-4 py-2.5 sm:py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-white transition-colors"
        >
          <MapPin className="h-4 w-4 text-primary" />
          Яндекс Навигатор
          <ExternalLink className="h-3 w-3 opacity-60" />
        </button>
      </div>
    </div>
  );
}
