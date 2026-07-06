/**
 * Priority-0 trust guard — strategy DECISION fields must MOVE THE NUMBERS.
 *
 * Context: the Phase 26 forwarding work proved each scenario-decision field is
 * *forwarded* through applyScenarioDecisions → transformToProjectionInput →
 * ProjectionInput. The Phase 7/27 characterization suite then proved
 * NUMBER-MOVEMENT (engine output divergence vs baseline) for `strategyId`,
 * `drawdownOrder`, `bracketFill` and `householdSpendingMode` — but it
 * EXPLICITLY DEFERRED retirement-stage number-movement proof for the remaining
 * strategy fields (see characterization.test.ts: "measurable engine output
 * divergence vs baseline emerges only on a retirement-stage fixture, which
 * Phase 27 explicitly scopes OUT ... tracked as a future-phase enhancement").
 *
 * This file closes that gap. For each remaining strategy decision field it runs
 * the REAL pipeline (no engine/transformer mocks) on a fixture where the field's
 * mechanism actually fires, and asserts the engine output is NOT byte-identical
 * to the no-decision baseline — i.e. the control genuinely changes the
 * projection. If a control did NOT move the numbers despite being forwarded,
 * that is the "trust bug" the dev backlog warned about (a control the user can
 * toggle that silently does nothing).
 *
 * `legacyTarget` is the one intentional exception: by design it changes only the
 * `legacyTargetMet` summary flag (multi-year.ts:243/716 — finalNetWorth >=
 * input.legacyTarget), NOT the year-by-year trajectory, so it is asserted on the
 * flag, not on number-movement.
 *
 * @see .planning/phases/26-engine-field-forwarding/26-CONTEXT.md (forwarding)
 * @see packages/api/src/services/characterization.test.ts (the deferred gap)
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */
import { describe, it, expect } from 'vitest';
import type { ScenarioDecisions, ProjectionOutput } from '@retireops/shared';
import { runProjection } from '@retireops/calculation-engine';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { transformToProjectionInput } from './projection-transformer.js';
import type { FrontendInputData } from './projection-transformer.js';

const currentYear = new Date().getFullYear();

// Retired single person, mid-drawdown: large RRSP so registered withdrawals
// dominate, modest TFSA / non-reg so alternative sources exist for trims.
const BASE_RETIREE_SINGLE: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${currentYear - 66}-01-01`,
    province: 'ON',
    retirementAge: 60,
    lifeExpectancy: 92,
    maritalStatus: 'single',
  },
  accounts: [
    { type: 'RRSP', balance: 650_000 },
    { type: 'TFSA', balance: 120_000 },
    { type: 'NonRegistered', balance: 180_000 },
  ],
  incomeSources: [{ type: 'employment', annualAmount: 0 }],
  governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 12_000 },
  expenses: { currentAnnualExpenses: 72_000, retirementAnnualExpenses: 72_000 },
  assumptions: { inflationRate: 2.5, investmentReturnRate: 5 },
};

// Pre-retiree still working & contributing — the only stage where contribution
// overrides have anything to act on.
const BASE_ACCUMULATION_SINGLE: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${currentYear - 50}-01-01`,
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'single',
  },
  accounts: [
    { type: 'RRSP', balance: 200_000, annualContribution: 0 },
    { type: 'TFSA', balance: 60_000 },
    { type: 'NonRegistered', balance: 40_000 },
  ],
  incomeSources: [{ type: 'employment', annualAmount: 110_000 }],
  governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 13_000 },
  expenses: { currentAnnualExpenses: 70_000, retirementAnnualExpenses: 60_000 },
  assumptions: { inflationRate: 2.5, investmentReturnRate: 5 },
};

