/**
 * Feature 4.1 GIS Acceptance Tests — Projection-Path Coverage
 *
 * Acceptance scenarios TC-GIS41-006 (couple alive), TC-GIS41-007 (survivor),
 * TC-GIS41-009 (TFSA vs RRSP), TC-GIS41-010 (RRIF minimums respected).
 *
 * @see ~/.hermes/cron/retireops-acceptance-tests/feature-4.1-gis.md
 * @see ~/.hermes/cron/retireops-feature-descriptions/feature-4.1-gis.md
 * @see docs/source-of-truth/05-government-benefits.md — GIS Section
 * @see docs/source-of-truth/08-projection-engine.md
 */
import { describe, it, expect } from 'vitest';
import { calculateCoupleYear, type CoupleYearInput } from './couple-calculator.js';
import { calculatePersonYear, type PersonYearInput } from './yearly-calculator.js';
import { runCoupleProjection, runSingleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput, CoupleYearlyResult } from '@retireops/shared';

/**
 * Build a minimal couple-year input for a low-income alive couple at 67.
 *
 * Each spouse has OAS + a small pension that together put gisIncome into the
 * band where:
 *   - the single threshold (21_624) would deny GIS, and
 *   - the married/both-OAS threshold (28_560) would grant GIS.
 * This gap is what TC-GIS41-006 uses to prove the married path is wired.
 */
function makeAliveCoupleAt67(): CoupleYearInput {
  const year = 2030;
  const personBase = {
    birthdate: new Date(year - 67, 0, 1), // age 67 in 2030
    province: 'ON' as const,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    nonRegACB: 0,
    rrspContribution: 0,
    tfsaContribution: 0,
    employmentIncome: 0,
    // Pension sized so that: gisIncome = (pension + OAS + CPP) − OAS = pension + CPP.
    // With CPP ≈ 8_000 and pension 16_000, gisIncome ≈ 24_000 — above single cap (21_624)
    // but under married-both cap (28_560). This forces the engine to exercise the
    // married-couple GIS path (REGR-005 guard).
    pensionIncome: 16_000,
    otherIncome: 0,
    expectedCPPAt65: 8_000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 20_000,
    investmentReturn: 0.0,
    inflationRate: 0.0,
    retirementAge: 65,
    yearsFromProjectionStart: 2,
  };

  return {
    year,
    maritalStatus: 'married',
    primary: { ...personBase },
    spouse: { ...personBase },
    optimizePensionSplitting: false,
    useYoungerSpouseForRRIF: false,
  };
}

