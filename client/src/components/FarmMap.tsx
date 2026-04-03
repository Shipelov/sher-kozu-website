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

    // Create custom marker content
    const markerEl = document.createElement("div");
    markerEl.className = "farm-marker";
    markerEl.innerHTML = `
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

    new google.maps.marker.AdvancedMarkerElement({
      map,
      position: FARM_LOCATION,
      title: FARM_TITLE,
      content: markerEl,
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
      {/* Map */}
      <MapView
        className="h-[400px] sm:h-[480px] rounded-2xl overflow-hidden border border-border shadow-sm"
        initialCenter={FARM_LOCATION}
        initialZoom={12}
        onMapReady={handleMapReady}
      />

      {/* Route button — below map */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={buildRoute}
          disabled={isLoadingRoute}
          className={cn(
            "inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-all",
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
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-white transition-colors"
        >
          <MapPin className="h-4 w-4 text-primary" />
          Яндекс Навигатор
        </a>
      </div>

      {/* Route info panel */}
      {routeInfo && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm pointer-events-auto">
          <div className="rounded-2xl border border-border bg-white/95 backdrop-blur-md p-4 shadow-xl">
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
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm pointer-events-auto">
          <div className="rounded-2xl border border-destructive/30 bg-white/95 backdrop-blur-md p-4 shadow-xl">
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
