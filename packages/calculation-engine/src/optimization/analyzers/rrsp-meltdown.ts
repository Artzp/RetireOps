/**
 * RRSP Meltdown Strategy Analyzer
 *
 * Identifies low-tax-rate years between retirement and age 71,
 * calculates optimal voluntary withdrawal amounts to fill the
 * lowest available federal tax brackets, with OAS clawback
 * net-benefit gating.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md — RRSP Meltdown
 * @see REQUIREMENTS.md — MLT-01, MLT-02, MLT-03
 */
import type {
  AccountOwner,
  InsightCard,
  PersonYearlyResult,
  YearlyResult,
} from '@retireops/shared';
import type { OptimizationInput, MeltdownSchedule } from '../types.js';
import { getFederalTaxBrackets, getFederalMarginalRate } from '../../tax/federal-tax.js';
import { getOASClawbackThreshold } from '../../tax/oas-clawback.js';
import { cloneProjectionInput } from '../../projection/clone.js';
import { runProjection } from '../../projection/multi-year.js';

/**
 * Compute the space remaining in the current federal tax bracket
 * for the given net income and year.
 *
 * Uses `<=` comparison consistent with `getFederalMarginalRate` to find
 * the bracket the user currently occupies.
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-MLT-001
 */
function computeBracketSpace(baselineNetIncome: number, year: number): number {
  const brackets = getFederalTaxBrackets(year);
  for (const bracket of brackets) {
    if (baselineNetIncome <= bracket.max) {
      // Income lands in this bracket; space = room to top of bracket
      return Math.max(0, bracket.max - baselineNetIncome);
    }
  }
  return 0; // Above all brackets — no space (top bracket has Infinity max)
}

/**
 * Compute the OAS clawback cost if meltdownAmount is added on top of netIncome.
 * Applies the 15% clawback rate to income exceeding the threshold.
 *
 * @see docs/source-of-truth/04-tax-engine.md — OAS Clawback (Recovery Tax)
 * @see REQUIREMENTS.md — MLT-03
 */
function computeOASClawbackCost(
  baselineNetIncome: number,
  meltdownAmount: number,
  year: number
): number {
  const threshold = getOASClawbackThreshold(year);
  const excessAboveThreshold = Math.max(0, baselineNetIncome + meltdownAmount - threshold);
  return excessAboveThreshold * 0.15;
}

/**
 * Analyze the RRSP meltdown opportunity for the given projection.
 *
 * Returns an InsightCard describing the optimal voluntary withdrawal schedule
 * and estimated lifetime tax savings, or null when:
 * - No RRSP balance exists (CARD-03)
 * - No eligible retirement years before age 71 produce a non-zero withdrawal
 * - The what-if projection produces no lifetime savings
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-MLT-001, TC-OPT-MLT-002, TC-OPT-MLT-003, TC-OPT-MLT-004
 */
type MeltdownPersonRow = {
  year: number;
  age: number;
  isRetired: boolean;
  rrspBalance: number;
  taxCalculation: { netIncome: number };
};

function primaryRowsFromYearlyResults(rows: YearlyResult[]): MeltdownPersonRow[] {
  return rows.map((yr) => ({
    year: yr.year,
    age: yr.age,
    isRetired: yr.isRetired,
    rrspBalance: yr.rrspBalance,
    taxCalculation: yr.taxCalculation,
  }));
}

function personRowsFromCouple(
  rows: { primary: PersonYearlyResult; spouse: PersonYearlyResult }[] | undefined,
  owner: AccountOwner
): MeltdownPersonRow[] {
  if (rows === undefined) return [];
  return rows.map((yr) => {
    const person = owner === 'primary' ? yr.primary : yr.spouse;
    return {
      year: person.year,
      age: person.age,
      isRetired: person.isRetired,
      rrspBalance: person.rrspBalance,
      taxCalculation: person.taxCalculation,
    };
  });
}

