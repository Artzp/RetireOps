/**
 * Additional Tax Credits Module
 * @see docs/source-of-truth/04-tax-engine.md - Tax Credits Detail
 */

import type { ProvinceCode } from '@retireops/shared';

const BC_RENTERS_CREDIT_RULES = {
  2024: { maxCredit: 400, threshold: 63000, zeroAt: 83000 },
  2025: { maxCredit: 400, threshold: 64764, zeroAt: 84764 },
  2026: { maxCredit: 400, threshold: 66189, zeroAt: 86189 },
} as const;

export interface BCRentersCreditParams {
  adjustedIncome: number;
  eligible: boolean;
  year: number;
}

export function calculateBCRentersCredit(params: BCRentersCreditParams): number {
  const { adjustedIncome, eligible, year } = params;
  if (!eligible) {
    return 0;
  }

  const rules = Object.hasOwn(BC_RENTERS_CREDIT_RULES, year)
    ? BC_RENTERS_CREDIT_RULES[year as keyof typeof BC_RENTERS_CREDIT_RULES]
    : BC_RENTERS_CREDIT_RULES[2026];

  if (adjustedIncome >= rules.zeroAt) {
    return 0;
  }

  if (adjustedIncome <= rules.threshold) {
    return rules.maxCredit;
  }

  return Math.max(0, rules.maxCredit - (adjustedIncome - rules.threshold) * 0.02);
}

export interface OntarioSeniorsTransitCreditParams {
  age: number;
  eligibleExpenses: number;
}

export function calculateOntarioSeniorsTransitTaxCredit(
  params: OntarioSeniorsTransitCreditParams
): number {
  const { age, eligibleExpenses } = params;

  // Ontario requires the claimant to be 65+ on the last day of the previous tax
  // year, which maps to age 66+ when this engine uses age at the end of the
  // current tax year.
  if (age < 66 || eligibleExpenses <= 0) {
    return 0;
  }

  const claimableExpenses = Math.min(eligibleExpenses, 3000);
  return claimableExpenses * 0.15;
}

/**
 * Spouse/Partner amount credit parameters
 */
export interface SpouseAmountParams {
  spouseNetIncome: number;
  year?: number;
}

/**
 * Calculate spouse or common-law partner amount credit
 * @see CRA line 30300
 */
export function calculateSpouseAmountCredit(
  params: SpouseAmountParams,
  province: ProvinceCode
): { federal: number; provincial: number } {
  const { spouseNetIncome, year: _year = 2024 } = params;

  // Federal spouse amount (2024)
  const federalSpouseAmount = 15705; // Same as basic personal amount
  const federalReduction = Math.max(0, spouseNetIncome);
  const netFederalSpouseAmount = Math.max(0, federalSpouseAmount - federalReduction);
  const federalCredit = netFederalSpouseAmount * 0.15;

  // Provincial spouse amounts vary
  let provincialCredit = 0;
  switch (province) {
    case 'ON': {
      const onSpouseAmount = 12399;
      const netOnSpouseAmount = Math.max(0, onSpouseAmount - spouseNetIncome);
      provincialCredit = netOnSpouseAmount * 0.0505;
      break;
    }
    case 'BC': {
      const bcSpouseAmount = 12580;
      const netBcSpouseAmount = Math.max(0, bcSpouseAmount - spouseNetIncome);
      provincialCredit = netBcSpouseAmount * 0.0506;
      break;
    }
    case 'AB': {
      const abSpouseAmount = 21003;
      const netAbSpouseAmount = Math.max(0, abSpouseAmount - spouseNetIncome);
      provincialCredit = netAbSpouseAmount * 0.1;
      break;
    }
    default:
      // Default to federal rate for other provinces
      provincialCredit = netFederalSpouseAmount * 0.05;
  }

  return { federal: federalCredit, provincial: provincialCredit };
}

/**
 * Disability tax credit parameters
 */
export interface DisabilityTaxCreditParams {
  hasDisability: boolean;
  isUnder18?: boolean;
  hasSupplementAmount?: boolean;
}

/**
 * Calculate disability tax credit
 * @see CRA line 31600
 */
export function calculateDisabilityTaxCredit(
  params: DisabilityTaxCreditParams,
  province: ProvinceCode
): { federal: number; provincial: number } {
  if (!params.hasDisability) {
    return { federal: 0, provincial: 0 };
  }

  // Federal disability amount (2024)
  const federalDisabilityAmount = 9428;
  const federalSupplementAmount = params.isUnder18 ? 5500 : 0;
  const totalFederalAmount = federalDisabilityAmount + federalSupplementAmount;
  const federalCredit = totalFederalAmount * 0.15;

  // Provincial amounts vary
  let provincialCredit = 0;
  switch (province) {
    case 'ON':
      provincialCredit = 9586 * 0.0505;
      break;
    case 'BC':
      provincialCredit = 9428 * 0.0506;
      break;
    case 'AB':
      provincialCredit = 16635 * 0.1;
      break;
    default:
      provincialCredit = federalDisabilityAmount * 0.05;
  }

  return { federal: federalCredit, provincial: provincialCredit };
}

