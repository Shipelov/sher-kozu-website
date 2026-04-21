/**
 * Farm Worker Authentication Module.
 *
 * Separate auth system for farm staff (milkers, cheesemakers).
 * Uses JWT tokens stored in a dedicated cookie, bcrypt password hashing,
 * and the farmWorkers table — completely independent from site user auth.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { farmWorkers, milkAuditLog } from "../drizzle/schema";
import type { FarmWorker } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

// ─── Constants ───────────────────────────────────────────────

const SALT_ROUNDS = 12;
const FARM_JWT_SECRET = ENV.cookieSecret + "_farm"; // Derived from main secret
export const FARM_COOKIE_NAME = "farm_session";
const FARM_TOKEN_EXPIRY = "7d";
const PASSWORD_MIN_LENGTH = 6;

// ─── Types ───────────────────────────────────────────────────

export interface FarmWorkerJwtPayload {
  workerId: number;
  login: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface FarmAuthResult {
  success: boolean;
  worker?: FarmWorker;
  token?: string;
  mustChangePassword?: boolean;
  error?: string;
}

// ─── Password Utilities ──────────────────────────────────────

export async function hashFarmPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyFarmPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validateFarmPasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
    };
  }
  return { valid: true };
}

// ─── JWT Utilities ───────────────────────────────────────────

export function signFarmToken(worker: FarmWorker): string {
  const payload: FarmWorkerJwtPayload = {
    workerId: worker.id,
    login: worker.login,
    role: worker.role,
  };
  return jwt.sign(payload, FARM_JWT_SECRET, { expiresIn: FARM_TOKEN_EXPIRY });
}

export function verifyFarmToken(token: string): FarmWorkerJwtPayload | null {
  try {
    return jwt.verify(token, FARM_JWT_SECRET) as FarmWorkerJwtPayload;
  } catch {
    return null;
  }
}

// ─── DB Helpers ──────────────────────────────────────────────

export async function getFarmWorkerByLogin(
  login: string,
): Promise<FarmWorker | null> {
  const db = await getDb();
  const [worker] = await db
    .select()
    .from(farmWorkers)
    .where(eq(farmWorkers.login, login.toLowerCase().trim()))
    .limit(1);
  return worker ?? null;
}

export async function getFarmWorkerById(
  id: number,
): Promise<FarmWorker | null> {
  const db = await getDb();
  const [worker] = await db
    .select()
    .from(farmWorkers)
    .where(eq(farmWorkers.id, id))
    .limit(1);
  return worker ?? null;
}

export async function getFarmWorkerByTelegramChatId(
  chatId: string,
): Promise<FarmWorker | null> {
  const db = await getDb();
  const [worker] = await db
    .select()
    .from(farmWorkers)
    .where(eq(farmWorkers.telegramChatId, chatId))
    .limit(1);
  return worker ?? null;
}

export async function listFarmWorkers(): Promise<FarmWorker[]> {
  const db = await getDb();
  return db.select().from(farmWorkers).orderBy(farmWorkers.name);
}

export async function createFarmWorker(data: {
  login: string;
  name: string;
  password: string;
  role: "milker" | "cheesemaker" | "vet" | "manager";
}): Promise<FarmWorker> {
  const db = await getDb();
  const passwordHash = await hashFarmPassword(data.password);
  const [result] = await db.insert(farmWorkers).values({
    login: data.login.toLowerCase().trim(),
    name: data.name,
    passwordHash,
    role: data.role,
    mustChangePassword: true,
  });
  const [worker] = await db
    .select()
    .from(farmWorkers)
    .where(eq(farmWorkers.id, result.insertId))
    .limit(1);
  return worker;
}

export async function updateFarmWorkerPassword(
  workerId: number,
  newPassword: string,
): Promise<void> {
  const db = await getDb();
  const passwordHash = await hashFarmPassword(newPassword);
  await db
    .update(farmWorkers)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(farmWorkers.id, workerId));
}

export async function setFarmWorkerTelegramChatId(
  workerId: number,
  chatId: string,
): Promise<void> {
  const db = await getDb();
  await db
    .update(farmWorkers)
    .set({ telegramChatId: chatId })
    .where(eq(farmWorkers.id, workerId));
}

export async function toggleFarmWorkerActive(
  workerId: number,
  isActive: boolean,
): Promise<void> {
  const db = await getDb();
  await db
    .update(farmWorkers)
    .set({ isActive })
    .where(eq(farmWorkers.id, workerId));
}

// ─── Auth Flow ───────────────────────────────────────────────

export async function loginFarmWorker(
  login: string,
  password: string,
): Promise<FarmAuthResult> {
  const worker = await getFarmWorkerByLogin(login);

  if (!worker) {
    return { success: false, error: "Неверный логин или пароль" };
  }

  if (!worker.isActive) {
    return { success: false, error: "Аккаунт деактивирован. Обратитесь к администратору." };
  }

  const valid = await verifyFarmPassword(password, worker.passwordHash);
  if (!valid) {
    return { success: false, error: "Неверный логин или пароль" };
  }

  // Update last login
  const db = await getDb();
  await db
    .update(farmWorkers)
    .set({ lastLoginAt: new Date() })
    .where(eq(farmWorkers.id, worker.id));

  const token = signFarmToken(worker);

  // Audit log
  await logMilkAudit({
    action: "worker_login",
    workerId: worker.id,
    entityType: "worker",
    entityId: worker.id,
    detailsJson: JSON.stringify({ login: worker.login }),
  });

  return {
    success: true,
    worker,
    token,
    mustChangePassword: worker.mustChangePassword,
  };
}

export async function changeFarmWorkerPassword(
  workerId: number,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const worker = await getFarmWorkerById(workerId);
  if (!worker) {
    return { success: false, error: "Сотрудник не найден" };
  }

  // Verify current password (skip if mustChangePassword — first login)
  if (!worker.mustChangePassword) {
    const valid = await verifyFarmPassword(currentPassword, worker.passwordHash);
    if (!valid) {
      return { success: false, error: "Текущий пароль неверен" };
    }
  }

  const strength = validateFarmPasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.message };
  }

  await updateFarmWorkerPassword(workerId, newPassword);

  // Audit log
  await logMilkAudit({
    action: "worker_password_changed",
    workerId,
    entityType: "worker",
    entityId: workerId,
  });

  return { success: true };
}

// ─── Audit Log Helper ────────────────────────────────────────

export async function logMilkAudit(data: {
  action: typeof milkAuditLog.$inferInsert["action"];
  workerId?: number | null;
  adminOpenId?: string | null;
  entityType: string;
  entityId: number;
  detailsJson?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(milkAuditLog).values({
      action: data.action,
      workerId: data.workerId ?? null,
      adminOpenId: data.adminOpenId ?? null,
      entityType: data.entityType,
      entityId: data.entityId,
      detailsJson: data.detailsJson ?? null,
      ipAddress: data.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[MilkAudit] Failed to log:", err);
  }
}
