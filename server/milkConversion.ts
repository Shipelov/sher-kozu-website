export type OutputConversion = {
  actualRatio: number | null;
  deviationPercent: number | null;
};

/**
 * A per-product conversion ratio is mathematically defined only when the
 * processing session has a single output product. For multi-output sessions
 * the total milk input cannot be assigned to each product without an explicit
 * allocation, so returning a ratio would double-count the same milk.
 */
export function calculateOutputConversion(params: {
  totalInputMl: number;
  outputQuantity: number;
  baseRatio: number | null;
  outputCount: number;
}): OutputConversion {
  const { totalInputMl, outputQuantity, baseRatio, outputCount } = params;

  if (outputCount !== 1 || outputQuantity <= 0) {
    return { actualRatio: null, deviationPercent: null };
  }

  const actualRatio = totalInputMl / 1000 / outputQuantity;
  const deviationPercent =
    baseRatio !== null && baseRatio > 0
      ? ((actualRatio - baseRatio) / baseRatio) * 100
      : null;

  return { actualRatio, deviationPercent };
}

export function supportsPerProductConversion(outputCount: number): boolean {
  return outputCount === 1;
}