/**
 * Medical expenses credit parameters
 */
export interface MedicalExpensesParams {
  eligibleExpenses: number;
  netIncome: number;
  dependantExpenses?: number;
}

/**
 * Calculate medical expenses tax credit
 * @see CRA line 33099
 */
export function calculateMedicalExpensesCredit(
  params: MedicalExpensesParams,
  province: ProvinceCode
): { federal: number; provincial: number } {
  const { eligibleExpenses, netIncome, dependantExpenses = 0 } = params;

  // Federal medical expenses threshold (2024): lesser of 3% of net income or $2,759
  const federalThreshold = Math.min(netIncome * 0.03, 2759);
  const federalClaimableAmount = Math.max(0, eligibleExpenses - federalThreshold);
  const federalCredit = federalClaimableAmount * 0.15;

  // Add dependant medical expenses (different threshold)
  const dependantThreshold = Math.min(netIncome * 0.03, 2759);
  const dependantClaimable = Math.max(0, dependantExpenses - dependantThreshold);
  const federalDependantCredit = dependantClaimable * 0.15;

  // Provincial medical expenses
  let provincialCredit = 0;
  switch (province) {
    case 'ON': {
      const onThreshold = Math.min(netIncome * 0.03, 2759);
      const onClaimable = Math.max(0, eligibleExpenses - onThreshold);
      provincialCredit = onClaimable * 0.0505;
      break;
    }
    case 'BC': {
      const bcThreshold = Math.min(netIncome * 0.03, 2759);
      const bcClaimable = Math.max(0, eligibleExpenses - bcThreshold);
      provincialCredit = bcClaimable * 0.0506;
      break;
    }
    case 'AB': {
      const abThreshold = Math.min(netIncome * 0.03, 2759);
      const abClaimable = Math.max(0, eligibleExpenses - abThreshold);
      provincialCredit = abClaimable * 0.1;
      break;
    }
    default:
      provincialCredit = federalClaimableAmount * 0.05;
  }

  return {
    federal: federalCredit + federalDependantCredit,
    provincial: provincialCredit,
  };
}

/**
 * Charitable donations credit parameters
 */
export interface CharitableDonationsParams {
  donations: number;
  taxableIncome: number;
}

/**
 * Calculate charitable donations tax credit
 * @see CRA line 34900
 */
export function calculateCharitableDonationsCredit(
  params: CharitableDonationsParams,
  province: ProvinceCode
): { federal: number; provincial: number } {
  const { donations, taxableIncome } = params;

  if (donations <= 0) {
    return { federal: 0, provincial: 0 };
  }

  // Federal: 15% on first $200, 29% on excess
  // If taxable income > $246,752, 33% on excess donations
  const first200 = Math.min(donations, 200);
  const excess = Math.max(0, donations - 200);

  let federalCredit = first200 * 0.15;
  if (taxableIncome > 246752) {
    federalCredit += excess * 0.33;
  } else {
    federalCredit += excess * 0.29;
  }

  // Provincial donations credit
  let provincialCredit = 0;
  switch (province) {
    case 'ON':
      provincialCredit = first200 * 0.0505 + excess * 0.1116;
      break;
    case 'BC':
      provincialCredit = first200 * 0.0506 + excess * 0.165;
      break;
    case 'AB':
      provincialCredit = first200 * 0.1 + excess * 0.21;
      break;
    default:
      provincialCredit = first200 * 0.05 + excess * 0.1;
  }

  return { federal: federalCredit, provincial: provincialCredit };
}

/**
 * Canada Caregiver Credit parameters
 */
export interface CaregiverCreditParams {
  infirmDependant: boolean;
  dependantNetIncome?: number;
  dependantType: 'spouse' | 'child' | 'parent' | 'other';
}

/**
 * Calculate Canada caregiver credit
 * @see CRA line 30400, 30425, 30450
 */
