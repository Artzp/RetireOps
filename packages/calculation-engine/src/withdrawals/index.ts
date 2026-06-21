/**
 * Withdrawal Strategy Module
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 *
 * NOTE (audit 2026-06-10, Batch 7): the legacy `calculator.ts`/`optimizer.ts`
 * helpers were removed (findings A-07/B-02/B-04/B-10). They were never on the
 * live projection path — orchestration consumes `projection/strategies/*`,
 * `projection/orchestration/bracket-fill.ts`, and
 * `projection/orchestration/pension-split-optimizer.ts`, all year-aware via
 * the `tax/` module. Only the strategy catalog/adapters below remain.
 */

export * from './strategy.js';
