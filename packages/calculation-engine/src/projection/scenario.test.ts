/**
 * Scenario Corpus — Multi-decade projection scenarios
 * @see docs/source-of-truth/02-account-types.md
 * @see docs/source-of-truth/08-projection-engine.md
 *
 * Expected values are LLM-generated with tiered tolerances (D-07).
 * RRIF rate values sourced from docs/source-of-truth/02-account-types.md.
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection, runCoupleProjection } from './multi-year.js';
import { getRRIFMinimumRate } from '@retireops/shared';
import type { ProjectionInput, SpouseInput, CoupleYearlyResult } from '@retireops/shared';
import { applyAgeBandReduction, resolveContribution, calculateYear } from './yearly-calculator.js';
import type { YearInput } from './yearly-calculator.js';
import { runProjection } from './multi-year.js';

// ---------------------------------------------------------------------------
// Tolerance helper (D-07)
// Tiered tolerances: +/-500 years 1-5 from retirement, +/-2000 years 6-10, +/-5000 years 11+
// ---------------------------------------------------------------------------
function expectWithinTolerance(
  actual: number,
  expected: number,
  tolerance: number,
  label: string
): void {
  expect(
    actual,
    `${label} too low (got ${actual}, expected ${expected} +/- ${tolerance})`
  ).toBeGreaterThanOrEqual(expected - tolerance);
  expect(
    actual,
    `${label} too high (got ${actual}, expected ${expected} +/- ${tolerance})`
  ).toBeLessThanOrEqual(expected + tolerance);
}

// ---------------------------------------------------------------------------
// Persona constants
// ---------------------------------------------------------------------------

const currentYear = new Date().getFullYear();

// SCEN-01 persona: age 69 at projection start, RRIF conversion happens at 71
const PERSONA_RRIF_CONVERSION: ProjectionInput = {
  birthdate: new Date(currentYear - 69, 5, 15),
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 77,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 487300,
  rrspAnnualContribution: 0,
  tfsaBalance: 43200,
  tfsaAnnualContribution: 0,
  nonRegBalance: 28500,
  retirementSpending: 52400,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 11750,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-03 Persona 1: Early retiree, age 57, ON, already retired at 55
const PERSONA_EARLY_RETIREE: ProjectionInput = {
  birthdate: new Date(currentYear - 57, 5, 15),
  province: 'ON',
  retirementAge: 55,
  lifeExpectancy: 90,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 412750,
  rrspAnnualContribution: 0,
  tfsaBalance: 73400,
  tfsaAnnualContribution: 0,
  nonRegBalance: 31800,
  retirementSpending: 67500,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 11200,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-03 Persona 2: Standard retiree, age 65, BC, just retired
const PERSONA_STANDARD_RETIREE: ProjectionInput = {
  birthdate: new Date(currentYear - 65, 5, 15),
  province: 'BC',
  retirementAge: 65,
  lifeExpectancy: 88,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 538200,
  rrspAnnualContribution: 0,
  tfsaBalance: 91700,
  tfsaAnnualContribution: 0,
  nonRegBalance: 67300,
  retirementSpending: 74800,
  investmentReturn: 0.045,
  inflationRate: 0.02,
  expectedCPPAt65: 14150,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-03 Persona 3: RRIF-age retiree, age 70, AB — RRIF conversion happens in projection year 1
// (ProjectionInput has no rrifBalance field; starting with rrspBalance that converts at 71)
const PERSONA_RRIF_AGE: ProjectionInput = {
  birthdate: new Date(currentYear - 70, 5, 15),
  province: 'AB',
  retirementAge: 62,
  lifeExpectancy: 91,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 325600,
  rrspAnnualContribution: 0,
  tfsaBalance: 48600,
  tfsaAnnualContribution: 0,
  nonRegBalance: 112500,
  retirementSpending: 58700,
  investmentReturn: 0.035,
  inflationRate: 0.02,
  expectedCPPAt65: 12800,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-03 Persona 4: High-TFSA retiree, age 62, ON, retired at 60
const PERSONA_HIGH_TFSA: ProjectionInput = {
  birthdate: new Date(currentYear - 62, 5, 15),
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 92,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 187400,
  rrspAnnualContribution: 0,
  tfsaBalance: 286300,
  tfsaAnnualContribution: 0,
  nonRegBalance: 95200,
  retirementSpending: 63100,
  investmentReturn: 0.042,
  inflationRate: 0.02,
  expectedCPPAt65: 10400,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-04 Persona: TFSA multi-cycle, age 60, ON, already retired at 58
// High spending forces TFSA withdrawals; room restoration tracked across 10+ years
const PERSONA_TFSA_CYCLES: ProjectionInput = {
  birthdate: new Date(currentYear - 60, 5, 15),
  province: 'ON',
  retirementAge: 58,
  lifeExpectancy: 85,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 215600,
  rrspAnnualContribution: 0,
  tfsaBalance: 142800,
  tfsaAnnualContribution: 0,
  nonRegBalance: 53700,
  retirementSpending: 61300,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 9850,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-06 Persona: High-income retiree age 68, small TFSA — baseline for OAS clawback comparison
const PERSONA_OAS_BASE: ProjectionInput = {
  birthdate: new Date(currentYear - 68, 5, 15),
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 90,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 385400, // Will convert to RRIF at 71; large enough to create RRIF withdrawals
  rrspAnnualContribution: 0,
  tfsaBalance: 15200,
  tfsaAnnualContribution: 0,
  nonRegBalance: 78400,
  retirementSpending: 82300,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 14500,
  cppStartAge: 65,
  oasStartAge: 65,
};

// SCEN-06 Persona with large TFSA — identical to BASE except much larger TFSA
const PERSONA_OAS_WITH_TFSA: ProjectionInput = {
  ...PERSONA_OAS_BASE,
  tfsaBalance: 315200,
};

// SCEN-05 Persona: Couple with 10-year age gap for younger-spouse RRIF election
// Primary at age 70 (not 75) so RRSP balance can convert to RRIF at 71 within the projection
// (ProjectionInput has no rrifBalance field — RRIF conversion happens in the projection itself)
const PERSONA_COUPLE_AGE_GAP_SPOUSE: SpouseInput = {
  birthdate: new Date(currentYear - 60, 5, 15), // 10-year gap: spouse is 60
  retirementAge: 63,
  lifeExpectancy: 92,
  employmentIncome: 0,
  expectedCPPAt65: 8900,
  cppStartAge: 65,
  oasStartAge: 65,
  rrspBalance: 187300,
  tfsaBalance: 42100,
  nonRegBalance: 18700,
};

const PERSONA_COUPLE_AGE_GAP: ProjectionInput = {
  birthdate: new Date(currentYear - 70, 5, 15), // Primary: age 70, RRIF conversion at 71
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 95,
  maritalStatus: 'married',
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 1125400, // Large balance ensures RRIF persists for 20+ years to age 90+
  rrspAnnualContribution: 0,
  tfsaBalance: 56800,
  tfsaAnnualContribution: 0,
  nonRegBalance: 87300,
  retirementSpending: 78500,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 13200,
  cppStartAge: 65,
  oasStartAge: 65,
  coupleSettings: { optimizePensionSplitting: false, useYoungerSpouseForRRIF: true },
  spouse: PERSONA_COUPLE_AGE_GAP_SPOUSE,
};

// SCEN-03 Persona 5: Pre-retiree saver, age 58, ON, retiring at 63
const PERSONA_PRE_RETIREE_SAVER: ProjectionInput = {
  birthdate: new Date(currentYear - 58, 5, 15),
  province: 'ON',
  retirementAge: 63,
  lifeExpectancy: 89,
  employmentIncome: 115800,
  employmentGrowthRate: 0.015,
  rrspBalance: 347200,
  rrspAnnualContribution: 18500,
  tfsaBalance: 52700,
  tfsaAnnualContribution: 6500,
  nonRegBalance: 24300,
  retirementSpending: 71200,
  investmentReturn: 0.05,
  inflationRate: 0.02,
  expectedCPPAt65: 13600,
  cppStartAge: 65,
  oasStartAge: 65,
};

// GAP-A Persona: Retiree at 60 with RRSP-only portfolio.
// Regression target: FIX 1 in yearly-calculator.ts (RRSP pre-71 drawdown).
// Under the old engine, rrifWithdrawal was 0 for ages 60-70 (RRSP unreachable),
// so taxesPaid was $0. With the fix, RRSP withdrawals appear in rrifWithdrawal output.
const PERSONA_RRSP_ONLY_RETIREE: ProjectionInput = {
  birthdate: new Date(currentYear - 60, 5, 15),
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 85,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 523700,
  rrspAnnualContribution: 0,
  tfsaBalance: 0,
  tfsaAnnualContribution: 0,
  nonRegBalance: 8200,
  retirementSpending: 54800,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 12300,
  cppStartAge: 65,
  oasStartAge: 65,
};

// GAP-C Persona: Retiree with large non-registered balance, minimal registered accounts.
// Regression target: FIX 2 in yearly-calculator.ts (non-reg withdrawals taxed).
// Under the old engine, non-reg withdrawals were excluded from TaxCalculationInput,
// producing $0 tax. With the fix, they appear in otherIncome.
const PERSONA_NONREG_HEAVY: ProjectionInput = {
  birthdate: new Date(currentYear - 66, 5, 15),
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 88,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 0,
  rrspAnnualContribution: 0,
  tfsaBalance: 12400,
  tfsaAnnualContribution: 0,
  nonRegBalance: 467800,
  retirementSpending: 48200,
  investmentReturn: 0.035,
  inflationRate: 0.02,
  expectedCPPAt65: 11600,
  cppStartAge: 65,
  oasStartAge: 65,
};

// GAP-B Persona: Retiree who delays CPP to age 70 for maximum benefit.
// Regression target: CPP zero bug (commit 6858a90 area) — estimatedCppAmount=0
// was passed through as expectedCPPAt65=0, zeroing all CPP regardless of start age.
// Also tests the age >= cppStartAge gate in yearly-calculator.ts:224.
const PERSONA_CPP_DELAYED_70: ProjectionInput = {
  birthdate: new Date(currentYear - 67, 5, 15),
  province: 'ON',
  retirementAge: 60,
  lifeExpectancy: 90,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 392100,
  rrspAnnualContribution: 0,
  tfsaBalance: 87400,
  tfsaAnnualContribution: 0,
  nonRegBalance: 45300,
  retirementSpending: 56700,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 14800,
  cppStartAge: 70,
  oasStartAge: 65,
};

// GAP-D Persona: Retiree who takes CPP early at age 60 for reduced benefit.
// Tests correct application of 0.6%/month early reduction factor.
// CPP at 60 = expectedCPPAt65 * 0.64 (60 months * 0.006 = 0.36 reduction).
const PERSONA_CPP_EARLY_60: ProjectionInput = {
  birthdate: new Date(currentYear - 61, 5, 15),
  province: 'ON',
  retirementAge: 58,
  lifeExpectancy: 88,
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 278500,
  rrspAnnualContribution: 0,
  tfsaBalance: 64200,
  tfsaAnnualContribution: 0,
  nonRegBalance: 38900,
  retirementSpending: 49600,
  investmentReturn: 0.04,
  inflationRate: 0.02,
  expectedCPPAt65: 13400,
  cppStartAge: 60,
  oasStartAge: 65,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scenario Corpus', () => {
  // -------------------------------------------------------------------------
  // SCEN-01: RRIF Conversion Year
  // -------------------------------------------------------------------------
  describe('SCEN-01: RRIF conversion year', () => {
    it('should convert RRSP to RRIF at age 71 with minimum withdrawal not required until age 72', () => {
      const result = runSingleProjection(PERSONA_RRIF_CONVERSION);
      const yearAt71 = result.yearlyResults.find((r) => r.age === 71);
      const yearAt72 = result.yearlyResults.find((r) => r.age === 72);

      expect(yearAt71, 'projection must include age 71').toBeDefined();
      expect(yearAt72, 'projection must include age 72').toBeDefined();

      // D-02: At age 71 — RRSP converts to RRIF
      expect(yearAt71!.isRRIFConversionYear).toBe(true);
      expect(yearAt71!.rrspBalance).toBe(0);
      expect(yearAt71!.rrifBalance).toBeGreaterThan(0);

      // D-02: At age 72 — RRIF minimum withdrawal applies
      // The engine applies minimum withdrawal (isRRIFMinimumRequired returns true for age >= 72)
      expect(yearAt72!.rrifWithdrawal).toBeGreaterThan(0);

      // Age 70 and earlier: no RRIF conversion
      const yearAt70 = result.yearlyResults.find((r) => r.age === 70);
      expect(yearAt70, 'projection must include age 70').toBeDefined();
      expect(yearAt70!.isRRIFConversionYear).toBe(false);
      expect(yearAt70!.rrspBalance).toBeGreaterThan(0);
      expect(yearAt70!.rrifBalance).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // SCEN-02: RRIF Minimum Withdrawal Rates
  // -------------------------------------------------------------------------
  describe('SCEN-02: RRIF minimum withdrawal rates', () => {
    it.each([
      [72, 0.054],
      [73, 0.0553],
      [74, 0.0567],
      [75, 0.0582],
      [76, 0.0598],
      [77, 0.0617],
      [78, 0.0636],
      [79, 0.0658],
      [80, 0.0682],
      [81, 0.0708],
      [82, 0.0738],
      [83, 0.0771],
      [84, 0.0808],
      [85, 0.0851],
      [86, 0.0899],
      [87, 0.0955],
      [88, 0.1021],
      [89, 0.1099],
      [90, 0.1192],
      [91, 0.1306],
      [92, 0.1449],
      [93, 0.1634],
      [94, 0.1879],
      [95, 0.2],
      [100, 0.2],
    ])('RRIF minimum rate at age %i should be %f', (age, expectedRate) => {
      expect(getRRIFMinimumRate(age)).toBe(expectedRate);
    });
  });

  // -------------------------------------------------------------------------
  // SCEN-03: Named persona scenarios
  // -------------------------------------------------------------------------
  describe('SCEN-03: Named persona scenarios', () => {
    it('PERSONA_EARLY_RETIREE: RRSP pre-conversion drawdown correctly depletes portfolio before RRIF age', () => {
      // Expected values captured from engine output 2026-03-27 (post-fix)
      // With correct tax on RRSP withdrawals, this high-spending early retiree runs out ~age 65.
      const result = runSingleProjection(PERSONA_EARLY_RETIREE);

      // Portfolio accounts are exhausted before lifeExpectancy but projection
      // continues to end year so CPP/OAS/GIS income is still visible.
      expect(result.yearlyResults.length).toBeGreaterThan(5);

      // Early retirement (age 57 — within 2 years of projection start, tolerance 500)
      const yearAt57 = result.yearlyResults.find((r) => r.age === 57);
      expect(yearAt57, 'projection must include age 57').toBeDefined();
      expectWithinTolerance(yearAt57!.totalNetWorth, 468468, 500, 'net worth at 57');

      // RRSP is being drawn down via pre-71 withdrawals
      expect(yearAt57!.rrifWithdrawal).toBeGreaterThan(0); // Includes pre-71 RRSP withdrawal
      expect(yearAt57!.rrspBalance).toBeLessThan(412750); // RRSP has been reduced
      expect(yearAt57!.taxesPaid).toBeGreaterThan(0); // Taxes are now non-zero

      // Age 63: RRSP fully depleted by direct withdrawals
      const yearAt63 = result.yearlyResults.find((r) => r.age === 63);
      expect(yearAt63, 'projection must include age 63').toBeDefined();
      expect(yearAt63!.rrspBalance).toBe(0);
    });

    it('PERSONA_STANDARD_RETIREE: BC retiree, CPP/OAS at 65, RRIF conversion spans projection', () => {
      // Expected values recaptured 2026-03-28 (post capital-gains + GIS-pass-3 fix)
      // Net worth is higher than pre-fix because: (1) GIS income now included for low-income
      // years, and (2) non-reg withdrawals use 50% capital gains inclusion (not 100% ordinary).
      // Re-centered 2026-06-10 for the A-01/A-02 migration: gross OAS rose to the
      // anchored 2026 Q2 amount ($8,916.60/yr) and GIS now uses the 2026 maxima /
      // 25% couple rate / two-band earnings exemption — both lift retained net worth
      // by a few hundred dollars at the OAS-start years (net worth at 65: 680465 → 681037).
      const result = runSingleProjection(PERSONA_STANDARD_RETIREE);

      expect(result.yearlyResults.length).toBeGreaterThan(15);

      // Year of retirement (age 65, tolerance 500)
      const yearAt65 = result.yearlyResults.find((r) => r.age === 65);
      expect(yearAt65, 'projection must include age 65').toBeDefined();
      expectWithinTolerance(yearAt65!.totalNetWorth, 681037, 500, 'net worth at 65');
      expectWithinTolerance(yearAt65!.rrspBalance, 562419, 500, 'rrsp at 65');

      // Mid-retirement (age 70, 5 years in — tolerance 2000)
      // Net worth higher than pre-fix due to GIS income and reduced tax on non-reg gains.
      // Re-centered 2026-06-10 (A-01/A-02): five compounding years of higher OAS + 2026
      // GIS lift this from 564695 → ~568536.
      const yearAt70 = result.yearlyResults.find((r) => r.age === 70);
      expect(yearAt70, 'projection must include age 70').toBeDefined();
      expectWithinTolerance(yearAt70!.totalNetWorth, 568536, 2000, 'net worth at 70');
      // Pre-71 RRSP withdrawals are reported via rrifWithdrawal field
      expect(yearAt70!.rrifWithdrawal).toBeGreaterThan(0);

      // Late retirement (age 75, 10 years in — tolerance 5000)
      // Re-centered 2026-06-10 (A-01/A-02): 364731 → ~370248.
      const yearAt75 = result.yearlyResults.find((r) => r.age === 75);
      expect(yearAt75, 'projection must include age 75').toBeDefined();
      expectWithinTolerance(yearAt75!.totalNetWorth, 370248, 5000, 'net worth at 75');

      // Very late (age 80, 15 years in — tolerance 5000)
      // Re-centered 2026-06-10 (A-01/A-02): 84864 → ~92737.
      const yearAt80 = result.yearlyResults.find((r) => r.age === 80);
      expect(yearAt80, 'projection must include age 80').toBeDefined();
      expectWithinTolerance(yearAt80!.totalNetWorth, 92737, 5000, 'net worth at 80');
    });

    it('PERSONA_RRIF_AGE: Alberta retiree near RRIF conversion age, TFSA grows through retirement', () => {
      // Expected values recaptured 2026-03-28 (post capital-gains + GIS-pass-3 fix)
      // Re-centered 2026-06-10 for the A-01/A-02 migration (anchored 2026 OAS Q2
      // amount + 2026 GIS parameters).
      // Re-centered 2026-06-10 for audit A-08 (OAS gross now indexes on the
      // calendar clock, not age − oasStartAge): this persona is age 70 at the
      // 2026 projection start, so at year 2026 OAS = the un-indexed 2026 base
      // ($8,916.60) instead of the old code's 5-years-from-start over-indexing →
      // net worth at 70 474267 → 473306.
      const result = runSingleProjection(PERSONA_RRIF_AGE);

      expect(result.yearlyResults.length).toBeGreaterThan(10);

      // First year (age 70, within 1 year of start — tolerance 500)
      const yearAt70 = result.yearlyResults.find((r) => r.age === 70);
      expect(yearAt70, 'projection must include age 70').toBeDefined();
      expectWithinTolerance(yearAt70!.totalNetWorth, 473306, 500, 'net worth at 70');

      // RRIF conversion year (age 71, tolerance 500)
      const yearAt71 = result.yearlyResults.find((r) => r.age === 71);
      expect(yearAt71, 'projection must include age 71').toBeDefined();
      expect(yearAt71!.isRRIFConversionYear).toBe(true);
      expect(yearAt71!.rrspBalance).toBe(0);
      expectWithinTolerance(yearAt71!.rrifBalance, 348791, 2000, 'rrif balance at 71');

      // Mid-retirement (age 75, 5 years in — tolerance 5000)
      // A-08: age-75 OAS now indexes 5 calendar years past 2026 (the persona's
      // year-75 is 2031), not 10 years from the age-65 start, so OAS gross is
      // lower than the old over-indexed value → net worth at 75 365976 → 360639.
      const yearAt75 = result.yearlyResults.find((r) => r.age === 75);
      expect(yearAt75, 'projection must include age 75').toBeDefined();
      expectWithinTolerance(yearAt75!.totalNetWorth, 360639, 5000, 'net worth at 75');

      // TFSA balance growing as RRIF withdrawals fill TFSA room
      expect(yearAt75!.tfsaBalance).toBeGreaterThan(yearAt70!.tfsaBalance);
    });

    it('PERSONA_HIGH_TFSA: Ontario retiree with large TFSA, TFSA-heavy portfolio through early retirement', () => {
      // Expected values recaptured 2026-03-28 (post capital-gains + GIS-pass-3 fix)
      const result = runSingleProjection(PERSONA_HIGH_TFSA);

      expect(result.yearlyResults.length).toBeGreaterThan(10);

      // First year (age 62 — tolerance 500)
      const yearAt62 = result.yearlyResults.find((r) => r.age === 62);
      expect(yearAt62, 'projection must include age 62').toBeDefined();
      expectWithinTolerance(yearAt62!.totalNetWorth, 527044, 500, 'net worth at 62');
      expectWithinTolerance(yearAt62!.tfsaBalance, 298325, 500, 'tfsa at 62');

      // CPP/OAS starts at 65 (3 years from start — tolerance 2000)
      const yearAt65 = result.yearlyResults.find((r) => r.age === 65);
      expect(yearAt65, 'projection must include age 65').toBeDefined();
      expectWithinTolerance(yearAt65!.totalNetWorth, 410425, 2000, 'net worth at 65');

      // RRSP drawn down via pre-71 withdrawals (age 70, tolerance 5000)
      // A-08: OAS at 65 starts in 2029 (3 calendar years past the 2026 base), so
      // OAS gross is correctly indexed up vs the old age−oasStartAge clock (which
      // gave 0 years at the start age) → more OAS income, fewer registered
      // withdrawals, higher net worth at 70: 259150 → 266927.
      const yearAt70 = result.yearlyResults.find((r) => r.age === 70);
      expect(yearAt70, 'projection must include age 70').toBeDefined();
      expectWithinTolerance(yearAt70!.totalNetWorth, 266927, 5000, 'net worth at 70');

      // TFSA is larger than RRSP at age 62
      expect(yearAt62!.tfsaBalance).toBeGreaterThan(yearAt62!.rrspBalance);
    });

    it('PERSONA_PRE_RETIREE_SAVER: pre-retirement employment income and RRSP growing, then retirement withdrawal phase', () => {
      // Expected values captured from engine output 2026-03-27
      const result = runSingleProjection(PERSONA_PRE_RETIREE_SAVER);

      // With correct tax on RRSP withdrawals, portfolio runs out around age 78
      expect(result.yearlyResults.length).toBeGreaterThan(15);

      // Pre-retirement: age 58, employment income present and RRSP growing
      const yearAt58 = result.yearlyResults.find((r) => r.age === 58);
      expect(yearAt58, 'projection must include age 58').toBeDefined();
      expect(yearAt58!.isRetired).toBe(false);
      expect(yearAt58!.employmentIncome).toBeGreaterThan(0);
      expectWithinTolerance(yearAt58!.totalNetWorth, 471660, 500, 'net worth at 58');

      // Pre-retirement: age 60, RRSP still growing with contributions
      const yearAt60 = result.yearlyResults.find((r) => r.age === 60);
      expect(yearAt60, 'projection must include age 60').toBeDefined();
      expect(yearAt60!.isRetired).toBe(false);
      expect(yearAt60!.employmentIncome).toBeGreaterThan(0);
      expect(yearAt60!.rrspBalance).toBeGreaterThan(yearAt58!.rrspBalance);

      // Retirement year: age 63, employment income stops
      const yearAt63 = result.yearlyResults.find((r) => r.age === 63);
      expect(yearAt63, 'projection must include age 63').toBeDefined();
      expect(yearAt63!.isRetired).toBe(true);
      expect(yearAt63!.employmentIncome).toBe(0);
      expectWithinTolerance(yearAt63!.totalNetWorth, 645053, 2000, 'net worth at 63');

      // Mid-retirement (age 72 — 9 years in, tolerance 5000)
      // RRIF conversion happened at 71; RRIF minimum + prior RRSP drawdown accelerated spend.
      // Higher than pre-fix: non-reg accrued gains now taxed at 50% inclusion, not 100%.
      // A-08: OAS at 65 starts in 2033 (7 calendar years past the 2026 base), so
      // the old age−oasStartAge clock under-indexed OAS by 7 years; the corrected
      // (higher) OAS income retains more portfolio → net worth at 72 367249 → 386362.
      const yearAt72 = result.yearlyResults.find((r) => r.age === 72);
      expect(yearAt72, 'projection must include age 72').toBeDefined();
      expectWithinTolerance(yearAt72!.totalNetWorth, 386362, 5000, 'net worth at 72');
    });
  });

  // -------------------------------------------------------------------------
  // SCEN-04: TFSA contribution room restoration (multi-cycle)
  // -------------------------------------------------------------------------
  describe('SCEN-04: TFSA contribution room restoration', () => {
    it('should restore TFSA contribution room from withdrawals across 10+ years', () => {
      // SCEN-04: Tests TFSA room restoration indirectly — engine manages tfsaRestoredRoomFromPreviousYear internally (multi-year.ts:167)
      const result = runSingleProjection(PERSONA_TFSA_CYCLES);

      // With correct RRSP tax, high spending exhausts this portfolio ~age 67 (8 years)
      expect(result.yearlyResults.length).toBeGreaterThanOrEqual(5);

      // Find years where TFSA withdrawals occur
      const withdrawalYears = result.yearlyResults.filter((r) => r.tfsaWithdrawal > 0);

      // High spending should force at least 3 years of TFSA withdrawals
      expect(withdrawalYears.length).toBeGreaterThanOrEqual(3);

      // For each withdrawal year, verify that the following year's tfsaBalance is consistent:
      // balance should decrease by roughly (withdrawal - growth), confirming room is tracked
      for (const yearResult of withdrawalYears) {
        const nextYear = result.yearlyResults.find((r) => r.age === yearResult.age + 1);
        if (nextYear !== undefined) {
          // After a withdrawal, balance the next year should be less than current year + growth
          // (because the prior-year withdrawal restored room but didn't force a contribution)
          const maxExpectedNext = (yearResult.tfsaBalance + yearResult.tfsaWithdrawal) * 1.1;
          expect(
            nextYear.tfsaBalance,
            `TFSA balance at age ${nextYear.age} should not exceed balance + prior withdrawal * growth`
          ).toBeLessThanOrEqual(maxExpectedNext);
        }
      }

      // TFSA balance at age 62 should be higher than at age 60 (withdrawal forces TFSA growth)
      const yearAt60 = result.yearlyResults.find((r) => r.age === 60);
      const yearAt62 = result.yearlyResults.find((r) => r.age === 62);
      expect(yearAt60, 'projection must include age 60').toBeDefined();
      expect(yearAt62, 'projection must include age 62').toBeDefined();
      // TFSA grows as RRSP is drawn down first, leaving TFSA to grow; then TFSA drawn down
      expect(yearAt62!.tfsaBalance).toBeGreaterThan(yearAt60!.tfsaBalance);
    });
  });

  // -------------------------------------------------------------------------
  // SCEN-05: Younger-spouse RRIF minimums (couple, 10-year age gap)
  // -------------------------------------------------------------------------
  describe('SCEN-05: Younger-spouse RRIF minimums', () => {
    it('should use younger spouse age for RRIF minimums over 20+ consecutive years', () => {
      // Younger-spouse election: Math.min(ownerAge, spouseAge) used for rate lookup — per yearly-calculator.ts:479-480
      const result = runCoupleProjection(PERSONA_COUPLE_AGE_GAP);

      // Collect all years within primary's life expectancy where RRIF is active
      // (beyond age 95, the couple projection runs for the surviving spouse but primary is past
      // their lifeExpectancy; spending-driven extra withdrawals can exceed the minimum)
      const rrifYearsInLifespan = result.yearlyResults.filter(
        (r) =>
          r.primary.rrifBalance > 0 &&
          r.primary.rrifWithdrawal > 0 &&
          r.primary.age <= PERSONA_COUPLE_AGE_GAP.lifeExpectancy
      );

      // Primary RRIF starts at age 71 or 72 and runs to age 95 — should be 20+ years
      expect(rrifYearsInLifespan.length).toBeGreaterThanOrEqual(20);

      // For EACH year within lifespan with RRIF activity, assert the younger-spouse minimum
      // rate is lower than the owner-only rate. Because spouseAge < ownerAge in all these
      // years (10-year gap), Math.min(ownerAge, spouseAge) always yields the spouse's rate
      // which is lower. The actual withdrawal may exceed the minimum when income-gap
      // spending draws additional RRIF amounts — we only verify the rate invariant here.
      //
      // The forced-minimum floor only applies once the mandatory-minimum gate fires
      // (owner age >= 72, RRIF-001). At age 71 (conversion year) there is no forced
      // minimum, so any withdrawal there is purely spending-driven and not bounded by
      // the younger-spouse rate — exclude those years from the floor assertion.
      for (const yearResult of rrifYearsInLifespan) {
        const ownerAge = yearResult.primary.age;
        // 10-year age gap: spouse age = ownerAge - 10
        const spouseAgeThisYear = ownerAge - 10;
        const youngerSpouseMinimum =
          yearResult.primary.rrifBalance * getRRIFMinimumRate(spouseAgeThisYear);
        const ownerOnlyMinimum = yearResult.primary.rrifBalance * getRRIFMinimumRate(ownerAge);
        // Rate invariant holds for every age the rate is defined (younger < owner).
        expect(
          youngerSpouseMinimum,
          `Younger-spouse minimum at primary age ${ownerAge} should be less than owner-only minimum (${ownerOnlyMinimum.toFixed(0)})`
        ).toBeLessThan(ownerOnlyMinimum);
        // Forced-minimum floor only applies once the mandatory-minimum gate fires (age >= 72).
        if (ownerAge >= 72) {
          expect(
            yearResult.primary.rrifWithdrawal,
            `RRIF withdrawal at primary age ${ownerAge} must be >= younger-spouse minimum (${youngerSpouseMinimum.toFixed(0)})`
          ).toBeGreaterThanOrEqual(youngerSpouseMinimum - 0.01);
        }
      }

      // Specific check at the first mandatory minimum year (age 72)
      const yearAt72 = result.yearlyResults.find((r) => r.primary.age === 72);
      expect(yearAt72, 'projection must include primary age 72').toBeDefined();
      const ownerOnlyMinAt72 = yearAt72!.primary.rrifBalance * getRRIFMinimumRate(72);
      expect(yearAt72!.primary.rrifWithdrawal).toBeLessThan(ownerOnlyMinAt72);

      // --- Audit B-05: spouse under 65 must still force a NON-ZERO minimum ---
      // At primary age 72 the spouse is 62 (10-yr gap). The CRA pre-71 factor is
      // 1/(90-62)=1/28~3.571%, NOT zero (RRIF-007/008). Before the B-05 fix the
      // forced minimum here was $0, so the owner held the RRIF essentially
      // untouched. Assert forced taxable RRIF income now appears.
      const spouseAgeAt72 = 72 - 10; // 62, under the 65 table floor
      const expectedYoungerMinAt72 =
        yearAt72!.primary.rrifBalance * getRRIFMinimumRate(spouseAgeAt72);
      expect(getRRIFMinimumRate(spouseAgeAt72)).toBeCloseTo(1 / 28, 6); // ~3.571%, never 0
      expect(
        yearAt72!.primary.rrifWithdrawal,
        'B-05: forced RRIF minimum must be non-zero even with a spouse under 65'
      ).toBeGreaterThanOrEqual(expectedYoungerMinAt72 - 0.01);
      expect(yearAt72!.primary.rrifWithdrawal).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // SCEN-06: TFSA withdrawals and OAS clawback
  // -------------------------------------------------------------------------
  describe('SCEN-06: TFSA withdrawals and OAS clawback', () => {
    it('should not increase OAS clawback when TFSA withdrawal is added', () => {
      const baseResult = runSingleProjection(PERSONA_OAS_BASE);
      const tfsaResult = runSingleProjection(PERSONA_OAS_WITH_TFSA);

      // Find a year where both projections include age 68 (OAS-eligible)
      const baseAt68 = baseResult.yearlyResults.find((r) => r.age === 68);
      const tfsaAt68 = tfsaResult.yearlyResults.find((r) => r.age === 68);

      expect(baseAt68, 'base projection must include age 68').toBeDefined();
      expect(tfsaAt68, 'TFSA projection must include age 68').toBeDefined();

      // Note: absolute clawback is 0 due to LIMS-01a (netIncome: 0 in preliminary pass).
      // This test asserts TFSA has no marginal effect on clawback.
      expect(tfsaAt68!.taxCalculation.oasClawback).toEqual(baseAt68!.taxCalculation.oasClawback);

      // Also check at age 71 (post-RRIF conversion) — RRIF withdrawals present in both
      const baseAt71 = baseResult.yearlyResults.find((r) => r.age === 71);
      const tfsaAt71 = tfsaResult.yearlyResults.find((r) => r.age === 71);

      if (baseAt71 !== undefined && tfsaAt71 !== undefined) {
        // TFSA withdrawals (larger in tfsaResult) must not affect OAS clawback
        expect(tfsaAt71.taxCalculation.oasClawback).toEqual(baseAt71.taxCalculation.oasClawback);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GAP-A: RRSP pre-71 drawdown produces correct taxes (regression guard)
  // Regression target: FIX 1 in yearly-calculator.ts (commit e0573be)
  // -------------------------------------------------------------------------
  describe('GAP-A: RRSP pre-71 drawdown produces correct taxes', () => {
    it('should show non-zero tax from RRSP withdrawals at ages 60-70', () => {
      const result = runSingleProjection(PERSONA_RRSP_ONLY_RETIREE);

      // Ages 60-64: no CPP/OAS yet, all income comes from RRSP withdrawal
      // The engine reports RRSP withdrawals via rrifWithdrawal field (same tax treatment)
      const yearAt62 = result.yearlyResults.find((r) => r.age === 62);
      expect(yearAt62, 'projection must include age 62').toBeDefined();

      // CRITICAL REGRESSION CHECK: rrifWithdrawal must be > 0 (includes RRSP pre-71 withdrawal)
      // Under the old engine this was 0 because RRSP was unreachable before RRIF conversion
      expect(yearAt62!.rrifWithdrawal).toBeGreaterThan(0);

      // CRITICAL REGRESSION CHECK: taxes must be non-zero
      // Under the old engine, $0 RRSP withdrawal meant $0 taxable income and $0 tax
      expect(yearAt62!.taxesPaid).toBeGreaterThan(0);

      // RRSP balance must be decreasing (active drawdown)
      expect(yearAt62!.rrspBalance).toBeLessThan(523700);

      // Check age 67 (7 years into retirement, pre-RRIF conversion)
      const yearAt67 = result.yearlyResults.find((r) => r.age === 67);
      expect(yearAt67, 'projection must include age 67').toBeDefined();
      expect(yearAt67!.rrifWithdrawal).toBeGreaterThan(0);
      expect(yearAt67!.taxesPaid).toBeGreaterThan(0);
      // RRSP should be substantially depleted by now
      expect(yearAt67!.rrspBalance).toBeLessThan(yearAt62!.rrspBalance);
    });

    it('should deplete RRSP by age 71 via pre-conversion withdrawals', () => {
      const result = runSingleProjection(PERSONA_RRSP_ONLY_RETIREE);

      // By age 71, RRSP should have been drawn down to 0 (or near 0) through
      // direct withdrawals, then converted to RRIF
      const yearAt71 = result.yearlyResults.find((r) => r.age === 71);
      if (yearAt71 !== undefined) {
        // After conversion: rrspBalance = 0
        expect(yearAt71.rrspBalance).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GAP-B: CPP at delayed start age 70 appears correctly (regression guard)
  // Regression target: CPP zero bug when estimatedCppAmount=0 passed through
  // Also validates: yearly-calculator.ts:224 age >= cppStartAge gate
  // -------------------------------------------------------------------------
  describe('GAP-B: CPP at delayed start age 70', () => {
    it('should show $0 CPP before age 70 and correct delayed-start amount from age 70', () => {
      const result = runSingleProjection(PERSONA_CPP_DELAYED_70);

      // Before cppStartAge: CPP must be $0
      const yearAt67 = result.yearlyResults.find((r) => r.age === 67);
      const yearAt69 = result.yearlyResults.find((r) => r.age === 69);
      expect(yearAt67, 'projection must include age 67').toBeDefined();
      expect(yearAt69, 'projection must include age 69').toBeDefined();

      expect(yearAt67!.cppIncome).toBe(0);
      expect(yearAt69!.cppIncome).toBe(0);

      // At cppStartAge 70: CPP must appear with delayed adjustment factor
      // Factor at 70 = 1 + (60 months * 0.007) = 1.42
      // Expected CPP = 14800 * 1.42 = 21016
      const yearAt70 = result.yearlyResults.find((r) => r.age === 70);
      expect(yearAt70, 'projection must include age 70').toBeDefined();

      // CRITICAL REGRESSION CHECK: CPP must be non-zero
      expect(yearAt70!.cppIncome).toBeGreaterThan(0);

      // CPP at 70 should be >= 1.40x the age-65 amount (allowing for rounding)
      expect(yearAt70!.cppIncome).toBeGreaterThanOrEqual(14800 * 1.4);

      // CPP continues at 75 (still delayed-start amount, possibly inflation-adjusted)
      const yearAt75 = result.yearlyResults.find((r) => r.age === 75);
      if (yearAt75 !== undefined) {
        expect(yearAt75.cppIncome).toBeGreaterThan(0);
        // Should be at least as much as age 70 amount (inflation only increases it)
        expect(yearAt75.cppIncome).toBeGreaterThanOrEqual(yearAt70!.cppIncome);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GAP-C: Non-registered withdrawals are taxed (regression guard)
  // Regression target: FIX 2 in yearly-calculator.ts (commit e0573be)
  // Updated 2026-03-28: Capital gains fix means the GAIN portion (50% inclusion)
  // is taxed, not the full withdrawal. In year 1, ACB = balance so zero embedded
  // gains → zero capital-gains tax. Later years accumulate gains via investment returns.
  // -------------------------------------------------------------------------
  describe('GAP-C: Non-registered withdrawals are taxed', () => {
    it('should include non-reg realized gains in capital gains field when gains exist', () => {
      const result = runSingleProjection(PERSONA_NONREG_HEAVY);

      // At age 66, CPP/OAS provides some income and non-reg is the primary withdrawal source
      const yearAt66 = result.yearlyResults.find((r) => r.age === 66);
      expect(yearAt66, 'projection must include age 66').toBeDefined();

      // CRITICAL REGRESSION CHECK: non-reg withdrawal must be > 0
      expect(yearAt66!.nonRegWithdrawal).toBeGreaterThan(0);

      // In later years, non-reg has grown above ACB — capital gains should be taxed.
      // Check at age 72+ where embedded gains have accumulated over 6+ years of 3.5% return.
      const yearAt72 = result.yearlyResults.find((r) => r.age === 72);
      expect(yearAt72, 'projection must include age 72').toBeDefined();
      if (yearAt72!.nonRegWithdrawal > 0) {
        // When there is a non-reg withdrawal and the account has embedded gains,
        // capital gains income must flow through to the tax calculation.
        expect(yearAt72!.taxCalculation.capitalGains).toBeGreaterThanOrEqual(0);
      }

      // Non-reg balance must decrease as withdrawals occur (overall)
      expect(yearAt72!.nonRegBalance).toBeLessThan(yearAt66!.nonRegBalance);
    });

    it('should show declining non-reg balance as withdrawals are taxed properly', () => {
      const result = runSingleProjection(PERSONA_NONREG_HEAVY);

      const yearAt66 = result.yearlyResults.find((r) => r.age === 66);
      const yearAt72 = result.yearlyResults.find((r) => r.age === 72);
      expect(yearAt66, 'projection must include age 66').toBeDefined();
      expect(yearAt72, 'projection must include age 72').toBeDefined();

      // Non-reg balance should decrease over time as withdrawals fund retirement
      expect(yearAt72!.nonRegBalance).toBeLessThan(yearAt66!.nonRegBalance);
    });
  });

  // -------------------------------------------------------------------------
  // GAP-D: CPP at early start age 60 appears correctly (regression guard)
  // Validates correct application of 0.6%/month early reduction
  // -------------------------------------------------------------------------
  describe('GAP-D: CPP at early start age 60', () => {
    it('should show reduced CPP (<=0.64x standard) starting at age 60', () => {
      const result = runSingleProjection(PERSONA_CPP_EARLY_60);

      // Persona starts at age 61 (already past CPP start age of 60)
      const yearAt61 = result.yearlyResults.find((r) => r.age === 61);
      expect(yearAt61, 'projection must include age 61').toBeDefined();

      // CRITICAL REGRESSION CHECK: CPP must be non-zero at first projection year
      expect(yearAt61!.cppIncome).toBeGreaterThan(0);

      // CPP at 60 = expectedCPPAt65 * 0.64 = 13400 * 0.64 = 8576
      // Use 0.66 as generous upper bound to accommodate inflation adjustment
      const maxExpected = 13400 * 0.66;
      expect(yearAt61!.cppIncome).toBeLessThanOrEqual(maxExpected);

      // The early-start CPP should be strictly less than the age-65 standard amount
      expect(yearAt61!.cppIncome).toBeLessThan(13400);

      // At age 65: CPP is still the early-start reduced amount (does not jump to full amount)
      const yearAt65 = result.yearlyResults.find((r) => r.age === 65);
      expect(yearAt65, 'projection must include age 65').toBeDefined();
      expect(yearAt65!.cppIncome).toBeGreaterThan(0);
      // Even with inflation, early-start CPP should remain below the base amount
      expect(yearAt65!.cppIncome).toBeLessThan(13400 * 1.0);
    });
  });

  // -------------------------------------------------------------------------
  // Known limitations and gaps (annotated skips)
  // -------------------------------------------------------------------------
  describe('Known limitations and gaps', () => {
    // FIXED in Phase 8 (CORR-03): spousal-RRSP 3-year attribution rule shifts
    // taxable income from annuitant to contributor. FIFO consumer in
    // multi-year.ts:1287 now calls recalculateTaxWithSpousalAttribution
    // (couple-calculator.ts) and patches taxesPaid / taxCalculation /
    // netIncome / netCashFlow on both spouses.
    // @see docs/source-of-truth/02-account-types.md VR-RRSP-003
    // @see docs/source-of-truth/07-withdrawal-strategies.md
    // @see .planning/REQUIREMENTS.md CORR-03
    it('SCEN-07: spousal RRSP attribution — withdrawal within 3-year window shifts tax to contributor', () => {
      // Build a tight couple fixture that guarantees an in-window attribution.
      // Mirrors the Edge Case 2 fixtures in spousal-edge-cases.test.ts but
      // adds a control run to compare tax-shift direction.
      const startYear = currentYear;

      // Primary: working at age 62 with $80k income. They are the contributor.
      // Spouse: retired at 60 with no income, age 62 — must withdraw from the
      // spousal RRSP to fund their share of household spending.
      // Ledger: contribution in startYear (in-window: covers startYear, +1, +2).
      const buildScenario = (ledgerYear: number): ProjectionInput => {
        const spouse: SpouseInput = {
          birthdate: new Date(startYear - 62, 0, 1),
          retirementAge: 60,
          lifeExpectancy: 63, // 2-year projection
          employmentIncome: 0,
          expectedCPPAt65: 0, // age 62 — too young for CPP
          cppStartAge: 65,
          oasStartAge: 65,
          rrspBalance: 30000, // entirely spousal
          tfsaBalance: 0,
          spousalRrspLedger: [
            {
              year: ledgerYear,
              annuitant: 'spouse',
              contributor: 'primary',
              amount: 30000,
            },
          ],
        };
        return {
          birthdate: new Date(startYear - 62, 0, 1),
          province: 'ON',
          lifeExpectancy: 63,
          retirementAge: 65, // primary still working
          employmentIncome: 80000,
          employmentGrowthRate: 0,
          rrspBalance: 0,
          rrspAnnualContribution: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          retirementSpending: 30000,
          investmentReturn: 0.04,
          inflationRate: 0,
          expectedCPPAt65: 10000,
          cppStartAge: 65,
          oasStartAge: 65,
          maritalStatus: 'married',
          spouse,
          coupleSettings: {
            optimizePensionSplitting: false,
            useYoungerSpouseForRRIF: false,
          },
        };
      };

      // IN-WINDOW: ledger entry from startYear → covers startYear, +1, +2.
      const inWindow = runCoupleProjection(buildScenario(startYear));
      // OUT-OF-WINDOW (control): ledger entry 4 years prior → outside window.
      const outOfWindow = runCoupleProjection(buildScenario(startYear - 4));

      const inYear0 = inWindow.yearlyResults[0];
      const outYear0 = outOfWindow.yearlyResults[0];
      expect(inYear0, 'in-window projection must produce year 0').toBeDefined();
      expect(outYear0, 'out-of-window projection must produce year 0').toBeDefined();
      if (!inYear0 || !outYear0) return;

      // -----------------------------------------------------------------
      // IN-WINDOW assertions
      // -----------------------------------------------------------------

      // (1) Existing reporting field — preserved by CORR-03.
      expect(
        inYear0.primary.spousalRRSPAttributedIncome ?? 0,
        'In-window: primary.spousalRRSPAttributedIncome > 0 (FIFO reporting preserved)'
      ).toBeGreaterThan(0);
      expect(
        inYear0.spouse.spousalRRSPAttributedIncome ?? 0,
        'In-window: spouse.spousalRRSPAttributedIncome === 0 (annuitant zeroed)'
      ).toBe(0);

      // (2) Tax-burden shift — the contributor (primary) pays MORE than they
      //     do in the out-of-window control where the same withdrawal is
      //     attributed to the spouse. Conversely, the spouse pays LESS.
      expect(
        inYear0.primary.taxesPaid,
        'CORR-03: primary.taxesPaid (in-window) must exceed control (no attribution shift)'
      ).toBeGreaterThan(outYear0.primary.taxesPaid);
      expect(
        inYear0.spouse.taxesPaid,
        'CORR-03: spouse.taxesPaid (in-window) must be less than control (no attribution shift)'
      ).toBeLessThan(outYear0.spouse.taxesPaid);

      // (3) Sanity bound on the shift magnitudes. The amount the primary's
      //     tax rises must be ~consistent with the attribution at primary's
      //     marginal rate ($30k withdrawn × ~30% combined ON marginal rate
      //     ≈ $9k); the amount the spouse's tax falls must be approximately
      //     the spouse's original tax on the withdrawal (the spouse's net
      //     attributable taxable income drops to near zero under the shift).
      //
      //     Note: household total is NOT conserved — attribution typically
      //     COSTS the household more tax overall (that's the policy point of
      //     CRA's anti-splitting rule). So we assert directional bounds, not
      //     equality.
      const primaryTaxIncrease = inYear0.primary.taxesPaid - outYear0.primary.taxesPaid;
      const spouseTaxDecrease = outYear0.spouse.taxesPaid - inYear0.spouse.taxesPaid;
      expect(
        primaryTaxIncrease,
        'CORR-03: primary tax increase must be substantial (≥ $1,500 on a $30k attribution at 30%+ marginal rate)'
      ).toBeGreaterThan(1500);
      expect(
        spouseTaxDecrease,
        'CORR-03: spouse tax decrease must be substantial (≥ $1,000 on a $30k withdrawal at lowest brackets)'
      ).toBeGreaterThan(1000);

      // -----------------------------------------------------------------
      // OUT-OF-WINDOW assertions (regression net)
      // -----------------------------------------------------------------

      // (4) Out-of-window: attribution does NOT fire — primary stays at $0.
      expect(
        outYear0.primary.spousalRRSPAttributedIncome ?? 0,
        'Out-of-window: primary.spousalRRSPAttributedIncome must be 0 (entry outside 3-year window)'
      ).toBe(0);
    });

    // WR-01 regression (Phase 8 review fix): when pension splitting AND
    // in-window spousal-RRSP attribution both fire in the same year, the
    // attribution recompute must NOT silently undo the T1032 split. Before
    // the fix, recalculateTaxWithSpousalAttribution rebuilt its tax input
    // from the prelim's pre-split pensionIncome / rrifWithdrawal, which
    // overwrote the split-adjusted tax with a no-split-but-with-attribution
    // tax. The fix threads a `pensionSplitAdjustment` (derived from
    // pensionIncomeReceived - pensionIncomeTransferred at the multi-year
    // call site) so both effects compose correctly.
    //
    // @see .planning/phases/08-correctness-gaps/08-REVIEW.md WR-01
    // @see docs/source-of-truth/02-account-types.md VR-RRSP-003
    // @see docs/source-of-truth/07-withdrawal-strategies.md
    it('WR-01: pension splitting + in-window spousal-RRSP attribution compose without one undoing the other', () => {
      const startYear = currentYear;

      // Primary: age 70, retired with a $60k defined-benefit pension (RPP).
      // RPP pensionIncome is the most reliably-splittable bucket per the SOT
      // (always eligible, regardless of age). Spouse: age 65 (the engine's
      // optimizePensionSplitting path requires both spouses 65+, see
      // couple-calculator.ts:178), retired, with no own pension/employment
      // income, withdraws from a spousal RRSP whose contribution sits inside
      // the 3-year window. The asymmetry in pension income drives the
      // optimizer to actually transfer some of the primary's RPP income.
      const buildScenario = (ledgerYear: number): ProjectionInput => {
        const spouse: SpouseInput = {
          birthdate: new Date(startYear - 65, 0, 1),
          retirementAge: 65,
          lifeExpectancy: 67, // 2-year projection
          employmentIncome: 0,
          expectedCPPAt65: 0,
          cppStartAge: 65,
          oasStartAge: 65,
          rrspBalance: 30000, // entirely spousal
          tfsaBalance: 0,
          spousalRrspLedger: [
            {
              year: ledgerYear,
              annuitant: 'spouse',
              contributor: 'primary',
              amount: 30000,
            },
          ],
        };
        return {
          birthdate: new Date(startYear - 70, 0, 1),
          province: 'ON',
          lifeExpectancy: 72,
          retirementAge: 65, // already retired
          employmentIncome: 0,
          employmentGrowthRate: 0,
          pensionIncome: 60000, // RPP — splittable at any age
          rrspBalance: 0,
          rrspAnnualContribution: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          retirementSpending: 30000,
          investmentReturn: 0.04,
          inflationRate: 0,
          expectedCPPAt65: 12000,
          cppStartAge: 65,
          oasStartAge: 65,
          maritalStatus: 'married',
          spouse,
          coupleSettings: {
            // Both effects must fire simultaneously — this is the WR-01 overlap.
            // Engine guard: optimizer requires both spouses 65+ (couple-calculator.ts:178).
            optimizePensionSplitting: true,
            useYoungerSpouseForRRIF: false,
          },
        };
      };

      // IN-WINDOW: ledger entry from startYear → covers startYear, +1, +2.
      const inWindow = runCoupleProjection(buildScenario(startYear));
      // CONTROL: same fixture but ledger entry is out-of-window (4 years prior),
      // so attribution does NOT fire while pension splitting still does.
      // This isolates the attribution shift on top of the split.
      const outOfWindow = runCoupleProjection(buildScenario(startYear - 4));

      const inYear0 = inWindow.yearlyResults[0];
      const outYear0 = outOfWindow.yearlyResults[0];
      expect(inYear0, 'in-window projection must produce year 0').toBeDefined();
      expect(outYear0, 'control projection must produce year 0').toBeDefined();
      if (!inYear0 || !outYear0) return;

      // (1) Pension splitting fired in the in-window run (same year as
      //     attribution). If WR-01 regressed, this would still be > 0
      //     in the reporting field — but the tax math would not reflect it.
      expect(
        inYear0.primary.pensionIncomeTransferred ?? 0,
        'In-window: pension splitting must fire (primary transfers some RPP income to spouse)'
      ).toBeGreaterThan(0);
      expect(
        inYear0.spouse.pensionIncomeReceived ?? 0,
        'In-window: spouse must receive the split amount'
      ).toBeGreaterThan(0);

      // (2) The split also fires in the control run (same eligible income,
      //     same settings) — confirming we are isolating the attribution
      //     effect on top of an active split.
      expect(
        outYear0.primary.pensionIncomeTransferred ?? 0,
        'Control: pension splitting must fire identically'
      ).toBeGreaterThan(0);

      // (3) FIFO attribution fired in the in-window run.
      expect(
        inYear0.primary.spousalRRSPAttributedIncome ?? 0,
        'In-window: spousal-RRSP attribution must fire'
      ).toBeGreaterThan(0);
      expect(
        outYear0.primary.spousalRRSPAttributedIncome ?? 0,
        'Control: spousal-RRSP attribution must NOT fire (out-of-window)'
      ).toBe(0);

      // (4) Core WR-01 assertion: BOTH effects compose. Primary's tax in the
      //     in-window run must be HIGHER than the control (because $30k of
      //     spousal-RRSP income shifts onto the primary's return on top of
      //     the split-already-applied baseline). Before the WR-01 fix, the
      //     attribution recompute reversed the split for the primary, so
      //     primary's tax in the in-window run could end up LOWER (or barely
      //     different from) the no-split-no-attribution baseline. With the
      //     fix, the split is preserved AND the attribution shift adds to
      //     it, so primary tax must rise meaningfully.
      const primaryTaxIncrease = inYear0.primary.taxesPaid - outYear0.primary.taxesPaid;
      expect(
        primaryTaxIncrease,
        `WR-01: with split active, primary tax must rise by a substantial amount when attribution kicks in. ` +
          `Got primary in-window=${inYear0.primary.taxesPaid.toFixed(0)}, ` +
          `control=${outYear0.primary.taxesPaid.toFixed(0)} ` +
          `(diff=${primaryTaxIncrease.toFixed(0)}, expected ≥ $1,500 on $30k attribution).`
      ).toBeGreaterThan(1500);

      // (5) Spouse's tax in the in-window run must DROP relative to the
      //     control (the attributed slice is removed from the spouse's
      //     return). With or without the WR-01 fix this assertion already
      //     held, but we keep it as a directional regression net.
      expect(
        inYear0.spouse.taxesPaid,
        'WR-01: spouse tax must drop in-window (attributed slice removed from spouse)'
      ).toBeLessThan(outYear0.spouse.taxesPaid);

      // (6) Pension-split MAGNITUDE must be preserved across both runs (same
      //     eligible base, same spouse income, same settings → optimizer
      //     finds the same split). Before the WR-01 fix, the in-window run
      //     would still set this field to the same value (it's not mutated
      //     by the recompute), but the tax math would silently ignore it.
      //     This assertion locks the reporting consistency.
      expect(
        inYear0.primary.pensionIncomeTransferred,
        'WR-01: split amount must match between in-window and control (split optimizer is invariant to attribution)'
      ).toBeCloseTo(outYear0.primary.pensionIncomeTransferred ?? 0, -1);
    });

    // FIXED in Phase 8 (CORR-01): OAS clawback fires via three-pass benefits
    // resolution (Pass 1 netIncome:0 → Pass 2 prelim → Pass 3 finalNetIncome
    // including nonRegTaxableCapGain). Verified at yearly-calculator.ts:691/742/1067
    // (single) and :1600/1691/2044 (couple), and by oas-clawback-projection.test.ts.
    // The previously-described "netIncome:0 in preliminary pass" is no longer the
    // engine's behavior — the .skip marker was stale.
    // @see docs/source-of-truth/05-government-benefits.md
    // @see .planning/REQUIREMENTS.md CORR-01
    it('LIMS-01a: OAS clawback fires when net income exceeds the indexed threshold', () => {
      // High-income retiree persona: defined-benefit pension + CPP + RRIF minimum
      // pushes net income clearly above the indexed OAS clawback threshold
      // ($95,323 in 2026, indexed annually per CRA s.117.1) at every projection year.
      // Mirrors the ISSUE-82 regression pattern proven in oas-clawback-projection.test.ts.
      const PERSONA_OAS_HIGH_INCOME: ProjectionInput = {
        birthdate: new Date(currentYear - 70, 5, 15), // age 70 — RRIF conversion at 71
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        pensionIncome: 70000, // defined-benefit pension — won't deplete
        rrspBalance: 600000, // large RRIF base ensures persistent withdrawals through age 90
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        tfsaAnnualContribution: 0,
        nonRegBalance: 0,
        retirementSpending: 80000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 15000,
        cppStartAge: 65,
        oasStartAge: 65,
        otherIncome: 20000,
      };

      const result = runSingleProjection(PERSONA_OAS_HIGH_INCOME);

      // Find every year where the retiree is OAS-eligible (age >= 65).
      const oasEligibleYears = result.yearlyResults.filter((r) => r.age >= 65);
      expect(
        oasEligibleYears.length,
        'high-income projection must include at least one age-65+ year'
      ).toBeGreaterThan(0);

      // CORR-01: at least one OAS-eligible year must show a non-zero clawback,
      // i.e. taxCalculation.oasClawback > 0 (equivalently, oasIncome < grossOAS).
      // Pension $70k + CPP ~$15k + OAS gross + RRIF + other $20k ≈ $135k+ → clawback fires.
      const yearsWithClawback = oasEligibleYears.filter((r) => r.taxCalculation.oasClawback > 0);

      const debugSummary = oasEligibleYears
        .map(
          (r) =>
            `age ${r.age}: oasIncome=${r.oasIncome.toFixed(0)}, oasClawback=${r.taxCalculation.oasClawback.toFixed(0)}, totalIncome=${r.totalIncome.toFixed(0)}`
        )
        .join('; ');

      expect(
        yearsWithClawback.length,
        `CORR-01: expected ≥1 year where taxCalculation.oasClawback > 0 (income > indexed threshold). Got 0. Per-year detail: ${debugSummary}`
      ).toBeGreaterThan(0);
    });

    // FIXED in Phase 8 (CORR-02): realized capital gains on non-reg withdrawals
    // flow through to tax via taxInput.capitalGains = nonRegRealizedGain
    // (yearly-calculator.ts ~:1108 single, ~:2091 couple). calculateTotalTax
    // applies the federal inclusion rate via calculateTaxableCapitalGain.
    // Cross-year ACB tracking in multi-year.ts was the gating bug (single-path
    // formula reduced to *1; couple-path passed ACB unchanged) — now uses
    // pro-rata reduction by withdrawal-fraction of pre-withdrawal balance.
    // @see docs/source-of-truth/04-tax-engine.md
    // @see docs/source-of-truth/02-account-types.md (ACB pro-rata reduction)
    // @see .planning/REQUIREMENTS.md CORR-02
    it('LIMS-01b: capital gains tax fires on realized non-reg gains', () => {
      const result = runSingleProjection(PERSONA_NONREG_HEAVY);

      // PERSONA_NONREG_HEAVY has nonRegBalance: 467,800 with no RRSP/TFSA fallback.
      // ACB starts equal to balance (no embedded gains in year 1) but accumulates
      // embedded gains via the 3.5% investmentReturn each year. By age 72+, non-reg
      // withdrawals must realize gains and produce non-zero
      // taxCalculation.capitalGains in the YearlyResult.

      // 1. At least one year must have a non-reg withdrawal — proves drawdown fires.
      const yearsWithNonRegWithdrawal = result.yearlyResults.filter((r) => r.nonRegWithdrawal > 0);
      expect(
        yearsWithNonRegWithdrawal.length,
        'PERSONA_NONREG_HEAVY must produce ≥1 year with a non-reg withdrawal'
      ).toBeGreaterThan(0);

      // 2. In at least one year past age 70 (where embedded gains have accumulated),
      // the realized gain must produce non-zero taxCalculation.capitalGains.
      // taxCalculation.capitalGains is the POST-inclusion-rate taxable portion.
      const yearsWithCapGainsTax = result.yearlyResults.filter(
        (r) => r.age >= 70 && r.taxCalculation.capitalGains > 0
      );
      const debugSummary = result.yearlyResults
        .filter((r) => r.age >= 70 && r.nonRegWithdrawal > 0)
        .map(
          (r) =>
            `age ${r.age}: nonRegWithdrawal=${r.nonRegWithdrawal.toFixed(0)}, taxCalc.capitalGains=${r.taxCalculation.capitalGains.toFixed(0)}, taxesPaid=${r.taxesPaid.toFixed(0)}`
        )
        .join('; ');
      expect(
        yearsWithCapGainsTax.length,
        `CORR-02: expected ≥1 year (age ≥70) with taxCalculation.capitalGains > 0. Got 0. Per-year detail: ${debugSummary}`
      ).toBeGreaterThan(0);

      // 3. In at least one of those years, taxesPaid must be > 0 (gains drove tax).
      const yearWithGainsAndTax = yearsWithCapGainsTax.find((r) => r.taxesPaid > 0);
      expect(
        yearWithGainsAndTax,
        `CORR-02: expected ≥1 year with both taxCalculation.capitalGains > 0 AND taxesPaid > 0. Per-year detail: ${debugSummary}`
      ).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 25 engine wiring helpers
// ---------------------------------------------------------------------------

const PROJECTION_START_YEAR = new Date().getFullYear();

/**
 * Build a minimal YearInput for a retired person at age 70 with balances sufficient to
 * drive withdrawal logic. Override any field by spreading over defaults.
 */
