/**
 * Contribution-Room Ledger — isolation unit tests (M005/S01).
 *
 * Proves pure carry-forward math across multiple years for RRSP / TFSA / FHSA
 * branches without any projection-loop wiring. All inputs are constructed inline.
 *
 * @see docs/source-of-truth/02-account-types.md
 */
import { describe, expect, it } from 'vitest';
import { FHSA_LIMITS, TFSA_ANNUAL_LIMITS } from '@retireops/shared';
import type { ContributionRoomLedger, LedgerYearInput } from '@retireops/shared';
import { applyContributionRoomYear } from './contribution-room-ledger.js';

const emptyLedger = (): ContributionRoomLedger => ({
  rrsp: { roomAvailable: 0 },
  tfsa: { roomAvailable: 0, cumulativeCapBaseline: 0 },
  fhsa: {
    annualRoomRemaining: FHSA_LIMITS.annualLimit,
    carryForwardAvailable: 0,
    lifetimeContributed: 0,
  },
});

const baseInput = (overrides: Partial<LedgerYearInput> = {}): LedgerYearInput => ({
  year: 2025,
  person: 'primary',
  earnedIncome: 0,
  pensionAdjustment: 0,
  rrspContribution: 0,
  tfsaContribution: 0,
  fhsaContribution: 0,
  ...overrides,
});

describe('applyContributionRoomYear — RRSP branch', () => {
  it('rolls 18%-earned-income forward and subtracts pension adjustment with zero floor', () => {
    // 100000 earned income × 18% = 18000 accrual; PA 2000 ⇒ 16000 new room.
    const { newLedger, warnings, penalty } = applyContributionRoomYear(
      emptyLedger(),
      baseInput({ earnedIncome: 100000, pensionAdjustment: 2000, rrspContribution: 5000 })
    );
    expect(newLedger.rrsp.roomAvailable).toBe(11000); // 16000 − 5000
    expect(warnings).toHaveLength(0);
    expect(penalty.rrsp).toBe(0);
  });

  it('floors PA-reduced accrual at zero when PA exceeds the 18%-earned-income cap', () => {
    const { newLedger } = applyContributionRoomYear(
      emptyLedger(),
      baseInput({ earnedIncome: 10000, pensionAdjustment: 5000 })
    );
    // 10000×18% = 1800 accrual; PA 5000 ⇒ max(0, 1800 − 5000) = 0.
    expect(newLedger.rrsp.roomAvailable).toBe(0);
  });

  it('carries unused RRSP room across years', () => {
    let ledger = emptyLedger();
    // Year 1: accrue 18000, contribute 0 ⇒ 18000 forward.
    ledger = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2024, earnedIncome: 100000 })
    ).newLedger;
    expect(ledger.rrsp.roomAvailable).toBe(18000);
    // Year 2: accrue 9000 more, contribute 7000 ⇒ 18000 + 9000 − 7000 = 20000.
    ledger = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2025, earnedIncome: 50000, rrspContribution: 7000 })
    ).newLedger;
    expect(ledger.rrsp.roomAvailable).toBe(20000);
  });

  it('applies 1%/month penalty past the 2000 buffer on over-contribution', () => {
    // Room = 0; contribute 5000 ⇒ over = 5000 − 0 − 2000 = 3000; penalty = 3000 × 12%.
    const { warnings, penalty, newLedger } = applyContributionRoomYear(
      emptyLedger(),
      baseInput({ rrspContribution: 5000 })
    );
    expect(penalty.rrsp).toBeCloseTo(360, 6);
    expect(newLedger.rrsp.roomAvailable).toBe(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.accountType).toBe('rrsp');
    expect(warnings[0]?.kind).toBe('over-contribution');
    expect(warnings[0]?.penaltyAmount).toBeCloseTo(360, 6);
  });

  it('charges no penalty when contribution is within the 2000 buffer', () => {
    const { warnings, penalty } = applyContributionRoomYear(
      emptyLedger(),
      baseInput({ rrspContribution: 2000 })
    );
    expect(penalty.rrsp).toBe(0);
    expect(warnings.filter((w) => w.accountType === 'rrsp')).toHaveLength(0);
  });
});

describe('applyContributionRoomYear — TFSA branch', () => {
  it('adds the annual statutory limit to the residency-sliced baseline each year', () => {
    const ledger = emptyLedger();
    ledger.tfsa.roomAvailable = 10000; // simulate a residency-sliced baseline
    const { newLedger } = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2025, tfsaContribution: 0 })
    );
    // 10000 + 7000 (2025 annual limit).
    expect(newLedger.tfsa.roomAvailable).toBe(10000 + (TFSA_ANNUAL_LIMITS[2025] ?? 0));
  });

  it('holds flat at the latest known year when year is out of range', () => {
    const ledger = emptyLedger();
    const { newLedger } = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2099, tfsaContribution: 0 })
    );
    // Should use latest TFSA_ANNUAL_LIMITS value (2025 at time of writing).
    expect(newLedger.tfsa.roomAvailable).toBeGreaterThan(0);
  });

  it('applies 1%/month penalty with zero buffer on over-contribution', () => {
    // Room 0 + 7000 annual = 7000; contribute 10000 ⇒ over 3000; penalty = 360.
    const { warnings, penalty, newLedger } = applyContributionRoomYear(
      emptyLedger(),
      baseInput({ year: 2025, tfsaContribution: 10000 })
    );
    expect(penalty.tfsa).toBeCloseTo(360, 6);
    expect(newLedger.tfsa.roomAvailable).toBe(0);
    expect(warnings.filter((w) => w.accountType === 'tfsa')).toHaveLength(1);
  });

  it('preserves cumulativeCapBaseline across years', () => {
    let ledger = emptyLedger();
    ledger.tfsa.cumulativeCapBaseline = 88000;
    ledger = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2025, tfsaContribution: 5000 })
    ).newLedger;
    expect(ledger.tfsa.cumulativeCapBaseline).toBe(88000);
    ledger = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2026, tfsaContribution: 0 })
    ).newLedger;
    expect(ledger.tfsa.cumulativeCapBaseline).toBe(88000);
  });
});

