import { describe, expect, it } from "vitest";
import { fmtFixed, fmtNum } from "../client/src/lib/utils";

describe("dashboard number formatting", () => {
  it("always keeps exactly two decimal places by default", () => {
    expect(fmtNum(0)).toBe("0.00");
    expect(fmtNum(99.8)).toBe("99.80");
    expect(fmtNum("37.4")).toBe("37.40");
    expect(fmtNum(741.0000000000001)).toBe("741.00");
  });

  it("returns a fixed zero for empty and invalid values", () => {
    expect(fmtNum(null)).toBe("0.00");
    expect(fmtNum(undefined)).toBe("0.00");
    expect(fmtNum("not-a-number")).toBe("0.00");
  });

  it("supports an explicit precision and keeps fmtFixed compatible", () => {
    expect(fmtNum(1.2345, 3)).toBe("1.234");
    expect(fmtFixed(12, 2)).toBe("12.00");
  });
});
