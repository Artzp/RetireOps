/**
 * Optimization Engine — Internal Types
 * Used by analyzers within calculation-engine only.
 * The public contract (InsightCard) lives in @retireops/shared.
 * @see REQUIREMENTS.md — v1.9 Tax Optimization Engine
 */
import type { CoupleYearlyResult, ProjectionInput, ProjectionOutput } from '@retireops/shared';

/**
 * Input to all optimization analyzers.
 * Each analyzer receives the baseline projection result and a deep-cloned input
 * that is safe to mutate for what-if re-runs.
 */
export interface OptimizationInput {
  /** Baseline projection result (read-only — do not mutate) */
  baselineOutput: ProjectionOutput;
  /** Deep clone of the original ProjectionInput — safe to mutate for what-if re-runs */
  clonedInput: ProjectionInput;
  coupleYearlyResults?: CoupleYearlyResult[];
}

/**
 * A single year in the RRSP meltdown schedule.
 * @see REQUIREMENTS.md — MLT-01
 */
export interface MeltdownSchedule {
  /** Calendar year */
  year: number;
  /** Recommended voluntary RRSP withdrawal in this year (CAD, integer) */
  voluntaryWithdrawal: number;
  /** Federal marginal rate in this year before meltdown withdrawal */
  marginalRateBefore: number;
  /** Federal marginal rate in this year after meltdown withdrawal */
  marginalRateAfter: number;
}

/**
 * Breakeven analysis result for CPP/OAS timing comparisons.
 * @see REQUIREMENTS.md — CPP-01
 */
export interface BreakevenResult {
  /** Age at which cumulative benefits cross over, or null if breakeven never reached within life expectancy */
  breakevenAge: number | null;
  /** Earlier start age in the comparison (e.g., 60) */
  earlyStartAge: number;
  /** Later start age in the comparison (e.g., 65) */
  lateStartAge: number;
  /** Cumulative benefit at early start age at the breakeven point (CAD, integer) */
  cumulativeEarlyAtBreakeven: number;
  /** Cumulative benefit at late start age at the breakeven point (CAD, integer) */
  cumulativeLateAtBreakeven: number;
}
