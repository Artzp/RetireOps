import { Worker } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { redisConnection } from './queues.js';
import { db } from './db.js';
import { processProjectionJob } from './processors/projection.processor.js';
import { processMonteCarloJob } from './processors/monte-carlo.processor.js';

logger.info('Starting RetireOps Worker', {
  concurrency: config.WORKER_CONCURRENCY,
  environment: config.NODE_ENV,
});

// Projection calculation worker
const projectionWorker = new Worker('projection-calculation', processProjectionJob, {
  connection: redisConnection,
  concurrency: config.WORKER_CONCURRENCY,
});

projectionWorker.on('ready', () => {
  logger.info('Projection worker ready');
});

projectionWorker.on('error', (err) => {
  logger.error('Projection worker error', { error: err.message });
});

// NOTE: the former 'scenario-comparison' worker was removed (audit C-07).
// It unconditionally threw "not implemented" and no API route ever enqueued
// to its queue — comparison is synchronous in profile-scenario.service.ts.

// Monte Carlo worker (lower concurrency due to CPU intensity)
const monteCarloWorker = new Worker('monte-carlo', processMonteCarloJob, {
  connection: redisConnection,
  concurrency: Math.max(1, Math.floor(config.WORKER_CONCURRENCY / 2)),
});

monteCarloWorker.on('ready', () => {
  logger.info('Monte Carlo worker ready');
});

monteCarloWorker.on('error', (err) => {
  logger.error('Monte Carlo worker error', { error: err.message });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await Promise.all([projectionWorker.close(), monteCarloWorker.close()]);
    logger.info('Workers closed');

    await db.destroy();
    logger.info('Database connection closed');

    await redisConnection.quit();
    logger.info('Redis connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

logger.info('All workers started successfully');
