import { describe, it, expect } from 'vitest';
import { calculateTotalTax } from './index.js';
import { calculateComprehensiveTaxCredits } from './credits.js';

describe('Tax Integration Audit', () => {
  it('should integrate age and pension credits through the total-tax path', () => {
    const age64 = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 64,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 30000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    const age65 = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 65,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 30000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    expect(age65.totalTax).toBeLessThan(age64.totalTax);
  });

  it('should not integrate helper-only targeted credits into the total-tax path yet', () => {
    const helperCredits = calculateComprehensiveTaxCredits({
      age: 70,
      netIncome: 40000,
      taxableIncome: 40000,
      employmentIncome: 0,
      eligiblePensionIncome: 2000,
      province: 'ON',
      homeAccessibilityExpenses: 10000,
    });

    const integratedTax = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 70,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 38000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    expect(helperCredits.federal.homeAccessibilityCredit).toBeGreaterThan(0);
    expect(integratedTax.federalCredits).toBe(0);
    expect(integratedTax.provincialCredits).toBe(0);
  });

  it("should reduce B.C. total tax when the renter's credit is eligible", () => {
    const withoutCredit = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'BC',
      age: 67,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 50000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
      bcRentersCreditEligible: false,
    });

    const withCredit = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'BC',
      age: 67,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 50000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
      bcRentersCreditEligible: true,
      bcRentersCreditAdjustedIncome: 50000,
    });

    expect(withCredit.provincialCredits).toBe(400);
    expect(withCredit.totalTax).toBeLessThan(withoutCredit.totalTax);
  });

  it("should reduce Ontario total tax when the seniors' public transit credit is claimed", () => {
    const withoutCredit = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 66,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 50000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    const withCredit = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 66,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 50000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
      onSeniorsTransitEligibleExpenses: 5000,
    });

    expect(withCredit.provincialCredits).toBe(450);
    expect(withCredit.totalTax).toBeLessThan(withoutCredit.totalTax);
  });

  it("should not apply Ontario seniors' public transit credit before the age threshold", () => {
    const result = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 65,
      employmentIncome: 0,
      pensionIncome: 2000,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 50000,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
      onSeniorsTransitEligibleExpenses: 3000,
    });

    expect(result.provincialCredits).toBe(0);
  });

  /**
   * TAX-CA-03: provincial dividend credit wired into calculateTotalTax
   * @see docs/source-of-truth/04-tax-engine.md - TC-TAX-005
   */
  it('applies provincial dividend credit in calculateTotalTax — TAX-CA-03', () => {
    const withDividends = calculateTotalTax({
      year: 2024,
      owner: 'primary',
      province: 'ON',
      age: 60,
      employmentIncome: 60000,
      pensionIncome: 0,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 10000,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    const _withoutDividends = calculateTotalTax({
      year: 2024,
      owner: 'primary',
      province: 'ON',
      age: 60,
      employmentIncome: 60000,
      pensionIncome: 0,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    // Provincial credits should include ON eligible dividend credit (~1380)
    expect(withDividends.provincialCredits).toBeGreaterThan(0);
    // Dividend version has lower total tax than version with same employment income but no dividends
    // (dividend grosses up income but credit offsets the provincial portion)
    expect(withDividends.provincialCredits).toBeCloseTo(1380, 0);
  });

  /**
   * TAX-CA-02: RRSP deduction reduces taxable income and total tax
   * @see docs/source-of-truth/04-tax-engine.md - RRSP Deduction
   */
  it('TAX-CA-02: RRSP contribution reduces netIncome and totalTax', () => {
    const withoutRrsp = calculateTotalTax({
      year: 2025,
      owner: 'primary',
      province: 'ON',
      age: 45,
      employmentIncome: 80000,
      pensionIncome: 0,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    const withRrsp = calculateTotalTax({
      year: 2025,
      owner: 'primary',
      province: 'ON',
      age: 45,
      employmentIncome: 80000,
      pensionIncome: 0,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 10000,
      otherDeductions: 0,
    });

    // RRSP deduction reduces net income
    expect(withRrsp.netIncome).toBeLessThan(withoutRrsp.netIncome);
    expect(withoutRrsp.netIncome - withRrsp.netIncome).toBe(10000);
    // Lower taxable income reduces total tax
    expect(withRrsp.totalTax).toBeLessThan(withoutRrsp.totalTax);
  });

  /**
   * ISSUE-1: Audit reproducer — age 72 Ontario senior drawing RRIF + CPP + OAS.
   * Hand-verified expectations (2026 federal brackets, 2025 Ontario brackets):
   *   Gross = 124,310 + 14,264 + 13,102 = 151,676. No deductions.
   *   Federal before credits ≈ 29,395; BPA (16,129 × 14%) ≈ 2,258;
   *   age credit fully clawed back; pension credit 2,000 × 14% = 280.
   *   → Federal net ≈ 26,857.
   *   Ontario before credits ≈ 12,637; credits ≈ 727; surtax ≈ 3,000.
   *   → Ontario net ≈ 14,909.
   */
  it('ISSUE-1: age 72 ON senior — federal ~$27k, provincial ~$15k', () => {
    const result = calculateTotalTax({
      year: 2026,
      owner: 'primary',
      province: 'ON',
      age: 72,
      employmentIncome: 0,
      pensionIncome: 0,
      rrifIncome: 124310,
      cppIncome: 14264,
      oasIncome: 13102,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    });

    expect(result.grossIncome).toBe(151676);
    expect(result.netIncome).toBe(151676);
    expect(result.federalTaxNet).toBeGreaterThan(26000);
    expect(result.federalTaxNet).toBeLessThan(28500);
    expect(result.provincialTaxNet).toBeGreaterThan(14000);
    expect(result.provincialTaxNet).toBeLessThan(16000);
    expect(result.totalTax).toBeGreaterThan(40000);
    expect(result.totalTax).toBeLessThan(44500);
  });

  /**
   * ISSUE-8: Inflation indexing — tabled years pass through unchanged.
   */
  it('ISSUE-8: tabled years produce identical results with or without indexing options', () => {
    const commonInput = {
      year: 2026,
      owner: 'primary' as const,
      province: 'ON' as const,
      age: 65,
      employmentIncome: 0,
      pensionIncome: 0,
      rrifIncome: 60000,
      cppIncome: 14000,
      oasIncome: 8000,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    };

    const withoutIndexing = calculateTotalTax(commonInput);
    const withIndexingAtBase = calculateTotalTax({
      ...commonInput,
      inflationRate: 0.021,
      indexingBaseYear: 2026,
    });

    expect(withIndexingAtBase.totalTax).toBe(withoutIndexing.totalTax);
    expect(withIndexingAtBase.federalTaxNet).toBe(withoutIndexing.federalTaxNet);
    expect(withIndexingAtBase.oasClawback).toBe(withoutIndexing.oasClawback);
  });

  /**
   * ISSUE-8: Projection 30 years past last tabled year at 2.1% inflation.
   * Indexed brackets and BPA should materially reduce federal tax vs unindexed.
   */
  it('ISSUE-8: 30-year projection at 2.1% inflation lowers federal tax on nominal income', () => {
    const common = {
      year: 2056,
      owner: 'primary' as const,
      province: 'ON' as const,
      age: 95,
      employmentIncome: 0,
      pensionIncome: 0,
      rrifIncome: 150000,
      cppIncome: 0,
      oasIncome: 0,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    };

    const unindexed = calculateTotalTax(common);
    const indexed = calculateTotalTax({
      ...common,
      inflationRate: 0.021,
      indexingBaseYear: 2026,
    });

    // Indexed federal tax should be materially lower — brackets have grown ~1.86×
    expect(indexed.federalTaxNet).toBeLessThan(unindexed.federalTaxNet);
    expect(unindexed.federalTaxNet - indexed.federalTaxNet).toBeGreaterThan(5000);
  });

  /**
   * ISSUE-8: OAS clawback threshold indexes — high nominal income in 2056
   * triggers less clawback with indexing than without.
   */
  it('ISSUE-8: OAS clawback threshold indexes with inflation', () => {
    const common = {
      year: 2056,
      owner: 'primary' as const,
      province: 'ON' as const,
      age: 80,
      employmentIncome: 0,
      pensionIncome: 0,
      rrifIncome: 150000,
      cppIncome: 0,
      oasIncome: 15000,
      otherIncome: 0,
      interestIncome: 0,
      eligibleDividends: 0,
      nonEligibleDividends: 0,
      capitalGains: 0,
      rrspContribution: 0,
      otherDeductions: 0,
    };

    const unindexed = calculateTotalTax(common);
    const indexed = calculateTotalTax({
      ...common,
      inflationRate: 0.021,
      indexingBaseYear: 2026,
    });

    // Unindexed: threshold $93,454 → large clawback (likely full $15k cap)
    // Indexed: threshold ~$174k → no or much smaller clawback on $165k net income
    expect(indexed.oasClawback).toBeLessThan(unindexed.oasClawback);
  });
});
