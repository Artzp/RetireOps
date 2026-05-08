/**
 * Insight Card Types — Tax Optimization Engine public contract
 * @see REQUIREMENTS.md — CARD-01, CARD-05
 */

/**
 * Confidence level for an optimization recommendation.
 * HIGH = reliable estimate based on known tax rules.
 * MEDIUM = directionally correct but sensitive to assumptions.
 * LOW = rough approximation with significant uncertainty.
 * @see docs/source-of-truth/09-success-metrics.md
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Which analysis module produced this card.
 * @see REQUIREMENTS.md — v1.9 Insight Card Framework
 */
export type InsightModule = 'rrsp-meltdown' | 'cpp-timing' | 'drawdown-order' | 'income-splitting';

/**
 * Who the recommendation applies to.
 */
export type InsightAppliesTo = 'primary' | 'spouse' | 'household';

/**
 * A single optimization recommendation surfaced to the user.
 * Per CARD-01: each card has a title, plain-language explanation,
 * estimated dollar impact, and confidence indicator.
 * @see CARD-01
 * @see CARD-05
 */
export interface InsightCard {
  /** Which analyzer produced this card */
  module: InsightModule;
  /** Short display title (e.g., "RRSP Meltdown Strategy") */
  title: string;
  /** Concrete next step the user can take. Optional for backwards compatibility. */
  recommendedAction?: string;
  /** Short structured rationale for why the action improves the plan. */
  whyItHelps?: string;
  /** Calendar years materially affected by the recommendation. */
  affectedYears?: number[];
  /** Estimated annual tax saving, when the analyzer can derive one. */
  estimatedAnnualSavings?: number;
  /** Whether the recommendation applies to the primary, spouse, or household. */
  appliesTo?: InsightAppliesTo;
  /** Plain-language explanation suitable for a non-expert Canadian retiree */
  explanation: string;
  /**
   * Estimated lifetime tax saving (positive) or cost (negative).
   * Canadian dollars, rounded to nearest dollar (integer).
   * Per CARD-05: typed as number, not string.
   */
  estimatedDollarImpact: number;
  /** Confidence in the estimate */
  confidence: ConfidenceLevel;
}

/**
 * Result from the optimization analysis orchestrator.
 * Either returns a sorted list of InsightCards or a well-optimized signal.
 * @see REQUIREMENTS.md — CARD-02, CARD-03, CARD-04
 */
export interface OptimizationResult {
  /** Sorted InsightCard array — empty when wellOptimized is true (CARD-03) */
  cards: InsightCard[];
  /**
   * True when no optimization opportunities were found across all analyzers.
   * Indicates the plan is already well-structured (CARD-04).
   */
  wellOptimized: boolean;
  /**
   * Human-readable message when wellOptimized is true.
   * Undefined when cards are present.
   */
  message?: string;
}
