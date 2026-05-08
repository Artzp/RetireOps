/**
 * Unit tests for assembleProfileInputData
 * @see .planning/phases/11-profile-data-flow/11-CONTEXT.md - D-07
 */
import { describe, it, expect } from 'vitest';
import { assembleProfileInputData } from './profile-assembler.js';
import type { ProfileData } from './profile.service.js';

function makeProfile(stepData: Record<string, unknown>): ProfileData {
  return {
    id: 'test-id',
    stepData,
    currentStep: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('assembleProfileInputData', () => {
  it('single person with all steps populated returns valid FrontendInputData', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'BC',
        retirementAge: 60,
        lifeExpectancy: 85,
        includeSpouse: false,
      },
      income: {
        cards: [
          {
            type: 'Employment Salary',
            label: 'Job',
            annualAmount: 100000,
            belongsTo: 'primary',
          },
        ],
      },
      accounts: {
        cards: [
          {
            type: 'RRSP',
            label: 'RRSP',
            balance: 200000,
            annualContribution: 5000,
            returnRate: 5,
          },
        ],
      },
      benefits: {
        primaryCpp: { estimatedAnnual: 12000 },
      },
    });

    const result = assembleProfileInputData(profile);

    // personalInfo
    expect(result.personalInfo.dateOfBirth).toBe('1975-06-15');
    expect(result.personalInfo.province).toBe('BC');
    expect(result.personalInfo.retirementAge).toBe(60);
    expect(result.personalInfo.lifeExpectancy).toBe(85);

    // accounts
    expect(result.accounts.length).toBe(1);
    expect(result.accounts[0]?.type).toBe('RRSP');
    expect(result.accounts[0]?.balance).toBe(200000);
    expect(result.accounts[0]?.annualContribution).toBe(5000);

    // incomeSources
    expect(result.incomeSources.length).toBe(1);
    expect(result.incomeSources[0]?.type).toBe('employment');
    expect(result.incomeSources[0]?.annualAmount).toBe(100000);

    // governmentBenefits
    expect(result.governmentBenefits.cppStartAge).toBe(65);
    expect(result.governmentBenefits.estimatedCppAmount).toBe(12000);

    // expenses (estimated at 70% of total income when no explicit expenses step)
    expect(result.expenses.currentAnnualExpenses).toBe(70000);
    expect(result.expenses.retirementAnnualExpenses).toBe(70000);

    // no spouse for single person
    expect(result.spouse).toBeUndefined();
  });

  it('couple case (spouse toggle on) populates spouse field', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'ON',
        retirementAge: 60,
        lifeExpectancy: 85,
        includeSpouse: true,
      },
      spouse: {
        dateOfBirth: '1978-03-20',
        retirementAge: 62,
        lifeExpectancy: 88,
        province: 'ON',
      },
    });

    const result = assembleProfileInputData(profile);

    expect(result.spouse).toBeDefined();
    expect(result.spouse?.dateOfBirth).toBe('1978-03-20');
    expect(result.spouse?.retirementAge).toBe(62);
  });

  it('empty/partial profile returns valid FrontendInputData with all defaults', () => {
    const profile = makeProfile({});

    const result = assembleProfileInputData(profile);

    // personalInfo defaults
    expect(result.personalInfo.dateOfBirth).toBe('1970-01-01');
    expect(result.personalInfo.province).toBe('ON');
    expect(result.personalInfo.retirementAge).toBe(65);
    expect(result.personalInfo.lifeExpectancy).toBe(90);

    // empty arrays
    expect(result.accounts).toEqual([]);
    expect(result.incomeSources).toEqual([]);

    // government benefits defaults (D-02)
    expect(result.governmentBenefits.cppStartAge).toBe(65);
    expect(result.governmentBenefits.oasStartAge).toBe(65);

    // expenses defaults (D-01)
    expect(result.expenses.currentAnnualExpenses).toBe(0);
    expect(result.expenses.retirementAnnualExpenses).toBe(0);

    // no spouse
    expect(result.spouse).toBeUndefined();
  });
});