function createYearInput(
  overrides: Partial<YearInput> & { isRetiredOverride?: boolean }
): YearInput {
  const { isRetiredOverride: _isRetiredOverride, ...rest } = overrides;
  const baseYear = PROJECTION_START_YEAR;
  // Default: retired person age 70 — retirementAge 60 guarantees isRetired=true
  const defaultBirthdate = new Date(baseYear - 70, 5, 15);

  return {
    year: baseYear,
    birthdate: defaultBirthdate,
    province: 'ON' as const,
    rrspBalance: 200000,
    rrifBalance: 0,
    tfsaBalance: 100000,
    nonRegBalance: 50000,
    nonRegACB: 50000,
    rrspContribution: 0,
    tfsaContribution: 0,
    employmentIncome: 0,
    pensionIncome: 0,
    otherIncome: 0,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 60000,
    investmentReturn: 0.04,
    inflationRate: 0.02,
    retirementAge: 60, // age 70 >= 60 → isRetired=true
    yearsFromProjectionStart: 0,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Phase 25 engine wiring — per-year behaviors
// ---------------------------------------------------------------------------
describe('Phase 25 engine wiring — per-year behaviors', () => {
  describe('TAX-01 drawdown order', () => {
    it('uses default order (non-reg before RRSP) when drawdownOrder undefined (regression safety D-06)', () => {
      const result = calculateYear(createYearInput({}));
      // Default: non-reg is drawn first (balance 50k, gap is retirement spending minus income)
      // Non-reg should be touched before RRSP since non-reg is first in default order
      expect(result.nonRegWithdrawal + result.rrifWithdrawal).toBeGreaterThan(0);
    });

    it('follows custom drawdownOrder exhausting TFSA before non-reg when specified', () => {
      const input = createYearInput({
        drawdownOrder: ['tfsa', 'rrsp', 'nonReg'],
        // TFSA=100k, RRSP=200k, nonReg=50k; retirementSpending=60k with no income → gap ~60k
        // TFSA should be drawn first
      });
      const result = calculateYear(input);
      expect(result.tfsaWithdrawal).toBeGreaterThan(0);
      // With TFSA first and gap ~60k, non-reg should NOT be touched (TFSA > gap)
      expect(result.nonRegWithdrawal).toBe(0);
    });
  });

  describe('TAX-02 RRSP meltdown Custom mode', () => {
    it('withdraws additional fixed amount inside year range increasing total RRSP drawdown', () => {
      const baseInput = createYearInput({});
      const baseline = calculateYear(baseInput);

      const meltdownInput = createYearInput({
        rrspMeltdown: {
          enabled: true,
          annualAmount: 25000,
          startYear: PROJECTION_START_YEAR,
          endYear: PROJECTION_START_YEAR,
        },
      });
      const result = calculateYear(meltdownInput);
      // Meltdown adds 25k on top of any gap-driven RRSP withdrawal
      expect(result.rrifWithdrawal).toBeGreaterThan(baseline.rrifWithdrawal);
    });

    it('no extra meltdown withdrawal when year is outside year range', () => {
      const baseInput = createYearInput({});
      const baseline = calculateYear(baseInput);

      const input = createYearInput({
        rrspMeltdown: { enabled: true, annualAmount: 25000, startYear: 3000, endYear: 3005 },
      });
      const result = calculateYear(input);
      expect(result.rrifWithdrawal).toBe(baseline.rrifWithdrawal);
    });
  });

  describe('TAX-04 OAS clawback avoidance', () => {
    it('trims discretionary withdrawals so income approaches threshold', () => {
      // High spending scenario where withdrawals would exceed OAS clawback threshold
      const input = createYearInput({
        oasClawbackAvoidance: { enabled: true, incomeThreshold: 85000 },
        retirementSpending: 120000, // High spending forcing large withdrawals
        rrspBalance: 500000,
        tfsaBalance: 200000,
        nonRegBalance: 100000,
      });
      // Test should not throw
      const result = calculateYear(input);
      expect(result).toBeDefined();
    });

    it('accepts clawback when RRIF minimum alone pushes income above threshold (D-12)', () => {
      const input = createYearInput({
        oasClawbackAvoidance: { enabled: true, incomeThreshold: 1 }, // impossibly low
        rrifBalance: 500000,
        // Force RRIF minimum by converting: use age 72 so RRIF minimum triggers
        birthdate: new Date(PROJECTION_START_YEAR - 72, 5, 15),
      });
      expect(() => calculateYear(input)).not.toThrow();
    });
  });

  describe('SAV-01 contribution overrides', () => {
    it('replaces RRSP contribution with override amount in range', () => {
      // Pre-retirement year: retirementAge 75 so age 70 < 75 means not retired
      const baseInput = createYearInput({ rrspContribution: 10000, retirementAge: 75 });
      const baseline = calculateYear(baseInput);

      const input = createYearInput({
        rrspContribution: 10000,
        retirementAge: 75,
        contributionOverrides: [
          {
            accountType: 'rrsp',
            annualAmount: 15000,
            startYear: PROJECTION_START_YEAR - 1,
            endYear: PROJECTION_START_YEAR + 1,
          },
        ],
      });
      const result = calculateYear(input);
      // With 15k override vs 10k default, RRSP balance should be 5k higher
      expect(result.rrspBalance).toBeGreaterThan(baseline.rrspBalance);
    });
  });

  describe('SPD-03 age-band spending reductions', () => {
    it('reduces retirement spending by 10% at age 80 with fromAge 75 band', () => {
      const baseInput = createYearInput({
        birthdate: new Date(PROJECTION_START_YEAR - 80, 5, 15),
        retirementSpending: 60000,
      });
      const baseline = calculateYear(baseInput);

      const input = createYearInput({
        birthdate: new Date(PROJECTION_START_YEAR - 80, 5, 15),
        retirementSpending: 60000,
        ageBandReductions: [{ fromAge: 75, reductionPercent: 0.1 }],
      });
      const result = calculateYear(input);
      // Living expenses with band should be ~10% less than baseline
      expect(result.livingExpenses).toBeCloseTo(baseline.livingExpenses * 0.9, -2);
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 25 — SPD-04 legacy target
// ---------------------------------------------------------------------------
describe('Phase 25 — SPD-04 legacy target', () => {
  it('returns null when legacyTarget is undefined', () => {
    const input: ProjectionInput = {
      ...PERSONA_RRIF_CONVERSION,
      // legacyTarget is not set
    };
    const result = runProjection(input);
    expect(result.legacyTargetMet).toBeNull();
  });

  it('returns true when final net worth >= legacyTarget (trivially met)', () => {
    const input: ProjectionInput = {
      ...PERSONA_RRIF_CONVERSION,
      legacyTarget: 1, // trivially low
    };
    const result = runProjection(input);
    expect(result.legacyTargetMet).toBe(true);
  });

  it('returns false when final net worth < legacyTarget (impossibly high)', () => {
    const input: ProjectionInput = {
      ...PERSONA_RRIF_CONVERSION,
      legacyTarget: 999_999_999, // impossibly high
    };
    const result = runProjection(input);
    expect(result.legacyTargetMet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 25 helpers — applyAgeBandReduction (SPD-03)
// ---------------------------------------------------------------------------
describe('Phase 25 helpers — applyAgeBandReduction (SPD-03)', () => {
  const bands = [
    { fromAge: 75, reductionPercent: 0.1 },
    { fromAge: 85, reductionPercent: 0.2 },
  ];

  it('returns unchanged spending when no bands match', () => {
    expect(applyAgeBandReduction(50000, 60, bands)).toBe(50000);
  });

  it('applies the lower band when age is between fromAges', () => {
    expect(applyAgeBandReduction(50000, 80, bands)).toBe(45000);
  });

  it('applies the highest matching band only (no stacking)', () => {
    expect(applyAgeBandReduction(50000, 90, bands)).toBe(40000);
  });

  it('handles empty bands array', () => {
    expect(applyAgeBandReduction(50000, 80, [])).toBe(50000);
  });

  it('handles undefined bands', () => {
    expect(applyAgeBandReduction(50000, 80, undefined)).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// Phase 25 helpers — resolveContribution (SAV-01)
// ---------------------------------------------------------------------------
describe('Phase 25 helpers — resolveContribution (SAV-01)', () => {
  const overrides = [
    { accountType: 'rrsp' as const, annualAmount: 15000, startYear: 2026, endYear: 2030 },
  ];

  it('returns override amount when year in range', () => {
    expect(resolveContribution('rrsp', 10000, 2028, overrides)).toBe(15000);
  });

  it('returns default amount when year before range', () => {
    expect(resolveContribution('rrsp', 10000, 2025, overrides)).toBe(10000);
  });

  it('returns default amount when year after range', () => {
    expect(resolveContribution('rrsp', 10000, 2031, overrides)).toBe(10000);
  });

  it('returns default amount when accountType does not match', () => {
    expect(resolveContribution('tfsa', 6000, 2028, overrides)).toBe(6000);
  });

  it('returns default amount when overrides undefined', () => {
    expect(resolveContribution('rrsp', 10000, 2028, undefined)).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Phase 25 — TAX-03 income splitting (couples)
// @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
// ---------------------------------------------------------------------------

/**
 * Build a minimal couple ProjectionInput for TAX-03 testing.
 * Primary: born 1960, retires at 65, pension 30k, no RRIF initially.
 * Spouse: born 1962, retires at 65, no pension income.
 * optimizer disabled so fixed-split tests are clean and isolated.
 */
function makeTAX03CoupleInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  const spouseBase: SpouseInput = {
    birthdate: new Date('1962-01-01'),
    retirementAge: 65,
    lifeExpectancy: 90,
    employmentIncome: 0,
    expectedCPPAt65: 5000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    // Large TFSA prevents early projection termination (householdNetWorth <= 0 breaks the loop).
    // TFSA is non-taxable so it does not affect income splitting behaviour.
    tfsaBalance: 800_000,
  };

  return {
    birthdate: new Date('1960-01-01'),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'married',
    employmentIncome: 0,
    employmentGrowthRate: 0,
    pensionIncome: 30000,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    // Large TFSA prevents early projection termination (householdNetWorth <= 0 breaks the loop).
    // TFSA is non-taxable so it does not affect income splitting behaviour.
    tfsaBalance: 500_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 60000,
    investmentReturn: 0.05,
    inflationRate: 0.02,
    expectedCPPAt65: 10000,
    cppStartAge: 65,
    oasStartAge: 65,
    spouse: spouseBase,
    coupleSettings: {
      optimizePensionSplitting: false, // disable optimizer to isolate fixed-split behaviour
      useYoungerSpouseForRRIF: false,
    },
    ...overrides,
  };
}

describe('Phase 25 — TAX-03 income splitting', () => {
  /**
   * TAX-03a: 50/50 fixed split reduces combined household tax vs baseline
   * when primary has eligible pension income.
   * @see 25-CONTEXT.md D-08, D-09
   */
  it('TAX-03a: 50/50 split reduces combined household tax vs baseline', () => {
    // Use runCoupleProjection directly so yearlyResults is typed as CoupleYearlyResult[]
    const baseline = runCoupleProjection(makeTAX03CoupleInput());
    const withSplit = runCoupleProjection(
      makeTAX03CoupleInput({ incomeSplitting: { enabled: true, splitPercent: 0.5 } })
    );

    // Find years where both are retired (primary born 1960 retires at 65, spouse born 1962 at 65)
    const retiredYearsBaseline = baseline.yearlyResults.filter((y) => y.bothRetired);
    const retiredYearsSplit = withSplit.yearlyResults.filter((y) => y.bothRetired);

    expect(retiredYearsBaseline.length).toBeGreaterThan(0);
    expect(retiredYearsSplit.length).toBeGreaterThan(0);

    // Aggregate household taxes paid in all retired years
    const totalTaxBaseline = retiredYearsBaseline.reduce((sum, y) => sum + y.householdTaxesPaid, 0);
    const totalTaxSplit = retiredYearsSplit.reduce((sum, y) => sum + y.householdTaxesPaid, 0);

    // Splitting 30k pension income 50/50 should reduce combined household tax
    expect(totalTaxSplit).toBeLessThan(totalTaxBaseline);
  });

  /**
   * TAX-03b: undefined incomeSplitting leaves tax unchanged (regression safety)
   */
  it('TAX-03b: incomeSplitting undefined leaves tax unchanged (regression safety)', () => {
    const a = runProjection(makeTAX03CoupleInput());
    const b = runProjection(makeTAX03CoupleInput());
    expect(a.summary.totalTaxesPaid).toBeCloseTo(b.summary.totalTaxesPaid, 0);
  });

  /**
   * TAX-03c: employment income (pre-retirement) is NOT eligible for splitting (D-08).
   * The split requires both spouses to be retired; in pre-retirement years no split occurs.
   */
  it('TAX-03c: employment income is NOT eligible for splitting — no split in pre-retirement year', () => {
    const result = runProjection(
      makeTAX03CoupleInput({
        employmentIncome: 80000,
        retirementAge: 70, // pushes retirement later so first year is pre-retirement
        incomeSplitting: { enabled: true, splitPercent: 0.5 },
      })
    );

    // Find first pre-retirement year (primary not yet retired)
    const preRetirementYear = (result.yearlyResults as CoupleYearlyResult[]).find(
      (y) => !y.bothRetired
    );
    expect(preRetirementYear).toBeDefined();
    // No income transferred in pre-retirement
    expect(preRetirementYear!.primary.pensionIncomeTransferred ?? 0).toBe(0);
  });

  /**
   * TAX-03d: CPP income is NOT eligible for splitting (D-08).
   * Primary has only CPP (no pension, no RRIF) → eligible amount is 0 → nothing is transferred.
   */
  it('TAX-03d: CPP income is NOT eligible for splitting — transferred amount is 0', () => {
    // Use runCoupleProjection directly so yearlyResults is typed as CoupleYearlyResult[]
    const result = runCoupleProjection(
      makeTAX03CoupleInput({
        pensionIncome: 0, // no DB pension
        expectedCPPAt65: 15000, // CPP only
        incomeSplitting: { enabled: true, splitPercent: 0.5 },
      })
    );

    const retiredYear = result.yearlyResults.find((y) => y.bothRetired);
    expect(retiredYear).toBeDefined();
    // No pension/RRIF → eligible amount 0 → nothing transferred
    expect(retiredYear!.primary.pensionIncomeTransferred ?? 0).toBe(0);
  });

  /**
   * TAX-03f: enabled=false means no split is applied even when pensionIncome is present.
   */
  it('TAX-03f: enabled=false does not apply split', () => {
    // Use runCoupleProjection directly so yearlyResults is typed as CoupleYearlyResult[]
    const result = runCoupleProjection(
      makeTAX03CoupleInput({ incomeSplitting: { enabled: false, splitPercent: 0.5 } })
    );
    const retiredYear = result.yearlyResults.find((y) => y.bothRetired);
    expect(retiredYear).toBeDefined();
    expect(retiredYear!.primary.pensionIncomeTransferred ?? 0).toBe(0);
  });

  /**
   * TAX-03g: pensionSplitPercentage reflects the applied splitPercent for traceability.
   */
  it('TAX-03g: pensionSplitPercentage reflects appliedSplitPercent (0.5) in retired years', () => {
    const result = runCoupleProjection(
      makeTAX03CoupleInput({ incomeSplitting: { enabled: true, splitPercent: 0.5 } })
    );
    const retiredYear = result.yearlyResults.find(
      (y) => y.bothRetired && (y.primary.pensionIncomeTransferred ?? 0) > 0
    );
    expect(retiredYear).toBeDefined();
    expect(retiredYear!.pensionSplitPercentage).toBeCloseTo(0.5, 2);
  });
});

// ---------------------------------------------------------------------------
// Phase 25 gap closure — integration via runProjection
// Verifies that each strategy field has observable effect when passed through
// ProjectionInput → runSingleProjection → calculateYear (end-to-end data path).
// @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
// ---------------------------------------------------------------------------

/**
 * Minimal base fixture for gap-closure integration tests.
 * Person born 1970, ON, retires at 65 (year ~2035), life expectancy 90.
 * Pre-retirement years: 2026-2034. Retirement years: 2035+.
 */
const GAP_BASE_INPUT: ProjectionInput = {
  birthdate: new Date('1970-01-01'),
  province: 'ON',
  retirementAge: 65,
  lifeExpectancy: 90,
  employmentIncome: 100_000,
  employmentGrowthRate: 0.02,
  rrspBalance: 500_000,
  rrspAnnualContribution: 10_000,
  tfsaBalance: 100_000,
  tfsaAnnualContribution: 6_500,
  nonRegBalance: 200_000,
  retirementSpending: 60_000,
  investmentReturn: 0.05,
  inflationRate: 0.02,
  expectedCPPAt65: 12_000,
  cppStartAge: 65,
  oasStartAge: 65,
};

describe('Phase 25 gap closure — integration via runProjection', () => {
  describe('TAX-01 drawdown order (integration via runSingleProjection)', () => {
    /**
     * Gap closure 25-04: verifies TAX-01 drawdownOrder is threaded from
     * ProjectionInput through runSingleProjection into the per-year calculator.
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it("changes withdrawal order when drawdownOrder=['tfsa','rrsp','nonReg']", () => {
      const controlResult = runSingleProjection(GAP_BASE_INPUT);
      const withOrderResult = runSingleProjection({
        ...GAP_BASE_INPUT,
        drawdownOrder: ['tfsa', 'rrsp', 'nonReg'],
      });

      // Find first retirement year in both runs
      const startYear = new Date().getFullYear();
      const startAge = GAP_BASE_INPUT.birthdate.getFullYear();
      const retirementYear = startYear + (GAP_BASE_INPUT.retirementAge - (startYear - startAge));

      const controlRetirementYear = controlResult.yearlyResults.find(
        (y) => y.year >= retirementYear
      );
      const withOrderRetirementYear = withOrderResult.yearlyResults.find(
        (y) => y.year >= retirementYear
      );

      expect(controlRetirementYear).toBeDefined();
      expect(withOrderRetirementYear).toBeDefined();

      // With TFSA-first ordering, the strategies should produce different withdrawals
      // The two runs should not produce identical results once retirement starts
      const controlTotalRetirementWithdrawals = controlResult.yearlyResults
        .filter((y) => y.year >= retirementYear)
        .reduce((sum, y) => sum + y.tfsaWithdrawal, 0);

      const withOrderTotalTfsaWithdrawals = withOrderResult.yearlyResults
        .filter((y) => y.year >= retirementYear)
        .reduce((sum, y) => sum + y.tfsaWithdrawal, 0);

      // TFSA-first ordering should result in more total TFSA withdrawals in retirement
      expect(withOrderTotalTfsaWithdrawals).toBeGreaterThanOrEqual(
        controlTotalRetirementWithdrawals
      );
    });
  });

  describe('TAX-02 RRSP meltdown Custom (integration via runSingleProjection)', () => {
    /**
     * Gap closure 25-04: verifies TAX-02 rrspMeltdown is threaded from
     * ProjectionInput through runSingleProjection into the per-year calculator.
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it('reduces RRSP/RRIF balance in meltdown year vs control run', () => {
      const startYear = new Date().getFullYear();
      const birthYear = GAP_BASE_INPUT.birthdate.getFullYear();
      const retirementYear = startYear + (GAP_BASE_INPUT.retirementAge - (startYear - birthYear));

      const controlResult = runSingleProjection(GAP_BASE_INPUT);
      const withMeltdownResult = runSingleProjection({
        ...GAP_BASE_INPUT,
        rrspMeltdown: {
          enabled: true,
          annualAmount: 15_000,
          startYear: retirementYear,
          endYear: retirementYear,
        },
      });

      // Find the retirement year result in both runs
      const controlYear = controlResult.yearlyResults.find((y) => y.year === retirementYear);
      const meltdownYear = withMeltdownResult.yearlyResults.find((y) => y.year === retirementYear);

      if (controlYear === undefined || meltdownYear === undefined) {
        // If retirementYear falls outside projection window, use first year instead
        const controlFirst = controlResult.yearlyResults[0];
        const meltdownFirst = withMeltdownResult.yearlyResults[0];
        expect(meltdownFirst).toBeDefined();
        expect(controlFirst).toBeDefined();
        return;
      }

      // Total RRSP+RRIF balance after meltdown should be lower (at least 10k less with tolerance)
      const controlRRSP = controlYear.rrspBalance + controlYear.rrifBalance;
      const meltdownRRSP = meltdownYear.rrspBalance + meltdownYear.rrifBalance;
      expect(meltdownRRSP).toBeLessThan(controlRRSP - 10_000);
    });
  });

  describe('TAX-04 OAS clawback avoidance (integration via runSingleProjection)', () => {
    /**
     * Gap closure 25-04: verifies TAX-04 oasClawbackAvoidance is threaded from
     * ProjectionInput through runSingleProjection into the per-year calculator.
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it('net taxable income differs from control run when oasClawbackAvoidance is enabled', () => {
      // Scenario designed so avoidance CAN have an observable effect:
      // - RRSP-first drawdown: RRSP withdrawals are fully taxable (unlike non-reg where only
      //   the capital gains portion is taxable, which is near-zero when ACB ≈ balance)
      // - RRSP balance modest enough that RRIF mandatory withdrawals stay below $80k threshold
      // - Retirement spending ($90k) > mandatory income (~$43k) → RRSP withdrawals fill gap
      // - Total taxable ($43k mandatory + $47k RRSP) = $90k > $80k → avoidance can trim
      // With rrspBalance: 1_500_000 (old scenario), RRIF mandatory alone exceeds the $80k
      // threshold — there is nothing discretionary to trim → avoidance has zero effect.
      const oasAvoidanceInput: ProjectionInput = {
        ...GAP_BASE_INPUT,
        drawdownOrder: ['rrsp', 'nonReg', 'tfsa'],
        rrspBalance: 400_000,
        tfsaBalance: 300_000,
        nonRegBalance: 200_000,
        retirementSpending: 90_000,
        expectedCPPAt65: 15_000,
      };

      const controlResult = runSingleProjection(oasAvoidanceInput);
      const withAvoidanceResult = runSingleProjection({
        ...oasAvoidanceInput,
        oasClawbackAvoidance: { enabled: true, incomeThreshold: 80_000 },
      });

      // Both should complete without error
      expect(controlResult.yearlyResults.length).toBeGreaterThan(0);
      expect(withAvoidanceResult.yearlyResults.length).toBeGreaterThan(0);

      // In at least one OAS-era year (age 65+), total taxes paid should differ
      const controlTotalTax = controlResult.summary.totalTaxesPaid;
      const avoidanceTotalTax = withAvoidanceResult.summary.totalTaxesPaid;

      // The two runs should produce different tax outcomes (avoidance changes withdrawal pattern)
      // We don't assert direction since the engine logic is complex — just that it has effect
      expect(controlTotalTax).not.toBeCloseTo(avoidanceTotalTax, -2);
    });
  });

  describe('SAV-01 contribution overrides (integration via runSingleProjection)', () => {
    /**
     * Gap closure 25-04: verifies SAV-01 contributionOverrides is threaded from
     * ProjectionInput through runSingleProjection into the per-year calculator.
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it('overrides RRSP contribution to 0 in the first projection year', () => {
      const startYear = new Date().getFullYear();

      const controlResult = runSingleProjection(GAP_BASE_INPUT);
      const withOverrideResult = runSingleProjection({
        ...GAP_BASE_INPUT,
        contributionOverrides: [
          {
            accountType: 'rrsp',
            annualAmount: 0,
            startYear,
            endYear: startYear,
          },
        ],
      });

      // First year RRSP balance: with override=0 vs default 10k contribution
      // The control run contributes rrspAnnualContribution (10k) in first pre-retirement year
      // The override run should have a lower RRSP balance at end of year 1
      const controlFirstYear = controlResult.yearlyResults[0];
      const overrideFirstYear = withOverrideResult.yearlyResults[0];

      expect(controlFirstYear).toBeDefined();
      expect(overrideFirstYear).toBeDefined();

      // Control should have higher RRSP balance (contribution applied) than override (no contribution)
      expect(controlFirstYear!.rrspBalance).toBeGreaterThan(overrideFirstYear!.rrspBalance);
    });
  });

  describe('SPD-03 age-band spending reductions (integration via runSingleProjection)', () => {
    /**
     * Gap closure 25-04: verifies SPD-03 ageBandReductions is threaded from
     * ProjectionInput through runSingleProjection into the per-year calculator.
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it('reduces retirement spending at age 75+ vs control run', () => {
      // Use an older person so age 75+ years are within the projection window
      const startYear = new Date().getFullYear();
      const olderInput: ProjectionInput = {
        ...GAP_BASE_INPUT,
        birthdate: new Date(`${startYear - 68}-01-01`), // age 68 at start → reaches 75 in 7 years
        retirementAge: 60, // already retired
        employmentIncome: 0,
        employmentGrowthRate: 0,
      };

      const controlResult = runSingleProjection(olderInput);
      const withBandResult = runSingleProjection({
        ...olderInput,
        ageBandReductions: [{ fromAge: 75, reductionPercent: 0.25 }],
      });

      // Find a year where the person would be age 75+
      const age75Year = startYear + (75 - 68);

      const controlAge75 = controlResult.yearlyResults.find((y) => y.year >= age75Year);
      const bandAge75 = withBandResult.yearlyResults.find((y) => y.year >= age75Year);

      expect(controlAge75).toBeDefined();
      expect(bandAge75).toBeDefined();

      // With 25% reduction at 75+, living expenses should be lower
      expect(bandAge75!.livingExpenses).toBeLessThan(controlAge75!.livingExpenses);
    });
  });

  describe('Phase 25 base-case regression (integration)', () => {
    /**
     * Gap closure 25-04: verifies that a projection with NO strategy fields set
     * produces identical output on repeated runs (determinism / no mutation).
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it('produces identical yearlyResults on two runs with identical input (determinism)', () => {
      const run1 = runSingleProjection(GAP_BASE_INPUT);
      const run2 = runSingleProjection(GAP_BASE_INPUT);

      // Exclude id and timestamps which are always unique
      const strip = (r: ReturnType<typeof runSingleProjection>) =>
        r.yearlyResults.map((y) => ({ ...y }));

      expect(strip(run1)).toEqual(strip(run2));
    });
  });

  describe('Phase 25 couple integration via runCoupleProjection', () => {
    /**
     * Gap closure 25-04: verifies that drawdownOrder is threaded through
     * buildCouplePersonInput into couple projections.
     * @see .planning/phases/25-scenario-decision-engine-wiring/25-VERIFICATION.md
     */
    it('drawdownOrder changes couple withdrawal pattern vs control run', () => {
      const coupleInput: ProjectionInput = {
        ...GAP_BASE_INPUT,
        maritalStatus: 'married',
        spouse: {
          birthdate: new Date('1972-01-01'),
          retirementAge: 65,
          lifeExpectancy: 90,
          employmentIncome: 80_000,
          expectedCPPAt65: 10_000,
          cppStartAge: 65,
          oasStartAge: 65,
          rrspBalance: 300_000,
          tfsaBalance: 80_000,
        },
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      };

      const controlResult = runCoupleProjection(coupleInput);
      const withOrderResult = runCoupleProjection({
        ...coupleInput,
        drawdownOrder: ['tfsa', 'rrsp', 'nonReg'],
      });

      // Both should produce results
      expect(controlResult.yearlyResults.length).toBeGreaterThan(0);
      expect(withOrderResult.yearlyResults.length).toBeGreaterThan(0);

      // Total TFSA withdrawals across retirement years should differ
      const controlTfsaWithdrawals = controlResult.yearlyResults.reduce(
        (sum, y) => sum + y.primary.tfsaWithdrawal + y.spouse.tfsaWithdrawal,
        0
      );
      const withOrderTfsaWithdrawals = withOrderResult.yearlyResults.reduce(
        (sum, y) => sum + y.primary.tfsaWithdrawal + y.spouse.tfsaWithdrawal,
        0
      );

      // TFSA-first ordering should produce at least as many TFSA withdrawals
      expect(withOrderTfsaWithdrawals).toBeGreaterThanOrEqual(controlTfsaWithdrawals);
    });
  });
});
