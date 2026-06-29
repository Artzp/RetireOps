/* eslint-disable @typescript-eslint/no-unnecessary-condition */

// Pure helpers extracted from YearByYearTab.tsx (timing/benefit math, row
// normalization, comparison ranking, and decision-patch builders). No React,
// no component state — kept side-effect free so they can be unit-tested in
// isolation and so the host component stays focused on rendering/state.

import type { ProjectionYearRow } from '@retireops/shared/types';
import { CPP_RATES, OAS_RATES } from '@retireops/shared/constants';

export type TimingDraft = {
  cppStartAge: number;
  oasStartAge: number;
  lifeExpectancy: number;
  expectedCPPAt65: number;
  yearsOfResidence: number;
  spouseCppStartAge?: number;
  spouseOasStartAge?: number;
  spouseLifeExpectancy?: number;
  spouseExpectedCPPAt65?: number;
  spouseYearsOfResidence?: number;
};
export type TimingPreset = {
  id: string;
  label: string;
  cppStartAge: number;
  oasStartAge: number;
  spouseCppStartAge?: number;
  spouseOasStartAge?: number;
};
export type TimingOutcomeSummary = {
  finalHouseholdNetWorth: number;
  finalEstateOrNetWorth: number;
  depletion:
    | {
        age: number;
        year: number;
      }
    | undefined;
  lifetimeCpp: number;
  lifetimeOas: number;
  lifetimeIncome: number;
  lifetimeOasClawback: number;
  totalTaxesPaid: number;
  fundedStatus: string;
};
export type TimingComparisonRow = TimingPreset &
  TimingOutcomeSummary & {
    rank: number;
    isBest: boolean;
    cppBreakevenAge?: number;
    oasBreakevenAge?: number;
  };

export function inferStartAge(
  rows: ProjectionYearRow[],
  incomeKey: keyof ProjectionYearRow,
  ageKey: 'age' | 'spouseAge',
  fallback: number
): number {
  const row = rows.find((r) => {
    const value = r[incomeKey];
    return typeof value === 'number' && value > 0;
  });
  const age = row?.[ageKey];
  return typeof age === 'number' ? age : fallback;
}

export function inferLifeExpectancy(
  rows: ProjectionYearRow[],
  ageKey: 'age' | 'spouseAge',
  fallback: number
): number {
  const ages = rows
    .map((row) => row[ageKey])
    .filter((age): age is number => typeof age === 'number');
  return ages.length > 0 ? Math.max(...ages) : fallback;
}

export function ageLabel(age: number): string {
  return `Age ${String(age)}`;
}

export function formatPercentInput(value: number | undefined): string {
  return value === undefined ? '' : (value * 100).toFixed(2).replace(/\.?0+$/, '');
}

export function parsePercentInput(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : undefined;
}

export function calculateCppFactor(startAge: number): number {
  if (startAge < 65) return 1 - (65 - startAge) * 12 * CPP_RATES.earlyReductionPerMonth;
  if (startAge > 65) return 1 + (startAge - 65) * 12 * CPP_RATES.lateIncreasePerMonth;
  return 1;
}

export function calculateOasFactor(startAge: number): number {
  if (startAge <= 65) return 1;
  return 1 + Math.min(startAge - 65, 5) * 12 * OAS_RATES.deferralIncreasePerMonth;
}

export function calculateBreakevenAge(
  baseAmount: number,
  earlyAge: number,
  laterAge: number,
  earlyFactor: number,
  laterFactor: number
): number | undefined {
  if (laterAge <= earlyAge || baseAmount <= 0) return undefined;
  const earlyBenefit = baseAmount * earlyFactor;
  const laterBenefit = baseAmount * laterFactor;
  const annualDifference = laterBenefit - earlyBenefit;
  if (annualDifference <= 0) return undefined;
  return laterAge + (earlyBenefit * (laterAge - earlyAge)) / annualDifference;
}

export function formatBreakeven(age: number | undefined): string {
  return age === undefined || !Number.isFinite(age) ? 'n/a' : `Age ${age.toFixed(1)}`;
}

