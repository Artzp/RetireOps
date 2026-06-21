/**
 * Bracket-fill RRSP withdrawal + surplus sweep helper.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Implements TAX-05 / BKF-02 through BKF-07: opportunistically draws from
 * RRSP up to the top of the current federal bracket (capped by annualCap)
 * when the resulting OAS clawback cost is <= the tax savings (BKF-03 gate).
 * Surplus over incomeGap is swept into TFSA room first, then non-reg.
 *
 * SWEEP DEPOSIT TIMING (audit B-09): the surplus sweep amounts are RETURNED,
 * not deposited here. The caller defers the deposit until AFTER applyGrowthStep
 * so the swept amount earns no same-year growth — matching the D-18 end-of-year
 * deposit convention used by surplus-handling.ts (allocate_surplus). Depositing
 * pre-growth would have given the swept surplus a year of growth the routed
 * surplus never receives.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - TAX-05
 * @see docs/source-of-truth/06-investment-engine.md - end-of-year deposit timing (D-18)
 * @see .planning/phases/63-bracket-fill-engine-surplus-sweep/63-CONTEXT.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import {
  getFederalTaxBrackets,
  getFederalMarginalRate,
  getOASClawbackThreshold,
} from '../../tax/index.js';

export interface BracketFillConfig {
  enabled: boolean;
  bracketTarget?: 'current' | 'next';
  annualCap?: number;
}

export interface BracketFillBalances {
  currentRRSP: number;
  currentTFSA: number;
  currentNonReg: number;
}

/**
 * Result of applyBracketFill. The RRSP withdrawal is applied to `balances`
 * in place; the surplus sweep deposits are RETURNED so the caller can defer
 * them until after applyGrowthStep (D-18 — audit B-09).
 */
export interface BracketFillResult {
  /** RRSP→taxable withdrawal applied this year (0 if disabled / no fill). */
  bracketFillWithdrawal: number;
  /** Surplus to deposit into TFSA AFTER growth (post-growth, D-18). */
  sweepTfsaDeposit: number;
  /** Surplus to deposit into non-reg AFTER growth (post-growth, D-18). */
  sweepNonRegDeposit: number;
}

export interface BracketFillInput {
  isRetired: boolean;
  config: BracketFillConfig | undefined;
  year: number;
  pensionIncome: number;
  cppIncome: number;
  oasIncome: number;
  rrifWithdrawal: number;
  meltdownRRSPWithdrawal: number;
  otherIncome: number;
  incomeGap: number;
  availableTfsaContributionRoom: number | undefined;
}

/**
 * Apply bracket-fill withdrawal + compute the surplus sweep. The RRSP
 * withdrawal is applied to `balances` in place; the sweep TFSA/non-reg
 * deposits are RETURNED for the caller to apply AFTER growth (D-18, audit
 * B-09) — they are NOT deposited into `balances` here.
 */
export function applyBracketFill(
  balances: BracketFillBalances,
  input: BracketFillInput
): BracketFillResult {
  let bracketFillWithdrawal = 0;
  if (input.isRetired && input.config?.enabled && balances.currentRRSP > 0) {
    const guaranteedIncome =
      input.pensionIncome +
      input.cppIncome +
      input.oasIncome +
      input.rrifWithdrawal +
      input.meltdownRRSPWithdrawal +
      input.otherIncome;
    const brackets = getFederalTaxBrackets(input.year);
    const currentBracket = brackets.find(
      (b) => guaranteedIncome >= b.min && guaranteedIncome < b.max
    );
    if (currentBracket) {
      const bracketSpace = currentBracket.max - guaranteedIncome;
      if (bracketSpace > 0) {
        // MLT-03: OAS clawback gate (BKF-03)
        const threshold = getOASClawbackThreshold(input.year);
        const clawbackCost = 0.15 * Math.max(0, guaranteedIncome + bracketSpace - threshold);
        const marginalRate = getFederalMarginalRate(guaranteedIncome, input.year);
        const taxSavings = bracketSpace * marginalRate;
        if (clawbackCost <= taxSavings) {
          let fillAmount = bracketSpace;
          if (input.config.annualCap !== undefined) {
            fillAmount = Math.min(fillAmount, input.config.annualCap);
          }
          bracketFillWithdrawal = Math.min(fillAmount, balances.currentRRSP);
          balances.currentRRSP -= bracketFillWithdrawal;
        }
      }
    }
  }

  // Surplus sweep (SWEEP-01, SWEEP-02, SWEEP-03). Compute the TFSA-first /
  // non-reg-second split, but DO NOT deposit here — return the amounts so the
  // caller applies them AFTER growth (D-18, audit B-09).
  const surplusFromBracketFill = Math.max(0, bracketFillWithdrawal - input.incomeGap);
  const tfsaRoomForSweep = input.availableTfsaContributionRoom ?? 0;
  const sweepTfsaDeposit = Math.min(surplusFromBracketFill, tfsaRoomForSweep);
  const sweepNonRegDeposit = surplusFromBracketFill - sweepTfsaDeposit;

  return { bracketFillWithdrawal, sweepTfsaDeposit, sweepNonRegDeposit };
}
