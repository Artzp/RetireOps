import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/index.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { projectionRoutes } from './routes/projections.routes.js';
import { referenceRoutes } from './routes/reference.routes.js';
import { metricsRoutes } from './routes/metrics.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { profileScenariosRoutes } from './routes/profile-scenarios.routes.js';
import { solverRoutes } from './routes/solver.routes.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    })
  );

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request logging
  app.use(requestLogger);

  // Rate limiting (skip for health checks)
  const rateLimiter = createRateLimiter();
  app.use('/api', rateLimiter);

  // Routes
  app.use('/health', healthRoutes);
  app.use('/metrics', metricsRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projections', projectionRoutes);
  app.use('/api/reference', referenceRoutes);
  app.use('/api/profile/scenarios', profileScenariosRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/solver', solverRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
