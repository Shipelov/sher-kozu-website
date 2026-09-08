import { describe, expect, it, vi, afterEach } from "vitest";
import { maskEmail } from "./logSafety";

describe("maskEmail", () => {
  it("keeps only the first character and the domain", () => {
    expect(maskEmail("ivan.petrov@example.com")).toBe("i***@example.com");
    expect(maskEmail("a@b.ru")).toBe("a***@b.ru");
  });

  it("never returns the original for invalid or empty input", () => {
    expect(maskEmail("")).toBe("***");
    expect(maskEmail(null)).toBe("***");
    expect(maskEmail(undefined)).toBe("***");
    expect(maskEmail("no-at-sign")).toBe("***");
    expect(maskEmail("@nolocal.ru")).toBe("***");
  });
});

describe("localAuth OTP logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function captureOtpLogs(nodeEnv: string) {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.doMock("./env", () => ({
      ENV: {
        bitrix24BaseUrl: "",
        bitrix24RestUserId: "",
        bitrix24WebhookToken: "",
        ownerOpenId: "",
        databaseUrl: "",
        isProduction: nodeEnv === "production",
      },
    }));
    vi.doMock("../bitrix24", () => ({
      isBitrixConfigured: () => false,
      findOrCreateBitrixContact: vi.fn(),
      sendBitrixEmail: vi.fn(),
      splitFullName: () => ({ lastName: "", firstName: "", secondName: "" }),
      mapLeadSource: () => "website",
    }));
    vi.doMock("./notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(false) }));
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { sendOtpEmail, sendPasswordResetEmail } = await import("../localAuth");
    await sendOtpEmail("ivan.petrov@example.com", "123456", "registration").catch(() => undefined);
    await sendPasswordResetEmail("ivan.petrov@example.com", "654321").catch(() => undefined);
    return logs.filter((line) => line.startsWith("[LocalAuth]"));
  }

  it("in development logs only the fact and a masked email, never the code", async () => {
    const logs = await captureOtpLogs("development");
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain("123456");
      expect(line).not.toContain("654321");
      expect(line).not.toContain("ivan.petrov@example.com");
    }
    expect(logs.some((line) => line.includes("i***@example.com"))).toBe(true);
  });

  it("in production does not log OTP issuance at all", async () => {
    const logs = await captureOtpLogs("production");
    expect(logs.filter((line) => /issued/.test(line))).toHaveLength(0);
    for (const line of logs) {
      expect(line).not.toContain("123456");
      expect(line).not.toContain("654321");
    }
  });
});
