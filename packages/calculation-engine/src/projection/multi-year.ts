/**
 * Multi-Year Projection Engine
 * @see docs/source-of-truth/08-projection-engine.md
 */
import type {
  ProjectionInput,
  ProjectionOutput,
  YearlyResult,
  PersonYearlyResult,
  ProjectionSummary,
  CoupleYearlyResult,
  CoupleProjectionSummary,
  TerminalReturnResult,
} from '@retireops/shared';
import { ageAtEndOfYear } from '@retireops/shared';
import { computeRemediationPlan } from './funded-status.js';
import { getTFSAAnnualLimit } from '../accounts/tfsa.js';
import { calculateRRSPContributionRoom } from '../accounts/rrsp.js';
import {
  applyAccountGrowth,
  applyPersonAccountGrowth,
  type SingleBalancesSnapshot,
} from './orchestration/account-rollover.js';
import {
  updateContributionLedgersSingle,
  updateContributionLedgersPerson,
} from './orchestration/contribution-ledger-step.js';
import { calculateProjectionSummary as _calcSingleSummary } from './orchestration/projection-summary.js';
import { calculateCoupleProjectionSummary as _calcCoupleSummary } from './orchestration/couple-projection-summary.js';
import { aggregateEstateFromEvents } from './orchestration/estate-aggregation.js';
import {
  buildSingleYearInput,
  buildCouplePrimaryYearInput,
  buildCoupleSpouseYearInput,
} from './orchestration/year-input-builder.js';
import {
  takePreDeathSnapshot,
  applyInLoopPrimaryDeath,
  applyInLoopSpouseDeath,
  emitPostLoopPrimaryTerminal,
  emitPostLoopSpouseTerminal,
} from './orchestration/spouse-death-rollover.js';
import {
  applySpousalAttributionRecompute,
  appendSpousalRRSPLedgerEntry,
} from './orchestration/spousal-rrsp-attribution.js';
import { initSingleRunner, initCoupleRunner } from './orchestration/projection-runner-init.js';
import { buildSingleTerminalEvent } from './orchestration/single-terminal-event.js';
import { computeSurvivorCPPOverrides } from './orchestration/couple-survivor-cpp.js';
import { computeCouplePerYearDerivations } from './orchestration/couple-per-year-derivations.js';
import { calculateYear } from './yearly-calculator.js';
import { calculateCoupleYear, type CoupleYearInput } from './couple-calculator.js';

/**
 * Couple projection output with couple-specific results
 */
export interface CoupleProjectionOutput extends Omit<
  ProjectionOutput,
  'yearlyResults' | 'summary'
> {
  yearlyResults: CoupleYearlyResult[];
  summary: CoupleProjectionSummary;
  /**
   * Phase 2 D-32: per-person provenance-bearing result arrays, derived from
   * yearlyResults[i].primary / yearlyResults[i].spouse. Populated only when
   * the couple path emits at least one provenance sidecar entry.
   * Consumers that only need provenance data can iterate these flat arrays
   * instead of mapping over yearlyResults.
   *
   * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-33
   */
  personYearlyResults?: {
    primary: PersonYearlyResult[];
    spouse: PersonYearlyResult[];
  };
}

/**
 * Check if projection should run as couple projection
 */
function isCoupleProjection(input: ProjectionInput): boolean {
  const hasSpouse = input.spouse !== undefined;
  const isMarriedOrCommonLaw =
    input.maritalStatus === 'married' || input.maritalStatus === 'common_law';
  return hasSpouse && isMarriedOrCommonLaw;
}

/**
 * Run a complete retirement projection
 * Routes to single or couple projection based on input
 * @see docs/source-of-truth/08-projection-engine.md
 */
export function runProjection(input: ProjectionInput): ProjectionOutput | CoupleProjectionOutput {
  if (isCoupleProjection(input)) {
    return runCoupleProjection(input);
  }
  return runSingleProjection(input);
}

