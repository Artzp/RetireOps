/**
 * Pure shared estimators for CPP/QPP/OAS/GIS (Phases 21–23).
 *
 * Imported via the `@retireops/shared/benefits` subpath. The barrel
 * `packages/shared/src/benefits-parameters/index.ts` re-exports this
 * file's surface so wizard code reads:
 *
 *   import { estimateCPP, adjustCPPForStartAge } from '@retireops/shared/benefits';
 *
 * No engine imports here (Architecture Principle IV).
 */
export { adjustCPPForStartAge } from './adjust-cpp-for-start-age.js';
export { estimateCPP, BUCKET_TO_PCT } from './cpp-estimator.js';
export type { CPPEstimatorInput, CPPEstimate, EarningsBucket } from './cpp-estimator.js';

// --- OAS estimator surface (Phase 22) ---
export { adjustOASForStartAge, OAS_DEFERRAL_RATE_PER_MONTH } from './adjust-oas-for-start-age.js';
export {
  estimateOAS,
  OAS_FLOOR_MESSAGE,
  OAS_FULL_PENSION_YEARS,
  OAS_MIN_QUALIFYING_YEARS,
} from './oas-estimator.js';
export type { OASEstimatorInput, OASEstimate } from './oas-estimator.js';

// --- GIS estimator surface (Phase 23) ---
export { estimateGIS, GIS_NEAR_THRESHOLD_RATIO } from './gis-estimator.js';
export type { GISEstimatorInput, GISEstimate, GisTier } from './gis-estimator.js';
