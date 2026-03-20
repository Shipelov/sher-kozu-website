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
    plainPassword: data.password,
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
    .set({ passwordHash, plainPassword: newPassword, updatedAt: new Date() })
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

// ─── Email sending via Bitrix24 CRM ────────────────────────

import {
  findOrCreateBitrixContact,
  sendBitrixEmail,
  isBitrixConfigured,
} from "./bitrix24";

/**
 * Build a beautiful HTML email template for OTP codes.
 */
function buildOtpEmailHtml(code: string, purposeLabel: string): string {
  return `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf9f6; border-radius: 12px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #2d5016; margin: 0; font-size: 22px;">Шерь Козу</h2>
    <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">Персональное фермерство</p>
  </div>
  <div style="background: white; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ваш код для ${purposeLabel}:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2d5016; background: #f0fdf4; padding: 12px 24px; border-radius: 8px; display: inline-block;">${code}</span>
    </div>
    <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0; text-align: center;">Код действителен 3 минуты.<br/>Если вы не запрашивали этот код, проигнорируйте это сообщение.</p>
  </div>
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 16px 0 0;">© Шерь Козу — семейная ферма</p>
</div>
  `.trim();
}

/**
 * Send an OTP code via email using Bitrix24 CRM.
 * Falls back to notifyOwner if Bitrix24 is not configured.
 */
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: "registration" | "password_reset"
): Promise<boolean> {
  const purposeLabel =
    purpose === "registration" ? "регистрации" : "сброса пароля";

  console.log(`[LocalAuth] OTP for ${email} (${purposeLabel}): ${code}`);

  // Try Bitrix24 CRM email first
  if (isBitrixConfigured()) {
    try {
      const contactId = await findOrCreateBitrixContact({
        fullName: email.split("@")[0], // minimal name from email
        email,
      });

      if (contactId) {
        const sent = await sendBitrixEmail({
          contactId,
          toEmail: email,
          subject: `Код ${purposeLabel} — Шерь Козу`,
          htmlBody: buildOtpEmailHtml(code, purposeLabel),
        });
        if (sent) {
          console.log(`[LocalAuth] OTP email sent via Bitrix24 to ${email}`);
          return true;
        }
      }
    } catch (e) {
      console.warn("[LocalAuth] Bitrix24 email failed, falling back:", e);
    }
  }

  // Fallback: notify owner
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
 * Send a password reset email using Bitrix24 CRM.
 * Falls back to notifyOwner if Bitrix24 is not configured.
 */
export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<boolean> {
  console.log(`[LocalAuth] Password reset code for ${email}: ${code}`);

  // Try Bitrix24 CRM email first
  if (isBitrixConfigured()) {
    try {
      const contactId = await findOrCreateBitrixContact({
        fullName: email.split("@")[0],
        email,
      });

      if (contactId) {
        const sent = await sendBitrixEmail({
          contactId,
          toEmail: email,
          subject: "Сброс пароля — Шерь Козу",
          htmlBody: buildOtpEmailHtml(code, "сброса пароля"),
        });
        if (sent) {
          console.log(`[LocalAuth] Reset email sent via Bitrix24 to ${email}`);
          return true;
        }
      }
    } catch (e) {
      console.warn("[LocalAuth] Bitrix24 reset email failed, falling back:", e);
    }
  }

  // Fallback: notify owner
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