export function calculateCaregiverCredit(params: CaregiverCreditParams): {
  federal: number;
  provincial: number;
} {
  if (!params.infirmDependant) {
    return { federal: 0, provincial: 0 };
  }

  const { dependantNetIncome = 0, dependantType } = params;

  // Federal caregiver amount (2024)
  const baseCaregiverAmount = 7999;
  const enhancedAmount = 2499; // Additional for infirm dependants

  let claimableAmount = baseCaregiverAmount;
  if (dependantType === 'spouse' || dependantType === 'child') {
    claimableAmount += enhancedAmount;
  }

  // Reduce by dependant's net income over threshold
  const threshold = 18783;
  if (dependantNetIncome > threshold) {
    claimableAmount = Math.max(0, claimableAmount - (dependantNetIncome - threshold));
  }

  const federalCredit = claimableAmount * 0.15;

  // Provincial caregiver credits vary significantly
  // Using simplified calculation
  const provincialCredit = claimableAmount * 0.05;

  return { federal: federalCredit, provincial: provincialCredit };
}

/**
 * Home Accessibility Tax Credit parameters
 */
export interface HomeAccessibilityParams {
  eligibleExpenses: number;
  isQualifyingIndividual: boolean; // Senior 65+ or disability credit eligible
}

/**
 * Calculate home accessibility tax credit
 * @see CRA line 31285
 */
export function calculateHomeAccessibilityCredit(params: HomeAccessibilityParams): {
  federal: number;
} {
  if (!params.isQualifyingIndividual) {
    return { federal: 0 };
  }

  // Maximum eligible expenses: $20,000 (2024)
  const maxEligible = 20000;
  const claimableExpenses = Math.min(params.eligibleExpenses, maxEligible);
  const federalCredit = claimableExpenses * 0.15;

  return { federal: federalCredit };
}

/**
 * Employment credit (Canada Employment Amount)
 */
export function calculateEmploymentCredit(employmentIncome: number): { federal: number } {
  if (employmentIncome <= 0) {
    return { federal: 0 };
  }

  // Canada Employment Amount (2024): lesser of employment income or $1,433
  const claimableAmount = Math.min(employmentIncome, 1433);
  const federalCredit = claimableAmount * 0.15;

  return { federal: federalCredit };
}

/**
 * Climate Action Incentive (refundable)
 * Note: This is a refundable credit, not deducted from tax
 */
export interface ClimateActionParams {
  province: ProvinceCode;
  numAdults: number;
  numChildren: number;
  isRural: boolean;
}

/**
 * Calculate Climate Action Incentive payment
 * Note: Amounts for 2024 vary by province
 */
export function calculateClimateActionIncentive(params: ClimateActionParams): number {
  const { province, numAdults, numChildren, isRural } = params;

  // 2024 base amounts (quarterly, so multiply by 4 for annual)
  // Only applies to provinces without their own carbon pricing
  const baseAmounts: Partial<Record<ProvinceCode, number>> = {
    AB: 450,
    SK: 376,
    MB: 300,
    ON: 280,
    NB: 190,
    NS: 206,
    PE: 220,
    NL: 298,
  };

  const baseAmount = baseAmounts[province];
  if (!baseAmount) {
    return 0; // Province not eligible (BC, QC have own carbon pricing)
  }

  // Calculate total
  // First adult gets full amount, spouse gets 50%, children get 25%
  let total = baseAmount; // First adult
  if (numAdults > 1) {
    total += baseAmount * 0.5; // Spouse
  }
  total += numChildren * baseAmount * 0.25;

  // Rural supplement: 20% extra
  if (isRural) {
    total *= 1.2;
  }

  return total;
}

/**
 * Calculate all applicable credits for a taxpayer
 */
export interface ComprehensiveTaxCreditsInput {
  age: number;
  netIncome: number;
  taxableIncome: number;
  employmentIncome: number;
  eligiblePensionIncome: number;
  province: ProvinceCode;

  // Optional credit-related inputs
  spouseNetIncome?: number;
  hasDisability?: boolean;
  medicalExpenses?: number;
  charitableDonations?: number;
  hasCaregiverDependant?: boolean;
  homeAccessibilityExpenses?: number;
}

export interface ComprehensiveTaxCreditsResult {
  federal: {
    basicPersonalAmount: number;
    ageCredit: number;
    pensionIncomeCredit: number;
    spouseCredit: number;
    disabilityCredit: number;
    medicalExpensesCredit: number;
    donationsCredit: number;
    caregiverCredit: number;
    homeAccessibilityCredit: number;
    employmentCredit: number;
    total: number;
  };
  provincial: {
    basicPersonalAmount: number;
    ageCredit: number;
    pensionIncomeCredit: number;
    spouseCredit: number;
    disabilityCredit: number;
    medicalExpensesCredit: number;
    donationsCredit: number;
    caregiverCredit: number;
    total: number;
  };
  totalCredits: number;
}

/**
 * Calculate comprehensive tax credits
 */
