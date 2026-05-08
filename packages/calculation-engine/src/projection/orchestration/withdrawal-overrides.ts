/**
 * Withdrawal-override injection helper.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Applies all active withdrawal overrides for the current year BEFORE the
 * drawdown waterfall; mutates the passed-in `accounts` (balances) and `accs`
 * (withdrawal accumulators). Returns tiersToSkip for the drawdown loop and
 * the sidecar metadata object. Emits A5/A6 warnings into
 * overrideWarningsAccumulator when provided.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-09, D-10, D-11, D-12, D-14, D-22
 * @see docs/source-of-truth/07-withdrawal-strategies.md - OVER-01, OVER-04
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type {
  OverrideMetadata,
  OverrideFieldMetadata,
  OverrideWarning,
  WithdrawalOverrideField,
} from '@retireops/shared';

import { processNonRegisteredWithdrawal } from '../../accounts/non-registered.js';
import {
  resolveActiveWithdrawalOverride,
  inflateToNominal,
  type WithdrawalOverrideInput,
} from '../overrides.js';

export interface WithdrawalOverrideAccounts {
  currentRRSP: number;
  currentRRIF: number;
  currentTFSA: number;
  currentNonReg: number;
  currentNonRegACB: number;
  currentLIF: number;
  lifMaximumAllowed: number;
  rrifMandatoryMinimum: number;
}

export interface WithdrawalOverrideAccumulators {
  rrspWithdrawal: number;
  rrifAdditional: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
  lifAdditional: number;
}

export interface ApplyWithdrawalOverridesResult {
  overridesMetadata: OverrideMetadata;
  tiersToSkip: Set<string>;
  overrideTotalTowardsSpending: number;
  surplusFromOverrides: number;
}

/**
 * Applies all active withdrawal overrides for the current year BEFORE the drawdown waterfall.
 * Mutates `accounts` (balances) and `accs` (withdrawal accumulators) in place.
 *
 * Returns tiersToSkip for the drawdown loop and the sidecar metadata object.
 * Emits A5/A6 warnings into overrideWarningsAccumulator when provided.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-09, D-10, D-11, D-12, D-14, D-22
 * @see docs/source-of-truth/07-withdrawal-strategies.md - OVER-01, OVER-04
 */
