/**
 * Drawdown Order Analyzer
 *
 * Compares three withdrawal orders via what-if projections and recommends the
 * lower-tax strategy per FR-006 / FR-013:
 *   1. standard           — non-registered first, preserve tax shelters
 *   2. tfsaFirst          — TFSA first, minimize reported income
 *   3. bracketFilling     — standard order paired with bracket-fill behavior
 *                           (ProjectionInput.bracketFill enabled on the clone)
 *
 * DRAW-03 guard: Returns null when the user has only one account type with a
 * positive balance — drawdown order is irrelevant with a single account type.
 *
 * Tie-break (FR-013 / data-model.md:323): bracket-filling > standard > tfsa-first.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md — Drawdown Order
 * @see specs/005-tax-optimization-engine/spec.md — FR-006, FR-013
 * @see REQUIREMENTS.md — DRAW-01, DRAW-02, DRAW-03
 */
import type { InsightCard } from '@retireops/shared';
import type { OptimizationInput } from '../types.js';
import { cloneProjectionInput } from '../../projection/clone.js';
import { runProjection } from '../../projection/multi-year.js';
import {
  WITHDRAWAL_STRATEGIES,
  accountPriorityToDrawdownOrder,
} from '../../withdrawals/strategy.js';

/**
 * Analyze drawdown order for a completed projection.
 *
 * Returns an InsightCard recommending the lower-tax withdrawal order, or null when:
 * - User has only one account type (DRAW-03 guard)
 * - All three strategies produce identical lifetime tax (savings = 0)
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-DRAW-001, TC-OPT-DRAW-002, TC-OPT-DRAW-003
 */
export function analyzeDrawdownOrder(input: OptimizationInput): InsightCard | null {
  const { baselineOutput, clonedInput } = input;

  // DRAW-03: Guard — count distinct account types with a positive balance.
  const accountsWithBalance = [
    clonedInput.rrspBalance > 0 || (clonedInput.spouse?.rrspBalance ?? 0) > 0,
    clonedInput.tfsaBalance > 0 || (clonedInput.spouse?.tfsaBalance ?? 0) > 0,
    clonedInput.nonRegBalance > 0 || (clonedInput.spouse?.nonRegBalance ?? 0) > 0,
  ].filter(Boolean).length;

  if (accountsWithBalance <= 1) {
    return null;
  }

  const standardOrder = accountPriorityToDrawdownOrder(
    WITHDRAWAL_STRATEGIES.standard.accountPriority
  );
  const tfsaFirstOrder = accountPriorityToDrawdownOrder(
    WITHDRAWAL_STRATEGIES.tfsaFirst.accountPriority
  );
  const bracketFillingOrder = accountPriorityToDrawdownOrder(
    WITHDRAWAL_STRATEGIES.bracketFilling.accountPriority
  );

  // DRAW-01: Standard order what-if
  const standardInput = cloneProjectionInput(clonedInput);
  standardInput.drawdownOrder = standardOrder;
  const standardTax = runProjection(standardInput).summary.totalTaxesPaid;

  // DRAW-02: TFSA-first what-if
  const tfsaFirstInput = cloneProjectionInput(clonedInput);
  tfsaFirstInput.drawdownOrder = tfsaFirstOrder;
  const tfsaFirstTax = runProjection(tfsaFirstInput).summary.totalTaxesPaid;

  // FR-013: bracket-filling what-if — explicitly enables bracketFill on the clone
  // since the catalog preset carries only the priority order, not the behavior flag.
  const bracketFillingInput = cloneProjectionInput(clonedInput);
  bracketFillingInput.drawdownOrder = bracketFillingOrder;
  bracketFillingInput.bracketFill = { enabled: true, bracketTarget: 'next' };
  const bracketFillingTax = runProjection(bracketFillingInput).summary.totalTaxesPaid;

  // Identify the minimum-tax strategy with FR-013 tie-break: bracketFilling > standard > tfsaFirst
  const candidates = [
    { id: 'bracketFilling' as const, tax: bracketFillingTax },
    { id: 'standard' as const, tax: standardTax },
    { id: 'tfsaFirst' as const, tax: tfsaFirstTax },
  ];
  const best = candidates.reduce((a, b) => (b.tax < a.tax ? b : a));
  const worstTax = Math.max(standardTax, tfsaFirstTax, bracketFillingTax);
  const savings = Math.round(worstTax - best.tax);

  if (savings <= 0) {
    return null;
  }

  const LABELS: Record<typeof best.id, { name: string; order: string }> = {
    standard: {
      name: 'standard',
      order: 'non-registered → RRIF → RRSP → TFSA',
    },
    tfsaFirst: {
      name: 'TFSA-first',
      order: 'TFSA → non-registered → RRIF → RRSP',
    },
    bracketFilling: {
      name: 'bracket-filling',
      order: 'non-registered → RRIF → RRSP → TFSA (with bracket-fill RRSP withdrawals)',
    },
  };

  const { name, order } = LABELS[best.id];

  const explanation =
    `Using a ${name} withdrawal order (${order}) could save an estimated ` +
    `$${savings.toLocaleString('en-CA')} in household lifetime taxes by withdrawing from lower-tax accounts ` +
    `before higher-tax accounts. This preserves tax-sheltered growth for as long as possible.`;
  const affectedYears = baselineOutput.yearlyResults.map((yr) => yr.year);
  const estimatedAnnualSavings =
    affectedYears.length > 0 ? Math.round(savings / affectedYears.length) : undefined;

  return {
    module: 'drawdown-order',
    title:
      clonedInput.spouse === undefined
        ? 'Withdrawal Order Optimization'
        : 'Household Withdrawal Order Optimization',
    recommendedAction: `Use the ${name} withdrawal order: ${order}.`,
    whyItHelps:
      'Testing the available drawdown strategies shows this order produces the lowest lifetime tax in the projection.',
    affectedYears,
    ...(estimatedAnnualSavings !== undefined && { estimatedAnnualSavings }),
    appliesTo: 'household',
    explanation,
    estimatedDollarImpact: savings,
    confidence: 'MEDIUM',
  };
}
