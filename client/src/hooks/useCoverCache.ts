/**
 * useCoverCache — localStorage cache for animal cover image URLs.
 *
 * On first visit the cover URL is fetched from the server (normal flow).
 * Once loaded, the URL is persisted in localStorage keyed by animal slug.
 * On subsequent visits the cached URL is returned immediately so the image
 * can start loading before the tRPC query resolves.
 *
 * Cache entries expire after 24 hours to pick up admin photo changes.
 */

const CACHE_PREFIX = "sher_cover_";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CacheEntry = {
  url: string;
  ts: number; // timestamp when cached
};

function getKey(slug: string) {
  return `${CACHE_PREFIX}${slug}`;
}

/** Read cached cover URL for a given animal slug. Returns null if missing/expired. */
export function getCachedCover(slug: string | null | undefined): string | null {
  if (!slug) return null;
  try {
    const raw = localStorage.getItem(getKey(slug));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(getKey(slug));
      return null;
    }
    return entry.url;
  } catch {
    return null;
  }
}

/** Persist cover URL for a given animal slug. */
export function setCachedCover(slug: string | null | undefined, url: string): void {
  if (!slug || !url) return;
  try {
    const entry: CacheEntry = { url, ts: Date.now() };
    localStorage.setItem(getKey(slug), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Remove cached cover for a given animal slug (e.g. after admin changes cover). */
export function clearCachedCover(slug: string | null | undefined): void {
  if (!slug) return;
  try {
    localStorage.removeItem(getKey(slug));
  } catch {
    // ignore
  }
}

/**
 * React hook that returns the best available cover URL:
 * 1. Server-provided URL (highest priority, always wins when available)
 * 2. localStorage cached URL (used while server data is loading)
 * 3. null (nothing available yet)
 *
 * Also persists the server URL to cache once it arrives.
 */
export function useCoverCache(
  slug: string | null | undefined,
  serverCoverUrl: string | null | undefined
): string | null {
  // If server has provided a valid URL, cache it and return it
  if (serverCoverUrl && serverCoverUrl !== "NULL") {
    setCachedCover(slug, serverCoverUrl);
    return serverCoverUrl;
  }

  // Otherwise return cached version while waiting for server
  return getCachedCover(slug);
}
