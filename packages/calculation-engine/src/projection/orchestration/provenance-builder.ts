/**
 * Per-cell provenance sidecar builder for the yearly result.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Builds a ProvenanceMetadata object describing every D-38 in-scope field
 * that has a non-zero value this year. Override-source emission (D-40) reads
 * from the existing overridesMetadata to choose 'override' vs 'engine' rule.
 *
 * @see .planning/phases/02-provenance/02-CONTEXT.md - D-32, D-33, D-38, D-40, D-41
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type {
  OverrideFieldMetadata,
  OverrideMetadata,
  ProvenanceMetadata,
  ProvinceCode,
} from '@retireops/shared';

import {
  getFederalTaxBrackets,
  getFederalMarginalRate,
  getProvincialTaxBrackets,
  getProvincialMarginalRate,
} from '../../tax/index.js';
import {
  buildWithdrawalProvenance,
  buildSpendingProvenance,
  buildRRIFMinimumProvenance,
  buildTotalIncomeProvenance,
  buildTaxProvenance,
} from '../provenance.js';

/** Inputs needed to build a single year's provenance sidecar. */
export interface ProvenanceBuildInput {
  year: number;
  age: number;
  province: ProvinceCode;
  isRetired: boolean;
  /** When true (couple path), include the LIF withdrawal provenance entry. */
  includeLIF: boolean;
  /** When true (couple path), include LIF in the totalIncome sources. */
  includeLIFInTotalIncome: boolean;

  effectiveStrategyId: string;
  overridesMetadata: OverrideMetadata;

  // Withdrawal values (engine-side, when no override applies)
  rrspWithdrawal: number;
  /** Sum of additional RRIF + RRSP + meltdown + bracketFill (engine path). */
  totalRRIFForProvenance: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  /** Couple-path total LIF (rrifMinimum + additional). 0 in single path. */
  totalLIFWithdrawal: number;

  // Spending
  livingExpenses: number;
  retirementSpending: number;

  // RRIF minimum
  rrifForcedMinimum: number;
  rrifOpeningBalance: number;
  rrifMinimumRate: number;

  // Total income computation
  totalIncome: number;
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  oasIncome: number;
  gisIncome: number;

  // Tax cells
  taxableIncome: number;
  federalTaxNet: number;
  provincialTaxNet: number;
  totalTax: number;
}

/**
 * Format a bracket label string from min/max boundaries.
 * Mirrors the inline closure in the original yearly-calculator.ts.
 */
function bracketLabel(min: number, max: number): string {
  return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
}

/** Build provenance for a single withdrawal field — picks override vs engine source. */
function buildOneWithdrawal(
  field: 'rrsp' | 'rrif' | 'tfsa' | 'nonreg',
  engineValue: number,
  overrideMeta: OverrideFieldMetadata | undefined,
  drawdownTier: string,
  effectiveStrategyId: string,
  year: number
): ReturnType<typeof buildWithdrawalProvenance> {
  if (overrideMeta) {
    return buildWithdrawalProvenance({
      field,
      value: overrideMeta.actual,
      isOverride: true,
      overrideInputs: {
        requestedReal: overrideMeta.requestedReal,
        requestedNominal: overrideMeta.requestedNominal,
        actualNominal: overrideMeta.actual,
        anchorYear: year,
        applyForward: false,
      },
    });
  }
  return buildWithdrawalProvenance({
    field,
    value: engineValue,
    isOverride: false,
    engineInputs: { drawdownTier, strategyId: effectiveStrategyId },
  });
}

/**
 * Build the per-cell provenance sidecar for a single projection year.
 * Returns the populated ProvenanceMetadata object.
 *
 * @see .planning/phases/02-provenance/02-CONTEXT.md - D-32, D-33, D-38
 */
