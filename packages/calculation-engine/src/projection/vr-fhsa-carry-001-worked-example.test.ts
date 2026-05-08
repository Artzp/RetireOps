/**
 * VR-FHSA-CARRY-001 Worked Example — FHSA Carry-Forward Mechanic
 *
 * K012 cent-exact parity test. Every number in the VR-FHSA-CARRY-001 Worked Example
 * table (docs/source-of-truth/17-contribution-room.md) is asserted here. Numbers were
 * derived from the pure applyContributionRoomYear helper output. A test failure means
 * the doc table has drifted from engine output — fix the table, not the engine.
 *
 * Three sub-scenarios (all call applyContributionRoomYear directly for precision):
 *   (c1a) Annual absorb: fresh start, $8k contribution → room=0, no penalty.
 *   (c1b) Carry-forward absorb: $8k carry + $16k contribution → room=0, no penalty.
 *   (c2)  Over-contribution: $8k carry + $16,001 contribution → penalty=0.12, kind='over-contribution'.
 *   (c3)  Lifetime cap: seed=$36k + $8k contribution → penalty=$480, kind='lifetime-cap-exceeded'.
 *
 * Cross-reference: FHSA-001 ($8k annual), FHSA-002 ($40k lifetime)
 * @see docs/source-of-truth/17-contribution-room.md — VR-FHSA-CARRY-001
 * @see docs/source-of-truth/02-account-types.md — FHSA-001, FHSA-002
 */
import { describe, it, expect } from 'vitest';
import { applyContributionRoomYear } from './contribution-room-ledger.js';
import type { ContributionRoomLedger } from '@retireops/shared';

/** Build an initial FHSA ledger with specified carry-forward and lifetime seed. */
function makeFhsaLedger(
  carryForwardAvailable: number,
  lifetimeContributed: number
): ContributionRoomLedger {
  return {
    rrsp: { roomAvailable: 0 },
    tfsa: { roomAvailable: 0, cumulativeCapBaseline: 0 },
    fhsa: {
      annualRoomRemaining: 8_000,
      carryForwardAvailable,
      lifetimeContributed,
    },
  };
}

/** Base LedgerYearInput shared across FHSA sub-scenarios. Zero earnedIncome so RRSP and TFSA branches have no effect. */
const BASE_INPUT = {
  year: 2026,
  person: 'primary' as const,
  earnedIncome: 0,
  pensionAdjustment: 0,
  rrspContribution: 0,
  tfsaContribution: 0,
};

