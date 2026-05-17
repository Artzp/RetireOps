/**
 * Apply scenario decisions on top of assembled profile data.
 * Returns a structuredClone of the base with each non-undefined decision applied.
 * Pure function — no I/O.
 *
 * @see .planning/phases/17-schema-assembler-foundation/17-CONTEXT.md - D-07, D-08
 * @see .planning/phases/25-scenario-decision-engine-wiring/25-CONTEXT.md - D-01, D-02
 */
import type { FrontendInputData } from './projection-transformer.js';
import type { ScenarioDecisions } from '@retireops/shared';

type ContributionOverrideAccountType = 'rrsp' | 'tfsa' | 'nonreg';

/**
 * Extended FrontendInputData shape carrying all 7 scenario strategy fields,
 * plus the Phase 1 additive override fields.
 * Returned by applyScenarioDecisions so downstream callers (Plans 02, 03) can
 * consume these fields without further type work.
 *
 * @see packages/shared/src/types/projection.ts - ProjectionInput strategy fields (D-01)
 */
export interface ScenarioAppliedInput extends FrontendInputData {
  drawdownOrder?: string[];
  strategyId?: 'standard' | 'tfsaFirst' | 'oasProtection' | 'bracketFilling';
  rrspMeltdown?: {
    enabled: boolean;
    annualAmount: number;
    startYear: number;
    endYear: number;
    /**
     * RMLT-03 floor guard. When set, the engine stops RRSP meltdown withdrawals
     * once the RRSP balance reaches this floor. The field is declared on
     * ScenarioDecisions and on ProjectionInput.rrspMeltdown; the api layer must
     * round-trip it intact or the floor guard never reaches the engine.
     * @see packages/shared/src/types/projection.ts (ProjectionInput.rrspMeltdown.targetAmount)
     * @see packages/shared/src/types/scenario.ts (ScenarioDecisions.rrspMeltdown.targetAmount)
     */
    targetAmount?: number;
  };
  incomeSplitting?: { enabled: boolean; splitPercent: number };
  oasClawbackAvoidance?: { enabled: boolean; incomeThreshold: number };
  bracketFill?: { enabled: boolean; bracketTarget?: 'current' | 'next'; annualCap?: number };
  /**
   * Engine-supported contribution overrides. The source ScenarioDecisions
   * shape allows accountType ∈ {'rrsp','tfsa','nonreg'} so the UI can express
   * intent against any account type, but only RRSP/TFSA contribution overrides
   * are engine-supported. The runtime filter at line 192 of applyScenarioDecisions
   * drops anything but 'rrsp' | 'tfsa' BEFORE pushing into this array — so the
   * tightened literal here matches reality and removes a class of type/runtime
   * drift. The 'non-reg contribution override is not engine-supported yet'
   * filter remains load-bearing as the runtime guard.
   *
   * @see .planning/phases/26-engine-field-forwarding/26-REVIEW.md WR-03
   */
  contributionOverrides?: Array<{
    accountType: 'rrsp' | 'tfsa';
    annualAmount: number;
    startYear: number;
    endYear: number;
  }>;
  ageBandReductions?: Array<{ fromAge: number; reductionPercent: number }>;
  legacyTarget?: number;
  inflationRate?: number;
  investmentReturn?: number;

  /**
   * Phase 1 additive pass-through fields — mirror ScenarioDecisions exactly.
   * No translation required (unlike contributionOverrides which maps UUIDs).
   * Engine (overrides.ts, yearly-calculator.ts) sorts and caps defensively.
   *
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-15
   */
  withdrawalOverrides?: Array<{
    field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';
    year: number;
    amount: number;
    applyForward: boolean;
    /** Per-owner routing — defaults to primary when omitted. */
    owner?: 'primary' | 'spouse' | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    originalEngineValue?: number | undefined;
  }>;
  spendingOverrides?: Array<{
    year: number;
    amount: number;
    applyForward: boolean;
    /** Per-owner routing — defaults to primary when omitted. */
    owner?: 'primary' | 'spouse' | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    originalEngineValue?: number | undefined;
  }>;
  surplusDestination?: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';
  /**
   * Couple-only: how the engine routes spending obligations to accounts.
   * 'per-owner' = each spouse funds own spending; 'household' = unfunded shortfall
   * pools across spouses' accounts in tax-efficient order. Absent → 'per-owner'.
   */
  householdSpendingMode?: 'per-owner' | 'household';
}

