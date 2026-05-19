/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-argument */
import { createHash } from 'node:crypto';
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as RouterType,
} from 'express';
import { z } from 'zod';
import { validate, paginationSchema, idParamSchema } from '../middleware/validation.js';
import { requireAuth } from '../auth/middleware.js';
import * as projectionService from '../services/projection.service.js';
import {
  runProjection,
  cloneProjectionInput,
  runOptimizationAnalysis,
  runAllPresetBacktests,
  type OptimizationResult,
} from '@retireops/calculation-engine';
import { monteCarloInputSchema, type BacktestResult } from '@retireops/shared';
import { getCache, setCache } from '../utils/redis.js';
import {
  transformToProjectionInput,
  type FrontendInputData,
} from '../services/projection-transformer.js';
import {
  adaptCoupleOutputForOptimization,
  isCoupleProjectionOutput,
} from '../services/optimization-output-adapter.js';

export const projectionRoutes: RouterType = Router();

// All projection routes require authentication
projectionRoutes.use(requireAuth);

// Validation schemas
const createProjectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  inputData: z.object({
    personalInfo: z.object({
      dateOfBirth: z.coerce.date(),
      province: z.string(),
      gender: z.enum(['male', 'female', 'other']).optional(),
      maritalStatus: z.enum(['single', 'married', 'commonLaw', 'divorced', 'widowed']).optional(),
      retirementAge: z.number().int().min(55).max(75),
      lifeExpectancy: z.number().int().min(70).max(110),
      // M005/S05: contribution-room ledger inputs (primary)
      pensionAdjustment: z.number().min(0).optional(),
      spousalRrspContribution: z.number().min(0).optional(),
      fhsaAnnualContribution: z.number().min(0).optional(),
      fhsaLifetimeContributedSeed: z.number().min(0).max(40000).optional(),
      residencyStartYear: z.number().int().min(1900).max(2100).optional(),
    }),
    spouse: z
      .object({
        dateOfBirth: z.coerce.date().optional(),
        province: z.string().optional(),
        retirementAge: z.number().int().min(55).max(75).optional(),
        lifeExpectancy: z.number().int().min(70).max(110).optional(),
        employmentIncome: z.number().min(0).optional(),
        incomeEndAge: z.number().int().min(55).max(75).optional(),
        expectedCppAt65: z.number().min(0).max(20000).optional(),
        cppStartAge: z.number().int().min(60).max(70).optional(),
        oasStartAge: z.number().int().min(65).max(70).optional(),
        yearsOfResidence: z.number().int().min(0).max(50).optional(),
        rrspBalance: z.number().min(0).optional(),
        rrspAnnualContribution: z.number().min(0).optional(),
        tfsaBalance: z.number().min(0).optional(),
        tfsaAnnualContribution: z.number().min(0).optional(),
        nonRegBalance: z.number().min(0).optional(),
        nonRegACB: z.number().min(0).optional(),
        nonRegInterestIncome: z.number().min(0).optional(),
        nonRegEligibleDividends: z.number().min(0).optional(),
        nonRegNonEligibleDividends: z.number().min(0).optional(),
        nonRegRealizedCapitalGains: z.number().min(0).optional(),
        // M005/S05: contribution-room ledger inputs (spouse)
        pensionAdjustment: z.number().min(0).optional(),
        fhsaAnnualContribution: z.number().min(0).optional(),
        fhsaLifetimeContributedSeed: z.number().min(0).max(40000).optional(),
        residencyStartYear: z.number().int().min(1900).max(2100).optional(),
      })
      .optional(),
    coupleSettings: z
      .object({
        optimizePensionSplitting: z.boolean().optional(),
        sharedRetirementSpending: z.number().min(0).optional(),
        useYoungerSpouseForRRIF: z.boolean().optional(),
      })
      .optional(),
    accounts: z.array(
      z.object({
        type: z.enum(['RRSP', 'TFSA', 'RRIF', 'NonRegistered', 'FHSA', 'LIRA', 'LIF']),
        name: z.string().optional(),
        balance: z.number().min(0),
        annualContribution: z.number().min(0).optional(),
        investmentReturnRate: z.number().min(-20).max(20).optional(),
        jurisdiction: z.string().optional(),
        belongsTo: z.enum(['primary', 'spouse']).optional(),
        contributorOwner: z.enum(['primary', 'spouse']).optional(),
        contributionRoom: z.number().min(0).optional(),
        adjustedCostBase: z.number().min(0).optional(),
        annualInterestIncome: z.number().min(0).optional(),
        annualEligibleDividends: z.number().min(0).optional(),
        annualNonEligibleDividends: z.number().min(0).optional(),
        annualRealizedCapitalGains: z.number().min(0).optional(),
      })
    ),
    incomeSources: z.array(
      z.object({
        type: z.enum(['employment', 'selfEmployment', 'pension', 'rental', 'investment', 'other']),
        name: z.string().optional(),
        annualAmount: z.number(),
        startAge: z.number().int().min(0).max(120).optional(),
        endAge: z.number().int().min(0).max(120).optional(),
        isIndexed: z.boolean().optional(),
        indexationRate: z.number().optional(),
      })
    ),
    governmentBenefits: z.object({
      cppStartAge: z.number().int().min(60).max(70),
      oasStartAge: z.number().int().min(65).max(70),
      estimatedCppAmount: z.number().min(0).optional(),
      yearsContributedToCpp: z.number().int().min(0).max(47).optional(),
    }),
    expenses: z.object({
      currentAnnualExpenses: z.number().min(0),
      retirementAnnualExpenses: z.number().min(0),
      oneTimeExpenses: z
        .array(
          z.object({
            description: z.string(),
            amount: z.number(),
            year: z.number().int(),
          })
        )
        .optional(),
    }),
    assumptions: z
      .object({
        inflationRate: z.number().min(0).max(20).optional(),
        investmentReturnRate: z.number().min(-20).max(20).optional(),
      })
      .optional(),
  }),
});

const updateProjectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  inputData: createProjectionSchema.shape.inputData.optional(),
});

// GET /projections - List user's projections
projectionRoutes.get(
  '/',
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectionService.listProjections(req.user!.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /projections - Create new projection
projectionRoutes.post(
  '/',
  validate({ body: createProjectionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projection = await projectionService.createProjection(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        data: projection,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /projections/:id - Get projection details
projectionRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projection = await projectionService.getProjection(
        req.user!.id,
        req.params.id as string
      );
      res.json({
        success: true,
        data: projection,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /projections/:id - Update projection
projectionRoutes.put(
  '/:id',
  validate({ params: idParamSchema, body: updateProjectionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projection = await projectionService.updateProjection(
        req.user!.id,
        req.params.id as string,
        req.body
      );
      res.json({
        success: true,
        data: projection,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /projections/:id - Delete projection
projectionRoutes.delete(
  '/:id',
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await projectionService.deleteProjection(req.user!.id, req.params.id as string);
      res.json({
        success: true,
        message: 'Projection deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /projections/:id/analyze — Tax optimization analysis (Phase 46)
projectionRoutes.get(
  '/:id/analyze',
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectionId = req.params.id as string;
      const cacheKey = `optimization:${projectionId}`;

      // Check Redis cache first
      const cached = await getCache<OptimizationResult>(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }

      // Fetch projection (verifies ownership via projectionService)
      const projection = await projectionService.getProjection(req.user!.id, projectionId);

      // Must be calculated before analysis
      if (projection.status !== 'completed') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'PROJECTION_NOT_READY',
            message: 'Projection must be calculated before analysis',
          },
        });
      }

      // Re-run baseline projection to get ProjectionOutput
      // (DB stores FrontendOutput, not raw ProjectionOutput — see RESEARCH.md Pitfall 3)
      const frontendInput = projection.inputData as FrontendInputData;
      const calcInput = transformToProjectionInput(frontendInput);

      const rawBaselineOutput = runProjection(calcInput);
      const baselineOutput = isCoupleProjectionOutput(rawBaselineOutput)
        ? adaptCoupleOutputForOptimization(rawBaselineOutput)
        : rawBaselineOutput;
      const clonedInput = cloneProjectionInput(calcInput);

      // Run all four optimization analyzers
      const result = runOptimizationAnalysis({
        baselineOutput,
        clonedInput,
        ...(isCoupleProjectionOutput(rawBaselineOutput) && {
          coupleYearlyResults: rawBaselineOutput.yearlyResults,
        }),
      });

      // Cache for 5 minutes
      await setCache(cacheKey, result, 300);

      return res.json({ success: true, data: result });
    } catch (error) {
      next(error);
      return;
    }
  }
);

// GET /projections/:id/backtest
projectionRoutes.get(
  '/:id/backtest',
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const projectionId = req.params.id as string;
      const cacheKey = `backtest:${projectionId}`;

      const cached = await getCache<BacktestResult>(cacheKey);
      if (cached) return res.json({ success: true, data: cached });

      const projection = await projectionService.getProjection(req.user!.id, projectionId);

      if (projection.status !== 'completed') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'PROJECTION_NOT_READY',
            message: 'Projection must be calculated before backtest',
          },
        });
      }

      const frontendInput = projection.inputData as FrontendInputData;
      const calcInput = transformToProjectionInput(frontendInput);

      if (calcInput.spouse !== undefined) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'COUPLE_NOT_SUPPORTED',
            message:
              'Historical backtest is only available for single-person projections in this version',
          },
        });
      }

      const inputDataHash = createHash('sha256').update(JSON.stringify(calcInput)).digest('hex');
      const runs = runAllPresetBacktests(calcInput);
      const result: BacktestResult = {
        projectionId,
        inputDataHash,
        runs,
        computedAt: new Date().toISOString(),
      };

      await setCache(cacheKey, result, 300);
      return res.json({ success: true, data: result });
    } catch (error) {
      next(error);
      return;
    }
  }
);

// POST /projections/:id/calculate - Trigger recalculation
projectionRoutes.post(
  '/:id/calculate',
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projection = await projectionService.runCalculation(
        req.user!.id,
        req.params.id as string
      );
      res.json({
        success: true,
        message: 'Calculation complete',
        data: projection,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Monte Carlo route schemas
const monteCarloBodySchema = monteCarloInputSchema.omit({ projectionId: true });

const mcJobParamSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
});

// POST /projections/:id/monte-carlo — Submit Monte Carlo job
projectionRoutes.post(
  '/:id/monte-carlo',
  validate({ params: idParamSchema, body: monteCarloBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectionService.submitMonteCarloJob(
        req.user!.id,
        req.params.id as string,
        req.body
      );
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// GET /projections/:id/monte-carlo/:jobId — Poll job status
projectionRoutes.get(
  '/:id/monte-carlo/:jobId',
  validate({ params: mcJobParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectionService.getMonteCarloJobStatus(
        req.user!.id,
        req.params.id as string,
        req.params.jobId as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /projections/:id/monte-carlo/:jobId — Cancel job
projectionRoutes.delete(
  '/:id/monte-carlo/:jobId',
  validate({ params: mcJobParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await projectionService.cancelMonteCarloJob(
        req.user!.id,
        req.params.id as string,
        req.params.jobId as string
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
