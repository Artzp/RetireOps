/* eslint-disable @typescript-eslint/restrict-template-expressions */
/**
 * Test Application Factory
 *
 * Creates an Express app configured for integration testing.
 */
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { projectionRoutes } from '../../routes/projections.routes.js';
import { profileRoutes } from '../../routes/profile.routes.js';
import { profileScenariosRoutes } from '../../routes/profile-scenarios.routes.js';
import { solverRoutes } from '../../routes/solver.routes.js';
import { errorHandler } from '../../middleware/error-handler.js';

// Test user for authentication
export const TEST_USER = {
  id: 'test-user-uuid-1234-5678-abcd',
  email: 'test@example.com',
};

/**
 * Creates Express app with mocked auth for testing
 */
export function createTestApp(): Express {
  const app = express();

  // Body parsing middleware
  app.use(express.json());

  // Add correlation ID for error handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.correlationId = `test-${Date.now()}`;
    next();
  });

  // Mount projection routes at /api/projections
  app.use('/api/projections', projectionRoutes);

  // Mount profile scenarios routes BEFORE /api/profile to avoid /:step param capturing 'scenarios'
  app.use('/api/profile/scenarios', profileScenariosRoutes);

  // Mount profile routes at /api/profile
  app.use('/api/profile', profileRoutes);

  // Mount solver routes at /api/solver
  app.use('/api/solver', solverRoutes);

  // Error handler
  app.use(errorHandler);

  return app;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}
