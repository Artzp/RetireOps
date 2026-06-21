import type { Job } from 'bullmq';
import { runProjection } from '@retireops/calculation-engine';
import type { ProjectionInput } from '@retireops/shared';
import { logger } from '../logger.js';
import { getProjectionCalculatedAt, updateProjectionResult } from '../db.js';

export interface ProjectionJobData {
  projectionId: string;
  userId: string;
  inputData: ProjectionInput;
}

export interface ProjectionJobResult {
  success: boolean;
  projectionId: string;
  calculatedAt: Date;
  summary?: {
    peakNetWorth: number;
    portfolioLongevity: number;
    totalTaxesPaid: number;
    averageRetirementIncome: number;
  };
}

/**
 * Retry idempotency guard (audit C-08).
 *
 * The projection DB write and the BullMQ ack live in different stores: a crash
 * between them re-delivers the job (stalled → wait) and a thrown error after a
 * successful write retries it (attemptsMade > 0). In both cases recalculating
 * would overwrite a result that is already at least as new as this job's
 * payload — and could clobber a NEWER result written by a subsequent job for
 * the same projection.
 *
 * Skip recalculation when BOTH hold:
 *   1. This delivery is a retry (a previous attempt failed, or the job stalled
 *      mid-processing — `stalledCounter` covers the crash-after-write case
 *      where BullMQ does NOT increment `attemptsMade`).
 *   2. The stored row's calculated_at postdates the job's enqueue timestamp
 *      (job.timestamp), i.e. a completed calculation already reflects state
 *      newer than this job.
 *
 * First deliveries always recalculate so a freshly enqueued job with updated
 * input can never be skipped.
 */
export function shouldSkipRecalculation(input: {
  attemptsMade: number;
  stalledCounter: number;
  enqueuedAtMs: number;
  calculatedAt: Date | null;
}): boolean {
  const isRetry = input.attemptsMade > 0 || input.stalledCounter > 0;
  if (!isRetry) return false;
  if (input.calculatedAt === null) return false;
  return input.calculatedAt.getTime() > input.enqueuedAtMs;
}

export async function processProjectionJob(
  job: Job<ProjectionJobData, ProjectionJobResult>
): Promise<ProjectionJobResult> {
  const { projectionId, inputData } = job.data;

  // Audit C-08: on retry, consult the stored row before recalculating.
  if (job.attemptsMade > 0 || job.stalledCounter > 0) {
    const calculatedAt = await getProjectionCalculatedAt(projectionId);
    if (
      shouldSkipRecalculation({
        attemptsMade: job.attemptsMade,
        stalledCounter: job.stalledCounter,
        enqueuedAtMs: job.timestamp,
        calculatedAt,
      })
    ) {
      logger.info(
        'Skipping projection recalculation on retry: stored result postdates job enqueue',
        {
          jobId: job.id,
          projectionId,
          calculatedAt,
          enqueuedAt: new Date(job.timestamp),
          attemptsMade: job.attemptsMade,
          stalledCounter: job.stalledCounter,
        }
      );
      return {
        success: true,
        projectionId,
        // Guard ensures calculatedAt is non-null here
        calculatedAt: calculatedAt as Date,
      };
    }
  }

  logger.info('Starting projection calculation', {
    jobId: job.id,
    projectionId,
  });

  const startTime = Date.now();

  try {
    // Run the projection calculation
    const result = runProjection(inputData);

    // Use the summary already computed by the projection engine
    const { peakNetWorth, totalTaxesPaid, averageRetirementIncome, portfolioLongevityAge } =
      result.summary;
    const portfolioLongevity = portfolioLongevityAge ?? inputData.lifeExpectancy;

    // Store result in database
    await updateProjectionResult(projectionId, {
      yearlyResults: result.yearlyResults,
      summary: {
        peakNetWorth,
        portfolioLongevity,
        totalTaxesPaid,
        averageRetirementIncome,
      },
    });

    const duration = Date.now() - startTime;
    logger.info('Projection calculation completed', {
      jobId: job.id,
      projectionId,
      duration: `${String(duration)}ms`,
    });

    return {
      success: true,
      projectionId,
      calculatedAt: new Date(),
      summary: {
        peakNetWorth,
        portfolioLongevity,
        totalTaxesPaid,
        averageRetirementIncome,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Projection calculation failed', {
      jobId: job.id,
      projectionId,
      duration: `${String(duration)}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update database with failure status
    await updateProjectionResult(projectionId, null, 'failed');

    throw error;
  }
}
