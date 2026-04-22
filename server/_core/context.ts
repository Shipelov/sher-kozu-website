import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Retry a function up to `maxRetries` times with a delay between attempts.
 * Only retries on ETIMEDOUT / ECONNRESET errors (transient DB issues).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 1,
  delayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const code = err?.code || err?.cause?.code || "";
      const isTransient = code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED";
      if (!isTransient || attempt >= maxRetries) throw err;
      console.warn(`[Context] Transient DB error (${code}), retrying in ${delayMs}ms… (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Try Telegram Mini App JWT (Authorization: Bearer <token>)
  const authHeader = opts.req.headers.authorization;
  if (authHeader?.startsWith("Bearer tgma_")) {
    try {
      const { verifyMiniAppToken } = await import("../telegramMiniApp");
      const token = authHeader.slice(7); // remove "Bearer "
      user = await verifyMiniAppToken(token.replace("tgma_", ""));
      if (user && user.deletedAt) user = null;
    } catch {
      user = null;
    }
  }

  // 2. Fall back to standard Manus OAuth cookie (with retry for transient DB errors)
  if (!user) {
    try {
      user = await withRetry(() => sdk.authenticateRequest(opts.req));
      // Block access for soft-deleted users (in trash)
      if (user && user.deletedAt) {
        user = null;
      }
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
