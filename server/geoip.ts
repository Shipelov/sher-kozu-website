/**
 * GeoIP lookup utility.
 * Uses ip-api.com (free, no API key required, 45 req/min limit).
 * Includes in-memory cache to avoid redundant lookups.
 */

export interface GeoIpResult {
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
}

const EMPTY: GeoIpResult = { country: null, city: null, region: null, latitude: null, longitude: null };

/* ── Simple LRU-ish cache (max 2000 entries, 1h TTL) ── */
const cache = new Map<string, { data: GeoIpResult; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 2000;

function pruneCache() {
  if (cache.size <= CACHE_MAX) return;
  const now = Date.now();
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    const entry = cache.get(key);
    if (!entry || now - entry.ts > CACHE_TTL || cache.size > CACHE_MAX) {
      cache.delete(key);
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
 */
export async function lookupGeoIp(ip: string): Promise<GeoIpResult> {
  if (!ip || isPrivateIp(ip)) return EMPTY;

  // Check cache
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Rate limit check
  if (!canMakeRequest()) {
    console.warn("[GeoIP] Rate limit reached, skipping lookup for", ip);
    return EMPTY;
  }

  try {
    requestsThisMinute++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

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

    cache.set(ip, { data: result, ts: Date.now() });
    pruneCache();

    return result;
  } catch (err) {
    // Network error, timeout, etc. — fail silently
    return EMPTY;
  }
}
