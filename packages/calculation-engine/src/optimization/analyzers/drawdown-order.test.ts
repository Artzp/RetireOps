/**
 * Drawdown Order Analyzer Tests
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-DRAW-001, TC-OPT-DRAW-002, TC-OPT-DRAW-003
 * @see REQUIREMENTS.md — DRAW-01, DRAW-02, DRAW-03
 * @see specs/005-tax-optimization-engine/spec.md — FR-006, FR-013
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeDrawdownOrder } from './drawdown-order.js';
import type { OptimizationInput } from '../types.js';
import type { ProjectionOutput, ProjectionInput } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Mock runProjection — returns a different totalTaxesPaid for each of the
// three strategies so tie-break behavior is observable:
//   standard       (first call, drawdownOrder[0] === 'nonReg', bracketFill undefined) → 80000
//   tfsaFirst      (drawdownOrder[0] === 'tfsa')                                       → 70000
//   bracketFilling (drawdownOrder[0] === 'nonReg', bracketFill.enabled === true)       → 60000
// ---------------------------------------------------------------------------
vi.mock('../../projection/multi-year.js', () => ({
  runProjection: vi.fn(
    (input: { drawdownOrder?: string[]; bracketFill?: { enabled: boolean } }) => {
      const tfsaFirst = input.drawdownOrder?.[0] === 'tfsa';
      const bracketFilling = input.bracketFill?.enabled === true;
      const totalTaxesPaid = bracketFilling ? 60000 : tfsaFirst ? 70000 : 80000;
      return {
        yearlyResults: [],
        summary: { totalTaxesPaid },
      };
    }
  ),
}));

vi.mock('../../projection/clone.js', () => ({
  cloneProjectionInput: vi.fn((input: ProjectionInput) => ({ ...input })),
}));

function makeInput(
  overrides: {
    rrspBalance?: number;
    tfsaBalance?: number;
    nonRegBalance?: number;
  } = {}
): OptimizationInput {
  const baselineOutput = {
    id: 'test-drawdown',
    yearlyResults: [],
    summary: { totalTaxesPaid: 80000 },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ProjectionOutput;

  const clonedInput = {
    birthdate: new Date('1960-01-01'),
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'single' as const,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: overrides.rrspBalance ?? 200000,
    rrspAnnualContribution: 0,
    tfsaBalance: overrides.tfsaBalance ?? 100000,
    tfsaAnnualContribution: 0,
    nonRegBalance: overrides.nonRegBalance ?? 50000,
    retirementSpending: 50000,
    investmentReturn: 0.05,
    inflationRate: 0.02,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    spouse: undefined,
  };

  return { baselineOutput, clonedInput };
}

describe('TC-OPT-DRAW-001: analyzeDrawdownOrder returns InsightCard for lowest-tax strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns InsightCard recommending bracket-filling when it has the lowest tax', () => {
    /**
     * DRAW-01/FR-013: With standard=80000, tfsaFirst=70000, bracketFilling=60000
     * Expected: InsightCard.estimatedDollarImpact = worstTax - bestTax = 80000 - 60000 = 20000
     */
    const input = makeInput({ rrspBalance: 200000, tfsaBalance: 100000, nonRegBalance: 50000 });

    const result = analyzeDrawdownOrder(input);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.module).toBe('drawdown-order');
    expect(result.estimatedDollarImpact).toBe(20000);
    expect(result.recommendedAction).toContain('bracket-filling');
    expect(result.whyItHelps).toContain('lowest lifetime tax');
    expect(result.affectedYears).toEqual([]);
    expect(result.appliesTo).toBe('household');
    expect(result.confidence).toBe('MEDIUM');
    expect(result.explanation).toContain('bracket-filling');
  });

  it('couple projection compares household-level outcomes and labels the card as Household', () => {
    const input = makeInput({ rrspBalance: 0, tfsaBalance: 0, nonRegBalance: 50000 });
    input.clonedInput = {
      ...input.clonedInput,
      maritalStatus: 'married',
      spouse: {
        birthdate: new Date('1962-01-01'),
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        rrspBalance: 100000,
        tfsaBalance: 0,
      },
    };

    const result = analyzeDrawdownOrder(input);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Household Withdrawal Order Optimization');
    expect(result?.explanation).toContain('household lifetime taxes');
  });

  it('runs three what-if projections — one per strategy', async () => {
    const { cloneProjectionInput } = await import('../../projection/clone.js');
    const { runProjection } = await import('../../projection/multi-year.js');
    const cloneSpy = vi.mocked(cloneProjectionInput);
    const runSpy = vi.mocked(runProjection);

    const input = makeInput();
    analyzeDrawdownOrder(input);

    expect(cloneSpy).toHaveBeenCalledTimes(3);
    expect(runSpy).toHaveBeenCalledTimes(3);
  });

  it('uses catalog-sourced drawdown orders and enables bracketFill on the third call', async () => {
    /**
     * FR-006 / FR-013:
     *   call 1 — standard       ['nonReg','rrif','rrsp','tfsa'],  bracketFill undefined
     *   call 2 — tfsaFirst      ['tfsa','nonReg','rrif','rrsp'],  bracketFill undefined
     *   call 3 — bracketFilling ['nonReg','rrif','rrsp','tfsa'],  bracketFill.enabled === true
     */
    const { runProjection } = await import('../../projection/multi-year.js');
    const runSpy = vi.mocked(runProjection);

    const input = makeInput();
    analyzeDrawdownOrder(input);

    const calls = runSpy.mock.calls;
    expect(calls).toHaveLength(3);

    const first = calls[0]?.[0] as { drawdownOrder?: string[]; bracketFill?: { enabled: boolean } };
    expect(first.drawdownOrder).toEqual(['nonReg', 'rrif', 'rrsp', 'tfsa']);
    expect(first.bracketFill).toBeUndefined();

    const second = calls[1]?.[0] as {
      drawdownOrder?: string[];
      bracketFill?: { enabled: boolean };
    };
    expect(second.drawdownOrder).toEqual(['tfsa', 'nonReg', 'rrif', 'rrsp']);
    expect(second.bracketFill).toBeUndefined();

    const third = calls[2]?.[0] as { drawdownOrder?: string[]; bracketFill?: { enabled: boolean } };
    expect(third.drawdownOrder).toEqual(['nonReg', 'rrif', 'rrsp', 'tfsa']);
    expect(third.bracketFill?.enabled).toBe(true);
  });
});

