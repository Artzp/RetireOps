/**
 * Canadian Retirement Edge-Case Tests
 * @see docs/source-of-truth/05-government-benefits.md - GIS Section
 * @see docs/source-of-truth/05-government-benefits.md - CPP/OAS Late Deferral
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Capital Gains
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 *
 * Covers scenarios 5-9 from the Canadian retirement edge-case audit.
 */
import { describe, it, expect } from 'vitest';
import { calculatePersonYear, type PersonYearInput } from './yearly-calculator.js';
import { calculateCPPAdjustmentFactor } from '../benefits/cpp.js';
import { calculateOASDeferralFactor } from '../benefits/oas.js';
import {
  processTFSAWithdrawal,
  calculateTFSAContributionRoom,
  getTFSAAnnualLimit,
} from '../accounts/tfsa.js';
import { processNonRegisteredWithdrawal } from '../accounts/non-registered.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a PersonYearInput with safe defaults for edge-case testing.
 * Ages are set by adjusting birthdate relative to the year under test.
 */
function makeInput(
  ageInYear: number,
  year: number,
  overrides: Partial<PersonYearInput> = {}
): PersonYearInput {
  // Birth year = test year - age
  const birthdate = new Date(year - ageInYear, 0, 1);
  return {
    owner: 'primary',
    year,
    birthdate,
    province: 'ON',
    maritalStatus: 'single',
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    nonRegACB: 0,
    rrspContribution: 0,
    tfsaContribution: 0,
    employmentIncome: 0,
    pensionIncome: 0,
    otherIncome: 0,
    expectedCPPAt65: 3000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 25000,
    investmentReturn: 0.0,
    inflationRate: 0.0,
    retirementAge: 65,
    yearsFromProjectionStart: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 5 — GIS Trap
// A low-income retiree (tiny RRSP $10k, CPP $3k/yr, expenses $25k/yr) should:
//   (a) receive GIS automatically at age 65
//   (b) RRSP withdrawals should reduce GIS by ~50¢ per dollar withdrawn
// @see docs/source-of-truth/05-government-benefits.md - GIS Calculation
// ---------------------------------------------------------------------------
describe('Scenario 5 — GIS trap: low-income single retiree at 65', () => {
  it('should include GIS income when OAS-only income is low', () => {
    // Age 65, CPP $3k/yr, OAS starts, RRSP $0, no RRIF, no other income.
    // Total non-GIS income = CPP $3k + OAS ~$8.9k = ~$11.9k.
    // GIS income (excluding OAS) = CPP $3k → well under the single threshold ~$21.6k.
    // Expected: GIS > $0.
    const input = makeInput(65, 2026, {
      expectedCPPAt65: 3000,
      cppStartAge: 65,
      oasStartAge: 65,
      rrspBalance: 0,
      retirementSpending: 25000,
      retirementAge: 65,
    });

    const result = calculatePersonYear(input);

    expect(
      result.gisIncome,
      'GIS income should be positive for low-income single retiree'
    ).toBeGreaterThan(0);
    expect(result.oasIncome, 'OAS income should be positive at age 65').toBeGreaterThan(0);
    expect(result.cppIncome, 'CPP income should be positive').toBeGreaterThan(0);
  });

  it('should reduce GIS by approximately 50 cents per dollar of RRSP withdrawal', () => {
    // Two scenarios: same person, but one has a $10k RRSP that gets drawn down.
    // The difference in GIS should be ~$5,000 (50% of $10k withdrawal).
    const baseInput = makeInput(65, 2026, {
      expectedCPPAt65: 3000,
      cppStartAge: 65,
      oasStartAge: 65,
      rrspBalance: 0,
      retirementSpending: 35000, // Force a gap so withdrawal happens
      retirementAge: 65,
    });

    const withRRSPInput = makeInput(65, 2026, {
      expectedCPPAt65: 3000,
      cppStartAge: 65,
      oasStartAge: 65,
      rrspBalance: 10000,
      retirementSpending: 35000,
      retirementAge: 65,
    });

    const baseResult = calculatePersonYear(baseInput);
    const withRRSPResult = calculatePersonYear(withRRSPInput);

    const baseGIS = baseResult.gisIncome ?? 0;
    const withRRSPGIS = withRRSPResult.gisIncome ?? 0;

    // RRSP withdrawal of up to $10k should reduce GIS by ~$5k (50¢ per $1)
    // The actual RRSP withdrawal depends on how much is needed to fill the gap.
    const rrspWithdrawn = withRRSPResult.rrifWithdrawal - baseResult.rrifWithdrawal; // RRSP pre-71 reports in rrifWithdrawal
    // Note: before 71, RRSP withdrawal is non-zero only if there's a gap
    const gisReduction = baseGIS - withRRSPGIS;

    if (rrspWithdrawn > 0) {
      // GIS reduction should be approximately 50% of the RRSP withdrawal
      expect(gisReduction).toBeGreaterThan(0);
      expect(gisReduction / rrspWithdrawn).toBeCloseTo(0.5, 1);
    }
  });

  it('should produce $0 GIS when other income is high', () => {
    // Single person age 65 with $80k pension income — way above GIS threshold.
    const input = makeInput(65, 2026, {
      pensionIncome: 80000,
      expectedCPPAt65: 3000,
      cppStartAge: 65,
      oasStartAge: 65,
      retirementAge: 65,
    });

    const result = calculatePersonYear(input);
    const gis = result.gisIncome ?? 0;
    expect(gis, 'High-income retiree should receive $0 GIS').toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 6 — CPP and OAS delay to 70
// CPP at 70 must be exactly 42% higher than at 65 (0.7%/month × 60 months)
// OAS at 70 must be exactly 36% higher than at 65 (0.6%/month × 60 months)
// @see docs/source-of-truth/05-government-benefits.md - Early/Late Adjustment Factors
// ---------------------------------------------------------------------------
describe('Scenario 6 — CPP and OAS delayed to age 70', () => {
  it('CPP at age 70 should be exactly 42% higher than the age-65 baseline', () => {
    // @see docs/source-of-truth/05-government-benefits.md - TC-GOV-003
    const factor70 = calculateCPPAdjustmentFactor(70);
    // 60 months late × 0.7%/month = +42%
    expect(factor70).toBeCloseTo(1.42, 4);
  });

  it('OAS deferral factor at 70 should be exactly 1.36 (+36%)', () => {
    // @see docs/source-of-truth/05-government-benefits.md - OAS Deferral
    const factor70 = calculateOASDeferralFactor(70);
    // 60 months × 0.6%/month = +36%
    expect(factor70).toBeCloseTo(1.36, 4);
  });

  it('projection year: CPP income at 70 reflects +42% adjustment vs 65 baseline', () => {
    const baselineCPPAt65 = 12000;

    // Scenario: person IS 70, starts CPP at 70
    const inputAt70 = makeInput(70, 2026, {
      expectedCPPAt65: baselineCPPAt65,
      cppStartAge: 70,
      oasStartAge: 70,
      retirementAge: 65,
      retirementSpending: 0,
      yearsFromProjectionStart: 5,
    });

    const result = calculatePersonYear(inputAt70);

    // CPP income should be ~$12,000 * 1.42 = $17,040 (uninflated year 0 test)
    // With inflationRate=0, adjustedAmount = baseCPP * 1.42 * 1.0^(age-cppStartAge)
    expect(result.cppIncome).toBeCloseTo(baselineCPPAt65 * 1.42, -2);
  });

  it('projection year: OAS income at 70 reflects +36% adjustment vs 65 baseline', () => {
    const inputAt70 = makeInput(70, 2026, {
      expectedCPPAt65: 0, // No CPP to isolate OAS
      cppStartAge: 65,
      oasStartAge: 70,
      yearsOfResidence: 40,
      retirementAge: 65,
      retirementSpending: 0,
      yearsFromProjectionStart: 5,
    });

    const inputAt65 = makeInput(65, 2026, {
      expectedCPPAt65: 0,
      cppStartAge: 65,
      oasStartAge: 65,
      yearsOfResidence: 40,
      retirementAge: 65,
      retirementSpending: 0,
      yearsFromProjectionStart: 0,
    });

    const result70 = calculatePersonYear(inputAt70);
    const result65 = calculatePersonYear(inputAt65);

    // OAS at 70 / OAS at 65 should be ~1.36
    // Both use year=2026, same OAS benefit amounts, no inflation applied
    expect(result65.oasIncome).toBeGreaterThan(0);
    expect(result70.oasIncome / result65.oasIncome).toBeCloseTo(1.36, 1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7 — Non-registered capital gains tax drag
// $500k in non-registered account, 5% annual return.
// Withdrawals should apply 50% capital gains inclusion rate on the GAIN portion,
// not tax the full withdrawal as ordinary income.
// @see docs/source-of-truth/02-account-types.md - NREG-002, TC-ACCT-005
// ---------------------------------------------------------------------------
describe('Scenario 7 — Non-registered capital gains inclusion rate', () => {
  it('processNonRegisteredWithdrawal uses 50% capital gains inclusion', () => {
    // $500k balance, $300k ACB, $200k unrealized gains
    // Withdraw $100k (20% of account)
    // Realized gain = 20% × $200k = $40k
    // Taxable gain (50% inclusion) = $20k — NOT $100k
    const result = processNonRegisteredWithdrawal(100000, 500000, 300000, 200000);

    expect(result.withdrawalAmount).toBe(100000);
    expect(result.realizedGain).toBeCloseTo(40000, 0); // 20% of $200k
    expect(result.taxableGain).toBeCloseTo(20000, 0); // 50% of $40k
    // taxableGain must be well below the full withdrawal
    expect(result.taxableGain).toBeLessThan(result.withdrawalAmount);
  });

  it('only taxable gain (50% inclusion) is added to income, not full withdrawal', () => {
    // This test verifies the PROJECTION ENGINE correctly passes capital gains
    // through the capitalGains field, not as ordinary income.
    //
    // Person: age 65, $500k non-reg (all gains — ACB $0), no other accounts.
    // Spending = $30k. Total gain on withdrawal = proportional.
    // Taxable income should be MUCH LESS than the full nonRegWithdrawal amount.
    const input = makeInput(65, 2026, {
      nonRegBalance: 500000,
      nonRegACB: 0, // All gains — worst case for inclusion rate test
      rrspBalance: 0,
      rrifBalance: 0,
      tfsaBalance: 0,
      retirementSpending: 30000,
      retirementAge: 65,
      investmentReturn: 0.0,
      inflationRate: 0.0,
    });

    const result = calculatePersonYear(input);

    // The withdrawal happened from non-reg
    expect(result.nonRegWithdrawal).toBeGreaterThan(0);

    // Taxable income for non-reg should be at most 50% of the realized gain,
    // which itself is at most 100% of the withdrawal (when ACB=0).
    // So taxable income from non-reg ≤ 50% × withdrawal.
    const nonRegTaxableMax = result.nonRegWithdrawal * 0.5;
    // The total taxable income (excluding OAS) should be ≤ nonRegTaxableMax + CPP + other income
    const grossIncome = result.taxCalculation.grossIncome;
    const nonRegContribution = grossIncome - result.cppIncome - result.oasIncome;
    expect(nonRegContribution).toBeLessThanOrEqual(nonRegTaxableMax + 1); // +1 for rounding
  });

  it('when ACB equals balance (no gains), non-reg withdrawal generates zero taxable gain', () => {
    // ACB = balance means no embedded gain — return of capital is fully non-taxable
    const result = processNonRegisteredWithdrawal(50000, 200000, 200000, 0);
    expect(result.realizedGain).toBe(0);
    expect(result.taxableGain).toBe(0);
  });

  it('full-gains scenario: $500k balance, ACB $0, withdraw $100k — taxable gain is $50k', () => {
    // $500k, all gains ($0 ACB, $500k unrealized), withdraw $100k (20%)
    // Realized gain = 20% × $500k = $100k
    // Taxable (50% inclusion) = $50k
    const result = processNonRegisteredWithdrawal(100000, 500000, 0, 500000);
    expect(result.realizedGain).toBeCloseTo(100000, 0);
    expect(result.taxableGain).toBeCloseTo(50000, 0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 8 — TFSA ghost income (tax = $0)
// $500k TFSA, $0 RRSP/non-reg, $40k/yr expenses ages 55–64 (pre-OAS/CPP).
// The tax column should show exactly $0 since TFSA withdrawals are not taxable.
// @see docs/source-of-truth/02-account-types.md - TFSA-007, TFSA-009
// ---------------------------------------------------------------------------
describe('Scenario 8 — TFSA withdrawals produce $0 tax', () => {
  it('TFSA-only withdrawal results in $0 taxable income and $0 taxes paid', () => {
    // Age 60, no employment, no CPP/OAS (too young), no pension.
    // TFSA $500k, spending $40k — all from TFSA.
    const input = makeInput(60, 2026, {
      tfsaBalance: 500000,
      rrspBalance: 0,
      rrifBalance: 0,
      nonRegBalance: 0,
      retirementSpending: 40000,
      retirementAge: 60,
      expectedCPPAt65: 0, // No CPP to isolate TFSA test
      cppStartAge: 65,
      oasStartAge: 65,
      investmentReturn: 0.0,
      inflationRate: 0.0,
    });

    const result = calculatePersonYear(input);

    expect(result.tfsaWithdrawal, 'TFSA should be drawn down to cover expenses').toBeGreaterThan(0);
    expect(result.taxesPaid, 'Taxes paid should be $0 when income is TFSA-only').toBe(0);
    expect(result.taxCalculation.grossIncome, 'Gross taxable income should be $0').toBe(0);
  });

  it('TFSA withdrawal does not appear in taxable income even with other income present', () => {
    // Age 60, small pension $5k/yr (below personal amount → no tax), plus TFSA withdrawal.
    // Confirm TFSA withdrawal is NOT added to taxable income.
    const inputWithPension = makeInput(60, 2026, {
      tfsaBalance: 500000,
      pensionIncome: 5000,
      rrspBalance: 0,
      retirementSpending: 40000,
      retirementAge: 60,
      cppStartAge: 65,
      oasStartAge: 65,
      investmentReturn: 0.0,
      inflationRate: 0.0,
    });

    const inputTFSAOnly = makeInput(60, 2026, {
      tfsaBalance: 500000,
      pensionIncome: 0,
      rrspBalance: 0,
      retirementSpending: 40000,
      retirementAge: 60,
      cppStartAge: 65,
      oasStartAge: 65,
      investmentReturn: 0.0,
      inflationRate: 0.0,
    });

    const resultWithPension = calculatePersonYear(inputWithPension);
    const resultTFSAOnly = calculatePersonYear(inputTFSAOnly);

    // The taxable income difference should only be the pension income ($5k), not the TFSA withdrawal
    const taxableIncomeDiff =
      resultWithPension.taxCalculation.grossIncome - resultTFSAOnly.taxCalculation.grossIncome;
    expect(taxableIncomeDiff).toBeCloseTo(5000, 0);
  });

  it('processTFSAWithdrawal always returns $0 taxable amount', () => {
    // Unit test on the account-level function
    const result = processTFSAWithdrawal(500000, 40000);
    expect(result.taxableAmount).toBe(0);
    expect(result.withdrawalAmount).toBe(40000);
  });
});

// ---------------------------------------------------------------------------
// Scenario 9 — TFSA re-contribution room
// $50k TFSA withdrawal at age 60 should create $50k new contribution room
// on January 1 of the FOLLOWING year, not just the annual $7k limit.
// @see docs/source-of-truth/02-account-types.md - TFSA-008
// ---------------------------------------------------------------------------
describe('Scenario 9 — TFSA re-contribution room restored the following year', () => {
  it('processTFSAWithdrawal returns roomRestoredNextYear equal to withdrawal', () => {
    const withdrawal = 50000;
    const result = processTFSAWithdrawal(100000, withdrawal);
    expect(result.roomRestoredNextYear).toBe(withdrawal);
  });

  it('calculateTFSAContributionRoom adds prior-year withdrawals to new room', () => {
    // Current year room = $10k unused + $7k new annual limit + $50k from last year's withdrawal
    const currentYearRoom = calculateTFSAContributionRoom(10000, 50000, 2026);
    expect(currentYearRoom).toBe(10000 + getTFSAAnnualLimit(2026) + 50000);
    expect(currentYearRoom).toBe(67000); // 10000 + 7000 + 50000
  });

  it('a $50k withdrawal creates exactly $50k extra room the following year', () => {
    // Without any prior withdrawal, room next year = $0 unused + $7k annual
    const roomWithoutWithdrawal = calculateTFSAContributionRoom(0, 0, 2026);
    // With $50k withdrawal, room next year = $0 unused + $7k annual + $50k restored
    const roomWithWithdrawal = calculateTFSAContributionRoom(0, 50000, 2026);

    const extraRoom = roomWithWithdrawal - roomWithoutWithdrawal;
    expect(extraRoom).toBe(50000);
  });

  it('large withdrawal fully restored — not capped at annual limit', () => {
    // Scenario: $100k withdrawal. Room next year should include the full $100k.
    const withdrawal = 100000;
    const result = processTFSAWithdrawal(200000, withdrawal);
    expect(result.roomRestoredNextYear).toBe(100000);

    const roomNextYear = calculateTFSAContributionRoom(0, result.roomRestoredNextYear, 2026);
    // Annual limit + full withdrawal restored
    expect(roomNextYear).toBe(getTFSAAnnualLimit(2026) + 100000);
  });
});
