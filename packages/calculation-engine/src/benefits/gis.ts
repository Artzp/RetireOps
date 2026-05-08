/**
 * GIS (Guaranteed Income Supplement) Calculations
 * @see docs/source-of-truth/05-government-benefits.md - GIS Section
 */
import { BENEFIT_AMOUNTS_2024 } from '@retireops/shared';
import type { MaritalStatus } from '@retireops/shared';

const { gis } = BENEFIT_AMOUNTS_2024;

/**
 * Get GIS income threshold based on marital status
 * @see docs/source-of-truth/05-government-benefits.md - Income Thresholds
 */
export function getGISIncomeThreshold(
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false
): number {
  if (maritalStatus === 'single') {
    return gis.incomeThresholdSingle;
  }

  // Married or common-law
  if (spouseReceivingOAS) {
    return gis.incomeThresholdMarriedBoth;
  }

  // Spouse not receiving OAS - higher threshold
  return gis.incomeThresholdMarriedOneOAS;
}

/**
 * Get maximum GIS amount based on marital status
 */
export function getMaxGISAmount(maritalStatus: MaritalStatus): number {
  if (maritalStatus === 'single') {
    return gis.maxAnnualSingle;
  }
  // Per person when married
  return gis.maxMonthlyMarried * 12;
}

/**
 * Calculate GIS income for eligibility
 * @see docs/source-of-truth/05-government-benefits.md - GIS Calculation
 *
 * GIS income excludes:
 * - OAS payments
 * - First $5,000 of employment income
 */
export function calculateGISIncome(
  totalIncome: number,
  oasIncome: number,
  employmentIncome: number
): number {
  // Employment income exemption (first $5,000)
  const employmentExemption = Math.min(employmentIncome, 5000);

  return totalIncome - oasIncome - employmentExemption;
}

/**
 * Check if eligible for GIS
 * @see docs/source-of-truth/05-government-benefits.md - Eligibility
 */
export function isEligibleForGIS(
  age: number,
  receivingOAS: boolean,
  gisIncome: number,
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false
): boolean {
  if (age < 65) return false;
  if (!receivingOAS) return false;

  const threshold = getGISIncomeThreshold(maritalStatus, spouseReceivingOAS);
  return gisIncome < threshold;
}

/**
 * Calculate GIS benefit amount
 * @see docs/source-of-truth/05-government-benefits.md - GIS Calculation
 *
 * GIS reduces by 50 cents for every dollar of income
 */
export function calculateGISBenefit(
  gisIncome: number,
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false
): number {
  const threshold = getGISIncomeThreshold(maritalStatus, spouseReceivingOAS);

  if (gisIncome >= threshold) {
    return 0;
  }

  const maxGIS = getMaxGISAmount(maritalStatus);

  // 50% reduction for each dollar of income
  const reduction = gisIncome * 0.5;

  return Math.max(0, maxGIS - reduction);
}

/**
 * Complete GIS calculation result
 */
export interface GISCalculationResult {
  isEligible: boolean;
  gisIncome: number;
  maxAmount: number;
  reduction: number;
  benefit: number;
}

/**
 * Calculate complete GIS eligibility and amount
 */
export function calculateGIS(
  age: number,
  receivingOAS: boolean,
  totalIncome: number,
  oasIncome: number,
  employmentIncome: number,
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false
): GISCalculationResult {
  const gisIncome = calculateGISIncome(totalIncome, oasIncome, employmentIncome);
  const isEligible = isEligibleForGIS(
    age,
    receivingOAS,
    gisIncome,
    maritalStatus,
    spouseReceivingOAS
  );

  if (!isEligible) {
    return {
      isEligible: false,
      gisIncome,
      maxAmount: 0,
      reduction: 0,
      benefit: 0,
    };
  }

  const maxAmount = getMaxGISAmount(maritalStatus);
  const reduction = gisIncome * 0.5;
  const benefit = Math.max(0, maxAmount - reduction);

  return {
    isEligible: true,
    gisIncome,
    maxAmount,
    reduction,
    benefit,
  };
}
