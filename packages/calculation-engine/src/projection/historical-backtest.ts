import type { ProjectionInput } from '@retireops/shared';
import type {
  PresetScenario,
  HistoricalReturnDataset,
  BacktestRun,
  BacktestYearRecord,
} from '@retireops/shared';
import {
  ageAtEndOfYear,
  PRESET_SCENARIOS,
  BLENDED_HISTORICAL_RETURNS_DATASET,
} from '@retireops/shared';
import { calculateYear, type YearInput } from './yearly-calculator.js';
import { getTFSAAnnualLimit } from '../accounts/tfsa.js';
import { calculateRRSPContributionRoom } from '../accounts/rrsp.js';

export function runHistoricalBacktest(
  input: ProjectionInput,
  preset: PresetScenario,
  dataset: HistoricalReturnDataset
): BacktestRun {
  const startYear = preset.startYear;
  const horizon = input.lifeExpectancy - input.retirementAge;
  const endYear = startYear + horizon;

  const adjustedBirthdate = new Date(
    startYear - input.retirementAge,
    input.birthdate.getMonth(),
    input.birthdate.getDate()
  );

  const returnsByYear = new Map<number, number>();
  for (const record of dataset.records) {
    returnsByYear.set(record.year, record.returnRate);
  }

  const yearRecords: BacktestYearRecord[] = [];

  let rrspBalance = input.rrspBalance;
  let rrifBalance = input.rrifBalance ?? 0;
  let tfsaBalance = input.tfsaBalance;
  let nonRegBalance = input.nonRegBalance;
  let nonRegACB = input.nonRegBalance;
  let tfsaRestoredRoom = 0;
  let rrspCarryForwardRoom = 0;

  let depleted = false;
  let depletionYear: number | null = null;

  for (let year = startYear; year <= endYear; year++) {
    const yearsFromStart = year - startYear;
    const age = ageAtEndOfYear(adjustedBirthdate, year);
    const projectionYear = yearsFromStart + 1;

    const historicalReturn = returnsByYear.get(year);
    const isEstimated = historicalReturn === undefined;
    const returnRate = isEstimated ? dataset.longRunAverage : historicalReturn;

    const isPreRetirement = age < input.retirementAge;
    const employmentIncome = isPreRetirement
      ? input.employmentIncome * Math.pow(1 + input.employmentGrowthRate, yearsFromStart)
      : 0;

    const availableTfsaContributionRoom = getTFSAAnnualLimit(year) + tfsaRestoredRoom;

    const priorYearEarnedIncome =
      yearsFromStart === 0
        ? input.employmentIncome
        : input.employmentIncome * Math.pow(1 + input.employmentGrowthRate, yearsFromStart - 1);
    const availableRRSPRoom = calculateRRSPContributionRoom(
      priorYearEarnedIncome,
      rrspCarryForwardRoom,
      year
    );
    const cappedRRSPContribution = isPreRetirement
      ? Math.min(input.rrspAnnualContribution, availableRRSPRoom)
      : 0;

    const pensionIncome = age >= (input.pensionStartAge ?? 0) ? (input.pensionIncome ?? 0) : 0;

    const yearInput: YearInput = {
      year,
      birthdate: adjustedBirthdate,
      province: input.province,
      rrspBalance,
      rrifBalance,
      tfsaBalance,
      nonRegBalance,
      nonRegACB,
      rrspContribution: cappedRRSPContribution,
      tfsaContribution: input.tfsaAnnualContribution,
      availableTfsaContributionRoom,
      employmentIncome,
      pensionIncome,
      otherIncome: 0,
      expectedCPPAt65: input.expectedCPPAt65 ?? 12000,
      cppStartAge: input.cppStartAge ?? 65,
      oasStartAge: input.oasStartAge ?? 65,
      yearsOfResidence: input.yearsOfResidence ?? 40,
      retirementSpending: input.retirementSpending,
      investmentReturn: returnRate,
      inflationRate: input.inflationRate,
      retirementAge: input.retirementAge,
      yearsFromProjectionStart: yearsFromStart,
      ...(input.drawdownOrder && { drawdownOrder: input.drawdownOrder }),
      ...(input.rrspMeltdown && { rrspMeltdown: input.rrspMeltdown }),
      ...(input.oasClawbackAvoidance && { oasClawbackAvoidance: input.oasClawbackAvoidance }),
      ...(input.bracketFill && { bracketFill: input.bracketFill }),
      ...(input.contributionOverrides && { contributionOverrides: input.contributionOverrides }),
      ...(input.ageBandReductions && { ageBandReductions: input.ageBandReductions }),
    };

    const result = calculateYear(yearInput);

    const totalBalance =
      result.rrspBalance + result.rrifBalance + result.tfsaBalance + result.nonRegBalance;

    yearRecords.push({
      calendarYear: year,
      projectionYear,
      returnRateApplied: returnRate,
      isEstimated,
      portfolioBalance: totalBalance,
      totalWithdrawals: result.rrifWithdrawal + result.tfsaWithdrawal + result.nonRegWithdrawal,
      totalTaxesPaid: result.taxesPaid,
    });

    if (!depleted && totalBalance <= 0) {
      depleted = true;
      depletionYear = year;
    }

    rrspBalance = Math.max(0, result.rrspBalance);
    rrifBalance = Math.max(0, result.rrifBalance);
    tfsaBalance = Math.max(0, result.tfsaBalance);
    nonRegBalance = Math.max(0, result.nonRegBalance);
    tfsaRestoredRoom = result.tfsaWithdrawal;
    rrspCarryForwardRoom = Math.max(0, availableRRSPRoom - cappedRRSPContribution);

    if (result.nonRegWithdrawal > 0 && nonRegBalance > 0) {
      nonRegACB = nonRegACB * (result.nonRegBalance / nonRegBalance);
    }
  }

  const finalRecord = yearRecords[yearRecords.length - 1];

  return {
    scenarioId: preset.id,
    label: preset.label,
    description: preset.description,
    startYear: preset.startYear,
    funded: !depleted,
    depletionYear,
    finalBalance: depleted ? 0 : (finalRecord?.portfolioBalance ?? 0),
    yearRecords,
  };
}

export function runAllPresetBacktests(
  input: ProjectionInput,
  dataset: HistoricalReturnDataset = BLENDED_HISTORICAL_RETURNS_DATASET
): BacktestRun[] {
  return PRESET_SCENARIOS.map((preset) => runHistoricalBacktest(input, preset, dataset));
}
