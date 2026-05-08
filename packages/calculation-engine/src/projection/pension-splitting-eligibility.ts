/**
 * Pension Income Splitting — Eligibility Helper
 *
 * Single source of truth for the CRA-eligible pension income amount that may be
 * split between spouses on form T1032. Used by both the engine-driven optimizer
 * (findOptimalSplit) and the user-chosen fixed-split override in
 * couple-calculator.ts so the two code paths cannot drift apart.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md — Pension Income Splitting Integration
 * @see docs/source-of-truth/04-tax-engine.md — Eligible Pension Income
 *
 * Branch rules (CRA T1032):
 *   - Under age 65: only lifetime annuity payments from a Registered Pension
 *     Plan (RPP) are eligible. RRIF and LIF withdrawals are NOT eligible until
 *     the recipient turns 65.
 *   - Age 65 and over: RRIF withdrawals, LIF withdrawals, and RPP/annuity
 *     payments are all eligible.
 *
 * M002 assumption: `PersonYearlyResult.pensionIncome` represents an RPP life
 * annuity payment at any age. This is the only kind of `pensionIncome` the
 * engine currently models, so it is treated as eligible regardless of age.
 * Cross-reference VR-TAX-PSPLIT-001 (to be authored in S03) will pin this
 * assumption to the source-of-truth doc.
 */
import type { PersonYearlyResult } from '@retireops/shared';

export function getEligiblePensionIncomeForSplitting(
  person: PersonYearlyResult,
  age: number
): number {
  if (age < 65) {
    return person.pensionIncome;
  }
  return person.rrifWithdrawal + (person.lifWithdrawal ?? 0) + person.pensionIncome;
}
