/**
 * Bracket-fill RRSP withdrawal + surplus sweep helper.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Implements TAX-05 / BKF-02 through BKF-07: opportunistically draws from
 * RRSP up to the top of the current federal bracket (capped by annualCap)
 * when the resulting OAS clawback cost is <= the tax savings (BKF-03 gate).
 * Surplus over incomeGap is swept into TFSA room first, then non-reg.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - TAX-05
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
 * Apply bracket-fill withdrawal + surplus sweep. Mutates `balances` in place.
 * Returns the bracketFillWithdrawal amount (0 if disabled or no fill happened).
 */
export function applyBracketFill(balances: BracketFillBalances, input: BracketFillInput): number {
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

  // Surplus sweep (SWEEP-01, SWEEP-02, SWEEP-03)
  const surplusFromBracketFill = Math.max(0, bracketFillWithdrawal - input.incomeGap);
  const tfsaRoomForSweep = input.availableTfsaContributionRoom ?? 0;
  const tfsaDeposit = Math.min(surplusFromBracketFill, tfsaRoomForSweep);
  const nonRegDeposit = surplusFromBracketFill - tfsaDeposit;
  balances.currentTFSA += tfsaDeposit;
  balances.currentNonReg += nonRegDeposit;

  return bracketFillWithdrawal;
}
