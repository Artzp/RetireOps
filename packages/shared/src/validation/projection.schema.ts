/**
 * Projection Input Validation Schemas
 * @see docs/source-of-truth/11-development-roadmap.md - Phase 1 Data Inputs
 */
import { z } from 'zod';
import { provinceSchema } from './user.schema.js';
import { FHSA_LIMITS } from '../constants/limits.js';

/**
 * Phase 1 MVP Projection Input Schema
 * @see docs/source-of-truth/11-development-roadmap.md - Phase1Input interface
 */
// Base object schema (without refinements) - used for .partial()
export const projectionInputBaseSchema = z.object({
  // Profile
  birthdate: z.coerce.date(),
  province: provinceSchema,
  retirementAge: z.number().int().min(18).max(75),
  lifeExpectancy: z.number().int().min(65).max(110).default(95),

  // Income
  employmentIncome: z.number().min(0),
  employmentGrowthRate: z.number().min(-0.1).max(0.2).default(0.02),
  pensionIncome: z.number().min(0).default(0),
  bridgeBenefit: z.number().min(0).optional(),
  bridgeEndAge: z.number().int().min(60).max(70).optional(),

  // Accounts
  rrspBalance: z.number().min(0).default(0),
  rrspAnnualContribution: z.number().min(0).default(0),
  pensionAdjustment: z.number().min(0).default(0),
  spousalRrspContribution: z.number().min(0).default(0),
  tfsaBalance: z.number().min(0).default(0),
  tfsaAnnualContribution: z.number().min(0).default(0),
  fhsaAnnualContribution: z.number().nonnegative().optional(),
  fhsaLifetimeContributedSeed: z.number().nonnegative().max(FHSA_LIMITS.lifetimeLimit).optional(),
  nonRegBalance: z.number().min(0).default(0),
  nonRegACB: z.number().min(0).optional(),
  nonRegInterestIncome: z.number().min(0).optional(),
  nonRegEligibleDividends: z.number().min(0).optional(),
  nonRegNonEligibleDividends: z.number().min(0).optional(),
  nonRegRealizedCapitalGains: z.number().min(0).optional(),

  // Retirement
  retirementSpending: z.number().min(0),

  // Assumptions
  investmentReturn: z.number().min(0).max(0.15).default(0.05),
  inflationRate: z.number().min(0).max(0.1).default(0.025),

  // Phase 2 additions (optional)
  expectedCPPAt65: z.number().min(0).max(20000).optional(),
  cppStartAge: z.number().int().min(60).max(70).default(65),
  oasStartAge: z.number().int().min(65).max(70).default(65),
});

// Full schema with refinements
export const projectionInputSchema = projectionInputBaseSchema
  .refine(
    (data) => {
      const currentAge = Math.floor(
        (Date.now() - data.birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      return data.retirementAge >= currentAge;
    },
    {
      message: 'Retirement age cannot be earlier than current age',
      path: ['retirementAge'],
    }
  )
  .refine((data) => data.lifeExpectancy > data.retirementAge, {
    message: 'Life expectancy must be greater than retirement age',
    path: ['lifeExpectancy'],
  });

/**
 * Scenario modification schema
 * @see docs/source-of-truth/10-scenarios.md
 */
export const scenarioModificationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  modifications: projectionInputBaseSchema.partial(),
});

// Schema types (primary ProjectionInput type is in types/projection.ts)
export type ProjectionInputData = z.input<typeof projectionInputSchema>;
export type ValidatedProjectionInput = z.output<typeof projectionInputSchema>;
export type ScenarioModification = z.output<typeof scenarioModificationSchema>;