// High-income retiree, age 73 (RRSP already RRIF-converting), whose forced +
// voluntary registered income clears the OAS clawback threshold — so the
// avoidance trim has something to shift to the non-registered account.
const BASE_HIGH_INCOME_RETIREE: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${currentYear - 73}-01-01`,
    province: 'ON',
    retirementAge: 60,
    lifeExpectancy: 92,
    maritalStatus: 'single',
  },
  accounts: [
    { type: 'RRSP', balance: 1_250_000 },
    { type: 'TFSA', balance: 60_000 },
    { type: 'NonRegistered', balance: 450_000 },
  ],
  incomeSources: [{ type: 'employment', annualAmount: 0 }],
  governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 15_000 },
  expenses: { currentAnnualExpenses: 100_000, retirementAnnualExpenses: 100_000 },
  assumptions: { inflationRate: 2.5, investmentReturnRate: 5 },
};

// Retired couple with asymmetric pension income — the asymmetry is what makes
// income splitting move the household tax bill.
const BASE_COUPLE: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${currentYear - 68}-01-01`,
    province: 'ON',
    retirementAge: 60,
    lifeExpectancy: 90,
    maritalStatus: 'married',
  },
  spouse: {
    dateOfBirth: `${currentYear - 66}-01-01`,
    retirementAge: 60,
    lifeExpectancy: 92,
    employmentIncome: 0,
    rrspBalance: 60_000,
    tfsaBalance: 40_000,
  },
  // Primary draws a large RPP pension (splittable at any age); spouse has none.
  accounts: [
    { type: 'RRSP', balance: 300_000, belongsTo: 'primary' },
    { type: 'TFSA', balance: 80_000, belongsTo: 'primary' },
    { type: 'RRSP', balance: 60_000, belongsTo: 'spouse' },
    { type: 'TFSA', balance: 40_000, belongsTo: 'spouse' },
  ],
  incomeSources: [{ type: 'pension', annualAmount: 85_000, startAge: 60 }],
  governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 12_000 },
  expenses: { currentAnnualExpenses: 90_000, retirementAnnualExpenses: 90_000 },
  assumptions: { inflationRate: 2.5, investmentReturnRate: 5 },
  // Disable the auto-optimizer so the manual incomeSplitting decision is the
  // only thing toggling a split between the two runs.
  coupleSettings: { optimizePensionSplitting: false },
};

function runWith(
  base: FrontendInputData,
  decisions: ScenarioDecisions
): ReturnType<typeof runProjection> {
  const applied = applyScenarioDecisions(base, decisions);
  return runProjection(transformToProjectionInput(applied));
}

/**
 * Run a SINGLE-person fixture. runProjection returns a single|couple union; the
 * single fixtures here always dispatch to the single path, so we narrow to
 * ProjectionOutput for ergonomic year-row field access (.age, .rrspBalance, …).
 */
function runSingle(base: FrontendInputData, decisions: ScenarioDecisions): ProjectionOutput {
  return runWith(base, decisions) as ProjectionOutput;
}

/** Byte-stable serialization of the year-by-year output for divergence checks. */
function rows(output: { yearlyResults: unknown }): string {
  return JSON.stringify(output.yearlyResults);
}

