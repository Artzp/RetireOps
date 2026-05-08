/* eslint-disable @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/prefer-optional-chain */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection.js';
import { NotFoundError, AuthorizationError } from '../middleware/error-handler.js';
import { deleteCachePattern, getCache, setCache, deleteCache } from '../utils/redis.js';
import { runProjection } from '@retireops/calculation-engine';
import {
  transformToProjectionInput,
  transformToFrontendOutput,
  type FrontendInputData,
} from './projection-transformer.js';
import { monteCarloQueue } from '../queues.js';
import type {
  MonteCarloJobStatus,
  MonteCarloJobResult,
  MonteCarloJobStatusValue,
} from '@retireops/shared';

/** Local job payload — mirrors MonteCarloJobData in worker without cross-package import */
interface MonteCarloJobPayload {
  ownerType: 'projection';
  projectionId: string;
  jobId: string;
  numSimulations: number;
  expectedReturn: number;
  volatility: number;
  seed?: number;
}

export interface ProjectionListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  calculatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  probabilityOfSuccess?: number;
  peakNetWorth?: number;
  averageRetirementIncome?: number;
  retirementAge?: number;
  dateOfBirth?: string;
}

export interface ProjectionDetail extends ProjectionListItem {
  inputData: unknown;
  resultData: unknown | null;
}

export interface CreateProjectionInput {
  name: string;
  description?: string;
  inputData: unknown;
}

