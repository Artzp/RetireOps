/**
 * Unit tests for the pure Non-Registered withdrawal strategy.
 *
 * Phase 9 Wave 2 (09-05): proves `withdrawFromNonReg` matches the locked
 * strategy contract from 09-01 and preserves the byte-identical behavior
 * of the inline Non-Reg blocks previously living inside `withdrawFrom` and
 * `withdrawFromP` in `yearly-calculator.ts`.
 *
 * SCOPE NOTE: This strategy handles ONLY Non-Registered WITHDRAWALS. Non-Reg
 * contributions and growth (`processNonRegContribution`, `applyNonRegGrowth`)
 * remain in the orchestrator — they are deposit / growth-side concerns, not
 * strategy concerns.
 *
 * CARDINAL PROPERTIES (ENG-04 carry-forward from CORR-02 / Phase 8 LIMS-01b):
 *   - `gainsRealized` = RAW realized gain (pre-50%-inclusion). The caller
 *     rolls this into `taxInput.capitalGains` so the tax engine applies the
 *     federal inclusion rate downstream.
 *   - `taxableIncome` = post-inclusion taxable gain (50% standard, 66.7%
 *     above the $250K D-10 threshold). Used by GIS/clawback income
 *     computations that already expect the inclusion-adjusted figure.
 *   - `newACB` populated — only strategy where this matters.
 *   - `state.annualCapGainsSoFar` (default 0) drives the D-10 enhanced
 *     inclusion threshold for multi-account couple-path scenarios.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-05-PLAN.md
 * @see .planning/phases/08-correctness-gaps/08-VERIFICATION.md - LIMS-01b / CORR-02
 * @see docs/source-of-truth/02-account-types.md - TC-ACCT-005
 * @see docs/source-of-truth/04-tax-engine.md - capital-gains inclusion
 */
import { describe, it, expect } from 'vitest';

import { withdrawFromNonReg } from './non-reg.js';
import type { WithdrawalRequest, AccountState } from './index.js';
import { processNonRegisteredWithdrawal } from '../../accounts/non-registered.js';

