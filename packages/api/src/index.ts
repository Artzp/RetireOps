/**
 * @retireops/api
 * Express API Gateway for RetireOps Canadian Retirement Planning
 */

export { createApp } from './app.js';
export { config } from './config/index.js';
export { db } from './db/connection.js';
export { redis } from './utils/redis.js';
export { logger } from './utils/logger.js';

// Export types
export type { Database } from './db/schema.js';
export type { TokenPayload, TokenPair } from './auth/jwt.js';

// Export error classes
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from './middleware/error-handler.js';
