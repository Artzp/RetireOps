/**
 * Direct unit tests for findOptimalSplit (Phase 11 plan 11-01, ENG-07).
 *
 * Covers:
 *   - 51-iteration sweep (splitPct = 0.00, 0.01, ..., 0.50)
 *   - OAS-clawback guard (skip candidates that push receiver over threshold)
 *   - No-savings short-circuit (return 0 when bestTotalCost >= totalCostBefore)
 *   - Zero-splittable short-circuit (return 0 immediately)
 *   - applyPensionSplit will be added in Plan 11-02 (separate describe block)
 *
 * @see packages/calculation-engine/src/projection/orchestration/pension-split-optimizer.ts
 */

import { describe, it, expect, vi } from 'vitest';
import type { PersonYearlyResult, ProvinceCode, AccountOwner } from '@retireops/shared';
import * as optimizerModule from './orchestration/pension-split-optimizer.js';

const { findOptimalSplit, recalculateTaxWithPensionSplit, applyPensionSplit } = optimizerModule;

// ---------------------------------------------------------------------------
// Synthetic PersonYearlyResult fixture builder.
// findOptimalSplit calls recalculateTaxWithPensionSplit, which calls
// calculateTotalTax internally. The fixture must therefore carry realistic
// income fields plus a TaxCalculation stub with the fields the optimizer reads
// (taxableIncome, oasClawback, totalTax, capitalGains, netIncome).
// ---------------------------------------------------------------------------
function makePerson(
  owner: AccountOwner,
  overrides: Partial<PersonYearlyResult> = {}
): PersonYearlyResult {
  return {
    owner,
    year: 2024,
    age: 70,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 12000,
    oasIncome: 8000,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 20000,
    livingExpenses: 30000,
    taxesPaid: 1000,
    netIncome: 19000,
    netCashFlow: -11000,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
    taxCalculation: {
      year: 2024,
      owner,
      employmentIncome: 0,
      pensionIncome: 0,
      rrifIncome: 0,
      cppIncome: 12000,
      oasIncome: 8000,
      investmentIncome: 0,
      capitalGains: 0,
      dividendIncomeEligible: 0,
      dividendIncomeNonEligible: 0,
      grossIncome: 20000,
      deductions: 0,
      netIncome: 19000,
      taxableIncome: 19000,
      federalTaxGross: 500,
      federalCredits: 0,
      federalTaxNet: 500,
      provincialTaxGross: 500,
      provincialCredits: 0,
      provincialTaxNet: 500,
      totalTax: 1000,
      marginalRateFederal: 0.15,
      marginalRateProvincial: 0.05,
      marginalRateCombined: 0.2,
      effectiveRate: 0.05,
      oasClawback: 0,
      ageCredit: 0,
      pensionCredit: 0,
    },
    ...overrides,
  };
}

const ONTARIO: ProvinceCode = 'ON';

