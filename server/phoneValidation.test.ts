import { describe, expect, it } from "vitest";
import {
  applyPhoneMask,
  extractPhoneDigits,
  formatPhone,
  formatPhoneDisplay,
  isValidRussianPhone,
  stripNonDigits,
} from "../shared/phone";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Shared phone utilities ──

describe("stripNonDigits", () => {
  it("removes all non-digit characters", () => {
    expect(stripNonDigits("+7 (912) 345-67-89")).toBe("79123456789");
    expect(stripNonDigits("8-912-345-67-89")).toBe("89123456789");
    expect(stripNonDigits("abc")).toBe("");
    expect(stripNonDigits("")).toBe("");
  });
});

describe("extractPhoneDigits", () => {
  it("extracts 10 core digits from +7 format", () => {
    expect(extractPhoneDigits("+7 (912) 345-67-89")).toBe("9123456789");
  });

  it("extracts 10 core digits from 8 format", () => {
    expect(extractPhoneDigits("8-912-345-67-89")).toBe("9123456789");
    expect(extractPhoneDigits("89123456789")).toBe("9123456789");
  });

  it("extracts 10 core digits from plain 10-digit input", () => {
    expect(extractPhoneDigits("9123456789")).toBe("9123456789");
  });

  it("returns null for too short numbers", () => {
    expect(extractPhoneDigits("912345")).toBeNull();
    expect(extractPhoneDigits("+7 912")).toBeNull();
  });

  it("returns null for too long numbers", () => {
    expect(extractPhoneDigits("791234567890")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractPhoneDigits("")).toBeNull();
  });
});

describe("formatPhoneDisplay", () => {
  it("formats 10 digits into canonical display", () => {
    expect(formatPhoneDisplay("9123456789")).toBe("+7 (912) 345-67-89");
  });

  it("returns input unchanged if not 10 digits", () => {
    expect(formatPhoneDisplay("12345")).toBe("12345");
  });
});

describe("formatPhone", () => {
  it("formats +7 input to canonical form", () => {
    expect(formatPhone("+7 (912) 345-67-89")).toBe("+7 (912) 345-67-89");
    expect(formatPhone("+79123456789")).toBe("+7 (912) 345-67-89");
  });

  it("formats 8-prefix input to canonical form", () => {
    expect(formatPhone("89123456789")).toBe("+7 (912) 345-67-89");
    expect(formatPhone("8 912 345 67 89")).toBe("+7 (912) 345-67-89");
  });

  it("formats plain 10-digit input", () => {
    expect(formatPhone("9123456789")).toBe("+7 (912) 345-67-89");
  });

  it("returns null for invalid input", () => {
    expect(formatPhone("123")).toBeNull();
    expect(formatPhone("")).toBeNull();
    expect(formatPhone("abc")).toBeNull();
  });
});

describe("isValidRussianPhone", () => {
  it("validates correct numbers", () => {
    expect(isValidRussianPhone("+7 (912) 345-67-89")).toBe(true);
    expect(isValidRussianPhone("89123456789")).toBe(true);
    expect(isValidRussianPhone("9123456789")).toBe(true);
    expect(isValidRussianPhone("+7 999 111 22 33")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidRussianPhone("123")).toBe(false);
    expect(isValidRussianPhone("")).toBe(false);
    expect(isValidRussianPhone("+1 555 123 4567")).toBe(false);
  });
});

describe("applyPhoneMask", () => {
  it("returns prefix for empty-ish input", () => {
    expect(applyPhoneMask("7")).toBe("+7 ");
    expect(applyPhoneMask("+7")).toBe("+7 ");
  });

  it("progressively formats as digits are added", () => {
    expect(applyPhoneMask("+79")).toBe("+7 (9");
    expect(applyPhoneMask("+791")).toBe("+7 (91");
    expect(applyPhoneMask("+7912")).toBe("+7 (912");
    expect(applyPhoneMask("+79123")).toBe("+7 (912) 3");
    expect(applyPhoneMask("+791234")).toBe("+7 (912) 34");
    expect(applyPhoneMask("+7912345")).toBe("+7 (912) 345");
    expect(applyPhoneMask("+79123456")).toBe("+7 (912) 345-6");
    expect(applyPhoneMask("+791234567")).toBe("+7 (912) 345-67");
    expect(applyPhoneMask("+7912345678")).toBe("+7 (912) 345-67-8");
    expect(applyPhoneMask("+79123456789")).toBe("+7 (912) 345-67-89");
  });

  it("handles 8-prefix input", () => {
    expect(applyPhoneMask("89123456789")).toBe("+7 (912) 345-67-89");
    expect(applyPhoneMask("8912")).toBe("+7 (912");
  });

  it("limits to 10 core digits", () => {
    expect(applyPhoneMask("+791234567890")).toBe("+7 (912) 345-67-89");
  });
});

// ── Server-side validation via tRPC ──

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "phone-test-user",
    email: "test@example.com",
    name: "Phone Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("auth.updateProfile — phone validation (server)", () => {
  it("accepts a valid formatted phone", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      phone: "+7 (912) 345-67-89",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts a valid unformatted phone and normalizes it", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      phone: "89123456789",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts null phone (clearing)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      phone: null,
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an invalid phone number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.updateProfile({
        phone: "123",
      }),
    ).rejects.toThrow(/корректный российский номер/i);
  });

  it("rejects a non-Russian phone number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.updateProfile({
        phone: "+1 555 123 4567",
      }),
    ).rejects.toThrow(/корректный российский номер/i);
  });
});
