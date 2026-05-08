/**
 * Scenario Decisions — strategy overrides applied on top of a Household Profile.
 * All fields optional: undefined/null means "use profile default".
 * A present field means "override with this value".
 *
 * NOTE: This is for profile_scenarios (v1.3), NOT the legacy projection-based scenarios table.
 * @see .planning/phases/17-schema-assembler-foundation/17-CONTEXT.md - D-09, D-10
 */
import { z } from 'zod';

// -------------------------------------------------------------------------
// Phase 1 override enums (D-01)
// -------------------------------------------------------------------------

/**
 * Withdrawal override field discriminator (D-01).
 * @see docs/source-of-truth/02-account-types.md
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01
 *
 * Note: 'nonreg' is the canonical override field literal even though AccountType
 * uses 'non_registered' and the drawdown order uses 'nonReg'. Engine adapters
 * map between these three spellings. LIRA is intentionally excluded — LIRA is
 * contribution-locked and cannot be a withdrawal target in this phase.
 */
export const WithdrawalOverrideField = z.enum(['rrsp', 'rrif', 'lif', 'tfsa', 'nonreg']);
export type WithdrawalOverrideField = z.infer<typeof WithdrawalOverrideField>;

/**
 * Override owner discriminator. Distinguishes which person an override applies to
 * in a couple projection. Pre-existing records (written before this discriminator
 * was added) parse with the default 'primary', preserving their behavior — every
 * Phase 1 override was implicitly primary-scoped.
 */
export const OverrideOwner = z.enum(['primary', 'spouse']);
export type OverrideOwner = z.infer<typeof OverrideOwner>;

// -------------------------------------------------------------------------
// Zod Schema (source of truth — type is inferred)
// -------------------------------------------------------------------------

