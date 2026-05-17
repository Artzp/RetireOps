/**
 * Phase 7 — Characterization fixtures.
 *
 * Six scenario builders that produce `FrontendInputData` for the snapshot suite
 * in `packages/api/src/services/characterization.test.ts`. Two single-person
 * fixtures (accumulation, retired drawdown) and four couple variants derived
 * from the canonical 2026 demo household via ScenarioDecisions overlays.
 *
 * Determinism rules (per CLAUDE.md engine purity + 07-RESEARCH.md Pitfall 1/2):
 * - All fixtures pin `projectionStartYear: 2026` on the assembled ProjectionInput
 *   (caller responsibility — see characterization.test.ts).
 * - Birthdates use stable ISO strings at midday UTC so the transformer can
 *   parse them without Jan 1 rolling back to Dec 31 in negative-offset zones.
 * - No Date.now(), no Math.random().
 *
 * @see .planning/phases/07-characterization-tests/07-CONTEXT.md
 * @see docs/source-of-truth/02-account-types.md (account-type semantics)
 */
import type { FrontendInputData } from '../../services/projection-transformer.js';
import type { ScenarioDecisions } from '@retireops/shared';
import { demoHousehold2026FrontendInput } from './demo-household-2026.js';
import { applyScenarioDecisions } from '../../services/scenario-decisions.js';

export const CHARACTERIZATION_START_YEAR = 2026;

function stableFixtureBirthdate(year: number): string {
  return `${String(year)}-01-02T12:00:00.000Z`;
}

/**
 * SINGLE-01: Single-person accumulation fixture.
 * Pre-retirement, working, contributing to RRSP + TFSA.
 * RRSP/TFSA/Non-Reg balances seeded.
 */
export function buildCharacterizationSingleAccumulationFixture(): FrontendInputData {
  return {
    personalInfo: {
      dateOfBirth: stableFixtureBirthdate(1985),
      province: 'ON',
      gender: 'male',
      maritalStatus: 'single',
      retirementAge: 65,
      lifeExpectancy: 90,
    },
    accounts: [
      {
        type: 'RRSP',
        name: 'RRSP',
        balance: 200_000,
        annualContribution: 12_000,
        investmentReturnRate: 5.0,
        belongsTo: 'primary',
      },
      {
        type: 'TFSA',
        name: 'TFSA',
        balance: 80_000,
        annualContribution: 7_000,
        investmentReturnRate: 5.0,
        belongsTo: 'primary',
        contributionRoom: 7_000,
      },
      {
        type: 'NonRegistered',
        name: 'Non-Reg',
        balance: 50_000,
        investmentReturnRate: 5.0,
        belongsTo: 'primary',
      },
    ],
    incomeSources: [
      {
        type: 'employment',
        name: 'Salary',
        annualAmount: 100_000,
        endAge: 65,
        indexationRate: 0.025,
      },
    ],
    governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 14_000 },
    expenses: { currentAnnualExpenses: 60_000, retirementAnnualExpenses: 60_000 },
    assumptions: { inflationRate: 2.5, investmentReturnRate: 5.0 },
  };
}

/**
 * SINGLE-02: Single-person retired-drawdown fixture.
 * Born 1955 → age 71 at start year 2026 → past retirementAge 65 → fully retired.
 * Drawing standard order RRSP → RRIF → TFSA → Non-Reg.
 */
export function buildCharacterizationSingleRetiredFixture(): FrontendInputData {
  return {
    personalInfo: {
      dateOfBirth: stableFixtureBirthdate(1955),
      province: 'ON',
      gender: 'female',
      maritalStatus: 'single',
      retirementAge: 65,
      lifeExpectancy: 92,
    },
    accounts: [
      {
        type: 'RRSP',
        name: 'RRSP',
        balance: 500_000,
        investmentReturnRate: 4.5,
        belongsTo: 'primary',
      },
      {
        type: 'RRIF',
        name: 'RRIF',
        balance: 0,
        investmentReturnRate: 4.5,
        belongsTo: 'primary',
      },
      {
        type: 'TFSA',
        name: 'TFSA',
        balance: 100_000,
        investmentReturnRate: 4.5,
        belongsTo: 'primary',
      },
      {
        type: 'NonRegistered',
        name: 'Non-Reg',
        balance: 200_000,
        investmentReturnRate: 4.5,
        belongsTo: 'primary',
      },
    ],
    incomeSources: [],
    governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 14_000 },
    expenses: { currentAnnualExpenses: 55_000, retirementAnnualExpenses: 55_000 },
    assumptions: { inflationRate: 2.5, investmentReturnRate: 4.5 },
  };
}

