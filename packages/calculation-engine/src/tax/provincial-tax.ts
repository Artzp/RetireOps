/**
 * Provincial Tax Calculations
 * @see docs/source-of-truth/04-tax-engine.md - Provincial Tax Brackets
 */
import {
  type TaxBracket,
  type ProvinceCode,
  getProvincialTaxTables,
  ONTARIO_SURTAX,
  AGE_CREDIT_2024,
  PENSION_INCOME_CREDIT_2024,
  AREL_2024,
} from '@retireops/shared';
import { calculateBracketTax, getFederalMarginalRate } from './federal-tax.js';
import type { TaxYearParams } from './indexing.js';

/**
 * Get provincial tax brackets for a given province and year
 */
export function getProvincialTaxBrackets(province: ProvinceCode, year: number): TaxBracket[] {
  const tables = getProvincialTaxTables(year);
  const table = tables[province];
  if (!table) {
    throw new Error(`Tax table not found for province: ${province}`);
  }
  return table.brackets;
}

/**
 * Get provincial basic personal amount
 */
export function getProvincialBasicPersonalAmount(province: ProvinceCode, year: number): number {
  const tables = getProvincialTaxTables(year);
  const table = tables[province];
  if (!table) {
    throw new Error(`Tax table not found for province: ${province}`);
  }
  return table.basicPersonalAmount;
}

/**
 * Get provincial credit rate (lowest bracket rate)
 */
export function getProvincialCreditRate(province: ProvinceCode): number {
  const brackets = getProvincialTaxBrackets(province, 2024);
  return brackets[0]?.rate ?? 0;
}

/**
 * Resolve the provincial bracket table, preferring the inflation-indexed
 * `taxYearParams.provincialBrackets` (audit A-10) when provided; otherwise the
 * tabled brackets for `year`.
 */
function resolveProvincialBrackets(
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): TaxBracket[] {
  const indexed = taxYearParams?.provincialBrackets[province];
  if (indexed) return indexed;
  return getProvincialTaxBrackets(province, year);
}

/** Lowest provincial bracket rate from the resolved (possibly indexed) brackets. */
function resolveProvincialCreditRate(
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const brackets = resolveProvincialBrackets(province, year, taxYearParams);
  return brackets[0]?.rate ?? 0;
}

/**
 * Calculate provincial tax before credits
 */
export function calculateProvincialTaxBeforeCredits(
  taxableIncome: number,
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const brackets = resolveProvincialBrackets(province, year, taxYearParams);
  return calculateBracketTax(taxableIncome, brackets);
}

/**
 * Calculate Ontario surtax
 * @see docs/source-of-truth/04-tax-engine.md - Ontario Surtax
 */
export function calculateOntarioSurtax(provincialTax: number): number {
  const { tier1Threshold, tier1Rate, tier2Threshold, tier2Rate } = ONTARIO_SURTAX;

  let surtax = 0;

  if (provincialTax > tier1Threshold) {
    // First tier: 20% on tax above $5,554
    surtax += (provincialTax - tier1Threshold) * tier1Rate;
  }

  if (provincialTax > tier2Threshold) {
    // Second tier: additional 36% on tax above $7,108
    surtax += (provincialTax - tier2Threshold) * tier2Rate;
  }

  return surtax;
}

/**
 * Calculate provincial basic personal amount credit
 */
export function calculateProvincialBPACredit(
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const bpa =
    taxYearParams?.provincialBpa[province] ?? getProvincialBasicPersonalAmount(province, year);
  const creditRate = resolveProvincialCreditRate(province, year, taxYearParams);
  return bpa * creditRate;
}

/**
 * Calculate provincial age credit (if available)
 *
 * When `taxYearParams` is supplied (audit A-10), the inflation-indexed
 * per-province age amount + threshold from `provincialCredits` are used so that
 * 2026+ projection years pick up the doc-19 2026 age amounts and extrapolated
 * thresholds. Otherwise it falls back to the tabled AGE_CREDIT_2024 set.
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md §5
 * @see docs/source-of-truth/04-tax-engine.md - Age Credit Section
 */
export function calculateProvincialAgeCredit(
  age: number,
  netIncome: number,
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  // Quebec folds the age amount into AREL — callers must use calculateQuebecAREL.
  if (province === 'QC') return 0;
  if (age < 65) return 0;

  const indexed = taxYearParams?.provincialCredits[province];
  if (indexed && indexed.ageAmount > 0) {
    const reduction = Math.max(
      0,
      (netIncome - indexed.ageAmountThreshold) * indexed.ageReductionRate
    );
    const netAgeAmount = Math.max(0, indexed.ageAmount - reduction);
    return netAgeAmount * indexed.ageCreditRate;
  }

  // Get province-specific age credit params if available
  const params =
    province in AGE_CREDIT_2024 ? AGE_CREDIT_2024[province as keyof typeof AGE_CREDIT_2024] : null;
  if (params === null) {
    // Use generic calculation with provincial credit rate
    const creditRate = resolveProvincialCreditRate(province, year, taxYearParams);
    const federalParams = AGE_CREDIT_2024.federal;
    const reduction = Math.max(
      0,
      (netIncome - federalParams.incomeThreshold) * federalParams.reductionRate
    );
    const netAgeAmount = Math.max(0, federalParams.ageAmount - reduction);
    return netAgeAmount * creditRate * 0.7; // Approximate provincial amount
  }

  const { ageAmount, incomeThreshold, reductionRate, creditRate } = params;
  const reduction = Math.max(0, (netIncome - incomeThreshold) * reductionRate);
  const netAgeAmount = Math.max(0, ageAmount - reduction);

  return netAgeAmount * creditRate;
}

