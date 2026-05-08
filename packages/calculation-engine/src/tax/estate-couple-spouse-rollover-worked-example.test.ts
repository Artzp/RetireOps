/**
 * VR-EST-DEEMED-001 + VR-EST-SPOUSE-ROLLOVER-001 Worked Example — couple
 * parity test (M004/S04 T06).
 *
 * K012 cent-exact parity: every row typed into the VR-EST-DEEMED-001 Worked
 * Example (docs/source-of-truth/02-account-types.md, couple fixture spouse
 * terminal year) and the VR-EST-SPOUSE-ROLLOVER-001 Worked Example
 * (same file, couple fixture primary terminal year) is asserted here against
 * engine output. Numbers came from the engine's own T01 capture dump
 * (.gsd/milestones/M004/slices/S04/CAPTURE.md, Scenario 2) — a failure means
 * the doc table has drifted and the table is what gets fixed, not the engine.
 *
 * @see .gsd/milestones/M004/slices/S04/S04-PLAN.md
 * @see .gsd/milestones/M004/slices/S04/CAPTURE.md
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from '../projection/multi-year.js';
import { getCurrentYear } from '@retireops/shared';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';

function makeCoupleSpouseRolloverWorkedExampleInput(): ProjectionInput {
  const currentYear = getCurrentYear();
  const primaryBirthYear = currentYear - 80;
  const spouseBirthYear = currentYear - 80;

  const spouse: SpouseInput = {
    birthdate: new Date(spouseBirthYear, 0, 1),
    retirementAge: 65,
    lifeExpectancy: 90,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    rrifBalance: 300_000,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 150_000,
    nonRegACB: 60_000,
    expectedCPPAt65: 0,
    cppStartAge: 65,
    oasStartAge: 999,
    yearsOfResidence: 0,
    province: 'ON',
  };

  return {
    birthdate: new Date(primaryBirthYear, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 80,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    rrifBalance: 400_000,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 200_000,
    retirementSpending: 0,
    investmentReturn: 0,
    inflationRate: 0,
    expectedCPPAt65: 0,
    cppStartAge: 65,
    oasStartAge: 999,
    yearsOfResidence: 0,
    maritalStatus: 'married',
    spouse,
    coupleSettings: {
      optimizePensionSplitting: false,
      useYoungerSpouseForRRIF: false,
    },
  };
}

describe('VR-EST-DEEMED-001 / VR-EST-SPOUSE-ROLLOVER-001 worked example — couple (M004/S04 T06 PARITY)', () => {
  const output = runCoupleProjection(makeCoupleSpouseRolloverWorkedExampleInput());
  const events = output.terminalTaxEvents;
  const summary = output.summary;

  it('terminalTaxEvents is populated with primary (rollover) and spouse (deemed) events', () => {
    expect(events).toBeDefined();
    expect(events!.length).toBe(2);
  });

  it('VR-EST-SPOUSE-ROLLOVER-001 primary-event rows match engine cent-exact', () => {
    const primary = events![0]!;
    // Primary-death terminal-return fields (rollover → zero tax).
    expect(primary.grossEstate).toBeCloseTo(572_720, 2);
    expect(primary.deemedDispositionIncome).toBeCloseTo(0, 2);
    expect(primary.realizedCapitalGain).toBeCloseTo(0, 2);
    expect(primary.taxableCapitalGain).toBeCloseTo(0, 2);
    expect(primary.terminalTaxes).toBeCloseTo(0, 2);
    expect(primary.netEstate).toBeCloseTo(572_720, 2);
    expect(primary.wasSpouseRolloverApplied).toBe(true);
  });

  it('VR-EST-DEEMED-001 spouse-event rows match engine cent-exact', () => {
    const spouseEvent = events![1]!;
    // Realized/taxable capital gain at spouse death (FMV $150K − ACB $60K).
    expect(spouseEvent.realizedCapitalGain).toBeCloseTo(90_000, 2);
    expect(spouseEvent.taxableCapitalGain).toBeCloseTo(45_000, 2);

    // Residual RRIF drives deemedDispositionIncome at spouse death.
    expect(spouseEvent.deemedDispositionIncome).toBeCloseTo(252_472.9050880938, 2);

    // Spouse terminal-return totals.
    expect(spouseEvent.grossEstate).toBeCloseTo(602_472.9050880938, 2);
    expect(spouseEvent.terminalTaxes).toBeCloseTo(101_715.06347003629, 2);
    expect(spouseEvent.netEstate).toBeCloseTo(500_757.8416180576, 2);
    expect(spouseEvent.wasSpouseRolloverApplied).toBe(false);
  });

  it('summary aggregates match the spouse terminal event (survivor-drives) cent-exact', () => {
    // K014 defined-guards on optional summary fields before cent-exact compare.
    expect(summary.grossEstate).toBeDefined();
    expect(summary.terminalTaxes).toBeDefined();
    expect(summary.netEstate).toBeDefined();

    expect(summary.grossEstate!).toBeCloseTo(602_472.9050880938, 2);
    expect(summary.terminalTaxes!).toBeCloseTo(101_715.06347003629, 2);
    expect(summary.netEstate!).toBeCloseTo(500_757.8416180576, 2);

    // Identity: netEstate ≈ grossEstate − terminalTaxes.
    expect(summary.netEstate!).toBeCloseTo(summary.grossEstate! - summary.terminalTaxes!, 2);
  });
});
