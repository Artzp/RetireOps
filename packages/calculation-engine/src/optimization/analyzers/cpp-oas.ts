/**
 * CPP/OAS Timing Analyzer
 *
 * Calculates CPP and OAS breakeven ages for start-time decisions and detects
 * OAS clawback risk from the baseline projection. Produces one InsightCard per
 * person (primary only for singles, primary + spouse for couples).
 *
 * @see docs/source-of-truth/05-government-benefits.md — CPP/OAS Decision Support
 * @see REQUIREMENTS.md — CPP-01, CPP-02, CPP-03
 */
import type { InsightCard } from '@retireops/shared';
import type { OptimizationInput } from '../types.js';
import { calculateCPPBreakEvenAge } from '../../benefits/cpp.js';
import { calculateOASBreakEvenAge } from '../../benefits/oas.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a number as a Canadian dollar string (integer).
 */
function formatCAD(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-CA')}`;
}

/**
 * Build the explanation text and estimated dollar impact for a single person's
 * CPP/OAS timing analysis.
 *
 * Life expectancy gate (CPP-01): any deferral whose breakeven age exceeds
 * lifeExpectancy is suppressed — the recommendation is omitted entirely.
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-001, TC-OPT-CPP-002
 */
function buildPersonCard(
  expectedCPPAt65: number,
  lifeExpectancy: number,
  yearsOfResidence: number,
  oasStartAge: number,
  clawbackYears: { oasClawback: number }[],
  affectedYears: number[]
): {
  explanation: string;
  recommendedAction: string;
  whyItHelps: string;
  estimatedDollarImpact: number;
  estimatedAnnualSavings?: number;
} {
  const parts: string[] = [];
  const actions: string[] = [];
  let totalImpact = 0;

  // -------------------------------------------------------------------
  // CPP breakeven analysis (CPP-01)
  // -------------------------------------------------------------------

  // 60-vs-65 comparison
  const cpp60vs65 = calculateCPPBreakEvenAge(expectedCPPAt65, 60, 65);
  const cpp65vs70 = calculateCPPBreakEvenAge(expectedCPPAt65, 65, 70);

  const cpp60Within = isFinite(cpp60vs65) && cpp60vs65 <= lifeExpectancy;
  const cpp65Within = isFinite(cpp65vs70) && cpp65vs70 <= lifeExpectancy;

  if (cpp60Within) {
    const breakevenFormatted = Math.round(cpp60vs65);
    parts.push(
      `Starting CPP at 65 instead of 60 breaks even at age ${String(breakevenFormatted)}. ` +
        `Deferring is beneficial if you expect to live beyond ${String(breakevenFormatted)}.`
    );
    actions.push('Consider starting CPP at 65 instead of 60.');
    // Rough lifetime gain: years of net benefit × annual difference after breakeven
    const earlyBenefitAt65 = expectedCPPAt65 * (1 - 60 * 12 * 0.006); // 0.6%/month for 60 months
    const lateBenefitAt65 = expectedCPPAt65; // full at 65
    const annualDiff = lateBenefitAt65 - earlyBenefitAt65;
    const yearsOfGain = lifeExpectancy - cpp60vs65;
    if (yearsOfGain > 0) {
      totalImpact += annualDiff * yearsOfGain;
    }
  }

  if (cpp65Within) {
    const breakevenFormatted = Math.round(cpp65vs70);
    parts.push(`Further deferring to 70 breaks even at age ${String(breakevenFormatted)}.`);
    actions.push('Consider whether deferring CPP to 70 fits your income plan.');
    // Benefit of deferring 65→70: 8.4%/year × 5 years = 42% more
    const earlyBenefitAt70 = expectedCPPAt65;
    const lateBenefitAt70 = expectedCPPAt65 * (1 + 60 * 0.007); // 0.7%/month for 60 months
    const annualDiff = lateBenefitAt70 - earlyBenefitAt70;
    const yearsOfGain = lifeExpectancy - cpp65vs70;
    if (yearsOfGain > 0) {
      totalImpact += annualDiff * yearsOfGain;
    }
  }

  if (!cpp60Within && !cpp65Within) {
    parts.push('Based on your life expectancy, starting CPP earlier may be optimal.');
    actions.push(
      'Keep CPP timing closer to your current start age unless your longevity assumptions change.'
    );
  }

  // -------------------------------------------------------------------
  // OAS breakeven analysis (CPP-01 / OAS timing)
  // -------------------------------------------------------------------

  // OAS 65-vs-70 comparison
  const oas65vs70 = calculateOASBreakEvenAge(yearsOfResidence, 65, 70);
  const oas65Within = isFinite(oas65vs70) && oas65vs70 <= lifeExpectancy;

  if (oas65Within && oasStartAge <= 65) {
    const breakevenFormatted = Math.round(oas65vs70);
    parts.push(`Deferring OAS to age 70 breaks even at age ${String(breakevenFormatted)}.`);
    actions.push('Consider delaying OAS to age 70 if you can cover spending from other sources.');
  }

  // -------------------------------------------------------------------
  // OAS clawback detection (CPP-02)
  // -------------------------------------------------------------------

  if (clawbackYears.length > 0) {
    const maxAnnualClawback = Math.max(...clawbackYears.map((yr) => yr.oasClawback));
    const lifetimeClawback = clawbackYears.reduce((sum, yr) => sum + yr.oasClawback, 0);
    parts.push(
      `Warning: OAS clawback detected. In some years, your projected income exceeds the clawback threshold, ` +
        `resulting in an estimated clawback of up to ${formatCAD(maxAnnualClawback)}/year.`
    );
    actions.push(
      'Review high-income OAS years and look for ways to smooth taxable income below clawback thresholds.'
    );
    // Clawback is a cost — subtract from impact
    totalImpact -= lifetimeClawback;
  }

  const explanation = parts.join(' ');
  const estimatedDollarImpact = Math.round(totalImpact);
  const estimatedAnnualSavings =
    affectedYears.length > 0 && estimatedDollarImpact > 0
      ? Math.round(estimatedDollarImpact / affectedYears.length)
      : undefined;

  return {
    explanation,
    recommendedAction: actions.join(' '),
    whyItHelps:
      'CPP and OAS timing changes can trade lower early income for higher inflation-indexed benefits later, while income smoothing can reduce OAS recovery tax.',
    estimatedDollarImpact,
    ...(estimatedAnnualSavings !== undefined && { estimatedAnnualSavings }),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze CPP and OAS timing decisions for a completed projection.
 *
 * For single projections: returns a 1-element array.
 * For couple projections: returns a 2-element array (primary first, spouse second).
 *
 * Each card:
 * - Shows breakeven ages for 60-vs-65 and 65-vs-70 CPP comparisons (CPP-01)
 * - Flags OAS clawback risk with estimated annual amount (CPP-02)
 * - Suppresses any deferral recommendation where breakeven > lifeExpectancy
 * - Uses module='cpp-timing' per InsightModule union
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-001, TC-OPT-CPP-002, TC-OPT-CPP-003
 * @see docs/source-of-truth/05-government-benefits.md — CPP/OAS Decision Support
 */
export function analyzeCPPOAS(input: OptimizationInput): InsightCard[] {
  const { baselineOutput, clonedInput, coupleYearlyResults } = input;
  const isCoupleProjection = clonedInput.spouse !== undefined;

  // -------------------------------------------------------------------
  // Primary person card
  // -------------------------------------------------------------------

  const primaryExpectedCPP = clonedInput.expectedCPPAt65 ?? 0;
  const primaryLifeExpectancy = clonedInput.lifeExpectancy;
  const primaryYearsOfResidence = clonedInput.yearsOfResidence ?? 40;
  const primaryOasStartAge = clonedInput.oasStartAge ?? 65;

  // Scan yearlyResults for primary's OAS clawback risk
  const primaryClawbackYears = baselineOutput.yearlyResults
    .filter((yr) => yr.age >= primaryOasStartAge && yr.taxCalculation.oasClawback > 0)
    .map((yr) => ({ oasClawback: yr.taxCalculation.oasClawback }));
  const primaryAffectedYears = baselineOutput.yearlyResults
    .filter((yr) => yr.age >= 60)
    .map((yr) => yr.year);

  const primaryCardData = buildPersonCard(
    primaryExpectedCPP,
    primaryLifeExpectancy,
    primaryYearsOfResidence,
    primaryOasStartAge,
    primaryClawbackYears,
    primaryAffectedYears
  );

  const primaryTitle = isCoupleProjection ? 'CPP/OAS Timing — Primary' : 'CPP/OAS Timing';

  const primaryCard: InsightCard = {
    module: 'cpp-timing',
    title: primaryTitle,
    recommendedAction: primaryCardData.recommendedAction,
    whyItHelps: primaryCardData.whyItHelps,
    affectedYears: primaryAffectedYears,
    ...(primaryCardData.estimatedAnnualSavings !== undefined && {
      estimatedAnnualSavings: primaryCardData.estimatedAnnualSavings,
    }),
    appliesTo: 'primary',
    explanation: primaryCardData.explanation,
    estimatedDollarImpact: primaryCardData.estimatedDollarImpact,
    confidence: 'MEDIUM',
  };

  const cards: InsightCard[] = [primaryCard];

  // -------------------------------------------------------------------
  // Spouse card (CPP-03)
  // -------------------------------------------------------------------

  if (isCoupleProjection && clonedInput.spouse !== undefined) {
    const spouse = clonedInput.spouse;
    const spouseExpectedCPP = spouse.expectedCPPAt65;
    const spouseLifeExpectancy = spouse.lifeExpectancy;
    const spouseYearsOfResidence = spouse.yearsOfResidence ?? 40;
    const spouseOasStartAge = spouse.oasStartAge ?? 65;

    // Spouse clawback: yearlyResults is primary-only shape.
    // The current YearlyResult does not carry per-spouse clawback breakdown.
    // As a documented approximation (see 44-01-SUMMARY decisions), we check
    // spouseAge fields but clawback data is only available for the primary person.
    // Spouse clawback scanning is limited to years where spouseAge >= oasStartAge
    // and is not directly available — we use an empty array as the approximation.
    const spouseClawbackYears = (coupleYearlyResults ?? [])
      .filter(
        (yr) =>
          yr.spouse.age >= spouseOasStartAge &&
          (yr.spouse.oasClawback ?? yr.spouse.taxCalculation.oasClawback) > 0
      )
      .map((yr) => ({
        oasClawback: yr.spouse.oasClawback ?? yr.spouse.taxCalculation.oasClawback,
      }));
    const spouseAffectedYears = (coupleYearlyResults ?? [])
      .filter((yr) => yr.spouse.age >= 60)
      .map((yr) => yr.year);

    const spouseCardData = buildPersonCard(
      spouseExpectedCPP,
      spouseLifeExpectancy,
      spouseYearsOfResidence,
      spouseOasStartAge,
      spouseClawbackYears,
      spouseAffectedYears
    );

    const spouseCard: InsightCard = {
      module: 'cpp-timing',
      title: 'CPP/OAS Timing — Spouse',
      recommendedAction: spouseCardData.recommendedAction,
      whyItHelps: spouseCardData.whyItHelps,
      affectedYears: spouseAffectedYears,
      ...(spouseCardData.estimatedAnnualSavings !== undefined && {
        estimatedAnnualSavings: spouseCardData.estimatedAnnualSavings,
      }),
      appliesTo: 'spouse',
      explanation: spouseCardData.explanation,
      estimatedDollarImpact: spouseCardData.estimatedDollarImpact,
      confidence: 'MEDIUM',
    };

    cards.push(spouseCard);
  }

  return cards;
}
