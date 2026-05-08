/**
 * Contribution-Room Ledger Validation Schemas (M005/S01)
 * @see docs/source-of-truth/02-account-types.md
 */
import { z } from 'zod';
import { FHSA_LIMITS } from '../constants/limits.js';

const CURRENT_YEAR = new Date().getFullYear();

export const ledgerAccountTypeSchema = z.enum(['rrsp', 'tfsa', 'fhsa']);

export const ledgerWarningKindSchema = z.enum(['over-contribution', 'lifetime-cap-exceeded']);

export const accountOwnerLedgerSchema = z.enum(['primary', 'spouse']);

/**
 * LedgerWarning schema — one entry per rule-violation event per year.
 */
export const ledgerWarningSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  person: accountOwnerLedgerSchema,
  accountType: ledgerAccountTypeSchema,
  kind: ledgerWarningKindSchema,
  message: z.string().min(1),
  penaltyAmount: z.number().min(0),
});

/**
 * OverContributionPenalty schema — all fields non-negative.
 */
export const overContributionPenaltySchema = z.object({
  rrsp: z.number().min(0),
  tfsa: z.number().min(0),
  fhsa: z.number().min(0),
});

const rrspSubLedgerSchema = z.object({
  roomAvailable: z.number().min(0),
});

const tfsaSubLedgerSchema = z.object({
  roomAvailable: z.number().min(0),
  cumulativeCapBaseline: z.number().min(0),
});

const fhsaSubLedgerSchema = z
  .object({
    annualRoomRemaining: z.number().min(0),
    carryForwardAvailable: z.number().min(0),
    lifetimeContributed: z.number().min(0),
  })
  .refine((d) => d.lifetimeContributed <= FHSA_LIMITS.lifetimeLimit, {
    message: `FHSA lifetimeContributed cannot exceed the lifetime limit of ${FHSA_LIMITS.lifetimeLimit.toString()} at seed`,
    path: ['lifetimeContributed'],
  });

/**
 * ContributionRoomLedger schema — hard-rejects negative room and FHSA lifetime-cap violations at seed.
 */
export const contributionRoomLedgerSchema = z.object({
  rrsp: rrspSubLedgerSchema,
  tfsa: tfsaSubLedgerSchema,
  fhsa: fhsaSubLedgerSchema,
});

/**
 * LedgerYearInput schema — minimal per-year input for the pure contribution-room helper.
 * Hard-rejects: non-negative contributions and PA; residencyStartYear must not be in the future.
 */
export const ledgerYearInputSchema = z
  .object({
    year: z.number().int().min(2000).max(2200),
    person: accountOwnerLedgerSchema,
    earnedIncome: z.number().min(0),
    pensionAdjustment: z.number().min(0),
    rrspContribution: z.number().min(0),
    tfsaContribution: z.number().min(0),
    fhsaContribution: z.number().min(0),
    residencyStartYear: z.number().int().min(1900).max(2200).optional(),
  })
  .refine((d) => d.residencyStartYear === undefined || d.residencyStartYear <= CURRENT_YEAR, {
    message: 'residencyStartYear cannot be in the future',
    path: ['residencyStartYear'],
  });

export type LedgerWarningSchema = z.infer<typeof ledgerWarningSchema>;
export type OverContributionPenaltySchema = z.infer<typeof overContributionPenaltySchema>;
export type ContributionRoomLedgerSchema = z.infer<typeof contributionRoomLedgerSchema>;
export type LedgerYearInputSchema = z.infer<typeof ledgerYearInputSchema>;