describe('retirement spending & coupleSettings wiring', () => {
  it('reads property_goals.retirementSpending when set (overrides 70%-of-income default)', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      income: { cards: [{ type: 'Employment Salary', annualAmount: 100000 }] },
      property_goals: { retirementSpending: 60000 },
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.retirementAnnualExpenses).toBe(60000);
  });

  it('falls back to 70%-of-income when property_goals.retirementSpending is missing or blank', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      income: { cards: [{ type: 'Employment Salary', annualAmount: 100000 }] },
      property_goals: { retirementSpending: '' },
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.retirementAnnualExpenses).toBe(70000);
  });

  it('couple case: sets coupleSettings.sharedRetirementSpending so engine does not double household spend', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: true },
      spouse: { dateOfBirth: '1982-01-01' },
      property_goals: { retirementSpending: 87500 },
    });
    const result = assembleProfileInputData(profile);
    expect(result.coupleSettings?.sharedRetirementSpending).toBe(87500);
    expect(result.expenses.retirementAnnualExpenses).toBe(87500);
  });

  it('single person: does not set coupleSettings', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      property_goals: { retirementSpending: 50000 },
    });
    const result = assembleProfileInputData(profile);
    expect(result.coupleSettings).toBeUndefined();
  });
});

describe('spending step (new slot)', () => {
  it('reads spending.retirementAnnualSpending and prefers it over legacy property_goals.retirementSpending', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      income: { cards: [{ type: 'Employment Salary', annualAmount: 100000 }] },
      spending: { retirementAnnualSpending: 55000, currentAnnualSpending: 80000 },
      property_goals: { retirementSpending: 999999 }, // legacy, must be ignored
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.retirementAnnualExpenses).toBe(55000);
  });

  it('reads spending.currentAnnualSpending into expenses.currentAnnualExpenses', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      income: { cards: [{ type: 'Employment Salary', annualAmount: 100000 }] },
      spending: { retirementAnnualSpending: 55000, currentAnnualSpending: 80000 },
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.currentAnnualExpenses).toBe(80000);
    expect(result.expenses.retirementAnnualExpenses).toBe(55000);
  });

  it('falls back to legacy property_goals.retirementSpending when spending slot is empty', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      income: { cards: [{ type: 'Employment Salary', annualAmount: 100000 }] },
      spending: {},
      property_goals: { retirementSpending: 60000 },
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.retirementAnnualExpenses).toBe(60000);
  });

  it('currentAnnualExpenses falls back to retirementAnnualExpenses when only retirement is provided', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      income: { cards: [{ type: 'Employment Salary', annualAmount: 100000 }] },
      spending: { retirementAnnualSpending: 55000 },
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.currentAnnualExpenses).toBe(55000);
    expect(result.expenses.retirementAnnualExpenses).toBe(55000);
  });

  it('maps wizard debts into annual debt payments for projection cash flow', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: false },
      spending: { retirementAnnualSpending: 55000, currentAnnualSpending: 80000 },
      debts: [
        { type: 'Mortgage', label: 'Home mortgage', monthlyPayment: '1800' },
        { type: 'Car Loan', label: 'Car', monthlyPayment: 500, amortizationYears: '4' },
        { type: 'Other', label: 'Ignored blank', monthlyPayment: '' },
      ],
    });
    const result = assembleProfileInputData(profile);
    expect(result.expenses.retirementAnnualExpenses).toBe(55000);
    expect(result.expenses.debtPaymentsAnnual).toBe(27600);
    expect(result.expenses.debtPaymentYears).toBe(4);
  });

  it('couple: spending.retirementAnnualSpending flows into coupleSettings.sharedRetirementSpending', () => {
    const profile = makeProfile({
      about_you: { dateOfBirth: '1980-01-01', retirementAge: 65, includeSpouse: true },
      spouse: { dateOfBirth: '1982-01-01' },
      spending: { retirementAnnualSpending: 92000 },
      property_goals: { retirementSpending: 50000 }, // legacy, must be ignored
    });
    const result = assembleProfileInputData(profile);
    expect(result.coupleSettings?.sharedRetirementSpending).toBe(92000);
    expect(result.expenses.retirementAnnualExpenses).toBe(92000);
  });
});

