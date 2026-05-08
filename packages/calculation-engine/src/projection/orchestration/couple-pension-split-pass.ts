/**
 * Couple pension-split pass.
 *
 * Encapsulates Step 2 of calculateCoupleYear:
 *   (a) Engine-chosen pension splitting via findOptimalSplit + applyPensionSplit
 *       (when both spouses are 65+ AND optimizePensionSplitting is on).
 *   (b) TAX-03 user-chosen fixed splitting (D-08, D-09, D-10) — applied on top
 *       of (a) when incomeSplitting.enabled is true and both spouses are alive
 *       and retired.
 *
 * Returns the patched primaryFinal/spouseFinal plus the optimization telemetry
 * (pensionSplitPct, pensionSplitSavings, appliedSplitPercent, useFixedSplit).
 *
 * Extracted from couple-calculator.ts (Phase 11 plan 11-03 LOC cleanup, ENG-07).
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 * @see docs/source-of-truth/04-tax-engine.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { PersonYearlyResult, ProvinceCode, MaritalStatus } from '@retireops/shared';
import { findOptimalSplit, applyPensionSplit } from './pension-split-optimizer.js';
import { getEligiblePensionIncomeForSplitting } from '../pension-splitting-eligibility.js';

export interface CouplePensionSplitInput {
  primaryPrelim: PersonYearlyResult;
  spousePrelim: PersonYearlyResult;
  primaryAge: number;
  spouseAge: number;
  primaryProvince: ProvinceCode;
  spouseProvince: ProvinceCode;
  year: number;
  optimizePensionSplitting: boolean;
  incomeSplitting?: { enabled: boolean; splitPercent: number } | undefined;
  maritalStatus: MaritalStatus;
}

export interface CouplePensionSplitOutput {
  primaryFinal: PersonYearlyResult;
  spouseFinal: PersonYearlyResult;
  /** Engine-chosen optimal pct (0 if no optimization fired or no positive savings) */
  pensionSplitPct: number;
  /** Engine-computed dollar savings from the optimizer (0 if no optimization fired) */
  pensionSplitSavings: number;
  /** TAX-03 user-chosen pct, normalized to [0,1] (0 if useFixedSplit was false) */
  appliedSplitPercent: number;
  /** Whether the TAX-03 fixed split actually fired (gates pensionSplitPercentage emission downstream) */
  useFixedSplit: boolean;
}

