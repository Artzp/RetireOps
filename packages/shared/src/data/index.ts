/**
 * @retireops/shared/data — static lookup tables (Phase 19+).
 *
 * Exports curated reference data tables consumed by wizard estimators and
 * downstream UI. The first such table is the 13-jurisdiction provincial
 * supplements lookup (Phase 19, PARAM-02).
 *
 * Consumers:
 *   import { PROVINCIAL_SUPPLEMENTS_2026 } from '@retireops/shared/data';
 *   import type { ProvincialSupplementProgram } from '@retireops/shared/data';
 *
 * @see .planning/phases/19-parameter-consolidation/19-CONTEXT.md
 */

// --- Value exports ---
export { PROVINCIAL_SUPPLEMENTS_2026 } from './provincial-supplements.js';

// --- Type exports ---
export type { ProvincialSupplementProgram } from './provincial-supplements.js';