describe('TC-OPT-DRAW-002: analyzeDrawdownOrder returns null for single account type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when only TFSA has a balance', () => {
    const input = makeInput({ rrspBalance: 0, tfsaBalance: 50000, nonRegBalance: 0 });
    expect(analyzeDrawdownOrder(input)).toBeNull();
  });

  it('returns null when only RRSP has a balance', () => {
    const input = makeInput({ rrspBalance: 200000, tfsaBalance: 0, nonRegBalance: 0 });
    expect(analyzeDrawdownOrder(input)).toBeNull();
  });

  it('returns null when only nonReg has a balance', () => {
    const input = makeInput({ rrspBalance: 0, tfsaBalance: 0, nonRegBalance: 50000 });
    expect(analyzeDrawdownOrder(input)).toBeNull();
  });
});

describe('TC-OPT-DRAW-003: analyzeDrawdownOrder returns null when savings = 0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when all three strategies produce identical lifetime tax', async () => {
    const { runProjection } = await import('../../projection/multi-year.js');
    vi.mocked(runProjection).mockReturnValue({
      yearlyResults: [],
      summary: { totalTaxesPaid: 80000 },
    } as unknown as ProjectionOutput);

    const input = makeInput({ rrspBalance: 200000, tfsaBalance: 100000, nonRegBalance: 50000 });
    const result = analyzeDrawdownOrder(input);

    expect(result).toBeNull();
  });
});