describe('strategies/non-reg — withdrawFromNonReg (Phase 9 Wave 2 / 09-05)', () => {
  it('happy-path: realized gain via CRA pro-rata; 50% inclusion below $250K', () => {
    // Test 1: balance=100,000, acb=60,000 → unrealizedGain = 40,000.
    // Withdrawing 10,000 realizes 10,000 × (40,000 / 100,000) = 4,000 of gain.
    // Below the $250K D-10 threshold → standard 50% inclusion → taxableGain = 2,000.
    // newACB = 60,000 × (90,000 / 100,000) = 54,000.
    const request: WithdrawalRequest = { requestedAmount: 10000, year: 2026, age: 65 };
    const state: AccountState = { balance: 100000, acb: 60000, annualCapGainsSoFar: 0 };

    const result = withdrawFromNonReg(request, state);

    expect(result.actualWithdrawn).toBe(10000);
    expect(result.clamped).toBe(false);
    expect(result.gainsRealized).toBeCloseTo(4000, 2);
    expect(result.taxableIncome).toBeCloseTo(2000, 2);
    expect(result.newBalance).toBe(90000);
    expect(result.newACB).toBeCloseTo(54000, 2);
  });

  it('clamp-to-balance: requested > balance returns balance with clamped=true', () => {
    // Test 2: balance=5,000, acb=2,000 → unrealizedGain = 3,000.
    // Withdrawing all 5,000 (clamped from 10,000 request) realizes the full 3,000 gain.
    // Pro-rata: 5,000 × (3,000 / 5,000) = 3,000. Standard 50% inclusion → 1,500.
    // newACB = 2,000 × (0 / 5,000) = 0 (account drained).
    const request: WithdrawalRequest = { requestedAmount: 10000, year: 2026, age: 65 };
    const state: AccountState = { balance: 5000, acb: 2000, annualCapGainsSoFar: 0 };

    const result = withdrawFromNonReg(request, state);

    expect(result.actualWithdrawn).toBe(5000);
    expect(result.clamped).toBe(true);
    expect(result.gainsRealized).toBeCloseTo(3000, 2);
    expect(result.taxableIncome).toBeCloseTo(1500, 2);
    expect(result.newBalance).toBe(0);
    expect(result.newACB).toBeCloseTo(0, 2);
  });

  it('ENG-04 capital-gain inclusion: taxableIncome ≈ gainsRealized × 0.5 below $250K threshold', () => {
    // Test 3: ENG-04 carry-forward from CORR-02 (Phase 8 LIMS-01b).
    // For any request that produces realizedGain > 0 with annualCapGainsSoFar = 0
    // and realizedGain ≤ 250,000, the strategy's taxableIncome MUST equal
    // gainsRealized × 0.5 (standard federal inclusion rate). Cap-gains tax fires.
    // This pins the LIMS-01b semantics at the strategy level (the scenario.test.ts
    // analog is `LIMS-01b: capital gains tax fires on realized non-reg gains`).
    const request: WithdrawalRequest = { requestedAmount: 50000, year: 2026, age: 65 };
    const state: AccountState = { balance: 200000, acb: 100000, annualCapGainsSoFar: 0 };

    const result = withdrawFromNonReg(request, state);

    expect(result.gainsRealized).toBeGreaterThan(0);
    expect(result.taxableIncome).toBeGreaterThan(0); // cap-gains tax fires
    expect(result.taxableIncome).toBeCloseTo(result.gainsRealized * 0.5, 2);
  });

  it('D-10 enhanced inclusion: taxableIncome > gainsRealized × 0.5 when prior gains push past $250K', () => {
    // Test 4: D-10 enhanced inclusion threshold (multi-account couple-path scenario).
    // balance=300,000, acb=0 → all 300,000 unrealized.
    // Withdrawing all 300,000 realizes 300,000 of gain.
    // annualCapGainsSoFar = 200,000 → totalAnnualGains = 500,000.
    // Standard room remaining: max(0, 250,000 - 200,000) = 50,000.
    // Standard portion: min(300,000, 50,000) = 50,000 at 50% = 25,000.
    // Enhanced portion: 300,000 - 50,000 = 250,000 at 66.67% ≈ 166,675.
    // Total taxableGain ≈ 191,675 — well above 300,000 × 0.5 = 150,000.
    // The exact arithmetic lives inside `processNonRegisteredWithdrawal`; the
    // test asserts the threshold fired, not the precise value.
    const request: WithdrawalRequest = { requestedAmount: 300000, year: 2026, age: 65 };
    const state: AccountState = { balance: 300000, acb: 0, annualCapGainsSoFar: 200000 };

    const result = withdrawFromNonReg(request, state);

    expect(result.gainsRealized).toBeCloseTo(300000, 2);
    // Enhanced inclusion fired — taxableIncome must exceed standard 50% by a clear margin.
    expect(result.taxableIncome).toBeGreaterThan(result.gainsRealized * 0.5);
  });

  it('zero balance: returns 0 / clamped=true / no gain / acb preserved at 0', () => {
    // Test 5: behavior parity with the inline `if (take <= 0) return 0` guard.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 65 };
    const state: AccountState = { balance: 0, acb: 0, annualCapGainsSoFar: 0 };

    const result = withdrawFromNonReg(request, state);

    expect(result.actualWithdrawn).toBe(0);
    expect(result.clamped).toBe(true); // requested (5000) > balance (0)
    expect(result.gainsRealized).toBe(0);
    expect(result.taxableIncome).toBe(0);
    expect(result.newBalance).toBe(0);
    expect(result.newACB).toBe(0);
  });

  it('zero request: returns 0 / clamped=false / balance + acb preserved', () => {
    // Test 6: zero-request guard — caller asked for nothing, got nothing.
    // NOT clamped (0 is not greater than balance).
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 65 };
    const state: AccountState = { balance: 10000, acb: 5000, annualCapGainsSoFar: 0 };

    const result = withdrawFromNonReg(request, state);

    expect(result.actualWithdrawn).toBe(0);
    expect(result.clamped).toBe(false); // requested (0) is NOT > balance (10000)
    expect(result.gainsRealized).toBe(0);
    expect(result.taxableIncome).toBe(0);
    expect(result.newBalance).toBe(10000); // untouched
    expect(result.newACB).toBe(5000); // untouched
  });

  it('delegation parity: wrapper output matches processNonRegisteredWithdrawal exactly', () => {
    // Test 7: the strategy MUST delegate to processNonRegisteredWithdrawal — no drift.
    // For a fixed test case, the wrapper's (gainsRealized, taxableIncome, newACB) must
    // equal the helper's (realizedGain, taxableGain, newACB) exactly. This proves the
    // wrapper does not introduce arithmetic drift relative to the underlying account-helper,
    // which remains the single source of truth for non-reg withdrawal mechanics.
    const balance = 80000;
    const acb = 50000;
    const requestedAmount = 20000;
    const annualCapGainsSoFar = 0;

    const unrealizedGains = Math.max(0, balance - acb);
    const helperResult = processNonRegisteredWithdrawal(
      requestedAmount,
      balance,
      acb,
      unrealizedGains,
      annualCapGainsSoFar
    );

    const request: WithdrawalRequest = { requestedAmount, year: 2026, age: 65 };
    const state: AccountState = { balance, acb, annualCapGainsSoFar };
    const wrapperResult = withdrawFromNonReg(request, state);

    expect(wrapperResult.gainsRealized).toBe(helperResult.realizedGain);
    expect(wrapperResult.taxableIncome).toBe(helperResult.taxableGain);
    expect(wrapperResult.newACB).toBe(helperResult.newACB);
    // And the strategy-level fields:
    expect(wrapperResult.actualWithdrawn).toBe(requestedAmount);
    expect(wrapperResult.newBalance).toBe(balance - requestedAmount);
  });

  it('purity: does not mutate frozen inputs', () => {
    // Test 8: engine-purity contract from 09-01 — strategies MUST NOT mutate
    // their `request` or `state` arguments. Object.freeze provides a runtime
    // tripwire: any `state.balance = ...` or similar would throw in strict mode.
    const request: WithdrawalRequest = Object.freeze({
      requestedAmount: 10000,
      year: 2026,
      age: 65,
    });
    const state: AccountState = Object.freeze({
      balance: 100000,
      acb: 60000,
      annualCapGainsSoFar: 0,
    });

    expect(() => withdrawFromNonReg(request, state)).not.toThrow();

    const result = withdrawFromNonReg(request, state);
    expect(result.newBalance).toBe(90000);
    // Inputs untouched.
    expect(request.requestedAmount).toBe(10000);
    expect(state.balance).toBe(100000);
    expect(state.acb).toBe(60000);
  });
});