export interface UpdateProjectionInput {
  name?: string;
  description?: string;
  inputData?: unknown;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listProjections(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResult<ProjectionListItem>> {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await db
    .selectFrom('projections')
    .select(db.fn.count('id').as('count'))
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const total = Number(countResult?.count ?? 0);

  // Get projections
  const projections = await db
    .selectFrom('projections')
    .select([
      'id',
      'name',
      'description',
      'status',
      'calculated_at',
      'created_at',
      'updated_at',
      'result_data',
      'input_data',
    ])
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .orderBy('updated_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  const toProjectionListItem = (projection: (typeof projections)[number]): ProjectionListItem => {
    const resultData = projection.result_data as {
      summary?: {
        probabilityOfSuccess?: number;
        peakNetWorth?: number;
        averageRetirementIncome?: number;
      };
    } | null;
    const inputData = projection.input_data as {
      personalInfo?: { retirementAge?: number; dateOfBirth?: string };
    } | null;

    const probabilityOfSuccess = resultData?.summary?.probabilityOfSuccess;
    const peakNetWorth = resultData?.summary?.peakNetWorth;
    const averageRetirementIncome = resultData?.summary?.averageRetirementIncome;
    const retirementAge = inputData?.personalInfo?.retirementAge;
    const dateOfBirth = inputData?.personalInfo?.dateOfBirth;

    return {
      id: projection.id,
      name: projection.name,
      description: projection.description,
      status: projection.status,
      calculatedAt: projection.calculated_at,
      createdAt: projection.created_at,
      updatedAt: projection.updated_at,
      ...(probabilityOfSuccess !== undefined && { probabilityOfSuccess }),
      ...(peakNetWorth !== undefined && { peakNetWorth }),
      ...(averageRetirementIncome !== undefined && { averageRetirementIncome }),
      ...(retirementAge !== undefined && { retirementAge }),
      ...(dateOfBirth !== undefined && { dateOfBirth }),
    };
  };

  return {
    items: projections.map(toProjectionListItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProjection(
  userId: string,
  projectionId: string
): Promise<ProjectionDetail> {
  // Try cache first
  const cacheKey = `projection:${projectionId}`;
  const cached = await getCache<ProjectionDetail>(cacheKey);
  if (cached && cached.id) {
    return cached;
  }

  const projection = await db
    .selectFrom('projections')
    .selectAll()
    .where('id', '=', projectionId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!projection) {
    throw new NotFoundError('Projection');
  }

  if (projection.user_id !== userId) {
    throw new AuthorizationError('You do not have access to this projection');
  }

  const result: ProjectionDetail = {
    id: projection.id,
    name: projection.name,
    description: projection.description,
    status: projection.status,
    inputData: projection.input_data,
    resultData: projection.result_data,
    calculatedAt: projection.calculated_at,
    createdAt: projection.created_at,
    updatedAt: projection.updated_at,
  };

  // Cache for 5 minutes
  await setCache(cacheKey, result, 300);

  return result;
}

export async function createProjection(
  userId: string,
  input: CreateProjectionInput
): Promise<ProjectionDetail> {
  const projection = await db
    .insertInto('projections')
    .values({
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      input_data: input.inputData as never,
      status: 'pending',
    })
    .returning([
      'id',
      'name',
      'description',
      'status',
      'input_data',
      'result_data',
      'calculated_at',
      'created_at',
      'updated_at',
    ])
    .executeTakeFirstOrThrow();

  // Run calculation immediately (Phase 1 synchronous)
  try {
    const frontendInput = input.inputData as FrontendInputData;
    const calcInput = transformToProjectionInput(frontendInput);
    const calcOutput = runProjection(calcInput);
    const frontendOutput = transformToFrontendOutput(
      calcOutput,
      frontendInput.personalInfo.lifeExpectancy
    );
    await updateProjectionResult(projection.id, frontendOutput, 'completed');

    // Return updated projection with results
    return {
      id: projection.id,
      name: projection.name,
      description: projection.description,
      status: 'completed',
      inputData: projection.input_data,
      resultData: frontendOutput,
      calculatedAt: new Date(),
      createdAt: projection.created_at,
      updatedAt: projection.updated_at,
    };
  } catch (error) {
    // Store error and return failed status
    const errorMessage = error instanceof Error ? error.message : 'Unknown calculation error';
    await updateProjectionResult(projection.id, { error: errorMessage }, 'failed');

    return {
      id: projection.id,
      name: projection.name,
      description: projection.description,
      status: 'failed',
      inputData: projection.input_data,
      resultData: { error: errorMessage },
      calculatedAt: new Date(),
      createdAt: projection.created_at,
      updatedAt: projection.updated_at,
    };
  }
}

export async function updateProjection(
  userId: string,
  projectionId: string,
  input: UpdateProjectionInput
): Promise<ProjectionDetail> {
  // Verify access
  await getProjection(userId, projectionId);

  const updateData: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.inputData !== undefined) {
    updateData.input_data = input.inputData;
    updateData.status = 'pending'; // Reset status when input changes
    updateData.result_data = null;
    updateData.calculated_at = null;
  }

  await db.updateTable('projections').set(updateData).where('id', '=', projectionId).execute();

  // Invalidate cache
  await deleteCachePattern(`projection:${projectionId}*`);
  await deleteCache(`optimization:${projectionId}`);
  await deleteCache(`backtest:${projectionId}`);

  return getProjection(userId, projectionId);
}

export async function deleteProjection(userId: string, projectionId: string): Promise<void> {
  // Verify access
  await getProjection(userId, projectionId);

  // Soft delete
  await db
    .updateTable('projections')
    .set({
      deleted_at: new Date(),
      updated_at: new Date(),
    })
    .where('id', '=', projectionId)
    .execute();

  // Invalidate cache
  await deleteCachePattern(`projection:${projectionId}*`);
}

async function updateProjectionResult(
  projectionId: string,
  resultData: unknown,
  status: 'completed' | 'failed'
): Promise<void> {
  await db
    .updateTable('projections')
    .set({
      result_data: resultData as never,
      status,
      calculated_at: new Date(),
      updated_at: new Date(),
    })
    .where('id', '=', projectionId)
    .execute();

  // Invalidate cache
  await deleteCachePattern(`projection:${projectionId}*`);
  await deleteCache(`optimization:${projectionId}`);
  await deleteCache(`backtest:${projectionId}`);
}

/**
 * Submit a Monte Carlo simulation job for a projection.
 *
 * @see docs/TESTABLE-SURFACES.md - TC-MC-API-001
 * @see specs/009-monte-carlo-simulation/contracts/api.md - POST /projections/:id/monte-carlo
 */
export async function submitMonteCarloJob(
  userId: string,
  projectionId: string,
  input: { numSimulations: number; expectedReturn: number; volatility: number; seed?: number }
): Promise<MonteCarloJobStatus> {
  // Verify projection exists and belongs to user (throws NotFoundError / AuthorizationError)
  await getProjection(userId, projectionId);

  // Insert monte_carlo_jobs row
  const jobId = uuidv4();
  await db
    .insertInto('monte_carlo_jobs')
    .values({
      id: jobId,
      projection_id: projectionId,
      status: 'pending',
      iterations: input.numSimulations,
      progress: 0,
      result_data: null as never,
      started_at: null,
      completed_at: null,
      error_message: null,
    })
    .execute();

  // Enqueue BullMQ job (use jobId as BullMQ job name for traceability)
  const payload: MonteCarloJobPayload = {
    ownerType: 'projection',
    projectionId,
    jobId,
    numSimulations: input.numSimulations,
    expectedReturn: input.expectedReturn,
    volatility: input.volatility,
    ...(input.seed !== undefined && { seed: input.seed }),
  };
  await monteCarloQueue.add(`mc-${jobId}`, payload, { jobId });

  return { jobId, status: 'pending', progress: 0 };
}

/**
 * Get Monte Carlo job status and result.
 *
 * @see docs/TESTABLE-SURFACES.md - TC-MC-API-002
 * @see specs/009-monte-carlo-simulation/contracts/api.md - GET /projections/:id/monte-carlo/:jobId
 */
export async function getMonteCarloJobStatus(
  userId: string,
  projectionId: string,
  jobId: string
): Promise<MonteCarloJobStatus> {
  // Verify projection ownership
  await getProjection(userId, projectionId);

  const row = await db
    .selectFrom('monte_carlo_jobs')
    .selectAll()
    .where('id', '=', jobId)
    .where('projection_id', '=', projectionId)
    .executeTakeFirst();

  if (!row) {
    throw new NotFoundError('Monte Carlo job');
  }

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

/**
 * Cancel a Monte Carlo job (set DB status to cancelled, best-effort BullMQ removal).
 *
 * @see docs/TESTABLE-SURFACES.md - TC-MC-API-003
 * @see specs/009-monte-carlo-simulation/contracts/api.md - DELETE /projections/:id/monte-carlo/:jobId
 */
export async function cancelMonteCarloJob(
  userId: string,
  projectionId: string,
  jobId: string
): Promise<void> {
  // Verify projection ownership
  await getProjection(userId, projectionId);

  const row = await db
    .selectFrom('monte_carlo_jobs')
    .select(['id', 'status'])
    .where('id', '=', jobId)
    .where('projection_id', '=', projectionId)
    .executeTakeFirst();

  if (!row) {
    throw new NotFoundError('Monte Carlo job');
  }

  // Set DB status to cancelled
  await db
    .updateTable('monte_carlo_jobs')
    .set({ status: 'cancelled' })
    .where('id', '=', jobId)
    .execute();

  // Attempt to remove from BullMQ queue (best-effort — job may already be processing)
  try {
    const bullJob = await monteCarloQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }
  } catch {
    // Ignore — job may have already completed or been picked up by worker
  }
}

/**
 * Run or re-run calculation for an existing projection
 */
export async function runCalculation(
  userId: string,
  projectionId: string
): Promise<ProjectionDetail> {
  // Get the projection (verifies access)
  const projection = await getProjection(userId, projectionId);

  try {
    const frontendInput = projection.inputData as FrontendInputData;
    const calcInput = transformToProjectionInput(frontendInput);
    const calcOutput = runProjection(calcInput);
    const frontendOutput = transformToFrontendOutput(
      calcOutput,
      frontendInput.personalInfo.lifeExpectancy
    );
    await updateProjectionResult(projectionId, frontendOutput, 'completed');

    // Return updated projection
    return getProjection(userId, projectionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown calculation error';
    await updateProjectionResult(projectionId, { error: errorMessage }, 'failed');

    // Return updated projection with error
    return getProjection(userId, projectionId);
  }
}
