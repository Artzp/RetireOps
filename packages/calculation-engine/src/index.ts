/**
 * @retireops/calculation-engine
 * Core calculation engine for Canadian retirement planning
 *
 * @see docs/source-of-truth/ for authoritative specifications
 */

// Tax calculations
export * from './tax/index.js';

// Government benefits (CPP, OAS, GIS)
export * from './benefits/index.js';

// Account rules (RRSP, RRIF, TFSA, Non-registered)
export * from './accounts/index.js';

// Investment engine (growth, Monte Carlo, inflation)
export * from './investments/index.js';

// Withdrawal strategies
export * from './withdrawals/index.js';

// Projection engine
export * from './projection/index.js';

// Optimization engine
export * from './optimization/index.js';
