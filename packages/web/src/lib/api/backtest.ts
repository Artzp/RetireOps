/**
 * Historical Backtest API Client — v1.14
 *
 * Calls POST/GET /api/profile/scenarios/:id/backtest.
 */
import { api } from './client';
import type { BacktestResult } from '@retireops/shared';

export interface BacktestResponse {
  data: BacktestResult;
  /** true when stored results were computed against an older set of inputs */
  isStale: boolean;
}

/**
 * Run all 3 historical backtests for a scenario.
 * POST /api/profile/scenarios/:id/backtest → 200 { data: BacktestResponse }
 */
export async function runScenarioBacktest(scenarioId: string): Promise<BacktestResponse> {
  const result = await api.post<BacktestResponse>(`/profile/scenarios/${scenarioId}/backtest`);
  return result.data;
}

/**
 * Fetch cached backtest results for a scenario.
 * GET /api/profile/scenarios/:id/backtest → 200 { data: BacktestResponse }
 * Throws (404) if no backtest has been run yet.
 */
export async function getScenarioBacktest(scenarioId: string): Promise<BacktestResponse> {
  const result = await api.get<BacktestResponse>(`/profile/scenarios/${scenarioId}/backtest`);
  return result.data;
}

/**
 * Fetch (or compute) backtest results for a projection.
 * GET /api/projections/:id/backtest — synchronous compute or 5-min Redis cache.
 * Throws on 409 (PROJECTION_NOT_READY, COUPLE_NOT_SUPPORTED) and network errors.
 */
export async function getProjectionBacktest(projectionId: string): Promise<BacktestResult> {
  const result = await api.get<BacktestResult>(`/projections/${projectionId}/backtest`);
  return result.data;
}
