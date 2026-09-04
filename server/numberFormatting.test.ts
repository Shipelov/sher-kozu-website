import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("formats every liter value in the milk overview table", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/pages/AdminMilkDashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("{fmtNum(d[c.key].volumeL)}");
    expect(source).toContain("{fmtNum(d[c.key].netL)}");
    expect(source).toContain("d[c.key].feedingL > 0 ? fmtNum(d[c.key].feedingL)");
    expect(source).toContain("d[c.key].acceptedL > 0 ? fmtNum(d[c.key].acceptedL)");
  });
});
