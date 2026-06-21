/**
 * Government Benefits Module
 * @see docs/source-of-truth/05-government-benefits.md
 */
import type {
  AccountOwner,
  MaritalStatus,
  GovernmentBenefitsSummary,
  CPPBenefit,
  OASBenefit,
  GISBenefit,
} from '@retireops/shared';
import { calculateCPPBenefit, indexCPPBenefit, isEligibleForCPP } from './cpp.js';
import { calculateOASBenefit, indexOASBenefit, isEligibleForOAS } from './oas.js';
import { calculateGIS } from './gis.js';
import { calculateOASClawback } from '../tax/oas-clawback.js';

// Re-export all benefit modules
export * from './cpp.js';
export * from './oas.js';
export * from './gis.js';

/**
 * Input for government benefits calculation
 */
export interface BenefitsCalculationInput {
  year: number;
  owner: AccountOwner;
  age: number;
  yearsOfResidence: number;
  maritalStatus: MaritalStatus;

  // CPP
  expectedCPPAt65: number;
  cppStartAge: number;
  isQuebec?: boolean;

  // OAS
  oasStartAge: number;

  // For clawback/GIS
  netIncome: number;
  employmentIncome: number;

  // Spouse-aware GIS calculation
  spouseReceivingOAS?: boolean;
  /**
   * True when the spouse receives the OAS Allowance (selects the GIS
   * spouse-on-Allowance tier). Ignored when spouseReceivingOAS is true.
   * @see docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-max
   */
  spouseReceivingAllowance?: boolean;

  // Inflation (for indexing)
  yearsFromStart: number;
  inflationRate: number;

  /**
   * Year-specific OAS recovery threshold (ITA s.180.2, indexed under s.117.1).
   * When supplied, overrides the tabled un-indexed value so the benefits engine
   * stays aligned with the tax engine's buildTaxYearParams output.
   * @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
   */
  oasClawbackThreshold?: number;

  /**
   * Calendar years to compound OAS gross indexation, anchored to the OAS
   * parameter base year (2026) — NOT to the person's OAS start age.
   *
   * The OAS gross base amount is a 2026-dollar figure (`OAS_2026.q2 × 12`), so
   * indexation must run from calendar-year-vs-2026, the same anchor the OAS
   * clawback threshold uses in `buildTaxYearParams`. When supplied, this
   * overrides the legacy `age − oasStartAge` clock so OAS gross and the
   * clawback threshold compound on a single calendar clock (audit A-08).
   *
   * CPP is intentionally NOT given a calendar anchor here: `expectedCPPAt65` is
   * user-supplied at the start age, so CPP correctly indexes "in pay" from
   * `age − cppStartAge`.
   * @see docs/source-of-truth/18-pensions-2026.md - OAS indexation
   * @see docs/audit/AUDIT-2026-06-10.internal.md A-08
   */
  oasIndexationYears?: number;
}

/**
 * Calculate all government benefits for a given year
 * @see docs/source-of-truth/05-government-benefits.md
 */
export function calculateGovernmentBenefits(
  input: BenefitsCalculationInput
): GovernmentBenefitsSummary {
  const {
    year,
    owner,
    age,
    yearsOfResidence,
    maritalStatus,
    expectedCPPAt65,
    cppStartAge,
    isQuebec = false,
    oasStartAge,
    netIncome,
    employmentIncome,
    spouseReceivingOAS = false,
    spouseReceivingAllowance = false,
    yearsFromStart: _yearsFromStart,
    inflationRate,
    oasClawbackThreshold,
    oasIndexationYears,
  } = input;

  // CPP Calculation
  let cppAmount = 0;
  if (age >= cppStartAge && isEligibleForCPP(cppStartAge)) {
    const baseCPP = calculateCPPBenefit(expectedCPPAt65, cppStartAge);
    cppAmount = indexCPPBenefit(baseCPP, inflationRate, Math.max(0, age - cppStartAge));
  }

  const cpp: CPPBenefit = {
    owner,
    estimatedAmountAt65: expectedCPPAt65,
    startAge: cppStartAge,
    adjustedAmount: cppAmount,
    isQPP: isQuebec,
  };

  // OAS Calculation
  let oasAmount = 0;
  let oasClawback = 0;
  let oasNet = 0;

  if (age >= oasStartAge && isEligibleForOAS(oasStartAge, yearsOfResidence)) {
    const baseOAS = calculateOASBenefit(yearsOfResidence, oasStartAge, age, year);
    // OAS gross indexes on a CALENDAR clock anchored to the 2026 parameter base
    // (audit A-08), matching the clawback-threshold anchor in buildTaxYearParams.
    // The base amount (OAS_2026.q2 × 12) is a 2026-dollar figure, so the elapsed
    // year count is calendar-years-past-2026 — supplied by the orchestrator as
    // oasIndexationYears. Falls back to the legacy age − oasStartAge clock only
    // when the orchestrator hasn't computed the calendar anchor (e.g. direct
    // unit-level calls), preserving prior behaviour for those callers.
    const oasYears = oasIndexationYears ?? Math.max(0, age - oasStartAge);
    oasAmount = indexOASBenefit(baseOAS, inflationRate, oasYears);

    // Calculate clawback — pass the (optionally indexed) threshold so the
    // benefits engine and tax engine apply the same CRA recovery threshold
    // across projection years. ITA s.180.2; threshold indexed annually per s.117.1.
    oasClawback = calculateOASClawback(netIncome, oasAmount, year, oasClawbackThreshold);
    oasNet = oasAmount - oasClawback;
  }

  const oas: OASBenefit = {
    owner,
    yearsInCanada: yearsOfResidence,
    startAge: oasStartAge,
    baseAmount: oasAmount,
    adjustedAmount: oasAmount,
    clawbackAmount: oasClawback,
    netAmount: oasNet,
  };

  // GIS Calculation (only if receiving OAS)
  let gis: GISBenefit | undefined;

  if (oasNet > 0) {
    const gisResult = calculateGIS(
      age,
      true,
      netIncome,
      oasNet,
      employmentIncome,
      maritalStatus,
      spouseReceivingOAS,
      spouseReceivingAllowance
    );

    if (gisResult.isEligible) {
      gis = {
        owner,
        isEligible: true,
        amount: gisResult.benefit,
      };
    }
  }

  // Total
  const totalAnnual = cppAmount + oasNet + (gis?.amount ?? 0);

  const result: GovernmentBenefitsSummary = {
    cpp,
    oas,
    totalAnnual,
  };

  if (gis) {
    result.gis = gis;
  }

  return result;
}

/**
 * Project government benefits from start age to end age
 */
export function projectGovernmentBenefits(
  input: BenefitsCalculationInput,
  endAge: number
): GovernmentBenefitsSummary[] {
  const projections: GovernmentBenefitsSummary[] = [];

  for (let age = input.age; age <= endAge; age++) {
    const yearsFromStart = age - input.age;
    const result = calculateGovernmentBenefits({
      ...input,
      age,
      yearsFromStart,
    });
    projections.push(result);
  }

  return projections;
}
