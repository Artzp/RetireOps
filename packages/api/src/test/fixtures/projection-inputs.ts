/* eslint-disable @typescript-eslint/restrict-template-expressions */
/**
 * Test Fixtures: Projection Input Data
 *
 * Realistic Canadian retirement scenarios for integration testing.
 * @see docs/source-of-truth/08-projection-engine.md
 */
import type { FrontendInputData } from '../../services/projection-transformer.js';

/**
 * Single person, standard retirement at 65
 * Age: ~55 (calculated dynamically), retiring at 65, life expectancy 90
 * Ontario resident with typical RRSP/TFSA/Non-reg savings
 */
export const singlePersonBasic: FrontendInputData = {
  personalInfo: {
    // Use dynamic birthdate to get approximately 55 years old
    dateOfBirth: `${new Date().getFullYear() - 55}-06-15`,
    province: 'ON',
    gender: 'male',
    maritalStatus: 'single',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  accounts: [
    {
      type: 'RRSP',
      name: 'Main RRSP',
      balance: 300000,
      annualContribution: 15000,
      investmentReturnRate: 5,
    },
    {
      type: 'TFSA',
      name: 'TFSA',
      balance: 80000,
      annualContribution: 7000,
      investmentReturnRate: 5,
    },
    {
      type: 'NonRegistered',
      name: 'Investment Account',
      balance: 100000,
      investmentReturnRate: 5,
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      name: 'Salary',
      annualAmount: 100000,
      endAge: 65,
    },
  ],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 14000,
    yearsContributedToCpp: 35,
  },
  expenses: {
    currentAnnualExpenses: 70000,
    retirementAnnualExpenses: 50000,
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 5,
  },
};

/**
 * Minimal valid input - tests edge case with bare minimum data
 * No accounts, no income sources, just government benefits
 */
export const minimalValidInput: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 55}-01-01`,
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 85,
  },
  accounts: [],
  incomeSources: [],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
  },
  expenses: {
    currentAnnualExpenses: 30000,
    retirementAnnualExpenses: 30000,
  },
};

/**
 * Early retirement at 55 with early CPP at 60
 * BC resident, well-funded for early retirement
 */
export const earlyRetirementInput: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 50}-03-20`,
    province: 'BC',
    gender: 'female',
    maritalStatus: 'married',
    retirementAge: 55,
    lifeExpectancy: 92,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 800000,
      annualContribution: 0, // Already retired soon
      investmentReturnRate: 5,
    },
    {
      type: 'TFSA',
      balance: 150000,
      annualContribution: 7000,
      investmentReturnRate: 5,
    },
    {
      type: 'NonRegistered',
      balance: 300000,
      investmentReturnRate: 5,
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      annualAmount: 120000,
      endAge: 55,
    },
  ],
  governmentBenefits: {
    cppStartAge: 60, // Early CPP
    oasStartAge: 65,
    estimatedCppAmount: 12000,
    yearsContributedToCpp: 30,
  },
  expenses: {
    currentAnnualExpenses: 80000,
    retirementAnnualExpenses: 60000,
  },
  assumptions: {
    inflationRate: 2.5,
    investmentReturnRate: 5,
  },
};

/**
 * Underfunded scenario - portfolio will deplete before life expectancy
 * Tests probability of success < 100%
 */
export const underfundedInput: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 60}-01-01`, // Age 60
    province: 'AB',
    retirementAge: 60,
    lifeExpectancy: 95,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 100000,
      investmentReturnRate: 4,
    },
    {
      type: 'TFSA',
      balance: 30000,
      investmentReturnRate: 4,
    },
  ],
  incomeSources: [],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 8000,
    yearsContributedToCpp: 25,
  },
  expenses: {
    currentAnnualExpenses: 50000,
    retirementAnnualExpenses: 55000, // High expenses vs savings
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 4,
  },
};

/**
 * Age 70 - tests RRSP to RRIF conversion at 71
 * @see docs/source-of-truth/02-account-types.md - RRIF conversion
 */
export const age70Input: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 70}-07-01`, // Age 70
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 500000,
      investmentReturnRate: 4,
    },
    {
      type: 'TFSA',
      balance: 100000,
      investmentReturnRate: 4,
    },
  ],
  incomeSources: [],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 14000,
  },
  expenses: {
    currentAnnualExpenses: 45000,
    retirementAnnualExpenses: 45000,
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 4,
  },
};

