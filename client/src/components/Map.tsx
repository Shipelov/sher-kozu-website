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

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

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
    const scriptUrl = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry,routes`;

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

    // Create a blob URL and load as same-origin script
    const blob = new Blob([scriptText], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = blobUrl;
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
              reject(new Error("Google Maps API did not initialize after script load"));
            }
          }, 10000);
        }
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Failed to execute Google Maps blob script"));
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

  const init = usePersistFn(async () => {
    // Retry up to 2 times
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await loadMapScript();
        break;
      } catch (err) {
        lastError = err as Error;
        window.__gmapsLoading = undefined;
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    if (!window.google?.maps) {
      console.error("Failed to load Google Maps after retries:", lastError);
      onMapError?.();
      return;
    }

    if (!mapContainer.current) {
      console.error("Map container not found");
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

      if (onMapReady) {
        onMapReady(map.current);
      }
    } catch (err) {
      console.error("Failed to initialize Google Maps:", err);
      onMapError?.();
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
