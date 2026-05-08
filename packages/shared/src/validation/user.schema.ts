/**
 * User Profile Validation Schemas
 * @see docs/source-of-truth/01-user-profile.md
 */
import { z } from 'zod';
import { PROVINCE_CODES } from '../types/province.js';

/**
 * Province validation
 */
export const provinceSchema = z.enum(PROVINCE_CODES as [string, ...string[]]);

/**
 * Marital status validation
 */
export const maritalStatusSchema = z.enum(['single', 'married', 'common_law']);

/**
 * Basic user profile schema
 * @see docs/source-of-truth/01-user-profile.md - Data Requirements
 */
export const userProfileSchema = z
  .object({
    birthdate: z.coerce.date().refine(
      (date) => {
        const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= 18;
      },
      { message: 'User must be at least 18 years old' }
    ),
    province: provinceSchema,
    maritalStatus: maritalStatusSchema,
    lifeExpectancy: z
      .number()
      .int()
      .min(65, 'Life expectancy must be at least 65')
      .max(110, 'Life expectancy cannot exceed 110')
      .default(95),
    plannedRetirementAge: z
      .number()
      .int()
      .min(18, 'Retirement age must be at least 18')
      .max(75, 'Retirement age cannot exceed 75'),
  })
  .refine(
    (data) => {
      const currentAge = Math.floor(
        (Date.now() - data.birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      return data.plannedRetirementAge >= currentAge;
    },
    {
      message: 'Retirement age cannot be earlier than current age',
      path: ['plannedRetirementAge'],
    }
  )
  .refine((data) => data.lifeExpectancy > data.plannedRetirementAge, {
    message: 'Life expectancy must be greater than retirement age',
    path: ['lifeExpectancy'],
  });

/**
 * Spouse profile schema (basic demographics)
 * @see docs/source-of-truth/01-user-profile.md - Spouse Profile
 */
export const spouseProfileSchema = z.object({
  birthdate: z.coerce.date(),
  lifeExpectancy: z.number().int().min(65).max(110).default(95),
  plannedRetirementAge: z.number().int().min(18).max(75),
});

/**
 * Extended spouse input schema for projections
 * @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
export const spouseInputSchema = z.object({
  // Demographics
  birthdate: z.coerce.date(),
  province: provinceSchema.optional(),
  retirementAge: z.number().int().min(18).max(75),
  lifeExpectancy: z.number().int().min(65).max(110).default(95),

  // Employment
  employmentIncome: z.number().min(0).default(0),
  employmentGrowthRate: z.number().min(-0.1).max(0.2).default(0),

  // Government Benefits
  expectedCPPAt65: z.number().min(0).max(20000),
  cppStartAge: z.number().int().min(60).max(70).default(65),
  oasStartAge: z.number().int().min(65).max(70).default(65),
  yearsOfResidence: z.number().int().min(0).max(70).default(40),

  // Registered Accounts
  rrspBalance: z.number().min(0).default(0),
  rrspAnnualContribution: z.number().min(0).default(0),
  rrifBalance: z.number().min(0).default(0),
  liraBalance: z.number().min(0).optional(),
  lifBalance: z.number().min(0).optional(),

  // Tax-Free
  tfsaBalance: z.number().min(0).default(0),
  tfsaAnnualContribution: z.number().min(0).default(0),

  // Non-Registered
  nonRegBalance: z.number().min(0).default(0),
  nonRegACB: z.number().min(0).optional(),
  nonRegAnnualContribution: z.number().min(0).optional(),
});

/**
 * Couple settings schema for projection optimization
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
export const coupleSettingsSchema = z.object({
  optimizePensionSplitting: z.boolean().default(true),
  sharedRetirementSpending: z.number().min(0).optional(),
  useYoungerSpouseForRRIF: z.boolean().default(false),
});

/**
 * Household profile schema - includes spouse validation
 * @see docs/source-of-truth/01-user-profile.md - VR-PROFILE-004
 */
export const householdProfileSchema = z
  .object({
    primary: userProfileSchema,
    spouse: spouseProfileSchema.optional(),
  })
  .refine(
    (data) => {
      // If married or common_law, spouse is required
      if (data.primary.maritalStatus === 'married' || data.primary.maritalStatus === 'common_law') {
        return data.spouse !== undefined;
      }
      return true;
    },
    {
      message: 'Spouse profile is required for married or common-law status',
      path: ['spouse'],
    }
  );

// Schema types (primary types are in types/user.ts)
export type UserProfileInput = z.input<typeof userProfileSchema>;
export type ValidatedUserProfile = z.output<typeof userProfileSchema>;
export type SpouseProfileInput = z.input<typeof spouseProfileSchema>;
export type ValidatedSpouseProfile = z.output<typeof spouseProfileSchema>;
export type HouseholdProfileInput = z.input<typeof householdProfileSchema>;
export type ValidatedHouseholdProfile = z.output<typeof householdProfileSchema>;
export type SpouseInputSchemaType = z.input<typeof spouseInputSchema>;
export type ValidatedSpouseInput = z.output<typeof spouseInputSchema>;
export type CoupleSettingsInput = z.input<typeof coupleSettingsSchema>;
export type ValidatedCoupleSettings = z.output<typeof coupleSettingsSchema>;
