import { describe, it, expect } from 'vitest';
import { holdCredits, settleCredits, releaseCredits, getPlanLimits } from '../src/index.js';

describe('Billing Package Tests', () => {
  it('holds credits when balance is sufficient', () => {
    const initial = { availableCredits: 100, reservedCredits: 0 };
    const held = holdCredits(initial, 30);
    expect(held.availableCredits).toBe(70);
    expect(held.reservedCredits).toBe(30);
  });

  it('rejects credit hold when balance is insufficient', () => {
    const initial = { availableCredits: 20, reservedCredits: 0 };
    expect(() => holdCredits(initial, 30)).toThrow(/Insufficient credits/);
  });

  it('settles credits consuming actual usage and releasing surplus', () => {
    const state = { availableCredits: 70, reservedCredits: 30 };
    // Actual consumed is 12 credits, surplus 18 released back
    const settled = settleCredits(state, 30, 12);
    expect(settled.availableCredits).toBe(88); // 70 + 18
    expect(settled.reservedCredits).toBe(0);
  });

  it('releases full held amount on run cancellation', () => {
    const state = { availableCredits: 70, reservedCredits: 30 };
    const released = releaseCredits(state, 30);
    expect(released.availableCredits).toBe(100);
    expect(released.reservedCredits).toBe(0);
  });

  it('retrieves plan tier limits accurately', () => {
    const pro = getPlanLimits('pro');
    expect(pro.monthlyCredits).toBe(5000);
    expect(pro.canUseCustomDomains).toBe(true);

    const free = getPlanLimits('free');
    expect(free.monthlyCredits).toBe(100);
    expect(free.canUseCustomDomains).toBe(false);
  });
});
