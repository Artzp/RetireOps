/**
 * Terminal Return — Deemed-disposition estate tax at death
 * @see docs/source-of-truth/04-tax-engine.md
 * @see .gsd/milestones/M004/M004-ROADMAP.md — Boundary Map S01→S02
 *
 * Pure helper that composes calculateTotalTax + calculateTaxableCapitalGainEnhanced to
 * compute the one-year spike of tax arising from deemed disposition of all registered and
 * non-registered holdings in the year of death. TFSA transfers tax-free. Surviving-spouse
 * rollover defers the tax to zero in the decedent's terminal year.
 */
import type { TerminalReturnInput, TerminalReturnResult } from '@retireops/shared';
import { calculateTotalTax, type TaxCalculationInput } from './index.js';
import { calculateTaxableCapitalGainEnhanced } from './capital-gains.js';

// Re-export for backwards compatibility with S01 isolation tests and the
// tax/index.ts barrel. Canonical declaration now lives in @retireops/shared.
export type { TerminalReturnInput, TerminalReturnResult };

export function calculateTerminalReturn(input: TerminalReturnInput): TerminalReturnResult {
  const grossEstate =
    input.rrspBalance +
    input.rrifBalance +
    input.liraBalance +
    input.lifBalance +
    input.tfsaBalance +
    input.nonRegBalance;

  if (input.hasSurvivingSpouse) {
    return {
      year: input.year,
      triggeringOwner: input.owner,
      grossEstate,
      deemedDispositionIncome: 0,
      realizedCapitalGain: 0,
      taxableCapitalGain: 0,
      terminalTaxes: 0,
      netEstate: grossEstate,
      wasSpouseRolloverApplied: true,
    };
  }

  const deemedDispositionIncome =
    input.rrspBalance + input.rrifBalance + input.liraBalance + input.lifBalance;

  // Capital-loss clamp: losses cannot offset other income on terminal return (CRA T4011).
  const realizedCapitalGain = Math.max(0, input.nonRegBalance - input.nonRegACB);
  const taxableCapitalGain = calculateTaxableCapitalGainEnhanced(
    realizedCapitalGain,
    realizedCapitalGain
  );

  const taxInput: TaxCalculationInput = {
    year: input.year,
    owner: input.owner,
    province: input.province,
    age: input.age,
    employmentIncome: 0,
    pensionIncome: input.pensionIncome,
    rrifIncome: deemedDispositionIncome,
    cppIncome: input.cppIncome,
    oasIncome: input.oasIncome,
    otherIncome: input.otherIncome,
    interestIncome: 0,
    eligibleDividends: 0,
    nonEligibleDividends: 0,
    capitalGains: taxableCapitalGain,
    rrspContribution: 0,
    otherDeductions: 0,
  };
  if (input.inflationRate !== undefined) {
    taxInput.inflationRate = input.inflationRate;
  }
  if (input.indexingBaseYear !== undefined) {
    taxInput.indexingBaseYear = input.indexingBaseYear;
  }

  const taxResult = calculateTotalTax(taxInput);

  const terminalTaxes = taxResult.totalTax;
  const netEstate = grossEstate - terminalTaxes;

  return {
    year: input.year,
    triggeringOwner: input.owner,
    grossEstate,
    deemedDispositionIncome,
    realizedCapitalGain,
    taxableCapitalGain,
    terminalTaxes,
    netEstate,
    wasSpouseRolloverApplied: false,
  };
}
