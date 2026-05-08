/**
 * Income Source Types
 * @see docs/source-of-truth/03-income-sources.md
 */
import type { AccountOwner } from './accounts.js';

export type IncomeType =
  | 'employment'
  | 'self_employment'
  | 'rental'
  | 'db_pension'
  | 'dc_pension'
  | 'cpp'
  | 'qpp'
  | 'oas'
  | 'gis'
  | 'rrif_withdrawal'
  | 'lif_withdrawal'
  | 'tfsa_withdrawal'
  | 'non_reg_withdrawal'
  | 'one_time';

export type TaxTreatment =
  | 'fully_taxable'
  | 'tax_free'
  | 'capital_gains'
  | 'dividend_eligible'
  | 'dividend_non_eligible';

export interface IncomeSource {
  id: string;
  type: IncomeType;
  owner: AccountOwner;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  startYear?: number;
  endYear?: number;
  growthRate?: number;
  taxTreatment: TaxTreatment;
  metadata?: Record<string, unknown>;
}

/**
 * Employment Income
 * @see docs/source-of-truth/03-income-sources.md - Employment Income
 */
export interface EmploymentIncome extends IncomeSource {
  type: 'employment';
  taxTreatment: 'fully_taxable';
}

/**
 * Defined Benefit Pension
 * @see docs/source-of-truth/03-income-sources.md - Defined Benefit Pension
 */
export interface DBPensionIncome extends IncomeSource {
  type: 'db_pension';
  taxTreatment: 'fully_taxable';
  indexingRate?: number;
  bridgeBenefit?: number;
  survivorBenefitPct?: number;
  normalRetirementAge?: number;
}

/**
 * One-Time Income Event Types
 * @see docs/source-of-truth/03-income-sources.md - One-Time Income Events
 */
export type OneTimeEventType =
  | 'inheritance'
  | 'gift'
  | 'severance'
  | 'bonus'
  | 'property_sale'
  | 'business_sale'
  | 'insurance_payout'
  | 'lottery';

export interface OneTimeIncome extends IncomeSource {
  type: 'one_time';
  eventType: OneTimeEventType;
  year: number;
  description?: string;
}

export interface YearlyIncomeSummary {
  year: number;
  employment: number;
  selfEmployment: number;
  pension: number;
  governmentBenefits: number;
  investmentIncome: number;
  withdrawals: number;
  oneTime: number;
  totalGross: number;
  totalTaxable: number;
}