/**
 * COUPLE-01: Pension-split contrast couple fixture.
 *
 * Clones the 2026 demo household and EXPLICITLY DISABLES pension-splitting via
 * coupleSettings.optimizePensionSplitting: false. The transformer's default
 * for this field is `?? true` (projection-transformer.ts:555), so without an
 * explicit `false` the snapshot is byte-identical to the unoverlayed baseline
 * (the original cause of Gap G-01). With pension-splitting OFF, the engine's
 * post-RRIF-conversion years (2056+) emit non-split tax outputs — the
 * meaningful contrast vs the implicit "default-on" baseline captured by every
 * other demo-household-derived couple snapshot.
 *
 * useYoungerSpouseForRRIF is also pinned to false to depart from the
 * transformer's `?? true` default and ensure the snapshot is fully isolated
 * from the baseline's implicit settings.
 *
 * @see .planning/phases/07-characterization-tests/07-VERIFICATION.md G-01
 */
export function buildCharacterizationCouplePensionSplitFixture(): FrontendInputData {
  return {
    ...structuredClone(demoHousehold2026FrontendInput),
    coupleSettings: {
      optimizePensionSplitting: false,
      useYoungerSpouseForRRIF: false,
    },
  };
}

/**
 * COUPLE-02: Household-pooling couple fixture.
 * Sets householdSpendingMode: 'household' via the ScenarioDecisions overlay
 * (the only path that wires the field — see scenario-decisions.ts).
 */
export function buildCharacterizationCoupleHouseholdPoolingFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = { householdSpendingMode: 'household' };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

/**
 * COUPLE-03: TFSA-first strategy couple fixture.
 * Uses ScenarioDecisions strategyId: 'tfsaFirst'.
 */
export function buildCharacterizationCoupleTfsaFirstFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = { strategyId: 'tfsaFirst' };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

/**
 * COUPLE-04: Bracket-fill strategy couple fixture.
 * Uses ScenarioDecisions bracketFill: { enabled: true, bracketTarget: 'current' }.
 */
export function buildCharacterizationCoupleBracketFillFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = {
    bracketFill: { enabled: true, bracketTarget: 'current' },
  };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

/**
 * COUPLE-05: Drawdown-reverse couple fixture — explicit drawdownOrder path (Phase 26 / ENG-05).
 *
 * Uses ScenarioDecisions.drawdownOrder = ['tfsa', 'rrsp', 'nonReg'] LAYERED ON TOP OF the
 * SAME `householdSpendingMode: 'household'` overlay as COUPLE-02 (household pooling). The
 * shared overlay is load-bearing for the REGRESSION ENG-05 trip-wire: it makes the
 * COUPLE-05 vs COUPLE-02 comparison isolate exactly ONE field — drawdownOrder.
 *
 * Engine precedence at `packages/calculation-engine/src/withdrawals/strategy.ts:224-235`
 * resolves order as `drawdownOrder > strategyId > standard`. By setting drawdownOrder
 * without strategyId, we force the engine to use the explicit token list. The standard
 * engine order is non_registered → rrif → lif → rrsp → tfsa (TFSA last). This fixture's
 * order puts TFSA first, which produces materially different year-by-year withdrawal
 * patterns when contrasted against COUPLE-02 — which uses the IDENTICAL household
 * baseline but no drawdownOrder overlay.
 *
 * Pre-WR-01, COUPLE-05 set only `drawdownOrder` (no `householdSpendingMode: 'household'`),
 * so the REGRESSION ENG-05 assertion compared COUPLE-05 (drawdownOrder overlay) vs
 * COUPLE-02 (householdSpendingMode overlay) — TWO different overlays. If drawdownOrder
 * forwarding were silently reverted, the two runs would still diverge because
 * householdSpendingMode forwarding independently changes output — defeating the
 * trip-wire's stated "isolates drawdownOrder forwarding" purpose. Post-WR-01, the
 * shared baseline makes drawdownOrder the only differing field — pre-fix forwarding
 * collapses both runs to the same household-pooled standard order (assertion fails);
 * post-fix the engine receives the explicit order and the snapshot diverges (assertion
 * passes).
 *
 * @see .planning/phases/26-engine-field-forwarding/26-REVIEW.md WR-01 (isolation fix)
 * @see .planning/phases/26-engine-field-forwarding/26-CONTEXT.md (Pitfall 1)
 * @see .planning/phases/26-engine-field-forwarding/26-RESEARCH.md (Pitfall 2 — order must be materially different from standard)
 * @see packages/calculation-engine/src/withdrawals/strategy.ts:224 (resolveDrawdownOrder precedence)
 */
