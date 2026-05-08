/**
 * Pension Income Splitting Analyzer
 *
 * Evaluates whether splitting eligible pension/RRIF income between spouses
 * would reduce combined household tax liability.
 *
 * Canadian pension income splitting rules (CRA T1032):
 * - Age 65+: eligible income = qualifying pension income + RRIF withdrawals + annuity payments
 * - Under 65: eligible income = life annuity payments from a registered pension plan ONLY
 *   (RRIF withdrawals do NOT qualify before age 65)
 * - CPP and OAS income is NEVER eligible for pension income splitting
 *
 * @see docs/source-of-truth/04-tax-engine.md — Pension Income Splitting
 * @see REQUIREMENTS.md — SPLIT-01, SPLIT-02, SPLIT-03
 */
import type { InsightCard } from '@retireops/shared';
import type { OptimizationInput } from '../types.js';
import { calculateTotalTax } from '../../tax/index.js';
import type { TaxCalculationInput } from '../../tax/index.js';

/**
 * Derive age from birthdate and calendar year.
 */
function ageInYear(birthdate: Date, year: number): number {
  return year - birthdate.getFullYear();
}

/**
 * Compute the splittable income for a person in a given year.
 * CPP and OAS are NEVER included (SPLIT-03).
 * Before age 65, RRIF withdrawals do NOT qualify — only registered pension plan income.
 *
 * @see docs/source-of-truth/04-tax-engine.md — Pension Income Splitting eligibility
 */
function getSplittableIncome(pensionIncome: number, rrifWithdrawal: number, age: number): number {
  if (age >= 65) {
    // Both pension income and RRIF withdrawals qualify at 65+
    return pensionIncome + rrifWithdrawal;
  }
  // Under 65: only life annuity payments from a registered pension plan qualify
  // RRIF withdrawals are excluded
  return pensionIncome;
}

/**
 * Build a TaxCalculationInput for use with calculateTotalTax.
 * Uses known income fields and zeroes out investment income (analyzer simplification).
 */
function buildTaxInput(
  year: number,
  owner: 'primary' | 'spouse',
  age: number,
  province: import('@retireops/shared').ProvinceCode,
  pensionIncome: number,
  rrifIncome: number,
  cppIncome: number,
  oasIncome: number
): TaxCalculationInput {
  return {
    year,
    owner,
    province,
    age,
    employmentIncome: 0,
    pensionIncome,
    rrifIncome,
    cppIncome,
    oasIncome,
    otherIncome: 0,
    interestIncome: 0,
    eligibleDividends: 0,
    nonEligibleDividends: 0,
    capitalGains: 0,
    rrspContribution: 0,
    otherDeductions: 0,
  };
}

/**
 * Analyze pension income splitting opportunity for a couple projection.
 *
 * Returns an InsightCard describing the optimal split percentage and
 * combined tax savings, or null if:
 * - No spouse is present (single projection — SPLIT-02)
 * - There is no eligible splittable income
 * - Splitting produces no tax savings
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-SPLIT-001, TC-OPT-SPLIT-002, TC-OPT-SPLIT-003
 */
