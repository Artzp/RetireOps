/**
 * VR-ROOM-PENALTY-001 Worked Example — Over-Contribution Penalty Math (Composite)
 *
 * K012 cent-exact parity test. Every number in the VR-ROOM-PENALTY-001 Worked Example
 * table (docs/source-of-truth/17-contribution-room.md) is asserted here. Numbers were
 * derived from the pure applyContributionRoomYear helper output. A test failure means
 * the doc table has drifted from engine output — fix the table, not the engine.
 *
 * Composite Scenario C: a single ledger year where primary simultaneously over-contributes
 * to RRSP, TFSA, and FHSA, surfacing three independent 1%/month penalty assessments.
 *
 *   RRSP: year accrual = $18k (100k × 18%), buffer = $2k, over by $5k → penalty = $600
 *   TFSA: year limit = $7k (2026), over by $1k               → penalty = $120
 *   FHSA: single-year cap = $8k, over by $1                  → penalty = $0.12
 *
 * @see docs/source-of-truth/17-contribution-room.md — VR-ROOM-PENALTY-001
 * @see docs/source-of-truth/02-account-types.md — RRSP Over-Contribution, FHSA-001, FHSA-002
 */
import { describe, it, expect } from 'vitest';
import { applyContributionRoomYear } from './contribution-room-ledger.js';
import type { ContributionRoomLedger } from '@retireops/shared';

/**
 * Fresh ledger for composite penalty scenario.
 * RRSP prior carry = 0; TFSA prior carry = 0; FHSA carry = 0, lifetime = 0.
 */
const COMPOSITE_LEDGER: ContributionRoomLedger = {
  rrsp: { roomAvailable: 0 },
  tfsa: { roomAvailable: 0, cumulativeCapBaseline: 0 },
  fhsa: {
    annualRoomRemaining: 8_000,
    carryForwardAvailable: 0,
    lifetimeContributed: 0,
  },
};

describe('VR-ROOM-PENALTY-001 — composite over-contribution penalty (M005/S05 T03 PARITY)', () => {
  /**
   * Contributions chosen to trigger all three account-type penalties simultaneously.
   *
   * RRSP: accrual = min(100000 × 0.18, 32490) = 18000. Buffer = 2000.
   *       contribution = 18000 + 2000 + 5000 = 25000 → over by 5000 → penalty = 600.
   *
   * TFSA: 2026 limit = 7000. Prior carry = 0. Room = 7000.
   *       contribution = 8000 → over by 1000 → penalty = 120.
   *
   * FHSA: carry = 0. Single-year cap = 8000.
   *       contribution = 8001 → over by 1 → penalty = 0.12, kind = 'over-contribution'.
   */
  const { warnings, penalty } = applyContributionRoomYear(COMPOSITE_LEDGER, {
    year: 2026,
    person: 'primary',
    earnedIncome: 100_000,
    pensionAdjustment: 0,
    rrspContribution: 25_000, // 18000 accrual + 2000 buffer + 5000 extra
    tfsaContribution: 8_000, // 7000 room + 1000 over
    fhsaContribution: 8_001, // 8000 cap + 1 over
  });

  it('penalty.rrsp = 600.00 (5000 over × 1%/month × 12 months, doc table row: RRSP)', () => {
    expect(penalty.rrsp).toBeCloseTo(600, 2);
  });

  it('penalty.tfsa = 120.00 (1000 over × 1%/month × 12 months, doc table row: TFSA)', () => {
    expect(penalty.tfsa).toBeCloseTo(120, 2);
  });

  it('penalty.fhsa = 0.12 (1 over × 1%/month × 12 months, doc table row: FHSA)', () => {
    expect(penalty.fhsa).toBeCloseTo(0.12, 6);
  });

  it('three ledgerWarnings entries — one per accountType', () => {
    expect(warnings).toHaveLength(3);
  });

  it('rrsp warning is present with correct fields', () => {
    const rrspWarn = warnings.find((w) => w.accountType === 'rrsp');
    expect(rrspWarn).toBeDefined();
    expect(rrspWarn!.kind).toBe('over-contribution');
    expect(rrspWarn!.person).toBe('primary');
    expect(rrspWarn!.year).toBe(2026);
    expect(rrspWarn!.penaltyAmount).toBeCloseTo(600, 2);
  });

  it('tfsa warning is present with correct fields', () => {
    const tfsaWarn = warnings.find((w) => w.accountType === 'tfsa');
    expect(tfsaWarn).toBeDefined();
    expect(tfsaWarn!.kind).toBe('over-contribution');
    expect(tfsaWarn!.person).toBe('primary');
    expect(tfsaWarn!.year).toBe(2026);
    expect(tfsaWarn!.penaltyAmount).toBeCloseTo(120, 2);
  });

  it('fhsa warning is present with correct fields', () => {
    const fhsaWarn = warnings.find((w) => w.accountType === 'fhsa');
    expect(fhsaWarn).toBeDefined();
    expect(fhsaWarn!.kind).toBe('over-contribution');
    expect(fhsaWarn!.person).toBe('primary');
    expect(fhsaWarn!.year).toBe(2026);
    expect(fhsaWarn!.penaltyAmount).toBeCloseTo(0.12, 6);
  });
});
