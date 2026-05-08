/**
 * Optimization Orchestrator
 *
 * Calls all four optimization analyzers, flattens and filters results,
 * sorts by estimated savings descending, and returns a well-optimized
 * message when no cards are generated.
 *
 * @see REQUIREMENTS.md — CARD-02, CARD-03, CARD-04
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-001, TC-OPT-ORCH-002, TC-OPT-ORCH-003, TC-OPT-ORCH-004
 */
import type { InsightCard, OptimizationResult } from '@retireops/shared';
import type { OptimizationInput } from './types.js';
import { analyzeIncomeSplitting } from './analyzers/income-splitting.js';
import { analyzeCPPOAS } from './analyzers/cpp-oas.js';
import { analyzeRRSPMeltdown } from './analyzers/rrsp-meltdown.js';
import { analyzeDrawdownOrder } from './analyzers/drawdown-order.js';

export type { OptimizationResult };

/**
 * Run all four optimization analyzers and aggregate their results.
 *
 * 1. Calls all analyzers: income-splitting, cpp-oas, rrsp-meltdown, drawdown-order
 * 2. Flattens InsightCard[] from analyzeCPPOAS and single InsightCard | null from others (CARD-03)
 * 3. Filters out null results (CARD-03)
 * 4. Sorts by estimatedDollarImpact descending (CARD-02)
 * 5. Returns wellOptimized: true with message when no cards generated (CARD-04)
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-001, TC-OPT-ORCH-002, TC-OPT-ORCH-003, TC-OPT-ORCH-004
 */
export function runOptimizationAnalysis(input: OptimizationInput): OptimizationResult {
  // Collect raw results from all analyzers
  const rawResults = [
    analyzeIncomeSplitting(input),
    analyzeCPPOAS(input),
    analyzeRRSPMeltdown(input),
    analyzeDrawdownOrder(input),
  ];

  // Flatten arrays (analyzeCPPOAS returns InsightCard[]), filter nulls (CARD-03)
  const cards: InsightCard[] = rawResults.flatMap((r) =>
    Array.isArray(r) ? r : r !== null ? [r] : []
  );

  // Sort by estimatedDollarImpact descending (CARD-02)
  cards.sort((a, b) => b.estimatedDollarImpact - a.estimatedDollarImpact);

  // CARD-04: Return well-optimized signal when no cards generated
  if (cards.length === 0) {
    return {
      cards: [],
      wellOptimized: true,
      message:
        'Your plan is well-optimized. No significant tax-saving opportunities were identified based on your current projections.',
    };
  }

  return {
    cards,
    wellOptimized: false,
  };
}
