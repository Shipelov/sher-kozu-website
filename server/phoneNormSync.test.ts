import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { formatPhone } from "../shared/phone";

/**
 * Tests for phone normalization across all entry points:
 * 1. Bitrix24 sync (syncBitrixContacts) — normalizes incoming phones
 * 2. Registration (verifyRegistration) — normalizes before saving
 * 3. Profile update (updateProfile) — already had normalization
 * 4. formatPhone utility — canonical format +7 (XXX) XXX-XX-XX
 */

const routersSource = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");

describe("formatPhone — canonical format +7 (XXX) XXX-XX-XX", () => {
  it("normalizes +79851234567 to +7 (985) 123-45-67", () => {
    expect(formatPhone("+79851234567")).toBe("+7 (985) 123-45-67");
  });

  it("normalizes +7 (985) 763-93-53 to same format (idempotent)", () => {
    expect(formatPhone("+7 (985) 763-93-53")).toBe("+7 (985) 763-93-53");
  });

  it("normalizes 89211111313 to +7 (921) 111-13-13", () => {
    expect(formatPhone("89211111313")).toBe("+7 (921) 111-13-13");
  });

  it("normalizes +7 985 763 93 53 (spaces) to canonical", () => {
    expect(formatPhone("+7 985 763 93 53")).toBe("+7 (985) 763-93-53");
  });

  it("normalizes 7-985-763-93-53 (dashes) to canonical", () => {
    expect(formatPhone("7-985-763-93-53")).toBe("+7 (985) 763-93-53");
  });

  it("normalizes 9851234567 (10 digits) to canonical", () => {
    expect(formatPhone("9851234567")).toBe("+7 (985) 123-45-67");
  });

  it("returns null for invalid input", () => {
    expect(formatPhone("123")).toBeNull();
    expect(formatPhone("")).toBeNull();
    expect(formatPhone("+1 555 123 4567")).toBeNull();
  });

  it("different Bitrix formats all normalize to same result", () => {
    const variants = [
      "+79857639353",
      "+7 (985) 763-93-53",
      "+7 985 763 93 53",
      "89857639353",
      "8 (985) 763-93-53",
      "8-985-763-93-53",
      "9857639353",
    ];
    const expected = "+7 (985) 763-93-53";
    for (const v of variants) {
      expect(formatPhone(v)).toBe(expected);
    }
  });
});

describe("syncBitrixContacts — phone normalization in Bitrix sync", () => {
  it("imports formatPhone for normalization", () => {
    expect(routersSource).toContain('const { formatPhone: normalizePhoneSync } = await import("../shared/phone")');
  });

  it("normalizes raw phone from Bitrix contact", () => {
    expect(routersSource).toContain("const rawPhone = contact.PHONE?.[0]?.VALUE ?? null;");
    expect(routersSource).toContain("const phone = rawPhone ? (normalizePhoneSync(rawPhone) ?? rawPhone) : null;");
  });

  it("indexes existing users by normalized phone for cross-format matching", () => {
    expect(routersSource).toContain("const normalized = normalizePhoneSync(u.phone)");
    expect(routersSource).toContain("if (normalized && normalized !== u.phone) byPhone.set(normalized, u)");
  });
});

describe("verifyRegistration — phone normalization on registration", () => {
  it("normalizes phone before saving user", () => {
    const verifySection = routersSource.slice(
      routersSource.indexOf("verifyRegistration: publicProcedure"),
      routersSource.indexOf("verifyRegistration: publicProcedure") + 2000,
    );
    expect(verifySection).toContain("normalizedRegPhone");
    expect(verifySection).toContain('formatPhone: fmtPhone');
    expect(verifySection).toContain("phone: normalizedRegPhone");
  });
});

describe("updateProfile — phone normalization on profile update", () => {
  it("normalizes phone in updateProfile mutation", () => {
    const profileSection = routersSource.slice(
      routersSource.indexOf("updateProfile: protectedProcedure"),
      routersSource.indexOf("updateProfile: protectedProcedure") + 1000,
    );
    expect(profileSection).toContain("formatPhone");
    expect(profileSection).toContain("normalizedPhone");
    expect(profileSection).toContain("phone: normalizedPhone");
  });
});
