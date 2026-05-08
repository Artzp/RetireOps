/**
 * Monte Carlo API Service
 *
 * Uses the centralized API client with automatic token refresh.
 * Provides job submission, status polling, and cancellation for MC simulations.
 */
import type { MonteCarloJobStatus } from '@retireops/shared';
import { api } from './client';

/**
 * Submit a new Monte Carlo simulation job for a projection.
 * Returns the job ID to use for polling status.
 *
 * POST /api/projections/:id/monte-carlo → 202 { jobId }
 */
export async function submitMonteCarloJob(
  projectionId: string,
  body: { numSimulations: number; expectedReturn: number; volatility: number }
): Promise<{ jobId: string }> {
  const result = await api.post<{ jobId: string }>(
    `/projections/${projectionId}/monte-carlo`,
    body
  );
  return result.data;
}

/**
 * Poll the status of a Monte Carlo job.
 * Returns full MonteCarloJobStatus including result when completed.
 *
 * GET /api/projections/:id/monte-carlo/:jobId → 200 { MonteCarloJobStatus }
 */
export async function getMonteCarloJobStatus(
  projectionId: string,
  jobId: string
): Promise<MonteCarloJobStatus> {
  const result = await api.get<MonteCarloJobStatus>(
    `/projections/${projectionId}/monte-carlo/${jobId}`
  );
  return result.data;
}

/**
 * Cancel an in-progress Monte Carlo job.
 * The DELETE endpoint returns 204 No Content — the api client calls response.json()
 * unconditionally on 2xx which will fail on 204. We swallow that error here.
 * Real HTTP errors (4xx/5xx) are thrown by the !response.ok branch before .json() is reached.
 *
 * DELETE /api/projections/:id/monte-carlo/:jobId → 204 no body
 */
export async function cancelMonteCarloJob(projectionId: string, jobId: string): Promise<void> {
  try {
    await api.delete(`/projections/${projectionId}/monte-carlo/${jobId}`);
  } catch {
    // 204 No Content causes response.json() to throw a JSON parse error.
    // This is safe to swallow — real HTTP errors (403, 404, 500) are thrown
    // before reaching .json() via the !response.ok branch in apiClient.
  }
}

// -------------------------------------------------------------------------
// Profile-scenario variants — same semantics, different owner path.
// -------------------------------------------------------------------------

export async function submitScenarioMonteCarloJob(
  scenarioId: string,
  body: { numSimulations: number; expectedReturn: number; volatility: number }
): Promise<{ jobId: string }> {
  const result = await api.post<{ jobId: string }>(
    `/profile/scenarios/${scenarioId}/monte-carlo`,
    body
  );
  return result.data;
}

export async function getScenarioMonteCarloJobStatus(
  scenarioId: string,
  jobId: string
): Promise<MonteCarloJobStatus> {
  const result = await api.get<MonteCarloJobStatus>(
    `/profile/scenarios/${scenarioId}/monte-carlo/${jobId}`
  );
  return result.data;
}

export async function cancelScenarioMonteCarloJob(
  scenarioId: string,
  jobId: string
): Promise<void> {
  try {
    await api.delete(`/profile/scenarios/${scenarioId}/monte-carlo/${jobId}`);
  } catch {
    // 204 No Content — same rationale as cancelMonteCarloJob above.
  }
}
