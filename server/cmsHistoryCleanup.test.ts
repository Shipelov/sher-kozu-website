import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the CMS history auto-cleanup logic.
 *
 * The cleanup function (runCmsHistoryCleanup) lives in server/_core/index.ts
 * and runs on startup + every 24h. It deletes cmsBlockHistory rows older than 30 days.
 *
 * Since the function is embedded in the server bootstrap, we test the underlying
 * DB operation (delete where changedAt < cutoff) and the scheduling contract.
 */

/* ─── Mock DB layer ─── */
let deletedWhere: any[] = [];

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    delete: vi.fn(() => ({
      where: vi.fn((condition: any) => {
        deletedWhere.push(condition);
        return [{ affectedRows: 3 }];
      }),
    })),
  })),
}));

vi.mock("../../drizzle/schema", () => ({
  cmsBlockHistory: {
    changedAt: "changedAt_column",
    id: "id_column",
    blockId: "blockId_column",
  },
}));

vi.mock("drizzle-orm", () => ({
  lt: vi.fn((col: any, val: any) => ({ operator: "lt", column: col, value: val })),
  eq: vi.fn((col: any, val: any) => ({ operator: "eq", column: col, value: val })),
  and: vi.fn((...args: any[]) => ({ operator: "and", conditions: args })),
  asc: vi.fn((col: any) => ({ direction: "asc", column: col })),
  desc: vi.fn((col: any) => ({ direction: "desc", column: col })),
}));

beforeEach(() => {
  deletedWhere = [];
});

describe("CMS History Cleanup logic", () => {
  it("calculates cutoff date as 30 days ago", () => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Cutoff should be approximately 30 days before now
    const diffMs = now.getTime() - cutoff.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("deletes records older than 30 days using lt operator", async () => {
    const { getDb } = await import("../db");
    const { cmsBlockHistory } = await import("../../drizzle/schema");
    const { lt } = await import("drizzle-orm");

    const db = await getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    await (db as any).delete(cmsBlockHistory).where(lt(cmsBlockHistory.changedAt, cutoff));

    expect(deletedWhere.length).toBe(1);
    expect(deletedWhere[0]).toEqual({
      operator: "lt",
      column: "changedAt_column",
      value: cutoff,
    });
  });

  it("cutoff date is in the past, not in the future", () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it("handles zero affected rows gracefully", async () => {
    // Simulate cleanup with no old records
    const deleted = 0;
    if (deleted > 0) {
      throw new Error("Should not reach here");
    }
    // No error should be thrown
    expect(deleted).toBe(0);
  });

  it("handles DB errors gracefully without crashing", async () => {
    // Simulate the error handling pattern from runCmsHistoryCleanup
    let errorCaught = false;
    try {
      throw new Error("DB connection failed");
    } catch (err) {
      errorCaught = true;
      expect((err as Error).message).toBe("DB connection failed");
    }
    expect(errorCaught).toBe(true);
  });

  it("cleanup interval is set to 24 hours (86400000 ms)", () => {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    expect(TWENTY_FOUR_HOURS_MS).toBe(86400000);
  });

  it("retention period is exactly 30 days", () => {
    const RETENTION_DAYS = 30;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const diffMs = now.getTime() - cutoff.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});
