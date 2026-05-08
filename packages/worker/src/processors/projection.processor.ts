import type { Job } from 'bullmq';
import { runProjection } from '@retireops/calculation-engine';
import type { ProjectionInput } from '@retireops/shared';
import { logger } from '../logger.js';
import { updateProjectionResult } from '../db.js';

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

export async function processProjectionJob(
  job: Job<ProjectionJobData, ProjectionJobResult>
): Promise<ProjectionJobResult> {
  const { projectionId, inputData } = job.data;

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
