/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { sql } from 'kysely';
import { db } from '../db/connection.js';
import { redis } from '../utils/redis.js';

export const healthRoutes: RouterType = Router();

// Basic health check
healthRoutes.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'retireops-api',
  });
});

// Readiness check - verifies all dependencies are ready
healthRoutes.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check database
  const dbStart = Date.now();
  try {
    await sql`SELECT 1`.execute(db);
    checks.database = { status: 'healthy', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const isHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Liveness check - basic check that the service is running
healthRoutes.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
