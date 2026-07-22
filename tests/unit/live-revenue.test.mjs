import test from 'node:test';
import assert from 'node:assert/strict';

import { LIVE_REVENUE_POLICY } from '../../src/live/config.js';
import { calculateLiveRevenueAllocation } from '../../src/live/revenue.js';

test('LIVE収益配分はYouTuber 70%、決済手数料基準3.6%、運営基準26.4%で固定する', () => {
  assert.deepEqual(LIVE_REVENUE_POLICY, {
    creatorShareBps: 7000,
    cardProcessingFeeReferenceBps: 360,
    platformApplicationFeeBps: 3000,
    platformNetReferenceBps: 2640,
  });
  assert.equal(
    LIVE_REVENUE_POLICY.creatorShareBps
      + LIVE_REVENUE_POLICY.cardProcessingFeeReferenceBps
      + LIVE_REVENUE_POLICY.platformNetReferenceBps,
    10000,
  );
});

test('Stripeへの名目手数料は30%にし、実決済手数料を引いた残額を運営純額にする', () => {
  assert.deepEqual(calculateLiveRevenueAllocation(1000, 36), {
    grossAmount: 1000,
    creatorAmount: 700,
    applicationFeeAmount: 300,
    actualProcessingFeeAmount: 36,
    platformNetAmount: 264,
  });
  assert.deepEqual(calculateLiveRevenueAllocation(500, 18), {
    grossAmount: 500,
    creatorAmount: 350,
    applicationFeeAmount: 150,
    actualProcessingFeeAmount: 18,
    platformNetAmount: 132,
  });
});

test('応援金の候補金額でもYouTuber 70%と名目手数料30%を維持する', () => {
  const cases = [
    [200, 140, 60],
    [500, 350, 150],
    [1000, 700, 300],
    [3000, 2100, 900],
  ];
  for (const [grossAmount, creatorAmount, applicationFeeAmount] of cases) {
    const allocation = calculateLiveRevenueAllocation(grossAmount);
    assert.equal(allocation.creatorAmount, creatorAmount);
    assert.equal(allocation.applicationFeeAmount, applicationFeeAmount);
  }
});

test('円未満の端数はYouTuber分を切り捨て、決済前は運営純額を推測しない', () => {
  assert.deepEqual(calculateLiveRevenueAllocation(101), {
    grossAmount: 101,
    creatorAmount: 70,
    applicationFeeAmount: 31,
    actualProcessingFeeAmount: null,
    platformNetAmount: null,
  });
});

test('収益配分は正の安全な整数円だけを受け付ける', () => {
  assert.throws(() => calculateLiveRevenueAllocation(0), /invalid-grossAmount/);
  assert.throws(() => calculateLiveRevenueAllocation(1000.5), /invalid-grossAmount/);
  assert.throws(() => calculateLiveRevenueAllocation(1000, -1), /invalid-actualProcessingFeeAmount/);
  assert.throws(() => calculateLiveRevenueAllocation(1000, 1001), /processing-fee-exceeds-gross/);
});