describe('FIX-01: raw array frontend shape', () => {
  it('raw array accounts shape (frontend format) maps correctly', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [
        {
          _serverId: undefined,
          type: 'RRSP',
          label: 'My RRSP',
          belongsTo: 'primary',
          currentBalance: '250000',
          expectedReturn: '6.5',
          annualContribution: '10000',
          contributionEndCondition: 'at-retirement',
        },
      ],
    });

    const result = assembleProfileInputData(profile);

    expect(result.accounts.length).toBe(1);
    expect(result.accounts[0]?.type).toBe('RRSP');
    expect(result.accounts[0]?.balance).toBe(250000);
    expect(result.accounts[0]?.investmentReturnRate).toBe(6.5);
    expect(result.accounts[0]?.annualContribution).toBe(10000);
  });

  it('raw array income shape (frontend format) maps correctly', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      income: [
        {
          _serverId: undefined,
          type: 'Employment Salary',
          label: 'Salary',
          belongsTo: 'primary',
          annualAmount: '120000',
          growthRate: '2',
          endCondition: 'at-retirement',
        },
      ],
    });

    const result = assembleProfileInputData(profile);

    expect(result.incomeSources.length).toBe(1);
    expect(result.incomeSources[0]?.type).toBe('employment');
    expect(result.incomeSources[0]?.annualAmount).toBe(120000);
  });

  it('raw array with multiple account types maps all correctly', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [
        {
          type: 'RRSP',
          label: 'My RRSP',
          currentBalance: '150000',
          expectedReturn: '6',
          annualContribution: '5000',
        },
        {
          type: 'TFSA',
          label: 'My TFSA',
          currentBalance: '80000',
          expectedReturn: '5',
          annualContribution: '7000',
        },
        {
          type: 'Non-Registered',
          label: 'Investment',
          currentBalance: '50000',
          expectedReturn: '4.5',
        },
      ],
    });

    const result = assembleProfileInputData(profile);

    expect(result.accounts.length).toBe(3);
    expect(result.accounts[0]?.type).toBe('RRSP');
    expect(result.accounts[0]?.balance).toBe(150000);
    expect(result.accounts[1]?.type).toBe('TFSA');
    expect(result.accounts[1]?.balance).toBe(80000);
    expect(result.accounts[2]?.type).toBe('NonRegistered');
    expect(result.accounts[2]?.balance).toBe(50000);
  });

  it('preserves non-registered ACB and supported annual income breakdown fields', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [
        {
          type: 'Non-Registered',
          label: 'Taxable portfolio',
          currentBalance: '125000',
          adjustedCostBase: '90000',
          annualInterestIncome: '1000',
          annualEligibleDividends: '2000',
          annualNonEligibleDividends: '500',
          annualRealizedCapitalGains: '1500',
        },
      ],
    });

    const result = assembleProfileInputData(profile);

    expect(result.accounts[0]).toMatchObject({
      type: 'NonRegistered',
      balance: 125000,
      adjustedCostBase: 90000,
      annualInterestIncome: 1000,
      annualEligibleDividends: 2000,
      annualNonEligibleDividends: 500,
      annualRealizedCapitalGains: 1500,
    });
  });

  it('mixed: accounts raw array + income cards wrapper both map correctly', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1975-06-15',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [
        {
          type: 'RRSP',
          currentBalance: '200000',
          expectedReturn: '6',
          annualContribution: '8000',
        },
      ],
      income: {
        cards: [
          {
            type: 'Employment Salary',
            label: 'Job',
            annualAmount: 90000,
            belongsTo: 'primary',
          },
        ],
      },
    });

    const result = assembleProfileInputData(profile);

    expect(result.accounts.length).toBe(1);
    expect(result.accounts[0]?.type).toBe('RRSP');
    expect(result.accounts[0]?.balance).toBe(200000);

    expect(result.incomeSources.length).toBe(1);
    expect(result.incomeSources[0]?.type).toBe('employment');
    expect(result.incomeSources[0]?.annualAmount).toBe(90000);
  });

  it('preserves account ownership metadata needed by couple projections', () => {
    const profile = makeProfile({
      about_you: {
        dateOfBirth: '1985-08-30',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
        includeSpouse: true,
      },
      spouse: {
        dateOfBirth: '1984-04-03',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [
        {
          type: 'TFSA',
          label: 'TFSA - Spouse',
          belongsTo: 'spouse',
          currentBalance: '0',
          annualContribution: '7000',
        },
        {
          type: 'RRSP',
          label: 'Spousal RRSP',
          belongsTo: 'spouse',
          currentBalance: '0',
          annualContribution: '19000',
          contributionRoom: 30000,
          contributorOwner: 'primary',
        },
      ],
    });

    const result = assembleProfileInputData(profile);

    expect(result.accounts[0]?.belongsTo).toBe('spouse');
    expect(result.accounts[1]?.belongsTo).toBe('spouse');
    expect(result.accounts[1]?.contributionRoom).toBe(30000);
    expect(result.accounts[1]?.contributorOwner).toBe('primary');
  });
});
