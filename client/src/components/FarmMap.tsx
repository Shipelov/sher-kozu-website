/**
 * FarmMap.tsx — Interactive Google Maps component for Sher Kozu farm
 *
 * Features:
 * - Shows the farm location (Nazarovo, Istrinsky district) with a custom marker
 * - "Build Route" button that gets user's geolocation and draws driving directions
 * - Displays distance and estimated travel time
 * - Styled to match the site's warm organic palette
 */

import { MapView } from "@/components/Map";
import { useCallback, useRef, useState } from "react";
import { MapPin, Navigation, Clock, Route, Loader2, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Farm coordinates ─── */
const FARM_LOCATION = { lat: 56.0598821, lng: 36.6134708 };
const FARM_TITLE = "Ферма Шерь Козу";
const FARM_ADDRESS = "д. Назарово, Истринский район, Московская область";

/* ─── Custom map styles — warm organic palette ─── */
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  // Overall geometry — warm cream base
  { elementType: "geometry", stylers: [{ color: "#f0ebe0" }] },
  // Labels text — muted dark green
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5e4a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1ea" }, { weight: 3 }] },
  // Administrative labels
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#3d4f3d" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#2d3d2d" }, { weight: 1.5 }] },
  // Landscape — soft warm beige
  { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#ece7db" }] },
  { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#e5dfcf" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry.fill", stylers: [{ color: "#ddd7c5" }] },
  // Parks & green areas — soft sage green
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#c8d5b9" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a7a5a" }] },
  // Other POI — subtle, don't distract
  { featureType: "poi", elementType: "geometry.fill", stylers: [{ color: "#ddd8ca" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "simplified" }] },
  // Roads — warm muted tones
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#f5f0e5" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d5cdb8" }, { weight: 0.8 }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7a6b" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#e8dfc8" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c5b99a" }, { weight: 1.2 }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#5a6a5a" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#ede7d5" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#d0c8b0" }] },
  { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#f2ede2" }] },
  // Water — soft muted blue-sage
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#b8ccc0" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6a8a7a" }] },
  // Transit — hide to reduce clutter
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/* ─── Route info state ─── */
interface RouteInfo {
  distance: string;
  duration: string;
  summary: string;
}

export default function FarmMap({ className }: { className?: string }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  /* ─── Map ready callback ─── */
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Create a custom overlay for the farm marker label
    class FarmMarkerOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private position: google.maps.LatLng;

      constructor(position: google.maps.LatLngLiteral) {
        super();
        this.position = new google.maps.LatLng(position.lat, position.lng);
      }

      onAdd() {
        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.cursor = "pointer";
        this.div.style.transform = "translate(-50%, -100%)";
        this.div.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.25));
          ">
            <div style="
              background: #1a3a2a;
              color: white;
              padding: 8px 14px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 600;
              white-space: nowrap;
              font-family: system-ui, -apple-system, sans-serif;
              line-height: 1.3;
              text-align: center;
            ">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">🐐</span>
                <span>${FARM_TITLE}</span>
              </div>
              <div style="font-size: 11px; font-weight: 400; opacity: 0.8; margin-top: 2px;">
                д. Назарово, Истра
              </div>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 10px solid #1a3a2a;
            "></div>
          </div>
        `;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(this.div);
      }

      draw() {
        if (!this.div) return;
        const projection = this.getProjection();
        const point = projection.fromLatLngToDivPixel(this.position);
        if (point) {
          this.div.style.left = point.x + "px";
          this.div.style.top = point.y + "px";
        }
      }

      onRemove() {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
    }

    // Add the custom overlay marker
    const overlay = new FarmMarkerOverlay(FARM_LOCATION);
    overlay.setMap(map);

    // Also add a simple marker for the pin icon
    new google.maps.Marker({
      map,
      position: FARM_LOCATION,
      title: FARM_TITLE,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#1a3a2a",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
    });
  }, []);

  /* ─── Build route from user location ─── */
  const buildRoute = useCallback(async () => {
    if (!mapRef.current) return;

    setIsLoadingRoute(true);
    setRouteError(null);
    setRouteInfo(null);

    // Clear previous route
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    try {
      // Get user's current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Геолокация не поддерживается вашим браузером"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              reject(new Error("Доступ к геолокации запрещён. Разрешите доступ в настройках браузера."));
              break;
            case err.POSITION_UNAVAILABLE:
              reject(new Error("Не удалось определить ваше местоположение."));
              break;
            case err.TIMEOUT:
              reject(new Error("Время ожидания определения местоположения истекло."));
              break;
            default:
              reject(new Error("Не удалось определить местоположение."));
          }
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
      });

      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Create directions service and renderer
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#1a3a2a",
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
        markerOptions: {
          // The origin marker will use default style
        },
      });
      directionsRendererRef.current = directionsRenderer;

      // Request route
      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(
          {
            origin: userLocation,
            destination: FARM_LOCATION,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC,
          },
          (response, status) => {
            if (status === "OK" && response) {
              resolve(response);
            } else {
              reject(new Error("Не удалось построить маршрут. Попробуйте позже."));
            }
          }
        );
      });

      // Display the route
      directionsRenderer.setDirections(result);

      // Extract route info
      const route = result.routes[0];
      const leg = route.legs[0];
      setRouteInfo({
        distance: leg.distance?.text ?? "—",
        duration: leg.duration?.text ?? "—",
        summary: route.summary ?? "",
      });
    } catch (err: any) {
      setRouteError(err.message || "Произошла ошибка при построении маршрута.");
    } finally {
      setIsLoadingRoute(false);
    }
  }, []);

  /* ─── Clear route ─── */
  const clearRoute = useCallback(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    setRouteInfo(null);
    setRouteError(null);

    // Reset map view to farm
    if (mapRef.current) {
      mapRef.current.setCenter(FARM_LOCATION);
      mapRef.current.setZoom(12);
    }
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Map with warm organic tint — CSS filter + overlay for reliable tinting */}
      <div
        className="relative rounded-2xl overflow-hidden border border-border shadow-sm"
        style={{ filter: 'sepia(35%) saturate(0.6) brightness(1.05) contrast(0.95)' }}
      >
        <MapView
          className="h-[400px] sm:h-[480px]"
          initialCenter={FARM_LOCATION}
          initialZoom={12}
          onMapReady={handleMapReady}
          styles={MAP_STYLES}
        />
        {/* Warm tint overlay — pointer-events:none keeps map interactive */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: 'rgba(180, 165, 130, 0.18)',
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      {/* Route button — below map */}
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <button
          onClick={buildRoute}
          disabled={isLoadingRoute}
          className={cn(
            "inline-flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold shadow-sm transition-all",
            "bg-primary text-white hover:bg-primary/90 active:scale-[0.97]",
            "disabled:opacity-70 disabled:cursor-not-allowed"
          )}
        >
          {isLoadingRoute ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {isLoadingRoute ? "Строим маршрут…" : "Построить маршрут до фермы"}
        </button>
        <a
          href={`https://yandex.ru/maps/?rtext=~${FARM_LOCATION.lat},${FARM_LOCATION.lng}&rtt=auto`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white/80 px-4 py-2.5 sm:py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-white transition-colors"
        >
          <MapPin className="h-4 w-4 text-primary" />
          Яндекс Навигатор
        </a>
      </div>

      {/* Route info panel */}
      {routeInfo && (
        <div className="mt-3 sm:mt-0 sm:absolute sm:bottom-4 sm:right-4 sm:max-w-sm pointer-events-auto">
          <div className="rounded-2xl border border-border bg-white/95 backdrop-blur-md p-3 sm:p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-primary">
                <Route className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold">Маршрут построен</span>
              </div>
              <button
                onClick={clearRoute}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Расстояние</p>
                  <p className="text-sm font-bold text-foreground">{routeInfo.distance}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">В пути</p>
                  <p className="text-sm font-bold text-foreground">{routeInfo.duration}</p>
                </div>
              </div>
            </div>
            {routeInfo.summary && (
              <p className="mt-2 text-xs text-muted-foreground">
                Маршрут: {routeInfo.summary}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${FARM_LOCATION.lat},${FARM_LOCATION.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <Navigation className="h-3 w-3" />
                Открыть в Google Maps
              </a>
              <a
                href={`https://yandex.ru/maps/?rtext=~${FARM_LOCATION.lat},${FARM_LOCATION.lng}&rtt=auto`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <MapPin className="h-3 w-3" />
                Яндекс Навигатор
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {routeError && (
        <div className="mt-3 sm:mt-0 sm:absolute sm:bottom-4 sm:right-4 sm:max-w-sm pointer-events-auto">
          <div className="rounded-2xl border border-destructive/30 bg-white/95 backdrop-blur-md p-3 sm:p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Ошибка маршрута</p>
                <p className="mt-1 text-xs text-muted-foreground">{routeError}</p>
              </div>
              <button
                onClick={() => setRouteError(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors ml-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
