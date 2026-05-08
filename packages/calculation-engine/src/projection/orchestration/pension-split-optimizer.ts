/**
 * Pension-split optimizer (Phase 11 plan 11-01 LOC cleanup, ENG-07).
 *
 * Two named exports lifted out of couple-calculator.ts:
 *
 *   - findOptimalSplit: 51-iteration sweep (splitPct = 0.00, 0.01, ..., 0.50)
 *     that picks the cost-minimizing pension-income split between the higher-
 *     and lower-income spouse. Skips candidates that would push the receiving
 *     spouse over the OAS clawback threshold. Returns 0 when no positive split
 *     produces a saving over the supplied baseline (totalCostBefore).
 *
 *   - recalculateTaxWithPensionSplit: re-runs calculateTotalTax for one spouse
 *     after a signed split adjustment is applied to their pension/RRIF income.
 *     Carries forward realized capital gains so non-reg withdrawals stay
 *     correctly taxed (D-11). Re-exported from couple-calculator.ts to preserve
 *     the public surface consumed by orchestration/spousal-rrsp-attribution.ts.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 * @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { PersonYearlyResult, ProvinceCode } from '@retireops/shared';
import { calculateTotalTax, type TaxCalculationInput } from '../../tax/index.js';
import { getOASClawbackThreshold } from '../../tax/oas-clawback.js';

/**
 * Recalculate taxes with pension income splitting adjustment.
 *
 * Pension splitting only affects pension/RRIF income — non-reg capital gains are unchanged.
 * We carry forward the realized capital gains from the preliminary calculation so the
 * recalculated tax correctly reflects actual non-reg withdrawals. (D-11)
 *
 * Note: capitalGains here is the raw realized gain; calculateTotalTax applies the inclusion
 * rate (standard or enhanced via processNonRegWithdrawal) internally.
 */
export function recalculateTaxWithPensionSplit(
  result: PersonYearlyResult,
  splitAdjustment: number,
  province: ProvinceCode
) {
  // Adjust pension income for tax purposes
  const adjustedPensionIncome = result.pensionIncome + result.rrifWithdrawal + splitAdjustment;

  const taxInput: TaxCalculationInput = {
    year: result.year,
    owner: result.owner,
    province,
    age: result.age,
    employmentIncome: result.employmentIncome,
    pensionIncome: Math.max(0, adjustedPensionIncome),
    rrifIncome: 0, // Already included in adjustedPensionIncome
    cppIncome: result.cppIncome,
    oasIncome: result.oasIncome,
    otherIncome: 0,
    interestIncome: result.taxCalculation.interestIncome ?? 0,
    eligibleDividends: result.taxCalculation.dividendIncomeEligible,
    nonEligibleDividends: result.taxCalculation.dividendIncomeNonEligible,
    // D-11: carry forward realized capital gains from preliminary calculation (was hardcoded 0)
    // Pension splitting does not change non-reg withdrawals; this ensures the recalculated tax
    // correctly includes the capital gains tax on non-reg account withdrawals.
    capitalGains: result.taxCalculation.capitalGains,
    rrspContribution: 0,
    otherDeductions: 0,
  };

  return calculateTotalTax(taxInput);
}

/**
 * Find the optimal split percentage using actual tax calculations, including OAS
 * clawback on the receiving spouse. Replaces the simplified approximation and
 * ensures we never recommend a split that triggers clawback on the receiver.
 *
 * 51-iteration sweep: splitPct = 0.00, 0.01, ..., 0.50 (51 candidate points).
 * Returns 0 when no positive split improves on the supplied totalCostBefore baseline.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting Integration
 * @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
 */
export function findOptimalSplit(args: {
  higherPrelim: PersonYearlyResult;
  lowerPrelim: PersonYearlyResult;
  higherProvince: ProvinceCode;
  lowerProvince: ProvinceCode;
  splittableIncome: number;
  year: number;
  totalCostBefore: number;
}): number {
  const {
    higherPrelim,
    lowerPrelim,
    higherProvince,
    lowerProvince,
    splittableIncome,
    year,
    totalCostBefore,
  } = args;

  if (splittableIncome <= 0) return 0;

  // OAS clawback threshold for this year
  const clawbackThreshold = getOASClawbackThreshold(year);

  let bestSplit = 0;
  let bestTotalCost = Infinity;

  for (let splitPct = 0; splitPct <= 0.5; splitPct += 0.01) {
    const splitAmount = splittableIncome * splitPct;

    const higherResult = recalculateTaxWithPensionSplit(higherPrelim, -splitAmount, higherProvince);
    const lowerResult = recalculateTaxWithPensionSplit(lowerPrelim, splitAmount, lowerProvince);

    // Guard: do not split if it pushes the receiving spouse over the OAS clawback threshold
    // @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
    if (lowerResult.netIncome > clawbackThreshold && lowerPrelim.oasIncome > 0) {
      // This split would trigger/increase OAS clawback for the receiving spouse — skip
      continue;
    }

    // Total cost = combined tax + combined OAS clawback
    const totalCost =
      higherResult.totalTax +
      higherResult.oasClawback +
      lowerResult.totalTax +
      lowerResult.oasClawback;

    if (totalCost < bestTotalCost) {
      bestTotalCost = totalCost;
      bestSplit = splitPct;
    }
  }

  // Only return a split that actually saves money
  return bestTotalCost < totalCostBefore ? bestSplit : 0;
}