export const ScenarioDecisionsSchema = z.object({
  // --- Timing ---
  retirementAge: z.number().int().min(50).max(75).optional(),
  lifeExpectancy: z.number().int().min(65).max(110).optional(),
  spouseRetirementAge: z.number().int().min(50).max(75).optional(),
  spouseLifeExpectancy: z.number().int().min(65).max(110).optional(),
  cppStartAge: z.number().int().min(60).max(70).optional(),
  oasStartAge: z.number().int().min(65).max(70).optional(),
  spouseCppStartAge: z.number().int().min(60).max(70).optional(),
  spouseOasStartAge: z.number().int().min(65).max(70).optional(),
  expectedCPPAt65: z.number().min(0).max(25_000).optional(),
  spouseExpectedCPPAt65: z.number().min(0).max(25_000).optional(),
  yearsOfResidence: z.number().int().min(0).max(70).optional(),
  spouseYearsOfResidence: z.number().int().min(0).max(70).optional(),
  dbPensionStartAge: z.number().int().min(55).max(75).optional(),
  propertySaleDecisions: z
    .array(
      z.object({
        propertyId: z.string(),
        saleYear: z.number().int(),
        sellingCostsPercent: z.number().min(0).max(1),
      })
    )
    .optional(),

  // --- Tax Strategy ---
  drawdownOrder: z.array(z.string()).optional(),
  strategyId: z.enum(['standard', 'tfsaFirst', 'oasProtection', 'bracketFilling']).optional(),
  rrspMeltdown: z
    .object({
      enabled: z.boolean(),
      annualAmount: z.number().min(0),
      startYear: z.number().int(),
      endYear: z.number().int(),
      targetAmount: z.number().min(0).optional(),
    })
    .optional(),
  incomeSplitting: z
    .object({
      enabled: z.boolean(),
      splitPercent: z.number().min(0).max(1),
    })
    .optional(),
  oasClawbackAvoidance: z
    .object({
      enabled: z.boolean(),
      incomeThreshold: z.number().min(0),
    })
    .optional(),
  bracketFill: z
    .object({
      enabled: z.boolean(),
      bracketTarget: z.enum(['current', 'next']).optional(),
      annualCap: z.number().min(0).optional(),
    })
    .optional(),

  // --- Savings ---
  contributionOverrides: z
    .array(
      z
        .object({
          accountId: z.string().optional(),
          accountType: z.enum(['rrsp', 'tfsa', 'nonreg']).optional(),
          annualAmount: z.number().min(0),
          startYear: z.number().int(),
          endYear: z.number().int(),
        })
        .refine((value) => value.accountId !== undefined || value.accountType !== undefined, {
          message: 'Either accountId or accountType is required',
        })
    )
    .optional(),
  investmentReturn: z.number().min(0).max(0.2).optional(),

  // --- Spending ---
  targetRetirementSpending: z.number().min(0).optional(),
  inflationRate: z.number().min(0).max(0.2).optional(),
  ageBandReductions: z
    .array(
      z.object({
        fromAge: z.number().int().min(60).max(100),
        reductionPercent: z.number().min(0).max(1),
      })
    )
    .optional(),
  legacyTarget: z.number().min(0).optional(),

  // --- Phase 1 overrides (additive — @see .planning/phases/01-editable-overrides/) ---

  /**
   * Per-year, per-account-type withdrawal overrides (OVER-01, OVER-03, OVER-04).
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-04, D-05, D-07
   * @see docs/source-of-truth/07-withdrawal-strategies.md
   * Engine semantics: amount is in real (today's) dollars (D-06); engine inflates
   * to nominal. applyForward=true means this override stays active until the next
   * (field, year) override for the same field (D-07). Duplicate (field, year)
   * tuples rejected at save (D-04). Array capped at 200 records (T-01 mitigation).
   */
  withdrawalOverrides: z
    .array(
      z.object({
        field: WithdrawalOverrideField,
        year: z.number().int().min(1900).max(2200),
        amount: z.number().min(0).max(10_000_000).finite(),
        applyForward: z.boolean(),
        owner: OverrideOwner.default('primary'),
        createdAt: z.string().datetime().optional(),
        updatedAt: z.string().datetime().optional(),
        originalEngineValue: z.number().min(0).max(10_000_000).finite().optional(),
      })
    )
    .max(200, { message: 'Too many withdrawal overrides (max 200)' })
    .superRefine((arr, ctx) => {
      // Reject duplicate (owner, field, year) tuples — per-owner uniqueness lets
      // a primary and a spouse override coexist for the same field/year.
      const seen = new Set<string>();
      for (const [i, o] of arr.entries()) {
        const key = `${o.owner}:${o.field}:${String(o.year)}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i],
            message: `Duplicate withdrawal override: owner=${o.owner}, field=${o.field}, year=${String(o.year)}`,
          });
        }
        seen.add(key);
      }
    })
    .optional(),

  /**
   * Per-year base-spending overrides (OVER-02).
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-02, D-04, D-05, D-20, D-21
   * Engine semantics: amount is in real (today's) dollars (D-06). Override replaces
   * both targetRetirementSpending AND ageBandReductions for its apply-forward window
   * (D-20). Years outside the window still apply ageBandReductions (D-21).
   * Array capped at 200 records (T-01 mitigation).
   */
  spendingOverrides: z
    .array(
      z.object({
        year: z.number().int().min(1900).max(2200),
        amount: z.number().min(0).max(10_000_000).finite(),
        applyForward: z.boolean(),
        owner: OverrideOwner.default('primary'),
        createdAt: z.string().datetime().optional(),
        updatedAt: z.string().datetime().optional(),
        originalEngineValue: z.number().min(0).max(10_000_000).finite().optional(),
      })
    )
    .max(200, { message: 'Too many spending overrides (max 200)' })
    .superRefine((arr, ctx) => {
      // Reject duplicate (owner, year) — per-owner uniqueness so each spouse can
      // have their own per-year spending override.
      const seen = new Set<string>();
      for (const [i, o] of arr.entries()) {
        const key = `${o.owner}:${String(o.year)}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i],
            message: `Duplicate spending override: owner=${o.owner}, year=${String(o.year)}`,
          });
        }
        seen.add(key);
      }
    })
    .optional(),

  /**
   * Destination account for forced-withdrawal surplus (ENG-01).
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-15 (revised 2026-04-24), D-16, D-17
   * IMPORTANT: NO Zod default value. When the field is omitted from `decisions`,
   * it remains `undefined` and the engine does NOT route surplus anywhere —
   * preserves the additive-invariant (ROADMAP criterion #5, Assumption A1).
   * The UI MAY offer 'nonreg' as a suggested starting value in a scenario-decisions
   * form, but MUST NOT write it until the user explicitly confirms. Pre-Phase-1
   * scenarios parse to undefined → engine treats as "no routing configured" →
   * byte-identical to pre-Phase-1 output.
   */
  surplusDestination: WithdrawalOverrideField.optional(),

  /**
   * Couple-only: how the engine routes spending obligations to accounts.
   *
   * - `'per-owner'` (default when omitted): each spouse's spending is funded
   *    only from that spouse's accounts. Owner-tagged overrides are authoritative.
   *    Surplus / shortfall stays per-person (matches pre-Phase behavior).
   *
   * - `'household'`: when BOTH spouses are retired and one spouse's accounts
   *    cannot fully fund their spending share, the unfunded portion is added
   *    to the other spouse's withdrawal gap and pulled from their accounts in
   *    the standard tax-efficient order. Pension splitting is unchanged.
   *    Owner-tagged overrides still apply but their unfunded remainder is pooled.
   *
   * Absent → preserves additive-invariant (engine treats as 'per-owner').
   *
   * @see .planning/phases/04-tech-debt-closeout/ — household-pooling proof
   */
  householdSpendingMode: z.enum(['per-owner', 'household']).optional(),
});

// -------------------------------------------------------------------------
// TypeScript type (inferred from Zod — single source of truth)
// -------------------------------------------------------------------------

// Use z.input rather than z.infer/z.output so optional-with-default fields
// (e.g. owner on override records) stay optional in the TypeScript type.
// At runtime Zod still fills the default during .parse(), so legacy DB rows
// and new payloads without `owner` resolve to 'primary'. Read sites that
// branch on owner already use `o.owner ?? 'primary'` to match this contract.
export type ScenarioDecisions = z.input<typeof ScenarioDecisionsSchema>;
