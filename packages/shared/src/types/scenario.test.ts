import { describe, expect, it } from 'vitest';
import { ScenarioDecisionsSchema, WithdrawalOverrideField } from './scenario.js';

describe('ScenarioDecisionsSchema — bracketFill', () => {
  it('parses bracketFill with enabled only', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      bracketFill: { enabled: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bracketFill?.enabled).toBe(true);
    }
  });

  it('parses bracketFill with all fields', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      bracketFill: {
        enabled: true,
        bracketTarget: 'current',
        annualCap: 50000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bracketFill).toEqual({
        enabled: true,
        bracketTarget: 'current',
        annualCap: 50000,
      });
    }
  });

  it('accepts partial bracketFill (enabled false, no optional fields)', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      bracketFill: { enabled: false },
    });
    expect(result.success).toBe(true);
  });

  it('rejects bracketFill with negative annualCap', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      bracketFill: { enabled: true, annualCap: -1000 },
    });
    expect(result.success).toBe(false);
  });

  it('omitting bracketFill is valid (optional)', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      drawdownOrder: ['rrsp'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bracketFill).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// ScenarioDecisionsSchema — Phase 1 override fields
// Tests 1–16 from 01-02-PLAN.md (authoritative list)
// ---------------------------------------------------------------------------

describe('ScenarioDecisionsSchema — withdrawalOverrides', () => {
  // Test 1: valid payload parses successfully
  it('parses a valid withdrawalOverrides record', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: true }],
    });
    expect(result.success).toBe(true);
  });

  // Test 2: duplicate (field, year) tuple → rejected (D-04)
  it('rejects duplicate (field, year) tuples in withdrawalOverrides', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 50000, applyForward: true },
        { field: 'rrsp', year: 2031, amount: 30000, applyForward: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  // Test 3: amount: -1 → throws (D-05)
  it('rejects amount < 0', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: -1, applyForward: false }],
    });
    expect(result.success).toBe(false);
  });

  // Test 4: amount: NaN → throws (D-05)
  it('rejects amount NaN', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: NaN, applyForward: false }],
    });
    expect(result.success).toBe(false);
  });

  // Test 5: amount: Infinity → throws (D-05)
  it('rejects amount Infinity', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: Infinity, applyForward: false }],
    });
    expect(result.success).toBe(false);
  });

  // Test 6: amount: 10_000_001 → throws (D-05, T-02)
  it('rejects amount > 10_000_000', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 10_000_001, applyForward: false }],
    });
    expect(result.success).toBe(false);
  });

  // Test 7: field: 'lira' → throws (D-01 — LIRA not in 5-enum)
  it("rejects field 'lira' (not in D-01 enum)", () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'lira', year: 2031, amount: 50000, applyForward: false }],
    });
    expect(result.success).toBe(false);
  });

  // Test 8: 201 records → throws (T-01 array cap)
  it('rejects 201 withdrawalOverrides records (T-01 cap)', () => {
    const overrides = Array.from({ length: 201 }, (_, i) => ({
      field: 'rrsp' as const,
      year: 2030 + i,
      amount: 1000,
      applyForward: false,
    }));
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: overrides,
    });
    expect(result.success).toBe(false);
  });

  // Test 9: 200 records → succeeds (T-01 boundary)
  it('accepts exactly 200 withdrawalOverrides records (T-01 boundary)', () => {
    // Use year 2001 as base so 2001+199=2200 stays within max(2200)
    const overrides = Array.from({ length: 200 }, (_, i) => ({
      field: 'rrsp' as const,
      year: 2001 + i,
      amount: 1000,
      applyForward: false,
    }));
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: overrides,
    });
    expect(result.success).toBe(true);
  });

  // Test 13: .partial().parse({ withdrawalOverrides: [duplicateTuple] }) → throws (T-05)
  it('ScenarioDecisionsSchema.partial() still rejects duplicate (field, year) tuples (T-05)', () => {
    const result = ScenarioDecisionsSchema.partial().safeParse({
      withdrawalOverrides: [
        { field: 'tfsa', year: 2035, amount: 10000, applyForward: true },
        { field: 'tfsa', year: 2035, amount: 20000, applyForward: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  // Test 16: optional provenance metadata fields parse when present, absent when omitted
  it('parses optional provenance metadata fields on withdrawalOverrides records', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [
        {
          field: 'rrsp',
          year: 2031,
          amount: 50000,
          applyForward: true,
          createdAt: '2026-04-24T00:00:00Z',
          updatedAt: '2026-04-24T12:00:00Z',
          originalEngineValue: 45000,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.withdrawalOverrides?.[0]?.createdAt).toBe('2026-04-24T00:00:00Z');
    }
  });

  it('withdrawalOverrides metadata fields absent when omitted', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: true }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.withdrawalOverrides?.[0]?.createdAt).toBeUndefined();
    }
  });
});

