import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

// Create Redis connection for queues
export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queue definitions
export const projectionQueue = new Queue('projection-calculation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100,
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

// NOTE: the former 'scenario-comparison' queue was removed (audit C-07).
// Scenario comparison is synchronous in the API
// (packages/api/src/services/profile-scenario.service.ts compareProfileScenarios);
// nothing ever enqueued to the queue and its worker unconditionally threw.

export const monteCarloQueue = new Queue('monte-carlo', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2, // Monte Carlo is expensive, limit retries
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 7200, // Keep for 2 hours
      count: 50,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

// Queue event handlers
const projectionEvents = new QueueEvents('projection-calculation', {
  connection: redisConnection,
});

projectionEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info('Projection calculation completed', { jobId, returnvalue });
});

projectionEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Projection calculation failed', { jobId, failedReason });
});

const monteCarloEvents = new QueueEvents('monte-carlo', {
  connection: redisConnection,
});

monteCarloEvents.on('progress', ({ jobId, data }) => {
  logger.debug('Monte Carlo progress', { jobId, progress: data });
});

monteCarloEvents.on('completed', ({ jobId }) => {
  logger.info('Monte Carlo simulation completed', { jobId });
});

monteCarloEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Monte Carlo simulation failed', { jobId, failedReason });
});