/**
 * High income Ontario - tests tax accuracy at higher brackets
 * $150,000 income triggers higher tax brackets
 * @see docs/source-of-truth/04-tax-engine.md - Federal/Provincial brackets
 */
export const highIncomeOntario: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 50}-01-01`, // Age 50
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 500000,
      annualContribution: 30000,
      investmentReturnRate: 5,
    },
    {
      type: 'TFSA',
      balance: 100000,
      annualContribution: 7000,
      investmentReturnRate: 5,
    },
    {
      type: 'NonRegistered',
      balance: 200000,
      investmentReturnRate: 5,
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      annualAmount: 150000,
      endAge: 65,
    },
  ],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 16000, // Max CPP
    yearsContributedToCpp: 39,
  },
  expenses: {
    currentAnnualExpenses: 90000,
    retirementAnnualExpenses: 70000,
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 5,
  },
};

/**
 * Alberta resident - tests different provincial tax rates
 * Alberta has flat 10% rate for first bracket (lower taxes)
 */
export const albertaResident: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 55}-06-15`,
    province: 'AB',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 300000,
      annualContribution: 15000,
      investmentReturnRate: 5,
    },
    {
      type: 'TFSA',
      balance: 80000,
      annualContribution: 7000,
      investmentReturnRate: 5,
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      annualAmount: 100000,
      endAge: 65,
    },
  ],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 14000,
  },
  expenses: {
    currentAnnualExpenses: 70000,
    retirementAnnualExpenses: 50000,
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 5,
  },
};

/**
 * Quebec resident - tests Quebec's higher provincial taxes
 * Quebec has highest provincial rates in Canada
 */
export const quebecResident: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 55}-06-15`,
    province: 'QC',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 300000,
      annualContribution: 15000,
      investmentReturnRate: 5,
    },
    {
      type: 'TFSA',
      balance: 80000,
      annualContribution: 7000,
      investmentReturnRate: 5,
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      annualAmount: 100000,
      endAge: 65,
    },
  ],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 14000,
  },
  expenses: {
    currentAnnualExpenses: 70000,
    retirementAnnualExpenses: 50000,
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 5,
  },
};

/**
 * Multiple income sources - pension + rental income
 */
export const multipleIncomeInput: FrontendInputData = {
  personalInfo: {
    dateOfBirth: `${new Date().getFullYear() - 55}-01-01`,
    province: 'ON',
    retirementAge: 60,
    lifeExpectancy: 90,
  },
  accounts: [
    {
      type: 'RRSP',
      balance: 400000,
      investmentReturnRate: 5,
    },
    {
      type: 'TFSA',
      balance: 100000,
      investmentReturnRate: 5,
    },
  ],
  incomeSources: [
    {
      type: 'employment',
      annualAmount: 80000,
      endAge: 60,
    },
    {
      type: 'pension',
      name: 'DB Pension',
      annualAmount: 30000,
      startAge: 60,
      isIndexed: true,
      indexationRate: 2,
    },
    {
      type: 'rental',
      name: 'Rental Property',
      annualAmount: 18000,
      startAge: 55,
    },
  ],
  governmentBenefits: {
    cppStartAge: 65,
    oasStartAge: 65,
    estimatedCppAmount: 14000,
  },
  expenses: {
    currentAnnualExpenses: 65000,
    retirementAnnualExpenses: 55000,
  },
  assumptions: {
    inflationRate: 2,
    investmentReturnRate: 5,
  },
};

// Export all fixtures
export const fixtures = {
  singlePersonBasic,
  minimalValidInput,
  earlyRetirementInput,
  underfundedInput,
  age70Input,
  highIncomeOntario,
  albertaResident,
  quebecResident,
  multipleIncomeInput,
};
