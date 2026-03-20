/**
 * Local authentication module.
 * Handles registration, login, OTP verification, and password reset
 * independently of Manus OAuth, but produces the same JWT session tokens.
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import {
  authRateLimits,
  otpCodes,
  passwordResetTokens,
  users,
} from "../drizzle/schema";

import { getDb } from "./db";

// ─── Constants ───────────────────────────────────────────────

const SALT_ROUNDS = 12;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes
const OTP_MAX_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const PASSWORD_MIN_LENGTH = 8;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_OTP_SENDS = 5;

// ─── Password utilities ─────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
    };
  }
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password)) {
    return { valid: false, message: "Пароль должен содержать хотя бы одну букву" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Пароль должен содержать хотя бы одну цифру" };
  }
  return { valid: true };
}

// ─── OTP utilities ──────────────────────────────────────────

export function generateOtpCode(): string {
  // Cryptographically secure 6-digit code
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1000000;
  return num.toString().padStart(OTP_LENGTH, "0");
}

export async function createOtp(
  target: string,
  purpose: "registration" | "password_reset",
  channel: "email" | "phone"
): Promise<{ code: string; expiresAt: Date }> {
  const db = await getDb();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // Invalidate any previous unused codes for this target+purpose
  await db
    .update(otpCodes)
    .set({ verified: true }) // mark as used so they can't be reused
    .where(
      and(
        eq(otpCodes.target, target),
        eq(otpCodes.purpose, purpose),
        eq(otpCodes.verified, false)
      )
    );

  await db.insert(otpCodes).values({
    target,
    code,
    purpose,
    channel,
    attempts: 0,
    verified: false,
    expiresAt,
  });

  return { code, expiresAt };
}

export async function verifyOtp(
  target: string,
  code: string,
  purpose: "registration" | "password_reset"
): Promise<{ valid: boolean; message?: string }> {
  const db = await getDb();
  const now = new Date();

  // Find the latest unexpired, unverified code for this target+purpose
  const records = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.target, target),
        eq(otpCodes.purpose, purpose),
        eq(otpCodes.verified, false),
        gt(otpCodes.expiresAt, now)
      )
    )
    .orderBy(sql`${otpCodes.createdAt} DESC`)
    .limit(1);

  const otpRecord = records[0];
  if (!otpRecord) {
    return { valid: false, message: "Код истёк или не найден. Запросите новый код." };
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      valid: false,
      message: "Превышено количество попыток. Запросите новый код.",
    };
  }

  // Increment attempts
  await db
    .update(otpCodes)
    .set({ attempts: otpRecord.attempts + 1 })
    .where(eq(otpCodes.id, otpRecord.id));

  if (otpRecord.code !== code) {
    return { valid: false, message: "Неверный код. Попробуйте ещё раз." };
  }

  // Mark as verified
  await db
    .update(otpCodes)
    .set({ verified: true })
    .where(eq(otpCodes.id, otpRecord.id));

  return { valid: true };
}

// ─── Password reset tokens ─────────────────────────────────

export async function createPasswordResetToken(
  userOpenId: string
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Invalidate previous tokens
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(
      and(
        eq(passwordResetTokens.userOpenId, userOpenId),
        eq(passwordResetTokens.used, false)
      )
    );

  await db.insert(passwordResetTokens).values({
    userOpenId,
    token,
    used: false,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function verifyPasswordResetToken(
  token: string
): Promise<{ valid: boolean; userOpenId?: string; message?: string }> {
  const db = await getDb();
  const now = new Date();

  const records = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, now)
      )
    )
    .limit(1);

  const record = records[0];
  if (!record) {
    return { valid: false, message: "Ссылка для сброса пароля истекла или уже использована." };
  }

  return { valid: true, userOpenId: record.userOpenId };
}

export async function markResetTokenUsed(token: string): Promise<void> {
  const db = await getDb();
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.token, token));
}

// ─── User registration ──────────────────────────────────────

export async function registerLocalUser(data: {
  name: string;
  email: string;
  phone: string | null;
  password: string;
}): Promise<{ openId: string }> {
  const db = await getDb();

  // Generate a local openId
  const openId = `local_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const passwordHash = await hashPassword(data.password);

  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    phone: data.phone,
    passwordHash,
    loginMethod: "local",
    role: "user",
    lastSignedIn: new Date(),
    onboardingCompleted: false,
  });

  return { openId };
}

// ─── User lookup ────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const db = await getDb();
  const records = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return records[0] ?? null;
}

export async function getUserByPhone(phone: string) {
  const db = await getDb();
  const records = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  return records[0] ?? null;
}

export async function updateUserPassword(
  openId: string,
  newPassword: string
): Promise<void> {
  const db = await getDb();
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.openId, openId));
}

// ─── Rate limiting ──────────────────────────────────────────

export async function checkRateLimit(
  identifier: string,
  action: string,
  maxAttempts?: number
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const db = await getDb();
  const now = new Date();
  const limit = action === "login" ? MAX_LOGIN_ATTEMPTS : MAX_OTP_SENDS;
  const max = maxAttempts ?? limit;

  // Clean expired entries
  const records = await db
    .select()
    .from(authRateLimits)
    .where(
      and(
        eq(authRateLimits.identifier, identifier),
        eq(authRateLimits.action, action),
        gt(authRateLimits.windowExpiresAt, now)
      )
    )
    .limit(1);

  const record = records[0];
  if (!record) {
    // No active window — create one
    const windowExpiresAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS);
    await db.insert(authRateLimits).values({
      identifier,
      action,
      attempts: 1,
      windowExpiresAt,
    });
    return { allowed: true };
  }

  if (record.attempts >= max) {
    const retryAfterMs = record.windowExpiresAt.getTime() - now.getTime();
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  // Increment
  await db
    .update(authRateLimits)
    .set({ attempts: record.attempts + 1 })
    .where(eq(authRateLimits.id, record.id));

  return { allowed: true };
}

// ─── Email sending (stub — requires SMTP config) ────────────

/**
 * Send an OTP code via email.
 * In production, this would use Nodemailer or a transactional email service.
 * For now, we log the code and use the notifyOwner mechanism as a fallback.
 */
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: "registration" | "password_reset"
): Promise<boolean> {
  const purposeLabel =
    purpose === "registration" ? "регистрации" : "сброса пароля";

  console.log(
    `[LocalAuth] OTP for ${email} (${purposeLabel}): ${code}`
  );

  // Try to send via the notification service as a fallback
  try {
    const { notifyOwner } = await import("./_core/notification");
    await notifyOwner({
      title: `Код подтверждения для ${email}`,
      content: `Код для ${purposeLabel}: ${code}\n\nЕсли вы не запрашивали этот код, проигнорируйте это сообщение.`,
    });
  } catch (e) {
    console.warn("[LocalAuth] Could not send notification:", e);
  }

  return true;
}

/**
 * Send a password reset email with a link.
 * In production, this would send an actual email with a reset link.
 */
export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<boolean> {
  console.log(
    `[LocalAuth] Password reset code for ${email}: ${code}`
  );

  try {
    const { notifyOwner } = await import("./_core/notification");
    await notifyOwner({
      title: `Код сброса пароля для ${email}`,
      content: `Код для сброса пароля: ${code}\n\nЕсли вы не запрашивали сброс, проигнорируйте это сообщение.`,
    });
  } catch (e) {
    console.warn("[LocalAuth] Could not send notification:", e);
  }

  return true;
}
