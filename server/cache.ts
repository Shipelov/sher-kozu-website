/**
 * Simple in-memory TTL cache for server-side data.
 * Each key stores a value and a timestamp; entries expire after `ttlMs`.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TtlCache {
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

export const catalogCache = new TtlCache();

/** Cache key for the public animals catalog */
export const CATALOG_CACHE_KEY = "catalog:publicAnimals";

/** Default TTL: 60 seconds */
export const CATALOG_TTL_MS = 60_000;

/**
 * Call this after any mutation that affects the public catalog
 * (animal create/update/archive, ownership purchase, photo changes, etc.)
 */
export function invalidateCatalogCache(): void {
  catalogCache.invalidate(CATALOG_CACHE_KEY);
}