export function computeCouplePensionSplit(
  input: CouplePensionSplitInput
): CouplePensionSplitOutput {
  const {
    primaryPrelim,
    spousePrelim,
    primaryAge,
    spouseAge,
    primaryProvince,
    spouseProvince,
    year,
    optimizePensionSplitting,
    incomeSplitting,
    maritalStatus,
  } = input;

  let pensionSplitPct = 0;
  let pensionSplitSavings = 0;
  let primaryFinal: PersonYearlyResult = primaryPrelim;
  let spouseFinal: PersonYearlyResult = spousePrelim;

  if (optimizePensionSplitting && primaryAge >= 65 && spouseAge >= 65) {
    // Calculate splittable income via the single-source-of-truth helper.
    // @see docs/source-of-truth/07-withdrawal-strategies.md - Eligible Pension Income
    const primarySplittable = getEligiblePensionIncomeForSplitting(primaryPrelim, primaryAge);
    const spouseSplittable = getEligiblePensionIncomeForSplitting(spousePrelim, spouseAge);

    // Determine higher-income spouse
    const primaryTaxable = primaryPrelim.taxCalculation.taxableIncome;
    const spouseTaxable = spousePrelim.taxCalculation.taxableIncome;

    // Calculate combined cost (tax + OAS clawback) before splitting
    const primaryCostBefore = primaryPrelim.taxesPaid + primaryPrelim.taxCalculation.oasClawback;
    const spouseCostBefore = spousePrelim.taxesPaid + spousePrelim.taxCalculation.oasClawback;
    const totalCostBefore = primaryCostBefore + spouseCostBefore;

    if (primaryTaxable > spouseTaxable && primarySplittable > 0) {
      // Primary has higher income, split to spouse
      pensionSplitPct = findOptimalSplit({
        higherPrelim: primaryPrelim,
        lowerPrelim: spousePrelim,
        higherProvince: primaryProvince,
        lowerProvince: spouseProvince,
        splittableIncome: primarySplittable,
        year,
        totalCostBefore,
      });

      if (pensionSplitPct > 0) {
        const splitAmount = primarySplittable * pensionSplitPct;
        const split = applyPensionSplit({
          direction: 'primary-to-spouse',
          primary: primaryPrelim,
          spouse: spousePrelim,
          primaryProvince,
          spouseProvince,
          splitAmount,
        });
        primaryFinal = split.primary;
        spouseFinal = split.spouse;
        pensionSplitSavings = totalCostBefore - split.totalCostAfter;
      }
    } else if (spouseTaxable > primaryTaxable && spouseSplittable > 0) {
      // Spouse has higher income, split to primary
      pensionSplitPct = findOptimalSplit({
        higherPrelim: spousePrelim,
        lowerPrelim: primaryPrelim,
        higherProvince: spouseProvince,
        lowerProvince: primaryProvince,
        splittableIncome: spouseSplittable,
        year,
        totalCostBefore,
      });

      if (pensionSplitPct > 0) {
        const splitAmount = spouseSplittable * pensionSplitPct;
        const split = applyPensionSplit({
          direction: 'spouse-to-primary',
          primary: primaryPrelim,
          spouse: spousePrelim,
          primaryProvince,
          spouseProvince,
          splitAmount,
        });
        primaryFinal = split.primary;
        spouseFinal = split.spouse;
        pensionSplitSavings = totalCostBefore - split.totalCostAfter;
      }
    }
  }

  // TAX-03: User-chosen fixed income splitting (D-08, D-09, D-10)
  // When incomeSplitting.enabled is true and both spouses are alive and retired,
  // move splitPercent of primary's eligible pension/RRIF income to the spouse's
  // taxable income and recompute taxes for both spouses.
  // This overrides the engine-computed optimizePensionSplitting when enabled.
  //
  // D-08 (M002-S01): Eligible base is delegated to getEligiblePensionIncomeForSplitting —
  // pensionIncome (RPP, always splittable), plus rrifWithdrawal and lifWithdrawal when 65+.
  // CPP/OAS/employment/RRSP remain explicitly ineligible.
  // D-09: Fixed percentage applied every eligible retirement year (no per-year optimization).
  // D-10: maritalStatus is set to 'single' in multi-year.ts when either spouse has died;
  //        so checking maritalStatus === 'married' is a reliable proxy for both spouses alive.
  let appliedSplitPercent = 0;

  const useFixedSplit =
    incomeSplitting?.enabled === true &&
    maritalStatus === 'married' &&
    primaryFinal.isRetired &&
    spouseFinal.isRetired;

  if (useFixedSplit) {
    // incomeSplitting is non-null when useFixedSplit is true (requires incomeSplitting?.enabled === true)

    const rawPct = incomeSplitting.splitPercent;
    const normalized = rawPct > 1 ? rawPct / 100 : rawPct;
    appliedSplitPercent = normalized;

    // D-08 (updated per M002-S01): eligible income = pensionIncome + rrifWithdrawal + lifWithdrawal
    // (CRA-age-gated inside helper). LIF was previously omitted here — this corrected the
    // inconsistency with the findOptimalSplit optimizer, which already used the same helper.
    const primaryEligible = getEligiblePensionIncomeForSplitting(primaryFinal, primaryAge);
    const splitAmount = primaryEligible * normalized;

    if (splitAmount > 0) {
      // TAX-03 stacks on top of the optimizer: pass primaryFinal/spouseFinal
      // (post-optimizer state), NOT the prelims. When direction is
      // 'primary-to-spouse', the helper sources transferor.totalGrossIncome /
      // livingExpenses from `primary` — which here is `primaryFinal` — matching
      // the field-by-field semantics of the original inline patch.
      const split = applyPensionSplit({
        direction: 'primary-to-spouse',
        primary: primaryFinal,
        spouse: spouseFinal,
        primaryProvince,
        spouseProvince,
        splitAmount,
      });
      primaryFinal = split.primary;
      spouseFinal = split.spouse;
      // Note: pensionSplitSavings is NOT updated here — TAX-03 is a user choice,
      // not an optimization, so the optimizer's savings telemetry remains
      // authoritative. appliedSplitPercent already captures the user's chosen
      // percentage and is emitted via pensionSplitPercentage at the caller.
    }
  }

  return {
    primaryFinal,
    spouseFinal,
    pensionSplitPct,
    pensionSplitSavings,
    appliedSplitPercent,
    useFixedSplit,
  };
}
