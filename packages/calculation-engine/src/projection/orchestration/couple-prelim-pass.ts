/**
 * Couple preliminary-pass calculation.
 *
 * Encapsulates Step 1 of calculateCoupleYear: the three-way branch over
 *   - sharedRetirementSpending (one-spouse-retired surplus credit)
 *   - householdSpendingMode === 'household' (two-pass shortfall propagation)
 *   - default per-owner (independent calculatePersonYear calls)
 *
 * Extracted from couple-calculator.ts (Phase 11 plan 11-03 LOC cleanup, ENG-07).
 *
 * @see docs/source-of-truth/08-projection-engine.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { PersonYearlyResult } from '@retireops/shared';
import { calculatePersonYear, type PersonYearInput } from '../yearly-calculator.js';

export interface CouplePrelimInput {
  /** Pre-built per-person inputs (already enriched with spouseAge / spouseReceivingOAS / etc.) */
  primaryInput: PersonYearInput;
  spouseInput: PersonYearInput;
  /** Retirement status per person (so the helper can branch on the three-way cascade) */
  primaryIsRetired: boolean;
  spouseIsRetired: boolean;
  /** Household spending controls (passed through verbatim from CoupleYearInput) */
  sharedRetirementSpending?: number | undefined;
  householdSpendingMode?: 'per-owner' | 'household' | undefined;
}

export interface CouplePrelimOutput {
  primaryPrelim: PersonYearlyResult;
  spousePrelim: PersonYearlyResult;
  /** The (possibly mutated) spouseInput after household-credit propagation —
   *  caller does NOT need it currently, but exporting keeps the door open if
   *  a future debug helper wants visibility into the credit flow. */
  finalSpouseInput: PersonYearInput;
}

/**
 * Compute preliminary results for both spouses with household-spending semantics.
 *
 * Three branches (mutually exclusive):
 *   1. sharedRetirementSpending defined AND exactly one spouse retired:
 *      surplus credit flows from working spouse to retired spouse.
 *   2. householdSpendingMode === 'household' AND both spouses retired:
 *      two-pass shortfall propagation across spouses' accounts.
 *   3. Default per-owner: independent calculatePersonYear calls.
 */
export function computeCouplePrelim(input: CouplePrelimInput): CouplePrelimOutput {
  const {
    primaryInput,
    primaryIsRetired,
    spouseIsRetired,
    sharedRetirementSpending,
    householdSpendingMode,
  } = input;
  let { spouseInput } = input;

  let primaryPrelim: PersonYearlyResult;
  let spousePrelim: PersonYearlyResult;

  if (sharedRetirementSpending !== undefined && primaryIsRetired !== spouseIsRetired) {
    if (primaryIsRetired) {
      spousePrelim = calculatePersonYear(spouseInput);
      const spouseSurplus = Math.max(0, spousePrelim.netIncome - spousePrelim.livingExpenses);
      primaryPrelim = calculatePersonYear({
        ...primaryInput,
        householdSpendingCredit: spouseSurplus,
      });
    } else {
      primaryPrelim = calculatePersonYear(primaryInput);
      const primarySurplus = Math.max(0, primaryPrelim.netIncome - primaryPrelim.livingExpenses);
      spouseInput = { ...spouseInput, householdSpendingCredit: primarySurplus };
      spousePrelim = calculatePersonYear(spouseInput);
    }
  } else if (householdSpendingMode === 'household' && primaryIsRetired && spouseIsRetired) {
    // Household-pool branch: when both spouses are retired and the engine should
    // pool spending obligations across spouses' accounts.
    //
    // Two-pass strategy: run primary first; if primary's accounts couldn't fund
    // their full spending share (netCashFlow < 0), pass the unfunded gap to spouse
    // as a NEGATIVE householdSpendingCredit (which increases spouse's incomeGap
    // by exactly that amount in yearly-calculator). Spouse's drawdown waterfall
    // then pulls the extra from spouse's accounts in tax-efficient order.
    //
    // Then run the symmetric pass: if spouse comes back with their own shortfall
    // AND primary still has accounts, recompute primary with the spouse-shortfall
    // boost. This second pass is bounded — at most one re-run per side per year —
    // so it cannot loop. In well-funded households both shortfalls are zero and
    // results match the per-owner default.
    //
    // Note: tax precision is approximate. The transferred amount is primary's
    // post-tax shortfall (netCashFlow magnitude), but spouse pays tax on the
    // extra gross withdrawal. A future iteration can gross-up for spouse's
    // marginal rate; for the proof this under-funds slightly.
    primaryPrelim = calculatePersonYear(primaryInput);
    const primaryShortfall = Math.max(0, -primaryPrelim.netCashFlow);
    if (primaryShortfall > 0) {
      spouseInput = { ...spouseInput, householdSpendingCredit: -primaryShortfall };
    }
    spousePrelim = calculatePersonYear(spouseInput);

    // Symmetric: if spouse still has shortfall AND primary has unspent accounts,
    // re-run primary to absorb the spouse's gap.
    const spouseShortfall = Math.max(0, -spousePrelim.netCashFlow);
    const primaryHasAccounts =
      primaryPrelim.rrspBalance +
        primaryPrelim.rrifBalance +
        primaryPrelim.tfsaBalance +
        primaryPrelim.nonRegBalance >
      0;
    if (spouseShortfall > 0 && primaryHasAccounts) {
      primaryPrelim = calculatePersonYear({
        ...primaryInput,
        householdSpendingCredit: -spouseShortfall,
      });
    }
  } else {
    primaryPrelim = calculatePersonYear(primaryInput);
    spousePrelim = calculatePersonYear(spouseInput);
  }

  return { primaryPrelim, spousePrelim, finalSpouseInput: spouseInput };
}