export function analyzeIncomeSplitting(input: OptimizationInput): InsightCard | null {
  const { baselineOutput, clonedInput, coupleYearlyResults } = input;

  // SPLIT-02: Guard — no spouse means no splitting possible
  if (clonedInput.spouse === undefined) {
    return null;
  }

  const actualSplitRows = (coupleYearlyResults ?? []).filter((yr) => yr.pensionSplitTaxSavings > 0);
  if (actualSplitRows.length > 0) {
    const totalSavings = Math.round(
      actualSplitRows.reduce((sum, yr) => sum + yr.pensionSplitTaxSavings, 0)
    );
    const annualSavings = Math.round(totalSavings / actualSplitRows.length);
    const avgBestPct = Math.round(
      (actualSplitRows.reduce((sum, yr) => sum + yr.pensionSplitPercentage, 0) /
        actualSplitRows.length) *
        100
    );

    return {
      module: 'income-splitting',
      title: 'Household Pension Income Splitting',
      recommendedAction: `Split about ${String(avgBestPct)}% of eligible pension income between spouses in years where the projection finds tax savings.`,
      whyItHelps:
        'Moving eligible pension income to the lower-tax spouse reduces combined household tax while preserving the same total household income.',
      affectedYears: actualSplitRows.map((yr) => yr.year),
      estimatedAnnualSavings: annualSavings,
      appliesTo: 'household',
      explanation:
        `Splitting ${String(avgBestPct)}% of eligible pension income between spouses saves approximately ` +
        `$${annualSavings.toLocaleString('en-CA')}/year in combined household taxes ` +
        `($${totalSavings.toLocaleString('en-CA')} over your retirement), based on the couple projection rows.`,
      estimatedDollarImpact: totalSavings,
      confidence: 'HIGH',
    };
  }

  const primaryBirthdate = clonedInput.birthdate;
  const spouseBirthdate = clonedInput.spouse.birthdate;
  const primaryProvince = clonedInput.province;
  const spouseProvince = clonedInput.spouse.province ?? clonedInput.province;

  // Spouse income assumptions for tax re-scoring
  // We use the spouse's known pension and CPP from clonedInput;
  // RRIF income is estimated from the spouse's RRSP/RRIF balance presence
  const spousePensionBase = clonedInput.spouse.pensionIncome ?? 0;
  const spouseCppBase = clonedInput.spouse.expectedCPPAt65;
  const spouseOasBase = 8128; // 2024 full OAS (approximation for analyzer)

  let lifetimeSavings = 0;
  let bestPctSum = 0;
  let retiredYearCount = 0;
  let anyUnder65 = false;
  const affectedYears: number[] = [];

  // Iterate over retirement years only
  for (const yr of baselineOutput.yearlyResults) {
    if (!yr.isRetired) {
      continue;
    }

    const primaryAge = ageInYear(primaryBirthdate, yr.year);
    const spouseAge = ageInYear(spouseBirthdate, yr.year);

    // Check for under-65 caveat (SPLIT-03)
    if (primaryAge < 65 || spouseAge < 65) {
      anyUnder65 = true;
    }

    // Compute splittable income for primary (CPP excluded — SPLIT-03)
    const splittable = getSplittableIncome(yr.pensionIncome, yr.rrifWithdrawal, primaryAge);

    if (splittable <= 0) {
      continue;
    }

    // Baseline taxes (no splitting)
    const primaryBaselineTax = calculateTotalTax(
      buildTaxInput(
        yr.year,
        'primary',
        primaryAge,
        primaryProvince,
        yr.pensionIncome,
        yr.rrifWithdrawal,
        yr.cppIncome,
        yr.oasIncome
      )
    );

    const spouseBaselineTax = calculateTotalTax(
      buildTaxInput(
        yr.year,
        'spouse',
        spouseAge,
        spouseProvince,
        spousePensionBase,
        0, // RRIF approximation — analyzer simplification
        spouseCppBase,
        spouseOasBase
      )
    );

    const baselineCombined = primaryBaselineTax.totalTax + spouseBaselineTax.totalTax;

    // Test each split percentage from 1% to 50% in 1% steps
    let bestPct = 0;
    let bestCombined = baselineCombined;

    for (let pct = 1; pct <= 50; pct++) {
      const transferAmount = (splittable * pct) / 100;

      // Primary receives less pension/RRIF income after transfer
      const primaryAdjustedPension = Math.max(0, yr.pensionIncome - transferAmount);
      const primaryAdjustedRRIF = Math.max(
        0,
        yr.rrifWithdrawal - Math.max(0, transferAmount - yr.pensionIncome)
      );

      // Spouse receives additional pension income
      const spouseAdjustedPension = spousePensionBase + transferAmount;

      const primaryAdjustedTax = calculateTotalTax(
        buildTaxInput(
          yr.year,
          'primary',
          primaryAge,
          primaryProvince,
          primaryAdjustedPension,
          primaryAdjustedRRIF,
          yr.cppIncome,
          yr.oasIncome
        )
      );

      const spouseAdjustedTax = calculateTotalTax(
        buildTaxInput(
          yr.year,
          'spouse',
          spouseAge,
          spouseProvince,
          spouseAdjustedPension,
          0,
          spouseCppBase,
          spouseOasBase
        )
      );

      const adjustedCombined = primaryAdjustedTax.totalTax + spouseAdjustedTax.totalTax;

      if (adjustedCombined < bestCombined) {
        bestCombined = adjustedCombined;
        bestPct = pct;
      }
    }

    const yearSavings = baselineCombined - bestCombined;
    lifetimeSavings += yearSavings;
    bestPctSum += bestPct;
    retiredYearCount++;
    if (yearSavings > 0) {
      affectedYears.push(yr.year);
    }
  }

  // No benefit from splitting
  if (lifetimeSavings <= 0 || retiredYearCount === 0) {
    return null;
  }

  const annualSavings = Math.round(lifetimeSavings / retiredYearCount);
  const totalSavings = Math.round(lifetimeSavings);
  const avgBestPct = Math.round(bestPctSum / retiredYearCount);

  // Under-65 caveat (SPLIT-03)
  const caveat = anyUnder65
    ? ' Note: Before age 65, only life annuity payments from a registered pension plan qualify for splitting. RRIF withdrawals qualify only after age 65.'
    : '';

  const explanation =
    `Splitting ${String(avgBestPct)}% of eligible pension income to your spouse saves approximately ` +
    `$${annualSavings.toLocaleString('en-CA')}/year in combined household taxes ` +
    `($${totalSavings.toLocaleString('en-CA')} over your retirement).${caveat}`;

  return {
    module: 'income-splitting',
    title: 'Household Pension Income Splitting',
    recommendedAction: `Split about ${String(avgBestPct)}% of eligible pension income to your spouse during retirement years with eligible pension or RRIF income.`,
    whyItHelps:
      'Moving eligible pension income to the lower-tax spouse reduces combined household tax while preserving the same total household income.',
    affectedYears,
    estimatedAnnualSavings: annualSavings,
    appliesTo: 'household',
    explanation,
    estimatedDollarImpact: Math.round(lifetimeSavings),
    confidence: 'HIGH',
  };
}
