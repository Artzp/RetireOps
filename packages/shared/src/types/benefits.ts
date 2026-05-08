/**
 * Government Benefits Types
 * @see docs/source-of-truth/05-government-benefits.md
 */
import type { AccountOwner } from './accounts.js';

/**
 * CPP/QPP Benefit
 */
export interface CPPBenefit {
  owner: AccountOwner;
  estimatedAmountAt65: number;
  startAge: number;
  adjustedAmount: number;
  isQPP: boolean;
}

/**
 * OAS Benefit
 */
export interface OASBenefit {
  owner: AccountOwner;
  yearsInCanada: number;
  startAge: number;
  baseAmount: number;
  adjustedAmount: number;
  clawbackAmount: number;
  netAmount: number;
}

/**
 * GIS Benefit
 */
export interface GISBenefit {
  owner: AccountOwner;
  isEligible: boolean;
  amount: number;
}

export interface GovernmentBenefitsSummary {
  cpp: CPPBenefit;
  oas: OASBenefit;
  gis?: GISBenefit;
  totalAnnual: number;
}

/**
 * CPP Adjustment Factors
 * Early: 0.6% reduction per month before 65
 * Late: 0.7% increase per month after 65
 */
export const CPP_ADJUSTMENT_FACTORS = {
  EARLY_REDUCTION_PER_MONTH: 0.006, // 0.6% per month
  LATE_INCREASE_PER_MONTH: 0.007, // 0.7% per month
  EARLIEST_AGE: 60,
  STANDARD_AGE: 65,
  LATEST_AGE: 70,
} as const;

/**
 * OAS Adjustment Factors
 * Deferral: 0.6% increase per month after 65
 */
export const OAS_ADJUSTMENT_FACTORS = {
  DEFERRAL_INCREASE_PER_MONTH: 0.006, // 0.6% per month
  EARLIEST_AGE: 65,
  LATEST_AGE: 70,
  FULL_RESIDENCY_YEARS: 40,
  MINIMUM_RESIDENCY_YEARS: 10,
} as const;