describe('VR-FHSA-CARRY-001 — FHSA carry-forward mechanic (M005/S05 T03 PARITY)', () => {
  describe('(c1a) Annual absorb — fresh start, $8k contribution consumes full annual limit', () => {
    const ledger0 = makeFhsaLedger(0, 0);
    const { newLedger, warnings, penalty } = applyContributionRoomYear(ledger0, {
      ...BASE_INPUT,
      fhsaContribution: 8_000,
    });

    it('annualRoomRemaining = 0.00 after full annual absorb (doc table row: c1a)', () => {
      expect(newLedger.fhsa.annualRoomRemaining).toBeCloseTo(0, 2);
    });

    it('carryForwardAvailable = 0.00 (fully used, no carry-forward generated)', () => {
      expect(newLedger.fhsa.carryForwardAvailable).toBeCloseTo(0, 2);
    });

    it('lifetimeContributed = 8000.00', () => {
      expect(newLedger.fhsa.lifetimeContributed).toBeCloseTo(8_000, 2);
    });

    it('no penalty, no warnings', () => {
      expect(penalty.fhsa).toBeCloseTo(0, 6);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('(c1b) Carry-forward absorb — $8k carry allows $16k single-year contribution', () => {
    // Year-0: contribute $0 to build carry-forward.
    const ledger0 = makeFhsaLedger(0, 0);
    const { newLedger: ledger1 } = applyContributionRoomYear(ledger0, {
      ...BASE_INPUT,
      fhsaContribution: 0,
    });

    // Year-1: $8k carry from year-0, contribute $16k (single-year cap = $16k).
    const { newLedger, warnings, penalty } = applyContributionRoomYear(ledger1, {
      ...BASE_INPUT,
      year: 2027,
      fhsaContribution: 16_000,
    });

    it('year-0 carry-forward = 8000.00 (unused annual room carries into year-1)', () => {
      expect(ledger1.fhsa.carryForwardAvailable).toBeCloseTo(8_000, 2);
    });

    it('annualRoomRemaining = 0.00 after $16k absorb (doc table row: c1b)', () => {
      expect(newLedger.fhsa.annualRoomRemaining).toBeCloseTo(0, 2);
    });

    it('carryForwardAvailable = 0.00 (all room consumed)', () => {
      expect(newLedger.fhsa.carryForwardAvailable).toBeCloseTo(0, 2);
    });

    it('lifetimeContributed = 16000.00', () => {
      expect(newLedger.fhsa.lifetimeContributed).toBeCloseTo(16_000, 2);
    });

    it('no penalty, no warnings', () => {
      expect(penalty.fhsa).toBeCloseTo(0, 6);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('(c2) Over-contribution — carry=$8k + $16,001 triggers $0.12 penalty', () => {
    // Build $8k carry-forward from year-0 zero-contribution, then over-contribute by $1.
    const ledger0 = makeFhsaLedger(0, 0);
    const { newLedger: ledger1 } = applyContributionRoomYear(ledger0, {
      ...BASE_INPUT,
      fhsaContribution: 0,
    });

    const { newLedger, warnings, penalty } = applyContributionRoomYear(ledger1, {
      ...BASE_INPUT,
      year: 2027,
      fhsaContribution: 16_001,
    });

    it('penalty.fhsa = 0.12 (1 over × 1%/month × 12 months, doc table row: c2)', () => {
      expect(penalty.fhsa).toBeCloseTo(0.12, 6);
    });

    it('penalty.rrsp = 0, penalty.tfsa = 0 (only fhsa branch triggered)', () => {
      expect(penalty.rrsp).toBe(0);
      expect(penalty.tfsa).toBe(0);
    });

    it("warning kind = 'over-contribution' (not 'lifetime-cap-exceeded')", () => {
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.kind).toBe('over-contribution');
      expect(warnings[0]!.accountType).toBe('fhsa');
      expect(warnings[0]!.penaltyAmount).toBeCloseTo(0.12, 6);
    });

    it('lifetimeContributed = 16000.00 (only the effective room consumed, not the over-amount)', () => {
      // consumed = min(contribution, effectiveRoom) = min(16001, 16000) = 16000
      expect(newLedger.fhsa.lifetimeContributed).toBeCloseTo(16_000, 2);
    });
  });

  describe('(c3) Lifetime cap exceeded — seed=$36k + $8k triggers $480 lifetime-cap-exceeded penalty', () => {
    // Effective room = min(8000 annual, $40k - $36k lifetime remaining) = min(8000, 4000) = 4000.
    // Over-amount = $8k − $4k = $4k. Penalty = 4000 × 1% × 12 = $480.
    const ledger0 = makeFhsaLedger(0, 36_000);
    const { newLedger, warnings, penalty } = applyContributionRoomYear(ledger0, {
      ...BASE_INPUT,
      fhsaContribution: 8_000,
    });

    it('penalty.fhsa = 480.00 (4000 over × 1%/month × 12 months, doc table row: c3)', () => {
      expect(penalty.fhsa).toBeCloseTo(480, 2);
    });

    it("warning kind = 'lifetime-cap-exceeded' (lifetime breach takes precedence over over-contribution)", () => {
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.kind).toBe('lifetime-cap-exceeded');
      expect(warnings[0]!.accountType).toBe('fhsa');
      expect(warnings[0]!.penaltyAmount).toBeCloseTo(480, 2);
    });

    it('lifetimeContributed = 40000.00 (capped at lifetime limit, not 44000)', () => {
      // consumed = min(8000, 4000 effective) = 4000. lifetime = min(40000, 36000+4000) = 40000.
      expect(newLedger.fhsa.lifetimeContributed).toBeCloseTo(40_000, 2);
    });
  });
});