// ---------------------------------------------------------------------------
// applyPensionSplit — Phase 11 plan 11-02 helper.
//
// Replaces the three near-duplicate pension-split application blocks in
// calculateCoupleYear (primary-higher branch, spouse-higher branch, TAX-03
// fixed-percentage branch) with a single parameterized function. Caller owns
// (a) the amount derivation (optimizer pct × splittable, OR fixed pct × eligible)
// and (b) the pensionSplitSavings telemetry; this helper performs only the
// mechanical "apply the split, recompute taxes for both spouses, patch the
// result objects" work.
// ---------------------------------------------------------------------------

export interface PensionSplitInput {
  /** Which spouse transfers income to the other */
  direction: 'primary-to-spouse' | 'spouse-to-primary';
  /** Pre-split snapshots (helper does not mutate these) */
  primary: PersonYearlyResult;
  spouse: PersonYearlyResult;
  /** Provinces (used for tax recompute on each side) */
  primaryProvince: ProvinceCode;
  spouseProvince: ProvinceCode;
  /** Dollar amount transferred (positive). Caller computes from optimizer-pct × splittable
   *  OR from fixed-pct × eligible. */
  splitAmount: number;
}

export interface PensionSplitOutput {
  primary: PersonYearlyResult;
  spouse: PersonYearlyResult;
  /** Sum of (totalTax + oasClawback) across both spouses AFTER the split.
   *  Caller subtracts from totalCostBefore for pensionSplitSavings emission
   *  (only the optimizer paths use this — TAX-03 ignores it). */
  totalCostAfter: number;
}

/**
 * Apply a pension-income split between primary and spouse, recomputing taxes
 * for both sides. Used by:
 *   - calculateCoupleYear's optimizer branches (after findOptimalSplit picks the pct)
 *   - calculateCoupleYear's TAX-03 fixed-percentage branch (after the caller
 *     computes `eligible × normalized`)
 *
 * Caller owns the amount derivation and the pensionSplitSavings telemetry.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
export function applyPensionSplit(input: PensionSplitInput): PensionSplitOutput {
  const { direction, primary, spouse, primaryProvince, spouseProvince, splitAmount } = input;

  // Identify transferor and receiver based on direction
  const transferor = direction === 'primary-to-spouse' ? primary : spouse;
  const receiver = direction === 'primary-to-spouse' ? spouse : primary;
  const transferorProvince = direction === 'primary-to-spouse' ? primaryProvince : spouseProvince;
  const receiverProvince = direction === 'primary-to-spouse' ? spouseProvince : primaryProvince;

  // Recompute taxes (transferor loses splitAmount, receiver gains splitAmount)
  const transferorAdjusted = recalculateTaxWithPensionSplit(
    transferor,
    -splitAmount,
    transferorProvince
  );
  const receiverAdjusted = recalculateTaxWithPensionSplit(receiver, splitAmount, receiverProvince);

  // Patch transferor (loses income, gets credit for the transfer in pensionIncomeTransferred)
  const patchedTransferor: PersonYearlyResult = {
    ...transferor,
    pensionIncomeTransferred: splitAmount,
    taxesPaid: transferorAdjusted.totalTax,
    taxCalculation: transferorAdjusted,
    netIncome: transferor.totalGrossIncome - transferorAdjusted.totalTax,
    netCashFlow:
      transferor.totalGrossIncome - transferorAdjusted.totalTax - transferor.livingExpenses,
  };

  // Patch receiver (gains income, gets credit in pensionIncomeReceived)
  const patchedReceiver: PersonYearlyResult = {
    ...receiver,
    pensionIncomeReceived: splitAmount,
    taxesPaid: receiverAdjusted.totalTax,
    taxCalculation: receiverAdjusted,
    netIncome: receiver.totalGrossIncome - receiverAdjusted.totalTax,
    netCashFlow: receiver.totalGrossIncome - receiverAdjusted.totalTax - receiver.livingExpenses,
  };

  // Re-pair patches back to primary/spouse identities for the caller
  const patchedPrimary = direction === 'primary-to-spouse' ? patchedTransferor : patchedReceiver;
  const patchedSpouse = direction === 'primary-to-spouse' ? patchedReceiver : patchedTransferor;

  const totalCostAfter =
    patchedPrimary.taxesPaid +
    patchedPrimary.taxCalculation.oasClawback +
    patchedSpouse.taxesPaid +
    patchedSpouse.taxCalculation.oasClawback;

  return {
    primary: patchedPrimary,
    spouse: patchedSpouse,
    totalCostAfter,
  };
}
