/**
 * Contribution-Room Ledger Schema Tests (M005/S01)
 * Covers: Zod round-trip for each schema; hard-reject boundary cases.
 */
import { describe, it, expect } from 'vitest';
import {
  contributionRoomLedgerSchema,
  ledgerYearInputSchema,
  ledgerWarningSchema,
  overContributionPenaltySchema,
} from './contribution-room.schema.js';
import type {
  ContributionRoomLedgerSchema,
  LedgerYearInputSchema,
} from './contribution-room.schema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validLedger: ContributionRoomLedgerSchema = {
  rrsp: { roomAvailable: 20000 },
  tfsa: { roomAvailable: 7000, cumulativeCapBaseline: 95000 },
  fhsa: { annualRoomRemaining: 8000, carryForwardAvailable: 0, lifetimeContributed: 0 },
};

const validYearInput: LedgerYearInputSchema = {
  year: 2025,
  person: 'primary',
  earnedIncome: 80000,
  pensionAdjustment: 0,
  rrspContribution: 5000,
  tfsaContribution: 7000,
  fhsaContribution: 8000,
};

// ---------------------------------------------------------------------------
// ledgerWarningSchema
// ---------------------------------------------------------------------------

describe('ledgerWarningSchema', () => {
  it('round-trips a valid warning', () => {
    const input = {
      year: 2025,
      person: 'primary' as const,
      accountType: 'rrsp' as const,
      kind: 'over-contribution' as const,
      message: 'Exceeded RRSP room by $500',
      penaltyAmount: 60,
    };
    expect(ledgerWarningSchema.parse(input)).toEqual(input);
  });

  it('rejects negative penaltyAmount', () => {
    expect(() =>
      ledgerWarningSchema.parse({
        year: 2025,
        person: 'primary',
        accountType: 'tfsa',
        kind: 'over-contribution',
        message: 'over',
        penaltyAmount: -1,
      })
    ).toThrow();
  });

  it('rejects invalid accountType', () => {
    expect(() =>
      ledgerWarningSchema.parse({
        year: 2025,
        person: 'primary',
        accountType: 'rrif',
        kind: 'over-contribution',
        message: 'over',
        penaltyAmount: 0,
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// overContributionPenaltySchema
// ---------------------------------------------------------------------------

describe('overContributionPenaltySchema', () => {
  it('round-trips a zero-penalty object', () => {
    const input = { rrsp: 0, tfsa: 0, fhsa: 0 };
    expect(overContributionPenaltySchema.parse(input)).toEqual(input);
  });

  it('round-trips non-zero penalties', () => {
    const input = { rrsp: 120, tfsa: 60, fhsa: 0 };
    expect(overContributionPenaltySchema.parse(input)).toEqual(input);
  });

  it('rejects negative rrsp penalty', () => {
    expect(() => overContributionPenaltySchema.parse({ rrsp: -1, tfsa: 0, fhsa: 0 })).toThrow();
  });

  it('rejects negative tfsa penalty', () => {
    expect(() => overContributionPenaltySchema.parse({ rrsp: 0, tfsa: -5, fhsa: 0 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// contributionRoomLedgerSchema
// ---------------------------------------------------------------------------

describe('contributionRoomLedgerSchema', () => {
  it('round-trips a valid ledger', () => {
    expect(contributionRoomLedgerSchema.parse(validLedger)).toEqual(validLedger);
  });

  it('round-trips a ledger with partial FHSA lifetime usage', () => {
    const input: ContributionRoomLedgerSchema = {
      ...validLedger,
      fhsa: { annualRoomRemaining: 0, carryForwardAvailable: 8000, lifetimeContributed: 32000 },
    };
    expect(contributionRoomLedgerSchema.parse(input)).toEqual(input);
  });

  it('rejects negative rrsp roomAvailable', () => {
    expect(() =>
      contributionRoomLedgerSchema.parse({
        ...validLedger,
        rrsp: { roomAvailable: -1 },
      })
    ).toThrow();
  });

  it('rejects negative tfsa roomAvailable', () => {
    expect(() =>
      contributionRoomLedgerSchema.parse({
        ...validLedger,
        tfsa: { roomAvailable: -100, cumulativeCapBaseline: 95000 },
      })
    ).toThrow();
  });

  it('rejects FHSA lifetimeContributed > 40000 (lifetime cap)', () => {
    expect(() =>
      contributionRoomLedgerSchema.parse({
        ...validLedger,
        fhsa: { annualRoomRemaining: 0, carryForwardAvailable: 0, lifetimeContributed: 40001 },
      })
    ).toThrow();
  });

  it('accepts FHSA lifetimeContributed exactly at the 40000 cap', () => {
    const input: ContributionRoomLedgerSchema = {
      ...validLedger,
      fhsa: { annualRoomRemaining: 0, carryForwardAvailable: 0, lifetimeContributed: 40000 },
    };
    expect(contributionRoomLedgerSchema.parse(input)).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// ledgerYearInputSchema
// ---------------------------------------------------------------------------

describe('ledgerYearInputSchema', () => {
  it('round-trips a valid year input', () => {
    expect(ledgerYearInputSchema.parse(validYearInput)).toEqual(validYearInput);
  });

  it('round-trips without optional residencyStartYear', () => {
    const input = { ...validYearInput };
    expect(ledgerYearInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a past residencyStartYear', () => {
    const input = { ...validYearInput, residencyStartYear: 2010 };
    expect(ledgerYearInputSchema.parse(input)).toEqual(input);
  });

  it('rejects negative pensionAdjustment', () => {
    expect(() =>
      ledgerYearInputSchema.parse({ ...validYearInput, pensionAdjustment: -1 })
    ).toThrow();
  });

  it('rejects negative rrspContribution', () => {
    expect(() =>
      ledgerYearInputSchema.parse({ ...validYearInput, rrspContribution: -500 })
    ).toThrow();
  });

  it('rejects negative tfsaContribution', () => {
    expect(() =>
      ledgerYearInputSchema.parse({ ...validYearInput, tfsaContribution: -1 })
    ).toThrow();
  });

  it('rejects negative fhsaContribution', () => {
    expect(() =>
      ledgerYearInputSchema.parse({ ...validYearInput, fhsaContribution: -1 })
    ).toThrow();
  });

  it('rejects negative earnedIncome', () => {
    expect(() => ledgerYearInputSchema.parse({ ...validYearInput, earnedIncome: -1 })).toThrow();
  });

  it('rejects residencyStartYear in the future', () => {
    expect(() =>
      ledgerYearInputSchema.parse({
        ...validYearInput,
        residencyStartYear: new Date().getFullYear() + 1,
      })
    ).toThrow();
  });
});
