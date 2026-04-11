import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

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

  // 2. Fall back to standard Manus OAuth cookie
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
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
