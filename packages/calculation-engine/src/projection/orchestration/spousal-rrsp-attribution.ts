/**
 * Spousal-RRSP attribution: FIFO ledger consumption + tax recomputation.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Two named exports:
 *
 *   - applyFifoAttribution: FIFO consumption of the ledger; mutates entries
 *     in place (reduces amounts, splices fully-consumed entries) and returns
 *     the attributed amount. Re-exported from multi-year.ts to preserve the
 *     public surface.
 *
 *   - applySpousalAttributionRecompute: orchestrates the full per-year flow.
 *     Computes the spouse's total RRSP+RRIF withdrawal, runs FIFO attribution,
 *     and (if attribution > 0) recomputes taxes for both spouses with the
 *     attributed amount shifted from annuitant to contributor. Returns either
 *     the patched CoupleYearlyResult or `undefined` if no recomputation was
 *     needed (caller falls through to the original `result`).
 *
 * @see docs/source-of-truth/02-account-types.md - VR-RRSP-003
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type {
  CoupleYearlyResult,
  ProvinceCode,
  SpousalRRSPLedger,
  ProjectionInput,
} from '@retireops/shared';
import type { PersonBalancesSnapshot } from './account-rollover.js';
import { recalculateTaxWithSpousalAttribution } from '../couple-calculator.js';

/**
 * Apply FIFO attribution rules to a spousal RRSP withdrawal.
 * VR-RRSP-003: contributions within year N, N+1, N+2 attribute back to contributor.
 * Mutates ledger in place (reduces amounts, splices fully-consumed entries).
 * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
 */
export function applyFifoAttribution(
  ledger: SpousalRRSPLedger,
  totalWithdrawal: number,
  currentYear: number
): number {
  if (ledger.length === 0 || totalWithdrawal <= 0) return 0;

  let remaining = totalWithdrawal;
  let attributed = 0;

  for (const entry of ledger) {
    if (remaining <= 0) break;
    const consume = Math.min(remaining, entry.amount);
    if (currentYear <= entry.year + 2) {
      attributed += consume;
    }
    entry.amount -= consume;
    remaining -= consume;
  }

  // Remove fully-consumed entries in place
  let i = ledger.length - 1;
  while (i >= 0) {
    const entry = ledger[i];
    if (entry !== undefined && entry.amount <= 0) ledger.splice(i, 1);
    i--;
  }

  return attributed;
}

export interface SpousalAttributionRecomputeArgs {
  spousalRrspLedger: SpousalRRSPLedger;
  spouseBalances: PersonBalancesSnapshot;
  result: CoupleYearlyResult;
  year: number;
  primaryProvince: ProvinceCode;
  spouseProvince: ProvinceCode;
}

/**
 * Returns the patched CoupleYearlyResult when attribution applied, OR undefined
 * when no recompute was needed (no ledger entries, no spouse withdrawal, or
 * zero attribution).
 */
export function applySpousalAttributionRecompute(
  args: SpousalAttributionRecomputeArgs
): CoupleYearlyResult | undefined {
  const { spousalRrspLedger, spouseBalances, result, year, primaryProvince, spouseProvince } = args;

  if (spousalRrspLedger.length === 0) return undefined;
  const totalSpouseRRSPStart = spouseBalances.rrsp + spouseBalances.rrif;
  const totalSpouseRRSPEnd = result.spouse.rrspBalance + result.spouse.rrifBalance;
  const totalSpouseWithdrawal = Math.max(0, totalSpouseRRSPStart - totalSpouseRRSPEnd);
  if (totalSpouseWithdrawal <= 0) return undefined;

  const attributedAmount = applyFifoAttribution(spousalRrspLedger, totalSpouseWithdrawal, year);
  if (attributedAmount <= 0) return undefined;

  // CORR-03 / SCEN-07: shift attributed amount from annuitant to contributor for
  // tax purposes. The existing reporting-only mutation (spousalRRSPAttributedIncome
  // on both spouses) is preserved; tax math is now also adjusted by recomputing
  // both spouses' totalTax via recalculateTaxWithSpousalAttribution, then patching
  // taxesPaid / taxCalculation / netIncome / netCashFlow.
  //
  // WR-01: when pension splitting fired in the same year, the prelim's
  // pensionIncome / rrifWithdrawal fields on result.primary / result.spouse are
  // PRE-SPLIT (couple-calculator.ts only patches taxesPaid / taxCalculation /
  // netIncome / netCashFlow / pensionIncomeTransferred / pensionIncomeReceived).
  // Without re-applying the split here, the attribution recompute would silently
  // undo it. Derive the signed split delta from the existing reporting fields:
  //   delta = received - transferred
  // No split that year → both fields are 0 → delta = 0 (backward compatible).
  const primarySplitDelta =
    (result.primary.pensionIncomeReceived ?? 0) - (result.primary.pensionIncomeTransferred ?? 0);
  const spouseSplitDelta =
    (result.spouse.pensionIncomeReceived ?? 0) - (result.spouse.pensionIncomeTransferred ?? 0);
  const spouseAdjustedTax = recalculateTaxWithSpousalAttribution(
    result.spouse,
    -attributedAmount,
    spouseProvince,
    spouseSplitDelta
  );
  const primaryAdjustedTax = recalculateTaxWithSpousalAttribution(
    result.primary,
    +attributedAmount,
    primaryProvince,
    primarySplitDelta
  );
  return {
    ...result,
    primary: {
      ...result.primary,
      spousalRRSPAttributedIncome: attributedAmount,
      taxesPaid: primaryAdjustedTax.totalTax,
      taxCalculation: primaryAdjustedTax,
      netIncome: result.primary.totalGrossIncome - primaryAdjustedTax.totalTax,
      netCashFlow:
        result.primary.totalGrossIncome -
        primaryAdjustedTax.totalTax -
        result.primary.livingExpenses,
    },
    spouse: {
      ...result.spouse,
      spousalRRSPAttributedIncome: 0,
      taxesPaid: spouseAdjustedTax.totalTax,
      taxCalculation: spouseAdjustedTax,
      netIncome: result.spouse.totalGrossIncome - spouseAdjustedTax.totalTax,
      netCashFlow:
        result.spouse.totalGrossIncome - spouseAdjustedTax.totalTax - result.spouse.livingExpenses,
    },
  };
}

/**
 * Append a primary-to-spouse spousal-RRSP contribution to the ledger if
 * the deposit landed (cappedSpousalPart > 0). Wrapped here so the caller
 * doesn't need to inline the entry shape.
 */
export function appendSpousalRRSPLedgerEntry(
  ledger: SpousalRRSPLedger,
  year: number,
  cappedSpousalPart: number
): void {
  if (cappedSpousalPart > 0) {
    ledger.push({
      year,
      annuitant: 'spouse',
      contributor: 'primary',
      amount: cappedSpousalPart,
    });
  }
}

// Helper input type re-export for caller convenience.
export type { ProjectionInput };