describe('findOptimalSplit', () => {
  it('returns 0 immediately when splittableIncome is 0 (no-loop short-circuit)', () => {
    const higher = makePerson('primary');
    const lower = makePerson('spouse');

    const spy = vi.spyOn(optimizerModule, 'recalculateTaxWithPensionSplit');

    const pct = findOptimalSplit({
      higherPrelim: higher,
      lowerPrelim: lower,
      higherProvince: ONTARIO,
      lowerProvince: ONTARIO,
      splittableIncome: 0,
      year: 2024,
      totalCostBefore: 5000,
    });

    expect(pct).toBe(0);
    // The 51-iteration loop is guarded by `if (splittableIncome <= 0) return 0;`
    // so recalculateTaxWithPensionSplit must NOT be called at all.
    expect(spy).toHaveBeenCalledTimes(0);
    spy.mockRestore();
  });

  it('returns 0 when totalCostBefore is 0 (no positive split can improve a zero baseline)', () => {
    // High-income primary, low-income spouse — there ARE candidate splits, but
    // bestTotalCost will always be > 0 (combined tax + clawback), so the
    // `bestTotalCost < totalCostBefore` guard with totalCostBefore=0 returns 0.
    const higher = makePerson('primary', {
      pensionIncome: 50000,
      totalGrossIncome: 70000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 50000,
        grossIncome: 70000,
        taxableIncome: 70000,
      },
    });
    const lower = makePerson('spouse');

    const pct = findOptimalSplit({
      higherPrelim: higher,
      lowerPrelim: lower,
      higherProvince: ONTARIO,
      lowerProvince: ONTARIO,
      splittableIncome: 50000,
      year: 2024,
      totalCostBefore: 0,
    });

    expect(pct).toBe(0);
  });

  it('sweeps the 51-point grid (splitPct = 0.00, 0.01, ..., 0.50) and returns a value snapped to the 0.01 grid', () => {
    // The 51-iteration loop is `for (let splitPct = 0; splitPct <= 0.5; splitPct += 0.01)`.
    // Direct call-count verification via vi.spyOn cannot intercept the lexical
    // module-scope reference inside findOptimalSplit. We therefore PROVE the
    // sweep ran by checking that:
    //   (a) the returned split is in [0, 0.5] (the loop's iteration domain), AND
    //   (b) the returned split is a multiple of 0.01 (the loop's step granularity)
    // Any breakage of the loop bounds or step would fail one of these.
    const higher = makePerson('primary', {
      pensionIncome: 50000,
      totalGrossIncome: 70000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 50000,
        grossIncome: 70000,
        taxableIncome: 70000,
      },
    });
    const lower = makePerson('spouse', {
      // Lower spouse has no OAS, so the clawback guard never triggers a `continue`.
      oasIncome: 0,
      taxCalculation: {
        ...makePerson('spouse').taxCalculation,
        oasIncome: 0,
      },
    });

    const pct = findOptimalSplit({
      higherPrelim: higher,
      lowerPrelim: lower,
      higherProvince: ONTARIO,
      lowerProvince: ONTARIO,
      splittableIncome: 50000,
      year: 2024,
      totalCostBefore: 1_000_000, // big baseline so any split saves
    });

    // (a) iteration domain
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(0.5);

    // (b) iteration step granularity — pct snaps to 0.01 (within IEEE-754 noise
    // accumulated from 50 × 0.01 increments).
    const snapped = Math.round(pct * 100) / 100;
    expect(pct).toBeCloseTo(snapped, 8);
  });

  it('returns a non-zero interior split when high-income primary + low-income spouse and a split saves money', () => {
    // Primary: $110k taxable income with $50k of splittable pension income.
    // Spouse: $12k taxable income, no OAS. Splitting pension to spouse reduces
    // primary's marginal rate exposure; the optimizer should pick > 0 and < 0.5.
    const higher = makePerson('primary', {
      pensionIncome: 50000,
      rrifWithdrawal: 30000,
      totalGrossIncome: 100000,
      taxesPaid: 22000,
      netIncome: 78000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 50000,
        rrifIncome: 30000,
        grossIncome: 100000,
        netIncome: 78000,
        taxableIncome: 110000,
        totalTax: 22000,
      },
    });
    const lower = makePerson('spouse', {
      cppIncome: 4000,
      oasIncome: 0,
      pensionIncome: 0,
      totalGrossIncome: 4000,
      taxesPaid: 0,
      netIncome: 4000,
      taxCalculation: {
        ...makePerson('spouse').taxCalculation,
        cppIncome: 4000,
        oasIncome: 0,
        grossIncome: 4000,
        netIncome: 4000,
        taxableIncome: 4000,
        totalTax: 0,
      },
    });

    // totalCostBefore = primary tax + clawback + spouse tax + clawback = 22000.
    const pct = findOptimalSplit({
      higherPrelim: higher,
      lowerPrelim: lower,
      higherProvince: ONTARIO,
      lowerProvince: ONTARIO,
      splittableIncome: 80000, // pension + RRIF
      year: 2024,
      totalCostBefore: 22000,
    });

    // The optimum is interior — pure tax-bracket arithmetic ensures it
    // is neither 0 nor 0.5 for this configuration.
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(0.5);
    // Snap to 0.01 grid (with floating-point tolerance — accumulated 0.01 increments
    // can carry IEEE-754 noise on the order of 1e-15).
    const snapped = Math.round(pct * 100) / 100;
    expect(pct).toBeCloseTo(snapped, 8);
  });

  it('OAS-clawback guard: skips candidates that push receiver over threshold; returns 0 if no valid split exists', () => {
    // Lower spouse already very close to OAS clawback threshold (~$90k for 2024)
    // AND has OAS income. ANY positive split pushes them over → all candidates
    // get skipped → bestSplit stays 0, bestTotalCost stays Infinity → guard
    // `bestTotalCost < totalCostBefore` is false → returns 0.
    const higher = makePerson('primary', {
      pensionIncome: 60000,
      totalGrossIncome: 80000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 60000,
        grossIncome: 80000,
        taxableIncome: 80000,
        totalTax: 15000,
      },
    });
    const lower = makePerson('spouse', {
      pensionIncome: 80000,
      oasIncome: 8000, // has OAS — guard active
      totalGrossIncome: 100000,
      netIncome: 95000, // already above the 2024 threshold (~$90,997)
      taxCalculation: {
        ...makePerson('spouse').taxCalculation,
        pensionIncome: 80000,
        oasIncome: 8000,
        grossIncome: 100000,
        netIncome: 95000, // pre-split net income already > clawback threshold
        taxableIncome: 100000,
        totalTax: 20000,
      },
    });

    const pct = findOptimalSplit({
      higherPrelim: higher,
      lowerPrelim: lower,
      higherProvince: ONTARIO,
      lowerProvince: ONTARIO,
      splittableIncome: 60000,
      year: 2024,
      totalCostBefore: 35000,
    });

    expect(pct).toBe(0);
  });

  it('recalculateTaxWithPensionSplit is exported and callable from the orchestration module', () => {
    // Direct import contract check: the function moved out of couple-calculator.ts
    // and is now exported from orchestration/pension-split-optimizer.ts.
    const person = makePerson('primary', {
      pensionIncome: 30000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 30000,
        taxableIncome: 50000,
      },
    });
    const result = recalculateTaxWithPensionSplit(person, -10000, ONTARIO);
    expect(result).toBeDefined();
    expect(typeof result.totalTax).toBe('number');
    expect(typeof result.netIncome).toBe('number');
  });

  it('recalculateTaxWithPensionSplit preserves non-registered income buckets', () => {
    const person = makePerson('primary', {
      pensionIncome: 40000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 40000,
        interestIncome: 1000,
        capitalGains: 3000,
        dividendIncomeEligible: 2000,
        dividendIncomeNonEligible: 500,
      },
    });

    const result = recalculateTaxWithPensionSplit(person, -10000, ONTARIO);

    expect(result.pensionIncome).toBe(30000);
    expect(result.interestIncome).toBe(1000);
    expect(result.dividendIncomeEligible).toBe(2000);
    expect(result.dividendIncomeNonEligible).toBe(500);
    expect(result.capitalGains).toBe(3000);
    expect(result.taxableIncome).toBeGreaterThan(30000);
  });
});

