/**
 * VR-EST-* Worked Example — single-person parity test (M004/S04 T06)
 *
 * K012 cent-exact parity: every row typed into the VR-EST-RRSP-INCLUSION-001
 * Worked Example table (docs/source-of-truth/02-account-types.md) and the
 * VR-EST-NET-001 Worked Example table (docs/source-of-truth/09-success-metrics.md)
 * is asserted here. Numbers came from the engine's own T01 capture dump
 * (.gsd/milestones/M004/slices/S04/CAPTURE.md, Scenario 1) — a failure means
 * the doc table has drifted from engine output and the table is what gets
 * fixed, not the engine.
 *
 * @see .gsd/milestones/M004/slices/S04/S04-PLAN.md
 * @see .gsd/milestones/M004/slices/S04/CAPTURE.md
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection } from '../projection/multi-year.js';
import { getCurrentYear } from '@retireops/shared';
import type { ProjectionInput } from '@retireops/shared';

function makeSinglePersonWorkedExampleInput(): ProjectionInput {
  const currentYear = getCurrentYear();
  const birthYear = currentYear - 85;
  return {
    birthdate: new Date(birthYear, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 85,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    pensionIncome: 40_000,
    pensionStartAge: 65,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    rrifBalance: 500_000,
    liraBalance: 0,
    lifBalance: 0,
    tfsaBalance: 100_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 300_000,
    retirementSpending: 0,
    investmentReturn: 0,
    inflationRate: 0,
    expectedCPPAt65: 0,
    cppStartAge: 65,
    oasStartAge: 999,
    yearsOfResidence: 0,
  };
}

describe('VR-EST worked example — single person (M004/S04 T06 PARITY)', () => {
  const output = runSingleProjection(makeSinglePersonWorkedExampleInput());
  const finalRow = output.yearlyResults[output.yearlyResults.length - 1]!;
  const events = output.terminalTaxEvents;
  const summary = output.summary;

  it('terminalTaxEvents array is populated with the single decedent event', () => {
    expect(events).toBeDefined();
    expect(events!.length).toBe(1);
  });

  it('VR-EST-RRSP-INCLUSION-001 Worked Example rows match engine cent-exact', () => {
    // Final-year balances (end of terminal year, post RRIF min-withdrawal)
    expect(finalRow.rrspBalance).toBeCloseTo(0, 2);
    expect(finalRow.rrifBalance).toBeCloseTo(457_450, 2);
    // LIRA/LIF are optional on YearlyResult — guard before numeric compare.
    expect(finalRow.liraBalance ?? 0).toBeCloseTo(0, 2);
    expect(finalRow.lifBalance ?? 0).toBeCloseTo(0, 2);

    // Registered inclusion = RRSP + RRIF + LIRA + LIF = deemedDispositionIncome
    const event = events![0]!;
    expect(event.deemedDispositionIncome).toBeCloseTo(457_450, 2);

    // In-year income rows (pre-death)
    expect(finalRow.pensionIncome).toBeCloseTo(40_000, 2);
    expect(finalRow.rrifWithdrawal).toBeCloseTo(42_550, 2);
    expect(finalRow.totalIncome).toBeCloseTo(82_550, 2);
    // 2026 tax-table refresh (audit A-09/A-10): in-year tax recomputed on the
    // doc-19 2026 federal+Ontario credits/brackets. Hand-reconciled:
    //   fed net 10024.008 (BPA 16452, age 9208, brackets 58522×1.02-indexed, 0.14)
    //   + ON net 4622.608375 (age 6342, pension 1796) = 14646.616375.
    expect(finalRow.taxesPaid).toBeCloseTo(14_646.616375, 2);

    // Terminal-return fields
    expect(event.realizedCapitalGain).toBeCloseTo(0, 2);
    expect(event.grossEstate).toBeCloseTo(857_450, 2);
    // 2026 refresh: deemed-disposition terminal tax recomputed on 2026 credits/brackets.
    expect(event.terminalTaxes).toBeCloseTo(198_829.014968, 2);
    expect(event.netEstate).toBeCloseTo(658_620.985032, 2);
    expect(event.wasSpouseRolloverApplied).toBe(false);
  });

  it('VR-EST-NET-001 Worked Example rows match engine cent-exact', () => {
    // Terminal-year balance rows
    expect(finalRow.rrifBalance).toBeCloseTo(457_450, 2);
    expect(finalRow.nonRegBalance).toBeCloseTo(300_000, 2);
    expect(finalRow.tfsaBalance).toBeCloseTo(100_000, 2);

    // K014 defined-guards on optional summary fields before cent-exact compare.
    expect(summary.grossEstate).toBeDefined();
    expect(summary.terminalTaxes).toBeDefined();
    expect(summary.netEstate).toBeDefined();

    expect(summary.grossEstate!).toBeCloseTo(857_450, 2);
    // 2026 tax-table refresh (audit A-09/A-10) — see VR-EST-RRSP-INCLUSION-001 above.
    expect(summary.terminalTaxes!).toBeCloseTo(198_829.014968, 2);
    expect(summary.netEstate!).toBeCloseTo(658_620.985032, 2);

    // Deemed disposition + realized capital gain rows (from the single event)
    const event = events![0]!;
    expect(event.deemedDispositionIncome).toBeCloseTo(457_450, 2);
    expect(event.realizedCapitalGain).toBeCloseTo(0, 2);

    // Identity: netEstate ≈ grossEstate − terminalTaxes.
    expect(summary.netEstate!).toBeCloseTo(summary.grossEstate! - summary.terminalTaxes!, 2);
  });
});
