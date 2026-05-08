import { z } from 'zod';

const DEVELOPMENT_JWT_SECRET = 'development-secret-key-change-in-production-32chars';

function normalizeEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return {
    ...env,
    DATABASE_POOL_MIN: env.DATABASE_POOL_MIN ?? env.DB_POOL_MIN,
    DATABASE_POOL_MAX: env.DATABASE_POOL_MAX ?? env.DB_POOL_MAX,
    JWT_ACCESS_TOKEN_EXPIRES_IN: env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? env.JWT_EXPIRES_IN,
    JWT_REFRESH_TOKEN_EXPIRES_IN: env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? env.JWT_REFRESH_EXPIRES_IN,
    CORS_ORIGIN: env.CORS_ORIGIN ?? env.ALLOWED_ORIGINS,
  };
}

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().default('postgresql://retireops:retireops@localhost:5432/retireops'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32).default(DEVELOPMENT_JWT_SECRET),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(normalizeEnv(process.env));

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  if (result.data.NODE_ENV === 'production' && result.data.JWT_SECRET === DEVELOPMENT_JWT_SECRET) {
    console.error('JWT_SECRET must be set to a strong unique value in production.');
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

// Helper to check if we're in production
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';
