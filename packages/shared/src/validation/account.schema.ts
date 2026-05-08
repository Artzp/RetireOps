/**
 * Account Validation Schemas
 * @see docs/source-of-truth/02-account-types.md
 */
import { z } from 'zod';

/**
 * Account type enum
 */
export const accountTypeSchema = z.enum([
  'rrsp',
  'rrif',
  'tfsa',
  'non_registered',
  'lira',
  'lif',
  'fhsa',
]);

/**
 * Account owner enum (matches AccountOwner in types/accounts.ts)
 */
export const accountOwnerSchema = z.enum(['primary', 'spouse']);

/**
 * Base account schema
 */
export const baseAccountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  type: accountTypeSchema,
  balance: z.number().min(0),
  owner: accountOwnerSchema,
  institution: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
});

/**
 * RRSP account object (raw shape — participates in the discriminated union).
 * Public consumers should prefer `rrspAccountSchema`, which applies the
 * contributor default and refinement.
 */
export const rrspAccountObjectSchema = baseAccountSchema.extend({
  type: z.literal('rrsp'),
  contributionRoom: z.number().min(0).optional(),
  unusedRoom: z.number().min(0).optional(),
  isSpousal: z.boolean().default(false),
  /**
   * Spousal RRSPs require the contributing spouse for 3-year attribution.
   * Optional on input — defaults are filled by the transform below.
   */
  contributor: accountOwnerSchema.optional(),
});

/**
 * RRSP account schema
 * Applies contributor defaults: spousal → 'primary'; non-spousal → owner.
 * Use `.default()` is unsuitable here — the default depends on `isSpousal` and
 * `owner`, so it must be computed post-parse via `.transform()`.
 * @see docs/source-of-truth/02-account-types.md - RRSP Section
 */
export const rrspAccountSchema = rrspAccountObjectSchema
  .transform((account) => ({
    ...account,
    contributor: account.contributor ?? (account.isSpousal ? 'primary' : account.owner),
  }))
  .refine((account) => !(account.isSpousal && account.contributor === account.owner), {
    message:
      'Spousal RRSP contributor cannot be the same as the annuitant/owner ' +
      '(set isSpousal=false, or change contributor or owner so they differ)',
    path: ['contributor'],
  });

/**
 * RRIF account schema
 * @see docs/source-of-truth/02-account-types.md - RRIF Section
 */
export const rrifAccountSchema = baseAccountSchema.extend({
  type: z.literal('rrif'),
  conversionYear: z.number().int().min(2000).max(2100).optional(),
  minimumWithdrawalRate: z.number().min(0).max(1).optional(),
});

/**
 * TFSA account schema
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 */
export const tfsaAccountSchema = baseAccountSchema.extend({
  type: z.literal('tfsa'),
  contributionRoom: z.number().min(0).optional(),
  lifetimeContributionRoom: z.number().min(0).optional(),
});

/**
 * Non-registered account schema
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
export const nonRegisteredAccountSchema = baseAccountSchema.extend({
  type: z.literal('non_registered'),
  adjustedCostBase: z.number().min(0).default(0),
  unrealizedGains: z.number().default(0),
  bookValue: z.number().min(0).optional(),
  annualInterestIncome: z.number().min(0).optional(),
  annualEligibleDividends: z.number().min(0).optional(),
  annualNonEligibleDividends: z.number().min(0).optional(),
  annualRealizedCapitalGains: z.number().min(0).optional(),
});

/**
 * LIF jurisdiction codes (governing pension legislation)
 */
export const lifJurisdictionSchema = z.enum([
  'federal',
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'ON',
  'PE',
  'QC',
  'SK',
]);

/**
 * LIRA account schema
 * @see docs/source-of-truth/02-account-types.md - LIRA/LIF Section
 */
export const liraAccountSchema = baseAccountSchema.extend({
  type: z.literal('lira'),
  sourceProvince: lifJurisdictionSchema.optional(), // Governing jurisdiction
  lockedInUntilAge: z.number().int().min(50).max(71).default(55),
});

/**
 * LIF account schema
 * @see docs/source-of-truth/02-account-types.md - LIF Section
 */
export const lifAccountSchema = baseAccountSchema.extend({
  type: z.literal('lif'),
  governingJurisdiction: lifJurisdictionSchema.default('federal'),
  conversionYear: z.number().int().min(2000).max(2100).optional(),
  useYoungerSpouseAge: z.boolean().default(false),
  hasUsedOneTimeUnlock: z.boolean().default(false),
});

/**
 * FHSA account schema
 * @see docs/source-of-truth/02-account-types.md - FHSA Section
 */
export const fhsaAccountSchema = baseAccountSchema.extend({
  type: z.literal('fhsa'),
  contributionRoom: z.number().min(0).max(40000).optional(),
  yearOpened: z.number().int().min(2023).optional(),
});

/**
 * Union of all account schemas
 */
export const accountSchema = z.discriminatedUnion('type', [
  rrspAccountObjectSchema,
  rrifAccountSchema,
  tfsaAccountSchema,
  nonRegisteredAccountSchema,
  liraAccountSchema,
  lifAccountSchema,
  fhsaAccountSchema,
]);

/**
 * Account contribution schema
 */
export const accountContributionSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.coerce.date().optional(),
  source: z.enum(['employment', 'transfer', 'other']).optional(),
});

/**
 * Account withdrawal schema
 */
export const accountWithdrawalSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.coerce.date().optional(),
  purpose: z.enum(['retirement_income', 'emergency', 'large_purchase', 'other']).optional(),
  taxWithheld: z.number().min(0).optional(),
});

/**
 * RRSP contribution validation with limits
 */
export const validateRRSPContribution = z
  .object({
    contributionAmount: z.number().positive(),
    contributionRoom: z.number().min(0),
    age: z.number().int().min(18).max(100),
    year: z.number().int().min(2024),
  })
  .refine((data) => data.contributionAmount <= data.contributionRoom, {
    message: 'Contribution exceeds available RRSP room',
  })
  .refine((data) => data.age <= 71, { message: 'Cannot contribute to RRSP after age 71' });

/**
 * TFSA contribution validation with limits
 */
export const validateTFSAContribution = z
  .object({
    contributionAmount: z.number().positive(),
    contributionRoom: z.number().min(0),
    year: z.number().int().min(2024),
  })
  .refine((data) => data.contributionAmount <= data.contributionRoom, {
    message: 'Contribution exceeds available TFSA room',
  });

// Schema inferred types (for validation use - primary types are in types/accounts.ts)
export type AccountSchemaType = z.infer<typeof accountTypeSchema>;
export type BaseAccountSchema = z.infer<typeof baseAccountSchema>;
export type AccountContribution = z.infer<typeof accountContributionSchema>;
export type AccountWithdrawal = z.infer<typeof accountWithdrawalSchema>;