export function buildCharacterizationCoupleDrawdownReverseFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = {
    // Match COUPLE-02 baseline — load-bearing for REGRESSION ENG-05 isolation (WR-01).
    householdSpendingMode: 'household',
    // The field under test — engine precedence puts drawdownOrder above strategyId.
    drawdownOrder: ['tfsa', 'rrsp', 'nonReg'],
  };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

// ---------------------------------------------------------------------------
// Phase 27 — Per-preset regression fixtures (PRESET-04 divergence half).
//
// Each fixture overlays a single preset's `Partial<ScenarioDecisions>` onto the
// SAME `householdSpendingMode: 'household'` baseline used by COUPLE-02 and
// COUPLE-05. This isolates the preset's decisions as the ONLY differing field
// vs the baseline — same WR-01 isolation pattern Phase 26 applied for ENG-05.
//
// Why hard-code the preset tuples here (vs importing WITHDRAWAL_PRESETS):
//
//   The api package builds against `@retireops/shared` dist (compiled JS), not
//   source. Plan 27-01's WITHDRAWAL_PRESETS lives under the NEW
//   `@retireops/shared/withdrawal` subpath, whose dist is only available after
//   the user rebuilds shared (`pnpm --filter @retireops/shared build`). To
//   keep the regression tests runnable inside the same vitest invocation that
//   Plan 27-03 commits (no inter-build coordination required), the fixture
//   tuples are written as inline literals here. They MUST match the
//   WITHDRAWAL_PRESETS values byte-for-byte — Plan 27-03 Task 4 audits this.
//
// @see .planning/phases/27-preset-mapping-infrastructure/27-DECISIONS.md PRESET-04
// @see .planning/phases/26-engine-field-forwarding/26-REVIEW.md WR-01 (isolation pattern)
// ---------------------------------------------------------------------------

/**
 * preserveTfsaLongest preset overlay onto the COUPLE-02 baseline.
 * drawdownOrder: ['rrsp','rrif','nonReg','tfsa'] — TFSA drawn last.
 */
export function buildCharacterizationPresetPreserveTfsaLongestFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = {
    householdSpendingMode: 'household',
    drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
  };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

/**
 * useTfsaEarlier preset overlay onto the COUPLE-02 baseline.
 * drawdownOrder: ['nonReg','tfsa','rrsp','rrif'] — TFSA in position 2.
 */
export function buildCharacterizationPresetUseTfsaEarlierFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = {
    householdSpendingMode: 'household',
    drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
  };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

/**
 * smoothRrspRrifBefore71 preset overlay onto the COUPLE-02 baseline.
 * rrspMeltdown $25k/yr 2026-2031 + drawdownOrder ['rrsp','rrif','nonReg','tfsa'].
 * Engine consumes rrspMeltdown at calculate-person-year.ts:381 and calculate-year.ts:280.
 */
export function buildCharacterizationPresetSmoothRrspRrifBefore71Fixture(): FrontendInputData {
  const decisions: ScenarioDecisions = {
    householdSpendingMode: 'household',
    drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
    rrspMeltdown: {
      enabled: true,
      annualAmount: 25_000,
      startYear: 2026,
      endYear: 2031,
    },
  };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}

/**
 * protectOas preset overlay onto the COUPLE-02 baseline.
 * oasClawbackAvoidance enabled at $95,323 (2026 threshold) + TFSA-first drawdownOrder.
 * Engine consumes oasClawbackAvoidance at calculate-year.ts:420 and calculate-person-year.ts:523.
 */
export function buildCharacterizationPresetProtectOasFixture(): FrontendInputData {
  const decisions: ScenarioDecisions = {
    householdSpendingMode: 'household',
    drawdownOrder: ['tfsa', 'nonReg', 'rrsp', 'rrif'],
    oasClawbackAvoidance: {
      enabled: true,
      incomeThreshold: 95_323,
    },
  };
  return applyScenarioDecisions(structuredClone(demoHousehold2026FrontendInput), decisions);
}