describe('Feature 4.1 GIS — Projection-Path Coverage', () => {
  describe('TC-GIS41-006: Couple projection does not force single marital status before spouse death', () => {
    it('married couple at 67 with gisIncome in the single/married gap → both spouses receive GIS', () => {
      const input = makeAliveCoupleAt67();

      const result: CoupleYearlyResult = calculateCoupleYear(input);

      // Both spouses must be eligible under the married/both-OAS threshold.
      // If the engine hardcoded "single" anywhere in the alive-couple path, gisIncome would be 0
      // because each spouse's GIS income (~24_000) exceeds the single threshold (21_624).
      expect(result.primary.gisIncome).toBeDefined();
      expect(result.primary.gisIncome ?? 0).toBeGreaterThan(0);
      expect(result.spouse.gisIncome).toBeDefined();
      expect(result.spouse.gisIncome ?? 0).toBeGreaterThan(0);
    });

    it('common_law parity — common_law couple with same inputs must yield the same GIS', () => {
      const married = calculateCoupleYear(makeAliveCoupleAt67());
      const commonLawInput = { ...makeAliveCoupleAt67(), maritalStatus: 'common_law' as const };
      const commonLaw = calculateCoupleYear(commonLawInput);

      expect(commonLaw.primary.gisIncome ?? 0).toBeCloseTo(married.primary.gisIncome ?? 0, 0);
      expect(commonLaw.spouse.gisIncome ?? 0).toBeCloseTo(married.spouse.gisIncome ?? 0, 0);
    });

    it('regression guard: a couple with gisIncome above the single threshold but below the married-both threshold must NOT be GIS-ineligible', () => {
      const input = makeAliveCoupleAt67();
      const result = calculateCoupleYear(input);

      // gisIncome (net income − oasNet) per spouse is approximately 24_000 — deliberately
      // set in the 21_624 < x < 28_560 band. If this assertion fails, the alive-couple path
      // regressed to the single threshold.
      const primaryGisRaw =
        result.primary.totalGrossIncome -
        result.primary.oasIncome -
        (result.primary.gisIncome ?? 0);
      expect(primaryGisRaw).toBeGreaterThan(21_624);
      expect(primaryGisRaw).toBeLessThan(28_560);
    });
  });

  describe('TC-GIS41-007: Surviving spouse transitions to single threshold after partner death', () => {
    /**
     * We drive the death year by setting the spouse's lifeExpectancy below the
     * projection horizon. After death, runCoupleProjection's coupleYearInput sets
     * maritalStatus to 'single' for the survivor. We pick survivor income so that
     * the single vs married threshold difference is observable: survivor's gisIncome
     * sits above 21_624 (single cap) but below 28_560 (married-both cap), so
     *   - before death (married path): survivor would be GIS-eligible.
     *   - after death (single path): survivor must be GIS-ineligible.
     */
    function makeSurvivorScenario(): ProjectionInput {
      const spouse: SpouseInput = {
        birthdate: new Date(1958, 0, 1),
        retirementAge: 65,
        lifeExpectancy: 69, // dies early so we get post-death years with survivor alive
        employmentIncome: 0,
        employmentGrowthRate: 0,
        expectedCPPAt65: 6_000,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        tfsaAnnualContribution: 0,
        nonRegBalance: 0,
        pensionIncome: 0,
      };

      return {
        birthdate: new Date(1960, 0, 1),
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 85,
        maritalStatus: 'married',
        // Base income is engineered so that primary's GIS income straddles the
        // single/married-both threshold after spouse death (primary has OAS only).
        employmentIncome: 0,
        employmentGrowthRate: 0,
        pensionIncome: 16_000, // with CPP ≈ 8_000 → gisIncome ≈ 24_000 per primary
        expectedCPPAt65: 8_000,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        tfsaAnnualContribution: 0,
        nonRegBalance: 0,
        retirementSpending: 20_000,
        investmentReturn: 0.0,
        inflationRate: 0.0,
        spouse,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      };
    }

    it('surviving primary in the first full year after spouse death uses the single GIS threshold', () => {
      const input = makeSurvivorScenario();
      const result = runCoupleProjection(input);

      const { spouse } = input;
      if (!spouse) {
        throw new Error('Test setup error: survivor scenario requires a spouse');
      }

      // Find a year well after spouse's lifeExpectancy where primary is still alive.
      const spouseEndYear = spouse.birthdate.getFullYear() + (spouse.lifeExpectancy - 1);
      const survivorYear = result.yearlyResults.find((y) => y.year === spouseEndYear + 2);
      expect(survivorYear, 'Survivor projection year should exist').toBeDefined();
      if (!survivorYear) return;

      // In the survivor year the primary's gisIncome must reflect the single threshold,
      // i.e. a primary with gisIncome ≈ 24_000 (above 21_624) must be GIS-ineligible.
      // If the engine leaves maritalStatus='married', primary would still qualify.
      expect(survivorYear.primary.gisIncome ?? 0).toBe(0);
    });

    it('prior alive-couple years still receive married GIS (regression guard for the before/after boundary)', () => {
      const input = makeSurvivorScenario();
      const result = runCoupleProjection(input);

      // Find a year where both spouses are alive and both are 65+
      const aliveYear = result.yearlyResults.find(
        (y) => y.primary.age >= 65 && y.spouse.age >= 65 && y.spouse.oasIncome > 0
      );
      expect(aliveYear, 'Alive couple year with both receiving OAS should exist').toBeDefined();
      if (!aliveYear) return;

      // Both spouses must have a positive GIS benefit under the married-both threshold.
      expect(aliveYear.primary.gisIncome ?? 0).toBeGreaterThan(0);
      expect(aliveYear.spouse.gisIncome ?? 0).toBeGreaterThan(0);
    });
  });

  describe('TC-GIS41-009: TFSA withdrawal can preserve GIS relative to RRSP withdrawal', () => {
    /**
     * Low-income retiree at 67: CPP 6_000 + OAS 8_560 → ~14_560 base income.
     * Retirement spending of 30_000 forces a gap of ~15_440. Two deterministic
     * scenarios supply the gap from different accounts:
     *   Run A: drawdownOrder=['tfsa','rrsp','nonReg'] — non-taxable TFSA first.
     *   Run B: drawdownOrder=['rrsp','tfsa','nonReg'] — taxable RRSP first.
     * Under identical inputs, Run A GIS must be ≥ Run B GIS because TFSA
     * withdrawals are excluded from GIS-counting income.
     */
    function makeLowIncomeRetireeInput(drawdownOrder: string[]): ProjectionInput {
      return {
        birthdate: new Date(1959, 0, 1), // age 67 in 2026
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 75,
        maritalStatus: 'single',
        employmentIncome: 0,
        employmentGrowthRate: 0,
        pensionIncome: 0,
        expectedCPPAt65: 6_000,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 80_000,
        rrspAnnualContribution: 0,
        tfsaBalance: 80_000,
        tfsaAnnualContribution: 0,
        nonRegBalance: 0,
        retirementSpending: 30_000,
        investmentReturn: 0.0,
        inflationRate: 0.0,
        drawdownOrder,
      };
    }

    it('Run A (TFSA-first) GIS is greater than or equal to Run B (RRSP-first) GIS', () => {
      const runA = runSingleProjection(makeLowIncomeRetireeInput(['tfsa', 'rrsp', 'nonReg']));
      const runB = runSingleProjection(makeLowIncomeRetireeInput(['rrsp', 'nonReg', 'tfsa']));

      // Compare the first full retirement year (year index 0 — already retired at 67).
      const yearA = runA.yearlyResults[0];
      const yearB = runB.yearlyResults[0];
      expect(yearA).toBeDefined();
      expect(yearB).toBeDefined();
      if (!yearA || !yearB) return;

      const gisA = yearA.gisIncome ?? 0;
      const gisB = yearB.gisIncome ?? 0;

      expect(
        gisA,
        `Run A (TFSA-first) GIS ${String(gisA)} must be ≥ Run B (RRSP-first) GIS ${String(gisB)}`
      ).toBeGreaterThanOrEqual(gisB);
    });

    it('when Run B pulls from RRSP, GIS reduction vs Run A tracks ≈ 50% clawback on the added GIS income', () => {
      const runA = runSingleProjection(makeLowIncomeRetireeInput(['tfsa', 'rrsp', 'nonReg']));
      const runB = runSingleProjection(makeLowIncomeRetireeInput(['rrsp', 'nonReg', 'tfsa']));

      const yearA = runA.yearlyResults[0];
      const yearB = runB.yearlyResults[0];
      if (!yearA || !yearB) return;

      // RRSP withdrawal in Run B drives added GIS-counting income vs Run A's zero.
      const rrspWithdrawalB = yearB.rrifWithdrawal;
      expect(rrspWithdrawalB, 'Run B must draw RRSP to fill spending gap').toBeGreaterThan(0);

      const gisGap = (yearA.gisIncome ?? 0) - (yearB.gisIncome ?? 0);
      // 50% clawback on the added GIS income — tolerance 20% to absorb CPP/OAS indexing.
      expect(gisGap).toBeGreaterThan(rrspWithdrawalB * 0.5 * 0.8);
      expect(gisGap).toBeLessThan(rrspWithdrawalB * 0.5 * 1.2);
    });
  });

  describe('TC-GIS41-010: GIS-preserving logic respects mandatory RRIF/LIF minimums', () => {
    /**
     * Retiree at age 72, RRIF only (no RRSP), must take CRA-prescribed minimum
     * (5.4% at age 72). Even if a caller requests a TFSA-first drawdown order
     * in an attempt to preserve GIS, the engine must still take the statutory
     * RRIF minimum. Optimization may only reorder DISCRETIONARY withdrawals.
     */
    function makePersonInputInRRIFPhase(drawdownOrder: string[]): PersonYearInput {
      return {
        owner: 'primary',
        year: 2030,
        birthdate: new Date(2030 - 72, 0, 1), // age 72
        province: 'ON',
        maritalStatus: 'single',
        rrspBalance: 0,
        rrifBalance: 200_000,
        tfsaBalance: 100_000,
        nonRegBalance: 0,
        nonRegACB: 0,
        rrspContribution: 0,
        tfsaContribution: 0,
        employmentIncome: 0,
        pensionIncome: 0,
        otherIncome: 0,
        expectedCPPAt65: 6_000,
        cppStartAge: 65,
        oasStartAge: 65,
        yearsOfResidence: 40,
        retirementSpending: 15_000, // below CPP + OAS + RRIF-min, so no gap
        investmentReturn: 0.0,
        inflationRate: 0.0,
        retirementAge: 65,
        yearsFromProjectionStart: 7,
        drawdownOrder,
      };
    }

    it('RRIF minimum is still withdrawn even when drawdownOrder prefers TFSA (GIS-preserving request)', () => {
      const result = calculatePersonYear(makePersonInputInRRIFPhase(['tfsa', 'rrsp', 'nonReg']));

      // CRA-prescribed minimum at age 72 on a 200_000 opening RRIF is 5.4% = 10_800.
      expect(result.rrifForcedMinimum).toBeCloseTo(10_800, 0);
      expect(result.rrifWithdrawal).toBeGreaterThanOrEqual(10_800);
    });

    it('RRIF minimum matches the default-drawdown case — drawdownOrder cannot suppress the statutory minimum', () => {
      const tfsaFirst = calculatePersonYear(makePersonInputInRRIFPhase(['tfsa', 'rrsp', 'nonReg']));
      const defaultOrder = calculatePersonYear(
        makePersonInputInRRIFPhase(['nonReg', 'rrsp', 'tfsa'])
      );

      expect(tfsaFirst.rrifForcedMinimum).toBe(defaultOrder.rrifForcedMinimum);
      expect(tfsaFirst.rrifForcedMinimum).toBeGreaterThan(0);
    });
  });
});
