/**
 * Spousal-rollover orchestration: in-loop and post-loop death branches.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Each helper encapsulates one death-branch flow:
 *
 *   - applyInLoopPrimaryDeath / applyInLoopSpouseDeath:
 *       fired the first iteration `year > endYear` for that spouse.
 *       Computes terminal-return on the decedent's PRE-roll balances,
 *       then transfers remaining assets to the survivor and zeroes the
 *       decedent's balances.
 *
 *   - emitPostLoopPrimaryTerminal / emitPostLoopSpouseTerminal:
 *       fired after the year loop for decedents whose in-loop branch never
 *       fired (longest-lived spouse OR same-year dual death).
 *
 * The four helpers each return a structured result the caller threads back
 * into the loop-local state. Helpers DO NOT mutate the caller's
 * `terminalTaxEvents` array directly; the caller appends the returned event
 * (preserving the same push-once contract as the original inline code).
 *
 * @see docs/source-of-truth/02-account-types.md - Spousal RRSP/RRIF Rollover
 * @see docs/source-of-truth/04-tax-engine.md - Terminal Return / Deemed Disposition
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ProjectionInput, TerminalReturnResult } from '@retireops/shared';
import { calculateTerminalReturn } from '../../tax/terminal-return.js';
import type { PersonBalancesSnapshot } from './account-rollover.js';

export interface PreDeathSnapshot {
  rrsp: number;
  rrif: number;
  lira: number;
  lif: number;
  tfsa: number;
  nonReg: number;
  nonRegACB: number;
}

export function takePreDeathSnapshot(b: PersonBalancesSnapshot): PreDeathSnapshot {
  return {
    rrsp: b.rrsp,
    rrif: b.rrif,
    lira: b.lira,
    lif: b.lif,
    tfsa: b.tfsa,
    nonReg: b.nonReg,
    nonRegACB: b.nonRegACB,
  };
}

function buildPersonBalancesLocal(b: {
  rrsp: number;
  rrif: number;
  lira: number;
  lif: number;
  lifPriorYearReturnRate?: number;
  tfsa: number;
  tfsaRestoredRoomFromPreviousYear: number;
  nonReg: number;
  nonRegACB: number;
}): PersonBalancesSnapshot {
  return {
    rrsp: b.rrsp,
    rrif: b.rrif,
    lira: b.lira,
    lif: b.lif,
    ...(b.lifPriorYearReturnRate !== undefined && {
      lifPriorYearReturnRate: b.lifPriorYearReturnRate,
    }),
    tfsa: b.tfsa,
    tfsaRestoredRoomFromPreviousYear: b.tfsaRestoredRoomFromPreviousYear,
    nonReg: b.nonReg,
    nonRegACB: b.nonRegACB,
  };
}

function zeroBalances(): PersonBalancesSnapshot {
  return buildPersonBalancesLocal({
    rrsp: 0,
    rrif: 0,
    lira: 0,
    lif: 0,
    tfsa: 0,
    tfsaRestoredRoomFromPreviousYear: 0,
    nonReg: 0,
    nonRegACB: 0,
  });
}

// --- In-loop primary-death branch -------------------------------------------

export interface InLoopPrimaryDeathArgs {
  input: ProjectionInput;
  startYear: number;
  primaryEndYear: number;
  spouseDeceased: boolean;
  primaryPreDeathSnapshot: PreDeathSnapshot;
  primaryBalances: PersonBalancesSnapshot;
  spouseBalances: PersonBalancesSnapshot;
}

export interface InLoopPrimaryDeathResult {
  terminalEvent: TerminalReturnResult;
  primaryBalances: PersonBalancesSnapshot;
  spouseBalances: PersonBalancesSnapshot;
}

export function applyInLoopPrimaryDeath(args: InLoopPrimaryDeathArgs): InLoopPrimaryDeathResult {
  const { input, startYear, primaryEndYear, spouseDeceased, primaryPreDeathSnapshot } = args;

  // M004/S02 T02: compute terminal-return BEFORE the roll-in mutates
  // spouseBalances. Use the pre-iteration snapshot so grossEstate reflects
  // primary's OWN terminal-year balances. year = primaryEndYear (last year
  // primary was alive); deemed-disposition is assessed on the death year.
  const primaryTerminalInput: Parameters<typeof calculateTerminalReturn>[0] = {
    year: primaryEndYear,
    owner: 'primary',
    province: input.province,
    age: input.lifeExpectancy,
    ordinaryIncomeInDeathYear: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    otherIncome: 0,
    rrspBalance: primaryPreDeathSnapshot.rrsp,
    rrifBalance: primaryPreDeathSnapshot.rrif,
    liraBalance: primaryPreDeathSnapshot.lira,
    lifBalance: primaryPreDeathSnapshot.lif,
    tfsaBalance: primaryPreDeathSnapshot.tfsa,
    nonRegBalance: primaryPreDeathSnapshot.nonReg,
    nonRegACB: primaryPreDeathSnapshot.nonRegACB,
    hasSurvivingSpouse: !spouseDeceased,
  };
  primaryTerminalInput.inflationRate = input.inflationRate;
  primaryTerminalInput.indexingBaseYear = startYear;
  const terminalEvent = calculateTerminalReturn(primaryTerminalInput);

  // Transfer primary's remaining assets to spouse
  const spouseBalances = buildPersonBalancesLocal({
    rrsp: args.spouseBalances.rrsp,
    // Primary's RRSP + RRIF rolls into spouse's RRIF (RRIF-to-RRIF rollover)
    rrif: args.spouseBalances.rrif + args.primaryBalances.rrsp + args.primaryBalances.rrif,
    lira: args.spouseBalances.lira + args.primaryBalances.lira,
    lif: args.spouseBalances.lif + args.primaryBalances.lif,
    ...(args.spouseBalances.lifPriorYearReturnRate !== undefined && {
      lifPriorYearReturnRate: args.spouseBalances.lifPriorYearReturnRate,
    }),
    tfsa: args.spouseBalances.tfsa + args.primaryBalances.tfsa,
    tfsaRestoredRoomFromPreviousYear: args.spouseBalances.tfsaRestoredRoomFromPreviousYear,
    nonReg: args.spouseBalances.nonReg + args.primaryBalances.nonReg,
    nonRegACB: args.spouseBalances.nonRegACB + args.primaryBalances.nonRegACB,
  });

  return {
    terminalEvent,
    primaryBalances: zeroBalances(),
    spouseBalances,
  };
}

// --- In-loop spouse-death branch --------------------------------------------

export interface InLoopSpouseDeathArgs {
  input: ProjectionInput;
  spouse: NonNullable<ProjectionInput['spouse']>;
  startYear: number;
  spouseEndYear: number;
  primaryDeceased: boolean;
  spousePreDeathSnapshot: PreDeathSnapshot;
  primaryBalances: PersonBalancesSnapshot;
  spouseBalances: PersonBalancesSnapshot;
}

export interface InLoopSpouseDeathResult {
  terminalEvent: TerminalReturnResult;
  primaryBalances: PersonBalancesSnapshot;
  spouseBalances: PersonBalancesSnapshot;
}

export function applyInLoopSpouseDeath(args: InLoopSpouseDeathArgs): InLoopSpouseDeathResult {
  const { input, spouse, startYear, spouseEndYear, primaryDeceased, spousePreDeathSnapshot } = args;

  // M004/S02 T02: compute spouse's terminal-return BEFORE roll-in mutates
  // primaryBalances. Uses pre-iteration snapshot for snapshot isolation.
  const spouseTerminalInput: Parameters<typeof calculateTerminalReturn>[0] = {
    year: spouseEndYear,
    owner: 'spouse',
    province: spouse.province ?? input.province,
    age: spouse.lifeExpectancy,
    ordinaryIncomeInDeathYear: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    otherIncome: 0,
    rrspBalance: spousePreDeathSnapshot.rrsp,
    rrifBalance: spousePreDeathSnapshot.rrif,
    liraBalance: spousePreDeathSnapshot.lira,
    lifBalance: spousePreDeathSnapshot.lif,
    tfsaBalance: spousePreDeathSnapshot.tfsa,
    nonRegBalance: spousePreDeathSnapshot.nonReg,
    nonRegACB: spousePreDeathSnapshot.nonRegACB,
    hasSurvivingSpouse: !primaryDeceased,
  };
  spouseTerminalInput.inflationRate = input.inflationRate;
  spouseTerminalInput.indexingBaseYear = startYear;
  const terminalEvent = calculateTerminalReturn(spouseTerminalInput);

  // Transfer spouse's remaining assets to primary
  const primaryBalances = buildPersonBalancesLocal({
    rrsp: args.primaryBalances.rrsp,
    rrif: args.primaryBalances.rrif + args.spouseBalances.rrsp + args.spouseBalances.rrif,
    lira: args.primaryBalances.lira + args.spouseBalances.lira,
    lif: args.primaryBalances.lif + args.spouseBalances.lif,
    ...(args.primaryBalances.lifPriorYearReturnRate !== undefined && {
      lifPriorYearReturnRate: args.primaryBalances.lifPriorYearReturnRate,
    }),
    tfsa: args.primaryBalances.tfsa + args.spouseBalances.tfsa,
    tfsaRestoredRoomFromPreviousYear: args.primaryBalances.tfsaRestoredRoomFromPreviousYear,
    nonReg: args.primaryBalances.nonReg + args.spouseBalances.nonReg,
    nonRegACB: args.primaryBalances.nonRegACB + args.spouseBalances.nonRegACB,
  });

  return {
    terminalEvent,
    primaryBalances,
    spouseBalances: zeroBalances(),
  };
}

// --- Post-loop terminal-return hooks ---------------------------------------

export interface PostLoopPrimaryTerminalArgs {
  input: ProjectionInput;
  startYear: number;
  primaryEndYear: number;
  spouseDeceasedPostLoop: boolean;
  primaryBalances: PersonBalancesSnapshot;
}

export function emitPostLoopPrimaryTerminal(
  args: PostLoopPrimaryTerminalArgs
): TerminalReturnResult {
  const { input, startYear, primaryEndYear, spouseDeceasedPostLoop, primaryBalances } = args;
  const primaryTerminalInput: Parameters<typeof calculateTerminalReturn>[0] = {
    year: primaryEndYear,
    owner: 'primary',
    province: input.province,
    age: input.lifeExpectancy,
    ordinaryIncomeInDeathYear: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    otherIncome: 0,
    rrspBalance: primaryBalances.rrsp,
    rrifBalance: primaryBalances.rrif,
    liraBalance: primaryBalances.lira,
    lifBalance: primaryBalances.lif,
    tfsaBalance: primaryBalances.tfsa,
    nonRegBalance: primaryBalances.nonReg,
    nonRegACB: primaryBalances.nonRegACB,
    hasSurvivingSpouse: !spouseDeceasedPostLoop,
  };
  primaryTerminalInput.inflationRate = input.inflationRate;
  primaryTerminalInput.indexingBaseYear = startYear;
  return calculateTerminalReturn(primaryTerminalInput);
}

export interface PostLoopSpouseTerminalArgs {
  input: ProjectionInput;
  spouse: NonNullable<ProjectionInput['spouse']>;
  startYear: number;
  spouseEndYear: number;
  primaryDeceasedPostLoop: boolean;
  spouseBalances: PersonBalancesSnapshot;
}

export function emitPostLoopSpouseTerminal(args: PostLoopSpouseTerminalArgs): TerminalReturnResult {
  const { input, spouse, startYear, spouseEndYear, primaryDeceasedPostLoop, spouseBalances } = args;
  const spouseTerminalInput: Parameters<typeof calculateTerminalReturn>[0] = {
    year: spouseEndYear,
    owner: 'spouse',
    province: spouse.province ?? input.province,
    age: spouse.lifeExpectancy,
    ordinaryIncomeInDeathYear: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    otherIncome: 0,
    rrspBalance: spouseBalances.rrsp,
    rrifBalance: spouseBalances.rrif,
    liraBalance: spouseBalances.lira,
    lifBalance: spouseBalances.lif,
    tfsaBalance: spouseBalances.tfsa,
    nonRegBalance: spouseBalances.nonReg,
    nonRegACB: spouseBalances.nonRegACB,
    hasSurvivingSpouse: !primaryDeceasedPostLoop,
  };
  spouseTerminalInput.inflationRate = input.inflationRate;
  spouseTerminalInput.indexingBaseYear = startYear;
  return calculateTerminalReturn(spouseTerminalInput);
}
