/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/require-await */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as RouterType,
} from 'express';
import { SolverInputSchema, type SolverInput } from '@retireops/shared';
import { requireAuth } from '../auth/middleware.js';
import { UnprocessableEntityError } from '../middleware/error-handler.js';
import * as solverService from '../services/solver.service.js';

export const solverRoutes: RouterType = Router();

// All solver routes require authentication
solverRoutes.use(requireAuth);

// GET /api/solver/prefill — return 8 pre-fill fields from household profile or null
solverRoutes.get('/prefill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const prefill = await solverService.getPrefillData(userId);
    res.status(200).json({ success: true, data: prefill });
  } catch (error) {
    next(error);
  }
});

// POST /api/solver — validate input with SolverInputSchema, call solveSingle, return SolverResult
solverRoutes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SolverInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new UnprocessableEntityError(
        'Solver input validation failed',
        parsed.error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }))
      );
    }
    // Cast is safe: SolverInputSchema validates all fields including ProvinceCode values;
    // Zod type inference is less specific than SolverInput due to the province enum cast.
    const result = solverService.runSolver(parsed.data as unknown as SolverInput);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
