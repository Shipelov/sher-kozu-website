import { describe, it, expect } from "vitest";

// Ходит в api-maps.yandex.ru с боевым ключом — в CI и офлайн пропускается по флагу.
describe.skipIf(process.env.SKIP_EXTERNAL_TESTS === "1")("Yandex Maps API Key", () => {
  it("should have VITE_YANDEX_MAPS_API_KEY set", () => {
    const key = process.env.VITE_YANDEX_MAPS_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    // Yandex API keys are UUIDs
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("should be accepted by Yandex Maps JS API v2.1 endpoint", async () => {
    const key = process.env.VITE_YANDEX_MAPS_API_KEY;
    // Validate by requesting the JS API v2.1 loader
    const res = await fetch(
      `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`,
      { method: "HEAD", signal: AbortSignal.timeout(15000) }
    );
    // Yandex returns 200 for valid keys
    expect(res.status).toBe(200);
  }, 20000);
});