export function buildYearProvenance(input: ProvenanceBuildInput): ProvenanceMetadata {
  const provenance: ProvenanceMetadata = {};
  const {
    year,
    age,
    province,
    includeLIF,
    includeLIFInTotalIncome,
    effectiveStrategyId,
    overridesMetadata,
  } = input;

  // Withdrawals — 5 fields, override-or-engine source (D-40, D-41)
  const rrspResult = buildOneWithdrawal(
    'rrsp',
    input.rrspWithdrawal,
    overridesMetadata.rrspWithdrawal,
    'rrsp',
    effectiveStrategyId,
    year
  );
  if (rrspResult) provenance.rrspWithdrawal = rrspResult;

  const rrifResult = buildOneWithdrawal(
    'rrif',
    input.totalRRIFForProvenance,
    overridesMetadata.rrifWithdrawal,
    'rrif',
    effectiveStrategyId,
    year
  );
  if (rrifResult) provenance.rrifWithdrawal = rrifResult;

  const tfsaResult = buildOneWithdrawal(
    'tfsa',
    input.tfsaWithdrawal,
    overridesMetadata.tfsaWithdrawal,
    'tfsa',
    effectiveStrategyId,
    year
  );
  if (tfsaResult) provenance.tfsaWithdrawal = tfsaResult;

  const nonRegResult = buildOneWithdrawal(
    'nonreg',
    input.nonRegWithdrawal,
    overridesMetadata.nonRegWithdrawal,
    'nonreg',
    effectiveStrategyId,
    year
  );
  if (nonRegResult) provenance.nonRegWithdrawal = nonRegResult;

  // LIF — only emitted on couple path (D-41 omits when always 0).
  if (includeLIF) {
    const lifResult = buildWithdrawalProvenance({
      field: 'lif',
      value: input.totalLIFWithdrawal,
      isOverride: false,
      engineInputs: { drawdownTier: 'lif', strategyId: effectiveStrategyId },
    });
    if (lifResult) provenance.lifWithdrawal = lifResult;
  }

  // Spending (D-38, D-40, D-41)
  const spendingOverride = overridesMetadata.livingExpenses;
  const spendingResult = spendingOverride
    ? buildSpendingProvenance({
        value: input.livingExpenses,
        isOverride: true,
        overrideInputs: {
          requestedReal: spendingOverride.requestedReal,
          requestedNominal: spendingOverride.requestedNominal,
          anchorYear: year,
          applyForward: false,
        },
      })
    : buildSpendingProvenance({
        value: input.livingExpenses,
        isOverride: false,
        engineInputs: { targetReal: input.retirementSpending, age },
      });
  if (spendingResult) provenance.livingExpenses = spendingResult;

  // RRIF mandatory minimum (engine-only — never overridden, D-38)
  const rrifMinResult = buildRRIFMinimumProvenance({
    value: input.rrifForcedMinimum,
    age,
    rrifBalance: input.rrifOpeningBalance,
    withdrawalFactor: input.rrifMinimumRate,
  });
  if (rrifMinResult) provenance.rrifMandatoryMinimum = rrifMinResult;

  // Total income (engine-only, D-38)
  const totalIncomeSources: Parameters<typeof buildTotalIncomeProvenance>[0]['sources'] = {
    employmentIncome: input.isRetired ? 0 : input.employmentIncome,
    pensionIncome: input.pensionIncome,
    cppIncome: input.cppIncome,
    oasIncome: input.oasIncome,
    gisIncome: input.gisIncome,
    rrifWithdrawal: input.totalRRIFForProvenance,
    tfsaWithdrawal: input.tfsaWithdrawal,
    nonRegWithdrawal: input.nonRegWithdrawal,
  };
  if (includeLIFInTotalIncome) {
    totalIncomeSources.lifWithdrawal = input.totalLIFWithdrawal;
  }
  const totalIncomeResult = buildTotalIncomeProvenance({
    value: input.totalIncome,
    sources: totalIncomeSources,
  });
  if (totalIncomeResult) provenance.totalIncome = totalIncomeResult;

  // Tax cells — derive bracket labels from the same bracket tables used by the engine
  const federalBrackets = getFederalTaxBrackets(year);
  const federalBracketMatch = federalBrackets.find(
    (b) => input.taxableIncome >= b.min && input.taxableIncome < b.max
  );
  const federalBracketLabel = federalBracketMatch
    ? bracketLabel(federalBracketMatch.min, federalBracketMatch.max)
    : undefined;
  const federalMarginalRate = getFederalMarginalRate(input.taxableIncome, year);

  const provincialBrackets = getProvincialTaxBrackets(province, year);
  const provincialBracketMatch = provincialBrackets.find(
    (b) => input.taxableIncome >= b.min && input.taxableIncome < b.max
  );
  const provincialBracketLabel = provincialBracketMatch
    ? bracketLabel(provincialBracketMatch.min, provincialBracketMatch.max)
    : undefined;
  const provincialMarginalRate = getProvincialMarginalRate(input.taxableIncome, province, year);

  const fedResult = buildTaxProvenance({
    field: 'federalTax',
    value: input.federalTaxNet,
    totalTaxableIncome: input.taxableIncome,
    federalBracket: federalBracketLabel,
    federalMarginalRate,
  });
  if (fedResult) provenance.federalTax = fedResult;

  const provResult = buildTaxProvenance({
    field: 'provincialTax',
    value: input.provincialTaxNet,
    totalTaxableIncome: input.taxableIncome,
    province,
    provincialBracket: provincialBracketLabel,
    provincialMarginalRate,
  });
  if (provResult) provenance.provincialTax = provResult;

  const totalTaxResult = buildTaxProvenance({
    field: 'totalTaxes',
    value: input.totalTax,
    totalTaxableIncome: input.taxableIncome,
    federalBracket: federalBracketLabel,
    provincialBracket: provincialBracketLabel,
    province,
  });
  if (totalTaxResult) provenance.totalTaxes = totalTaxResult;

  return provenance;
}
