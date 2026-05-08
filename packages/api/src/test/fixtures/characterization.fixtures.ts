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