describe('ScenarioDecisionsSchema — spendingOverrides', () => {
  // Test 15: duplicate-year rejection mirrors the withdrawal case
  it('rejects duplicate year in spendingOverrides', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: [
        { year: 2033, amount: 80000, applyForward: false },
        { year: 2033, amount: 90000, applyForward: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('parses a valid spendingOverrides record', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: [{ year: 2033, amount: 80000, applyForward: false }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects amount > 10_000_000 in spendingOverrides (T-02)', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: [{ year: 2033, amount: 10_000_001, applyForward: false }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects 201 spendingOverrides records (T-01 cap)', () => {
    const overrides = Array.from({ length: 201 }, (_, i) => ({
      year: 2030 + i,
      amount: 1000,
      applyForward: false,
    }));
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: overrides,
    });
    expect(result.success).toBe(false);
  });
});

describe('ScenarioDecisionsSchema — surplusDestination', () => {
  // Test 10: surplusDestination: 'lira' → throws
  it("rejects surplusDestination 'lira'", () => {
    const result = ScenarioDecisionsSchema.safeParse({
      surplusDestination: 'lira',
    });
    expect(result.success).toBe(false);
  });

  // Test 11: surplusDestination: 'nonreg' → succeeds
  it("accepts surplusDestination 'nonreg'", () => {
    const result = ScenarioDecisionsSchema.safeParse({
      surplusDestination: 'nonreg',
    });
    expect(result.success).toBe(true);
  });

  // Test 14: surplusDestination absent → result.surplusDestination === undefined (NO Zod default, D-15)
  it('surplusDestination is undefined when omitted — no Zod default (D-15 / Assumption A1)', () => {
    const result = ScenarioDecisionsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.surplusDestination).toBeUndefined();
    }
  });
});

describe('ScenarioDecisionsSchema — additive-invariant (D-03)', () => {
  // Test 12: pre-Phase-1 scenario (no override fields) parses unchanged
  it('parses {} (pre-Phase-1 scenario) successfully — additive-invariant (D-03)', () => {
    const result = ScenarioDecisionsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('parses a full legacy scenario without override fields — additive-invariant', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      retirementAge: 65,
      lifeExpectancy: 95,
      spouseLifeExpectancy: 97,
      strategyId: 'standard',
      targetRetirementSpending: 60000,
      inflationRate: 0.02,
      legacyTarget: 100000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.withdrawalOverrides).toBeUndefined();
      expect(result.data.spendingOverrides).toBeUndefined();
      expect(result.data.surplusDestination).toBeUndefined();
    }
  });

  it('rejects life expectancy outside the supported range', () => {
    expect(ScenarioDecisionsSchema.safeParse({ lifeExpectancy: 64 }).success).toBe(false);
    expect(ScenarioDecisionsSchema.safeParse({ spouseLifeExpectancy: 111 }).success).toBe(false);
  });
});

describe('WithdrawalOverrideField enum', () => {
  it('accepts all five valid literals', () => {
    const valid = ['rrsp', 'rrif', 'lif', 'tfsa', 'nonreg'] as const;
    for (const v of valid) {
      expect(WithdrawalOverrideField.safeParse(v).success).toBe(true);
    }
  });

  it('rejects lira', () => {
    expect(WithdrawalOverrideField.safeParse('lira').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ScenarioDecisionsSchema — owner discriminator on overrides
// ---------------------------------------------------------------------------

describe('ScenarioDecisionsSchema — owner on override records', () => {
  it('legacy withdrawal record without owner parses with owner="primary"', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: true }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.withdrawalOverrides?.[0]?.owner).toBe('primary');
    }
  });

  it('legacy spending record without owner parses with owner="primary"', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: [{ year: 2035, amount: 60000, applyForward: false }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spendingOverrides?.[0]?.owner).toBe('primary');
    }
  });

  it('accepts a primary AND a spouse override for the same (field, year)', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 25000, applyForward: false, owner: 'primary' },
        { field: 'rrsp', year: 2031, amount: 15000, applyForward: false, owner: 'spouse' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('still rejects duplicate (owner, field, year) tuples on withdrawals', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 25000, applyForward: false, owner: 'spouse' },
        { field: 'rrsp', year: 2031, amount: 30000, applyForward: false, owner: 'spouse' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a primary AND a spouse spending override for the same year', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: [
        { year: 2035, amount: 50000, applyForward: false, owner: 'primary' },
        { year: 2035, amount: 30000, applyForward: false, owner: 'spouse' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('still rejects duplicate (owner, year) tuples on spending', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      spendingOverrides: [
        { year: 2035, amount: 50000, applyForward: false, owner: 'primary' },
        { year: 2035, amount: 60000, applyForward: false, owner: 'primary' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown owner literal', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      withdrawalOverrides: [
        {
          field: 'rrsp',
          year: 2031,
          amount: 25000,
          applyForward: false,
          owner: 'household',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('ScenarioDecisionsSchema - planning UX assumptions', () => {
  it('accepts benefit estimate and residency scenario overrides', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      expectedCPPAt65: 14000,
      spouseExpectedCPPAt65: 9000,
      yearsOfResidence: 40,
      spouseYearsOfResidence: 28,
    });

    expect(result.success).toBe(true);
  });

  it('accepts account-type contribution overrides and investment return', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      investmentReturn: 0.055,
      contributionOverrides: [
        { accountType: 'rrsp', annualAmount: 12000, startYear: 2030, endYear: 2200 },
        { accountType: 'tfsa', annualAmount: 7000, startYear: 2030, endYear: 2200 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('requires contribution overrides to target an account id or account type', () => {
    const result = ScenarioDecisionsSchema.safeParse({
      contributionOverrides: [{ annualAmount: 12000, startYear: 2030, endYear: 2200 }],
    });

    expect(result.success).toBe(false);
  });
});
