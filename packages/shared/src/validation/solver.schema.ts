/**
 * Solver Input Zod Schema — v1.12 Reverse Calculator
 *
 * Provides a discriminated-union Zod schema for validating SolverInput payloads,
 * keyed on the `mode` field. Produces field-level error messages on invalid
 * per-mode field combinations.
 *
 * Cross-field refinement (e.g. targetRetirementAge >= currentAge + 1) is intentionally
 * NOT implemented here — it is scoped to Phase 53 API validation per
 * specs/008-reverse-calculator/tasks.md T004.
 *
 * @see specs/008-reverse-calculator/data-model.md
 * @see packages/shared/src/types/solver.ts
 */
import { z } from 'zod';
import { provinceSchema } from './user.schema.js';

/**
 * Common base field shapes shared by all four solver modes.
 * Used as a spread into each mode-specific z.object() call.
 */
const solverInputBaseShape = {
  province: provinceSchema,
  dateOfBirth: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  currentAge: z.number().int().min(18).max(120),
  lifeExpectancy: z.number().int().min(50).max(110).default(90),
  rrspBalance: z.number().min(0),
  tfsaBalance: z.number().min(0),
  nonRegBalance: z.number().min(0),
  employmentIncome: z.number().min(0),
  cppStartAge: z.number().int().min(60).max(70).default(65),
  oasStartAge: z.number().int().min(65).max(70).default(65),
  investmentReturnRate: z.number().min(0).max(0.15).default(0.05),
  inflationRate: z.number().min(0).max(0.1).default(0.02),
};

/**
 * Mode 1: Required Savings
 * Adds targetRetirementAge and retirementSpending to the base shape.
 */
export const RequiredSavingsInputSchema = z.object({
  ...solverInputBaseShape,
  mode: z.literal('required-savings'),
  targetRetirementAge: z.number().int().min(19).max(80),
  retirementSpending: z.number().min(1000).max(500_000),
});

/**
 * Mode 2: Sustainable Spending
 * Adds retirementAge to the base shape.
 */
export const SustainableSpendingInputSchema = z.object({
  ...solverInputBaseShape,
  mode: z.literal('sustainable-spending'),
  retirementAge: z.number().int().min(18).max(80),
});

/**
 * Mode 3: Earliest Retirement Age
 * Adds annualSavingsRate and retirementSpending to the base shape.
 */
export const EarliestRetirementAgeInputSchema = z.object({
  ...solverInputBaseShape,
  mode: z.literal('earliest-retirement-age'),
  annualSavingsRate: z.number().min(0).max(250_000),
  retirementSpending: z.number().min(1000).max(500_000),
});

/**
 * Mode 4: Required Total Savings
 * The three balance fields (rrspBalance, tfsaBalance, nonRegBalance) are optional
 * in Mode 4 only — overrides the required base shape fields.
 * Spread order: base shape first, then overrides so optional versions take precedence.
 */
export const RequiredTotalSavingsInputSchema = z.object({
  ...solverInputBaseShape,
  mode: z.literal('required-total-savings'),
  targetRetirementAge: z.number().int().min(19).max(80),
  retirementSpending: z.number().min(1000).max(500_000),
  // Override base shape: balance fields are optional for Mode 4
  rrspBalance: z.number().min(0).optional(),
  tfsaBalance: z.number().min(0).optional(),
  nonRegBalance: z.number().min(0).optional(),
});

/**
 * Discriminated-union schema for SolverInput, keyed on the `mode` field.
 *
 * This is the primary entry point for runtime validation of solver payloads.
 * Consumed by the API in Phase 53 and by unit tests in solver.schema.test.ts.
 */
export const SolverInputSchema = z.discriminatedUnion('mode', [
  RequiredSavingsInputSchema,
  SustainableSpendingInputSchema,
  EarliestRetirementAgeInputSchema,
  RequiredTotalSavingsInputSchema,
]);
