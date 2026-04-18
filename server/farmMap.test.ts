import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const FARM_MAP_SRC = readFileSync(
  resolve(__dirname, "../client/src/components/FarmMap.tsx"),
  "utf-8"
);

describe("FarmMap.tsx — Yandex Maps Integration", () => {
  /* ─── Yandex Maps API ─── */
  it("uses Yandex Maps JS API v2.1 (not Google Maps)", () => {
    expect(FARM_MAP_SRC).toContain("api-maps.yandex.ru/2.1/");
    expect(FARM_MAP_SRC).not.toContain("googleapis.com/maps");
    expect(FARM_MAP_SRC).not.toContain("google.maps");
  });

  it("reads VITE_YANDEX_MAPS_API_KEY from env", () => {
    expect(FARM_MAP_SRC).toContain("VITE_YANDEX_MAPS_API_KEY");
  });

  /* ─── Farm coordinates ─── */
  it("uses correct farm coordinates (Istra, Nazarovo)", () => {
    expect(FARM_MAP_SRC).toContain("56.0598821");
    expect(FARM_MAP_SRC).toContain("36.6134708");
  });

  it("shows farm title and address in Russian", () => {
    expect(FARM_MAP_SRC).toContain("Ферма Шерь Козу");
    expect(FARM_MAP_SRC).toContain("Подмосковье");
    expect(FARM_MAP_SRC).toContain("Истра");
  });

  /* ─── Map features ─── */
  it("creates a Placemark at farm coordinates", () => {
    expect(FARM_MAP_SRC).toContain("Placemark");
    expect(FARM_MAP_SRC).toContain("FARM_LAT, FARM_LNG");
  });

  it("adds ZoomControl and FullscreenControl", () => {
    expect(FARM_MAP_SRC).toContain("ZoomControl");
    expect(FARM_MAP_SRC).toContain("FullscreenControl");
  });

  it("supports satellite/map toggle", () => {
    expect(FARM_MAP_SRC).toContain("yandex#satellite");
    expect(FARM_MAP_SRC).toContain("yandex#map");
    expect(FARM_MAP_SRC).toContain("setType");
    expect(FARM_MAP_SRC).toContain("isSatellite");
  });

  /* ─── Navigation buttons ─── */
  it("provides Yandex Navigator route link", () => {
    expect(FARM_MAP_SRC).toContain("yandex.ru/maps/");
    expect(FARM_MAP_SRC).toContain("rtext=");
    expect(FARM_MAP_SRC).toContain("rtt=auto");
  });

  it("provides Google Maps route link as alternative", () => {
    expect(FARM_MAP_SRC).toContain("google.com/maps/dir/");
    expect(FARM_MAP_SRC).toContain("travelmode=driving");
  });

  it('shows "Построить маршрут" button text', () => {
    expect(FARM_MAP_SRC).toContain("Построить маршрут");
  });

  /* ─── Loading & error states ─── */
  it("shows loading state while map initializes", () => {
    expect(FARM_MAP_SRC).toContain("isLoading");
    expect(FARM_MAP_SRC).toContain("Загрузка карты");
  });

  it("shows fallback with coordinates on error", () => {
    expect(FARM_MAP_SRC).toContain("hasError");
    expect(FARM_MAP_SRC).toContain("FARM_LAT.toFixed(4)");
  });

  /* ─── Cleanup ─── */
  it("destroys map instance on unmount", () => {
    expect(FARM_MAP_SRC).toContain("destroy()");
    expect(FARM_MAP_SRC).toContain("destroyed = true");
  });
});
