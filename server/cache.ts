/**
 * Simple in-memory TTL cache for server-side data.
 * Each key stores a value and a timestamp; entries expire after `ttlMs`.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    const keys = Array.from(this.store.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/* ── Catalog (animals) cache ── */

export const catalogCache = new TtlCache();

/** Cache key for the public animals catalog */
export const CATALOG_CACHE_KEY = "catalog:publicAnimals";

/** Default TTL: 2 minutes (upgraded from 60s for better performance) */
export const CATALOG_TTL_MS = 120_000;

/**
 * Call this after any mutation that affects the public catalog
 * (animal create/update/archive, ownership purchase, photo changes, etc.)
 */
export function invalidateCatalogCache(): void {
  catalogCache.invalidate(CATALOG_CACHE_KEY);
}

/* ── CMS blocks cache ── */

export const cmsCache = new TtlCache();

/** CMS cache key prefix — each page gets its own cache entry */
export const CMS_CACHE_PREFIX = "cms:page:";

/** CMS TTL: 5 minutes for public page blocks */
export const CMS_TTL_MS = 5 * 60 * 1000;

/**
 * Build a cache key for a specific CMS page.
 * @param page - The page identifier (e.g., "home", "about", "pricing")
 * @param includeHidden - Whether hidden blocks are included
 */
export function cmsCacheKey(page: string, includeHidden: boolean): string {
  return `${CMS_CACHE_PREFIX}${page}:${includeHidden ? "all" : "visible"}`;
}

/**
 * Invalidate CMS cache for a specific page (both visible-only and all variants).
 */
export function invalidateCmsPageCache(page: string): void {
  cmsCache.invalidate(cmsCacheKey(page, false));
  cmsCache.invalidate(cmsCacheKey(page, true));
}

/**
 * Invalidate all CMS cache entries across all pages.
 * Call after bulk operations (reorder, seed defaults, etc.)
 */
export function invalidateAllCmsCache(): void {
  cmsCache.invalidatePrefix(CMS_CACHE_PREFIX);
}