export function inferBenefitAt65(
  rows: ProjectionYearRow[],
  incomeKey: keyof ProjectionYearRow,
  ageKey: 'age' | 'spouseAge',
  startAge: number,
  fallback: number
): number {
  const row = rows.find((r) => {
    const value = r[incomeKey];
    return typeof value === 'number' && value > 0;
  });
  const amount = row?.[incomeKey];
  if (typeof amount !== 'number' || amount <= 0) return fallback;
  if (incomeKey === 'cppIncome' || incomeKey === 'spouseCppIncome') {
    return Math.round(amount / calculateCppFactor(startAge));
  }
  const age = row?.[ageKey];
  const age75Factor = typeof age === 'number' && age >= 75 ? 1 + OAS_RATES.age75Bonus : 1;
  return Math.round(amount / calculateOasFactor(startAge) / age75Factor);
}

export function summarizeTimingOutcomes(rows: ProjectionYearRow[]): TimingOutcomeSummary {
  const finalRow = rows.at(-1);
  const depletionRow = rows.find((row) => row.householdNetWorth <= 0);
  const finalEstate =
    typeof (finalRow as ProjectionYearRow & { netEstate?: number }).netEstate === 'number'
      ? (finalRow as ProjectionYearRow & { netEstate: number }).netEstate
      : (finalRow?.householdNetWorth ?? 0);

  return rows.reduce<TimingOutcomeSummary>(
    (summary, row) => ({
      ...summary,
      lifetimeCpp: summary.lifetimeCpp + row.cppIncome + (row.spouseCppIncome ?? 0),
      lifetimeOas: summary.lifetimeOas + row.oasIncome + (row.spouseOasIncome ?? 0),
      lifetimeIncome:
        summary.lifetimeIncome +
        (row.householdTotalIncome ??
          row.totalGrossIncome +
            (row.spouseEmploymentIncome ?? 0) +
            (row.spousePensionIncome ?? 0)),
      lifetimeOasClawback:
        summary.lifetimeOasClawback + row.oasClawback + (row.spouseOasClawback ?? 0),
      totalTaxesPaid:
        summary.totalTaxesPaid +
        (row.householdTotalTax ?? row.totalTax + (row.spouseTotalTax ?? 0)),
    }),
    {
      finalHouseholdNetWorth: finalRow?.householdNetWorth ?? 0,
      finalEstateOrNetWorth: finalEstate,
      depletion:
        depletionRow !== undefined
          ? {
              age: depletionRow.age,
              year: depletionRow.year,
            }
          : undefined,
      lifetimeCpp: 0,
      lifetimeOas: 0,
      lifetimeIncome: 0,
      lifetimeOasClawback: 0,
      totalTaxesPaid: 0,
      fundedStatus: depletionRow === undefined ? 'Funded' : 'Depletes',
    }
  );
}

// Exported for unit tests (audit D-05) — not part of the component surface.
export function extractProjectionRows(resultData: Record<string, unknown>): ProjectionYearRow[] {
  const rows = resultData['projectionRows'] ?? resultData['yearlyResults'] ?? resultData['years'];
  if (!Array.isArray(rows)) return [];
  // Audit D-05: legacy persisted result_data (pre-ENG-03 shapes reached via the
  // yearlyResults/years fallbacks above) can lack fields that are required on
  // current ProjectionYearRow, notably householdTotalTax. Fill it by mirroring
  // the transformer/engine definition — householdTotalTax = householdTaxesPaid
  // = primary taxesPaid + spouse taxesPaid, i.e. row.totalTax +
  // row.spouseTotalTax; OAS recovery tax is intentionally NOT included (it is
  // tracked separately in totalTaxIncludingOASRecovery). See
  // packages/api/src/services/projection-transformer.ts (householdTotalTax:
  // year.householdTaxesPaid) and calculation-engine couple-calculator.ts
  // (householdTaxesPaid = primaryFinal.taxesPaid + spouseFinal.taxesPaid).
  // Deliberately a targeted field-fill, not a zod parse — this runs on the
  // render hot path for every preview comparison.
  return (rows as ProjectionYearRow[]).map((row) => {
    if (typeof row.householdTotalTax === 'number') return row;
    const totalTax = typeof row.totalTax === 'number' ? row.totalTax : 0;
    const spouseTotalTax = typeof row.spouseTotalTax === 'number' ? row.spouseTotalTax : 0;
    return { ...row, householdTotalTax: totalTax + spouseTotalTax };
  });
}