describe('Priority-0: strategy decision fields move the numbers (real pipeline)', () => {
  it('inflationRate — changing the decimal rate diverges the nominal trajectory', () => {
    const baseline = runSingle(BASE_RETIREE_SINGLE, {});
    const higher = runSingle(BASE_RETIREE_SINGLE, { inflationRate: 0.045 });
    expect(rows(higher)).not.toEqual(rows(baseline));
  });

  it('ageBandReductions — cutting spend at 75 retains more net worth at 80', () => {
    const baseline = runSingle(BASE_RETIREE_SINGLE, {});
    const reduced = runSingle(BASE_RETIREE_SINGLE, {
      ageBandReductions: [{ fromAge: 75, reductionPercent: 0.25 }],
    });
    expect(rows(reduced)).not.toEqual(rows(baseline));

    const baseAt80 = baseline.yearlyResults.find((r) => r.age === 80);
    const reducedAt80 = reduced.yearlyResults.find((r) => r.age === 80);
    expect(baseAt80, 'baseline must reach age 80').toBeDefined();
    expect(reducedAt80, 'reduced run must reach age 80').toBeDefined();
    // Spending 25% less from 75 onward → less drawdown → strictly more retained.
    expect(reducedAt80!.totalNetWorth).toBeGreaterThan(baseAt80!.totalNetWorth);
  });

  it('rrspMeltdown — forcing extra RRSP withdrawals draws the RRSP down faster', () => {
    const baseline = runSingle(BASE_RETIREE_SINGLE, {});
    const meltdown = runSingle(BASE_RETIREE_SINGLE, {
      rrspMeltdown: {
        enabled: true,
        annualAmount: 45_000,
        startYear: currentYear,
        endYear: currentYear + 6,
      },
    });
    expect(rows(meltdown)).not.toEqual(rows(baseline));

    const baseAt69 = baseline.yearlyResults.find((r) => r.age === 69);
    const meltAt69 = meltdown.yearlyResults.find((r) => r.age === 69);
    expect(baseAt69, 'baseline must reach age 69').toBeDefined();
    expect(meltAt69, 'meltdown run must reach age 69').toBeDefined();
    // Forced meltdown withdrawals empty the RRSP ahead of the baseline schedule.
    expect(meltAt69!.rrspBalance).toBeLessThan(baseAt69!.rrspBalance);
  });

  it('oasClawbackAvoidance — trimming registered income reshapes the drawdown', () => {
    const baseline = runSingle(BASE_HIGH_INCOME_RETIREE, {});
    const avoided = runSingle(BASE_HIGH_INCOME_RETIREE, {
      oasClawbackAvoidance: { enabled: true, incomeThreshold: 90_000 },
    });
    expect(rows(avoided)).not.toEqual(rows(baseline));
  });

  it('contributionOverrides — boosting RRSP contributions grows the RRSP by retirement', () => {
    const baseline = runSingle(BASE_ACCUMULATION_SINGLE, {});
    const boosted = runSingle(BASE_ACCUMULATION_SINGLE, {
      contributionOverrides: [
        {
          accountType: 'rrsp',
          annualAmount: 22_000,
          startYear: currentYear,
          endYear: currentYear + 14,
        },
      ],
    });
    expect(rows(boosted)).not.toEqual(rows(baseline));

    const baseAt65 = baseline.yearlyResults.find((r) => r.age === 65);
    const boostedAt65 = boosted.yearlyResults.find((r) => r.age === 65);
    expect(baseAt65, 'baseline must reach age 65').toBeDefined();
    expect(boostedAt65, 'boosted run must reach age 65').toBeDefined();
    // 15 years of $22k contributions vs zero → materially larger RRSP at retirement.
    expect(boostedAt65!.rrspBalance).toBeGreaterThan(baseAt65!.rrspBalance);
  });

  it('incomeSplitting — manual split changes the couple household trajectory', () => {
    const baseline = runWith(BASE_COUPLE, {});
    const split = runWith(BASE_COUPLE, {
      incomeSplitting: { enabled: true, splitPercent: 0.5 },
    });
    expect(rows(split)).not.toEqual(rows(baseline));
  });

  it('legacyTarget — sets the legacyTargetMet flag (reporting-only, not the trajectory)', () => {
    // A modest-spend retiree who dies with money left over — so a legacy target
    // below the final net worth is genuinely "met" (BASE_RETIREE_SINGLE depletes
    // to $0 by life expectancy, which would make every positive target unmet).
    const LEGACY_LEAVER: FrontendInputData = {
      ...BASE_RETIREE_SINGLE,
      expenses: { currentAnnualExpenses: 40_000, retirementAnnualExpenses: 40_000 },
    };

    const baseline = runSingle(LEGACY_LEAVER, {});
    // Baseline (no target) → flag is null.
    expect(baseline.legacyTargetMet).toBeNull();

    const finalNetWorth =
      baseline.yearlyResults[baseline.yearlyResults.length - 1]?.totalNetWorth ?? 0;
    expect(
      finalNetWorth,
      'fixture must leave a positive estate for a meaningful test'
    ).toBeGreaterThan(0);

    // Target comfortably below the achieved final net worth → met.
    const lowTarget = runSingle(LEGACY_LEAVER, {
      legacyTarget: Math.floor(finalNetWorth / 2),
    });
    expect(lowTarget.legacyTargetMet).toBe(true);

    // Target far above any achievable final net worth → not met.
    const highTarget = runSingle(LEGACY_LEAVER, {
      legacyTarget: finalNetWorth + 50_000_000,
    });
    expect(highTarget.legacyTargetMet).toBe(false);

    // By design legacyTarget does NOT alter the year-by-year numbers.
    expect(rows(lowTarget)).toEqual(rows(baseline));
  });
});
