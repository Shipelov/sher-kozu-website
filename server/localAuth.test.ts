import { describe, expect, it } from "vitest";
import {
  validatePasswordStrength,
  generateOtpCode,
  hashPassword,
  verifyPassword,
} from "./localAuth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helper to create a public (unauthenticated) context ────

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      ip: "127.0.0.1",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

// ─── Pure utility tests ─────────────────────────────────────

describe("validatePasswordStrength", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePasswordStrength("Ab1");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("8");
  });

  it("rejects passwords without letters", () => {
    const result = validatePasswordStrength("12345678");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("букву");
  });

  it("rejects passwords without digits", () => {
    const result = validatePasswordStrength("abcdefgh");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("цифру");
  });

  it("accepts valid passwords with Latin letters", () => {
    const result = validatePasswordStrength("MyPass123");
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("accepts valid passwords with Cyrillic letters", () => {
    const result = validatePasswordStrength("Пароль123");
    expect(result.valid).toBe(true);
  });

  it("accepts passwords with special characters", () => {
    const result = validatePasswordStrength("P@ssw0rd!");
    expect(result.valid).toBe(true);
  });
});

describe("generateOtpCode", () => {
  it("generates a 6-digit string", () => {
    const code = generateOtpCode();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it("generates different codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateOtpCode()));
    // With cryptographic randomness, 10 codes should be mostly unique
    expect(codes.size).toBeGreaterThanOrEqual(5);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("hashes and verifies correctly", async () => {
    const plain = "TestPassword123";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("CorrectPass1");
    const isValid = await verifyPassword("WrongPass1", hash);
    expect(isValid).toBe(false);
  });
});

// ─── tRPC procedure tests ───────────────────────────────────

describe("localAuth.register", () => {
  it("rejects weak password (no digits)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        name: "Тест Пользователь",
        email: "test-weak-pw@example.com",
        phone: null,
        password: "abcdefgh",
        verificationChannel: "email",
      })
    ).rejects.toThrow(/цифру/);
  });

  it("rejects weak password (too short)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        name: "Тест",
        email: "test-short-pw@example.com",
        phone: null,
        password: "Ab1",
        verificationChannel: "email",
      })
    ).rejects.toThrow(/8/);
  });

  it("rejects invalid phone format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        name: "Тест Пользователь",
        email: "test-bad-phone@example.com",
        phone: "123",
        password: "ValidPass1",
        verificationChannel: "email",
      })
    ).rejects.toThrow(/телефон/i);
  });
});

describe("localAuth.login", () => {
  it("rejects login with non-existent email", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.login({
        email: "nonexistent-user-xyz@example.com",
        password: "SomePass123",
        rememberMe: false,
      })
    ).rejects.toThrow(/email или пароль/);
  });
});

describe("localAuth.requestPasswordReset", () => {
  it("returns success even for non-existent email (prevents enumeration)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.requestPasswordReset({
      email: "nonexistent-reset-xyz@example.com",
    });

    expect(result.success).toBe(true);
    // Should not reveal whether the email exists
    expect(result.message).toBeTruthy();
  });
});

describe("localAuth.resetPassword", () => {
  it("rejects invalid OTP code", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.resetPassword({
        email: "test-reset@example.com",
        code: "000000",
        newPassword: "NewValidPass1",
      })
    ).rejects.toThrow(/код|истёк|не найден/i);
  });

  it("rejects weak new password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.resetPassword({
        email: "test-reset@example.com",
        code: "123456",
        newPassword: "weak",
      })
    ).rejects.toThrow();
  });
});

describe("localAuth.resendOtp", () => {
  it("creates and returns a new OTP expiry", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.resendOtp({
      target: "resend-test@example.com",
      purpose: "registration",
      channel: "email",
    });

    expect(result.success).toBe(true);
    expect(result.expiresAt).toBeTruthy();
    // expiresAt should be a valid ISO date string in the future
    const expiresDate = new Date(result.expiresAt);
    expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
  });
});
