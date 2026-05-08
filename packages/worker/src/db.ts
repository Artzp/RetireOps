import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

// Simplified database interface for worker
interface Database {
  projections: {
    id: string;
    input_data: unknown;
    result_data: unknown;
    status: string;
    calculated_at: Date | null;
    updated_at: Date;
  };
  scenarios: {
    id: string;
    result_data: unknown;
    status: string;
    calculated_at: Date | null;
    updated_at: Date;
  };
  monte_carlo_jobs: {
    id: string;
    projection_id: string | null;
    profile_scenario_id: string | null;
    status: string;
    progress: number;
    result_data: unknown;
    started_at: Date | null;
    completed_at: Date | null;
    error_message: string | null;
  };
  profile_scenarios: {
    id: string;
    result_data: unknown;
    status: string;
    calculated_at: Date | null;
    updated_at: Date;
  };
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DATABASE_URL,
    max: 5, // Worker needs fewer connections
  }),
});

export const db = new Kysely<Database>({ dialect });

export async function updateProjectionResult(
  projectionId: string,
  resultData: unknown,
  status: 'completed' | 'failed' = 'completed'
): Promise<void> {
  try {
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
  } catch (error) {
    logger.error('Failed to update projection result', {
      projectionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function updateMonteCarloProgress(jobId: string, progress: number): Promise<void> {
  try {
    await db.updateTable('monte_carlo_jobs').set({ progress }).where('id', '=', jobId).execute();
  } catch (error) {
    logger.error('Failed to update Monte Carlo progress', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function updateMonteCarloResult(
  jobId: string,
  resultData: unknown,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    await db
      .updateTable('monte_carlo_jobs')
      .set({
        result_data: resultData as never,
        status,
        progress: status === 'completed' ? 100 : undefined,
        completed_at: new Date(),
        error_message: errorMessage ?? null,
      })
      .where('id', '=', jobId)
      .execute();
  } catch (error) {
    logger.error('Failed to update Monte Carlo result', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
