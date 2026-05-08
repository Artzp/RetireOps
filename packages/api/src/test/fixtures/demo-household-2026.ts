import type { FrontendInputData } from '../../services/projection-transformer.js';

/**
 * Canonical 2026 demo household plan.
 *
 * Synthetic public fixture for pipeline regression tests without requiring a
 * database-backed seed run.
 */
export const demoHousehold2026FrontendInput: FrontendInputData = {
  personalInfo: {
    dateOfBirth: '1985-08-30',
    province: 'ON',
    gender: 'male',
    maritalStatus: 'married',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  spouse: {
    dateOfBirth: '1984-04-03',
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    employmentIncome: 0,
    expectedCppAt65: 0,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
  },
  accounts: [
    {
      type: 'TFSA',
      name: 'TFSA - Primary (balanced ETF)',
      balance: 0,
      annualContribution: 7000,
      investmentReturnRate: 6.5,
      belongsTo: 'primary',
      contributionRoom: 7000,
    },
    {
      type: 'TFSA',
      name: 'TFSA - Spouse (balanced ETF)',
      balance: 0,
      annualContribution: 7000,
      investmentReturnRate: 6.5,
      belongsTo: 'spouse',
      contributionRoom: 7000,
    },
    {
      type: 'RRSP',
      name: 'Spousal RRSP - Spouse (annual bonus)',
      balance: 0,
      annualContribution: 19000,
      investmentReturnRate: 6.5,
      belongsTo: 'spouse',
      contributorOwner: 'primary',
    },
    {
      type: 'RRSP',
      name: 'Personal RRSP - Primary (employer match)',
      balance: 0,
      annualContribution: 7250,
      investmentReturnRate: 6.5,
      belongsTo: 'primary',
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      name: 'Employer - Primary (base salary)',
      annualAmount: 125000,
      endAge: 65,
      indexationRate: 0.03,
    },
  ],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 16500,
  },
  expenses: {
    currentAnnualExpenses: 87500,
    retirementAnnualExpenses: 87500,
  },
  assumptions: {
    inflationRate: 2.1,
    investmentReturnRate: 6.5,
  },
};
