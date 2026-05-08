import type { CoupleProjectionOutput } from '@retireops/calculation-engine';
import type { ProjectionOutput, YearlyResult } from '@retireops/shared';

/**
 * The v1 optimization analyzers read single-person YearlyResult rows. Couple
 * projections store the same per-person fields under primary/spouse and keep
 * household totals on the parent row. This adapter lets the existing analyzers
 * run for couples without losing household-level lifetime tax comparisons.
 */
export function adaptCoupleOutputForOptimization(output: CoupleProjectionOutput): ProjectionOutput {
  const yearlyResults: YearlyResult[] = output.yearlyResults.map((year) => {
    const primary = year.primary;
    const spouseAge = year.spouse.age;

    return {
      year: primary.year,
      age: primary.age,
      spouseAge,
      employmentIncome: primary.employmentIncome,
      pensionIncome: primary.pensionIncome,
      cppIncome: primary.cppIncome,
      ...(primary.oasGrossIncome !== undefined && { oasGrossIncome: primary.oasGrossIncome }),
      ...(primary.oasNetIncome !== undefined && { oasNetIncome: primary.oasNetIncome }),
      oasIncome: primary.oasIncome,
      ...(primary.oasClawback !== undefined && { oasClawback: primary.oasClawback }),
      ...(primary.gisIncome !== undefined && { gisIncome: primary.gisIncome }),
      rrifWithdrawal: primary.rrifWithdrawal,
      tfsaWithdrawal: primary.tfsaWithdrawal,
      nonRegWithdrawal: primary.nonRegWithdrawal,
      totalIncome: primary.totalGrossIncome,
      livingExpenses: primary.livingExpenses,
      taxesPaid: primary.taxesPaid,
      netCashFlow: primary.netCashFlow,
      rrspBalance: primary.rrspBalance,
      rrifBalance: primary.rrifBalance,
      tfsaBalance: primary.tfsaBalance,
      nonRegBalance: primary.nonRegBalance,
      totalNetWorth: primary.totalNetWorth,
      taxCalculation: primary.taxCalculation,
      rrifForcedMinimum: primary.rrifForcedMinimum,
      rrifMinimumRate: primary.rrifMinimumRate,
      rrifConversionYear: primary.rrifConversionYear,
      ...(primary.bracketFillWithdrawal !== undefined && {
        bracketFillWithdrawal: primary.bracketFillWithdrawal,
      }),
      ...(primary.rrspContributionRoom !== undefined && {
        rrspContributionRoom: primary.rrspContributionRoom,
      }),
      ...(primary.overContributionPenalty !== undefined && {
        overContributionPenalty: primary.overContributionPenalty,
      }),
      ...(primary.ledgerWarnings !== undefined && { ledgerWarnings: primary.ledgerWarnings }),
      ...(primary.overrides !== undefined && { overrides: primary.overrides }),
      ...(primary.provenance !== undefined && { provenance: primary.provenance }),
      isRetired: primary.isRetired,
      isRRIFConversionYear: primary.rrifConversionYear,
    };
  });

  return {
    id: output.id,
    input: output.input,
    yearlyResults,
    ...(output.projectionRows !== undefined && { projectionRows: output.projectionRows }),
    legacyTargetMet: output.legacyTargetMet,
    summary: output.summary,
    ...(output.terminalTaxEvents !== undefined && { terminalTaxEvents: output.terminalTaxEvents }),
    ...(output.warnings !== undefined && { warnings: output.warnings }),
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
  };
}

export function isCoupleProjectionOutput(
  output: ProjectionOutput | CoupleProjectionOutput
): output is CoupleProjectionOutput {
  const firstYear = output.yearlyResults[0];
  return firstYear !== undefined && 'primary' in firstYear && 'spouse' in firstYear;
}
