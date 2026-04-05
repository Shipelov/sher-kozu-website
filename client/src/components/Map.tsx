/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map;
 *   }}
 * />
 *
 * ======
 * Available Libraries: marker, places, geocoding, geometry, routes
 * See original documentation comments for full API reference.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";
import { MapPin, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    google?: typeof google;
    __gmapsLoading?: Promise<void>;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

/* ─── Retry configuration ─── */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

/**
 * Load the Google Maps script once using a blob URL approach.
 *
 * The Manus proxy may return response headers (e.g. Cross-Origin-Resource-Policy)
 * that prevent the browser from executing the script as a cross-origin resource.
 * To work around this, we:
 * 1. fetch() the script content (which works with CORS)
 * 2. Create a same-origin blob: URL from the response
 * 3. Load the blob URL as a script tag
 *
 * Uses window.__gmapsLoading to survive HMR module reloads.
 * Script is loaded with async pattern for better performance.
 */
function loadMapScript(): Promise<void> {
  // Already fully loaded
  if (window.google?.maps) {
    return Promise.resolve();
  }

  // A load is already in progress (survives HMR)
  if (window.__gmapsLoading) {
    return window.__gmapsLoading;
  }

  window.__gmapsLoading = (async () => {
    // Use loading=async parameter for better performance
    const scriptUrl = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry,routes&loading=async`;

    // If google.maps appeared while we were setting up (race condition), done
    if (window.google?.maps) return;

    // Fetch the script content
    const response = await fetch(scriptUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Google Maps script: ${response.status}`);
    }

    const scriptText = await response.text();

    // If google.maps appeared during fetch (another instance loaded it), done
    if (window.google?.maps) return;

    // Create a blob URL and load as same-origin script (async attribute for performance)
    const blob = new Blob([scriptText], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = blobUrl;
      script.async = true; // Async loading for better performance
      script.onload = () => {
        URL.revokeObjectURL(blobUrl);
        if (window.google?.maps) {
          resolve();
        } else {
          // Script loaded but google.maps not available — wait briefly
          const check = setInterval(() => {
            if (window.google?.maps) {
              clearInterval(check);
              resolve();
            }
          }, 100);
          // Timeout after 10s
          setTimeout(() => {
            clearInterval(check);
            if (window.google?.maps) {
              resolve();
            } else {
              reject(new Error("Google Maps script load timeout"));
            }
          }, 10000);
        }
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Failed to load Google Maps script"));
      };
      document.head.appendChild(script);
    });
  })();

  // If loading fails, allow retry
  window.__gmapsLoading.catch(() => {
    window.__gmapsLoading = undefined;
  });

  return window.__gmapsLoading;
}

/**
 * Load Google Maps with retry logic and exponential backoff.
 * Retries up to MAX_RETRIES times with delays of 1s, 2s, 4s.
 */
async function loadMapScriptWithRetry(): Promise<{ success: boolean; error?: Error }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await loadMapScript();
      return { success: true };
    } catch (err) {
      lastError = err as Error;
      window.__gmapsLoading = undefined;

      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  return { success: false, error: lastError ?? new Error("Unknown error loading Google Maps") };
}

/* ─── Fallback component when Google Maps fails to load ─── */
function MapFallback({
  center,
  onRetry,
  className,
}: {
  center: google.maps.LatLngLiteral;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full h-[500px] flex flex-col items-center justify-center bg-secondary/60 rounded-xl border border-border",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <MapPin className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">
            Карта временно недоступна
          </p>
          <p className="text-xs text-muted-foreground">
            Координаты: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Попробовать снова
        </button>
        <a
          href={`https://www.google.com/maps?q=${center.lat},${center.lng}&z=12`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Открыть в Google Maps
        </a>
      </div>
    </div>
  );
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  onMapError?: () => void;
  styles?: google.maps.MapTypeStyle[];
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  onMapError,
  styles,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const init = usePersistFn(async () => {
    setIsLoading(true);
    setLoadFailed(false);

    const result = await loadMapScriptWithRetry();

    if (!result.success || !window.google?.maps) {
      console.error(
        `Failed to load Google Maps after ${MAX_RETRIES} retries:`,
        result.error
      );
      setLoadFailed(true);
      setIsLoading(false);
      onMapError?.();
      return;
    }

    if (!mapContainer.current) {
      console.error("Map container not found");
      setIsLoading(false);
      onMapError?.();
      return;
    }

    try {
      const hasCustomStyles = styles && styles.length > 0;

      const mapOptions: google.maps.MapOptions = {
        zoom: initialZoom,
        center: initialCenter,
        zoomControl: true,
        mapTypeControl: !hasCustomStyles,
        fullscreenControl: !hasCustomStyles,
        streetViewControl: !hasCustomStyles,
      };

      if (hasCustomStyles) {
        // Use the `styles` property for cross-device reliability (raster rendering)
        mapOptions.styles = styles;
      } else {
        mapOptions.mapId = "DEMO_MAP_ID";
      }

      map.current = new window.google.maps.Map(mapContainer.current, mapOptions);
      setIsLoading(false);

      if (onMapReady) {
        onMapReady(map.current);
      }
    } catch (err) {
      console.error("Failed to initialize Google Maps:", err);
      setLoadFailed(true);
      setIsLoading(false);
      onMapError?.();
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  if (loadFailed) {
    return (
      <MapFallback
        center={initialCenter}
        onRetry={init}
        className={className}
      />
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center bg-secondary/50 rounded-xl",
            className
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground font-medium">
              Загрузка карты…
            </p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
    </div>
  );
}
