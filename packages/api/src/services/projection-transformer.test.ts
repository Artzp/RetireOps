import { describe, expect, it } from 'vitest';
import type { CoupleYearlyResult, ScenarioDecisions } from '@retireops/shared';
import { isCoupleResult } from '@retireops/shared';
import {
  transformToFrontendOutput,
  transformToProjectionInput,
  transformToProjectionYearRows,
} from './projection-transformer.js';
import type { FrontendInputData } from './projection-transformer.js';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { runSingleProjection, runCoupleProjection } from '@retireops/calculation-engine';

describe('projection-transformer', () => {
  describe('transformToProjectionInput', () => {
    /**
     * Main single-user fixture (D-07: realistic non-round values)
     * 2 RRSP accounts to verify D-01 multi-RRSP collapse
     */
    const singleUserFixture: FrontendInputData = {
      personalInfo: {
        dateOfBirth: '1970-03-15',
        province: 'ON',
        gender: 'male',
        maritalStatus: 'commonLaw',
        retirementAge: 63,
        lifeExpectancy: 88,
      },
      accounts: [
        {
          type: 'RRSP',
          name: 'Work RRSP',
          balance: 137450,
          annualContribution: 6200,
          investmentReturnRate: 6.5,
        },
        { type: 'RRSP', name: 'Self-directed RRSP', balance: 42300, annualContribution: 3800 },
        { type: 'TFSA', balance: 89200, annualContribution: 6500, investmentReturnRate: 5.5 },
        { type: 'NonRegistered', balance: 31750 },
      ],
      incomeSources: [{ type: 'employment', name: 'Software consulting', annualAmount: 94500 }],
      governmentBenefits: { cppStartAge: 67, oasStartAge: 65, estimatedCppAmount: 11840 },
      expenses: { currentAnnualExpenses: 68400, retirementAnnualExpenses: 72000 },
      assumptions: { inflationRate: 2.5, investmentReturnRate: 7.0 },
    };

    it('maps single-user wizard input to ProjectionInput with all fields', () => {
      const result = transformToProjectionInput(singleUserFixture);

      // Profile fields
      expect(result.birthdate).toEqual(new Date('1970-03-15'));
      expect(result.province).toBe('ON');
      expect(result.retirementAge).toBe(63);
      expect(result.lifeExpectancy).toBe(88);

      // D-03: maritalStatus transform
      expect(result.maritalStatus).toBe('common_law');

      // Income
      expect(result.employmentIncome).toBe(94500);
      expect(result.employmentGrowthRate).toBe(0.02); // always default

      // D-01: Multi-RRSP collapse — 137450 + 42300 = 179750 (exact sum, no rounding)
      expect(result.rrspBalance).toBe(179750);
      expect(result.rrspAnnualContribution).toBe(10000); // 6200 + 3800

      // Account balances
      expect(result.tfsaBalance).toBe(89200);
      expect(result.tfsaAnnualContribution).toBe(6500);
      expect(result.nonRegBalance).toBe(31750);

      // Retirement spending
      expect(result.retirementSpending).toBe(72000);

      // D-04/D-05: Only 2 accounts have investmentReturnRate (6.5 and 5.5),
      // avgAccountReturn = (6.5 + 5.5) / 2 / 100 = 0.06 (overrides assumptions value)
      expect(result.investmentReturn).toBe(0.06);

      // D-05: percent-to-decimal for inflationRate
      expect(result.inflationRate).toBe(0.025); // 2.5 / 100

      // Government benefits
      expect(result.expectedCPPAt65).toBe(11840);
      expect(result.cppStartAge).toBe(67);
      expect(result.oasStartAge).toBe(65);

      // No spouse data
      expect(result.spouse).toBeUndefined();
      expect(result.coupleSettings).toBeUndefined();
    });

    it('keeps annual debt payments separate from retirement spending for year-by-year cash flow', () => {
      const result = transformToProjectionInput({
        ...singleUserFixture,
        expenses: {
          currentAnnualExpenses: 68400,
          retirementAnnualExpenses: 72000,
          debtPaymentsAnnual: 14400,
          debtPaymentYears: 13,
        },
      });

      expect(result.retirementSpending).toBe(72000);
      expect(result.debtPaymentsAnnual).toBe(14400);
      expect(result.debtPaymentYears).toBe(13);
    });

    it('collapses multiple RRSP accounts into single balance and contribution', () => {
      const result = transformToProjectionInput(singleUserFixture);

      // D-01: Multi-RRSP collapse — 137450 + 42300 = 179750 (exact sum, no rounding)
      expect(result.rrspBalance).toBe(179750);
      expect(result.rrspAnnualContribution).toBe(10000); // 6200 + 3800
    });

    it('averages investment return rates from accounts', () => {
      const fixture: FrontendInputData = {
        ...singleUserFixture,
        accounts: [
          { type: 'RRSP', balance: 80000, annualContribution: 3000, investmentReturnRate: 6 },
          { type: 'TFSA', balance: 40000, annualContribution: 2000, investmentReturnRate: 8 },
          { type: 'NonRegistered', balance: 20000, investmentReturnRate: 7 },
        ],
        assumptions: { inflationRate: 2.0 },
      };

      const result = transformToProjectionInput(fixture);

      // D-04: average of (6 + 8 + 7) / 3 / 100 = 21 / 3 / 100 = 0.07
      expect(result.investmentReturn).toBe(0.07);
    });

    it('forwards supported non-registered income breakdown and ACB from account cards', () => {
      const fixture: FrontendInputData = {
        ...singleUserFixture,
        accounts: [
          {
            type: 'NonRegistered',
            balance: 100000,
            adjustedCostBase: 65000,
            annualInterestIncome: 1200,
            annualEligibleDividends: 2400,
            annualNonEligibleDividends: 600,
            annualRealizedCapitalGains: 3000,
          },
          {
            type: 'NonRegistered',
            balance: 50000,
            adjustedCostBase: 40000,
            annualInterestIncome: 300,
            annualEligibleDividends: 100,
            annualNonEligibleDividends: 50,
            annualRealizedCapitalGains: 700,
          },
        ],
      };

      const result = transformToProjectionInput(fixture);

      expect(result.nonRegBalance).toBe(150000);
      expect(result.nonRegACB).toBe(105000);
      expect(result.nonRegInterestIncome).toBe(1500);
      expect(result.nonRegEligibleDividends).toBe(2500);
      expect(result.nonRegNonEligibleDividends).toBe(650);
      expect(result.nonRegRealizedCapitalGains).toBe(3700);
    });

    it('keeps existing non-registered scenarios backward-compatible when breakdown fields are absent', () => {
      const result = transformToProjectionInput(singleUserFixture);

      expect(result.nonRegBalance).toBe(31750);
      expect(result.nonRegACB).toBeUndefined();
      expect(result.nonRegInterestIncome).toBeUndefined();
      expect(result.nonRegEligibleDividends).toBeUndefined();
      expect(result.nonRegNonEligibleDividends).toBeUndefined();
      expect(result.nonRegRealizedCapitalGains).toBeUndefined();
    });

    it('preserves explicit zero ACB from primary non-registered account cards', () => {
      const result = transformToProjectionInput({
        ...singleUserFixture,
        accounts: [{ type: 'NonRegistered', balance: 100000, adjustedCostBase: 0 }],
      });

      expect(result.nonRegBalance).toBe(100000);
      expect(result.nonRegACB).toBe(0);
    });

    it('converts percent to decimal for inflationRate and investmentReturn', () => {
      const fixture: FrontendInputData = {
        ...singleUserFixture,
        accounts: [{ type: 'RRSP', balance: 50000 }],
        assumptions: { inflationRate: 2.5, investmentReturnRate: 7.0 },
      };

      const result = transformToProjectionInput(fixture);

      // D-05: percent-to-decimal conversions
      expect(result.inflationRate).toBe(0.025); // 2.5 / 100
      expect(result.investmentReturn).toBe(0.07); // 7.0 / 100
    });

    it('uses defaults when assumptions is undefined', () => {
      // Omit assumptions entirely (not present on the object)
      const { assumptions: _assumptions, ...fixtureWithoutAssumptions } = singleUserFixture;
      const fixture: FrontendInputData = {
        ...fixtureWithoutAssumptions,
        // No investmentReturnRate on any account
        accounts: [{ type: 'RRSP', balance: 50000 }],
      };

      const result = transformToProjectionInput(fixture);

      // D-06: defaults when assumptions omitted
      expect(result.inflationRate).toBe(0.025);
      expect(result.investmentReturn).toBe(0.05);
      expect(result.employmentGrowthRate).toBe(0.02);
    });

    it('transforms maritalStatus commonLaw to common_law', () => {
      const result = transformToProjectionInput(singleUserFixture);

      // D-03: commonLaw (camelCase) -> common_law (underscore)
      expect(result.maritalStatus).toBe('common_law');
    });

    it('excludes divorced and widowed from maritalStatus', () => {
      // D-03: divorced should produce undefined maritalStatus
      const divorcedFixture: FrontendInputData = {
        ...singleUserFixture,
        personalInfo: { ...singleUserFixture.personalInfo, maritalStatus: 'divorced' },
      };
      const divorcedResult = transformToProjectionInput(divorcedFixture);
      expect(divorcedResult.maritalStatus).toBeUndefined();

      // D-03: widowed should produce undefined maritalStatus
      const widowedFixture: FrontendInputData = {
        ...singleUserFixture,
        personalInfo: { ...singleUserFixture.personalInfo, maritalStatus: 'widowed' },
      };
      const widowedResult = transformToProjectionInput(widowedFixture);
      expect(widowedResult.maritalStatus).toBeUndefined();
    });

    it('omits expectedCPPAt65 when estimatedCppAmount is undefined', () => {
      const fixture: FrontendInputData = {
        ...singleUserFixture,
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
      };

      const result = transformToProjectionInput(fixture);

      expect(result.expectedCPPAt65).toBeUndefined();
    });

    /**
     * Phase 1 (CR-01 regression coverage) — applyScenarioDecisions stores
     * withdrawalOverrides / spendingOverrides / surplusDestination on the
     * extended ScenarioAppliedInput shape (which extends FrontendInputData).
     * transformToProjectionInput MUST forward these fields to the engine; if
     * they are dropped, the entire override pipeline is silently broken.
     * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-15
     */
    describe('Phase 1 override field forwarding (D-01, D-02, D-15)', () => {
      it('forwards withdrawalOverrides from ScenarioAppliedInput to ProjectionInput', () => {
        const overrides = [
          { field: 'rrsp' as const, year: 2031, amount: 50000, applyForward: true },
          { field: 'tfsa' as const, year: 2032, amount: 10000, applyForward: false },
        ];
        const fixture = {
          ...singleUserFixture,
          withdrawalOverrides: overrides,
        } as FrontendInputData & {
          withdrawalOverrides: typeof overrides;
        };

        const result = transformToProjectionInput(fixture);

        expect(result.withdrawalOverrides).toEqual(overrides);
      });

      it('forwards spendingOverrides from ScenarioAppliedInput to ProjectionInput', () => {
        const overrides = [
          { year: 2032, amount: 65000, applyForward: true },
          { year: 2035, amount: 80000, applyForward: false },
        ];
        const fixture = {
          ...singleUserFixture,
          spendingOverrides: overrides,
        } as FrontendInputData & {
          spendingOverrides: typeof overrides;
        };

        const result = transformToProjectionInput(fixture);

        expect(result.spendingOverrides).toEqual(overrides);
      });

      it('forwards surplusDestination from ScenarioAppliedInput to ProjectionInput', () => {
        const fixture = {
          ...singleUserFixture,
          surplusDestination: 'tfsa' as const,
        } as FrontendInputData & { surplusDestination: 'tfsa' };

        const result = transformToProjectionInput(fixture);

        expect(result.surplusDestination).toBe('tfsa');
      });

      it('omits override fields entirely when ScenarioAppliedInput does not set them (additive invariant)', () => {
        // Pre-Phase-1 scenario shape — no override fields on the extended input.
        const result = transformToProjectionInput(singleUserFixture);

        expect(result.withdrawalOverrides).toBeUndefined();
        expect(result.spendingOverrides).toBeUndefined();
        expect(result.surplusDestination).toBeUndefined();
      });

      it('forwards all three Phase 1 fields together when set', () => {
        const withdrawalOverrides = [
          { field: 'rrsp' as const, year: 2031, amount: 25000, applyForward: true },
        ];
        const spendingOverrides = [{ year: 2031, amount: 65000, applyForward: true }];
        const fixture = {
          ...singleUserFixture,
          withdrawalOverrides,
          spendingOverrides,
          surplusDestination: 'nonreg' as const,
        } as FrontendInputData & {
          withdrawalOverrides: typeof withdrawalOverrides;
          spendingOverrides: typeof spendingOverrides;
          surplusDestination: 'nonreg';
        };

        const result = transformToProjectionInput(fixture);

        expect(result.withdrawalOverrides).toEqual(withdrawalOverrides);
        expect(result.spendingOverrides).toEqual(spendingOverrides);
        expect(result.surplusDestination).toBe('nonreg');
      });
    });

    /**
     * Phase 26 — ENG-01..04 strategy field forwarding (trip-wire for Pitfall 1).
     *
     * applyScenarioDecisions writes the 7 strategy fields onto the extended
     * ScenarioAppliedInput shape at scenario-decisions.ts:135-244. Prior to
     * Phase 26 the `applied` cast in transformToProjectionInput did NOT declare
     * these fields, so they were silently dropped at the API layer — every
     * preset and account-priority decision was cosmetic until this phase.
     *
     * These tests fail against the pre-Phase-26 transformer (no `applied.X`
     * declaration → no forwarding `if` block → result.X stays undefined).
     * They are the regression trip-wire required by ENG-05.
     *
     * @see .planning/phases/26-engine-field-forwarding/26-CONTEXT.md (Pitfall 1)
     * @see .planning/phases/26-engine-field-forwarding/26-RESEARCH.md (audit table)
     */
    describe('Phase 26: ScenarioDecisions strategy field forwarding (ENG-01..04)', () => {
      it('forwards drawdownOrder from ScenarioAppliedInput to ProjectionInput (ENG-01)', () => {
        const drawdownOrder = ['tfsa', 'rrsp', 'nonReg'];
        const fixture = {
          ...singleUserFixture,
          drawdownOrder,
        } as FrontendInputData & { drawdownOrder: string[] };

        const result = transformToProjectionInput(fixture);

        expect(result.drawdownOrder).toEqual(drawdownOrder);
      });

      it('forwards rrspMeltdown from ScenarioAppliedInput to ProjectionInput (ENG-02)', () => {
        const rrspMeltdown = {
          enabled: true,
          annualAmount: 25000,
          startYear: 2032,
          endYear: 2040,
        };
        const fixture = {
          ...singleUserFixture,
          rrspMeltdown,
        } as FrontendInputData & { rrspMeltdown: typeof rrspMeltdown };

        const result = transformToProjectionInput(fixture);

        expect(result.rrspMeltdown).toEqual(rrspMeltdown);
      });

      /**
       * Phase 26 review WR-02 trip-wire — rrspMeltdown.targetAmount (RMLT-03 floor guard).
       *
       * ScenarioDecisions.rrspMeltdown declares `targetAmount?: number` and the engine reads
       * it as the RMLT-03 floor guard. Pre-WR-02, `ScenarioAppliedInput.rrspMeltdown` only
       * declared 4 fields and `applyScenarioDecisions` (scenario-decisions.ts:143-150) copied
       * only those 4 — `targetAmount` was silently stripped BEFORE the Phase 26 transformer
       * forward ever saw it. End-to-end: user-configured `targetAmount` never reached engine.
       *
       * This test runs the full applyScenarioDecisions → transformToProjectionInput chain
       * because the regression lives upstream of the transformer cast — a transformer-only
       * test (mirroring ENG-02 above) would pass even when targetAmount is stripped.
       *
       * @see .planning/phases/26-engine-field-forwarding/26-REVIEW.md WR-02
       * @see packages/shared/src/types/projection.ts (ProjectionInput.rrspMeltdown.targetAmount — RMLT-03)
       */
      it('round-trips rrspMeltdown.targetAmount through applyScenarioDecisions + transformToProjectionInput (WR-02)', () => {
        const decisions: ScenarioDecisions = {
          rrspMeltdown: {
            enabled: true,
            annualAmount: 25000,
            startYear: 2032,
            endYear: 2040,
            targetAmount: 50000,
          },
        };

        const applied = applyScenarioDecisions(singleUserFixture, decisions);

        // First proof point: applyScenarioDecisions must preserve targetAmount.
        // Pre-WR-02 this assertion failed — targetAmount was stripped at the copy.
        expect(applied.rrspMeltdown?.targetAmount).toBe(50000);

        // Second proof point: the transformer must forward the full rrspMeltdown
        // object (already covered by ENG-02 above, but re-asserting end-to-end).
        const result = transformToProjectionInput(applied);
        expect(result.rrspMeltdown?.targetAmount).toBe(50000);
      });

      it('round-trips rrspMeltdown without targetAmount through applyScenarioDecisions (WR-02 — omission preserved)', () => {
        const decisions: ScenarioDecisions = {
          rrspMeltdown: {
            enabled: true,
            annualAmount: 25000,
            startYear: 2032,
            endYear: 2040,
          },
        };

        const applied = applyScenarioDecisions(singleUserFixture, decisions);

        // When targetAmount is omitted from decisions, the copy must NOT introduce
        // an undefined `targetAmount` key — additive-invariant.
        expect(applied.rrspMeltdown).toEqual({
          enabled: true,
          annualAmount: 25000,
          startYear: 2032,
          endYear: 2040,
        });
        expect(applied.rrspMeltdown).not.toHaveProperty('targetAmount');
      });

      it('forwards oasClawbackAvoidance from ScenarioAppliedInput to ProjectionInput (ENG-03)', () => {
        const oasClawbackAvoidance = { enabled: true, incomeThreshold: 90997 };
        const fixture = {
          ...singleUserFixture,
          oasClawbackAvoidance,
        } as FrontendInputData & { oasClawbackAvoidance: typeof oasClawbackAvoidance };

        const result = transformToProjectionInput(fixture);

        expect(result.oasClawbackAvoidance).toEqual(oasClawbackAvoidance);
      });

      it('forwards incomeSplitting from ScenarioAppliedInput to ProjectionInput (ENG-04 audit promotion)', () => {
        const incomeSplitting = { enabled: true, splitPercent: 0.5 };
        const fixture = {
          ...singleUserFixture,
          incomeSplitting,
        } as FrontendInputData & { incomeSplitting: typeof incomeSplitting };

        const result = transformToProjectionInput(fixture);

        expect(result.incomeSplitting).toEqual(incomeSplitting);
      });

      it('forwards contributionOverrides from ScenarioAppliedInput to ProjectionInput (ENG-04 audit promotion)', () => {
        const contributionOverrides = [
          { accountType: 'rrsp' as const, annualAmount: 12000, startYear: 2027, endYear: 2030 },
          { accountType: 'tfsa' as const, annualAmount: 7000, startYear: 2027, endYear: 2030 },
        ];
        const fixture = {
          ...singleUserFixture,
          contributionOverrides,
        } as FrontendInputData & { contributionOverrides: typeof contributionOverrides };

        const result = transformToProjectionInput(fixture);

        expect(result.contributionOverrides).toEqual(contributionOverrides);
      });

      it('forwards ageBandReductions from ScenarioAppliedInput to ProjectionInput (ENG-04 audit promotion)', () => {
        const ageBandReductions = [
          { fromAge: 75, reductionPercent: 0.1 },
          { fromAge: 85, reductionPercent: 0.2 },
        ];
        const fixture = {
          ...singleUserFixture,
          ageBandReductions,
        } as FrontendInputData & { ageBandReductions: typeof ageBandReductions };

        const result = transformToProjectionInput(fixture);

        expect(result.ageBandReductions).toEqual(ageBandReductions);
      });

      it('forwards legacyTarget from ScenarioAppliedInput to ProjectionInput (ENG-04 audit promotion, including the 0 edge case)', () => {
        const fixture = {
          ...singleUserFixture,
          legacyTarget: 0,
        } as FrontendInputData & { legacyTarget: number };

        const result = transformToProjectionInput(fixture);

        // `!== undefined` semantics — `legacyTarget: 0` must forward, not be coerced to undefined by truthiness.
        expect(result.legacyTarget).toBe(0);
      });

      it('Test A — applyScenarioDecisions writes decisions.inflationRate into BOTH result.inflationRate (decimal) AND result.assumptions.inflationRate (percent) — load-bearing trip-wire for the SPD-02 patch', () => {
        // Construct a base whose `assumptions.inflationRate` is DELIBERATELY DIFFERENT
        // from the decision-level value so a passing post-fix assertion CANNOT be
        // satisfied by the pre-fix code path (which only writes top-level
        // result.inflationRate and leaves result.assumptions.inflationRate at the
        // base value of 2.5). This is the load-bearing assertion that the patched
        // `result.assumptions = { ...result.assumptions, inflationRate: decisions.inflationRate * 100 }`
        // write in scenario-decisions.ts:~221-228 actually runs.
        const base: FrontendInputData = {
          ...singleUserFixture,
          assumptions: { ...singleUserFixture.assumptions, inflationRate: 2.5 },
        };
        const decisions: ScenarioDecisions = { inflationRate: 0.03 };

        const applied = applyScenarioDecisions(base, decisions) as FrontendInputData & {
          inflationRate?: number;
          assumptions?: { inflationRate?: number };
        };

        // Top-level decimal — pre-existing behavior; must remain intact post-patch.
        expect(applied.inflationRate).toBe(0.03);
        // The patched write — assumes percentage. Pre-fix this is still 2.5; post-fix it is 3.
        // This single assertion is what the patch is load-bearing for.
        expect(applied.assumptions?.inflationRate).toBe(3);
      });

      it('Test B — decision-level inflationRate round-trips through transformToProjectionInput to ProjectionInput.inflationRate (end-to-end proof the patch reaches the transformer)', () => {
        // Same base + decisions as Test A. Different proof point: the transformer
        // reads `frontendInput.assumptions?.inflationRate` (percent) and divides by
        // 100 to produce `ProjectionInput.inflationRate` (decimal). If the patch
        // does NOT write into assumptions, the transformer reads the un-overridden
        // base value 2.5 → result.inflationRate ≈ 0.025 (fails). Post-patch the
        // transformer reads 3 → result.inflationRate ≈ 0.03 (passes).
        const base: FrontendInputData = {
          ...singleUserFixture,
          assumptions: { ...singleUserFixture.assumptions, inflationRate: 2.5 },
        };
        const decisions: ScenarioDecisions = { inflationRate: 0.03 };
        const applied = applyScenarioDecisions(base, decisions);

        const result = transformToProjectionInput(applied);

        // Transformer converts percent → rate. Use approximate equality to avoid FP drift on /100.
        expect(result.inflationRate).toBeCloseTo(0.03, 10);
      });

      it('omits all seven Phase 26 strategy fields when ScenarioAppliedInput does not set them (additive invariant)', () => {
        const result = transformToProjectionInput(singleUserFixture);

        expect(result.drawdownOrder).toBeUndefined();
        expect(result.rrspMeltdown).toBeUndefined();
        expect(result.oasClawbackAvoidance).toBeUndefined();
        expect(result.incomeSplitting).toBeUndefined();
        expect(result.contributionOverrides).toBeUndefined();
        expect(result.ageBandReductions).toBeUndefined();
        expect(result.legacyTarget).toBeUndefined();
      });
    });

    describe('couple path', () => {
      /**
       * Main couple fixture (D-07: realistic non-round values)
       */
      const coupleFixture: FrontendInputData = {
        personalInfo: {
          dateOfBirth: '1968-07-22',
          province: 'BC',
          maritalStatus: 'married',
          retirementAge: 62,
          lifeExpectancy: 90,
        },
        spouse: {
          dateOfBirth: '1972-11-08',
          province: 'BC',
          retirementAge: 65,
          lifeExpectancy: 92,
          employmentIncome: 67800,
          incomeEndAge: 65,
          expectedCppAt65: 9450,
          cppStartAge: 65,
          oasStartAge: 65,
          yearsOfResidence: 35,
          rrspBalance: 78300,
          rrspAnnualContribution: 4200,
          tfsaBalance: 52100,
          tfsaAnnualContribution: 6500,
          nonRegBalance: 18900,
        },
        coupleSettings: {
          optimizePensionSplitting: false,
          sharedRetirementSpending: 85000,
          useYoungerSpouseForRRIF: false,
        },
        accounts: [{ type: 'RRSP', balance: 215600, annualContribution: 8400 }],
        incomeSources: [{ type: 'employment', annualAmount: 112300 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 13200 },
        expenses: { currentAnnualExpenses: 95400, retirementAnnualExpenses: 85000 },
      };

      it('maps couple wizard input with spouse to ProjectionInput with spouse and coupleSettings', () => {
        const result = transformToProjectionInput(coupleFixture);

        // Spouse is present
        expect(result.spouse).toBeDefined();
        const spouse = result.spouse;
        if (!spouse) throw new Error('spouse is undefined');

        // Spouse fields — all mapped exactly
        expect(spouse.birthdate).toEqual(new Date('1972-11-08'));
        expect(spouse.province).toBe('BC');
        expect(spouse.retirementAge).toBe(65);
        expect(spouse.lifeExpectancy).toBe(92);
        expect(spouse.employmentIncome).toBe(67800);
        expect(spouse.employmentGrowthRate).toBe(0.02);
        expect(spouse.expectedCPPAt65).toBe(9450);
        expect(spouse.cppStartAge).toBe(65);
        expect(spouse.oasStartAge).toBe(65);
        expect(spouse.yearsOfResidence).toBe(35);
        expect(spouse.rrspBalance).toBe(78300);
        expect(spouse.rrspAnnualContribution).toBe(4200);
        expect(spouse.tfsaBalance).toBe(52100);
        expect(spouse.tfsaAnnualContribution).toBe(6500);
        expect(spouse.nonRegBalance).toBe(18900);

        // CoupleSettings — explicit values pass through exactly
        expect(result.coupleSettings).toBeDefined();
        const coupleSettings = result.coupleSettings;
        if (!coupleSettings) throw new Error('coupleSettings is undefined');
        expect(coupleSettings.optimizePensionSplitting).toBe(false);
        expect(coupleSettings.sharedRetirementSpending).toBe(85000);
        expect(coupleSettings.useYoungerSpouseForRRIF).toBe(false);
      });

      it('keeps annual debt payments separate from couple shared retirement spending', () => {
        const result = transformToProjectionInput({
          ...coupleFixture,
          expenses: {
            ...coupleFixture.expenses,
            debtPaymentsAnnual: 12000,
            debtPaymentYears: 10,
          },
        });

        expect(result.retirementSpending).toBe(85000);
        expect(result.debtPaymentsAnnual).toBe(12000);
        expect(result.debtPaymentYears).toBe(10);
        expect(result.coupleSettings?.sharedRetirementSpending).toBe(85000);
      });

      it('preserves explicit zero ACB from spouse non-registered account cards', () => {
        const fixture: FrontendInputData = {
          ...coupleFixture,
          spouse: {
            dateOfBirth: '1972-11-08',
            province: 'BC',
          },
          accounts: [
            { type: 'RRSP', balance: 215600, annualContribution: 8400 },
            {
              type: 'NonRegistered',
              balance: 50000,
              adjustedCostBase: 0,
              belongsTo: 'spouse',
            },
          ],
        };

        const result = transformToProjectionInput(fixture);

        expect(result.spouse?.nonRegBalance).toBe(50000);
        expect(result.spouse?.nonRegACB).toBe(0);
      });

      it('applies spouse defaults for omitted optional fields', () => {
        // Build fixture without coupleSettings key (omit rather than set undefined — exactOptionalPropertyTypes)
        const { coupleSettings: _cs, ...fixtureWithoutCoupleSettings } = coupleFixture;
        const fixture: FrontendInputData = {
          ...fixtureWithoutCoupleSettings,
          personalInfo: {
            dateOfBirth: '1968-07-22',
            province: 'BC',
            maritalStatus: 'married',
            retirementAge: 62,
            lifeExpectancy: 90,
          },
          spouse: {
            // Only dateOfBirth — all other fields omitted
            dateOfBirth: '1975-01-20',
          },
        };

        const result = transformToProjectionInput(fixture);

        expect(result.spouse).toBeDefined();
        const spouse = result.spouse;
        if (!spouse) throw new Error('spouse is undefined');

        // Falls back to primary values
        expect(spouse.retirementAge).toBe(62); // falls back to primary's retirementAge
        expect(spouse.lifeExpectancy).toBe(90); // falls back to primary's lifeExpectancy

        // Numeric defaults
        expect(spouse.employmentIncome).toBe(0);
        expect(spouse.expectedCPPAt65).toBe(0);
        expect(spouse.cppStartAge).toBe(65);
        expect(spouse.oasStartAge).toBe(65);
        expect(spouse.yearsOfResidence).toBe(40);
        expect(spouse.rrspBalance).toBe(0);
        expect(spouse.rrspAnnualContribution).toBe(0);
        expect(spouse.tfsaBalance).toBe(0);
        expect(spouse.tfsaAnnualContribution).toBe(0);
        expect(spouse.nonRegBalance).toBe(0);
      });

      it('applies coupleSettings defaults', () => {
        // Omit coupleSettings key entirely (exactOptionalPropertyTypes — cannot set to undefined)
        const { coupleSettings: _cs2, ...coupleFixtureWithoutSettings } = coupleFixture;
        const fixture: FrontendInputData = {
          ...coupleFixtureWithoutSettings,
          spouse: { dateOfBirth: '1972-11-08' },
          // No coupleSettings provided
        };

        const result = transformToProjectionInput(fixture);

        // coupleSettings.useYoungerSpouseForRRIF defaults to true — verified per CONTEXT.md specifics
        expect(result.coupleSettings).toBeDefined();
        const coupleSettings = result.coupleSettings;
        if (!coupleSettings) throw new Error('coupleSettings is undefined');
        expect(coupleSettings.optimizePensionSplitting).toBe(true);
        expect(coupleSettings.useYoungerSpouseForRRIF).toBe(true);

        // sharedRetirementSpending should not be set when not provided
        expect('sharedRetirementSpending' in coupleSettings).toBe(false);
      });

      it('passes explicit coupleSettings values through', () => {
        const result = transformToProjectionInput(coupleFixture);

        expect(result.coupleSettings).toBeDefined();
        const coupleSettings = result.coupleSettings;
        if (!coupleSettings) throw new Error('coupleSettings is undefined');
        expect(coupleSettings.optimizePensionSplitting).toBe(false);
        expect(coupleSettings.sharedRetirementSpending).toBe(85000);
        expect(coupleSettings.useYoungerSpouseForRRIF).toBe(false);
      });

      it('includes spouse province when provided', () => {
        const result = transformToProjectionInput(coupleFixture);

        expect(result.spouse).toBeDefined();
        const spouse = result.spouse;
        if (!spouse) throw new Error('spouse is undefined');
        expect(spouse.province).toBe('BC');
      });

      it('omits spouse province when not provided', () => {
        const fixture: FrontendInputData = {
          ...coupleFixture,
          spouse: {
            dateOfBirth: '1972-11-08',
            retirementAge: 65,
            lifeExpectancy: 92,
            // No province
          },
        };

        const result = transformToProjectionInput(fixture);

        expect(result.spouse).toBeDefined();
        const spouse = result.spouse;
        if (!spouse) throw new Error('spouse is undefined');
        expect(spouse.province).toBeUndefined();
      });

      it('keeps spouse-owned TFSA accounts on the spouse instead of charging them to primary', () => {
        const fixture: FrontendInputData = {
          personalInfo: {
            dateOfBirth: '1985-08-30',
            province: 'ON',
            maritalStatus: 'married',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          spouse: {
            dateOfBirth: '1984-04-03',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          accounts: [
            {
              type: 'TFSA',
              name: 'Primary TFSA',
              balance: 0,
              annualContribution: 7000,
              belongsTo: 'primary',
            },
            {
              type: 'TFSA',
              name: 'Spouse TFSA',
              balance: 0,
              annualContribution: 7000,
              belongsTo: 'spouse',
            },
          ],
          incomeSources: [{ type: 'employment', annualAmount: 125000 }],
          governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
          expenses: { currentAnnualExpenses: 87500, retirementAnnualExpenses: 87500 },
        };

        const result = transformToProjectionInput(fixture);
        expect(result.tfsaAnnualContribution).toBe(7000);
        expect(result.spouse?.tfsaAnnualContribution).toBe(7000);
      });

      it('infers spousal RRSP contributions from spouse-owned RRSP cards with primary contributor', () => {
        const fixture: FrontendInputData = {
          personalInfo: {
            dateOfBirth: '1985-08-30',
            province: 'ON',
            maritalStatus: 'married',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          spouse: {
            dateOfBirth: '1984-04-03',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          accounts: [
            {
              type: 'RRSP',
              name: 'Spousal RRSP',
              balance: 0,
              annualContribution: 19000,
              belongsTo: 'spouse',
              contributorOwner: 'primary',
              contributionRoom: 30000,
            },
          ],
          incomeSources: [{ type: 'employment', annualAmount: 125000 }],
          governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
          expenses: { currentAnnualExpenses: 87500, retirementAnnualExpenses: 87500 },
        };

        const result = transformToProjectionInput(fixture);
        // rrspAnnualContribution is the COMBINED personal+spousal total expected by the engine
        // (multi-year.ts:1011-1019). Fixture has no personal RRSP, so combined = $0 + $19k.
        expect(result.rrspAnnualContribution).toBe(19000);
        expect(result.spousalRrspContribution).toBe(19000);
        expect(result.rrspUnusedRoomSeed).toBe(30000);
        expect(result.spouse?.rrspBalance).toBe(0);
        expect(result.spouse?.rrspAnnualContribution).toBe(0);
      });

      it('routes personal + spousal RRSP contributions to correct balances end-to-end (demo household fixture)', () => {
        // Mirrors the canonical public demo household reproducer.
        // Regression for the contract mismatch where the transformer's inferred spousal
        // contribution wasn't added to rrspAnnualContribution (the engine's combined
        // personal+spousal total). The bug caused the personal $7,250 to be silently
        // re-routed into the spouse's RRSP and the surplus spousal amount to vanish.
        // @see packages/calculation-engine/src/projection/multi-year.ts:1011-1019
        //
        // Note: contributionRoom is set high on the personal RRSP to isolate the
        // contribution-routing fix from the engine's CRA room cap (18% × prior-year
        // earned would otherwise cap combined at ~$22,500 for $125k income).
        const fixture: FrontendInputData = {
          personalInfo: {
            dateOfBirth: '1985-08-30',
            province: 'ON',
            maritalStatus: 'married',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          spouse: {
            dateOfBirth: '1984-04-03',
            province: 'ON',
            retirementAge: 65,
            lifeExpectancy: 90,
            employmentIncome: 0,
          },
          accounts: [
            {
              type: 'TFSA',
              name: 'TFSA Primary',
              balance: 0,
              annualContribution: 7000,
              belongsTo: 'primary',
            },
            {
              type: 'TFSA',
              name: 'TFSA Spouse',
              balance: 0,
              annualContribution: 7000,
              belongsTo: 'spouse',
            },
            {
              type: 'RRSP',
              name: 'Spousal RRSP Spouse',
              balance: 0,
              annualContribution: 19000,
              belongsTo: 'spouse',
              contributorOwner: 'primary',
            },
            {
              type: 'RRSP',
              name: 'Personal RRSP Primary',
              balance: 0,
              annualContribution: 7250,
              belongsTo: 'primary',
              contributionRoom: 100000,
            },
          ],
          incomeSources: [{ type: 'employment', annualAmount: 125000 }],
          governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
          expenses: { currentAnnualExpenses: 87500, retirementAnnualExpenses: 87500 },
          assumptions: { inflationRate: 2.1, investmentReturnRate: 6.5 },
        };

        const result = transformToProjectionInput(fixture);
        expect(result.rrspAnnualContribution).toBe(26250); // $7,250 personal + $19,000 spousal
        expect(result.spousalRrspContribution).toBe(19000);

        const output = runCoupleProjection(result);
        const yearOne = output.yearlyResults.filter(isCoupleResult)[0];
        if (!yearOne) throw new Error('expected at least one couple-shaped yearly result');

        // Year-1 balances after contribution + 6.5% growth:
        //   primary: $7,250 personal → ~$7,721
        //   spouse:  $19,000 spousal → ~$20,235
        // Pre-fix bug: primary stayed at $0 and spouse only received the truncated
        // $7,250, growing to ~$7,721. Range checks tolerate engine timing details
        // (mid-year vs end-of-year compounding) without baking exact numbers in.
        expect(yearOne.primary.rrspBalance).toBeGreaterThan(7000);
        expect(yearOne.primary.rrspBalance).toBeLessThan(8000);
        expect(yearOne.spouse.rrspBalance).toBeGreaterThan(18500);
        expect(yearOne.spouse.rrspBalance).toBeLessThan(21000);
      });

      it('seeds spouse-owned personal RRSP room onto the spouse ledger', () => {
        const fixture: FrontendInputData = {
          personalInfo: {
            dateOfBirth: '1985-08-30',
            province: 'ON',
            maritalStatus: 'married',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          spouse: {
            dateOfBirth: '1984-04-03',
            retirementAge: 65,
            lifeExpectancy: 90,
          },
          accounts: [
            {
              type: 'RRSP',
              name: 'Spouse RRSP',
              balance: 0,
              annualContribution: 5000,
              belongsTo: 'spouse',
              contributionRoom: 18000,
            },
          ],
          incomeSources: [{ type: 'employment', annualAmount: 125000 }],
          governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
          expenses: { currentAnnualExpenses: 87500, retirementAnnualExpenses: 87500 },
        };

        const result = transformToProjectionInput(fixture);
        expect(result.spouse?.rrspUnusedRoomSeed).toBe(18000);
      });
    });

    /**
     * Regression tests for BUG-01: pension income silently dropped by transformer
     * @see docs/source-of-truth/03-income-sources.md - Pension Income
     * @see TC-TRANS-PENSION-001
     */
    describe('pension income extraction', () => {
      it('extracts pension income and startAge from a single pension income source', () => {
        // Test A: single pension source
        const fixture: FrontendInputData = {
          ...singleUserFixture,
          incomeSources: [
            { type: 'employment', name: 'Software consulting', annualAmount: 94500 },
            { type: 'pension', name: 'DB Pension', annualAmount: 24000, startAge: 60 },
          ],
        };

        const result = transformToProjectionInput(fixture);

        // BUG-01 regression: transformer was silently dropping pension sources
        expect(result.pensionIncome).toBe(24000);
        expect(result.pensionStartAge).toBe(60);
      });

      it('sums multiple pension sources and uses earliest startAge', () => {
        // Test B: two pension sources — amounts summed, earliest startAge wins
        const fixture: FrontendInputData = {
          ...singleUserFixture,
          incomeSources: [
            { type: 'pension', name: 'DB Pension', annualAmount: 18000, startAge: 60 },
            { type: 'pension', name: 'Former Employer Pension', annualAmount: 6000, startAge: 55 },
          ],
        };

        const result = transformToProjectionInput(fixture);

        expect(result.pensionIncome).toBe(24000); // 18000 + 6000
        expect(result.pensionStartAge).toBe(55); // min(60, 55)
      });

      it('returns undefined pensionIncome and pensionStartAge when no pension sources', () => {
        // Test C: no pension sources — backward compatible (undefined)
        const fixture: FrontendInputData = {
          ...singleUserFixture,
          incomeSources: [{ type: 'employment', name: 'Software consulting', annualAmount: 94500 }],
        };

        const result = transformToProjectionInput(fixture);

        expect(result.pensionIncome).toBeUndefined();
        expect(result.pensionStartAge).toBeUndefined();
      });

      it('engine output rows have zero pensionIncome before startAge and non-zero at/after startAge', () => {
        // Test D: engine age guard — rows before pensionStartAge must be 0
        // Uses runProjection directly with a minimal ProjectionInput (not via transformer).
        // Birthdate 1975-01-01 -> startAge ~51 in 2026. lifeExpectancy 85 -> endYear ~2060.
        // Large RRSP ($800K) + TFSA ($200K) ensures the projection runs past age 65 before
        // assets deplete (retirement spending $50K/yr covered by $1M+ portfolio).
        const input = {
          birthdate: new Date('1975-01-01'),
          province: 'ON' as const,
          retirementAge: 60,
          lifeExpectancy: 85,
          employmentIncome: 0,
          employmentGrowthRate: 0,
          pensionIncome: 24000,
          pensionStartAge: 65,
          rrspBalance: 800000,
          rrspAnnualContribution: 0,
          tfsaBalance: 200000,
          tfsaAnnualContribution: 0,
          nonRegBalance: 0,
          retirementSpending: 50000,
          investmentReturn: 0.05,
          inflationRate: 0.025,
          expectedCPPAt65: 8000,
          cppStartAge: 65,
          oasStartAge: 65,
        };

        const output = runSingleProjection(input);

        // Find rows before pension age (age < 65) and at/after pension age (age >= 65)
        const preStartAgeRows = output.yearlyResults.filter((r) => r.age < 65);
        const atStartAgeRows = output.yearlyResults.filter((r) => r.age >= 65);

        // All pre-startAge rows must have zero pension income
        expect(preStartAgeRows.length).toBeGreaterThan(0);
        for (const row of preStartAgeRows) {
          expect(row.pensionIncome).toBe(0);
        }

        // At/after-startAge rows must exist and have non-zero pension income
        expect(atStartAgeRows.length).toBeGreaterThan(0);
        for (const row of atStartAgeRows) {
          expect(row.pensionIncome).toBeGreaterThan(0);
        }
      });

      it('couple engine: primary pensionStartAge guard produces zero before age and non-zero at/after', () => {
        // Test E: BUG-01 regression for COUPLE path — pensionStartAge guard was missing
        // in multi-year.ts couple loop (primaryAge/spouseAge guards added in gap closure).
        // Primary: born 1975, pensionStartAge=65, $24K/yr pension
        // Spouse: born 1977, no pension
        // Large assets ensure projection runs well past age 65.
        const input = {
          birthdate: new Date('1975-01-01'),
          province: 'ON' as const,
          retirementAge: 60,
          lifeExpectancy: 85,
          employmentIncome: 0,
          employmentGrowthRate: 0,
          pensionIncome: 24000,
          pensionStartAge: 65,
          rrspBalance: 800000,
          rrspAnnualContribution: 0,
          tfsaBalance: 200000,
          tfsaAnnualContribution: 0,
          nonRegBalance: 0,
          retirementSpending: 40000,
          investmentReturn: 0.05,
          inflationRate: 0.025,
          expectedCPPAt65: 8000,
          cppStartAge: 65,
          oasStartAge: 65,
          spouse: {
            birthdate: new Date('1977-06-01'),
            retirementAge: 60,
            lifeExpectancy: 85,
            employmentIncome: 0,
            rrspBalance: 400000,
            tfsaBalance: 100000,
            expectedCPPAt65: 7000,
          },
          coupleSettings: {
            optimizePensionSplitting: false,
            sharedRetirementSpending: 80000,
            useYoungerSpouseForRRIF: false,
          },
        };

        const output = runCoupleProjection(input);
        const coupleRows = output.yearlyResults.filter(isCoupleResult);
        const preAgeRows = coupleRows.filter((r) => r.primary.age < 65);
        // Primary lifeExpectancy is 85; rows past that model a deceased primary
        // whose pensionIncome is correctly zeroed. The guard under test is
        // "pension starts at pensionStartAge", so restrict the post-age filter
        // to years where the primary is still alive.
        const postAgeRows = coupleRows.filter((r) => r.primary.age >= 65 && r.primary.age <= 85);

        expect(coupleRows.length).toBeGreaterThan(0);
        expect(preAgeRows.length).toBeGreaterThan(0);
        for (const row of preAgeRows) {
          expect(row.primary.pensionIncome).toBe(0);
        }
        expect(postAgeRows.length).toBeGreaterThan(0);
        for (const row of postAgeRows) {
          expect(row.primary.pensionIncome).toBeGreaterThan(0);
        }
      });
    });
  });

  it('keeps year-by-year debt payments fixed until amortization ends', () => {
    const taxCalculation = {
      year: 2026,
      owner: 'primary',
      employmentIncome: 0,
      pensionIncome: 0,
      rrifIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      investmentIncome: 0,
      capitalGains: 0,
      dividendIncomeEligible: 0,
      dividendIncomeNonEligible: 0,
      grossIncome: 0,
      deductions: 0,
      taxableIncome: 0,
      netIncome: 0,
      federalTaxGross: 0,
      federalCredits: 0,
      totalTax: 0,
      federalTaxNet: 0,
      provincialTaxGross: 0,
      provincialCredits: 0,
      provincialTaxNet: 0,
      marginalRateFederal: 0,
      marginalRateProvincial: 0,
      marginalRateCombined: 0,
      effectiveRate: 0,
      oasClawback: 0,
      ageCredit: 0,
      pensionCredit: 0,
    };

    const yearlyResults = [2026, 2027, 2028].map((year, index) => ({
      year,
      age: 50 + index,
      employmentIncome: 0,
      pensionIncome: 0,
      cppIncome: 0,
      oasIncome: 0,
      rrifWithdrawal: 0,
      tfsaWithdrawal: 0,
      nonRegWithdrawal: 0,
      totalIncome: 0,
      livingExpenses: 0,
      taxesPaid: 0,
      netCashFlow: 50000,
      rrspBalance: 0,
      rrifBalance: 0,
      tfsaBalance: 0,
      nonRegBalance: 0,
      totalNetWorth: 0,
      taxCalculation: { ...taxCalculation, year },
      rrifForcedMinimum: 0,
      rrifMinimumRate: 0,
      rrifConversionYear: false,
      isRetired: false,
      isRRIFConversionYear: false,
    }));

    const rows = transformToProjectionYearRows({
      id: 'debt-payment-test',
      input: {
        debtPaymentsAnnual: 12000,
        debtPaymentYears: 2,
        inflationRate: 0.05,
      },
      yearlyResults,
      legacyTargetMet: null,
      summary: {
        startYear: 2026,
        endYear: 2028,
      },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    } as never);

    expect(rows.map((row) => row.debtPayments)).toEqual([12000, 12000, undefined]);
    expect(rows.map((row) => row.netCashFlow)).toEqual([38000, 38000, 50000]);
  });

  it('uses household totals for couple yearly chart data', () => {
    const coupleYear: CoupleYearlyResult = {
      year: 2035,
      primary: {
        owner: 'primary',
        year: 2035,
        age: 65,
        employmentIncome: 0,
        pensionIncome: 10000,
        cppIncome: 8000,
        oasIncome: 9000,
        gisIncome: 0,
        rrifWithdrawal: 20000,
        lifWithdrawal: 5000,
        tfsaWithdrawal: 7000,
        nonRegWithdrawal: 10000,
        totalGrossIncome: 69000,
        livingExpenses: 60000,
        taxesPaid: 12000,
        netIncome: 57000,
        netCashFlow: -3000,
        rrspBalance: 300000,
        rrifBalance: 150000,
        liraBalance: 0,
        lifBalance: 25000,
        tfsaBalance: 100000,
        nonRegBalance: 80000,
        totalNetWorth: 655000,
        taxCalculation: {
          year: 2035,
          owner: 'primary',
          employmentIncome: 0,
          pensionIncome: 10000,
          rrifIncome: 25000,
          cppIncome: 8000,
          oasIncome: 9000,
          investmentIncome: 0,
          capitalGains: 0,
          dividendIncomeEligible: 0,
          dividendIncomeNonEligible: 0,
          grossIncome: 52000,
          deductions: 0,
          taxableIncome: 62000,
          netIncome: 62000,
          federalTaxGross: 7000,
          federalCredits: 0,
          totalTax: 12000,
          federalTaxNet: 7000,
          provincialTaxGross: 5000,
          provincialCredits: 0,
          provincialTaxNet: 5000,
          marginalRateFederal: 0,
          marginalRateProvincial: 0,
          marginalRateCombined: 0,
          effectiveRate: 0.19,
          oasClawback: 0,
          ageCredit: 0,
          pensionCredit: 0,
        },
        isRetired: true,
        isRRIFConversionYear: false,
        isLIFConversionYear: false,
        rrifForcedMinimum: 0,
        rrifMinimumRate: 0,
        rrifConversionYear: false,
      },
      spouse: {
        owner: 'spouse',
        year: 2035,
        age: 63,
        employmentIncome: 0,
        pensionIncome: 4000,
        cppIncome: 3000,
        oasIncome: 0,
        gisIncome: 0,
        rrifWithdrawal: 15000,
        lifWithdrawal: 0,
        tfsaWithdrawal: 6000,
        nonRegWithdrawal: 9000,
        totalGrossIncome: 37000,
        livingExpenses: 60000,
        taxesPaid: 5000,
        netIncome: 32000,
        netCashFlow: -28000,
        rrspBalance: 120000,
        rrifBalance: 50000,
        liraBalance: 0,
        lifBalance: 0,
        tfsaBalance: 70000,
        nonRegBalance: 40000,
        totalNetWorth: 280000,
        taxCalculation: {
          year: 2035,
          owner: 'spouse',
          employmentIncome: 0,
          pensionIncome: 4000,
          rrifIncome: 15000,
          cppIncome: 3000,
          oasIncome: 0,
          investmentIncome: 0,
          capitalGains: 0,
          dividendIncomeEligible: 0,
          dividendIncomeNonEligible: 0,
          grossIncome: 22000,
          deductions: 0,
          taxableIncome: 31000,
          netIncome: 31000,
          federalTaxGross: 3000,
          federalCredits: 0,
          totalTax: 5000,
          federalTaxNet: 3000,
          provincialTaxGross: 2000,
          provincialCredits: 0,
          provincialTaxNet: 2000,
          marginalRateFederal: 0,
          marginalRateProvincial: 0,
          marginalRateCombined: 0,
          effectiveRate: 0.16,
          oasClawback: 0,
          ageCredit: 0,
          pensionCredit: 0,
        },
        isRetired: true,
        isRRIFConversionYear: false,
        isLIFConversionYear: false,
        rrifForcedMinimum: 0,
        rrifMinimumRate: 0,
        rrifConversionYear: false,
      },
      householdGrossIncome: 106000,
      householdNetIncome: 89000,
      householdTaxesPaid: 17000,
      householdLivingExpenses: 120000,
      householdNetCashFlow: -31000,
      householdNetWorth: 935000,
      pensionSplitPercentage: 0,
      pensionSplitTaxSavings: 0,
      bothRetired: true,
      eitherRRIFConversion: false,
    };

    const output = transformToFrontendOutput(
      {
        id: 'projection-1',
        input: {} as never,
        yearlyResults: [coupleYear],
        legacyTargetMet: null,
        summary: {
          startYear: 2035,
          endYear: 2035,
          retirementYear: 2035,
          yearsInRetirement: 1,
          peakNetWorth: 935000,
          peakNetWorthYear: 2035,
          portfolioLongevityAge: null,
          totalTaxesPaid: 17000,
          averageRetirementIncome: 89000,
          averageEffectiveTaxRate: 0.175,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 935000,
          lowestNetWorthYear: 2035,
          fundedStatus: {
            state: 'green',
            depletionAge: null,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 0,
          },
          remediationPlan: null,
          primarySummary: {} as never,
          spouseSummary: {} as never,
          primaryRetirementYear: 2035,
          spouseRetirementYear: 2035,
          bothRetiredYear: 2035,
          totalPensionSplitTaxSavings: 0,
          averagePensionSplitPercentage: 0,
          primaryLifeExpectancyYear: 2060,
          spouseLifeExpectancyYear: 2062,
          longestLivingSpouseEndYear: 2062,
        },
        createdAt: new Date('2035-01-01'),
        updatedAt: new Date('2035-01-01'),
      },
      90
    );

    expect(output.yearlyResults).toHaveLength(1);
    expect(output.yearlyResults[0]).toMatchObject({
      age: 65,
      employmentIncome: 0,
      pensionIncome: 14000,
      cppIncome: 11000,
      oasIncome: 9000,
      withdrawals: 72000,
      totalIncome: 106000,
      federalTax: 10000,
      provincialTax: 7000,
      totalTax: 17000,
      netIncome: 89000,
      rrspBalance: 620000,
      tfsaBalance: 170000,
      nonRegBalance: 120000,
      totalNetWorth: 935000,
    });
  });

  /**
   * RRIF field mapping tests (RAPI-01)
   * @see TC-CHAIN-019, TC-CHAIN-020
   */
  describe('RRIF field mapping (RAPI-01)', () => {
    /**
     * @see TC-CHAIN-019 — single-person RRIF field mapping
     */
    it('maps rrifForcedMinimum, rrifMinimumRate, rrifConversionYear for single-person projection', () => {
      const singleOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'rrif-single-test',
        input: {} as never,
        yearlyResults: [
          {
            year: 2040,
            age: 72,
            employmentIncome: 0,
            pensionIncome: 0,
            cppIncome: 12000,
            oasIncome: 8500,
            rrifWithdrawal: 8100,
            tfsaWithdrawal: 0,
            nonRegWithdrawal: 0,
            totalIncome: 28600,
            livingExpenses: 50000,
            taxesPaid: 3000,
            netCashFlow: -24400,
            rrspBalance: 0,
            rrifBalance: 150000,
            tfsaBalance: 80000,
            nonRegBalance: 0,
            totalNetWorth: 230000,
            taxCalculation: {
              year: 2040,
              owner: 'primary',
              employmentIncome: 0,
              pensionIncome: 0,
              rrifIncome: 8100,
              cppIncome: 12000,
              oasIncome: 8500,
              investmentIncome: 0,
              capitalGains: 0,
              dividendIncomeEligible: 0,
              dividendIncomeNonEligible: 0,
              grossIncome: 28600,
              deductions: 0,
              taxableIncome: 28600,
              netIncome: 25600,
              federalTaxGross: 2000,
              federalCredits: 0,
              totalTax: 3000,
              federalTaxNet: 2000,
              provincialTaxGross: 1000,
              provincialCredits: 0,
              provincialTaxNet: 1000,
              marginalRateFederal: 0,
              marginalRateProvincial: 0,
              marginalRateCombined: 0,
              effectiveRate: 0.105,
              oasClawback: 0,
              ageCredit: 0,
              pensionCredit: 0,
            },
            isRetired: true,
            isRRIFConversionYear: false,
            rrifForcedMinimum: 8100,
            rrifMinimumRate: 0.054,
            rrifConversionYear: false,
          },
        ],
        legacyTargetMet: null,
        summary: {
          startYear: 2040,
          endYear: 2040,
          retirementYear: 2035,
          yearsInRetirement: 6,
          peakNetWorth: 230000,
          peakNetWorthYear: 2040,
          portfolioLongevityAge: null,
          totalTaxesPaid: 3000,
          averageRetirementIncome: 28600,
          averageEffectiveTaxRate: 0.105,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 230000,
          lowestNetWorthYear: 2040,
          fundedStatus: {
            state: 'green',
            depletionAge: null,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 0,
          },
          remediationPlan: null,
        },
        createdAt: new Date('2040-01-01'),
        updatedAt: new Date('2040-01-01'),
      };

      const result = transformToFrontendOutput(singleOutput, 90);

      // projectionRows should contain the RRIF fields
      expect(result.projectionRows).toHaveLength(1);
      const row = result.projectionRows[0];
      expect(row).toBeDefined();
      if (!row) throw new Error('projectionRows[0] is undefined');
      expect(row.rrifForcedMinimum).toBe(8100);
      expect(row.rrifMinimumRate).toBe(0.054);
      expect(row.rrifConversionYear).toBe(false);
    });

    /**
     * @see TC-CHAIN-020 — couple RRIF field mapping
     */
    it('maps primary and spouse RRIF fields for couple projection', () => {
      // Reuse the existing couple fixture shape but set non-zero RRIF fields
      const coupleYear: CoupleYearlyResult = {
        year: 2040,
        primary: {
          owner: 'primary',
          year: 2040,
          age: 72,
          employmentIncome: 0,
          pensionIncome: 10000,
          cppIncome: 12000,
          oasIncome: 9000,
          gisIncome: 0,
          rrifWithdrawal: 12000,
          lifWithdrawal: 0,
          tfsaWithdrawal: 0,
          nonRegWithdrawal: 0,
          totalGrossIncome: 43000,
          livingExpenses: 40000,
          taxesPaid: 5000,
          netIncome: 38000,
          netCashFlow: -2000,
          rrspBalance: 0,
          rrifBalance: 200000,
          liraBalance: 0,
          lifBalance: 0,
          tfsaBalance: 100000,
          nonRegBalance: 50000,
          totalNetWorth: 350000,
          taxCalculation: {
            year: 2040,
            owner: 'primary',
            employmentIncome: 0,
            pensionIncome: 10000,
            rrifIncome: 12000,
            cppIncome: 12000,
            oasIncome: 9000,
            investmentIncome: 0,
            capitalGains: 0,
            dividendIncomeEligible: 0,
            dividendIncomeNonEligible: 0,
            grossIncome: 43000,
            deductions: 0,
            taxableIncome: 43000,
            netIncome: 38000,
            federalTaxGross: 3000,
            federalCredits: 0,
            totalTax: 5000,
            federalTaxNet: 3000,
            provincialTaxGross: 2000,
            provincialCredits: 0,
            provincialTaxNet: 2000,
            marginalRateFederal: 0,
            marginalRateProvincial: 0,
            marginalRateCombined: 0,
            effectiveRate: 0.116,
            oasClawback: 0,
            ageCredit: 0,
            pensionCredit: 0,
          },
          isRetired: true,
          isRRIFConversionYear: false,
          isLIFConversionYear: false,
          rrifForcedMinimum: 12000,
          rrifMinimumRate: 0.0582,
          rrifConversionYear: false,
        },
        spouse: {
          owner: 'spouse',
          year: 2040,
          age: 70,
          employmentIncome: 0,
          pensionIncome: 4000,
          cppIncome: 6000,
          oasIncome: 0,
          gisIncome: 0,
          rrifWithdrawal: 5000,
          lifWithdrawal: 0,
          tfsaWithdrawal: 0,
          nonRegWithdrawal: 0,
          totalGrossIncome: 15000,
          livingExpenses: 40000,
          taxesPaid: 2000,
          netIncome: 13000,
          netCashFlow: -27000,
          rrspBalance: 0,
          rrifBalance: 100000,
          liraBalance: 0,
          lifBalance: 0,
          tfsaBalance: 60000,
          nonRegBalance: 30000,
          totalNetWorth: 190000,
          taxCalculation: {
            year: 2040,
            owner: 'spouse',
            employmentIncome: 0,
            pensionIncome: 4000,
            rrifIncome: 5000,
            cppIncome: 6000,
            oasIncome: 0,
            investmentIncome: 0,
            capitalGains: 0,
            dividendIncomeEligible: 0,
            dividendIncomeNonEligible: 0,
            grossIncome: 15000,
            deductions: 0,
            taxableIncome: 15000,
            netIncome: 13000,
            federalTaxGross: 1200,
            federalCredits: 0,
            totalTax: 2000,
            federalTaxNet: 1200,
            provincialTaxGross: 800,
            provincialCredits: 0,
            provincialTaxNet: 800,
            marginalRateFederal: 0,
            marginalRateProvincial: 0,
            marginalRateCombined: 0,
            effectiveRate: 0.133,
            oasClawback: 0,
            ageCredit: 0,
            pensionCredit: 0,
          },
          isRetired: true,
          isRRIFConversionYear: false,
          isLIFConversionYear: false,
          rrifForcedMinimum: 5000,
          rrifMinimumRate: 0.054,
          rrifConversionYear: false,
        },
        householdGrossIncome: 58000,
        householdNetIncome: 51000,
        householdTaxesPaid: 7000,
        householdLivingExpenses: 80000,
        householdNetCashFlow: -29000,
        householdNetWorth: 540000,
        pensionSplitPercentage: 0,
        pensionSplitTaxSavings: 0,
        bothRetired: true,
        eitherRRIFConversion: false,
      };

      const coupleOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'rrif-couple-test',
        input: {} as never,
        yearlyResults: [coupleYear],
        legacyTargetMet: null,
        summary: {
          startYear: 2040,
          endYear: 2040,
          retirementYear: 2035,
          yearsInRetirement: 6,
          peakNetWorth: 540000,
          peakNetWorthYear: 2040,
          portfolioLongevityAge: null,
          totalTaxesPaid: 7000,
          averageRetirementIncome: 51000,
          averageEffectiveTaxRate: 0.12,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 540000,
          lowestNetWorthYear: 2040,
          fundedStatus: {
            state: 'green',
            depletionAge: null,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 0,
          },
          remediationPlan: null,
          primarySummary: {} as never,
          spouseSummary: {} as never,
          primaryRetirementYear: 2035,
          spouseRetirementYear: 2037,
          bothRetiredYear: 2037,
          totalPensionSplitTaxSavings: 0,
          averagePensionSplitPercentage: 0,
          primaryLifeExpectancyYear: 2060,
          spouseLifeExpectancyYear: 2065,
          longestLivingSpouseEndYear: 2065,
        },
        createdAt: new Date('2040-01-01'),
        updatedAt: new Date('2040-01-01'),
      };

      const result = transformToFrontendOutput(coupleOutput, 90);

      expect(result.projectionRows).toHaveLength(1);
      const row = result.projectionRows[0];
      expect(row).toBeDefined();
      if (!row) throw new Error('projectionRows[0] is undefined');

      // Primary RRIF fields
      expect(row.rrifForcedMinimum).toBe(12000);
      expect(row.rrifMinimumRate).toBe(0.0582);
      expect(row.rrifConversionYear).toBe(false);

      // Spouse RRIF fields
      expect(row.spouseRrifForcedMinimum).toBe(5000);
      expect(row.spouseRrifMinimumRate).toBe(0.054);
      expect(row.spouseRrifConversionYear).toBe(false);

      // Per-person spending — sourced from PersonYearlyResult.livingExpenses /
      // .netCashFlow on each spouse. Previously flattened away in the row mapping.
      expect(row.livingExpenses).toBe(40000);
      expect(row.netCashFlow).toBe(-2000);
      expect(row.spouseLivingExpenses).toBe(40000);
      expect(row.spouseNetCashFlow).toBe(-27000);
    });
  });

  /**
   * TC-CHAIN-017 — Transformer: probability of success label + fundedStatus passthrough (Phase 48 extension)
   * @see docs/TESTABLE-SURFACES.md — TC-CHAIN-017
   * Phase 48 extension: assert fundedStatus + remediationPlan passthrough + REGR-003 preserved.
   * Scenario: yearsWithMoney=25, totalRetirementYears=30 → probabilityOfSuccess=83 (25/30 × 100, rounded)
   * @see REGR-003 — NOT Monte Carlo; deterministic depletion ratio mislabeled as probability.
   */
  describe('TC-CHAIN-017 — probabilityOfSuccess label + fundedStatus passthrough', () => {
    it('TC-CHAIN-017 — Transformer: probability of success label + fundedStatus passthrough', () => {
      // Scenario: lifeExpectancy=90, yearsInRetirement=30, retirementStartAge=60, portfolioLongevityAge=85
      // yearsWithMoney = 85 - 60 = 25; totalRetirementYears = 90 - 60 = 30
      // probabilityOfSuccess = Math.round((25 / 30) * 100) = 83 (REGR-003 baseline)
      const chainOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'tc-chain-017',
        input: {} as never,
        yearlyResults: [
          {
            year: 2030,
            age: 65,
            employmentIncome: 0,
            pensionIncome: 0,
            cppIncome: 12000,
            oasIncome: 8500,
            rrifWithdrawal: 40000,
            tfsaWithdrawal: 0,
            nonRegWithdrawal: 0,
            totalIncome: 60500,
            livingExpenses: 60000,
            taxesPaid: 8000,
            netCashFlow: -7500,
            rrspBalance: 0,
            rrifBalance: 500000,
            tfsaBalance: 100000,
            nonRegBalance: 50000,
            totalNetWorth: 650000,
            taxCalculation: {
              year: 2030,
              owner: 'primary',
              employmentIncome: 0,
              pensionIncome: 0,
              rrifIncome: 40000,
              cppIncome: 12000,
              oasIncome: 8500,
              investmentIncome: 0,
              capitalGains: 0,
              dividendIncomeEligible: 0,
              dividendIncomeNonEligible: 0,
              grossIncome: 60500,
              deductions: 0,
              taxableIncome: 60500,
              netIncome: 52500,
              federalTaxGross: 5000,
              federalCredits: 0,
              totalTax: 8000,
              federalTaxNet: 5000,
              provincialTaxGross: 3000,
              provincialCredits: 0,
              provincialTaxNet: 3000,
              marginalRateFederal: 0.205,
              marginalRateProvincial: 0.0915,
              marginalRateCombined: 0.2965,
              effectiveRate: 0.132,
              oasClawback: 0,
              ageCredit: 0,
              pensionCredit: 0,
            },
            isRetired: true,
            isRRIFConversionYear: false,
            rrifForcedMinimum: 40000,
            rrifMinimumRate: 0.0582,
            rrifConversionYear: false,
          },
        ],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2055,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 650000,
          peakNetWorthYear: 2030,
          portfolioLongevityAge: 85,
          totalTaxesPaid: 240000,
          averageRetirementIncome: 52500,
          averageEffectiveTaxRate: 0.132,
          moneyLastsToLifeExpectancy: false,
          lowestNetWorth: 0,
          lowestNetWorthYear: 2055,
          fundedStatus: {
            state: 'red',
            depletionAge: 85,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 1200000,
          },
          remediationPlan: null,
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      // lifeExpectancy=90 is passed to transformToFrontendOutput as the second argument
      const result = transformToFrontendOutput(chainOutput, 90);
      const frontendSummary = result.summary;

      // REGR-003 guard: probabilityOfSuccess baseline (yearsWithMoney=25, totalRetirementYears=30)
      // This exact value must not change without deliberate intent to rename/fix the mislabeled metric
      expect(frontendSummary.probabilityOfSuccess).toBe(83);

      // fundedStatus passthrough — field copy, no transformation (FR-001 constraint)
      expect(frontendSummary.fundedStatus).toBeDefined();
      expect(frontendSummary.fundedStatus.state).toBe('red');
      expect(frontendSummary.fundedStatus.depletionAge).toBe(85);
      expect(frontendSummary.fundedStatus.balanceAtLifeExpectancy).toBe(0);
      expect(frontendSummary.fundedStatus.totalRetirementWithdrawals).toBe(1200000);

      // remediationPlan is null in Phase 48 (Phase 49 fills the Red branch)
      expect(frontendSummary.remediationPlan).toBeNull();

      // Verify exact FundedStatus shape (4 fields, no extras)
      const fundedKeys = Object.keys(frontendSummary.fundedStatus);
      expect(fundedKeys).toHaveLength(4);
      expect(fundedKeys).toContain('state');
      expect(fundedKeys).toContain('depletionAge');
      expect(fundedKeys).toContain('balanceAtLifeExpectancy');
      expect(fundedKeys).toContain('totalRetirementWithdrawals');
    });

    it('TC-CHAIN-017 (Green path) — Green fundedStatus passthrough, remediationPlan null', () => {
      const greenOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'tc-chain-017-green',
        input: {} as never,
        yearlyResults: [],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2060,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 2000000,
          peakNetWorthYear: 2040,
          portfolioLongevityAge: null,
          totalTaxesPaid: 300000,
          averageRetirementIncome: 80000,
          averageEffectiveTaxRate: 0.18,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 500000,
          lowestNetWorthYear: 2060,
          fundedStatus: {
            state: 'green',
            depletionAge: null,
            balanceAtLifeExpectancy: 500000,
            totalRetirementWithdrawals: 1000000,
          },
          remediationPlan: null,
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      const result = transformToFrontendOutput(greenOutput, 90);
      const frontendSummary = result.summary;

      // REGR-003: money lasts → probabilityOfSuccess = 100
      expect(frontendSummary.probabilityOfSuccess).toBe(100);

      // Green fundedStatus passthrough
      expect(frontendSummary.fundedStatus.state).toBe('green');
      expect(frontendSummary.fundedStatus.depletionAge).toBeNull();
      expect(frontendSummary.fundedStatus.balanceAtLifeExpectancy).toBe(500000);
      expect(frontendSummary.fundedStatus.totalRetirementWithdrawals).toBe(1000000);

      // remediationPlan always null in Phase 48
      expect(frontendSummary.remediationPlan).toBeNull();
    });

    it('TC-CHAIN-017 (Red non-null remediationPlan) — four-field passthrough for Red-state Phase 49 output', () => {
      // Same scenario as the existing Red test: lifeExpectancy=90, retirement age 60, portfolioLongevity 85,
      // probabilityOfSuccess=83 (REGR-003 baseline). The only difference is that summary.remediationPlan
      // is now non-null with realistic Phase 49 binary-search values.
      const chainOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'tc-chain-017-red-remediation',
        input: {} as never,
        yearlyResults: [
          {
            year: 2030,
            age: 65,
            employmentIncome: 0,
            pensionIncome: 0,
            cppIncome: 12000,
            oasIncome: 8500,
            rrifWithdrawal: 40000,
            tfsaWithdrawal: 0,
            nonRegWithdrawal: 0,
            totalIncome: 60500,
            livingExpenses: 60000,
            taxesPaid: 8000,
            netCashFlow: -7500,
            rrspBalance: 0,
            rrifBalance: 500000,
            tfsaBalance: 100000,
            nonRegBalance: 50000,
            totalNetWorth: 650000,
            taxCalculation: {
              year: 2030,
              owner: 'primary',
              employmentIncome: 0,
              pensionIncome: 0,
              rrifIncome: 40000,
              cppIncome: 12000,
              oasIncome: 8500,
              investmentIncome: 0,
              capitalGains: 0,
              dividendIncomeEligible: 0,
              dividendIncomeNonEligible: 0,
              grossIncome: 60500,
              deductions: 0,
              taxableIncome: 60500,
              netIncome: 52500,
              federalTaxGross: 5000,
              federalCredits: 0,
              totalTax: 8000,
              federalTaxNet: 5000,
              provincialTaxGross: 3000,
              provincialCredits: 0,
              provincialTaxNet: 3000,
              marginalRateFederal: 0.205,
              marginalRateProvincial: 0.0915,
              marginalRateCombined: 0.2965,
              effectiveRate: 0.132,
              oasClawback: 0,
              ageCredit: 0,
              pensionCredit: 0,
            },
            isRetired: true,
            isRRIFConversionYear: false,
            rrifForcedMinimum: 40000,
            rrifMinimumRate: 0.0582,
            rrifConversionYear: false,
          },
        ],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2055,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 650000,
          peakNetWorthYear: 2030,
          portfolioLongevityAge: 85,
          totalTaxesPaid: 240000,
          averageRetirementIncome: 52500,
          averageEffectiveTaxRate: 0.132,
          moneyLastsToLifeExpectancy: false,
          lowestNetWorth: 0,
          lowestNetWorthYear: 2055,
          fundedStatus: {
            state: 'red',
            depletionAge: 85,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 1200000,
          },
          // Phase 49: realistic non-null remediationPlan with Ceiling-rounded integer dollar values
          remediationPlan: {
            additionalAnnualSavings: 8500,
            annualSpendingReduction: 6200,
            retirementDelayYears: 3,
            delayCapReached: false,
          },
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      const result = transformToFrontendOutput(chainOutput, 90);
      const frontendSummary = result.summary;

      // REGR-003 guard remains intact (yearsWithMoney=25, totalRetirementYears=30 → Math.round(25/30*100)=83)
      expect(frontendSummary.probabilityOfSuccess).toBe(83);

      // fundedStatus passthrough still holds
      expect(frontendSummary.fundedStatus.state).toBe('red');
      expect(frontendSummary.fundedStatus.depletionAge).toBe(85);

      // Phase 49 assertion: remediationPlan is non-null and all four fields pass through unchanged
      expect(frontendSummary.remediationPlan).not.toBeNull();
      expect(frontendSummary.remediationPlan).toEqual({
        additionalAnnualSavings: 8500,
        annualSpendingReduction: 6200,
        retirementDelayYears: 3,
        delayCapReached: false,
      });

      // Verify exact RemediationPlan shape (4 fields, no extras) — contract lock per data-model.md
      const remediationKeys = Object.keys(frontendSummary.remediationPlan ?? {});
      expect(remediationKeys).toHaveLength(4);
      expect(remediationKeys).toContain('additionalAnnualSavings');
      expect(remediationKeys).toContain('annualSpendingReduction');
      expect(remediationKeys).toContain('retirementDelayYears');
      expect(remediationKeys).toContain('delayCapReached');
    });

    it('TC-CHAIN-017 (Red delayCapReached edge) — delayCapReached=true passes through', () => {
      // Minimal chainOutput reusing the Red-state fixture but with delayCapReached=true to prove
      // the boolean flag is preserved end-to-end (important for UI rendering in Plan 04).
      const chainOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'tc-chain-017-red-cap-reached',
        input: {} as never,
        yearlyResults: [],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2055,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 100000,
          peakNetWorthYear: 2030,
          portfolioLongevityAge: 78,
          totalTaxesPaid: 100000,
          averageRetirementIncome: 30000,
          averageEffectiveTaxRate: 0.18,
          moneyLastsToLifeExpectancy: false,
          lowestNetWorth: 0,
          lowestNetWorthYear: 2045,
          fundedStatus: {
            state: 'red',
            depletionAge: 78,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 500000,
          },
          remediationPlan: {
            additionalAnnualSavings: 200000, // silent ceiling
            annualSpendingReduction: 30000,
            retirementDelayYears: 5, // max delay from retirementAge 65
            delayCapReached: true,
          },
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      const result = transformToFrontendOutput(chainOutput, 90);
      const frontendSummary = result.summary;

      expect(frontendSummary.remediationPlan).not.toBeNull();
      expect(frontendSummary.remediationPlan?.delayCapReached).toBe(true);
      expect(frontendSummary.remediationPlan?.retirementDelayYears).toBe(5);
      expect(frontendSummary.remediationPlan?.additionalAnnualSavings).toBe(200000);
    });
  });

  /**
   * @see docs/TESTABLE-SURFACES.md — REGR-003
   * REGR-003 guard: probabilityOfSuccess remains a first-class field in FrontendSummary
   * alongside the Phase 48+ fundedStatus field. Phase 50 T025.
   *
   * This is intentionally independent of TC-CHAIN-017 (which also touches these fields
   * as a secondary assert during transformer passthrough coverage). If TC-CHAIN-017 is
   * ever refactored, REGR-003 must still fail loud on any rename/removal.
   */
  describe('REGR-003 — probabilityOfSuccess coexistence with fundedStatus', () => {
    it('REGR-003 (Green) — probabilityOfSuccess is a number in [0,100] and coexists with fundedStatus', () => {
      const chainOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'regr-003-green',
        input: {} as never,
        yearlyResults: [],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2060,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 450_000,
          peakNetWorthYear: 2030,
          portfolioLongevityAge: null,
          totalTaxesPaid: 0,
          averageRetirementIncome: 0,
          averageEffectiveTaxRate: 0,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 450_000,
          lowestNetWorthYear: 2060,
          fundedStatus: {
            state: 'green',
            depletionAge: null,
            balanceAtLifeExpectancy: 450_000,
            totalRetirementWithdrawals: 1_500_000,
          },
          remediationPlan: null,
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      const result = transformToFrontendOutput(chainOutput, 90);
      const frontendSummary = result.summary;

      // REGR-003: probabilityOfSuccess is still present as a number
      expect(typeof frontendSummary.probabilityOfSuccess).toBe('number');
      expect(frontendSummary.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
      expect(frontendSummary.probabilityOfSuccess).toBeLessThanOrEqual(100);
      // REGR-003: fundedStatus is present alongside probabilityOfSuccess (both coexist)
      expect(frontendSummary.fundedStatus).toBeDefined();
      expect(frontendSummary.fundedStatus.state).toBe('green');
      // REGR-003: both field names appear on the same object (no rename, no replacement)
      const keys = Object.keys(frontendSummary);
      expect(keys).toContain('probabilityOfSuccess');
      expect(keys).toContain('fundedStatus');
    });

    it('REGR-003 (Yellow) — probabilityOfSuccess is a number in [0,100] and coexists with fundedStatus', () => {
      const chainOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'regr-003-yellow',
        input: {} as never,
        yearlyResults: [],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2060,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 45_000,
          peakNetWorthYear: 2030,
          portfolioLongevityAge: null,
          totalTaxesPaid: 0,
          averageRetirementIncome: 0,
          averageEffectiveTaxRate: 0,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 45_000,
          lowestNetWorthYear: 2060,
          fundedStatus: {
            state: 'yellow',
            depletionAge: null,
            balanceAtLifeExpectancy: 45_000,
            totalRetirementWithdrawals: 1_500_000,
          },
          remediationPlan: null,
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      const result = transformToFrontendOutput(chainOutput, 90);
      const frontendSummary = result.summary;

      // REGR-003: probabilityOfSuccess is still present as a number
      expect(typeof frontendSummary.probabilityOfSuccess).toBe('number');
      expect(frontendSummary.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
      expect(frontendSummary.probabilityOfSuccess).toBeLessThanOrEqual(100);
      // REGR-003: fundedStatus is present alongside probabilityOfSuccess (both coexist)
      expect(frontendSummary.fundedStatus).toBeDefined();
      expect(frontendSummary.fundedStatus.state).toBe('yellow');
      // REGR-003: both field names appear on the same object (no rename, no replacement)
      const keys = Object.keys(frontendSummary);
      expect(keys).toContain('probabilityOfSuccess');
      expect(keys).toContain('fundedStatus');
    });

    it('REGR-003 (Red) — probabilityOfSuccess is a number in [0,100] and coexists with fundedStatus', () => {
      const chainOutput: Parameters<typeof transformToFrontendOutput>[0] = {
        id: 'regr-003-red',
        input: {} as never,
        yearlyResults: [],
        legacyTargetMet: null,
        summary: {
          startYear: 2030,
          endYear: 2060,
          retirementYear: 2030,
          yearsInRetirement: 30,
          peakNetWorth: 0,
          peakNetWorthYear: 2030,
          portfolioLongevityAge: 82,
          totalTaxesPaid: 0,
          averageRetirementIncome: 0,
          averageEffectiveTaxRate: 0,
          moneyLastsToLifeExpectancy: false,
          lowestNetWorth: -250_000,
          lowestNetWorthYear: 2060,
          fundedStatus: {
            state: 'red',
            depletionAge: 82,
            balanceAtLifeExpectancy: -250_000,
            totalRetirementWithdrawals: 1_500_000,
          },
          remediationPlan: {
            additionalAnnualSavings: 8500,
            annualSpendingReduction: 6200,
            retirementDelayYears: 3,
            delayCapReached: false,
          },
        },
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      };

      const result = transformToFrontendOutput(chainOutput, 90);
      const frontendSummary = result.summary;

      // REGR-003: probabilityOfSuccess is still present as a number
      expect(typeof frontendSummary.probabilityOfSuccess).toBe('number');
      expect(frontendSummary.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
      expect(frontendSummary.probabilityOfSuccess).toBeLessThanOrEqual(100);
      // REGR-003: fundedStatus is present alongside probabilityOfSuccess (both coexist)
      expect(frontendSummary.fundedStatus).toBeDefined();
      expect(frontendSummary.fundedStatus.state).toBe('red');
      // REGR-003: both field names appear on the same object (no rename, no replacement)
      const keys = Object.keys(frontendSummary);
      expect(keys).toContain('probabilityOfSuccess');
      expect(keys).toContain('fundedStatus');
      // REGR-003: Red state additionally asserts remediationPlan is non-null with correct values
      expect(frontendSummary.remediationPlan).not.toBeNull();
      expect(frontendSummary.remediationPlan?.additionalAnnualSavings).toBe(8500);
    });
  });

  describe('M005/S05 contribution-room ledger inputs', () => {
    const baseFixture: FrontendInputData = {
      personalInfo: {
        dateOfBirth: '1970-03-15',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [{ type: 'RRSP', balance: 100000, annualContribution: 5000 }],
      incomeSources: [{ type: 'employment', annualAmount: 80000 }],
      governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
      expenses: { currentAnnualExpenses: 60000, retirementAnnualExpenses: 60000 },
    };

    it('forwards all five primary ledger fields to ProjectionInput when provided', () => {
      const fixture: FrontendInputData = {
        ...baseFixture,
        personalInfo: {
          ...baseFixture.personalInfo,
          pensionAdjustment: 10000,
          spousalRrspContribution: 2500,
          fhsaAnnualContribution: 8000,
          fhsaLifetimeContributedSeed: 16000,
          residencyStartYear: 2021,
        },
      };

      const result = transformToProjectionInput(fixture);

      expect(result.pensionAdjustment).toBe(10000);
      expect(result.spousalRrspContribution).toBe(2500);
      expect(result.fhsaAnnualContribution).toBe(8000);
      expect(result.fhsaLifetimeContributedSeed).toBe(16000);
      expect(result.residencyStartYear).toBe(2021);
    });

    it('omits primary ledger fields (undefined, not 0) when not provided', () => {
      const result = transformToProjectionInput(baseFixture);

      expect(result.pensionAdjustment).toBeUndefined();
      expect(result.spousalRrspContribution).toBeUndefined();
      expect(result.fhsaAnnualContribution).toBeUndefined();
      expect(result.fhsaLifetimeContributedSeed).toBeUndefined();
      expect(result.residencyStartYear).toBeUndefined();
      expect('pensionAdjustment' in result).toBe(false);
      expect('residencyStartYear' in result).toBe(false);
    });

    it('infers primary FHSA annual contribution from FHSA accounts', () => {
      const fixture: FrontendInputData = {
        ...baseFixture,
        accounts: [
          { type: 'FHSA', balance: 0, annualContribution: 5000 },
          { type: 'FHSA', balance: 0, annualContribution: 3000 },
        ],
      };

      const result = transformToProjectionInput(fixture);

      expect(result.fhsaAnnualContribution).toBe(8000);
    });

    it('forwards spouse ledger fields to SpouseInput when provided', () => {
      const fixture: FrontendInputData = {
        ...baseFixture,
        spouse: {
          dateOfBirth: '1972-08-10',
          pensionAdjustment: 7500,
          fhsaAnnualContribution: 4000,
          fhsaLifetimeContributedSeed: 8000,
          residencyStartYear: 2018,
        },
      };

      const result = transformToProjectionInput(fixture);

      expect(result.spouse).toBeDefined();
      const spouse = result.spouse;
      if (!spouse) throw new Error('spouse is undefined');
      expect(spouse.pensionAdjustment).toBe(7500);
      expect(spouse.fhsaAnnualContribution).toBe(4000);
      expect(spouse.fhsaLifetimeContributedSeed).toBe(8000);
      expect(spouse.residencyStartYear).toBe(2018);
    });

    it('omits spouse ledger fields (undefined, not 0) when not provided', () => {
      const fixture: FrontendInputData = {
        ...baseFixture,
        spouse: { dateOfBirth: '1972-08-10' },
      };

      const result = transformToProjectionInput(fixture);

      const spouse = result.spouse;
      if (!spouse) throw new Error('spouse is undefined');
      expect(spouse.pensionAdjustment).toBeUndefined();
      expect(spouse.fhsaAnnualContribution).toBeUndefined();
      expect(spouse.fhsaLifetimeContributedSeed).toBeUndefined();
      expect(spouse.residencyStartYear).toBeUndefined();
      expect('pensionAdjustment' in spouse).toBe(false);
      expect('residencyStartYear' in spouse).toBe(false);
    });

    it('infers spouse FHSA annual contribution from spouse FHSA accounts', () => {
      const fixture: FrontendInputData = {
        ...baseFixture,
        spouse: { dateOfBirth: '1972-08-10' },
        accounts: [
          ...baseFixture.accounts,
          { type: 'FHSA', balance: 0, annualContribution: 4000, belongsTo: 'spouse' },
          { type: 'FHSA', balance: 0, annualContribution: 2500, belongsTo: 'spouse' },
        ],
      };

      const result = transformToProjectionInput(fixture);

      const spouse = result.spouse;
      if (!spouse) throw new Error('spouse is undefined');
      expect(spouse.fhsaAnnualContribution).toBe(6500);
    });
  });

  describe('M005/S05 contribution-room ledger output surfacing (T02)', () => {
    /** Builds a minimal CoupleYearlyResult with configurable ledger fields for transformer tests. */
    function makeCoupleYear(
      overrides: {
        primaryTfsaRoom?: number;
        primaryFhsaRoom?: number;
        primaryPenalty?: { rrsp: number; tfsa: number; fhsa: number };
        primaryWarnings?: CoupleYearlyResult['primary']['ledgerWarnings'];
        spouseTfsaRoom?: number;
        spouseFhsaRoom?: number;
        spousePenalty?: { rrsp: number; tfsa: number; fhsa: number };
        spouseWarnings?: CoupleYearlyResult['spouse']['ledgerWarnings'];
      } = {}
    ): CoupleYearlyResult {
      const blankTax = {
        year: 2035,
        owner: 'primary' as const,
        employmentIncome: 0,
        pensionIncome: 0,
        rrifIncome: 0,
        cppIncome: 0,
        oasIncome: 0,
        investmentIncome: 0,
        capitalGains: 0,
        dividendIncomeEligible: 0,
        dividendIncomeNonEligible: 0,
        grossIncome: 0,
        deductions: 0,
        taxableIncome: 0,
        netIncome: 0,
        federalTaxGross: 0,
        federalCredits: 0,
        totalTax: 0,
        federalTaxNet: 0,
        provincialTaxGross: 0,
        provincialCredits: 0,
        provincialTaxNet: 0,
        marginalRateFederal: 0,
        marginalRateProvincial: 0,
        marginalRateCombined: 0,
        effectiveRate: 0,
        oasClawback: 0,
        ageCredit: 0,
        pensionCredit: 0,
      };
      const basePerson = {
        year: 2035,
        age: 55,
        employmentIncome: 0,
        pensionIncome: 0,
        cppIncome: 0,
        oasIncome: 0,
        rrifWithdrawal: 0,
        tfsaWithdrawal: 0,
        nonRegWithdrawal: 0,
        totalGrossIncome: 0,
        livingExpenses: 0,
        taxesPaid: 0,
        netIncome: 0,
        netCashFlow: 0,
        rrspBalance: 0,
        rrifBalance: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        totalNetWorth: 0,
        isRetired: false,
        isRRIFConversionYear: false,
        rrifForcedMinimum: 0,
        rrifMinimumRate: 0,
        rrifConversionYear: false,
      };
      const primary: CoupleYearlyResult['primary'] = {
        ...basePerson,
        owner: 'primary',
        taxCalculation: { ...blankTax, owner: 'primary' },
        ...(overrides.primaryTfsaRoom !== undefined
          ? { tfsaContributionRoom: overrides.primaryTfsaRoom }
          : {}),
        ...(overrides.primaryFhsaRoom !== undefined
          ? { fhsaContributionRoom: overrides.primaryFhsaRoom }
          : {}),
        ...(overrides.primaryPenalty ? { overContributionPenalty: overrides.primaryPenalty } : {}),
        ...(overrides.primaryWarnings ? { ledgerWarnings: overrides.primaryWarnings } : {}),
      };
      const spouse: CoupleYearlyResult['spouse'] = {
        ...basePerson,
        owner: 'spouse',
        taxCalculation: { ...blankTax, owner: 'spouse' },
        ...(overrides.spouseTfsaRoom !== undefined
          ? { tfsaContributionRoom: overrides.spouseTfsaRoom }
          : {}),
        ...(overrides.spouseFhsaRoom !== undefined
          ? { fhsaContributionRoom: overrides.spouseFhsaRoom }
          : {}),
        ...(overrides.spousePenalty ? { overContributionPenalty: overrides.spousePenalty } : {}),
        ...(overrides.spouseWarnings ? { ledgerWarnings: overrides.spouseWarnings } : {}),
      };
      return {
        year: 2035,
        primary,
        spouse,
        householdGrossIncome: 0,
        householdNetIncome: 0,
        householdTaxesPaid: 0,
        householdLivingExpenses: 0,
        householdNetCashFlow: 0,
        householdNetWorth: 0,
        pensionSplitPercentage: 0,
        pensionSplitTaxSavings: 0,
        bothRetired: false,
        eitherRRIFConversion: false,
      };
    }

    function wrap(years: CoupleYearlyResult[]): Parameters<typeof transformToFrontendOutput>[0] {
      return {
        id: 'couple-ledger-test',
        input: {} as never,
        yearlyResults: years,
        legacyTargetMet: null,
        summary: {
          startYear: 2035,
          endYear: 2035,
          retirementYear: 2035,
          yearsInRetirement: 1,
          peakNetWorth: 0,
          peakNetWorthYear: 2035,
          portfolioLongevityAge: null,
          totalTaxesPaid: 0,
          averageRetirementIncome: 0,
          averageEffectiveTaxRate: 0,
          moneyLastsToLifeExpectancy: true,
          lowestNetWorth: 0,
          lowestNetWorthYear: 2035,
          fundedStatus: {
            state: 'green',
            depletionAge: null,
            balanceAtLifeExpectancy: 0,
            totalRetirementWithdrawals: 0,
          },
          remediationPlan: null,
          primarySummary: {} as never,
          spouseSummary: {} as never,
          primaryRetirementYear: 2035,
          spouseRetirementYear: 2035,
          bothRetiredYear: 2035,
          totalPensionSplitTaxSavings: 0,
          averagePensionSplitPercentage: 0,
          primaryLifeExpectancyYear: 2060,
          spouseLifeExpectancyYear: 2062,
          longestLivingSpouseEndYear: 2062,
        },
        createdAt: new Date('2035-01-01'),
        updatedAt: new Date('2035-01-01'),
      };
    }

    it('sums primary+spouse TFSA/FHSA room on each couple yearly result', () => {
      const year = makeCoupleYear({
        primaryTfsaRoom: 7000,
        spouseTfsaRoom: 6500,
        primaryFhsaRoom: 8000,
        spouseFhsaRoom: 4000,
      });
      const result = transformToFrontendOutput(wrap([year]), 90);

      expect(result.yearlyResults[0]?.tfsaContributionRoom).toBe(13500);
      expect(result.yearlyResults[0]?.fhsaContributionRoom).toBe(12000);
      expect(result.yearlyResults[0]?.overContributionPenalty).toBeUndefined();
      expect(result.yearlyResults[0]?.ledgerWarnings).toBeUndefined();
    });

    it('combines penalty components across primary and spouse when any component is non-zero', () => {
      const year = makeCoupleYear({
        primaryPenalty: { rrsp: 240, tfsa: 0, fhsa: 0 },
        spousePenalty: { rrsp: 0, tfsa: 120, fhsa: 60 },
      });
      const result = transformToFrontendOutput(wrap([year]), 90);

      expect(result.yearlyResults[0]?.overContributionPenalty).toEqual({
        rrsp: 240,
        tfsa: 120,
        fhsa: 60,
      });
    });

    it('concatenates primary+spouse ledger warnings in order on the yearly result', () => {
      const primaryWarning = {
        year: 2035,
        person: 'primary' as const,
        accountType: 'rrsp' as const,
        kind: 'over-contribution' as const,
        message: 'RRSP over by $5,000',
        penaltyAmount: 240,
      };
      const spouseWarning = {
        year: 2035,
        person: 'spouse' as const,
        accountType: 'tfsa' as const,
        kind: 'over-contribution' as const,
        message: 'TFSA over by $1,000',
        penaltyAmount: 120,
      };
      const year = makeCoupleYear({
        primaryWarnings: [primaryWarning],
        spouseWarnings: [spouseWarning],
      });
      const result = transformToFrontendOutput(wrap([year]), 90);

      expect(result.yearlyResults[0]?.ledgerWarnings).toEqual([primaryWarning, spouseWarning]);
    });

    it('flattens warnings across all years into summary.ledgerWarnings', () => {
      const w1 = {
        year: 2035,
        person: 'primary' as const,
        accountType: 'rrsp' as const,
        kind: 'over-contribution' as const,
        message: 'year 1',
        penaltyAmount: 240,
      };
      const w2 = {
        year: 2036,
        person: 'spouse' as const,
        accountType: 'fhsa' as const,
        kind: 'lifetime-cap-exceeded' as const,
        message: 'year 2',
        penaltyAmount: 100,
      };
      const y1 = makeCoupleYear({ primaryWarnings: [w1] });
      const y2 = { ...makeCoupleYear({ spouseWarnings: [w2] }), year: 2036 };
      const result = transformToFrontendOutput(wrap([y1, y2]), 90);

      expect(result.summary.ledgerWarnings).toEqual([w1, w2]);
    });

    it('omits summary.ledgerWarnings entirely when no warnings were raised in any year', () => {
      const year = makeCoupleYear({ primaryTfsaRoom: 7000, spouseTfsaRoom: 7000 });
      const result = transformToFrontendOutput(wrap([year]), 90);

      expect(result.summary.ledgerWarnings).toBeUndefined();
      expect('ledgerWarnings' in result.summary).toBe(false);
    });

    it('omits overContributionPenalty on yearly result when all components are zero', () => {
      const year = makeCoupleYear({
        primaryPenalty: { rrsp: 0, tfsa: 0, fhsa: 0 },
        spousePenalty: { rrsp: 0, tfsa: 0, fhsa: 0 },
      });
      const result = transformToFrontendOutput(wrap([year]), 90);

      expect(result.yearlyResults[0]?.overContributionPenalty).toBeUndefined();
    });
  });

  // Closes the v4.4 deferral gap: single projections previously dropped TFSA/FHSA
  // ledger diagnostics. transformYearlyResult now mirrors transformCoupleYearlyResult,
  // and transformToFrontendOutput aggregates per-year warnings into summary.ledgerWarnings
  // so SummaryTab's Projection Warnings card surfaces them.
  describe('single-projection contribution-room ledger output surfacing', () => {
    it('surfaces tfsaContributionRoom + fhsaContributionRoom on each FrontendYearlyResult', () => {
      const projectionInput = transformToProjectionInput({
        personalInfo: {
          dateOfBirth: '1997-01-01',
          province: 'ON',
          gender: 'male',
          maritalStatus: 'single',
          retirementAge: 65,
          lifeExpectancy: 70,
        },
        accounts: [
          { type: 'TFSA', balance: 0, annualContribution: 0 },
          { type: 'NonRegistered', balance: 0 },
        ],
        incomeSources: [{ type: 'employment', name: 'Salary', annualAmount: 80_000 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 12_000 },
        expenses: { currentAnnualExpenses: 50_000, retirementAnnualExpenses: 50_000 },
        assumptions: { inflationRate: 0, investmentReturnRate: 4 },
      });

      const engineOutput = runSingleProjection({ ...projectionInput, residencyStartYear: 2021 });
      const transformed = transformToFrontendOutput(engineOutput, 70);

      // Every row should carry the cumulative TFSA room and annual FHSA remaining.
      for (const row of transformed.yearlyResults) {
        expect(row.tfsaContributionRoom).toBeDefined();
        expect(row.tfsaContributionRoom).toBeGreaterThanOrEqual(0);
        expect(row.fhsaContributionRoom).toBeDefined();
        expect(row.fhsaContributionRoom).toBeGreaterThanOrEqual(0);
      }
    });

    it('surfaces TFSA over-contribution penalty + warnings on the yearly result and aggregates them into summary', () => {
      // Match the calc-engine over-contribution test: residencyStartYear=2021,
      // contribution exceeds available TFSA room by $1k → expect $120 penalty
      // (1% × $1000 × 12 months) and a single 'over-contribution' warning.
      const projectionInput = transformToProjectionInput({
        personalInfo: {
          dateOfBirth: '1997-01-01',
          province: 'ON',
          gender: 'male',
          maritalStatus: 'single',
          retirementAge: 65,
          lifeExpectancy: 70,
        },
        accounts: [
          // Seed the TFSA balance generously so the projection can source the
          // over-contribution; ledger penalty math is balance-independent.
          { type: 'TFSA', balance: 200_000, annualContribution: 200_000 },
          { type: 'NonRegistered', balance: 0 },
        ],
        incomeSources: [{ type: 'employment', name: 'Salary', annualAmount: 80_000 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 12_000 },
        expenses: { currentAnnualExpenses: 50_000, retirementAnnualExpenses: 50_000 },
        assumptions: { inflationRate: 0, investmentReturnRate: 4 },
      });

      const engineOutput = runSingleProjection({ ...projectionInput, residencyStartYear: 2021 });
      const transformed = transformToFrontendOutput(engineOutput, 70);

      // First year is the over-contribution year — penalty + warning expected.
      const row0 = transformed.yearlyResults[0];
      expect(row0?.overContributionPenalty).toBeDefined();
      expect(row0!.overContributionPenalty!.tfsa).toBeGreaterThan(0);
      expect(row0?.ledgerWarnings).toBeDefined();
      const tfsaWarning = row0!.ledgerWarnings!.find((w) => w.accountType === 'tfsa');
      expect(tfsaWarning).toBeDefined();

      // Summary aggregates per-year warnings — needed for SummaryTab rendering.
      expect(transformed.summary.ledgerWarnings).toBeDefined();
      expect(transformed.summary.ledgerWarnings!.length).toBeGreaterThan(0);
      expect(transformed.summary.ledgerWarnings!.some((w) => w.accountType === 'tfsa')).toBe(true);
    });

    it('preserves sub-dollar FHSA penalties through the frontend transformer', () => {
      const projectionInput = transformToProjectionInput({
        personalInfo: {
          dateOfBirth: '1997-01-01',
          province: 'ON',
          gender: 'male',
          maritalStatus: 'single',
          retirementAge: 65,
          lifeExpectancy: 70,
        },
        accounts: [
          { type: 'FHSA', balance: 0, annualContribution: 8_001 },
          { type: 'NonRegistered', balance: 0 },
        ],
        incomeSources: [{ type: 'employment', name: 'Salary', annualAmount: 80_000 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 12_000 },
        expenses: { currentAnnualExpenses: 50_000, retirementAnnualExpenses: 50_000 },
        assumptions: { inflationRate: 0, investmentReturnRate: 4 },
      });

      const engineOutput = runSingleProjection(projectionInput);
      const transformed = transformToFrontendOutput(engineOutput, 70);

      const row0 = transformed.yearlyResults[0];
      expect(row0?.overContributionPenalty?.fhsa).toBeCloseTo(0.12, 6);
      expect(row0?.ledgerWarnings?.some((w) => w.accountType === 'fhsa')).toBe(true);
      expect(transformed.summary.ledgerWarnings?.some((w) => w.accountType === 'fhsa')).toBe(true);
    });

    it('omits summary.ledgerWarnings entirely when no warnings were raised in any year', () => {
      const projectionInput = transformToProjectionInput({
        personalInfo: {
          dateOfBirth: '1997-01-01',
          province: 'ON',
          gender: 'male',
          maritalStatus: 'single',
          retirementAge: 65,
          lifeExpectancy: 70,
        },
        accounts: [
          { type: 'TFSA', balance: 0, annualContribution: 0 },
          { type: 'NonRegistered', balance: 0 },
        ],
        incomeSources: [{ type: 'employment', name: 'Salary', annualAmount: 80_000 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 12_000 },
        expenses: { currentAnnualExpenses: 50_000, retirementAnnualExpenses: 50_000 },
        assumptions: { inflationRate: 0, investmentReturnRate: 4 },
      });

      const engineOutput = runSingleProjection(projectionInput);
      const transformed = transformToFrontendOutput(engineOutput, 70);

      expect(transformed.summary.ledgerWarnings).toBeUndefined();
      expect('ledgerWarnings' in transformed.summary).toBe(false);
    });
  });
});
