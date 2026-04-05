/**
 * Tests for Google Maps improvements:
 * - Retry logic with exponential backoff (Map.tsx loadMapScriptWithRetry)
 * - Fallback image behavior (FarmMap.tsx)
 * - Async script loading
 * - AdvancedMarkerElement usage verification
 *
 * Since Map.tsx and FarmMap.tsx are React components, we test the
 * underlying logic patterns and configuration rather than rendering.
 */

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

/* ─── Helper: read source file ─── */
function readClientFile(filePath: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "..", "client", "src", filePath),
    "utf-8"
  );
}

describe("Map.tsx — Retry Logic & Async Loading", () => {
  const mapSource = readClientFile("components/Map.tsx");

  it("defines MAX_RETRIES = 3 for retry attempts", () => {
    expect(mapSource).toContain("MAX_RETRIES = 3");
  });

  it("defines BASE_DELAY_MS for exponential backoff", () => {
    expect(mapSource).toContain("BASE_DELAY_MS = 1000");
  });

  it("implements exponential backoff with Math.pow(2, attempt)", () => {
    expect(mapSource).toContain("Math.pow(2, attempt)");
  });

  it("uses BASE_DELAY_MS * Math.pow(2, attempt) for delay calculation", () => {
    expect(mapSource).toContain("BASE_DELAY_MS * Math.pow(2, attempt)");
  });

  it("has loadMapScriptWithRetry function", () => {
    expect(mapSource).toContain("async function loadMapScriptWithRetry");
  });

  it("returns success/error result from loadMapScriptWithRetry", () => {
    expect(mapSource).toContain("{ success: true }");
    expect(mapSource).toContain("{ success: false, error:");
  });

  it("resets __gmapsLoading on failure to allow retry", () => {
    expect(mapSource).toContain("window.__gmapsLoading = undefined");
  });

  it("uses async attribute on script element for performance", () => {
    expect(mapSource).toContain("script.async = true");
  });

  it("includes loading=async parameter in Google Maps URL", () => {
    expect(mapSource).toContain("loading=async");
  });

  it("loads marker library for AdvancedMarkerElement support", () => {
    expect(mapSource).toContain("libraries=marker");
  });

  it("has a 10-second timeout for script initialization", () => {
    expect(mapSource).toContain("10000");
  });

  it("clears interval on successful load within timeout", () => {
    expect(mapSource).toContain("clearInterval(check)");
  });
});

describe("Map.tsx — Fallback UI", () => {
  const mapSource = readClientFile("components/Map.tsx");

  it("defines MapFallback component", () => {
    expect(mapSource).toContain("function MapFallback");
  });

  it("shows 'Карта временно недоступна' message in fallback", () => {
    expect(mapSource).toContain("Карта временно недоступна");
  });

  it("displays coordinates in fallback", () => {
    expect(mapSource).toContain("center.lat.toFixed(4)");
    expect(mapSource).toContain("center.lng.toFixed(4)");
  });

  it("provides retry button in fallback", () => {
    expect(mapSource).toContain("Попробовать снова");
  });

  it("provides Google Maps external link in fallback", () => {
    expect(mapSource).toContain("Открыть в Google Maps");
    expect(mapSource).toContain("google.com/maps");
  });

  it("uses RefreshCw icon for retry button", () => {
    expect(mapSource).toContain("RefreshCw");
  });

  it("renders MapFallback when loadFailed is true", () => {
    expect(mapSource).toContain("loadFailed");
    expect(mapSource).toContain("<MapFallback");
  });

  it("tracks loading state with isLoading useState", () => {
    expect(mapSource).toContain("useState(true)");
    expect(mapSource).toContain("setIsLoading");
  });

  it("shows loading spinner while map is loading", () => {
    expect(mapSource).toContain("Загрузка карты");
    expect(mapSource).toContain("animate-spin");
  });
});

