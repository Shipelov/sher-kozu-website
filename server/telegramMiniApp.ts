/**
 * Telegram Mini App — server-side auth bridge
 *
 * Validates Telegram WebApp initData using HMAC-SHA256,
 * maps the Telegram user to our DB user via telegramChatId,
 * and returns a short-lived JWT for tRPC calls from the Mini App.
 */

import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import type { User } from "../drizzle/schema";

const TG_AUTH_TTL = 60 * 60 * 4; // 4 hours

/** Validate Telegram WebApp initData */
export function validateInitData(initData: string, botToken: string): boolean {
  if (!initData) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  // Remove hash from params and sort alphabetically
  params.delete("hash");
  const entries = Array.from(params.entries());
  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  // HMAC-SHA256 with "WebAppData" + bot token
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}

/** Extract user from initData */
export function extractTelegramUser(initData: string): {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
} | null {
  const params = new URLSearchParams(initData);
  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/** Create a JWT for Mini App session */
async function createMiniAppToken(user: User): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({
    sub: user.openId,
    userId: user.id,
    name: user.name,
    role: user.role,
    source: "telegram-miniapp",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TG_AUTH_TTL}s`)
    .sign(secret);
}

/** Verify a Mini App JWT and return user */
export async function verifyMiniAppToken(token: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    if (payload.source !== "telegram-miniapp" || !payload.sub) return null;

    const db = await getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.openId, payload.sub as string))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

/** Register Mini App auth routes */
export function registerTelegramMiniAppRoutes(app: Express) {
  // POST /api/tg-auth — validate initData, return JWT
  app.post("/api/tg-auth", async (req: Request, res: Response) => {
    try {
      const { initData } = req.body as { initData?: string };
      if (!initData) {
        return res.status(400).json({ error: "Missing initData" });
      }

      if (!ENV.telegramBotToken) {
        return res.status(500).json({ error: "Bot token not configured" });
      }

      // Validate initData
      if (!validateInitData(initData, ENV.telegramBotToken)) {
        return res.status(401).json({ error: "Invalid initData" });
      }

      // Extract Telegram user
      const tgUser = extractTelegramUser(initData);
      if (!tgUser) {
        return res.status(400).json({ error: "No user in initData" });
      }

      // Find our user by telegramChatId
      const db = await getDb();
      const chatId = String(tgUser.id);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegramChatId, chatId))
        .limit(1);

      if (!user) {
        return res.status(404).json({
          error: "account_not_linked",
          message:
            "Ваш Telegram не привязан к аккаунту Шерь Козу. Привяжите его через сайт koza.vip → Мой кабинет.",
        });
      }

      if (user.deletedAt) {
        return res.status(403).json({ error: "Account suspended" });
      }

      // Issue JWT
      const token = await createMiniAppToken(user);

      return res.json({
        token: `tgma_${token}`,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (err) {
      console.error("[TG Mini App] Auth error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
