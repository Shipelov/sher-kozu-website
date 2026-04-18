import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Security Headers Middleware", () => {
  const serverEntry = readFileSync(
    resolve(__dirname, "_core/index.ts"),
    "utf-8"
  );

  it("sets X-Content-Type-Options: nosniff", () => {
    expect(serverEntry).toContain(
      'res.setHeader("X-Content-Type-Options", "nosniff")'
    );
  });

  it("sets X-XSS-Protection", () => {
    expect(serverEntry).toContain(
      'res.setHeader("X-XSS-Protection", "1; mode=block")'
    );
  });

  it("sets Referrer-Policy", () => {
    expect(serverEntry).toContain(
      'res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")'
    );
  });

  it("sets X-Frame-Options to SAMEORIGIN (not DENY, for Manus Preview iframe)", () => {
    expect(serverEntry).toContain(
      'res.setHeader("X-Frame-Options", "SAMEORIGIN")'
    );
    expect(serverEntry).not.toContain('"X-Frame-Options", "DENY"');
  });

  it("sets Strict-Transport-Security in production", () => {
    expect(serverEntry).toContain("Strict-Transport-Security");
    expect(serverEntry).toContain("max-age=31536000");
  });

  it("sets Permissions-Policy to restrict sensitive APIs", () => {
    expect(serverEntry).toContain("Permissions-Policy");
    expect(serverEntry).toContain("camera=()");
    expect(serverEntry).toContain("microphone=()");
    expect(serverEntry).toContain("geolocation=()");
    expect(serverEntry).toContain("payment=()");
  });

  it("sets Content-Security-Policy only in production (to avoid blocking Vite HMR in dev)", () => {
    const cspIndex = serverEntry.indexOf("Content-Security-Policy");
    expect(cspIndex).toBeGreaterThan(-1);
    // Find the production check before CSP
    const beforeCsp = serverEntry.substring(0, cspIndex);
    const lastProdCheck = beforeCsp.lastIndexOf('NODE_ENV === "production"');
    expect(lastProdCheck).toBeGreaterThan(-1);
    // The production check should be close to CSP (within ~200 chars)
    expect(cspIndex - lastProdCheck).toBeLessThan(200);
  });

  it("CSP includes frame-ancestors for self and koza.vip", () => {
    expect(serverEntry).toContain("frame-ancestors");
    expect(serverEntry).toContain("https://koza.vip");
  });

  it("CSP includes Google Maps, OpenAI and Yandex Maps in connect-src", () => {
    expect(serverEntry).toContain("maps.googleapis.com");
    expect(serverEntry).toContain("api.openai.com");
    expect(serverEntry).toContain("api-maps.yandex.ru");
  });

  it("CSP includes yastatic.net for Yandex Maps JS bundle", () => {
    // Yandex Maps v2.1 loads its main JS bundle from yastatic.net
    expect(serverEntry).toContain("yastatic.net");
    // Must be in script-src (JS bundle) and connect-src (API calls)
    const scriptSrcMatch = serverEntry.match(/script-src[^;]+yastatic\.net/);
    expect(scriptSrcMatch).not.toBeNull();
    const connectSrcMatch = serverEntry.match(/connect-src[^;]+yastatic\.net/);
    expect(connectSrcMatch).not.toBeNull();
  });

  it("CSP includes ws: and wss: in connect-src for websocket support", () => {
    expect(serverEntry).toContain("ws:");
    expect(serverEntry).toContain("wss:");
  });

  it("security headers middleware is applied before routes", () => {
    const headersIndex = serverEntry.indexOf("Security headers");
    const oauthIndex = serverEntry.indexOf("OAuth callback");
    const trpcIndex = serverEntry.indexOf("/api/trpc");
    expect(headersIndex).toBeLessThan(oauthIndex);
    expect(headersIndex).toBeLessThan(trpcIndex);
  });
});