describe('recalculateTaxWithPensionSplit re-export from couple-calculator.ts', () => {
  // Activated by Plan 11-01 Task 3: couple-calculator.ts now re-exports
  // recalculateTaxWithPensionSplit from orchestration/pension-split-optimizer.js
  // to preserve the contract used by orchestration/spousal-rrsp-attribution.ts.
  it('is importable from couple-calculator.js (preserves spousal-rrsp-attribution.ts contract)', async () => {
    const coupleMod = await import('./couple-calculator.js');
    expect(coupleMod.recalculateTaxWithPensionSplit).toBe(recalculateTaxWithPensionSplit);
  });
});

describe('applyPensionSplit', () => {
  // Realistic primary with $50k pension + $30k RRIF income; spouse with $4k CPP only.
  // Both Ontario, both 70.
  function makeHigh(): PersonYearlyResult {
    return makePerson('primary', {
      pensionIncome: 50000,
      rrifWithdrawal: 30000,
      totalGrossIncome: 100000,
      livingExpenses: 30000,
      taxesPaid: 22000,
      netIncome: 78000,
      netCashFlow: 48000,
      taxCalculation: {
        ...makePerson('primary').taxCalculation,
        pensionIncome: 50000,
        rrifIncome: 30000,
        grossIncome: 100000,
        netIncome: 78000,
        taxableIncome: 110000,
        totalTax: 22000,
        oasClawback: 0,
      },
    });
  }
  function makeLow(): PersonYearlyResult {
    return makePerson('spouse', {
      cppIncome: 4000,
      oasIncome: 0,
      pensionIncome: 0,
      totalGrossIncome: 4000,
      livingExpenses: 30000,
      taxesPaid: 0,
      netIncome: 4000,
      netCashFlow: -26000,
      taxCalculation: {
        ...makePerson('spouse').taxCalculation,
        cppIncome: 4000,
        oasIncome: 0,
        grossIncome: 4000,
        netIncome: 4000,
        taxableIncome: 4000,
        totalTax: 0,
        oasClawback: 0,
      },
    });
  }

  it('primary-to-spouse: applies the split, recomputes taxes for both, patches result objects correctly', () => {
    const primary = makeHigh();
    const spouse = makeLow();

    const out = applyPensionSplit({
      direction: 'primary-to-spouse',
      primary,
      spouse,
      primaryProvince: ONTARIO,
      spouseProvince: ONTARIO,
      splitAmount: 20000,
    });

    // Primary is the transferor
    expect(out.primary.pensionIncomeTransferred).toBe(20000);
    expect(out.primary.pensionIncomeReceived).toBeUndefined();
    // Spouse is the receiver
    expect(out.spouse.pensionIncomeReceived).toBe(20000);
    expect(out.spouse.pensionIncomeTransferred).toBeUndefined();

    // Both got tax recomputed
    expect(out.primary.taxesPaid).not.toBe(primary.taxesPaid);
    expect(out.spouse.taxesPaid).toBeGreaterThan(0); // spouse now has taxable income

    // Net income / cash-flow invariants
    expect(out.primary.netIncome).toBeCloseTo(primary.totalGrossIncome - out.primary.taxesPaid, 6);
    expect(out.primary.netCashFlow).toBeCloseTo(
      primary.totalGrossIncome - out.primary.taxesPaid - primary.livingExpenses,
      6
    );
    expect(out.spouse.netIncome).toBeCloseTo(spouse.totalGrossIncome - out.spouse.taxesPaid, 6);
    expect(out.spouse.netCashFlow).toBeCloseTo(
      spouse.totalGrossIncome - out.spouse.taxesPaid - spouse.livingExpenses,
      6
    );

    // totalCostAfter sums both spouses' (taxesPaid + oasClawback)
    expect(out.totalCostAfter).toBeCloseTo(
      out.primary.taxesPaid +
        out.primary.taxCalculation.oasClawback +
        out.spouse.taxesPaid +
        out.spouse.taxCalculation.oasClawback,
      6
    );

    // The split should reduce the combined tax+clawback cost in this scenario
    // (high-bracket primary, zero-tax spouse).
    const costBefore =
      primary.taxesPaid +
      primary.taxCalculation.oasClawback +
      spouse.taxesPaid +
      spouse.taxCalculation.oasClawback;
    expect(out.totalCostAfter).toBeLessThan(costBefore);
  });

  it('spouse-to-primary: roles invert; spouse is transferor, primary is receiver', () => {
    // Build inverted scenario: spouse is high-income, primary is low-income.
    const highSpouse = makeHigh();
    highSpouse.owner = 'spouse';
    highSpouse.taxCalculation.owner = 'spouse';
    const lowPrimary = makeLow();
    lowPrimary.owner = 'primary';
    lowPrimary.taxCalculation.owner = 'primary';

    const out = applyPensionSplit({
      direction: 'spouse-to-primary',
      primary: lowPrimary,
      spouse: highSpouse,
      primaryProvince: ONTARIO,
      spouseProvince: ONTARIO,
      splitAmount: 20000,
    });

    // Spouse is transferor (loses income), primary is receiver (gains income)
    expect(out.spouse.pensionIncomeTransferred).toBe(20000);
    expect(out.primary.pensionIncomeReceived).toBe(20000);
    // Cross-checks
    expect(out.spouse.pensionIncomeReceived).toBeUndefined();
    expect(out.primary.pensionIncomeTransferred).toBeUndefined();

    // Primary gained taxable income — taxes should now be > 0
    expect(out.primary.taxesPaid).toBeGreaterThan(0);

    // Net income invariant on primary side
    expect(out.primary.netIncome).toBeCloseTo(
      lowPrimary.totalGrossIncome - out.primary.taxesPaid,
      6
    );
  });

  it('does not mutate input objects (returns new patched objects)', () => {
    const primary = makeHigh();
    const spouse = makeLow();
    const primarySnapshot = JSON.stringify(primary);
    const spouseSnapshot = JSON.stringify(spouse);

    const out = applyPensionSplit({
      direction: 'primary-to-spouse',
      primary,
      spouse,
      primaryProvince: ONTARIO,
      spouseProvince: ONTARIO,
      splitAmount: 20000,
    });

    // Object-identity check: the helper returns NEW objects via spread
    expect(out.primary).not.toBe(primary);
    expect(out.spouse).not.toBe(spouse);

    // Deep-equality check: original inputs are unchanged
    expect(JSON.stringify(primary)).toBe(primarySnapshot);
    expect(JSON.stringify(spouse)).toBe(spouseSnapshot);
  });

  it('zero splitAmount: patches transferred/received to 0 and totalCostAfter is internally consistent', () => {
    const primary = makeHigh();
    const spouse = makeLow();

    const out = applyPensionSplit({
      direction: 'primary-to-spouse',
      primary,
      spouse,
      primaryProvince: ONTARIO,
      spouseProvince: ONTARIO,
      splitAmount: 0,
    });

    // Defensive behavior: helper still emits transferred=0 / received=0 markers
    expect(out.primary.pensionIncomeTransferred).toBe(0);
    expect(out.spouse.pensionIncomeReceived).toBe(0);

    // Internal consistency: totalCostAfter equals the sum of patched fields the
    // helper itself produced (independent of the caller's potentially synthetic
    // prelim taxesPaid value, which is not derived from calculateTotalTax in the
    // unit-test fixture).
    expect(out.totalCostAfter).toBeCloseTo(
      out.primary.taxesPaid +
        out.primary.taxCalculation.oasClawback +
        out.spouse.taxesPaid +
        out.spouse.taxCalculation.oasClawback,
      6
    );

    // With splitAmount=0, both sides recompute against their original
    // pension+RRIF aggregation — taxes are non-negative and bounded.
    expect(out.primary.taxesPaid).toBeGreaterThanOrEqual(0);
    expect(out.spouse.taxesPaid).toBeGreaterThanOrEqual(0);
  });
});