export function applyWithdrawalOverrides(
  year: number,
  yearsFromProjectionStart: number,
  inflationRate: number,
  incomeGap: number,
  sortedOverrides: ReadonlyArray<WithdrawalOverrideInput> | undefined,
  accounts: WithdrawalOverrideAccounts,
  accs: WithdrawalOverrideAccumulators,
  warningsAccumulator: OverrideWarning[] | undefined
): ApplyWithdrawalOverridesResult {
  const overridesMetadata: OverrideMetadata = {};
  const tiersToSkip = new Set<string>();
  let overrideTotalTowardsSpending = 0;

  if (!sortedOverrides || sortedOverrides.length === 0) {
    return {
      overridesMetadata,
      tiersToSkip,
      overrideTotalTowardsSpending,
      surplusFromOverrides: 0,
    };
  }

  // The 5 override-eligible fields (D-01)
  const fields: WithdrawalOverrideField[] = ['rrsp', 'rrif', 'tfsa', 'nonreg', 'lif'];

  for (const field of fields) {
    const active = resolveActiveWithdrawalOverride(field, year, sortedOverrides);
    if (!active) continue;

    // D-06: inflate real → nominal
    const requestedNominal = inflateToNominal(
      active.amount,
      inflationRate,
      yearsFromProjectionStart
    );

    let actualWithdrawn = 0;
    let clamped = false;

    if (field === 'rrsp') {
      const available = accounts.currentRRSP;
      actualWithdrawn = Math.min(requestedNominal, available);
      clamped = actualWithdrawn < requestedNominal - 0.01; // D-11
      accs.rrspWithdrawal += actualWithdrawn;
      accounts.currentRRSP -= actualWithdrawn;
      tiersToSkip.add('rrsp'); // D-09
      overridesMetadata.rrspWithdrawal = {
        source: 'override',
        requestedReal: active.amount,
        requestedNominal,
        actual: actualWithdrawn,
        clamped,
      } satisfies OverrideFieldMetadata;
    } else if (field === 'rrif') {
      // Assumption A5: raise to mandatory minimum if override < minimum
      const mandatory = accounts.rrifMandatoryMinimum;
      let intended = requestedNominal;
      if (intended < mandatory - 0.01) {
        warningsAccumulator?.push({
          code: 'override_below_rrif_minimum',
          year,
          context: { requestedNominal: Math.round(intended), minimum: Math.round(mandatory) },
        });
        intended = mandatory; // silently raise (A5)
      }
      // Note: mandatory minimum was already deducted from currentRRIF before this pass.
      // We only need additional RRIF here (above the mandatory minimum already taken).
      const alreadyTaken = mandatory;
      const additionalNeeded = Math.max(0, intended - alreadyTaken);
      const availableAdditional = accounts.currentRRIF;
      const additionalTaken = Math.min(additionalNeeded, availableAdditional);
      clamped = intended > alreadyTaken + availableAdditional + 0.01; // D-11
      actualWithdrawn = alreadyTaken + additionalTaken; // total RRIF for override accounting
      accs.rrifAdditional += additionalTaken;
      accounts.currentRRIF -= additionalTaken;
      tiersToSkip.add('rrif'); // D-09
      overridesMetadata.rrifWithdrawal = {
        source: 'override',
        requestedReal: active.amount,
        requestedNominal,
        actual: actualWithdrawn,
        clamped,
      } satisfies OverrideFieldMetadata;
    } else if (field === 'tfsa') {
      const available = accounts.currentTFSA;
      actualWithdrawn = Math.min(requestedNominal, available);
      clamped = actualWithdrawn < requestedNominal - 0.01; // D-11
      accs.tfsaWithdrawal += actualWithdrawn;
      accounts.currentTFSA -= actualWithdrawn;
      tiersToSkip.add('tfsa'); // D-09
      overridesMetadata.tfsaWithdrawal = {
        source: 'override',
        requestedReal: active.amount,
        requestedNominal,
        actual: actualWithdrawn,
        clamped,
      } satisfies OverrideFieldMetadata;
    } else if (field === 'nonreg') {
      const available = accounts.currentNonReg;
      actualWithdrawn = Math.min(requestedNominal, available);
      clamped = actualWithdrawn < requestedNominal - 0.01; // D-11
      // Non-reg: compute capital gains on withdrawal (same logic as withdrawFrom)
      if (actualWithdrawn > 0) {
        const unrealizedGains = Math.max(0, accounts.currentNonReg - accounts.currentNonRegACB);
        const cgResult = processNonRegisteredWithdrawal(
          actualWithdrawn,
          accounts.currentNonReg,
          accounts.currentNonRegACB,
          unrealizedGains
        );
        accs.nonRegRealizedGain += cgResult.realizedGain;
        accs.nonRegTaxableGain += cgResult.taxableGain;
        accounts.currentNonRegACB = cgResult.newACB;
      }
      accs.nonRegWithdrawal += actualWithdrawn;
      accounts.currentNonReg -= actualWithdrawn;
      tiersToSkip.add('nonReg'); // D-09 — canonical drawdown key is 'nonReg'
      overridesMetadata.nonRegWithdrawal = {
        source: 'override',
        requestedReal: active.amount,
        requestedNominal,
        actual: actualWithdrawn,
        clamped,
      } satisfies OverrideFieldMetadata;
    } else {
      // field === 'lif'
      // Assumption A6: cap to lifMaximumAllowed (when > 0; 0 means no LIF in this path)
      const lifMax = accounts.lifMaximumAllowed;
      const cappedNominal = lifMax > 0 ? Math.min(requestedNominal, lifMax) : requestedNominal;
      if (requestedNominal > lifMax + 0.01 && lifMax > 0) {
        warningsAccumulator?.push({
          code: 'lif_override_exceeds_maximum',
          year,
          context: { requestedNominal: Math.round(requestedNominal), maximum: Math.round(lifMax) },
        });
      }
      const available = accounts.currentLIF;
      actualWithdrawn = Math.min(cappedNominal, available);
      clamped = actualWithdrawn < cappedNominal - 0.01; // D-11
      accs.lifAdditional += actualWithdrawn;
      accounts.currentLIF -= actualWithdrawn;
      tiersToSkip.add('lif'); // D-09
      overridesMetadata.lifWithdrawal = {
        source: 'override',
        requestedReal: active.amount,
        requestedNominal,
        actual: actualWithdrawn,
        clamped,
      } satisfies OverrideFieldMetadata;
    }

    // Accumulate towards spending (capped at incomeGap — surplus handled by Plan 05)
    overrideTotalTowardsSpending += actualWithdrawn;
  }

  // D-10: override contribution towards gap capped at incomeGap; excess is surplus
  const surplusFromOverrides = Math.max(0, overrideTotalTowardsSpending - incomeGap);
  overrideTotalTowardsSpending = Math.min(overrideTotalTowardsSpending, incomeGap);

  return { overridesMetadata, tiersToSkip, overrideTotalTowardsSpending, surplusFromOverrides };
}
