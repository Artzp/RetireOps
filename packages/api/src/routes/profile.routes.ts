/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-non-null-assertion */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as RouterType,
} from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { requireAuth } from '../auth/middleware.js';
import * as profileService from '../services/profile.service.js';
import { assembleProfileInputData } from '../services/profile-assembler.js';
import { createProjection } from '../services/projection.service.js';

export const profileRoutes: RouterType = Router();

// All profile routes require authentication
profileRoutes.use(requireAuth);

// Validation schemas
const patchStepSchema = z.object({
  currentStep: z.number().int().min(0).max(8),
  data: z.union([z.record(z.unknown()), z.array(z.unknown())]),
});

const stepParamSchema = z.object({
  step: z.enum(profileService.VALID_STEPS),
});

/**
 * GET /api/profile
 * Returns the household profile for the authenticated user.
 * Returns 404 if no profile exists yet.
 */
profileRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const profile = await profileService.getProfile(userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/profile/:step
 * Upsert a single wizard step. Creates the profile row if it does not exist.
 * Returns the full profile after the update.
 */
profileRoutes.patch(
  '/:step',
  validate({ params: stepParamSchema, body: patchStepSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const step = req.params.step as profileService.StepSlug;
      const { currentStep, data } = req.body as z.infer<typeof patchStepSchema>;
      const profile = await profileService.upsertProfileStep(userId, step, data, currentStep);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/calculate
 * Assembles profile data into FrontendInputData, runs projection, stores snapshot.
 * Returns ProjectionDetail.
 * @see .planning/phases/11-profile-data-flow/11-CONTEXT.md - D-04, D-05
 */
profileRoutes.post('/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const profile = await profileService.getProfile(userId);
    const inputData = assembleProfileInputData(profile);
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
    const name = `Profile Snapshot — ${formattedDate}`;
    const projection = await createProjection(userId, { name, inputData });
    res.status(201).json({ success: true, data: projection });
  } catch (error) {
    next(error);
  }
});