function analyzeOwnerRRSPMeltdown(
  input: OptimizationInput,
  owner: AccountOwner,
  rows: MeltdownPersonRow[],
  startingBalance: number
): InsightCard | null {
  const { baselineOutput, clonedInput } = input;
  const isCoupleProjection = clonedInput.spouse !== undefined;

  // CARD-03: Skip analysis when user has no RRSP balance
  if (startingBalance <= 0) {
    return null;
  }

  // Track running RRSP balance — start from the clonedInput rrspBalance
  // Each year's withdrawal reduces the running balance for subsequent years.
  // We use yr.rrspBalance as a conservative lower-bound cap (per RESEARCH Pitfall 4).
  let runningRrspBalance = startingBalance;

  const schedule: MeltdownSchedule[] = [];

  // MLT-01: Iterate retirement years before age 71 (meltdown window)
  for (const yr of rows) {
    // Only retired years before age 71 are eligible
    // age < 71: RRIF conversion happens at 71, meltdown ends at 70 (RESEARCH Pitfall 3)
    if (!yr.isRetired || yr.age >= 71) {
      continue;
    }

    // Stop once RRSP is exhausted
    if (runningRrspBalance <= 0) {
      break;
    }

    const baselineNetIncome = yr.taxCalculation.netIncome;
    const year = yr.year;

    // Compute space in current bracket using getFederalTaxBrackets (success criteria 5)
    const bracketSpace = computeBracketSpace(baselineNetIncome, year);

    // Skip year if no bracket space available (income is at or above bracket max)
    if (bracketSpace <= 0) {
      continue;
    }

    // Cap withdrawal to remaining RRSP balance (also cap to yr.rrspBalance as conservative lower bound)
    const maxWithdrawal = Math.min(runningRrspBalance, yr.rrspBalance);
    const proposedWithdrawal = Math.min(bracketSpace, maxWithdrawal);

    if (proposedWithdrawal <= 0) {
      continue;
    }

    // MLT-03: OAS clawback net-benefit gate
    // Exclude year when clawback cost exceeds bracket-fill tax savings
    const clawbackCost = computeOASClawbackCost(baselineNetIncome, proposedWithdrawal, year);
    const marginalRateBefore = getFederalMarginalRate(baselineNetIncome, year);
    const taxSavings = proposedWithdrawal * marginalRateBefore;

    if (clawbackCost > taxSavings) {
      // Clawback cost exceeds savings — exclude this year (MLT-03)
      continue;
    }

    const marginalRateAfter = getFederalMarginalRate(baselineNetIncome + proposedWithdrawal, year);

    schedule.push({
      year,
      voluntaryWithdrawal: Math.round(proposedWithdrawal),
      marginalRateBefore,
      marginalRateAfter,
    });

    // Reduce running balance
    runningRrspBalance -= proposedWithdrawal;
  }

  // Empty schedule guard
  if (schedule.length === 0) {
    return null;
  }

  // MLT-02: What-if projection comparison
  // Clone input and inject meltdown config using average withdrawal as approximation
  const totalWithdrawals = schedule.reduce((sum, s) => sum + s.voluntaryWithdrawal, 0);
  const avgWithdrawal = Math.round(totalWithdrawals / schedule.length);
  const firstScheduleEntry = schedule[0];
  const lastScheduleEntry = schedule[schedule.length - 1];

  if (firstScheduleEntry === undefined || lastScheduleEntry === undefined) {
    return null;
  }

  const whatIfInput = cloneProjectionInput(clonedInput);

  if (isCoupleProjection) {
    whatIfInput.withdrawalOverrides = [
      ...(whatIfInput.withdrawalOverrides ?? []),
      ...schedule.map((entry) => ({
        field: 'rrsp' as const,
        year: entry.year,
        amount: entry.voluntaryWithdrawal,
        applyForward: false,
        owner,
      })),
    ];
  } else {
    whatIfInput.rrspMeltdown = {
      enabled: true,
      annualAmount: avgWithdrawal,
      startYear: firstScheduleEntry.year,
      endYear: lastScheduleEntry.year,
    };
  }

  const whatIfOutput = runProjection(whatIfInput);
  const lifetimeSavings = Math.round(
    baselineOutput.summary.totalTaxesPaid - whatIfOutput.summary.totalTaxesPaid
  );

  // Negative savings guard: meltdown must produce net positive savings
  if (lifetimeSavings <= 0) {
    return null;
  }

  const explanation =
    `Withdrawing an average of $${avgWithdrawal.toLocaleString('en-CA')} per year from ${isCoupleProjection ? `${owner === 'primary' ? 'the primary' : 'the spouse'} RRSP` : 'your RRSP'} ` +
    `over ${String(schedule.length)} year${schedule.length !== 1 ? 's' : ''} before mandatory RRIF withdrawals begin ` +
    `could save an estimated $${lifetimeSavings.toLocaleString('en-CA')} in lifetime taxes ` +
    `by filling lower tax brackets now instead of paying higher rates later.`;

  return {
    module: 'rrsp-meltdown',
    title: isCoupleProjection
      ? `RRSP Meltdown Strategy — ${owner === 'primary' ? 'Primary' : 'Spouse'}`
      : 'RRSP Meltdown Strategy',
    recommendedAction:
      `Withdraw about $${avgWithdrawal.toLocaleString('en-CA')} per year from ` +
      `${isCoupleProjection ? `${owner === 'primary' ? 'the primary' : 'the spouse'} RRSP` : 'your RRSP'} ` +
      `from ${String(firstScheduleEntry.year)} through ${String(lastScheduleEntry.year)}.`,
    whyItHelps:
      'This fills lower tax brackets before mandatory RRIF withdrawals begin, reducing the chance that the same registered savings are taxed at higher rates later.',
    affectedYears: schedule.map((entry) => entry.year),
    estimatedAnnualSavings: Math.round(lifetimeSavings / schedule.length),
    appliesTo: isCoupleProjection ? owner : 'primary',
    explanation,
    estimatedDollarImpact: lifetimeSavings,
    confidence: schedule.length >= 3 ? 'HIGH' : 'MEDIUM',
  };
}

export function analyzeRRSPMeltdown(input: OptimizationInput): InsightCard | InsightCard[] | null {
  const { baselineOutput, clonedInput, coupleYearlyResults } = input;

  if (clonedInput.spouse !== undefined) {
    const cards = [
      analyzeOwnerRRSPMeltdown(
        input,
        'primary',
        personRowsFromCouple(coupleYearlyResults, 'primary'),
        clonedInput.rrspBalance
      ),
      analyzeOwnerRRSPMeltdown(
        input,
        'spouse',
        personRowsFromCouple(coupleYearlyResults, 'spouse'),
        clonedInput.spouse.rrspBalance
      ),
    ].filter((card): card is InsightCard => card !== null);

    return cards.length > 0 ? cards : null;
  }

  return analyzeOwnerRRSPMeltdown(
    input,
    'primary',
    primaryRowsFromYearlyResults(baselineOutput.yearlyResults),
    clonedInput.rrspBalance
  );
}
