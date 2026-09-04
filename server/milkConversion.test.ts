import { describe, expect, it } from "vitest";
import {
  calculateOutputConversion,
  supportsPerProductConversion,
} from "./milkConversion";

describe("processing output conversion", () => {
  it("calculates liters per unit for a single-output session", () => {
    const result = calculateOutputConversion({
      totalInputMl: 100_000,
      outputQuantity: 10,
      baseRatio: 8,
      outputCount: 1,
    });

    expect(result.actualRatio).toBe(10);
    expect(result.deviationPercent).toBe(25);
  });

  it("does not assign the full milk input to every product in a multi-output session", () => {
    const result = calculateOutputConversion({
      totalInputMl: 100_000,
      outputQuantity: 10,
      baseRatio: 8,
      outputCount: 3,
    });

    expect(result).toEqual({ actualRatio: null, deviationPercent: null });
    expect(supportsPerProductConversion(3)).toBe(false);
  });

  it("does not calculate a ratio for zero output quantity", () => {
    expect(
      calculateOutputConversion({
        totalInputMl: 100_000,
        outputQuantity: 0,
        baseRatio: 8,
        outputCount: 1,
      }),
    ).toEqual({ actualRatio: null, deviationPercent: null });
  });
});
