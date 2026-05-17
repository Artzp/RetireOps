/**
 * @retireops/shared/withdrawal
 *
 * v4.8 Withdrawal Experience — preset catalog, constraint validators, and
 * explainability adapters. Architecture Principle IV: this subpath does NOT
 * import from `@retireops/calculation-engine`.
 *
 * @see .planning/phases/27-preset-mapping-infrastructure/27-CONTEXT.md
 * @see .planning/phases/29-constraint-validators/29-CONTEXT.md
 * @see .planning/phases/30-explainability-adapter-override-summary/30-CONTEXT.md
 */
export * from './presets.js';
export * from './constraints.js';
export * from './explain.js';