/**
 * Compute a single-person retirement projection — produces ProjectionOutput
 * with summary.remediationPlan === null by construction. Used both as the
 * binary-search callback inside computeRemediationPlan (where recursion
 * into the runSingleProjection wrapper would infinite-loop) and as the
 * implementation behind the runSingleProjection wrapper below.
 *
 * ENG-05: replaces the legacy single-path Core symbol; named
 * `computeSingleProjection` per ROADMAP Phase 10 success criterion #1.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 */
export function computeSingleProjection(input: ProjectionInput): ProjectionOutput {
  const init = initSingleRunner(input);
  const {
    startYear,
    endYear,
    primaryWithdrawalOverrides,
    primarySpendingOverrides,
    overrideWarnings,
    surplusDestination,
  } = init;
  let {
    rrspBalance,
    rrifBalance,
    tfsaBalance,
    nonRegBalance,
    nonRegACB,
    tfsaRestoredRoomFromPreviousYear,
    ledger,
  } = init;

  const yearlyResults: YearlyResult[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearsFromStart = year - startYear;

    // Calculate employment income with growth
    const age = ageAtEndOfYear(input.birthdate, year);
    const isPreRetirement = age < input.retirementAge;
    const employmentIncome = isPreRetirement
      ? input.employmentIncome * Math.pow(1 + input.employmentGrowthRate, yearsFromStart)
      : 0;
    const availableTfsaContributionRoom =
      getTFSAAnnualLimit(year) + tfsaRestoredRoomFromPreviousYear;

    // RRSP contribution room for this year: based on prior year's earned income (employment
    // income is the primary earned income source in this projection model).
    // For year 1, use the current-year employment income as the prior-year proxy.
    const priorYearEarnedIncome =
      yearsFromStart === 0
        ? input.employmentIncome
        : input.employmentIncome * Math.pow(1 + input.employmentGrowthRate, yearsFromStart - 1);

    // M005/S02: compute available RRSP room as ledger carry + PA-adjusted current-year accrual.
    // Baseline parity with pre-S02 holds when pensionAdjustment is 0 (currentYearAccrual matches
    // calculateRRSPContributionRoom(priorYearEarnedIncome, rrspCarryForwardRoom, year) because
    // ledger.rrsp.roomAvailable tracks the prior carry-forward that the old helper consumed).
    const pensionAdjustment = input.pensionAdjustment ?? 0;
    const currentYearAccrual = calculateRRSPContributionRoom(priorYearEarnedIncome, 0, year);
    const paAdjustedAccrual = Math.max(0, currentYearAccrual - pensionAdjustment);
    const availableRRSPRoom = ledger.rrsp.roomAvailable + paAdjustedAccrual;
    // Capped value drives the balance-update path (engine's actual deposit) and preserves
    // baseline parity. The ledger is fed the user's uncapped request so CRA-style penalty
    // surfaces when intended contribution exceeds room + $2000 buffer (M005/S02).
    const requestedRRSPContribution = isPreRetirement ? input.rrspAnnualContribution : 0;
    const cappedRRSPContribution = Math.min(requestedRRSPContribution, availableRRSPRoom);

    const yearInput = buildSingleYearInput({
      input,
      year,
      age,
      isPreRetirement,
      yearsFromStart,
      rrspBalance,
      rrifBalance,
      tfsaBalance,
      nonRegBalance,
      nonRegACB,
      cappedRRSPContribution,
      availableTfsaContributionRoom,
      employmentIncome,
      primaryWithdrawalOverrides,
      primarySpendingOverrides,
      surplusDestination,
      overrideWarnings,
    });

    let result = calculateYear(yearInput);

    // M005/S02 K006 final-merge: advance the contribution-room ledger and surface
    // ledger diagnostics onto the yearly result before push. The ledger sees the
    // user's uncapped requested contribution so over-buffer scenarios trigger
    // penalty + warning while the engine's balance update stays capped at room.
    // Single and couple paths now surface identical ledger diagnostics; the
    // shape differs only in the row type each path operates on.
    const ledgerStep = updateContributionLedgersSingle(
      ledger,
      {
        year,
        person: 'primary',
        earnedIncome: priorYearEarnedIncome,
        pensionAdjustment,
        rrspContribution: requestedRRSPContribution,
        tfsaContribution: input.tfsaAnnualContribution,
        fhsaContribution: input.fhsaAnnualContribution ?? 0,
        ...(input.residencyStartYear !== undefined && {
          residencyStartYear: input.residencyStartYear,
        }),
        rrspRoomAvailableForRow: availableRRSPRoom,
      },
      result
    );
    ledger = ledgerStep.newLedger;
    // K020 conditional assignment: do not emit empty arrays or zero-penalty objects.
    // TFSA penalty/warnings are intentionally dropped on the single path per
    // the DEFERRED(v4.4) block above — the RRSP-only filter inside
    // updateContributionLedgersSingle preserves S02 semantics until v4.4.
    result = ledgerStep.result;

    yearlyResults.push(result);

    // CORR-02 / LIMS-01b: pro-rata reduce ACB by withdrawal fraction of the
    // START-of-year (pre-withdrawal) balance BEFORE reassigning nonRegBalance.
    // Growth does not affect ACB; only withdrawals do (CRA pro-rata rule).
    // Encapsulated by applyAccountGrowth — see orchestration/account-rollover.ts.
    // @see docs/source-of-truth/04-tax-engine.md - capital gains inclusion rate
    // @see docs/source-of-truth/02-account-types.md - ACB pro-rata reduction
    const next: SingleBalancesSnapshot = applyAccountGrowth(nonRegBalance, nonRegACB, result);
    rrspBalance = next.rrspBalance;
    rrifBalance = next.rrifBalance;
    tfsaBalance = next.tfsaBalance;
    nonRegBalance = next.nonRegBalance;
    nonRegACB = next.nonRegACB;
    tfsaRestoredRoomFromPreviousYear = next.tfsaRestoredRoomFromPreviousYear;
  }

  // Calculate summary
  const summary = _calcSingleSummary(yearlyResults, input);

  // SPD-04: compute legacyTargetMet after final year loop (25-CONTEXT.md D-03)
  const finalNetWorth = yearlyResults[yearlyResults.length - 1]?.totalNetWorth ?? 0;
  const legacyTargetMet =
    input.legacyTarget !== undefined ? finalNetWorth >= input.legacyTarget : null;

  // M004/S02: terminal-return deemed-disposition event at endYear (single path
  // has no spouse by construction). Pure spike at marginal rates with
  // ordinary-income inputs = 0 — non-overlapping with accumulated totalTaxesPaid.
  // See orchestration/single-terminal-event.ts.
  const terminalEvent: TerminalReturnResult = buildSingleTerminalEvent({
    input,
    startYear,
    endYear,
    rrspBalance,
    rrifBalance,
    tfsaBalance,
    nonRegBalance,
    nonRegACB,
  });

  const estate = aggregateEstateFromEvents([terminalEvent]);
  if (estate) {
    summary.grossEstate = estate.grossEstate;
    summary.terminalTaxes = estate.terminalTaxes;
    summary.netEstate = estate.netEstate;
  }

  return {
    id: crypto.randomUUID(),
    input,
    yearlyResults,
    legacyTargetMet,
    summary,
    terminalTaxEvents: [terminalEvent],
    // ENG-01: surface accumulated override warnings; OMIT the field entirely when
    // empty — additive invariant: pre-Phase-1 scenarios must be byte-identical (A1, criterion #5).
    ...(overrideWarnings.length > 0 ? { warnings: overrideWarnings } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Run a single-person retirement projection.
 *
 * Wraps computeSingleProjection with Phase 49 Red-state remediation wiring.
 * Green/Yellow projections incur zero additional overhead (REGR-011).
 *
 * @see docs/source-of-truth/08-projection-engine.md
 * @see .specify/specs/007-funded-indicator/spec.md — FR-006/FR-007/FR-008
 */
export function runSingleProjection(input: ProjectionInput): ProjectionOutput {
  const output = computeSingleProjection(input);

  // Phase 49: populate remediationPlan only for Red-state projections.
  // The binary-search callback is computeSingleProjection (NOT runSingleProjection)
  // to avoid infinite recursion — the bare compute variant skips this branch entirely.
  if (output.summary.fundedStatus.state === 'red') {
    output.summary.remediationPlan = computeRemediationPlan(
      input,
      output.summary.fundedStatus,
      computeSingleProjection
    );
  }

  return output;
}

/**
 * Calculate projection summary metrics — re-exported from
 * orchestration/projection-summary.ts so the public surface (ENG-05 must-have
 * key-link) stays anchored at this module.
 *
 * @see docs/source-of-truth/09-success-metrics.md
 */
export { calculateProjectionSummary } from './orchestration/projection-summary.js';

/**
 * Apply FIFO attribution rules to a spousal RRSP withdrawal — re-exported from
 * orchestration/spousal-rrsp-attribution.ts so the public surface stays
 * anchored at this module (ENG-05 must-have).
 *
 * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
 */
export { applyFifoAttribution } from './orchestration/spousal-rrsp-attribution.js';

/**
 * Compute a couple retirement projection — produces CoupleProjectionOutput
 * with household-summary remediationPlan === null by construction. Used
 * both as the binary-search callback (via adapter) inside the remediation
 * branch and as the implementation behind the runCoupleProjection wrapper.
 *
 * ENG-05: replaces the legacy couple-path Core symbol; named
 * `computeCoupleProjection` per ROADMAP Phase 10 success criterion #1.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 */
export function computeCoupleProjection(input: ProjectionInput): CoupleProjectionOutput {
  const init = initCoupleRunner(input);
  const {
    spouse,
    startYear,
    primaryEndYear,
    spouseEndYear,
    endYear,
    maritalStatus,
    coupleSettings,
    spousalRrspLedger,
    terminalTaxEvents,
    primaryWithdrawalOverrides,
    spouseWithdrawalOverrides,
    primarySpendingOverrides,
    spouseSpendingOverrides,
    overrideWarnings,
    surplusDestination,
  } = init;
  let { primaryBalances, spouseBalances, primaryLedger, spouseLedger } = init;

  const yearlyResults: CoupleYearlyResult[] = [];

  // Survivor state tracking (Edge Case 3): track last-known CPP for survivor
  // benefit calc and whether the post-death asset rollover has fired.
  let lastKnownPrimaryCPP = 0;
  let lastKnownSpouseCPP = 0;
  let primaryDeathRolloverDone = false;
  let spouseDeathRolloverDone = false;

  for (let year = startYear; year <= endYear; year++) {
    const yearsFromStart = year - startYear;

    // Calculate ages
    const primaryAge = ageAtEndOfYear(input.birthdate, year);
    const spouseAge = ageAtEndOfYear(spouse.birthdate, year);

    // Determine survivor mode: a spouse is "deceased" once we pass their life expectancy year
    // @see docs/source-of-truth/05-government-benefits.md - CPP Survivor Benefits
    const primaryDeceased = year > primaryEndYear;
    const spouseDeceased = year > spouseEndYear;

    // M004/S02 T02: snapshot pre-rollover balances so the terminal-return
    // hook below sees each decedent's OWN pre-rollover estate. Must be
    // taken BEFORE the rollover branches mutate primaryBalances/spouseBalances.
    const primaryPreDeathSnapshot = takePreDeathSnapshot(primaryBalances);
    const spousePreDeathSnapshot = takePreDeathSnapshot(spouseBalances);

    /**
     * Post-death asset rollover (one-time transfer on the first year after death)
     * When a spouse dies, their remaining RRSP/RRIF/TFSA/non-reg assets transfer to
     * the surviving spouse (Canadian spousal rollover rules).
     * @see docs/source-of-truth/02-account-types.md - Spousal RRSP/RRIF Rollover
     */
    if (primaryDeceased && !primaryDeathRolloverDone) {
      const r = applyInLoopPrimaryDeath({
        input,
        startYear,
        primaryEndYear,
        spouseDeceased,
        primaryPreDeathSnapshot,
        primaryBalances,
        spouseBalances,
      });
      terminalTaxEvents.push(r.terminalEvent);
      primaryBalances = r.primaryBalances;
      spouseBalances = r.spouseBalances;
      primaryDeathRolloverDone = true;
    }

    if (spouseDeceased && !spouseDeathRolloverDone) {
      const r = applyInLoopSpouseDeath({
        input,
        spouse,
        startYear,
        spouseEndYear,
        primaryDeceased,
        spousePreDeathSnapshot,
        primaryBalances,
        spouseBalances,
      });
      terminalTaxEvents.push(r.terminalEvent);
      primaryBalances = r.primaryBalances;
      spouseBalances = r.spouseBalances;
      spouseDeathRolloverDone = true;
    }

    const primaryIsPreRetirement = primaryAge < input.retirementAge;
    const spouseIsPreRetirement = spouseAge < spouse.retirementAge;

    // Per-iteration employment + RRSP-room derivations (M005/S02 spousal routing).
    const {
      primaryEmploymentIncome,
      spouseEmploymentIncome,
      primaryPriorYearEarned,
      spousePriorYearEarned,
      pensionAdjustmentPrimary,
      pensionAdjustmentSpouse,
      primaryAvailableRRSPRoom,
      spouseAvailableRRSPRoom,
      requestedPrimaryTotal,
      requestedSpousePersonalRRSP,
      cappedSpousalPart,
      primaryCappedRRSP,
      spouseCappedRRSP,
    } = computeCouplePerYearDerivations({
      input,
      spouse,
      yearsFromStart,
      year,
      primaryDeceased,
      spouseDeceased,
      primaryIsPreRetirement,
      spouseIsPreRetirement,
      primaryLedger,
      spouseLedger,
    });

    // Survivor CPP override (Edge Case 3): when one spouse dies the survivor
    // receives a survivor benefit. See orchestration/couple-survivor-cpp.ts.
    const { survivorCPPAt65ForPrimary, survivorCPPAt65ForSpouse } = computeSurvivorCPPOverrides({
      input,
      spouse,
      year,
      primaryDeceased,
      spouseDeceased,
      lastKnownPrimaryCPP,
      lastKnownSpouseCPP,
    });

    // FIX-04: per-person spending is half of household target when sharedRetirementSpending is set
    const perPersonSpending =
      coupleSettings.sharedRetirementSpending !== undefined
        ? coupleSettings.sharedRetirementSpending / 2
        : input.retirementSpending;

    // Pre-compute per-spouse TFSA room (consumed by both year-input builder
    // and the existing couple-input shape below).
    const availableTfsaContributionRoomPrimary =
      getTFSAAnnualLimit(year) + primaryBalances.tfsaRestoredRoomFromPreviousYear;
    const availableTfsaContributionRoomSpouse =
      getTFSAAnnualLimit(year) + spouseBalances.tfsaRestoredRoomFromPreviousYear;

    // Build couple year input — deceased spouses get zeroed accounts/income
    const coupleYearInput: CoupleYearInput = {
      year,
      // After a death, the surviving spouse files as single (no more marital benefits/splitting)
      maritalStatus: primaryDeceased || spouseDeceased ? 'single' : maritalStatus,
      primary: buildCouplePrimaryYearInput({
        input,
        year,
        primaryAge,
        yearsFromStart,
        primaryDeceased,
        primaryBalances,
        primaryCappedRRSP,
        primaryEmploymentIncome,
        perPersonSpending,
        survivorCPPAt65ForPrimary,
        availableTfsaContributionRoomPrimary,
        primaryWithdrawalOverrides,
        primarySpendingOverrides,
        surplusDestination,
        overrideWarnings,
      }),
      spouse: buildCoupleSpouseYearInput({
        input,
        spouse,
        year,
        spouseAge,
        yearsFromStart,
        spouseDeceased,
        spouseBalances,
        spouseCappedRRSP,
        spouseEmploymentIncome,
        perPersonSpending,
        survivorCPPAt65ForSpouse,
        availableTfsaContributionRoomSpouse,
        spouseWithdrawalOverrides,
        spouseSpendingOverrides,
        overrideWarnings,
      }),
      // After a death, don't use shared spending — survivor covers their own costs
      ...(!primaryDeceased &&
        !spouseDeceased &&
        coupleSettings.sharedRetirementSpending !== undefined && {
          sharedRetirementSpending: coupleSettings.sharedRetirementSpending,
        }),
      // No pension splitting after a death — surviving spouse files single
      optimizePensionSplitting:
        primaryDeceased || spouseDeceased ? false : coupleSettings.optimizePensionSplitting,
      // No younger-spouse RRIF election after spouse death — owner's own age applies
      useYoungerSpouseForRRIF: spouseDeceased ? false : coupleSettings.useYoungerSpouseForRRIF,
      // TAX-03: thread user-chosen fixed income splitting from ProjectionInput into the year calc
      ...(input.incomeSplitting !== undefined && { incomeSplitting: input.incomeSplitting }),
      // Household spending mode — pools unfunded shortfall across spouses when 'household'.
      // Absent / 'per-owner' preserves the existing per-spouse independence.
      ...(input.householdSpendingMode !== undefined && {
        householdSpendingMode: input.householdSpendingMode,
      }),
    };

    let result = calculateCoupleYear(coupleYearInput);

    /**
     * Spousal RRSP Attribution (Edge Case 2): FIFO consumption + tax recompute.
     * Returns the patched result when attribution applied; falls through otherwise.
     * @see orchestration/spousal-rrsp-attribution.ts (CORR-03 / SCEN-07 / VR-RRSP-003)
     */
    const attributionPatched = applySpousalAttributionRecompute({
      spousalRrspLedger,
      spouseBalances,
      result,
      year,
      primaryProvince: input.province,
      spouseProvince: spouse.province ?? input.province,
    });
    if (attributionPatched !== undefined) result = attributionPatched;

    // M005/S02: advance each person's contribution-room ledger. Primary's ledger
    // sees the uncapped combined total (personal + spousal) so over-buffer surfaces
    // as a CRA-style penalty; spouse's ledger sees only their own personal request.
    // Surface diagnostics (rrspContributionRoom / tfsaContributionRoom /
    // fhsaContributionRoom / overContributionPenalty / ledgerWarnings) onto the
    // PersonYearlyResult rows via updateContributionLedgersPerson — see
    // orchestration/contribution-ledger-step.ts for the K006 merge.
    const primaryStep = updateContributionLedgersPerson(
      primaryLedger,
      {
        year,
        person: 'primary',
        earnedIncome: primaryPriorYearEarned,
        pensionAdjustment: pensionAdjustmentPrimary,
        rrspContribution: requestedPrimaryTotal,
        tfsaContribution: input.tfsaAnnualContribution,
        fhsaContribution: input.fhsaAnnualContribution ?? 0,
        ...(input.residencyStartYear !== undefined && {
          residencyStartYear: input.residencyStartYear,
        }),
        rrspRoomAvailableForRow: primaryAvailableRRSPRoom,
      },
      result.primary
    );
    primaryLedger = primaryStep.newLedger;

    const spouseStep = updateContributionLedgersPerson(
      spouseLedger,
      {
        year,
        person: 'spouse',
        earnedIncome: spousePriorYearEarned,
        pensionAdjustment: pensionAdjustmentSpouse,
        rrspContribution: requestedSpousePersonalRRSP,
        tfsaContribution: spouse.tfsaAnnualContribution ?? 0,
        fhsaContribution: spouse.fhsaAnnualContribution ?? 0,
        ...(spouse.residencyStartYear !== undefined && {
          residencyStartYear: spouse.residencyStartYear,
        }),
        rrspRoomAvailableForRow: spouseAvailableRRSPRoom,
      },
      result.spouse
    );
    spouseLedger = spouseStep.newLedger;

    // Spousal routing: whenever primary actually deposits into the spouse's RRSP
    // this year, append to the existing M001/S03 FIFO ledger so subsequent
    // spouse withdrawals attribute back to primary (3-year rule).
    appendSpousalRRSPLedgerEntry(spousalRrspLedger, year, cappedSpousalPart);

    result = {
      ...result,
      primary: primaryStep.result,
      spouse: spouseStep.result,
    };

    yearlyResults.push(result);

    // Track CPP for survivor benefit calculation in future years
    if (!primaryDeceased && result.primary.cppIncome > 0) {
      lastKnownPrimaryCPP = result.primary.cppIncome;
    }
    if (!spouseDeceased && result.spouse.cppIncome > 0) {
      lastKnownSpouseCPP = result.spouse.cppIncome;
    }

    // CORR-02 / LIMS-01b: pro-rata reduce each person's nonRegACB by their
    // withdrawal fraction of the START-of-year (pre-withdrawal) balance, then
    // carry next-year balances (including conditional LIF prior-year-return-rate).
    // Encapsulated by applyPersonAccountGrowth — see orchestration/account-rollover.ts.
    // Deceased spouse balances stay at 0 because their result row carries 0 balances.
    // @see docs/source-of-truth/04-tax-engine.md - capital gains inclusion rate
    // @see docs/source-of-truth/02-account-types.md - ACB pro-rata reduction
    primaryBalances = applyPersonAccountGrowth(
      primaryBalances,
      {
        rrspBalance: result.primary.rrspBalance,
        rrifBalance: result.primary.rrifBalance,
        liraBalance: result.primary.liraBalance ?? 0,
        lifBalance: result.primary.lifBalance ?? 0,
        isLIFConversionYear: result.primary.isLIFConversionYear,
        tfsaBalance: result.primary.tfsaBalance,
        tfsaWithdrawal: result.primary.tfsaWithdrawal,
        nonRegBalance: result.primary.nonRegBalance,
        nonRegWithdrawal: result.primary.nonRegWithdrawal,
      },
      input.investmentReturn
    );

    spouseBalances = applyPersonAccountGrowth(
      spouseBalances,
      {
        rrspBalance: result.spouse.rrspBalance,
        rrifBalance: result.spouse.rrifBalance,
        liraBalance: result.spouse.liraBalance ?? 0,
        lifBalance: result.spouse.lifBalance ?? 0,
        isLIFConversionYear: result.spouse.isLIFConversionYear,
        tfsaBalance: result.spouse.tfsaBalance,
        tfsaWithdrawal: result.spouse.tfsaWithdrawal,
        nonRegBalance: result.spouse.nonRegBalance,
        nonRegWithdrawal: result.spouse.nonRegWithdrawal,
      },
      input.investmentReturn
    );
  }

  // M004/S02 T02: post-loop terminal-return hook for decedents whose death
  // branch never fired inside the loop — namely the longest-lived spouse
  // (loop exits at year = max(endYears), one short of the branch trigger
  // `year > endYear`) and same-year-dual-death (branches require another loop
  // iteration the loop bound precludes). Emits events using each person's
  // remaining balances (for a single survivor these include rolled-in inherited
  // assets; for same-year dual-death each reads their OWN uncontaminated
  // balances because no branch fired). hasSurvivingSpouse mirrors the branch
  // logic at the hypothetical `year = endYear + 1` step.
  const postLoopYear = endYear + 1;
  const primaryDeceasedPostLoop = postLoopYear > primaryEndYear;
  const spouseDeceasedPostLoop = postLoopYear > spouseEndYear;

  if (primaryDeceasedPostLoop && !primaryDeathRolloverDone) {
    terminalTaxEvents.push(
      emitPostLoopPrimaryTerminal({
        input,
        startYear,
        primaryEndYear,
        spouseDeceasedPostLoop,
        primaryBalances,
      })
    );
    primaryDeathRolloverDone = true;
  }

  if (spouseDeceasedPostLoop && !spouseDeathRolloverDone) {
    terminalTaxEvents.push(
      emitPostLoopSpouseTerminal({
        input,
        spouse,
        startYear,
        spouseEndYear,
        primaryDeceasedPostLoop,
        spouseBalances,
      })
    );
    spouseDeathRolloverDone = true;
  }

  // Calculate couple summary
  const summary = _calcCoupleSummary(yearlyResults, input);

  const coupleEstate = aggregateEstateFromEvents(terminalTaxEvents);
  if (coupleEstate) {
    summary.grossEstate = coupleEstate.grossEstate;
    summary.terminalTaxes = coupleEstate.terminalTaxes;
    summary.netEstate = coupleEstate.netEstate;
  }

  // SPD-04: compute legacyTargetMet after final year loop (25-CONTEXT.md D-03)
  const finalCouplNetWorth = yearlyResults[yearlyResults.length - 1]?.householdNetWorth ?? 0;
  const coupleLegacyTargetMet =
    input.legacyTarget !== undefined ? finalCouplNetWorth >= input.legacyTarget : null;

  // Phase 2 D-32: build flat per-person arrays for provenance consumers.
  // Derived from yearlyResults so the data is always consistent with the
  // couple rows; populated only when at least one row has a provenance sidecar.
  const primaryPersonRows: PersonYearlyResult[] = yearlyResults.map((r) => r.primary);
  const spousePersonRows: PersonYearlyResult[] = yearlyResults.map((r) => r.spouse);
  const hasAnyPersonProvenance =
    primaryPersonRows.some((r) => r.provenance !== undefined) ||
    spousePersonRows.some((r) => r.provenance !== undefined);

  return {
    id: crypto.randomUUID(),
    input,
    yearlyResults,
    legacyTargetMet: coupleLegacyTargetMet,
    summary,
    terminalTaxEvents,
    // ENG-01: surface accumulated override warnings; OMIT the field entirely when
    // empty — additive invariant: pre-Phase-1 scenarios must be byte-identical.
    // Mirrors computeSingleProjection behavior.
    ...(overrideWarnings.length > 0 ? { warnings: overrideWarnings } : {}),
    // Phase 2 D-32: emit per-person arrays only when provenance is present (D-36).
    ...(hasAnyPersonProvenance && {
      personYearlyResults: { primary: primaryPersonRows, spouse: spousePersonRows },
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Run a couple retirement projection.
 *
 * Wraps computeCoupleProjection with Phase 49 Red-state remediation wiring.
 * The household funded status is classified once; on Red, a binary search
 * computes the three remediation levers using the *Core runner (via a
 * household adapter) to avoid infinite recursion.
 *
 * @see .specify/specs/007-funded-indicator/spec.md — FR-006/FR-007/FR-008/FR-012
 */
export function runCoupleProjection(input: ProjectionInput): CoupleProjectionOutput {
  const output = computeCoupleProjection(input);

  if (output.summary.fundedStatus.state === 'red') {
    // Adapter: computeCoupleProjection returns CoupleProjectionOutput, but
    // computeRemediationPlan expects (input) => ProjectionOutput. Project the
    // household yearly results into the ProjectionOutput shape. The adapter
    // empty-casts `summary` because computeRemediationPlan only reads
    // output.yearlyResults via computeFundedStatus — it never touches summary.
    const coupleRunAdapter = (mutatedInput: ProjectionInput): ProjectionOutput => {
      const coupleOutput = computeCoupleProjection(mutatedInput);
      const householdYearlyResults: YearlyResult[] = coupleOutput.yearlyResults.map((r) => ({
        ...r.primary,
        totalNetWorth: r.householdNetWorth,
        totalIncome: r.primary.totalGrossIncome,
      }));
      return {
        id: coupleOutput.id,
        input: mutatedInput,
        yearlyResults: householdYearlyResults,
        legacyTargetMet: null,
        // summary is intentionally an empty cast — computeRemediationPlan
        // does not read it. See data-model.md §Exported functions.
        summary: {} as ProjectionSummary,
        createdAt: coupleOutput.createdAt,
        updatedAt: coupleOutput.updatedAt,
      };
    };

    output.summary.remediationPlan = computeRemediationPlan(
      input,
      output.summary.fundedStatus,
      coupleRunAdapter
    );
  }

  return output;
}

/**
 * Calculate couple projection summary metrics — re-exported from
 * orchestration/couple-projection-summary.ts so the public surface stays anchored
 * at this module (ENG-05 must-have key-link).
 *
 * @see docs/source-of-truth/09-success-metrics.md
 */
export { calculateCoupleProjectionSummary } from './orchestration/couple-projection-summary.js';
