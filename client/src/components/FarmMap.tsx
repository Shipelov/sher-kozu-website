/**
 * FarmMap.tsx — Google Maps iframe embed for Sher Kozu farm
 *
 * Uses a simple iframe embed for maximum reliability on all devices.
 * Route building opens Google Maps / Yandex Navigator in a new tab.
 */

import { useState } from "react";
import { MapPin, Navigation, Loader2, ExternalLink } from "lucide-react";
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
 * Build the iframe src URL using the Manus Maps proxy.
 * The Embed API uses a different endpoint than the JS API.
 * We use the "place" mode to show a marker at the farm location.
 */
const EMBED_SRC = `${FORGE_BASE_URL}/v1/maps/proxy/maps/embed/v1/place?key=${FORGE_API_KEY}&q=${FARM_LAT},${FARM_LNG}&zoom=12&language=ru`;

/**
 * Fallback: direct Google Maps embed URL (in case the proxy doesn't support embed API)
 */
const GOOGLE_MAPS_DIRECT_URL = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d35000!2d${FARM_LNG}!3d${FARM_LAT}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTbCsDAzJzM1LjYiTiAzNsKwMzYnNDguNSJF!5e0!3m2!1sru!2sru!4v1`;

/**
 * Simple Google Maps embed URL using q parameter
 */
const SIMPLE_EMBED_SRC = `https://www.google.com/maps?q=${FARM_LAT},${FARM_LNG}&z=12&hl=ru&output=embed`;

export default function FarmMap({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-secondary/80 rounded-2xl">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <MapPin className="h-8 w-8 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                д. Назарово, Истринский район
              </p>
              <p className="text-xs text-muted-foreground">
                Используйте кнопки ниже для навигации
              </p>
            </div>
          </div>
        )}

        {/* Google Maps iframe */}
        <iframe
          src={SIMPLE_EMBED_SRC}
          className="w-full h-[400px] sm:h-[480px] border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Расположение фермы Шерь Козу"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
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
