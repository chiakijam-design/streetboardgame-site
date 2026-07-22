import { LIVE_REVENUE_POLICY } from './config.js';

const BASIS_POINTS_SCALE = 10000n;

export function calculateLiveRevenueAllocation(grossAmount, actualProcessingFeeAmount = null) {
  assertYenAmount(grossAmount, 'grossAmount');
  if (actualProcessingFeeAmount !== null) {
    assertYenAmount(actualProcessingFeeAmount, 'actualProcessingFeeAmount', true);
    if (actualProcessingFeeAmount > grossAmount) throw new RangeError('processing-fee-exceeds-gross');
  }

  const creatorAmount = Number(
    BigInt(grossAmount) * BigInt(LIVE_REVENUE_POLICY.creatorShareBps) / BASIS_POINTS_SCALE,
  );
  const applicationFeeAmount = grossAmount - creatorAmount;

  return Object.freeze({
    grossAmount,
    creatorAmount,
    applicationFeeAmount,
    actualProcessingFeeAmount,
    platformNetAmount: actualProcessingFeeAmount === null
      ? null
      : applicationFeeAmount - actualProcessingFeeAmount,
  });
}

function assertYenAmount(value, field, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new TypeError(`invalid-${field}`);
  }
}
