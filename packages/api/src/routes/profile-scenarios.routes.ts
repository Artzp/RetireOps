/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
/**
 * Profile Scenarios Routes
 *
 * REST endpoints for scenario management:
 *   GET    /api/profile/scenarios            — list all (metadata only)
 *   GET    /api/profile/scenarios/:id        — get single (includes result_data)
 *   POST   /api/profile/scenarios            — create blank non-base scenario
 *   POST   /api/profile/scenarios/compare    — compare 2-4 completed scenarios
 *   POST   /api/profile/scenarios/:id/clone  — clone scenario
 *   POST   /api/profile/scenarios/:id/run    — run single scenario projection
 *   PUT    /api/profile/scenarios/:id/decisions — merge-patch decisions JSONB
 *   PATCH  /api/profile/scenarios/:id        — rename non-base scenario
 *   DELETE /api/profile/scenarios/:id        — delete non-base scenario
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-06, SCEN-07, D-05, D-06, D-01–D-03, D-15–D-16
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as RouterType,
} from 'express';
import { z } from 'zod';
import {
  ScenarioDecisionsSchema,
  monteCarloInputSchema,
  scenarioDecisionTemplates,
} from '@retireops/shared';
import type { ScenarioDecisions } from '@retireops/shared';
import { validate } from '../middleware/validation.js';
import { requireAuth } from '../auth/middleware.js';
import * as profileScenarioService from '../services/profile-scenario.service.js';
import * as scenarioMonteCarloService from '../services/scenario-monte-carlo.service.js';
import * as scenarioBacktestService from '../services/scenario-backtest.service.js';
import * as scenarioStressTestService from '../services/scenario-stress-test.service.js';
import { analyzeScenario } from '../services/scenario-optimization.service.js';

export const profileScenariosRoutes: RouterType = Router();

// All routes require authentication
profileScenariosRoutes.use(requireAuth);

const scenarioIdParam = z.object({ id: z.string().uuid() });
const scenarioNameBody = z.object({ name: z.string().min(1).max(100) });
const decisionsBodySchema = ScenarioDecisionsSchema.partial();

/**
 * POST /api/profile/scenarios
 * Creates a blank non-base scenario with the given name.
 */