export function applyScenarioDecisions(
  base: FrontendInputData,
  decisions: ScenarioDecisions
): ScenarioAppliedInput {
  const result: ScenarioAppliedInput = structuredClone(base);

  // --- Timing ---
  if (decisions.retirementAge !== undefined) {
    result.personalInfo.retirementAge = decisions.retirementAge;
  }

  if (decisions.lifeExpectancy !== undefined) {
    result.personalInfo.lifeExpectancy = decisions.lifeExpectancy;
  }

  if (decisions.cppStartAge !== undefined) {
    result.governmentBenefits.cppStartAge = decisions.cppStartAge;
  }

  if (decisions.oasStartAge !== undefined) {
    result.governmentBenefits.oasStartAge = decisions.oasStartAge;
  }

  if (decisions.expectedCPPAt65 !== undefined) {
    result.governmentBenefits.estimatedCppAmount = decisions.expectedCPPAt65;
  }

  if (decisions.yearsOfResidence !== undefined) {
    result.governmentBenefits.yearsOfResidence = decisions.yearsOfResidence;
  }

  // Spouse timing — only apply if spouse exists in the base
  if (result.spouse !== undefined) {
    if (decisions.spouseRetirementAge !== undefined) {
      result.spouse.retirementAge = decisions.spouseRetirementAge;
    }
    if (decisions.spouseLifeExpectancy !== undefined) {
      result.spouse.lifeExpectancy = decisions.spouseLifeExpectancy;
    }
    if (decisions.spouseCppStartAge !== undefined) {
      result.spouse.cppStartAge = decisions.spouseCppStartAge;
    }
    if (decisions.spouseOasStartAge !== undefined) {
      result.spouse.oasStartAge = decisions.spouseOasStartAge;
    }
    if (decisions.spouseExpectedCPPAt65 !== undefined) {
      result.spouse.expectedCppAt65 = decisions.spouseExpectedCPPAt65;
    }
    if (decisions.spouseYearsOfResidence !== undefined) {
      result.spouse.yearsOfResidence = decisions.spouseYearsOfResidence;
    }
  }

  // DB pension start age (D-03): stored in decisions JSONB; engine wiring deferred to Phase 21+.
  // applyScenarioDecisions does not modify FrontendInputData for this field — the engine will
  // read it from decisions at run time.

  // --- Tax Strategy (TAX-01 through TAX-04) ---
  if (decisions.drawdownOrder !== undefined) {
    result.drawdownOrder = [...decisions.drawdownOrder];
  }

  if (decisions.strategyId !== undefined) {
    result.strategyId = decisions.strategyId;
  }

  if (decisions.rrspMeltdown !== undefined) {
    // Phase 26 review WR-02: targetAmount (RMLT-03 floor guard) must be copied
    // through. Without this conditional spread, `targetAmount` was silently
    // stripped here BEFORE the transformer's Phase 26 rrspMeltdown forward ever
    // saw it — symptom identical to the original ENG-02 gap, just at a sub-field.
    if (decisions.rrspMeltdown.targetAmount !== undefined) {
      result.rrspMeltdown = {
        enabled: decisions.rrspMeltdown.enabled,
        annualAmount: decisions.rrspMeltdown.annualAmount,
        startYear: decisions.rrspMeltdown.startYear,
        endYear: decisions.rrspMeltdown.endYear,
        targetAmount: decisions.rrspMeltdown.targetAmount,
      };
    } else {
      result.rrspMeltdown = {
        enabled: decisions.rrspMeltdown.enabled,
        annualAmount: decisions.rrspMeltdown.annualAmount,
        startYear: decisions.rrspMeltdown.startYear,
        endYear: decisions.rrspMeltdown.endYear,
      };
    }
  }

  if (decisions.incomeSplitting !== undefined) {
    result.incomeSplitting = {
      enabled: decisions.incomeSplitting.enabled,
      splitPercent: decisions.incomeSplitting.splitPercent,
    };
  }

  if (decisions.oasClawbackAvoidance !== undefined) {
    result.oasClawbackAvoidance = {
      enabled: decisions.oasClawbackAvoidance.enabled,
      incomeThreshold: decisions.oasClawbackAvoidance.incomeThreshold,
    };
  }

  if (decisions.bracketFill !== undefined) {
    result.bracketFill = {
      enabled: decisions.bracketFill.enabled,
      ...(decisions.bracketFill.bracketTarget !== undefined && {
        bracketTarget: decisions.bracketFill.bracketTarget,
      }),
      ...(decisions.bracketFill.annualCap !== undefined && {
        annualCap: decisions.bracketFill.annualCap,
      }),
    };
  }

  // --- Savings (SAV-01): translate accountId UUIDs to accountType per D-02 ---
  if (decisions.contributionOverrides !== undefined && decisions.contributionOverrides.length > 0) {
    const translated: NonNullable<ScenarioAppliedInput['contributionOverrides']> = [];
    for (const override of decisions.contributionOverrides) {
      let type: ContributionOverrideAccountType | undefined = override.accountType;
      if (type === undefined && override.accountId !== undefined) {
        const account = base.accounts.find(
          (a) => (a as unknown as { id: string }).id === override.accountId
        );
        if (!account) continue; // silently drop unknown UUIDs (D-02)
        const rawType = (account as unknown as { id: string; type: string }).type.toLowerCase();
        type =
          rawType === 'nonregistered' ? 'nonreg' : (rawType as ContributionOverrideAccountType);
      }
      if (type !== 'rrsp' && type !== 'tfsa') continue; // non-reg contribution override is not engine-supported yet
      translated.push({
        accountType: type,
        annualAmount: override.annualAmount,
        startYear: override.startYear,
        endYear: override.endYear,
      });
    }
    if (translated.length > 0) {
      result.contributionOverrides = translated;
    }
  }

  // --- Spending ---
  if (decisions.targetRetirementSpending !== undefined) {
    result.expenses.retirementAnnualExpenses = decisions.targetRetirementSpending;
    // Keep coupleSettings.sharedRetirementSpending in sync so the engine
    // treats the scenario's target as a HOUSEHOLD number (engine splits it
    // per-person). Without this, the override would only apply to primary
    // and spouse would keep the assembler's original household-as-shared value.
    if (result.spouse !== undefined) {
      result.coupleSettings = {
        ...(result.coupleSettings ?? {}),
        sharedRetirementSpending: decisions.targetRetirementSpending,
      };
    }
  }

  // SPD-02: inflation rate override (wires the v1.3 stub).
  // Phase 26 fix — also write into result.assumptions.inflationRate so the
  // transformer's upstream `frontendInput.assumptions?.inflationRate` read
  // (projection-transformer.ts:~420) picks up the decision-level override.
  // Without writing into assumptions, the decision-level inflationRate was
  // silently dropped at the API layer (audit-promoted half-forward bug).
  // Mirrors the investmentReturn convention 3 lines below: assumptions stores
  // the *percentage* value (e.g. 2.5 for 2.5%) — the transformer divides by 100.
  // NOTE: Same key, two units by convention — `result.inflationRate` carries the
  // engine-facing decimal (0.025 for 2.5%); `result.assumptions.inflationRate`
  // carries the wizard-facing percentage (2.5). This dual-write mirrors how
  // `investmentReturn` (decimal) and `assumptions.investmentReturnRate` (percent)
  // coexist in the existing block immediately below — not a duplicate-write smell.
  // @see .planning/phases/26-engine-field-forwarding/26-RESEARCH.md (8-field audit, Pitfall 4)
  if (decisions.inflationRate !== undefined) {
    result.inflationRate = decisions.inflationRate;
    result.assumptions = {
      ...(result.assumptions ?? {}),
      inflationRate: decisions.inflationRate * 100,
    };
  }

  if (decisions.investmentReturn !== undefined) {
    result.investmentReturn = decisions.investmentReturn;
    result.assumptions = {
      ...(result.assumptions ?? {}),
      investmentReturnRate: decisions.investmentReturn * 100,
    };
  }

  // SPD-03: age-band spending reductions
  if (decisions.ageBandReductions !== undefined && decisions.ageBandReductions.length > 0) {
    result.ageBandReductions = decisions.ageBandReductions.map((b) => ({
      fromAge: b.fromAge,
      reductionPercent: b.reductionPercent,
    }));
  }

  // SPD-04: legacy target
  if (decisions.legacyTarget !== undefined) {
    result.legacyTarget = decisions.legacyTarget;
  }

  // --- Phase 1: additive pass-through of withdrawal / spending / surplus routing fields ---
  // @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-15
  // Engine (overrides.ts, multi-year.ts) sorts and caps defensively at compute time.
  // No translation is required: withdrawal overrides are keyed by field/year directly
  // (unlike contributionOverrides which maps accountId UUIDs to accountType).
  // surplusDestination is conditionally assigned: absence of the field preserves the
  // additive invariant (engine's `surplusDestination !== undefined` guard in Plan 05
  // is the load-bearing check for ROADMAP criterion #5).
  if (decisions.withdrawalOverrides !== undefined) {
    result.withdrawalOverrides = decisions.withdrawalOverrides;
  }
  if (decisions.spendingOverrides !== undefined) {
    result.spendingOverrides = decisions.spendingOverrides;
  }
  if (decisions.surplusDestination !== undefined) {
    result.surplusDestination = decisions.surplusDestination;
  }
  if (decisions.householdSpendingMode !== undefined) {
    result.householdSpendingMode = decisions.householdSpendingMode;
  }

  return result;
}
