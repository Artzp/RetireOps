/**
 * Yearly Projection Calculator — public surface (re-export hub).
 *
 * Phase 9 plan 09-07 LOC cleanup: this module now re-exports from
 * orchestration/* modules; the implementations live there. Kept as the public
 * import path for backward compatibility (multi-year.ts, couple-calculator.ts,
 * scenario.test.ts, projection.test.ts, oas-clawback-projection.test.ts,
 * historical-backtest.ts, etc. all import from './yearly-calculator.js').
 *
 * @see docs/source-of-truth/08-projection-engine.md
 * @see .planning/phases/09-yearly-calculator-decomposition/09-07-PLAN.md
 */

export { calculateYear } from './orchestration/calculate-year.js';
export { calculatePersonYear } from './orchestration/calculate-person-year.js';
export { applyAgeBandReduction, resolveContribution } from './orchestration/spending.js';
export type { YearInput, PersonYearInput } from './orchestration/inputs.js';