/**
 * Calculate provincial pension income credit
 *
 * When `taxYearParams` is supplied (audit A-10), the inflation-indexed
 * per-province pension max amount from `provincialCredits` is used.
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md §5
 */
export function calculateProvincialPensionCredit(
  eligiblePensionIncome: number,
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  // Quebec folds the retirement-income amount into AREL — callers must use calculateQuebecAREL.
  if (province === 'QC') return 0;

  const indexed = taxYearParams?.provincialCredits[province];
  if (indexed) {
    const creditBase = Math.min(eligiblePensionIncome, indexed.pensionMaxAmount);
    return creditBase * indexed.pensionCreditRate;
  }

  const params =
    province in PENSION_INCOME_CREDIT_2024
      ? PENSION_INCOME_CREDIT_2024[province as keyof typeof PENSION_INCOME_CREDIT_2024]
      : null;
  if (params === null) {
    // Use generic calculation
    const creditRate = resolveProvincialCreditRate(province, year, taxYearParams);
    const maxAmount = 1000; // Default
    const creditBase = Math.min(eligiblePensionIncome, maxAmount);
    return creditBase * creditRate;
  }

  const { maxAmount, creditRate } = params;
  const creditBase = Math.min(eligiblePensionIncome, maxAmount);
  return creditBase * creditRate;
}

/**
 * Calculate Quebec AREL credit (combined age + retirement-income + living-alone)
 *
 * Structural divergence from AGE_CREDIT + PENSION_INCOME_CREDIT: QC combines
 * these amounts under a single family-net-income phase-out per TP-752.0.14.
 * Living-alone component is DEFERRED — no livesAlone/maritalStatus input
 * surface in the engine yet; reconciliation is a pre-M003-close follow-up.
 *
 * Boundary behaviors covered by callers: age<65 drops ageAmount; pension=0
 * drops pension component; netIncome<threshold means zero phase-out; high
 * netIncome clamps base-phaseOut to zero (never negative).
 *
 * @see docs/source-of-truth/04-tax-engine.md - Quebec AREL credit
 */
export function calculateQuebecAREL(
  age: number,
  netIncome: number,
  eligiblePensionIncome: number,
  _year: number,
  taxYearParams?: TaxYearParams
): number {
  // Use indexed AREL params (audit A-10) when supplied; else tabled 2024 set.
  const params = taxYearParams?.arel ?? AREL_2024.QC;
  const ageComponent = age >= 65 ? params.ageAmount : 0;
  const pensionComponent = Math.min(
    Math.max(0, eligiblePensionIncome),
    params.retirementIncomeAmount
  );
  // livingAloneAmount deferred: no livesAlone input plumbing yet.
  const base = ageComponent + pensionComponent;
  const phaseOut = Math.max(0, (netIncome - params.threshold) * params.reductionRate);
  const netBase = Math.max(0, base - phaseOut);
  return netBase * params.creditRate;
}

/**
 * Calculate total provincial non-refundable credits
 */
export function calculateProvincialNonRefundableCredits(
  age: number,
  netIncome: number,
  eligiblePensionIncome: number,
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  let totalCredits = 0;

  // Basic personal amount credit (QC uses QUEBEC_TAX_2024.basicPersonalAmount via calculateProvincialBPACredit).
  totalCredits += calculateProvincialBPACredit(province, year, taxYearParams);

  if (province === 'QC') {
    // Quebec: single combined AREL credit replaces separate age + pension credits.
    totalCredits += calculateQuebecAREL(age, netIncome, eligiblePensionIncome, year, taxYearParams);
  } else {
    // All other jurisdictions: independent age (65+) and pension income credits.
    totalCredits += calculateProvincialAgeCredit(age, netIncome, province, year, taxYearParams);
    totalCredits += calculateProvincialPensionCredit(
      eligiblePensionIncome,
      province,
      year,
      taxYearParams
    );
  }

  return totalCredits;
}

/**
 * Calculate net provincial tax
 *
 * `taxYearParams` (audit A-10) routes provincial brackets/BPA/credits through
 * the inflation-indexed path so 2026+ projections use the doc-19 2026 credit
 * amounts and extrapolated brackets instead of frozen 2025 values.
 *
 * @see docs/audit/AUDIT-2026-06-10.internal.md A-10
 * @see docs/source-of-truth/04-tax-engine.md - Step 5
 */
export function calculateProvincialTax(
  taxableIncome: number,
  age: number,
  netIncome: number,
  eligiblePensionIncome: number,
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const taxBeforeCredits = calculateProvincialTaxBeforeCredits(
    taxableIncome,
    province,
    year,
    taxYearParams
  );

  const credits = calculateProvincialNonRefundableCredits(
    age,
    netIncome,
    eligiblePensionIncome,
    province,
    year,
    taxYearParams
  );

  let netTax = Math.max(0, taxBeforeCredits - credits);

  // Apply Ontario surtax if applicable
  if (province === 'ON') {
    netTax += calculateOntarioSurtax(netTax);
  }

  return netTax;
}

/**
 * Get provincial marginal tax rate for a given income level
 */
export function getProvincialMarginalRate(
  taxableIncome: number,
  province: ProvinceCode,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const brackets = resolveProvincialBrackets(province, year, taxYearParams);

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.max) {
      return bracket.rate;
    }
  }

  return brackets[brackets.length - 1]?.rate ?? 0;
}

/**
 * Get combined (federal + provincial) marginal tax rate
 */
export function getCombinedMarginalRate(
  taxableIncome: number,
  province: ProvinceCode,
  year: number
): number {
  const federalRate = getFederalMarginalRate(taxableIncome, year);
  const provincialRate = getProvincialMarginalRate(taxableIncome, province, year);

  return federalRate + provincialRate;
}
