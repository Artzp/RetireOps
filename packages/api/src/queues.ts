/**
 * BullMQ Queue instances for the API package.
 *
 * The API uses these queues to enqueue jobs; the worker package
 * consumes them. Both connect to the same Redis instance.
 *
 * @see packages/worker/src/queues.ts - Worker-side queue definitions (shared Redis config)
 */
import { Queue } from 'bullmq';
import { redis } from './utils/redis.js';

export const monteCarloQueue = new Queue('monte-carlo', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 7200, count: 50 },
    removeOnFail: { age: 86400 },
  },
});
