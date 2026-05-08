/**
 * Terminal Return — Estate tax integration tests (M004/S02 — single path)
 * @see docs/source-of-truth/04-tax-engine.md
 * @see .gsd/milestones/M004/slices/S02/S02-PLAN.md
 *
 * Proves that runSingleProjection emits a single terminal-return event on
 * output.terminalTaxEvents at endYear. Cent-exact pins use the K012
 * capture-harness-then-pin workflow (values captured from a one-shot run and
 * transcribed verbatim — regenerate by re-running the harness if tax tables
 * change).
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection, runCoupleProjection } from './multi-year.js';
import { getCurrentYear } from '@retireops/shared';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';

/**
 * Single-person ON scenario. Zero growth + zero spending + startAge ===
 * lifeExpectancy makes the projection loop exactly one iteration and keeps
 * balances close to inputs at the terminal year, which produces predictable,
 * reproducible pins independent of today's calendar date.
 */
function makeONTerminalInput(): ProjectionInput {
  const currentYear = getCurrentYear();
  // Age 90 at the start year == lifeExpectancy 90 → endYear === startYear.
  const birthYear = currentYear - 90;
  return {
    birthdate: new Date(birthYear, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 800_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 50_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 200_000,
    retirementSpending: 0,
    investmentReturn: 0,
    inflationRate: 0,
  };
}

describe('estate terminal-return wiring — single projection (M004/S02 T01)', () => {
  it('attaches a single-element terminalTaxEvents array at endYear', () => {
    const output = runSingleProjection(makeONTerminalInput());

    expect(output.terminalTaxEvents).toBeDefined();
    expect(output.terminalTaxEvents?.length).toBe(1);
  });

  it('ON, age 65 → lifeExpectancy 90 scenario: structural invariants + K012 cent-exact pin', () => {
    const output = runSingleProjection(makeONTerminalInput());
    // K014 positive-case guard — fail loudly if wiring regresses to undefined
    // instead of silently masking via `!`.
    expect(output.terminalTaxEvents).toBeDefined();
    const events = output.terminalTaxEvents!;
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(1);

    const event = events[0]!;

    // Structural invariants
    expect(event.wasSpouseRolloverApplied).toBe(false);

    // End-of-loop balances drive the event. Pull them from yearlyResults so
    // the test adapts if the underlying loop evolves without silently masking
    // a snapshot-timing regression.
    const finalRow = output.yearlyResults[output.yearlyResults.length - 1]!;
    const finalRRSP = finalRow.rrspBalance;
    const finalRRIF = finalRow.rrifBalance;
    const finalTFSA = finalRow.tfsaBalance;
    const finalNonReg = finalRow.nonRegBalance;

    expect(event.grossEstate).toBeCloseTo(finalRRSP + finalRRIF + finalTFSA + finalNonReg, 2);
    expect(event.deemedDispositionIncome).toBeCloseTo(finalRRSP + finalRRIF, 2);
    expect(event.netEstate).toBeCloseTo(event.grossEstate - event.terminalTaxes, 2);

    // K012 capture-harness pin — value captured from one-shot harness run on
    // the fixture above and transcribed verbatim.
    expect(event.terminalTaxes).toBeCloseTo(__PIN_TERMINAL_TAXES_ON_SINGLE__, 2);
    expect(event.grossEstate).toBeCloseTo(__PIN_GROSS_ESTATE_ON_SINGLE__, 2);
    expect(event.deemedDispositionIncome).toBeCloseTo(__PIN_DEEMED_ON_SINGLE__, 2);

    // M004/S03 — summary exposure (K014 toBeDefined guards + aggregate equals event).
    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();
    expect(output.summary.grossEstate).toBeCloseTo(event.grossEstate, 2);
    expect(output.summary.terminalTaxes).toBeCloseTo(event.terminalTaxes, 2);
    expect(output.summary.netEstate).toBeCloseTo(event.netEstate, 2);
  });

  // K012 capture harness — flip .skip to nothing, run the test, copy the
  // logged numbers into the __PIN_*__ constants, then re-skip.
  it.skip('CAPTURE harness — run once to produce K012 pins then re-skip', () => {
    const output = runSingleProjection(makeONTerminalInput());
    // eslint-disable-next-line no-console
    console.log('\n=== M004/S02 T01 CAPTURE ===');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output.terminalTaxEvents, null, 2));
    // eslint-disable-next-line no-console
    console.log('final row balances:', {
      rrsp: output.yearlyResults[output.yearlyResults.length - 1]?.rrspBalance,
      rrif: output.yearlyResults[output.yearlyResults.length - 1]?.rrifBalance,
      tfsa: output.yearlyResults[output.yearlyResults.length - 1]?.tfsaBalance,
      nonReg: output.yearlyResults[output.yearlyResults.length - 1]?.nonRegBalance,
    });
  });
});

