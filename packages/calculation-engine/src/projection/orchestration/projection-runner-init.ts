/**
 * Per-runner setup helpers — bundle the once-per-projection initialization
 * that runs OUTSIDE the year loop in compute{Single,Couple}Projection.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 *
 * Two named exports:
 *
 *   - initSingleRunner(input):
 *       startYear/endYear, initial balances, contribution-room ledger seeded
 *       with the residency-sliced TFSA baseline + RRSP/FHSA seeds, sorted
 *       owner-filtered overrides, surplusDestination, and an empty
 *       overrideWarnings accumulator.
 *
 *   - initCoupleRunner(input):
 *       same idea for the couple path — primary/spouse balances + ledgers,
 *       per-spouse override slices, marital-status defaults, couple settings,
 *       spousal-RRSP attribution ledger, terminalTaxEvents accumulator, and
 *       survivor-tracking flags.
 *
 * @see docs/source-of-truth/02-account-types.md - RRSP-002, VR-TFSA-RESIDENCY-001
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-12
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type {
  ContributionRoomLedger,
  MaritalStatus,
  ProjectionInput,
  SpousalRRSPLedger,
  TerminalReturnResult,
} from '@retireops/shared';
import { FHSA_LIMITS, ageAtEndOfYear, getCurrentYear } from '@retireops/shared';
import { computeTfsaResidencyBaseline } from '../tfsa-residency-baseline.js';
import {
  sortWithdrawalOverrides,
  sortSpendingOverrides,
  type OverrideWarning,
  type WithdrawalOverrideInput,
  type SpendingOverrideInput,
} from '../overrides.js';
import type { PersonBalancesSnapshot } from './account-rollover.js';

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

// --- Single runner ----------------------------------------------------------

export interface SingleRunnerInit {
  startYear: number;
  endYear: number;
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
  tfsaRestoredRoomFromPreviousYear: number;
  ledger: ContributionRoomLedger;
  primaryWithdrawalOverrides: WithdrawalOverrideInput[];
  primarySpendingOverrides: SpendingOverrideInput[];
  overrideWarnings: OverrideWarning[];
  surplusDestination: ProjectionInput['surplusDestination'];
}

export function initSingleRunner(input: ProjectionInput): SingleRunnerInit {
  const startYear = input.projectionStartYear ?? getCurrentYear();
  const startAge = ageAtEndOfYear(input.birthdate, startYear);
  const endYear = startYear + (input.lifeExpectancy - startAge);

  // M005/S02-S03 contribution-room ledger seeded from the residency-sliced TFSA
  // baseline + RRSP/FHSA caller seeds. See ledger-step.ts for K005/S02/S03 docs.
  const tfsaBaseline = computeTfsaResidencyBaseline({
    birthdate: input.birthdate,
    ...(input.residencyStartYear !== undefined && {
      residencyStartYear: input.residencyStartYear,
    }),
    startYear,
  });
  const ledger: ContributionRoomLedger = {
    rrsp: { roomAvailable: input.rrspUnusedRoomSeed ?? 0 },
    tfsa: { roomAvailable: tfsaBaseline, cumulativeCapBaseline: tfsaBaseline },
    fhsa: {
      annualRoomRemaining: FHSA_LIMITS.annualLimit,
      carryForwardAvailable: 0,
      lifetimeContributed: input.fhsaLifetimeContributedSeed ?? 0,
    },
  };

  // Phase 1 D-12: pre-sort override arrays once; single projections only ever
  // apply primary-owner overrides (no spouse exists). Pre-Phase records lack
  // an `owner` field and default to primary.
  const sortedWithdrawalOverrides = sortWithdrawalOverrides(input.withdrawalOverrides);
  const sortedSpendingOverrides = sortSpendingOverrides(input.spendingOverrides);
  const primaryWithdrawalOverrides = sortedWithdrawalOverrides.filter(
    (o) => (o.owner ?? 'primary') === 'primary'
  );
  const primarySpendingOverrides = sortedSpendingOverrides.filter(
    (o) => (o.owner ?? 'primary') === 'primary'
  );

  return {
    startYear,
    endYear,
    rrspBalance: input.rrspBalance,
    rrifBalance: input.rrifBalance ?? 0,
    tfsaBalance: input.tfsaBalance,
    nonRegBalance: input.nonRegBalance,
    nonRegACB: input.nonRegACB ?? input.nonRegBalance, // ACB = balance initially when not supplied
    tfsaRestoredRoomFromPreviousYear: 0,
    ledger,
    primaryWithdrawalOverrides,
    primarySpendingOverrides,
    overrideWarnings: [],
    surplusDestination: input.surplusDestination,
  };
}

// --- Couple runner ----------------------------------------------------------

export interface CoupleRunnerInit {
  spouse: NonNullable<ProjectionInput['spouse']>;
  startYear: number;
  primaryEndYear: number;
  spouseEndYear: number;
  endYear: number;
  primaryBalances: PersonBalancesSnapshot;
  spouseBalances: PersonBalancesSnapshot;
  maritalStatus: MaritalStatus;
  coupleSettings: NonNullable<ProjectionInput['coupleSettings']>;
  primaryLedger: ContributionRoomLedger;
  spouseLedger: ContributionRoomLedger;
  spousalRrspLedger: SpousalRRSPLedger;
  terminalTaxEvents: TerminalReturnResult[];
  primaryWithdrawalOverrides: WithdrawalOverrideInput[];
  spouseWithdrawalOverrides: WithdrawalOverrideInput[];
  primarySpendingOverrides: SpendingOverrideInput[];
  spouseSpendingOverrides: SpendingOverrideInput[];
  overrideWarnings: OverrideWarning[];
  surplusDestination: ProjectionInput['surplusDestination'];
}

export function initCoupleRunner(input: ProjectionInput): CoupleRunnerInit {
  if (!input.spouse) {
    throw new Error('Spouse data required for couple projection');
  }
  const spouse = input.spouse;
  // WR-07: Honor input.projectionStartYear when provided.
  const startYear = input.projectionStartYear ?? getCurrentYear();
  const primaryStartAge = ageAtEndOfYear(input.birthdate, startYear);
  const spouseStartAge = ageAtEndOfYear(spouse.birthdate, startYear);
  const primaryEndYear = startYear + (input.lifeExpectancy - primaryStartAge);
  const spouseEndYear = startYear + (spouse.lifeExpectancy - spouseStartAge);
  const endYear = Math.max(primaryEndYear, spouseEndYear);

  // TC-RRIF-018/019: honor primary rrif/lira/lif balances when provided.
  const primaryBalances = buildPersonBalancesLocal({
    rrsp: input.rrspBalance,
    rrif: input.rrifBalance ?? 0,
    lira: input.liraBalance ?? 0,
    lif: input.lifBalance ?? 0,
    ...(input.lifPriorYearReturnRate !== undefined && {
      lifPriorYearReturnRate: input.lifPriorYearReturnRate,
    }),
    tfsa: input.tfsaBalance,
    tfsaRestoredRoomFromPreviousYear: 0,
    nonReg: input.nonRegBalance,
    nonRegACB: input.nonRegACB ?? input.nonRegBalance,
  });
  const spouseBalances = buildPersonBalancesLocal({
    rrsp: spouse.rrspBalance,
    rrif: spouse.rrifBalance ?? 0,
    lira: spouse.liraBalance ?? 0,
    lif: spouse.lifBalance ?? 0,
    ...(spouse.lifPriorYearReturnRate !== undefined && {
      lifPriorYearReturnRate: spouse.lifPriorYearReturnRate,
    }),
    tfsa: spouse.tfsaBalance,
    tfsaRestoredRoomFromPreviousYear: 0,
    nonReg: spouse.nonRegBalance ?? 0,
    nonRegACB: spouse.nonRegACB ?? spouse.nonRegBalance ?? 0,
  });

  const maritalStatus: MaritalStatus = input.maritalStatus ?? 'married';
  const coupleSettings = input.coupleSettings ?? {
    optimizePensionSplitting: true,
    useYoungerSpouseForRRIF: false,
  };

  // M005/S02+S03 per-person contribution-room ledgers seeded with residency-
  // sliced TFSA baselines.
  const primaryTfsaBaseline = computeTfsaResidencyBaseline({
    birthdate: input.birthdate,
    ...(input.residencyStartYear !== undefined && {
      residencyStartYear: input.residencyStartYear,
    }),
    startYear,
  });
  const spouseTfsaBaseline = computeTfsaResidencyBaseline({
    birthdate: spouse.birthdate,
    ...(spouse.residencyStartYear !== undefined && {
      residencyStartYear: spouse.residencyStartYear,
    }),
    startYear,
  });
  const primaryLedger: ContributionRoomLedger = {
    rrsp: { roomAvailable: input.rrspUnusedRoomSeed ?? 0 },
    tfsa: { roomAvailable: primaryTfsaBaseline, cumulativeCapBaseline: primaryTfsaBaseline },
    fhsa: {
      annualRoomRemaining: FHSA_LIMITS.annualLimit,
      carryForwardAvailable: 0,
      lifetimeContributed: input.fhsaLifetimeContributedSeed ?? 0,
    },
  };
  const spouseLedger: ContributionRoomLedger = {
    rrsp: { roomAvailable: spouse.rrspUnusedRoomSeed ?? 0 },
    tfsa: { roomAvailable: spouseTfsaBaseline, cumulativeCapBaseline: spouseTfsaBaseline },
    fhsa: {
      annualRoomRemaining: FHSA_LIMITS.annualLimit,
      carryForwardAvailable: 0,
      lifetimeContributed: spouse.fhsaLifetimeContributedSeed ?? 0,
    },
  };

  // Phase 1 D-12 owner-filtered override slices (pre-Phase rows default to primary).
  const sortedWithdrawalOverrides = sortWithdrawalOverrides(input.withdrawalOverrides);
  const sortedSpendingOverrides = sortSpendingOverrides(input.spendingOverrides);
  const primaryWithdrawalOverrides = sortedWithdrawalOverrides.filter(
    (o) => (o.owner ?? 'primary') === 'primary'
  );
  const spouseWithdrawalOverrides = sortedWithdrawalOverrides.filter((o) => o.owner === 'spouse');
  const primarySpendingOverrides = sortedSpendingOverrides.filter(
    (o) => (o.owner ?? 'primary') === 'primary'
  );
  const spouseSpendingOverrides = sortedSpendingOverrides.filter((o) => o.owner === 'spouse');

  return {
    spouse,
    startYear,
    primaryEndYear,
    spouseEndYear,
    endYear,
    primaryBalances,
    spouseBalances,
    maritalStatus,
    coupleSettings,
    primaryLedger,
    spouseLedger,
    spousalRrspLedger: spouse.spousalRrspLedger ?? [],
    terminalTaxEvents: [],
    primaryWithdrawalOverrides,
    spouseWithdrawalOverrides,
    primarySpendingOverrides,
    spouseSpendingOverrides,
    overrideWarnings: [],
    surplusDestination: input.surplusDestination,
  };
}