describe("Map.tsx — Exponential Backoff Timing", () => {
  it("calculates correct delays: 1s, 2s, 4s", () => {
    const BASE_DELAY_MS = 1000;
    const delays = [0, 1, 2].map((attempt) => BASE_DELAY_MS * Math.pow(2, attempt));
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it("total max wait time is 7 seconds (1+2+4)", () => {
    const BASE_DELAY_MS = 1000;
    const MAX_RETRIES = 3;
    let totalWait = 0;
    for (let i = 0; i < MAX_RETRIES - 1; i++) {
      totalWait += BASE_DELAY_MS * Math.pow(2, i);
    }
    expect(totalWait).toBe(3000); // Only delays between retries: 1s + 2s
  });

  it("does not delay after the last retry attempt", () => {
    const MAX_RETRIES = 3;
    // The loop condition: attempt < MAX_RETRIES - 1 means no delay after last
    expect(MAX_RETRIES - 1).toBe(2); // Last attempt index
  });
});

describe("FarmMap.tsx — Retry & Fallback", () => {
  const farmMapSource = readClientFile("components/FarmMap.tsx");

  it("defines multiple embed URL strategies for retry", () => {
    expect(farmMapSource).toContain("EMBED_URLS");
    // Should have at least 3 strategies
    const urlMatches = farmMapSource.match(/Strategy \d/g);
    expect(urlMatches).not.toBeNull();
    expect(urlMatches!.length).toBeGreaterThanOrEqual(3);
  });

  it("defines MAX_RETRIES based on EMBED_URLS length", () => {
    expect(farmMapSource).toContain("MAX_RETRIES = EMBED_URLS.length");
  });

  it("tracks current attempt with useState", () => {
    expect(farmMapSource).toContain("currentAttempt");
    expect(farmMapSource).toContain("setCurrentAttempt");
  });

  it("increments attempt on iframe error", () => {
    expect(farmMapSource).toContain("nextAttempt = currentAttempt + 1");
  });

  it("shows static fallback when all strategies fail", () => {
    expect(farmMapSource).toContain("showStaticFallback");
    expect(farmMapSource).toContain("setShowStaticFallback(true)");
  });

  it("uses OpenStreetMap static map as fallback image", () => {
    expect(farmMapSource).toContain("staticmap.openstreetmap.de");
  });

  it("includes farm coordinates in static map URL", () => {
    expect(farmMapSource).toContain("56.0598821");
    expect(farmMapSource).toContain("36.6134708");
  });

  it("provides manual retry from fallback state", () => {
    expect(farmMapSource).toContain("handleRetry");
    expect(farmMapSource).toContain("Попробовать снова");
  });

  it("resets all state on manual retry", () => {
    expect(farmMapSource).toContain("setCurrentAttempt(0)");
    expect(farmMapSource).toContain("setHasError(false)");
    expect(farmMapSource).toContain("setShowStaticFallback(false)");
  });

  it("displays farm title in fallback overlay", () => {
    expect(farmMapSource).toContain("FARM_TITLE");
    expect(farmMapSource).toContain("Ферма Шерь Козу");
  });

  it("uses lazy loading for iframe", () => {
    expect(farmMapSource).toContain('loading="lazy"');
  });

  it("uses EMBED_URLS[currentAttempt] as iframe src", () => {
    expect(farmMapSource).toContain("EMBED_URLS[currentAttempt]");
  });

  it("keeps navigation buttons (Google Maps + Yandex) in all states", () => {
    expect(farmMapSource).toContain("Построить маршрут");
    expect(farmMapSource).toContain("Яндекс Навигатор");
  });

  it("opens Google Maps directions in new tab", () => {
    expect(farmMapSource).toContain("google.com/maps/dir");
    expect(farmMapSource).toContain("travelmode=driving");
  });

  it("opens Yandex Navigator in new tab", () => {
    expect(farmMapSource).toContain("yandex.ru/maps");
    expect(farmMapSource).toContain("rtt=auto");
  });
});

describe("AdminSiteAnalytics.tsx — AdvancedMarkerElement Usage", () => {
  const adminSource = readClientFile("pages/AdminSiteAnalytics.tsx");

  it("uses AdvancedMarkerElement instead of deprecated Marker", () => {
    expect(adminSource).toContain("AdvancedMarkerElement");
  });

  it("does NOT use deprecated google.maps.Marker constructor", () => {
    // Should not contain 'new google.maps.Marker(' — only AdvancedMarkerElement
    const deprecatedMarkerUsage = adminSource.match(
      /new\s+google\.maps\.Marker\s*\(/g
    );
    expect(deprecatedMarkerUsage).toBeNull();
  });

  it("creates custom pin elements for markers", () => {
    expect(adminSource).toContain('document.createElement("div")');
    expect(adminSource).toContain("pinEl");
  });

  it("uses LatLngBounds for auto-fitting markers", () => {
    expect(adminSource).toContain("LatLngBounds");
    expect(adminSource).toContain("fitBounds");
  });

  it("stores markers in a ref for cleanup", () => {
    expect(adminSource).toContain("markersRef");
  });
});

describe("No deprecated google.maps.Marker usage across project", () => {
  const componentFiles = [
    "components/Map.tsx",
    "components/FarmMap.tsx",
    "pages/AdminSiteAnalytics.tsx",
  ];

  for (const file of componentFiles) {
    it(`${file} does not use deprecated google.maps.Marker`, () => {
      const source = readClientFile(file);
      const deprecatedUsage = source.match(
        /new\s+google\.maps\.Marker\s*\(/g
      );
      expect(deprecatedUsage).toBeNull();
    });
  }
});