// ---------------------------------------------------------------------------
// K012 pinned constants — captured from one-shot harness run against the
// fixture in makeONTerminalInput(). DO NOT hand-edit; regenerate via the
// CAPTURE harness above if tax tables or engine behavior changes.
// ---------------------------------------------------------------------------
const __PIN_TERMINAL_TAXES_ON_SINGLE__ = 382759.967268;
const __PIN_GROSS_ESTATE_ON_SINGLE__ = 1_050_000;
const __PIN_DEEMED_ON_SINGLE__ = 800_000;

// ---------------------------------------------------------------------------
// Couple-projection terminal-return wiring (M004/S02 T02)
//
// Three scenarios prove the wiring is correct:
//   (A) primary dies before spouse (first-death-with-survivor)
//   (B) spouse dies before primary (symmetric, proves spouse-first branch)
//   (C) same-year-dual-death (proves snapshot isolation — no cross-contamination)
//
// All fixtures are ON. OAS/CPP/pensions zeroed where possible to keep tax
// downstream tractable; investment return + inflation = 0; spending = 0 so
// balances only drift through RRIF minimum withdrawals & their tax.
// ---------------------------------------------------------------------------

function makeCoupleTerminalInput(args: {
  primaryStartAge: number;
  primaryLifeExp: number;
  spouseStartAge: number;
  spouseLifeExp: number;
  province?: 'ON' | 'QC' | 'AB';
}): ProjectionInput {
  const currentYear = getCurrentYear();
  const primaryBirthYear = currentYear - args.primaryStartAge;
  const spouseBirthYear = currentYear - args.spouseStartAge;
  const province = args.province ?? 'ON';
  const spouse: SpouseInput = {
    birthdate: new Date(spouseBirthYear, 0, 1),
    retirementAge: 65,
    lifeExpectancy: args.spouseLifeExp,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 400_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 30_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 80_000,
    nonRegACB: 80_000,
    expectedCPPAt65: 0,
    cppStartAge: 65,
    oasStartAge: 999, // never-receives — keeps OAS out of year results
    yearsOfResidence: 0,
    province,
  };
  return {
    birthdate: new Date(primaryBirthYear, 0, 1),
    province,
    retirementAge: 65,
    lifeExpectancy: args.primaryLifeExp,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 800_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 50_000,
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

// Scenario A: primary dies first at 85, spouse lives to 90.
const makeFirstDeathWithSurvivorInput = (): ProjectionInput =>
  makeCoupleTerminalInput({
    primaryStartAge: 80,
    primaryLifeExp: 85,
    spouseStartAge: 80,
    spouseLifeExp: 90,
  });

// Scenario B: symmetric — spouse dies first at 85, primary lives to 90.
const makeSpouseFirstInput = (): ProjectionInput =>
  makeCoupleTerminalInput({
    primaryStartAge: 80,
    primaryLifeExp: 90,
    spouseStartAge: 80,
    spouseLifeExp: 85,
  });

// Scenario C: both die in the same year — single-iteration loop.
const makeSameYearDualDeathInput = (): ProjectionInput =>
  makeCoupleTerminalInput({
    primaryStartAge: 85,
    primaryLifeExp: 85,
    spouseStartAge: 85,
    spouseLifeExp: 85,
  });

describe('estate terminal-return wiring — couple projection (M004/S02 T02)', () => {
  it('A: primary dies before spouse — two events, primary rollover $0, spouse taxed (ON, cent-exact)', () => {
    const output = runCoupleProjection(makeFirstDeathWithSurvivorInput());
    // K014 positive-case guard — fail loudly if wiring regresses to undefined.
    expect(output.terminalTaxEvents).toBeDefined();
    const events = output.terminalTaxEvents!;

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(2);

    const primaryEvent = events[0]!;
    const spouseEvent = events[1]!;

    // Primary dies first with surviving spouse → spousal rollover → zero terminal tax
    expect(primaryEvent.wasSpouseRolloverApplied).toBe(true);
    expect(primaryEvent.terminalTaxes).toBeCloseTo(0, 2);

    // Spouse dies second with no surviving spouse → full deemed-disposition tax
    expect(spouseEvent.wasSpouseRolloverApplied).toBe(false);
    expect(spouseEvent.terminalTaxes).toBeGreaterThan(0);

    // Cent-exact K012 pin for the spouse's terminal tax (the only non-zero path).
    expect(spouseEvent.terminalTaxes).toBeCloseTo(__PIN_COUPLE_A_SPOUSE_TERMINAL_TAXES__, 2);
    expect(spouseEvent.grossEstate).toBeCloseTo(__PIN_COUPLE_A_SPOUSE_GROSS_ESTATE__, 2);

    // M004/S03 — summary exposure (K014): excludes rollover-event gross, sums all taxes.
    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();
    expect(output.summary.grossEstate).toBeCloseTo(spouseEvent.grossEstate, 2);
    expect(output.summary.terminalTaxes).toBeCloseTo(spouseEvent.terminalTaxes, 2);
    expect(output.summary.netEstate).toBeCloseTo(
      spouseEvent.grossEstate - spouseEvent.terminalTaxes,
      2
    );
  });

  it('B: spouse dies before primary — two events, spouse rollover $0, primary taxed (ON, cent-exact)', () => {
    const output = runCoupleProjection(makeSpouseFirstInput());
    // K014 positive-case guard — fail loudly if wiring regresses to undefined.
    expect(output.terminalTaxEvents).toBeDefined();
    const events = output.terminalTaxEvents!;

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(2);

    // Order: spouse branch fires first (in-loop), primary emitted post-loop.
    const spouseEvent = events[0]!;
    const primaryEvent = events[1]!;

    expect(spouseEvent.wasSpouseRolloverApplied).toBe(true);
    expect(spouseEvent.terminalTaxes).toBeCloseTo(0, 2);

    expect(primaryEvent.wasSpouseRolloverApplied).toBe(false);
    expect(primaryEvent.terminalTaxes).toBeGreaterThan(0);

    expect(primaryEvent.terminalTaxes).toBeCloseTo(__PIN_COUPLE_B_PRIMARY_TERMINAL_TAXES__, 2);
    expect(primaryEvent.grossEstate).toBeCloseTo(__PIN_COUPLE_B_PRIMARY_GROSS_ESTATE__, 2);

    // M004/S03 — summary exposure (K014): survivor (primary) drives aggregate.
    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();
    expect(output.summary.grossEstate).toBeCloseTo(primaryEvent.grossEstate, 2);
    expect(output.summary.terminalTaxes).toBeCloseTo(primaryEvent.terminalTaxes, 2);
    expect(output.summary.netEstate).toBeCloseTo(
      primaryEvent.grossEstate - primaryEvent.terminalTaxes,
      2
    );
  });

  it('C: same-year dual death — two events, both taxed, snapshot isolation (no cross-contamination)', () => {
    const output = runCoupleProjection(makeSameYearDualDeathInput());
    // K014 positive-case guard — fail loudly if wiring regresses to undefined.
    expect(output.terminalTaxEvents).toBeDefined();
    const events = output.terminalTaxEvents!;

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(2);

    // Both emitted post-loop; primary first then spouse.
    const primaryEvent = events[0]!;
    const spouseEvent = events[1]!;

    // hasSurvivingSpouse is false for both at year=endYear+1 (neither rollover applied)
    expect(primaryEvent.wasSpouseRolloverApplied).toBe(false);
    expect(spouseEvent.wasSpouseRolloverApplied).toBe(false);
    expect(primaryEvent.terminalTaxes).toBeGreaterThan(0);
    expect(spouseEvent.terminalTaxes).toBeGreaterThan(0);

    // Snapshot isolation: each event's grossEstate reflects that person's OWN
    // end-of-loop balances (no roll-in cross-contamination). Pull from the
    // single yearly row to assert against actual engine-computed balances.
    const row = output.yearlyResults[output.yearlyResults.length - 1]!;
    const primaryOwn =
      row.primary.rrspBalance +
      row.primary.rrifBalance +
      (row.primary.liraBalance ?? 0) +
      (row.primary.lifBalance ?? 0) +
      row.primary.tfsaBalance +
      row.primary.nonRegBalance;
    const spouseOwn =
      row.spouse.rrspBalance +
      row.spouse.rrifBalance +
      (row.spouse.liraBalance ?? 0) +
      (row.spouse.lifBalance ?? 0) +
      row.spouse.tfsaBalance +
      row.spouse.nonRegBalance;

    expect(primaryEvent.grossEstate).toBeCloseTo(primaryOwn, 2);
    expect(spouseEvent.grossEstate).toBeCloseTo(spouseOwn, 2);
    // netEstate invariant
    expect(primaryEvent.netEstate).toBeCloseTo(
      primaryEvent.grossEstate - primaryEvent.terminalTaxes,
      2
    );
    expect(spouseEvent.netEstate).toBeCloseTo(
      spouseEvent.grossEstate - spouseEvent.terminalTaxes,
      2
    );

    // M004/S03 — summary exposure (K014): same-year dual death sums BOTH events
    // (neither wasSpouseRolloverApplied=true → both contribute to grossEstate).
    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();
    expect(output.summary.grossEstate).toBeCloseTo(
      primaryEvent.grossEstate + spouseEvent.grossEstate,
      2
    );
    expect(output.summary.terminalTaxes).toBeCloseTo(
      primaryEvent.terminalTaxes + spouseEvent.terminalTaxes,
      2
    );
    expect(output.summary.netEstate).toBeCloseTo(
      output.summary.grossEstate! - output.summary.terminalTaxes!,
      2
    );
  });

  // K012 capture harness — flip .skip off, run once, copy console output into
  // the __PIN_COUPLE_*__ constants below, then re-skip.
  it.skip('CAPTURE harness — couple scenarios A + B cent-exact pins', () => {
    const a = runCoupleProjection(makeFirstDeathWithSurvivorInput());
    const b = runCoupleProjection(makeSpouseFirstInput());
    const c = runCoupleProjection(makeSameYearDualDeathInput());
    // eslint-disable-next-line no-console
    console.log('\n=== M004/S02 T02 COUPLE CAPTURE ===');
    // eslint-disable-next-line no-console
    console.log('SCENARIO A events:', JSON.stringify(a.terminalTaxEvents, null, 2));
    // eslint-disable-next-line no-console
    console.log('SCENARIO B events:', JSON.stringify(b.terminalTaxEvents, null, 2));
    // eslint-disable-next-line no-console
    console.log('SCENARIO C events:', JSON.stringify(c.terminalTaxEvents, null, 2));
  });
});

// ---------------------------------------------------------------------------
// K012 pinned constants — captured from one-shot harness run. DO NOT hand-edit;
// regenerate via the COUPLE CAPTURE harness above if tax tables or engine
// behavior changes.
// ---------------------------------------------------------------------------
const __PIN_COUPLE_A_SPOUSE_TERMINAL_TAXES__ = 203162.1815298641;
const __PIN_COUPLE_A_SPOUSE_GROSS_ESTATE__ = 824488.8328361581;
const __PIN_COUPLE_B_PRIMARY_TERMINAL_TAXES__ = 203162.1815298641;
const __PIN_COUPLE_B_PRIMARY_GROSS_ESTATE__ = 824488.8328361581;

// ---------------------------------------------------------------------------
// Cross-jurisdiction couple scenarios (M004/S02 T03)
//
// Mirror Scenario A (first-death-with-survivor: primary dies at 85, spouse
// lives to 90) with province = 'QC' and 'AB'. Both primary and spouse share
// province — the survivor is still a resident at the second (taxable) death.
//
// K012 cent-exact pins for the spouse's terminal taxes at the second death:
//   ON spouse terminalTaxes : 203162.1815298641 (Scenario A baseline)
//   QC spouse terminalTaxes : 211317.3336683141 (fed AREL/abatement on spike)
//   AB spouse terminalTaxes : 181682.3547613559 (AB flat-rate divergence)
// grossEstate is identical across provinces (824488.83) — divergence is tax-only.
//
// QC exercises the federal AREL/Quebec-abatement branch (16.5% federal
// reduction) on the spike-income death year; AB exercises AB's flat-rate
// provincial bracket divergence vs ON's progressive brackets.
// ---------------------------------------------------------------------------

const makeCoupleQCFirstDeathInput = (): ProjectionInput =>
  makeCoupleTerminalInput({
    primaryStartAge: 80,
    primaryLifeExp: 85,
    spouseStartAge: 80,
    spouseLifeExp: 90,
    province: 'QC',
  });

const makeCoupleABFirstDeathInput = (): ProjectionInput =>
  makeCoupleTerminalInput({
    primaryStartAge: 80,
    primaryLifeExp: 85,
    spouseStartAge: 80,
    spouseLifeExp: 90,
    province: 'AB',
  });

describe('estate terminal-return wiring — cross-jurisdiction couples (M004/S02 T03)', () => {
  it('QC: primary dies first with survivor — rollover $0 + K012 cent-exact spouse tax pin', () => {
    const output = runCoupleProjection(makeCoupleQCFirstDeathInput());
    // K014 positive-case guard — fail loudly if wiring regresses to undefined.
    expect(output.terminalTaxEvents).toBeDefined();
    const events = output.terminalTaxEvents!;

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(2);
    const primaryEvent = events[0]!;
    const spouseEvent = events[1]!;

    // Same structural invariants as Scenario A (ON): rollover zeros primary,
    // full deemed-disposition tax applies to the surviving-then-final spouse.
    expect(primaryEvent.wasSpouseRolloverApplied).toBe(true);
    expect(primaryEvent.terminalTaxes).toBeCloseTo(0, 2);

    expect(spouseEvent.wasSpouseRolloverApplied).toBe(false);
    expect(spouseEvent.terminalTaxes).toBeGreaterThan(0);

    expect(spouseEvent.terminalTaxes).toBeCloseTo(__PIN_COUPLE_QC_SPOUSE_TERMINAL_TAXES__, 2);
    expect(spouseEvent.grossEstate).toBeCloseTo(__PIN_COUPLE_QC_SPOUSE_GROSS_ESTATE__, 2);

    // QC diverges from ON via federal AREL/abatement on the spike year.
    expect(spouseEvent.terminalTaxes).not.toBeCloseTo(__PIN_COUPLE_A_SPOUSE_TERMINAL_TAXES__, 2);

    // M004/S03 — summary exposure (K014).
    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();
    expect(output.summary.grossEstate).toBeCloseTo(spouseEvent.grossEstate, 2);
    expect(output.summary.terminalTaxes).toBeCloseTo(spouseEvent.terminalTaxes, 2);
  });

  it('AB: primary dies first with survivor — rollover $0 + K012 cent-exact spouse tax pin', () => {
    const output = runCoupleProjection(makeCoupleABFirstDeathInput());
    // K014 positive-case guard — fail loudly if wiring regresses to undefined.
    expect(output.terminalTaxEvents).toBeDefined();
    const events = output.terminalTaxEvents!;

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(2);
    const primaryEvent = events[0]!;
    const spouseEvent = events[1]!;

    expect(primaryEvent.wasSpouseRolloverApplied).toBe(true);
    expect(primaryEvent.terminalTaxes).toBeCloseTo(0, 2);

    expect(spouseEvent.wasSpouseRolloverApplied).toBe(false);
    expect(spouseEvent.terminalTaxes).toBeGreaterThan(0);

    expect(spouseEvent.terminalTaxes).toBeCloseTo(__PIN_COUPLE_AB_SPOUSE_TERMINAL_TAXES__, 2);
    expect(spouseEvent.grossEstate).toBeCloseTo(__PIN_COUPLE_AB_SPOUSE_GROSS_ESTATE__, 2);

    // AB diverges from ON via flat provincial rate on the spike year.
    expect(spouseEvent.terminalTaxes).not.toBeCloseTo(__PIN_COUPLE_A_SPOUSE_TERMINAL_TAXES__, 2);

    // M004/S03 — summary exposure (K014).
    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();
    expect(output.summary.grossEstate).toBeCloseTo(spouseEvent.grossEstate, 2);
    expect(output.summary.terminalTaxes).toBeCloseTo(spouseEvent.terminalTaxes, 2);
  });

  // K012 capture harness — flip .skip off, run once, copy console output into
  // the __PIN_COUPLE_{QC,AB}_*__ constants below, then re-skip.
  it.skip('CAPTURE harness — QC + AB cross-jurisdiction couple pins', () => {
    const qc = runCoupleProjection(makeCoupleQCFirstDeathInput());
    const ab = runCoupleProjection(makeCoupleABFirstDeathInput());
    // eslint-disable-next-line no-console
    console.log('\n=== M004/S02 T03 QC/AB CAPTURE ===');
    // eslint-disable-next-line no-console
    console.log('QC events:', JSON.stringify(qc.terminalTaxEvents, null, 2));
    // eslint-disable-next-line no-console
    console.log('AB events:', JSON.stringify(ab.terminalTaxEvents, null, 2));
  });
});

// ---------------------------------------------------------------------------
// K012 pinned constants (T03) — captured from one-shot harness run. DO NOT
// hand-edit; regenerate via the QC/AB CAPTURE harness above if tax tables or
// engine behavior changes.
// ---------------------------------------------------------------------------
const __PIN_COUPLE_QC_SPOUSE_TERMINAL_TAXES__ = 211317.3336683141;
const __PIN_COUPLE_QC_SPOUSE_GROSS_ESTATE__ = 824488.8328361581;
const __PIN_COUPLE_AB_SPOUSE_TERMINAL_TAXES__ = 181682.3547613559;
const __PIN_COUPLE_AB_SPOUSE_GROSS_ESTATE__ = 824488.8328361581;

// ---------------------------------------------------------------------------
// M004/S03 T02 — Dedicated K014 regression surface for ProjectionSummary /
// CoupleProjectionSummary estate fields across all topologies. These assertions
// duplicate the inline S03 blocks embedded in the S02 describe groups above;
// the duplication is intentional — this describe block is the named, topology-
// organized guard that hunts down any future refactor which forgets to attach
// summary.{grossEstate,terminalTaxes,netEstate} on a single branch.
// ---------------------------------------------------------------------------
describe('estate summary fields — ProjectionSummary / CoupleProjectionSummary (M004/S03)', () => {
  it('Single ON: summary equals the single terminal event', () => {
    const output = runSingleProjection(makeONTerminalInput());
    const event = output.terminalTaxEvents![0]!;

    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();

    expect(output.summary.grossEstate!).toBeCloseTo(event.grossEstate, 2);
    expect(output.summary.terminalTaxes!).toBeCloseTo(event.terminalTaxes, 2);
    expect(output.summary.netEstate!).toBeCloseTo(event.netEstate, 2);
    expect(output.summary.netEstate!).toBeCloseTo(
      output.summary.grossEstate! - output.summary.terminalTaxes!,
      2
    );
  });

  it('Couple A — primary-first-with-survivor (ON): survivor drives aggregate, rollover event excluded from gross', () => {
    const output = runCoupleProjection(makeFirstDeathWithSurvivorInput());
    const events = output.terminalTaxEvents!;
    const spouseEvent = events[1]!;

    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();

    expect(output.summary.grossEstate!).toBeCloseTo(spouseEvent.grossEstate, 2);
    expect(output.summary.terminalTaxes!).toBeCloseTo(spouseEvent.terminalTaxes, 2);
    expect(output.summary.netEstate!).toBeCloseTo(
      output.summary.grossEstate! - output.summary.terminalTaxes!,
      2
    );
  });

  it('Couple B — spouse-first (ON): symmetric, primary drives aggregate', () => {
    const output = runCoupleProjection(makeSpouseFirstInput());
    const events = output.terminalTaxEvents!;
    const primaryEvent = events[1]!;

    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();

    expect(output.summary.grossEstate!).toBeCloseTo(primaryEvent.grossEstate, 2);
    expect(output.summary.terminalTaxes!).toBeCloseTo(primaryEvent.terminalTaxes, 2);
    expect(output.summary.netEstate!).toBeCloseTo(
      output.summary.grossEstate! - output.summary.terminalTaxes!,
      2
    );
  });

  it('Couple C — same-year dual death: summary sums BOTH events (neither rolled over)', () => {
    const output = runCoupleProjection(makeSameYearDualDeathInput());
    const events = output.terminalTaxEvents!;
    const primaryEvent = events[0]!;
    const spouseEvent = events[1]!;

    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();

    expect(output.summary.grossEstate!).toBeCloseTo(
      primaryEvent.grossEstate + spouseEvent.grossEstate,
      2
    );
    expect(output.summary.terminalTaxes!).toBeCloseTo(
      primaryEvent.terminalTaxes + spouseEvent.terminalTaxes,
      2
    );
    expect(output.summary.netEstate!).toBeCloseTo(
      output.summary.grossEstate! - output.summary.terminalTaxes!,
      2
    );
  });

  it('Couple QC first-death-with-survivor: cross-jurisdiction summary pass-through matches K012 pin', () => {
    const output = runCoupleProjection(makeCoupleQCFirstDeathInput());

    expect(output.summary.grossEstate).toBeDefined();
    expect(output.summary.terminalTaxes).toBeDefined();
    expect(output.summary.netEstate).toBeDefined();

    expect(output.summary.terminalTaxes!).toBeCloseTo(__PIN_COUPLE_QC_SPOUSE_TERMINAL_TAXES__, 2);
    expect(output.summary.grossEstate!).toBeCloseTo(__PIN_COUPLE_QC_SPOUSE_GROSS_ESTATE__, 2);
    expect(output.summary.netEstate!).toBeCloseTo(
      output.summary.grossEstate! - output.summary.terminalTaxes!,
      2
    );
  });
});
