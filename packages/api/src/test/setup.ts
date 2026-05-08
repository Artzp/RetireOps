/**
 * Test Setup
 *
 * Configures the test environment before running tests.
 * This file is automatically loaded by vitest via setupFiles config.
 */
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-32chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Redis
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

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

beforeAll(() => {
  // Any setup needed before all tests
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
});
