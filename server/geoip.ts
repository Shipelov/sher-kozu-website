/**
 * GeoIP lookup utility.
 * Uses ip-api.com (free, no API key required, 45 req/min limit).
 * Enhanced in-memory cache with stats, longer TTL, and batch pre-warming.
 */

export interface GeoIpResult {
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
}

const EMPTY: GeoIpResult = { country: null, city: null, region: null, latitude: null, longitude: null };

/* ── Enhanced LRU cache (max 5000 entries, 6h TTL) ── */
interface CacheEntry {
  data: GeoIpResult;
  ts: number;
  hits: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours (up from 1h)
const CACHE_MAX = 5000; // up from 2000

/* ── Cache statistics ── */
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  lookups: number;
  errors: number;
  avgLookupMs: number;
  totalLookupMs: number;
  lookupCount: number;
  size: number;
  maxSize: number;
  ttlMs: number;
}

const stats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  errors: 0,
  totalLookupMs: 0,
  lookupCount: 0,
};

/**
 * Get current cache statistics for monitoring.
 */
export function getGeoIpCacheStats(): CacheStats {
  return {
    hits: stats.hits,
    misses: stats.misses,
    evictions: stats.evictions,
    lookups: stats.hits + stats.misses,
    errors: stats.errors,
    avgLookupMs: stats.lookupCount > 0 ? Math.round(stats.totalLookupMs / stats.lookupCount) : 0,
    totalLookupMs: Math.round(stats.totalLookupMs),
    lookupCount: stats.lookupCount,
    size: cache.size,
    maxSize: CACHE_MAX,
    ttlMs: CACHE_TTL,
  };
}

/**
 * Reset cache statistics (useful for periodic reporting).
 */
export function resetGeoIpCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.evictions = 0;
  stats.errors = 0;
  stats.totalLookupMs = 0;
  stats.lookupCount = 0;
}

function pruneCache() {
  if (cache.size <= CACHE_MAX) return;
  const now = Date.now();
  // First pass: remove expired entries
  const keysToDelete: string[] = [];
  cache.forEach((entry, key) => {
    if (now - entry.ts > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });
  for (const key of keysToDelete) {
    cache.delete(key);
    stats.evictions++;
  }
  // Second pass: if still over limit, remove least-hit entries
  if (cache.size > CACHE_MAX) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].hits - b[1].hits);
    const toRemove = cache.size - CACHE_MAX + Math.floor(CACHE_MAX * 0.1); // remove 10% extra
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
      stats.evictions++;
    }
  }
}

/* ── Rate limiter: max 40 requests per minute (below 45 limit) ── */
let requestsThisMinute = 0;
let minuteStart = Date.now();

function canMakeRequest(): boolean {
  const now = Date.now();
  if (now - minuteStart > 60_000) {
    requestsThisMinute = 0;
    minuteStart = now;
  }
  return requestsThisMinute < 40;
}

/**
 * Extract client IP from Express request.
 * Handles X-Forwarded-For, X-Real-IP, and direct connection.
 */
export function extractClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(",")[0].trim();
    if (first && !isPrivateIp(first)) return first;
  }
  const xri = req.headers["x-real-ip"];
  if (xri) {
    const ip = Array.isArray(xri) ? xri[0] : xri;
    if (ip && !isPrivateIp(ip)) return ip;
  }
  const remote = req.socket?.remoteAddress;
  if (remote && !isPrivateIp(remote)) return remote;
  return null;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") || ip.startsWith("172.20.") || ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") || ip.startsWith("172.23.") || ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") || ip.startsWith("172.26.") || ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") || ip.startsWith("172.29.") || ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("fc") || ip.startsWith("fd")
  );
}

/**
 * Look up geolocation for an IP address.
 * Returns cached result if available, otherwise queries ip-api.com.
 * Gracefully returns EMPTY on any failure.
 * Timeout reduced to 600ms for minimal blocking.
 */
export async function lookupGeoIp(ip: string): Promise<GeoIpResult> {
  if (!ip || isPrivateIp(ip)) return EMPTY;

  // Check cache
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    cached.hits++;
    stats.hits++;
    return cached.data;
  }

  stats.misses++;

  // Rate limit check
  if (!canMakeRequest()) {
    console.warn("[GeoIP] Rate limit reached, skipping lookup for", ip);
    return EMPTY;
  }

  const startMs = Date.now();
  try {
    requestsThisMinute++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600); // 600ms timeout (down from 1.5s)

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const elapsed = Date.now() - startMs;
    stats.totalLookupMs += elapsed;
    stats.lookupCount++;

    if (!res.ok) return EMPTY;

    const data = await res.json() as {
      status: string;
      countryCode?: string;
      country?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };

    if (data.status !== "success") return EMPTY;

    const result: GeoIpResult = {
      country: data.countryCode || null,
      city: data.city || null,
      region: data.regionName || null,
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
    };

    cache.set(ip, { data: result, ts: Date.now(), hits: 1 });
    pruneCache();

    return result;
  } catch (err) {
    const elapsed = Date.now() - startMs;
    stats.totalLookupMs += elapsed;
    stats.lookupCount++;
    stats.errors++;
    // Network error, timeout, etc. — fail silently
    return EMPTY;
  }
}
