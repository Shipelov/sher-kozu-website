/**
 * FarmMap.tsx — Yandex Maps integration for Sher Kozu farm
 *
 * Uses Yandex Maps JS API v2.1 for best compatibility with Russian users.
 * Shows farm location with a custom placemark, satellite layer toggle,
 * and navigation buttons (Yandex Navigator + Google Maps).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Loader2, ExternalLink, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Farm coordinates ─── */
const FARM_LAT = 56.0598821;
const FARM_LNG = 36.6134708;
const FARM_TITLE = "Ферма Шерь Козу";
const FARM_ADDRESS = "Подмосковье, Истра, д. Назарово";

/* ─── Yandex Maps API key ─── */
const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || "";

/* ─── Yandex Maps types (minimal) ─── */
declare global {
  interface Window {
    ymaps?: {
      ready: (callback: () => void) => void;
      Map: new (
        element: HTMLElement,
        state: {
          center: [number, number];
          zoom: number;
          type?: string;
          controls?: string[];
        },
        options?: Record<string, unknown>
      ) => YandexMap;
      Placemark: new (
        coords: [number, number],
        properties?: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => unknown;
      control: {
        ZoomControl: new (options?: Record<string, unknown>) => unknown;
        GeolocationControl: new (options?: Record<string, unknown>) => unknown;
        FullscreenControl: new (options?: Record<string, unknown>) => unknown;
        TypeSelector: new (options?: Record<string, unknown>) => unknown;
      };
    };
  }
}

interface YandexMap {
  geoObjects: { add: (obj: unknown) => void };
  controls: { add: (control: unknown) => void };
  setType: (type: string) => void;
  destroy: () => void;
}

/* ─── Load Yandex Maps script ─── */
let ymapsLoadPromise: Promise<void> | null = null;

function loadYmaps(): Promise<void> {
  if (ymapsLoadPromise) return ymapsLoadPromise;

  ymapsLoadPromise = new Promise((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(() => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => resolve());
      } else {
        reject(new Error("ymaps not available after script load"));
      }
    };
    script.onerror = () => {
      ymapsLoadPromise = null;
      reject(new Error("Failed to load Yandex Maps script"));
    };
    document.head.appendChild(script);
  });

  return ymapsLoadPromise;
}

export default function FarmMap({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YandexMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  /* ─── Initialize map ─── */
  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        await loadYmaps();
        if (destroyed || !containerRef.current || !window.ymaps) return;

        const map = new window.ymaps.Map(
          containerRef.current,
          {
            center: [FARM_LAT, FARM_LNG],
            zoom: 13,
            controls: [],
          },
          {
            suppressMapOpenBlock: true,
          }
        );

        mapInstanceRef.current = map;

        /* Placemark with balloon */
        const placemark = new window.ymaps.Placemark(
          [FARM_LAT, FARM_LNG],
          {
            balloonContentHeader: `<strong>${FARM_TITLE}</strong>`,
            balloonContentBody: `<p style="margin:4px 0;font-size:13px;">${FARM_ADDRESS}</p><p style="margin:4px 0;font-size:12px;color:#666;">Семейная ферма козьего и овечьего молока</p>`,
            hintContent: FARM_TITLE,
          },
          {
            preset: "islands#greenDotIcon",
            iconColor: "#2d6a2e",
          }
        );
        map.geoObjects.add(placemark);

        /* Controls */
        map.controls.add(
          new window.ymaps.control.ZoomControl({ options: { size: "small", position: { right: 10, top: 10 } } })
        );
        map.controls.add(
          new window.ymaps.control.FullscreenControl({ options: { position: { right: 10, top: 60 } } })
        );

        if (!destroyed) setIsLoading(false);
      } catch {
        if (!destroyed) {
          setIsLoading(false);
          setHasError(true);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch {
          /* ignore */
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* ─── Toggle satellite/map view ─── */
  const toggleSatellite = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const next = !isSatellite;
    setIsSatellite(next);
    mapInstanceRef.current.setType(next ? "yandex#satellite" : "yandex#map");
  }, [isSatellite]);

  /* ─── Navigation links ─── */
  const openYandexNav = () => {
    window.open(
      `https://yandex.ru/maps/?rtext=~${FARM_LAT},${FARM_LNG}&rtt=auto`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const openGoogleMapsRoute = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${FARM_LAT},${FARM_LNG}&travelmode=driving`,
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
          <div className="w-full h-[400px] sm:h-[480px] flex items-center justify-center bg-secondary/30 rounded-2xl">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">{FARM_TITLE}</p>
              <p className="text-xs text-muted-foreground">{FARM_ADDRESS}</p>
              <p className="text-xs text-muted-foreground">
                {FARM_LAT.toFixed(4)}°N, {FARM_LNG.toFixed(4)}°E
              </p>
            </div>
          </div>
        )}

        {/* Yandex Map container */}
        <div
          ref={containerRef}
          className={cn(
            "w-full h-[400px] sm:h-[480px]",
            hasError && "hidden"
          )}
        />

        {/* Satellite toggle button */}
        {!hasError && !isLoading && (
          <button
            onClick={toggleSatellite}
            className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:bg-white dark:hover:bg-card transition-colors"
            title={isSatellite ? "Карта" : "Спутник"}
          >
            <Layers className="h-3.5 w-3.5" />
            {isSatellite ? "Карта" : "Спутник"}
          </button>
        )}
      </div>

      {/* Navigation buttons — below map */}
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <button
          onClick={openYandexNav}
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
          onClick={openGoogleMapsRoute}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white/80 px-4 py-2.5 sm:py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-white transition-colors"
        >
          <MapPin className="h-4 w-4 text-primary" />
          Google Maps
          <ExternalLink className="h-3 w-3 opacity-60" />
        </button>
      </div>
    </div>
  );
}
