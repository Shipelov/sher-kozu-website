import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── useCoverCache tests (pure functions, no DOM needed) ───

// We test the cache functions directly since they're pure localStorage wrappers
describe("Cover Cache (localStorage)", () => {
  // Mock localStorage
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  it("getCachedCover returns null for missing slug", async () => {
    const { getCachedCover } = await import("../client/src/hooks/useCoverCache");
    expect(getCachedCover(null)).toBeNull();
    expect(getCachedCover(undefined)).toBeNull();
    expect(getCachedCover("")).toBeNull();
  });

  it("setCachedCover + getCachedCover round-trips correctly", async () => {
    const { getCachedCover, setCachedCover } = await import("../client/src/hooks/useCoverCache");
    const url = "https://cdn.example.com/mira-cover.jpg";
    setCachedCover("mira", url);
    expect(getCachedCover("mira")).toBe(url);
  });

  it("getCachedCover returns null for expired entries", async () => {
    const { getCachedCover } = await import("../client/src/hooks/useCoverCache");
    // Manually insert an expired entry (25 hours ago)
    const expired = { url: "https://cdn.example.com/old.jpg", ts: Date.now() - 25 * 60 * 60 * 1000 };
    store["sher_cover_zlata"] = JSON.stringify(expired);
    expect(getCachedCover("zlata")).toBeNull();
    // Should also clean up the entry
    expect(store["sher_cover_zlata"]).toBeUndefined();
  });

  it("getCachedCover returns valid entry within TTL", async () => {
    const { getCachedCover } = await import("../client/src/hooks/useCoverCache");
    const fresh = { url: "https://cdn.example.com/fresh.jpg", ts: Date.now() - 1000 };
    store["sher_cover_rufa"] = JSON.stringify(fresh);
    expect(getCachedCover("rufa")).toBe("https://cdn.example.com/fresh.jpg");
  });

  it("clearCachedCover removes the entry", async () => {
    const { setCachedCover, getCachedCover, clearCachedCover } = await import("../client/src/hooks/useCoverCache");
    setCachedCover("lola", "https://cdn.example.com/lola.jpg");
    expect(getCachedCover("lola")).toBe("https://cdn.example.com/lola.jpg");
    clearCachedCover("lola");
    expect(getCachedCover("lola")).toBeNull();
  });

  it("setCachedCover ignores null/undefined slug", async () => {
    const { setCachedCover } = await import("../client/src/hooks/useCoverCache");
    setCachedCover(null, "https://cdn.example.com/test.jpg");
    setCachedCover(undefined, "https://cdn.example.com/test.jpg");
    expect(Object.keys(store).length).toBe(0);
  });

  it("setCachedCover ignores empty url", async () => {
    const { setCachedCover, getCachedCover } = await import("../client/src/hooks/useCoverCache");
    setCachedCover("mira", "");
    expect(getCachedCover("mira")).toBeNull();
  });

  it("getCachedCover handles corrupted JSON gracefully", async () => {
    const { getCachedCover } = await import("../client/src/hooks/useCoverCache");
    store["sher_cover_broken"] = "not-json{{{";
    expect(getCachedCover("broken")).toBeNull();
  });

  it("useCoverCache returns serverCoverUrl when available", async () => {
    const { useCoverCache } = await import("../client/src/hooks/useCoverCache");
    const result = useCoverCache("mira", "https://cdn.example.com/server.jpg");
    expect(result).toBe("https://cdn.example.com/server.jpg");
  });

  it("useCoverCache returns cached URL when server URL is null", async () => {
    const { useCoverCache, setCachedCover } = await import("../client/src/hooks/useCoverCache");
    setCachedCover("mira", "https://cdn.example.com/cached.jpg");
    const result = useCoverCache("mira", null);
    expect(result).toBe("https://cdn.example.com/cached.jpg");
  });

  it("useCoverCache returns null when no server URL and no cache", async () => {
    const { useCoverCache } = await import("../client/src/hooks/useCoverCache");
    const result = useCoverCache("nonexistent", null);
    expect(result).toBeNull();
  });

  it("useCoverCache ignores 'NULL' string as server URL", async () => {
    const { useCoverCache, setCachedCover } = await import("../client/src/hooks/useCoverCache");
    setCachedCover("mira", "https://cdn.example.com/cached.jpg");
    const result = useCoverCache("mira", "NULL");
    expect(result).toBe("https://cdn.example.com/cached.jpg");
  });

  it("useCoverCache caches server URL for future use", async () => {
    const { useCoverCache, getCachedCover } = await import("../client/src/hooks/useCoverCache");
    useCoverCache("mira", "https://cdn.example.com/new-server.jpg");
    expect(getCachedCover("mira")).toBe("https://cdn.example.com/new-server.jpg");
  });
});

// ─── LazyImage component structure tests ───

describe("LazyImage component", () => {
  it("exports a default function", async () => {
    // Just verify the module loads and exports correctly
    const mod = await import("../client/src/components/LazyImage");
    expect(typeof mod.default).toBe("function");
  });
});
