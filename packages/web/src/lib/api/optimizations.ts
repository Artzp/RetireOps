/**
 * Tax Optimization API Client — M005 Phase 1
 *
 * Calls GET /api/profile/scenarios/:id/analyze.
 */
import { api, ApiError } from './client';
import type { OptimizationResult } from '@retireops/shared';

export class CoupleNotSupportedError extends Error {
  constructor() {
    super('Optimization analysis is unavailable for this couple scenario');
    this.name = 'CoupleNotSupportedError';
  }
}

/**
 * Fetch optimization analysis for a scenario.
 * Throws CoupleNotSupportedError when the backend returns 409 COUPLE_NOT_SUPPORTED
 * so the UI can render a scoped empty state.
 */
export async function getScenarioOptimizations(scenarioId: string): Promise<OptimizationResult> {
  try {
    const result = await api.get<OptimizationResult>(`/profile/scenarios/${scenarioId}/analyze`);
    return result.data;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'COUPLE_NOT_SUPPORTED') {
      throw new CoupleNotSupportedError();
    }
    throw err;
  }
}
