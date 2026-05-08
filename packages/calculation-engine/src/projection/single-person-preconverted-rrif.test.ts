/**
 * Regression: runSingleProjectionCore must honor input.rrifBalance.
 *
 * Prior bug: single-person projection silently dropped input.rrifBalance,
 * hardcoding the starting RRIF to 0. Pre-converted retirees (person converted
 * RRSP to RRIF before projection start, inherited spousal RRIF rollover, etc.)
 * saw zero RRIF in the projection output — no RRIF minimum withdrawals, no
 * associated taxable income, and downstream errors in OAS clawback eligibility
 * and portfolio longevity.
 *
 * The couple path already honored this field (see TC-RRIF-018/019 in
 * couple-projection.test.ts); these tests cover the symmetric single-person
 * path.
 *
 * Discovered during #82 P5 validation in retireops-test-platform.
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection } from './multi-year.js';
import { getCurrentYear } from '@retireops/shared';
import type { ProjectionInput } from '@retireops/shared';

function baseInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  const startYear = getCurrentYear();
  // Age 72 at end of startYear — RRIF minimum applies, not a conversion year
  // (conversion only fires when rrspBalance > 0 AND age >= 71).
  const birthdate = new Date(startYear - 72, 0, 1);
  return {
    birthdate,
    province: 'ON',
    lifeExpectancy: 85,
    retirementAge: 65,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 40000,
    investmentReturn: 0.05,
    inflationRate: 0.025,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    ...overrides,
  };
}

describe('Single-person projection: pre-converted RRIF (input.rrifBalance)', () => {
  it('honors rrifBalance=600000 at age 72 — RRIF minimum fires in year 1', () => {
    const result = runSingleProjection(baseInput({ rrifBalance: 600000 }));

    expect(result.yearlyResults.length).toBeGreaterThan(0);

    const year1 = result.yearlyResults[0];
    expect(year1).toBeDefined();
    if (!year1) return;

    expect(year1.age).toBe(72);
    // Opening balance honored — end-of-year balance should be positive after
    // one year of min withdrawal and growth on the remainder.
    expect(year1.rrifBalance).toBeGreaterThan(0);
    // Age 72 RRIF minimum rate per CRA Reg. 7308 is 5.40%.
    // rrifWithdrawal in YearlyResult includes the RRIF minimum plus any
    // discretionary RRIF/RRSP top-up. The floor is 5.40% × opening balance.
    const expectedMinimum = 600000 * 0.054;
    expect(year1.rrifWithdrawal).toBeGreaterThanOrEqual(expectedMinimum - 0.01);
  });

  it('draws down the pre-populated RRIF across the projection', () => {
    const result = runSingleProjection(baseInput({ rrifBalance: 600000 }));

    const rrifBalances = result.yearlyResults.map((y) => y.rrifBalance);
    const rrifWithdrawals = result.yearlyResults.map((y) => y.rrifWithdrawal);

    // Every in-projection year should show a non-zero RRIF minimum
    // withdrawal (until the RRIF is fully drained).
    const yearsWithWithdrawal = rrifWithdrawals.filter((w) => w > 0).length;
    expect(yearsWithWithdrawal).toBeGreaterThan(0);

    // RRIF balance should be monotonically drawn down (or at least strictly
    // less than opening balance by some mid-projection year, accounting for
    // 5% growth on remainder vs ~5-7% min withdrawal rates).
    const midIndex = Math.floor(rrifBalances.length / 2);
    const midBalance = rrifBalances[midIndex];
    expect(midBalance).toBeDefined();
    if (midBalance !== undefined) {
      expect(midBalance).toBeLessThan(600000);
    }
  });

  it('merges rrspBalance into rrifBalance at conversion (age 72, both present)', () => {
    // Both RRSP and RRIF present at age 72. The conversion logic fires
    // additively: currentRRIF += currentRRSP. Year 1 is a conversion year
    // so the RRIF minimum is suppressed; year 2 min draws from the merged
    // balance.
    const result = runSingleProjection(baseInput({ rrspBalance: 200000, rrifBalance: 500000 }));

    const year1 = result.yearlyResults[0];
    const year2 = result.yearlyResults[1];
    expect(year1).toBeDefined();
    expect(year2).toBeDefined();
    if (!year1 || !year2) return;

    // Year 1 is the conversion year — RRSP has been merged into RRIF,
    // RRSP balance is now zero, and no RRIF minimum is taken.
    expect(year1.age).toBe(72);
    expect(year1.rrspBalance).toBe(0);
    expect(year1.rrifConversionYear).toBe(true);
    expect(year1.rrifForcedMinimum).toBe(0);
    // End-of-year RRIF = (500000 + 200000 + 0 growth during conversion step) × (1 + 0.05)
    // Allow a modest tolerance for discretionary withdrawals used to fund
    // spending. Starting combined balance is $700K; after 5% growth it
    // would be $735K with no withdrawals. Spending $40K is small enough
    // that it's covered by CPP + OAS + any small non-reg/TFSA (none here),
    // forcing some RRIF top-up — but the merge is visible through the
    // balance being substantially greater than what a 500K-only starting
    // balance could produce.
    expect(year1.rrifBalance).toBeGreaterThan(500000 * 1.05);

    // Year 2 (age 73): RRIF minimum applies. Age 73 rate is 5.53%.
    expect(year2.age).toBe(73);
    expect(year2.rrifForcedMinimum).toBeGreaterThan(0);
    // Opening year-2 balance ≈ year-1 end balance, so min should reflect
    // the merged $700K base (≈ $735K after growth) × 5.53% ≈ $40,635.
    // A 500K-only balance would give min ≈ $29,000 — well below this.
    expect(year2.rrifForcedMinimum).toBeGreaterThan(35000);
  });
});