function compareTimingOutcomes(a: TimingOutcomeSummary, b: TimingOutcomeSummary): number {
  if (a.depletion === undefined && b.depletion !== undefined) return -1;
  if (a.depletion !== undefined && b.depletion === undefined) return 1;
  if (a.depletion !== undefined && b.depletion !== undefined) {
    const depletionDelta = b.depletion.age - a.depletion.age || b.depletion.year - a.depletion.year;
    if (depletionDelta !== 0) return depletionDelta;
  }
  return b.finalHouseholdNetWorth - a.finalHouseholdNetWorth;
}

export function rankTimingComparisons(
  rows: Array<
    TimingPreset & TimingOutcomeSummary & { cppBreakevenAge?: number; oasBreakevenAge?: number }
  >
): TimingComparisonRow[] {
  const ranked = [...rows].sort(compareTimingOutcomes);
  return ranked.map((row, index) => ({ ...row, rank: index + 1, isBest: index === 0 }));
}

export function timingPatchForPreset(
  preset: TimingPreset,
  isCouple: boolean,
  lifeDraft?: TimingDraft
): Record<string, number> {
  return {
    cppStartAge: preset.cppStartAge,
    oasStartAge: preset.oasStartAge,
    ...(lifeDraft !== undefined ? { lifeExpectancy: lifeDraft.lifeExpectancy } : {}),
    ...(lifeDraft !== undefined ? { expectedCPPAt65: lifeDraft.expectedCPPAt65 } : {}),
    ...(lifeDraft !== undefined ? { yearsOfResidence: lifeDraft.yearsOfResidence } : {}),
    ...(isCouple
      ? {
          spouseCppStartAge: preset.spouseCppStartAge ?? preset.cppStartAge,
          spouseOasStartAge: preset.spouseOasStartAge ?? preset.oasStartAge,
          ...(lifeDraft?.spouseLifeExpectancy !== undefined
            ? { spouseLifeExpectancy: lifeDraft.spouseLifeExpectancy }
            : {}),
          ...(lifeDraft?.spouseExpectedCPPAt65 !== undefined
            ? { spouseExpectedCPPAt65: lifeDraft.spouseExpectedCPPAt65 }
            : {}),
          ...(lifeDraft?.spouseYearsOfResidence !== undefined
            ? { spouseYearsOfResidence: lifeDraft.spouseYearsOfResidence }
            : {}),
        }
      : {}),
  };
}

export function timingPatchFromDraft(
  draft: TimingDraft,
  isCouple: boolean
): Record<string, number> {
  return {
    cppStartAge: draft.cppStartAge,
    oasStartAge: draft.oasStartAge,
    lifeExpectancy: draft.lifeExpectancy,
    expectedCPPAt65: draft.expectedCPPAt65,
    yearsOfResidence: draft.yearsOfResidence,
    ...(isCouple && draft.spouseCppStartAge !== undefined
      ? { spouseCppStartAge: draft.spouseCppStartAge }
      : {}),
    ...(isCouple && draft.spouseOasStartAge !== undefined
      ? { spouseOasStartAge: draft.spouseOasStartAge }
      : {}),
    ...(isCouple && draft.spouseLifeExpectancy !== undefined
      ? { spouseLifeExpectancy: draft.spouseLifeExpectancy }
      : {}),
    ...(isCouple && draft.spouseExpectedCPPAt65 !== undefined
      ? { spouseExpectedCPPAt65: draft.spouseExpectedCPPAt65 }
      : {}),
    ...(isCouple && draft.spouseYearsOfResidence !== undefined
      ? { spouseYearsOfResidence: draft.spouseYearsOfResidence }
      : {}),
  };
}
