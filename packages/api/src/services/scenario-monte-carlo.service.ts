/**
 * Monte Carlo jobs for profile scenarios.
 * Analogous to submit/getStatus/cancel in projection.service.ts, but owned
 * by a row in profile_scenarios instead of projections.
 *
 * @see packages/api/src/db/migrate.ts - monte_carlo_jobs.profile_scenario_id
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { monteCarloQueue } from '../queues.js';
import type {
  MonteCarloJobStatus,
  MonteCarloJobResult,
  MonteCarloJobStatusValue,
} from '@retireops/shared';

/** Payload mirrors worker's MonteCarloJobData — extended with ownerType/scenarioId */
interface ScenarioMonteCarloJobPayload {
  ownerType: 'projection' | 'scenario';
  projectionId?: string;
  profileScenarioId?: string;
  jobId: string;
  numSimulations: number;
  expectedReturn: number;
  volatility: number;
  seed?: number;
}

async function resolveProfileId(userId: string): Promise<string> {
  const profile = await db
    .selectFrom('household_profiles')
    .select(['id'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!profile) throw new NotFoundError('Profile');
  return profile.id;
}

async function verifyScenarioOwnership(userId: string, scenarioId: string): Promise<void> {
  const profileId = await resolveProfileId(userId);
  const scenario = await db
    .selectFrom('profile_scenarios')
    .select(['id'])
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenario) throw new NotFoundError('Scenario');
}

export async function submitScenarioMonteCarloJob(
  userId: string,
  scenarioId: string,
  input: { numSimulations: number; expectedReturn: number; volatility: number; seed?: number }
): Promise<MonteCarloJobStatus> {
  await verifyScenarioOwnership(userId, scenarioId);

  const jobId = uuidv4();
  await db
    .insertInto('monte_carlo_jobs')
    .values({
      id: jobId,
      projection_id: null,
      profile_scenario_id: scenarioId,
      status: 'pending',
      iterations: input.numSimulations,
      progress: 0,
      result_data: null as never,
      started_at: null,
      completed_at: null,
      error_message: null,
    })
    .execute();

  const payload: ScenarioMonteCarloJobPayload = {
    ownerType: 'scenario',
    profileScenarioId: scenarioId,
    jobId,
    numSimulations: input.numSimulations,
    expectedReturn: input.expectedReturn,
    volatility: input.volatility,
    ...(input.seed !== undefined && { seed: input.seed }),
  };
  await monteCarloQueue.add(`mc-${jobId}`, payload, { jobId });

  return { jobId, status: 'pending', progress: 0 };
}

export async function getScenarioMonteCarloJobStatus(
  userId: string,
  scenarioId: string,
  jobId: string
): Promise<MonteCarloJobStatus> {
  await verifyScenarioOwnership(userId, scenarioId);

  const row = await db
    .selectFrom('monte_carlo_jobs')
    .selectAll()
    .where('id', '=', jobId)
    .where('profile_scenario_id', '=', scenarioId)
    .executeTakeFirst();

  if (!row) throw new NotFoundError('Monte Carlo job');

  const status = row.status as MonteCarloJobStatusValue;
  const result = status === 'completed' ? (row.result_data as MonteCarloJobResult) : undefined;
  const error = status === 'failed' ? (row.error_message ?? undefined) : undefined;

  return {
    jobId: row.id,
    status,
    progress: row.progress,
    ...(result !== undefined && { result }),
    ...(error !== undefined && { error }),
  };
}

export async function cancelScenarioMonteCarloJob(
  userId: string,
  scenarioId: string,
  jobId: string
): Promise<void> {
  await verifyScenarioOwnership(userId, scenarioId);

  const row = await db
    .selectFrom('monte_carlo_jobs')
    .select(['id'])
    .where('id', '=', jobId)
    .where('profile_scenario_id', '=', scenarioId)
    .executeTakeFirst();
  if (!row) throw new NotFoundError('Monte Carlo job');

  await db
    .updateTable('monte_carlo_jobs')
    .set({ status: 'cancelled' })
    .where('id', '=', jobId)
    .execute();

  try {
    const bullJob = await monteCarloQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }
  } catch {
    // Best-effort; worker may have already picked up or removed it.
  }
}