export function calculateComprehensiveTaxCredits(
  input: ComprehensiveTaxCreditsInput
): ComprehensiveTaxCreditsResult {
  const {
    age,
    netIncome,
    taxableIncome,
    employmentIncome,
    eligiblePensionIncome,
    province,
    spouseNetIncome,
    hasDisability = false,
    medicalExpenses = 0,
    charitableDonations = 0,
    hasCaregiverDependant = false,
    homeAccessibilityExpenses = 0,
  } = input;

  // Federal basic personal amount
  const federalBPA = 15705;
  const federalBasicCredit = federalBPA * 0.15;

  // Provincial basic personal amounts
  const provincialBPAs: Partial<Record<ProvinceCode, number>> = {
    ON: 12399,
    BC: 12580,
    AB: 21003,
    QC: 18056,
    SK: 18491,
    MB: 15780,
    NS: 8481,
    NB: 13044,
    PE: 13500,
    NL: 10818,
  };
  const provincialBPA = provincialBPAs[province] ?? 12000;
  const provincialBasicCredit = provincialBPA * (province === 'AB' ? 0.1 : 0.05);

  // Age credit
  let federalAgeCredit = 0;
  let provincialAgeCredit = 0;
  if (age >= 65) {
    const federalAgeAmount = 8790;
    const reduction = Math.max(0, (netIncome - 44325) * 0.15);
    const netAgeAmount = Math.max(0, federalAgeAmount - reduction);
    federalAgeCredit = netAgeAmount * 0.15;
    provincialAgeCredit = netAgeAmount * 0.05; // Simplified
  }

  // Pension income credit
  const pensionCreditBase = Math.min(eligiblePensionIncome, 2000);
  const federalPensionCredit = pensionCreditBase * 0.15;
  const provincialPensionCredit = pensionCreditBase * 0.05;

  // Spouse credit
  const spouseCredits =
    spouseNetIncome !== undefined
      ? calculateSpouseAmountCredit({ spouseNetIncome }, province)
      : { federal: 0, provincial: 0 };

  // Disability credit
  const disabilityCredits = calculateDisabilityTaxCredit({ hasDisability }, province);

  // Medical expenses credit
  const medicalCredits = calculateMedicalExpensesCredit(
    { eligibleExpenses: medicalExpenses, netIncome },
    province
  );

  // Donations credit
  const donationsCredits = calculateCharitableDonationsCredit(
    { donations: charitableDonations, taxableIncome },
    province
  );

  // Caregiver credit
  const caregiverCredits = hasCaregiverDependant
    ? calculateCaregiverCredit({ infirmDependant: true, dependantType: 'parent' })
    : { federal: 0, provincial: 0 };

  // Home accessibility credit
  const homeAccessibilityCredit = calculateHomeAccessibilityCredit({
    eligibleExpenses: homeAccessibilityExpenses,
    isQualifyingIndividual: age >= 65 || hasDisability,
  });

  // Employment credit
  const employmentCredits = calculateEmploymentCredit(employmentIncome);

  // Calculate totals
  const federalTotal =
    federalBasicCredit +
    federalAgeCredit +
    federalPensionCredit +
    spouseCredits.federal +
    disabilityCredits.federal +
    medicalCredits.federal +
    donationsCredits.federal +
    caregiverCredits.federal +
    homeAccessibilityCredit.federal +
    employmentCredits.federal;

  const provincialTotal =
    provincialBasicCredit +
    provincialAgeCredit +
    provincialPensionCredit +
    spouseCredits.provincial +
    disabilityCredits.provincial +
    medicalCredits.provincial +
    donationsCredits.provincial +
    caregiverCredits.provincial;

  return {
    federal: {
      basicPersonalAmount: federalBasicCredit,
      ageCredit: federalAgeCredit,
      pensionIncomeCredit: federalPensionCredit,
      spouseCredit: spouseCredits.federal,
      disabilityCredit: disabilityCredits.federal,
      medicalExpensesCredit: medicalCredits.federal,
      donationsCredit: donationsCredits.federal,
      caregiverCredit: caregiverCredits.federal,
      homeAccessibilityCredit: homeAccessibilityCredit.federal,
      employmentCredit: employmentCredits.federal,
      total: federalTotal,
    },
    provincial: {
      basicPersonalAmount: provincialBasicCredit,
      ageCredit: provincialAgeCredit,
      pensionIncomeCredit: provincialPensionCredit,
      spouseCredit: spouseCredits.provincial,
      disabilityCredit: disabilityCredits.provincial,
      medicalExpensesCredit: medicalCredits.provincial,
      donationsCredit: donationsCredits.provincial,
      caregiverCredit: caregiverCredits.provincial,
      total: provincialTotal,
    },
    totalCredits: federalTotal + provincialTotal,
  };
}
