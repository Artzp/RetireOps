import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as RouterType,
} from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import * as referenceService from '../services/reference.service.js';

export const referenceRoutes: RouterType = Router();

// Validation schemas
const yearParam = z.object({
  year: z.coerce.number().int().min(2020).max(2030),
});

const yearAndProvinceParams = z.object({
  year: z.coerce.number().int().min(2020).max(2030),
  province: z.enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']),
});

const lifJurisdictionParam = z.object({
  jurisdiction: z.enum(['federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK']),
});

// GET /reference/tax-tables/:year - Get all tax tables for a year
referenceRoutes.get(
  '/tax-tables/:year',
  validate({ params: yearParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await referenceService.getTaxTables(Number(req.params.year));
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /reference/tax-tables/:year/:province - Get provincial tax table
referenceRoutes.get(
  '/tax-tables/:year/:province',
  validate({ params: yearAndProvinceParams }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await referenceService.getProvincialTaxTable(
        Number(req.params.year),
        (req.params.province as string | undefined) ?? ''
      );
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /reference/benefit-rates/:year - Get CPP/OAS rates
referenceRoutes.get(
  '/benefit-rates/:year',
  validate({ params: yearParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await referenceService.getBenefitRates(Number(req.params.year));
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /reference/account-limits/:year - Get contribution limits
referenceRoutes.get(
  '/account-limits/:year',
  validate({ params: yearParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await referenceService.getAccountLimits(Number(req.params.year));
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /reference/rrif-rates - Get RRIF minimum withdrawal rates
referenceRoutes.get('/rrif-rates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await referenceService.getRRIFMinimumRates();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// GET /reference/provinces - Get list of provinces
referenceRoutes.get('/provinces', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await referenceService.getProvinces();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// GET /reference/lif-rules - Get all LIF rules by jurisdiction
referenceRoutes.get('/lif-rules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await referenceService.getAllLIFRulesData();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// GET /reference/lif-rules/:jurisdiction - Get LIF rules for specific jurisdiction
referenceRoutes.get(
  '/lif-rules/:jurisdiction',
  validate({ params: lifJurisdictionParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jurisdiction = req.params.jurisdiction as
        | 'federal'
        | 'AB'
        | 'BC'
        | 'MB'
        | 'NB'
        | 'NL'
        | 'NS'
        | 'ON'
        | 'PE'
        | 'QC'
        | 'SK';
      const data = await referenceService.getLIFRulesForJurisdiction(jurisdiction);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);