profileScenariosRoutes.post(
  '/',
  validate({ body: scenarioNameBody }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenario = await profileScenarioService.createProfileScenario(
        req.user!.id,
        req.body.name
      );
      res.status(201).json({ success: true, data: scenario });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/scenarios/compare
 * Compare 2–4 completed profile scenarios.
 * Base Scenario is always the delta reference column even if not in the requested IDs.
 * Must be registered BEFORE parameterized routes to avoid Express path conflicts.
 *
 * @see docs/source-of-truth/10-scenarios.md - D-15, D-16
 */
const compareBody = z.object({ ids: z.array(z.string().uuid()).min(2).max(4) });

profileScenariosRoutes.post(
  '/compare',
  validate({ body: compareBody }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comparison = await profileScenarioService.compareProfileScenarios(
        req.user!.id,
        req.body.ids
      );
      res.json({ success: true, data: comparison });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/profile/scenarios/templates
 * Returns the list of predefined scenario decision templates.
 * Must be registered BEFORE /:id to avoid Express path conflicts.
 */
profileScenariosRoutes.get('/templates', (_req: Request, res: Response) => {
  res.json({ success: true, data: scenarioDecisionTemplates });
});

/**
 * POST /api/profile/scenarios/from-template
 * Creates a non-base scenario pre-filled with a template's decisions.
 * Body: { templateId: string, name: string }
 * Must be registered BEFORE /:id parameterized routes.
 */
const fromTemplateBody = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(100),
});

profileScenariosRoutes.post(
  '/from-template',
  validate({ body: fromTemplateBody }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenario = await profileScenarioService.createProfileScenarioFromTemplate(
        req.user!.id,
        req.body.templateId,
        req.body.name
      );
      res.status(201).json({ success: true, data: scenario });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/profile/scenarios
 * Returns all scenarios for the authenticated user's profile (metadata only, no result_data).
 */
profileScenariosRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarios = await profileScenarioService.listProfileScenarios(req.user!.id);
    res.json({ success: true, data: scenarios });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/profile/scenarios/:id
 * Returns the full scenario record including result_data.
 */
profileScenariosRoutes.get(
  '/:id',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenario = await profileScenarioService.getProfileScenario(
        req.user!.id,
        req.params.id!
      );
      res.json({ success: true, data: scenario });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/profile/scenarios/:id
 * Renames a non-base scenario. Returns 409 if target is the Base Scenario.
 */
profileScenariosRoutes.patch(
  '/:id',
  validate({ params: scenarioIdParam, body: scenarioNameBody }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenario = await profileScenarioService.renameProfileScenario(
        req.user!.id,
        req.params.id!,
        req.body.name
      );
      res.json({ success: true, data: scenario });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/scenarios/:id/clone
 * Creates a deep copy of a scenario with name suffixed "(copy)" and is_base=false.
 */
profileScenariosRoutes.post(
  '/:id/clone',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clone = await profileScenarioService.cloneProfileScenario(req.user!.id, req.params.id!);
      res.status(201).json({ success: true, data: clone });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/scenarios/:id/run
 * Runs a single profile scenario synchronously.
 * Returns the updated scenario with result_data and status='completed' on success.
 * On error: sets status='failed' and returns 500.
 *
 * @see docs/source-of-truth/10-scenarios.md - D-01, D-02, D-03
 */
profileScenariosRoutes.post(
  '/:id/run',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenario = await profileScenarioService.runSingleScenario(req.user!.id, req.params.id!);
      res.json({ success: true, data: scenario });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/scenarios/:id/preview-decisions
 * Runs a non-persistent preview with a partial decisions patch.
 * Does not update decisions, status, calculated_at, or result_data.
 */
profileScenariosRoutes.post(
  '/:id/preview-decisions',
  validate({ params: scenarioIdParam, body: decisionsBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preview = await profileScenarioService.previewScenarioDecisions(
        req.user!.id,
        req.params.id!,
        req.body as Partial<ScenarioDecisions>
      );
      res.json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/profile/scenarios/:id
 * Deletes a non-base scenario. Returns 409 if target is the Base Scenario.
 */
profileScenariosRoutes.delete(
  '/:id',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await profileScenarioService.deleteProfileScenario(req.user!.id, req.params.id!);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/profile/scenarios/:id/decisions
 * Merge-patches the decisions JSONB for a scenario.
 * Sets status to 'stale' — result_data is invalidated.
 * Body is a partial ScenarioDecisions object.
 */
profileScenariosRoutes.put(
  '/:id/decisions',
  validate({ params: scenarioIdParam, body: decisionsBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await profileScenarioService.updateScenarioDecisions(
        req.user!.id,
        req.params.id!,
        req.body as Partial<ScenarioDecisions>
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------------------------
// Monte Carlo routes — mirror POST/GET/DELETE /api/projections/:id/monte-carlo
// but target the profile_scenarios owner. Body schema reuses the shared MC
// input schema with projectionId stripped (id comes from the URL path).
// -------------------------------------------------------------------------

const mcBodySchema = monteCarloInputSchema.omit({ projectionId: true });

const mcJobParamSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
});

profileScenariosRoutes.post(
  '/:id/monte-carlo',
  validate({ params: scenarioIdParam, body: mcBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await scenarioMonteCarloService.submitScenarioMonteCarloJob(
        req.user!.id,
        req.params.id!,
        req.body
      );
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

profileScenariosRoutes.get(
  '/:id/monte-carlo/:jobId',
  validate({ params: mcJobParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await scenarioMonteCarloService.getScenarioMonteCarloJobStatus(
        req.user!.id,
        req.params.id!,
        req.params.jobId!
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

profileScenariosRoutes.delete(
  '/:id/monte-carlo/:jobId',
  validate({ params: mcJobParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await scenarioMonteCarloService.cancelScenarioMonteCarloJob(
        req.user!.id,
        req.params.id!,
        req.params.jobId!
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------------------------
// Historical Backtesting routes — v1.14 Phase 61
// POST /:id/backtest  — run all 3 presets, cache + return BacktestResult
// GET  /:id/backtest  — return cached result (404 if none yet)
// -------------------------------------------------------------------------

/**
 * POST /api/profile/scenarios/:id/backtest
 * Runs all 3 historical preset backtests synchronously and caches the result.
 * Returns { data: BacktestResult, isStale: false }.
 */
profileScenariosRoutes.post(
  '/:id/backtest',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await scenarioBacktestService.runScenarioBacktest(
        req.user!.id,
        req.params.id!
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/profile/scenarios/:id/backtest
 * Returns cached BacktestResult with isStale flag.
 * 404 if no backtest has been run yet.
 */
profileScenariosRoutes.get(
  '/:id/backtest',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await scenarioBacktestService.getScenarioBacktest(
        req.user!.id,
        req.params.id!
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------------------------
// Stress Testing route — Feature 3.3
// POST /:id/stress-test — run all 4 scenarios, return chart-ready payload
// -------------------------------------------------------------------------

/**
 * POST /api/profile/scenarios/:id/stress-test
 * Runs all 4 stress-test scenarios synchronously.
 * Returns { results: StressTestResult[] } — no caching (deterministic + fast).
 *
 * @see docs/source-of-truth/06-investment-engine.md — Stress Test Scenarios Table
 * @see TC-ST-006, TC-ST-007
 */
profileScenariosRoutes.post(
  '/:id/stress-test',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await scenarioStressTestService.runScenarioStressTest(
        req.user!.id,
        req.params.id!
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------------------------
// Tax Optimization Analysis — M005 Phase 1
// GET /:id/analyze — run 4 analyzers and return InsightCard[]
// -------------------------------------------------------------------------

/**
 * GET /api/profile/scenarios/:id/analyze
 * Runs the tax-optimization orchestrator against this scenario's inputs.
 * @see docs/source-of-truth/ — CARD-01..CARD-05
 */
profileScenariosRoutes.get(
  '/:id/analyze',
  validate({ params: scenarioIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await analyzeScenario(req.user!.id, req.params.id!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);
