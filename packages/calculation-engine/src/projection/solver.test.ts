/**
 * Solver Unit Tests — v1.12 Reverse Calculator
 *
 * @see docs/TESTABLE-SURFACES.md — TC-SOLVER-001..005
 * @see .planning/phases/52-solver-engine/52-RESEARCH.md
 * @see packages/calculation-engine/src/projection/solver.ts
 */
import { describe, it, expect, vi } from 'vitest';
import type { SolverInput } from '@retireops/shared';
import { runSingleProjection } from './multi-year.js';
import { solveSingle } from './solver.js'; // IMPORT WILL FAIL until Task 2 creates the file — that is the RED state

// Reusable base factory for SolverInputBase fields
function baseSolverFields() {
  return {
    province: 'ON' as const,
    dateOfBirth: '1986-01-01',
    currentAge: 40,
    lifeExpectancy: 90,
    rrspBalance: 50_000,
    tfsaBalance: 20_000,
    nonRegBalance: 0,
    employmentIncome: 80_000,
    cppStartAge: 65,
    oasStartAge: 65,
    investmentReturnRate: 0.05,
    inflationRate: 0.02,
  };
}

describe('solveSingle', () => {
  describe('TC-SOLVER-001: Mode 1 Required Annual Savings (REV-05, REV-02)', () => {
    it('returns feasible solvedValue within hand-verifiable tolerance for a 25-year horizon', () => {
      const input: SolverInput = {
        mode: 'required-savings',
        ...baseSolverFields(),
        targetRetirementAge: 65,
        retirementSpending: 60_000,
      };
      const result = solveSingle(input, runSingleProjection);
      expect(result.feasible).toBe(true);
      expect(result.mode).toBe('required-savings');
      expect(result.solvedUnit).toBe('dollars-per-year');
      // Sanity band: a 25-year savings horizon for $60k retirement spending
      // on a $70k starting portfolio must fall within $0–$100k/yr.
      expect(result.solvedValue).toBeGreaterThanOrEqual(0);
      expect(result.solvedValue).toBeLessThanOrEqual(100_000);
      // Verify the summary is populated, not null
      expect(result.projectionSummary.finalPortfolioBalance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TC-SOLVER-002: Mode 2 Sustainable Spending inverted direction (REV-06)', () => {
    it('converges to a maximum where solvedValue+5000 produces a red projection', () => {
      const input: SolverInput = {
        mode: 'sustainable-spending',
        ...baseSolverFields(),
        currentAge: 60,
        rrspBalance: 800_000,
        tfsaBalance: 100_000,
        nonRegBalance: 100_000,
        retirementAge: 65,
      };
      const result = solveSingle(input, runSingleProjection);
      expect(result.feasible).toBe(true);
      expect(result.mode).toBe('sustainable-spending');
      expect(result.solvedUnit).toBe('dollars-per-year');
      // If direction is INVERTED correctly, solvedValue is a MAX — must be > $20k for this scenario.
      // Wrong direction (copied from savings lever) would converge near $1,000.
      expect(result.solvedValue).toBeGreaterThan(20_000);

      // Prove inverted monotonicity: spending above solvedValue must be infeasible.
      // Build a ProjectionInput matching the solver's internal mapping and bump spending.
      // Mirror buildProjectionInputFromSolverInput defaults here.
      const proofInput = {
        birthdate: new Date('1966-01-01'),
        province: 'ON' as const,
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 80_000,
        employmentGrowthRate: 0,
        rrspBalance: 800_000,
        rrspAnnualContribution: 0,
        tfsaBalance: 100_000,
        tfsaAnnualContribution: 0,
        nonRegBalance: 100_000,
        retirementSpending: result.solvedValue + 5_000,
        investmentReturn: 0.05,
        inflationRate: 0.02,
        expectedCPPAt65: 12_000,
        cppStartAge: 65,
        oasStartAge: 65,
        yearsOfResidence: 40,
      };
      const proofOutput = runSingleProjection(proofInput);
      expect(proofOutput.summary.fundedStatus.state).toBe('red');
    });
  });

  describe('TC-SOLVER-003: Mode 3 Earliest Retirement Age bounded runProjection calls (REV-07)', () => {
    it('terminates in at most 11 callback invocations via bisection pre-narrowing', () => {
      const input: SolverInput = {
        mode: 'earliest-retirement-age',
        ...baseSolverFields(),
        currentAge: 25,
        dateOfBirth: '2001-01-01',
        rrspBalance: 10_000,
        tfsaBalance: 5_000,
        nonRegBalance: 0,
        employmentIncome: 60_000,
        annualSavingsRate: 25_000,
        retirementSpending: 50_000,
      };
      const spy = vi.fn(runSingleProjection);
      const result = solveSingle(input, spy);
      // REV-07: bisection pre-narrowing must keep the call count far below a
      // full integer linear scan of [25,80] (~55 calls). The worst case for a
      // 55-year range narrowed to a 4-year bracket is 2 pre-checks +
      // ceil(log2(55/4))≈4 bisection steps + 5 linear ≈ 11 calls. The exact
      // count depends on where the feasible boundary lands; after audit A-08
      // re-anchored OAS gross indexation to the calendar clock, the boundary
      // (age 65 here) shifts the bisection path to 10 calls — still bounded.
      expect(spy.mock.calls.length).toBeLessThanOrEqual(11);
      expect(result.mode).toBe('earliest-retirement-age');
      expect(result.solvedUnit).toBe('age');
      if (result.feasible) {
        expect(Number.isInteger(result.solvedValue)).toBe(true);
        expect(result.solvedValue).toBeGreaterThanOrEqual(25);
        expect(result.solvedValue).toBeLessThanOrEqual(80);
      }
    });
  });

  describe('TC-SOLVER-004: Infeasibility detection at upper bound (REV-12)', () => {
    it('returns feasible=false (not the boundary value) when Mode 1 goal is impossible', () => {
      const input: SolverInput = {
        mode: 'required-savings',
        ...baseSolverFields(),
        currentAge: 64,
        dateOfBirth: '1962-01-01',
        rrspBalance: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        employmentIncome: 50_000,
        targetRetirementAge: 65,
        retirementSpending: 500_000,
      };
      const result = solveSingle(input, runSingleProjection);
      expect(result.feasible).toBe(false);
      expect(result.solvedValue).toBe(0);
      expect(result.solvedValue).not.toBe(250_000); // must not return the ceiling
      expect(typeof result.infeasibleReason).toBe('string');
      expect((result.infeasibleReason ?? '').length).toBeGreaterThan(0);
    });
  });

  describe('TC-SOLVER-005: Determinism for identical inputs (REV-13)', () => {
    it('returns identical solvedValue, feasible, and convergenceIterations across two calls', () => {
      const input: SolverInput = {
        mode: 'required-savings',
        ...baseSolverFields(),
        targetRetirementAge: 65,
        retirementSpending: 60_000,
      };
      const a = solveSingle(input, runSingleProjection);
      const b = solveSingle(input, runSingleProjection);
      expect(a.solvedValue).toBe(b.solvedValue);
      expect(a.feasible).toBe(b.feasible);
      expect(a.convergenceIterations).toBe(b.convergenceIterations);
    });
  });
});
