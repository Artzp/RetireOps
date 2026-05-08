/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Integration Test Setup
 *
 * Configures the test environment for integration tests.
 * Uses in-memory database and mocked auth, but real calculation engine.
 */
import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { mockDb } from './helpers/mock-db.js';
import { TEST_USER } from './helpers/test-app.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-32chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock database connection BEFORE other imports
vi.mock('../db/connection.js', () => ({
  db: mockDb,
}));

// Mock Redis (same as unit tests)
vi.mock('../utils/redis.js', () => {
  const mockRedis = {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
  };

  return {
    redis: mockRedis,
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn().mockResolvedValue(undefined),
    deleteCache: vi.fn().mockResolvedValue(undefined),
    deleteCachePattern: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock auth middleware to inject test user
vi.mock('../auth/middleware.js', () => ({
  requireAuth: vi.fn((req, _res, next) => {
    // Check if Authorization header is present
    const authHeader = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      // Create error object directly without requiring module
      const error = new Error('No token provided') as Error & { statusCode: number; code: string };
      error.statusCode = 401;
      error.code = 'AUTHENTICATION_ERROR';
      error.name = 'AuthenticationError';
      return next(error);
    }
    // Inject test user
    req.user = TEST_USER;
    next();
  }),
  optionalAuth: vi.fn((req, _res, next) => {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      req.user = TEST_USER;
    }
    next();
  }),
}));

// Mock logger to avoid console noise
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    port: 3000,
    nodeEnv: 'test',
    jwtSecret: 'test-secret-key-for-testing-purposes-32chars',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    redisUrl: 'redis://localhost:6379',
    corsOrigin: 'http://localhost:3001',
    googleClientId: 'test-google-client-id',
    googleClientSecret: 'test-google-client-secret',
    googleRedirectUri: 'http://localhost:3000/api/auth/google/callback',
  },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

// DO NOT mock:
// - @retireops/calculation-engine (we want real calculations)
// - ../services/projection-transformer.js (we want real transformations)
// - ../services/projection.service.js (we want real service logic)

beforeAll(() => {
  // Any setup needed before all tests
});

afterEach(() => {
  // Reset mock database after each test
  mockDb.reset();
  // Clear all mock call counts
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
});

// Export for use in tests
export { mockDb, TEST_USER };
