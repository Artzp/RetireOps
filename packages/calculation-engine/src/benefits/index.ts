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
    yearsFromStart: _yearsFromStart,
    inflationRate,
    oasClawbackThreshold,
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
    oasAmount = indexOASBenefit(baseOAS, inflationRate, Math.max(0, age - oasStartAge));

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
      spouseReceivingOAS
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
