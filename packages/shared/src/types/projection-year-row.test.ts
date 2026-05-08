/**
 * Type-level compilation tests for ProjectionYearRow
 * @see docs/source-of-truth/08-projection-engine.md
 * @see ENG-01
 */
import { describe, it, expect } from 'vitest';
import type { ProjectionYearRow, ProjectionOutput } from './projection.js';

describe('ProjectionYearRow', () => {
  it('should compile with all required fields for a single projection', () => {
    const row: ProjectionYearRow = {
      year: 2026,
      age: 65,
      employmentIncome: 50000,
      pensionIncome: 12000,
      cppIncome: 15000,
      oasIncome: 8000,
      rrifWithdrawal: 20000,
      tfsaWithdrawal: 5000,
      nonRegWithdrawal: 3000,
      totalGrossIncome: 113000,
      federalTax: 15000,
      provincialTax: 8000,
      oasClawback: 0,
      totalTax: 23000,
      effectiveTaxRate: 0.2035,
      livingExpenses: 60000,
      netCashFlow: 30000,
      rrspBalance: 200000,
      rrifBalance: 300000,
      tfsaBalance: 80000,
      nonRegBalance: 50000,
      totalNetWorth: 630000,
      householdTotalIncome: 113000,
      householdTotalTax: 23000,
      householdNetCashFlow: 30000,
      householdNetWorth: 630000,
      rrifForcedMinimum: 0,
      rrifMinimumRate: 0,
      rrifConversionYear: false,
      isRetired: true,
      isRRIFConversionYear: false,
    };

    expect(typeof row.year).toBe('number');
  });

  it('should compile with spouse fields for a couple projection', () => {
    const row: ProjectionYearRow = {
      year: 2026,
      age: 65,
      spouseAge: 62,
      employmentIncome: 50000,
      pensionIncome: 12000,
      cppIncome: 15000,
      oasIncome: 8000,
      gisIncome: 0,
      rrifWithdrawal: 20000,
      tfsaWithdrawal: 5000,
      nonRegWithdrawal: 3000,
      totalGrossIncome: 113000,
      federalTax: 15000,
      provincialTax: 8000,
      totalTax: 23000,
      effectiveTaxRate: 0.2035,
      livingExpenses: 60000,
      netCashFlow: 30000,
      rrspBalance: 200000,
      rrifBalance: 300000,
      tfsaBalance: 80000,
      nonRegBalance: 50000,
      totalNetWorth: 630000,
      // Spouse income
      spouseEmploymentIncome: 30000,
      spousePensionIncome: 8000,
      spouseCppIncome: 10000,
      spouseOasIncome: 7000,
      spouseGisIncome: 0,
      spouseRrifWithdrawal: 15000,
      spouseTfsaWithdrawal: 3000,
      spouseNonRegWithdrawal: 2000,
      // Spouse taxes
      spouseFederalTax: 9000,
      spouseProvincialTax: 5000,
      oasClawback: 0,
      spouseTotalTax: 14000,
      spouseEffectiveTaxRate: 0.1867,
      // Spouse balances
      spouseRrspBalance: 150000,
      spouseRrifBalance: 200000,
      spouseTfsaBalance: 60000,
      spouseNonRegBalance: 40000,
      // Household aggregates
      householdTotalIncome: 185000,
      householdTotalTax: 37000,
      householdNetCashFlow: 55000,
      householdNetWorth: 1080000,
      rrifForcedMinimum: 0,
      rrifMinimumRate: 0,
      rrifConversionYear: false,
      // Spouse RRIF output fields
      spouseRrifForcedMinimum: 16200,
      spouseRrifMinimumRate: 0.054,
      spouseRrifConversionYear: false,
      isRetired: true,
      isRRIFConversionYear: false,
    };

    expect(row.spouseAge).toBeDefined();
  });

  it('should allow engine gap fields to be omitted', () => {
    // Engine gap fields (D-05, ENG-02): selfEmploymentIncome, rentalIncome,
    // cppContributions, eiPremiums, goalSpending, debtPayments — all optional
    const row: ProjectionYearRow = {
      year: 2026,
      age: 65,
      employmentIncome: 50000,
      pensionIncome: 12000,
      cppIncome: 15000,
      oasIncome: 8000,
      rrifWithdrawal: 20000,
      tfsaWithdrawal: 5000,
      nonRegWithdrawal: 3000,
      totalGrossIncome: 113000,
      federalTax: 15000,
      provincialTax: 8000,
      oasClawback: 0,
      totalTax: 23000,
      effectiveTaxRate: 0.2035,
      livingExpenses: 60000,
      netCashFlow: 30000,
      rrspBalance: 200000,
      rrifBalance: 300000,
      tfsaBalance: 80000,
      nonRegBalance: 50000,
      totalNetWorth: 630000,
      householdTotalIncome: 113000,
      householdTotalTax: 23000,
      householdNetCashFlow: 30000,
      householdNetWorth: 630000,
      rrifForcedMinimum: 0,
      rrifMinimumRate: 0,
      rrifConversionYear: false,
      isRetired: true,
      isRRIFConversionYear: false,
      // selfEmploymentIncome: omitted
      // rentalIncome: omitted
      // cppContributions: omitted
      // eiPremiums: omitted
      // goalSpending: omitted
      // debtPayments: omitted
    };

    expect(row.cppContributions).toBeUndefined();
  });

  it('ProjectionOutput should accept projectionRows field', () => {
    const output = {
      projectionRows: [],
    } as unknown as ProjectionOutput;

    expect(Array.isArray(output.projectionRows)).toBe(true);
  });

  it('should compile with RRIF output fields set to non-zero values (ROUT-01)', () => {
    const row: ProjectionYearRow = {
      year: 2040,
      age: 75,
      employmentIncome: 0,
      pensionIncome: 24000,
      cppIncome: 15000,
      oasIncome: 8500,
      rrifWithdrawal: 27000,
      tfsaWithdrawal: 0,
      nonRegWithdrawal: 0,
      totalGrossIncome: 74500,
      federalTax: 10000,
      provincialTax: 5500,
      oasClawback: 0,
      totalTax: 15500,
      effectiveTaxRate: 0.2081,
      livingExpenses: 55000,
      netCashFlow: 4000,
      rrspBalance: 0,
      rrifBalance: 473000,
      tfsaBalance: 95000,
      nonRegBalance: 30000,
      totalNetWorth: 598000,
      householdTotalIncome: 74500,
      householdTotalTax: 15500,
      householdNetCashFlow: 4000,
      householdNetWorth: 598000,
      rrifForcedMinimum: 27000,
      rrifMinimumRate: 0.0582,
      rrifConversionYear: false,
      isRetired: true,
      isRRIFConversionYear: false,
    };

    expect(row.rrifForcedMinimum).toBe(27000);
    expect(row.rrifMinimumRate).toBe(0.0582);
    expect(row.rrifConversionYear).toBe(false);
  });
});
