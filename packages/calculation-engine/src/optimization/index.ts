/**
 * Optimization Module — Barrel Export
 * Phase 43: types only.
 * Phase 44: income-splitting and cpp-oas analyzers added.
 * Phases 45-46: remaining analyzers and orchestrator.
 * NOTE: This barrel is NOT re-exported from the engine root (src/index.ts) yet.
 * Downstream phases import via relative path: '../optimization/index.js'
 * @see .planning/phases/43-shared-types-and-engine-foundation/43-RESEARCH.md — Pattern 4
 */
export * from './types.js';
export * from './analyzers/income-splitting.js';
export * from './analyzers/cpp-oas.js';
export * from './analyzers/rrsp-meltdown.js';
export * from './analyzers/drawdown-order.js';
export * from './orchestrator.js';
