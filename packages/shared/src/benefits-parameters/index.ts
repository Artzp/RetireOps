/**
 * @retireops/shared/benefits — 2026 CPP / QPP / OAS / GIS parameter module (Phase 19).
 *
 * Exports citation-anchored 2026 parameter constants. Every value cites
 * docs/source-of-truth/18-pensions-2026.md via the v4.5 anchor convention
 * (`// per docs/source-of-truth/...#<anchor>` on the line above each field).
 *
 * Consumers:
 *   import { CPP_2026, QPP_2026, OAS_2026, GIS_2026 } from '@retireops/shared/benefits';
 *   import type { CPP2026Parameters, OAS2026Parameters } from '@retireops/shared/benefits';
 *
 * @see .planning/phases/19-parameter-consolidation/19-CONTEXT.md
 */

// --- Value exports ---
export { CPP_2026, QPP_2026, OAS_2026, GIS_2026 } from './2026.js';

// --- Type exports ---
export type {
  CPP2026Parameters,
  QPP2026Parameters,
  OAS2026Parameters,
  GIS2026Parameters,
} from './2026.js';

// --- Estimator re-exports (Phase 21) ---
// Reached via the same `@retireops/shared/benefits` subpath so wizard code
// can `import { estimateCPP, adjustCPPForStartAge } from '@retireops/shared/benefits'`.
export { adjustCPPForStartAge, estimateCPP, BUCKET_TO_PCT } from '../benefits/estimators/index.js';
export type {
  CPPEstimatorInput,
  CPPEstimate,
  EarningsBucket,
} from '../benefits/estimators/index.js';

// --- Estimator re-exports (Phase 22) ---
// Reached via the same `@retireops/shared/benefits` subpath so wizard code
// can `import { estimateOAS, adjustOASForStartAge } from '@retireops/shared/benefits'`.
export {
  adjustOASForStartAge,
  estimateOAS,
  OAS_FLOOR_MESSAGE,
  OAS_FULL_PENSION_YEARS,
  OAS_MIN_QUALIFYING_YEARS,
  OAS_DEFERRAL_RATE_PER_MONTH,
} from '../benefits/estimators/index.js';
export type { OASEstimatorInput, OASEstimate } from '../benefits/estimators/index.js';

// --- Estimator re-exports (Phase 23) ---
// Reached via the same `@retireops/shared/benefits` subpath so wizard code
// can `import { estimateGIS } from '@retireops/shared/benefits'`.
export { estimateGIS, GIS_NEAR_THRESHOLD_RATIO } from '../benefits/estimators/index.js';
export type { GISEstimatorInput, GISEstimate, GisTier } from '../benefits/estimators/index.js';
