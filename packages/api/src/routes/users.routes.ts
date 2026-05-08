/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-argument */
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
import * as userService from '../services/user.service.js';

export const userRoutes: RouterType = Router();

// All user routes require authentication
userRoutes.use(requireAuth);

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const updateSettingsSchema = z.object({
  province: z
    .enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])
    .optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  maritalStatus: z
    .enum(['single', 'married', 'commonLaw', 'divorced', 'widowed'])
    .nullable()
    .optional(),
  retirementAge: z.number().int().min(55).max(75).nullable().optional(),
  lifeExpectancy: z.number().int().min(70).max(110).nullable().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notificationsEnabled: z.boolean().optional(),
});

/**
 * Spouse settings validation schema
 * @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
 */
const updateSpouseSettingsSchema = z.object({
  dateOfBirth: z.coerce.date().nullable().optional(),
  lifeExpectancy: z.number().int().min(70).max(110).nullable().optional(),
  retirementAge: z.number().int().min(55).max(75).nullable().optional(),
  province: z
    .enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])
    .nullable()
    .optional(),
  expectedCppAt65: z.number().min(0).max(20000).nullable().optional(),
  cppStartAge: z.number().int().min(60).max(70).nullable().optional(),
  oasStartAge: z.number().int().min(65).max(70).nullable().optional(),
  yearsOfResidence: z.number().int().min(0).max(50).nullable().optional(),
  employmentIncome: z.number().min(0).nullable().optional(),
  employmentGrowthRate: z.number().min(-0.1).max(0.2).nullable().optional(),
});

// GET /users/me - Get current user profile
userRoutes.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getUserProfile(req.user!.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /users/me - Update user profile
userRoutes.put(
  '/me',
  validate({ body: updateProfileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await userService.updateProfile(req.user!.id, req.body);
      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /users/me/settings - Update user settings
userRoutes.put(
  '/me/settings',
  validate({ body: updateSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await userService.updateSettings(req.user!.id, req.body);
      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /users/me - Delete account (GDPR compliance)
userRoutes.delete('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await userService.deleteAccount(req.user!.id);
    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/me/data-export - Export all user data (GDPR compliance)
userRoutes.get('/me/data-export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await userService.exportUserData(req.user!.id);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Spouse Settings Routes
// @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
// ============================================================================

// GET /users/me/spouse - Get spouse settings
userRoutes.get('/me/spouse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spouseSettings = await userService.getSpouseSettings(req.user!.id);
    res.json({
      success: true,
      data: spouseSettings,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /users/me/spouse - Update spouse settings
userRoutes.put(
  '/me/spouse',
  validate({ body: updateSpouseSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const spouseSettings = await userService.updateSpouseSettings(req.user!.id, req.body);
      res.json({
        success: true,
        data: spouseSettings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /users/me/spouse - Remove spouse settings
userRoutes.delete('/me/spouse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await userService.deleteSpouseSettings(req.user!.id);
    res.json({
      success: true,
      message: 'Spouse settings removed successfully',
    });
  } catch (error) {
    next(error);
  }
});
