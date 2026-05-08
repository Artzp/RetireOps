export const PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'commonLaw', label: 'Common Law' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
] as const;

export interface StepConfig {
  id: string;
  slug: string;
  label: string;
  description: string;
}

export const ALL_STEPS: StepConfig[] = [
  {
    id: 'about-you',
    slug: 'about_you',
    label: 'About You',
    description: 'Your basic demographics and retirement targets',
  },
  {
    id: 'spouse',
    slug: 'spouse',
    label: 'Spouse / Partner',
    description: 'Spouse demographics and retirement targets',
  },
  {
    id: 'income',
    slug: 'income',
    label: 'Income',
    description: 'Employment and other income sources',
  },
  {
    id: 'spending',
    slug: 'spending',
    label: 'Spending',
    description: 'Your annual spending today and in retirement',
  },
  {
    id: 'accounts',
    slug: 'accounts',
    label: 'Accounts',
    description: 'Financial accounts and balances',
  },
  { id: 'debts', slug: 'debts', label: 'Debts', description: 'Mortgages, loans, and other debts' },
  {
    id: 'benefits',
    slug: 'benefits',
    label: 'Benefits & Pensions',
    description: 'Government benefits and pension plans',
  },
  {
    id: 'property-goals',
    slug: 'property_goals',
    label: 'Property & Goals',
    description: 'Real estate and financial goals',
  },
];

export interface IncomeCard {
  _serverId?: string;
  type: string; // 'Employment Salary' | 'Self-Employment' | 'Rental' | 'Investment' | 'Other'
  label: string;
  belongsTo: string; // 'primary' | 'spouse'
  annualAmount: string;
  growthRate: string;
  endCondition: string; // 'at-retirement' | 'ongoing' | 'specific-year'
  endYear?: number;
}

export interface AccountCard {
  _serverId?: string;
  type: string; // 'RRSP' | 'TFSA' | 'LIRA' | 'DPSP' | 'ESPP' | 'Non-Registered' | 'RESP'
  label: string;
  belongsTo: string; // 'primary' | 'spouse'
  currentBalance: string;
  expectedReturn: string;
  annualContribution: string;
  contributionEndCondition: string; // 'at-retirement' | 'ongoing' | 'specific-year'
  contributionEndYear?: number;
  // Type-specific extras (optional — only used for matching types)
  contributionRoom?: string; // RRSP, TFSA
  adjustedCostBase?: string; // Non-Registered
  annualInterestIncome?: string; // Non-Registered
  annualEligibleDividends?: string; // Non-Registered
  annualNonEligibleDividends?: string; // Non-Registered
  annualRealizedCapitalGains?: string; // Non-Registered
  employerMatch?: string; // ESPP
}

export interface DebtCard {
  _serverId?: string;
  type: string; // 'Mortgage' | 'Car Loan' | 'HELOC' | 'Student Loan' | 'Credit Card' | 'Other'
  label: string;
  balance: string;
  interestRate: string;
  monthlyPayment: string;
  // Mortgage-specific extras
  amortizationYears?: string;
  paymentFrequency?: string; // 'monthly' | 'bi-weekly' | 'weekly'
  linkedProperty?: string;
}

export interface PensionCard {
  _serverId?: string;
  type: string; // 'DB Pension' | 'DC Pension'
  belongsTo: string; // 'primary' | 'spouse'
  label: string;
  // DB Pension fields
  annualPension?: string;
  indexed?: boolean;
  indexingRate?: string;
  bridgeBenefit?: boolean;
  bridgeAmount?: string;
  bridgeEndsAtAge?: string;
  survivorBenefit?: string;
  // DC Pension fields
  currentBalance?: string;
  contributionRate?: string;
  employerMatchRate?: string;
  expectedReturn?: string;
}

export interface PropertyCard {
  _serverId?: string;
  type: string; // 'Primary Residence' | 'Investment Property' | 'Vacation Property'
  label: string;
  currentValue: string;
  appreciationRate: string;
}

export interface GoalCard {
  _serverId?: string;
  name: string;
  targetYear: string;
  estimatedCost: string;
  adjustForInflation: boolean;
}

export const INCOME_TYPES = [
  'Employment Salary',
  'Self-Employment',
  'Rental',
  'Investment',
  'Other',
] as const;

export const ACCOUNT_TYPES = [
  'RRSP',
  'TFSA',
  'LIRA',
  'DPSP',
  'ESPP',
  'Non-Registered',
  'RESP',
] as const;

export const DEBT_TYPES = [
  'Mortgage',
  'Car Loan',
  'HELOC',
  'Student Loan',
  'Credit Card',
  'Other',
] as const;

export const PROPERTY_TYPES = [
  'Primary Residence',
  'Investment Property',
  'Vacation Property',
] as const;

export const END_CONDITION_OPTIONS = [
  { value: 'at-retirement', label: 'At retirement' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'specific-year', label: 'Specific year' },
] as const;

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
] as const;

/** Default form values for an empty profile */
export const EMPTY_PROFILE_DEFAULTS = {
  about_you: {
    projectionName: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    province: '',
    gender: '',
    maritalStatus: '',
    retirementAge: 65,
    lifeExpectancy: 90,
    includeSpouse: false,
    inflationRate: undefined as number | undefined,
    investmentReturnRate: undefined as number | undefined,
  },
  spouse: {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    retirementAge: 65,
  },
  income: [] as IncomeCard[],
  spending: {
    currentAnnualSpending: undefined as number | undefined,
    retirementAnnualSpending: undefined as number | undefined,
  },
  accounts: [] as AccountCard[],
  debts: [] as DebtCard[],
  benefits: {
    cpp_primary: {
      estimatedAnnual: '',
      survivorsPensionEnabled: false,
      survivorsPensionAmount: '',
    },
    oas_primary: { estimatedAnnual: '', residencyYears: '40' },
    cpp_spouse: { estimatedAnnual: '', survivorsPensionEnabled: false, survivorsPensionAmount: '' },
    oas_spouse: { estimatedAnnual: '', residencyYears: '40' },
    pensions: [] as PensionCard[],
  },
  property_goals: {
    properties: [] as PropertyCard[],
    goals: [] as GoalCard[],
    legacy: { enabled: false, targetAmount: '' },
  },
};

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