describe('applyContributionRoomYear — FHSA branch', () => {
  it('tracks carry-forward capped at 8000 across years', () => {
    let ledger = emptyLedger();
    // Year 1: contribute 0; full 8000 rolls forward.
    ledger = applyContributionRoomYear(ledger, baseInput({ year: 2024 })).newLedger;
    expect(ledger.fhsa.carryForwardAvailable).toBe(8000);

    // Year 2: 8000 annual + 8000 carry = 16000 participation room. Contribute 0 ⇒ unused=16000,
    // carry-forward capped at 8000.
    ledger = applyContributionRoomYear(ledger, baseInput({ year: 2025 })).newLedger;
    expect(ledger.fhsa.carryForwardAvailable).toBe(8000);

    // Year 3: contribute 8000 of the 16000 pool; carry-out = min(8000, 8000 unused) = 8000.
    ledger = applyContributionRoomYear(
      ledger,
      baseInput({ year: 2026, fhsaContribution: 8000 })
    ).newLedger;
    expect(ledger.fhsa.carryForwardAvailable).toBe(8000);
    expect(ledger.fhsa.lifetimeContributed).toBe(8000);
  });

  it('honors the 16000 single-year cap (annual + one year carry)', () => {
    const ledger = emptyLedger();
    ledger.fhsa.carryForwardAvailable = 8000; // maxed carry-in
    // Participation room = min(16000, 8000+8000) = 16000. Contribute 16000 ⇒ no over.
    const { warnings, penalty, newLedger } = applyContributionRoomYear(
      ledger,
      baseInput({ fhsaContribution: 16000 })
    );
    expect(penalty.fhsa).toBe(0);
    expect(warnings.filter((w) => w.accountType === 'fhsa')).toHaveLength(0);
    expect(newLedger.fhsa.lifetimeContributed).toBe(16000);
    expect(newLedger.fhsa.carryForwardAvailable).toBe(0);
    expect(newLedger.fhsa.annualRoomRemaining).toBe(0);
  });

  it('penalizes contributions that exceed the 16000 single-year cap', () => {
    const ledger = emptyLedger();
    ledger.fhsa.carryForwardAvailable = 8000;
    const { warnings, penalty } = applyContributionRoomYear(
      ledger,
      baseInput({ fhsaContribution: 20000 })
    );
    // Over = 20000 − 16000 = 4000; penalty = 4000 × 12%.
    expect(penalty.fhsa).toBeCloseTo(480, 6);
    expect(warnings.filter((w) => w.accountType === 'fhsa')).toHaveLength(1);
    expect(warnings[0]?.kind).toBe('over-contribution');
  });

  it('enforces the 40000 lifetime cap with a lifetime-cap-exceeded warning', () => {
    const ledger = emptyLedger();
    ledger.fhsa.lifetimeContributed = 36000; // 4000 remaining lifetime
    ledger.fhsa.carryForwardAvailable = 0;
    const { warnings, penalty, newLedger } = applyContributionRoomYear(
      ledger,
      baseInput({ fhsaContribution: 8000 })
    );
    // Effective room = min(8000, 4000) = 4000; over = 8000 − 4000 = 4000; penalty = 480.
    expect(penalty.fhsa).toBeCloseTo(480, 6);
    expect(warnings.filter((w) => w.kind === 'lifetime-cap-exceeded')).toHaveLength(1);
    expect(newLedger.fhsa.lifetimeContributed).toBe(FHSA_LIMITS.lifetimeLimit);
  });

  it('does not mutate the input ledger (K005 reference persistence)', () => {
    const ledger = emptyLedger();
    const snapshot: ContributionRoomLedger = JSON.parse(JSON.stringify(ledger));
    const { newLedger } = applyContributionRoomYear(
      ledger,
      baseInput({ rrspContribution: 1000, tfsaContribution: 1000, fhsaContribution: 1000 })
    );
    expect(ledger).toEqual(snapshot);
    expect(newLedger).not.toBe(ledger);
    expect(newLedger.rrsp).not.toBe(ledger.rrsp);
    expect(newLedger.tfsa).not.toBe(ledger.tfsa);
    expect(newLedger.fhsa).not.toBe(ledger.fhsa);
  });
});

describe('applyContributionRoomYear — purity', () => {
  it('is deterministic for identical inputs across repeated calls', () => {
    const ledger = emptyLedger();
    ledger.tfsa.roomAvailable = 5000;
    ledger.fhsa.carryForwardAvailable = 4000;
    const input = baseInput({
      earnedIncome: 75000,
      pensionAdjustment: 1500,
      rrspContribution: 3000,
      tfsaContribution: 2000,
      fhsaContribution: 5000,
    });
    const r1 = applyContributionRoomYear(ledger, input);
    const r2 = applyContributionRoomYear(ledger, input);
    expect(r1).toEqual(r2);
  });
});
