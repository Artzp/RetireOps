/**
 * Unit tests for SolverInputSchema — Phase 51 Success Criterion 2 gate.
 *
 * These tests prove that the SolverInputSchema discriminated union produces
 * field-level ZodError messages for per-mode invalid combinations, and that
 * valid payloads parse successfully with correct defaults.
 *
 * Test IDs TC-SHARED-SOLVER-01 through TC-SHARED-SOLVER-08 are registered in
 * docs/TESTABLE-SURFACES.md (Phase 51 Task 5).
 *
 * @see packages/shared/src/validation/solver.schema.ts
 * @see specs/008-reverse-calculator/data-model.md
 */
import { describe, it, expect } from 'vitest';
import { SolverInputSchema } from './solver.schema.js';

describe('SolverInputSchema', () => {
  /**
   * Reusable valid common-base fields.
   * Optional base fields (cppStartAge, oasStartAge, investmentReturnRate, inflationRate,
   * lifeExpectancy) are intentionally omitted to exercise schema defaults.
   */
  const validBaseFields = {
    province: 'ON' as const,
    dateOfBirth: '1970-01-01',
    currentAge: 55,
    rrspBalance: 200_000,
    tfsaBalance: 80_000,
    nonRegBalance: 50_000,
    employmentIncome: 100_000,
  };

  /**
   * TC-SHARED-SOLVER-01
   * Mode 1 payload missing targetRetirementAge → ZodError at path targetRetirementAge
   */
  it('TC-SHARED-SOLVER-01: rejects Mode 1 missing targetRetirementAge', () => {
    const result = SolverInputSchema.safeParse({
      ...validBaseFields,
      mode: 'required-savings',
      retirementSpending: 60_000,
      // targetRetirementAge intentionally omitted
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain('targetRetirementAge');
    }
  });

  /**
   * TC-SHARED-SOLVER-02
   * Mode 1 payload missing retirementSpending → ZodError at path retirementSpending
   */
  it('TC-SHARED-SOLVER-02: rejects Mode 1 missing retirementSpending', () => {
    const result = SolverInputSchema.safeParse({
      ...validBaseFields,
      mode: 'required-savings',
      targetRetirementAge: 65,
      // retirementSpending intentionally omitted
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain('retirementSpending');
    }
  });

  /**
   * TC-SHARED-SOLVER-03
   * Mode 2 payload missing retirementAge → ZodError at path retirementAge
   */
  it('TC-SHARED-SOLVER-03: rejects Mode 2 missing retirementAge', () => {
    const result = SolverInputSchema.safeParse({
      ...validBaseFields,
      mode: 'sustainable-spending',
      // retirementAge intentionally omitted
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain('retirementAge');
    }
  });

  /**
   * TC-SHARED-SOLVER-04
   * Mode 3 payload missing annualSavingsRate → ZodError at path annualSavingsRate
   */
  it('TC-SHARED-SOLVER-04: rejects Mode 3 missing annualSavingsRate', () => {
    const result = SolverInputSchema.safeParse({
      ...validBaseFields,
      mode: 'earliest-retirement-age',
      retirementSpending: 60_000,
      // annualSavingsRate intentionally omitted
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain('annualSavingsRate');
    }
  });

  /**
   * TC-SHARED-SOLVER-05
   * Valid Mode 1 payload → success: true with correct defaults applied
   */
  it('TC-SHARED-SOLVER-05: accepts valid Mode 1 payload and applies defaults', () => {
    const result = SolverInputSchema.safeParse({
      ...validBaseFields,
      mode: 'required-savings',
      targetRetirementAge: 65,
      retirementSpending: 60_000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('required-savings');
      expect(result.data.lifeExpectancy).toBe(90);
      expect(result.data.inflationRate).toBe(0.02);
      if (result.data.mode === 'required-savings') {
        expect(result.data.targetRetirementAge).toBe(65);
      }
    }
  });

  /**
   * TC-SHARED-SOLVER-06
   * Mode 4 payload without rrspBalance, tfsaBalance, nonRegBalance → success: true
   * (these three fields are optional in Mode 4 only)
   */
  it('TC-SHARED-SOLVER-06: accepts Mode 4 payload omitting balance fields', () => {
    const {
      rrspBalance: _r,
      tfsaBalance: _t,
      nonRegBalance: _n,
      ...baseWithoutBalances
    } = validBaseFields;

    const result = SolverInputSchema.safeParse({
      ...baseWithoutBalances,
      mode: 'required-total-savings',
      targetRetirementAge: 65,
      retirementSpending: 60_000,
    });

    expect(result.success).toBe(true);
  });

  /**
   * TC-SHARED-SOLVER-07
   * Mode 2 payload missing rrspBalance → success: false with ZodError at rrspBalance
   * (proves balance fields remain REQUIRED in non-Mode-4 modes)
   */
  it('TC-SHARED-SOLVER-07: rejects Mode 2 missing rrspBalance', () => {
    const { rrspBalance: _r, ...baseWithoutRrsp } = validBaseFields;

    const result = SolverInputSchema.safeParse({
      ...baseWithoutRrsp,
      mode: 'sustainable-spending',
      retirementAge: 65,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain('rrspBalance');
    }
  });

  /**
   * TC-SHARED-SOLVER-08
   * Payload with unknown mode discriminant → success: false
   */
  it('TC-SHARED-SOLVER-08: rejects unknown mode discriminant', () => {
    const result = SolverInputSchema.safeParse({
      ...validBaseFields,
      mode: 'bogus-mode',
    });

    expect(result.success).toBe(false);
  });
});
