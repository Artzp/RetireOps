/**
 * Income Source Validation Schemas
 * @see docs/source-of-truth/03-income-sources.md
 */
import { z } from 'zod';

/**
 * Income source type enum
 */
export const incomeSourceTypeSchema = z.enum([
  'employment',
  'self_employment',
  'pension',
  'cpp',
  'qpp',
  'oas',
  'gis',
  'rental',
  'dividends',
  'interest',
  'capital_gains',
  'annuity',
  'other',
]);

/**
 * Income frequency enum
 */
export const incomeFrequencySchema = z.enum([
  'annual',
  'monthly',
  'biweekly',
  'weekly',
  'one_time',
]);

/**
 * Base income source schema
 */
export const baseIncomeSourceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  type: incomeSourceTypeSchema,
  annualAmount: z.number().min(0),
  frequency: incomeFrequencySchema.default('annual'),
  startAge: z.number().int().min(0).max(100).optional(),
  endAge: z.number().int().min(0).max(120).optional(),
  indexedToInflation: z.boolean().default(false),
  inflationRate: z.number().min(0).max(0.2).optional(),
  taxable: z.boolean().default(true),
});

/**
 * Employment income schema
 * @see docs/source-of-truth/03-income-sources.md - Employment Income
 */
export const employmentIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.literal('employment'),
  employer: z.string().max(100).optional(),
  growthRate: z.number().min(-0.1).max(0.2).default(0.02),
  hasPension: z.boolean().default(false),
  pensionContributionRate: z.number().min(0).max(0.3).optional(),
});

/**
 * Pension income schema
 * @see docs/source-of-truth/03-income-sources.md - Pension Income
 */
export const pensionIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.literal('pension'),
  pensionType: z.enum(['db', 'dc', 'hybrid']).default('db'),
  bridgeBenefit: z.number().min(0).optional(),
  bridgeEndAge: z.number().int().min(60).max(70).optional(),
  survivorBenefit: z.number().min(0).max(1).optional(), // Percentage for spouse
  commutedValue: z.number().min(0).optional(),
  eligibleForSplitting: z.boolean().default(true),
});

/**
 * CPP/QPP income schema
 * @see docs/source-of-truth/05-government-benefits.md - CPP Section
 */
export const cppIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.enum(['cpp', 'qpp']),
  estimatedAt65: z.number().min(0).max(20000),
  startAge: z.number().int().min(60).max(70).default(65),
  isPostRetirementBenefit: z.boolean().default(false),
  yearsContributed: z.number().int().min(0).max(47).optional(),
});

/**
 * OAS income schema
 * @see docs/source-of-truth/05-government-benefits.md - OAS Section
 */
export const oasIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.literal('oas'),
  yearsOfResidence: z.number().int().min(0).max(50).default(40),
  startAge: z.number().int().min(65).max(70).default(65),
  isDeferred: z.boolean().default(false),
});

/**
 * GIS income schema
 * @see docs/source-of-truth/05-government-benefits.md - GIS Section
 */
export const gisIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.literal('gis'),
  maritalStatus: z.enum(['single', 'married', 'common_law']),
  spouseReceivingOAS: z.boolean().optional(),
});

/**
 * Rental income schema
 * @see docs/source-of-truth/03-income-sources.md - Rental Income
 */
export const rentalIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.literal('rental'),
  grossRentalIncome: z.number().min(0),
  expenses: z.number().min(0).default(0),
  mortgageInterest: z.number().min(0).default(0),
  propertyTaxes: z.number().min(0).default(0),
  depreciation: z.number().min(0).default(0),
});

/**
 * Investment income schema
 * @see docs/source-of-truth/03-income-sources.md - Investment Income
 */
export const investmentIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.enum(['dividends', 'interest', 'capital_gains']),
  isEligibleDividend: z.boolean().optional(),
  isForeignIncome: z.boolean().default(false),
  foreignTaxPaid: z.number().min(0).optional(),
});

/**
 * Annuity income schema
 */
export const annuityIncomeSchema = baseIncomeSourceSchema.extend({
  type: z.literal('annuity'),
  annuityType: z.enum(['life', 'term_certain', 'joint_survivor']).default('life'),
  guaranteedPeriod: z.number().int().min(0).max(30).optional(),
  purchasePrice: z.number().min(0).optional(),
  eligibleForPensionCredit: z.boolean().default(true),
});

/**
 * Union of all income source schemas
 */
export const incomeSourceSchema = z.union([
  employmentIncomeSchema,
  pensionIncomeSchema,
  cppIncomeSchema,
  oasIncomeSchema,
  gisIncomeSchema,
  rentalIncomeSchema,
  investmentIncomeSchema,
  annuityIncomeSchema,
  baseIncomeSourceSchema,
]);

/**
 * Income projection input
 */
export const incomeProjectionInputSchema = z.object({
  incomeSources: z.array(incomeSourceSchema),
  startYear: z.number().int().min(2024).max(2100),
  endYear: z.number().int().min(2024).max(2150),
  inflationRate: z.number().min(0).max(0.1).default(0.025),
});

/**
 * Annual income summary
 */
export const annualIncomeSummarySchema = z.object({
  year: z.number().int(),
  age: z.number().int(),
  employmentIncome: z.number().min(0),
  pensionIncome: z.number().min(0),
  governmentBenefits: z.number().min(0),
  investmentIncome: z.number().min(0),
  rentalIncome: z.number().min(0),
  otherIncome: z.number().min(0),
  totalGrossIncome: z.number().min(0),
  taxableIncome: z.number().min(0),
});

// Schema inferred types (for validation use - primary types are in types/income.ts)
export type IncomeSourceType = z.infer<typeof incomeSourceTypeSchema>;
export type IncomeFrequency = z.infer<typeof incomeFrequencySchema>;
export type BaseIncomeSourceSchema = z.infer<typeof baseIncomeSourceSchema>;
export type EmploymentIncomeSchema = z.infer<typeof employmentIncomeSchema>;
export type PensionIncomeSchema = z.infer<typeof pensionIncomeSchema>;
export type CPPIncomeSchema = z.infer<typeof cppIncomeSchema>;
export type OASIncomeSchema = z.infer<typeof oasIncomeSchema>;
export type GISIncomeSchema = z.infer<typeof gisIncomeSchema>;
export type RentalIncomeSchema = z.infer<typeof rentalIncomeSchema>;
export type InvestmentIncomeSchema = z.infer<typeof investmentIncomeSchema>;
export type AnnuityIncomeSchema = z.infer<typeof annuityIncomeSchema>;
export type IncomeSourceSchema = z.infer<typeof incomeSourceSchema>;
export type IncomeProjectionInput = z.infer<typeof incomeProjectionInputSchema>;
export type AnnualIncomeSummary = z.infer<typeof annualIncomeSummarySchema>;
