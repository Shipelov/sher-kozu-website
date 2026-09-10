/**
 * In-memory rate limit чата Маши, общий для tRPC-мутации и SSE-эндпоинта.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
export const CHAT_RATE_LIMIT = 20; // сообщений в окно
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 час
const RATE_PRUNE_INTERVAL_MS = 10 * 60 * 1000;
let lastPruneAt = 0;

/** Удаляет просроченные записи, иначе Map растёт бесконечно. */
export function pruneExpiredRateLimits(now = Date.now()): number {
  let removed = 0;
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
      removed += 1;
    }
  });
  lastPruneAt = now;
  return removed;
}

export function checkChatRateLimit(ip: string, now = Date.now()): boolean {
  if (now - lastPruneAt > RATE_PRUNE_INTERVAL_MS) {
    pruneExpiredRateLimits(now);
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= CHAT_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export function resetChatRateLimit(): void {
  rateLimitMap.clear();
  lastPruneAt = 0;
}

export function chatRateLimitSize(): number {
  return rateLimitMap.size;
}
