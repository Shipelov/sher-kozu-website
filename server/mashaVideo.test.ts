import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  new URL("../client/src/pages/Home.tsx", import.meta.url),
  "utf8",
);
const serverSource = readFileSync(
  new URL("./_core/index.ts", import.meta.url),
  "utf8",
);
const proxySource = readFileSync(
  new URL("./mashaVideoProxy.ts", import.meta.url),
  "utf8",
);

describe("Masha intro video delivery", () => {
  it("uses the permanent storage path with an explicit browser-compatible MIME", () => {
    expect(homeSource).toContain(
      'src="/api/media/masha-intro.mp4"',
    );
    expect(homeSource).toContain('type="video/mp4"');
    expect(homeSource).not.toContain("masha-intro-video-compressed_ee7518ad.mp4");
  });

  it("shows a retry fallback when the browser cannot load the media", () => {
    expect(homeSource).toContain("onError={() => setMashaVideoError(true)}");
    expect(homeSource).toContain("Не удалось загрузить видео Маши");
    expect(homeSource).toContain("Повторить");
  });

  it("registers same-origin media delivery before OAuth", () => {
    const storageIndex = serverSource.indexOf("registerMashaVideoProxy(app)");
    const oauthIndex = serverSource.indexOf("registerOAuthRoutes(app)");

    expect(storageIndex).toBeGreaterThan(-1);
    expect(oauthIndex).toBeGreaterThan(storageIndex);
  });

  it("forces video/mp4 while preserving byte-range playback", () => {
    expect(proxySource).toContain('res.setHeader("Content-Type", "video/mp4")');
    expect(proxySource).toContain('res.setHeader("Accept-Ranges", "bytes")');
    expect(proxySource).toContain("...(range ? { Range: range } : {})");
    expect(proxySource).toContain('"content-range"');
  });
});
