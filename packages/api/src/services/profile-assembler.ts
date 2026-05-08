/**
 * Profile Assembler
 * Transforms ProfileData (household profile wizard step data) into FrontendInputData
 * for consumption by the calculation engine via transformToProjectionInput.
 *
 * Pure function — no I/O, no DB, no Redis.
 * @see .planning/phases/11-profile-data-flow/11-CONTEXT.md - D-03, D-06
 */
import type { FrontendInputData } from './projection-transformer.js';
import type { ProfileData } from './profile.service.js';

// -------------------------------------------------------------------------
// Internal step interfaces (D-06) — NOT exported
// All fields optional so partial profiles never throw
// -------------------------------------------------------------------------

interface AboutYouStepData {
  dateOfBirth?: string;
  province?: string;
  gender?: 'male' | 'female' | 'other';
  maritalStatus?: 'single' | 'married' | 'commonLaw' | 'divorced' | 'widowed';
  retirementAge?: number;
  lifeExpectancy?: number;
  includeSpouse?: boolean;
  inflationRate?: number | string;
  investmentReturnRate?: number | string;
}

interface SpouseStepData {
  dateOfBirth?: string;
  province?: string;
  gender?: 'male' | 'female' | 'other';
  retirementAge?: number;
  lifeExpectancy?: number;
}

interface IncomeCard {
  type?: string;
  label?: string;
  annualAmount?: number | string;
  belongsTo?: string;
  growthRate?: number | string;
  endCondition?: string;
  endYear?: number;
}

interface IncomeStepData {
  cards?: IncomeCard[];
}

interface AccountCard {
  type?: string;
  label?: string;
  balance?: number | string; // old canonical name
  currentBalance?: number | string; // frontend field name (per D-03)
  returnRate?: number | string; // old canonical name
  expectedReturn?: number | string; // frontend field name (per D-03)
  annualContribution?: number | string;
  belongsTo?: string;
  contributionRoom?: number;
  adjustedCostBase?: number | string;
  annualInterestIncome?: number | string;
  annualEligibleDividends?: number | string;
  annualNonEligibleDividends?: number | string;
  annualRealizedCapitalGains?: number | string;
  employerMatch?: number;
  contributorOwner?: string;
}

interface AccountsStepData {
  cards?: AccountCard[];
}

interface DebtCard {
  monthlyPayment?: number | string;
  amortizationYears?: number | string;
}

interface DebtsStepData {
  cards?: DebtCard[];
}

interface PrimaryBenefits {
  estimatedAnnual?: number;
  percentOfMax?: number;
}

interface OasBenefits {
  estimatedAnnual?: number;
  yearsResidency?: number;
}

interface DbPensionCard {
  planName?: string;
  belongsTo?: string;
  annualPension?: number;
  indexed?: boolean;
  indexRate?: number;
  bridgeBenefit?: boolean;
  bridgeAmount?: number;
  bridgeEndAge?: number;
  survivorPercent?: number;
}

interface DcPensionCard {
  planName?: string;
  belongsTo?: string;
  balance?: number;
  contributionRate?: number;
  employerMatchRate?: number;
  expectedReturn?: number;
}

interface BenefitsStepData {
  // Legacy shape (used by older seeds)
  primaryCpp?: PrimaryBenefits;
  primaryOas?: OasBenefits;
  spouseCpp?: PrimaryBenefits;
  spouseOas?: OasBenefits;
  dbPensions?: DbPensionCard[];
  dcPensions?: DcPensionCard[];
  // Wizard-canonical shape (BenefitsStep.tsx)
  cpp_primary?: PrimaryBenefits;
  cpp_spouse?: PrimaryBenefits;
  oas_primary?: OasBenefits & { residencyYears?: number };
  oas_spouse?: OasBenefits & { residencyYears?: number };
  pensions?: Array<{
    type?: string; // 'DB Pension' | 'DC Pension'
    belongsTo?: string;
    label?: string;
    annualPension?: number | string;
    indexed?: boolean;
    indexingRate?: number | string;
    bridgeBenefit?: boolean;
    bridgeAmount?: number | string;
    bridgeEndsAtAge?: number | string;
    survivorBenefit?: number | string;
  }>;
}

// -------------------------------------------------------------------------
// Type mapping tables (module-level, NOT exported)
// -------------------------------------------------------------------------

const INCOME_TYPE_MAP: Record<string, FrontendInputData['incomeSources'][number]['type']> = {
  'Employment Salary': 'employment',
  'Self-Employment': 'selfEmployment',
  Rental: 'rental',
  Investment: 'investment',
  Other: 'other',
};

const ACCOUNT_TYPE_MAP: Record<string, FrontendInputData['accounts'][number]['type']> = {
  RRSP: 'RRSP',
  TFSA: 'TFSA',
  LIRA: 'LIRA',
  DPSP: 'RRSP',
  ESPP: 'NonRegistered',
  'Non-Registered': 'NonRegistered',
  RESP: 'NonRegistered',
};

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

/**
 * Assemble FrontendInputData from a household profile's wizard step data.
 * Returns valid FrontendInputData with ?? defaults for every missing field.
 * Never throws — partial/empty profiles produce single-person projections with all defaults.
 *
 * Supports dual-shape input (per D-02, D-03, D-04):
 *   - Raw array: profile.stepData['accounts'] = [{ type, currentBalance, expectedReturn, ... }]
 *   - Cards wrapper: profile.stepData['accounts'] = { cards: [{ type, balance, returnRate, ... }] }
 *
 * @see .planning/phases/11-profile-data-flow/11-CONTEXT.md - D-01, D-02, D-03
 */
export function assembleProfileInputData(profile: ProfileData): FrontendInputData {
  // Cast each step once from Record<string, unknown> (D-06)
  const aboutYou = (profile.stepData['about_you'] ?? {}) as AboutYouStepData;
  const spouseStep = (profile.stepData['spouse'] ?? {}) as SpouseStepData;
  // property_goals is read below for legacy retirement spending.
  const benefits = (profile.stepData['benefits'] ?? {}) as BenefitsStepData;

  // -----------------------------------------------------------------------
  // personalInfo — required fields with defaults (D-01, D-02)
  // -----------------------------------------------------------------------
  const personalInfo: FrontendInputData['personalInfo'] = {
    dateOfBirth: aboutYou.dateOfBirth ?? '1970-01-01',
    province: aboutYou.province ?? 'ON',
    retirementAge: aboutYou.retirementAge ?? 65,
    lifeExpectancy: aboutYou.lifeExpectancy ?? 90,
    ...(aboutYou.gender !== undefined ? { gender: aboutYou.gender } : {}),
    ...(aboutYou.maritalStatus !== undefined ? { maritalStatus: aboutYou.maritalStatus } : {}),
  };

  // -----------------------------------------------------------------------
  // spouse — only include when toggle is on and DOB is present (Pattern 2)
  // -----------------------------------------------------------------------
  const spouseData: FrontendInputData['spouse'] | undefined =
    aboutYou.includeSpouse === true && spouseStep.dateOfBirth !== undefined
      ? {
          dateOfBirth: spouseStep.dateOfBirth,
          retirementAge: spouseStep.retirementAge ?? aboutYou.retirementAge ?? 65,
          lifeExpectancy: spouseStep.lifeExpectancy ?? aboutYou.lifeExpectancy ?? 90,
          ...(spouseStep.province !== undefined ? { province: spouseStep.province } : {}),
        }
      : undefined;

  // -----------------------------------------------------------------------
  // accounts — dual-shape detection (per D-02): raw array or cards wrapper
  // -----------------------------------------------------------------------
  const rawAccounts = profile.stepData['accounts'] ?? {};
  const accountCards: AccountCard[] = Array.isArray(rawAccounts)
    ? (rawAccounts as AccountCard[])
    : ((rawAccounts as AccountsStepData).cards ?? []);

  const accountsList: FrontendInputData['accounts'] = accountCards
    .map((card) => {
      const mappedType = ACCOUNT_TYPE_MAP[card.type ?? ''];
      if (mappedType === undefined) return null;
      // Field name alias: prefer frontend name, fall back to old canonical (per D-03)
      const balance = Number(card.currentBalance ?? card.balance ?? 0);
      const returnRate =
        card.expectedReturn !== undefined ? Number(card.expectedReturn) : card.returnRate;
      const contributorOwner: 'primary' | 'spouse' | undefined =
        card.contributorOwner === 'primary' || card.contributorOwner === 'spouse'
          ? card.contributorOwner
          : undefined;
      return {
        type: mappedType,
        ...(card.label !== undefined ? { name: card.label } : {}),
        balance,
        ...(card.annualContribution !== undefined
          ? { annualContribution: Number(card.annualContribution) }
          : {}),
        ...(returnRate !== undefined ? { investmentReturnRate: Number(returnRate) } : {}),
        ...(card.contributionRoom !== undefined
          ? { contributionRoom: Number(card.contributionRoom) }
          : {}),
        ...(card.adjustedCostBase !== undefined
          ? { adjustedCostBase: Number(card.adjustedCostBase) }
          : {}),
        ...(card.annualInterestIncome !== undefined
          ? { annualInterestIncome: Number(card.annualInterestIncome) }
          : {}),
        ...(card.annualEligibleDividends !== undefined
          ? { annualEligibleDividends: Number(card.annualEligibleDividends) }
          : {}),
        ...(card.annualNonEligibleDividends !== undefined
          ? { annualNonEligibleDividends: Number(card.annualNonEligibleDividends) }
          : {}),
        ...(card.annualRealizedCapitalGains !== undefined
          ? { annualRealizedCapitalGains: Number(card.annualRealizedCapitalGains) }
          : {}),
        ...(card.belongsTo === 'spouse' ? { belongsTo: 'spouse' as const } : {}),
        ...(contributorOwner !== undefined ? { contributorOwner } : {}),
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // -----------------------------------------------------------------------
  // incomeSources — dual-shape detection (per D-04): raw array or cards wrapper
  // -----------------------------------------------------------------------
  const rawIncome = profile.stepData['income'] ?? {};
  const incomeCards: IncomeCard[] = Array.isArray(rawIncome)
    ? (rawIncome as IncomeCard[])
    : ((rawIncome as IncomeStepData).cards ?? []);

  const incomeSourcesList: FrontendInputData['incomeSources'] = incomeCards.map((card) => ({
    type: INCOME_TYPE_MAP[card.type ?? ''] ?? 'other',
    ...(card.label !== undefined ? { name: card.label } : {}),
    annualAmount: Number(card.annualAmount ?? 0),
  }));

  // Map DB pensions → pension income sources, starting at the owner's
  // retirement age. Reads both legacy (benefits.dbPensions) and wizard-canonical
  // (benefits.pensions filtered to type='DB Pension') shapes.
  type DbPensionLike = {
    planName?: string;
    label?: string;
    belongsTo?: string;
    annualPension?: number | string;
    indexed?: boolean;
    indexRate?: number | string; // legacy field name
    indexingRate?: number | string; // wizard field name
  };
  const legacyDb: DbPensionLike[] = benefits.dbPensions ?? [];
  const wizardDb: DbPensionLike[] = (benefits.pensions ?? []).filter(
    (p) => p.type === 'DB Pension'
  );
  for (const dbp of [...legacyDb, ...wizardDb]) {
    const annual = Number(dbp.annualPension ?? 0);
    if (annual <= 0) continue;
    const isSpouse = dbp.belongsTo === 'spouse';
    if (isSpouse && spouseData === undefined) continue;
    const startAge = isSpouse
      ? (spouseStep.retirementAge ?? aboutYou.retirementAge ?? 65)
      : (aboutYou.retirementAge ?? 65);
    const indexRateRaw = dbp.indexRate ?? dbp.indexingRate;
    const name = dbp.planName ?? dbp.label;
    incomeSourcesList.push({
      type: 'pension',
      ...(name !== undefined ? { name } : {}),
      annualAmount: annual,
      startAge,
      ...(dbp.indexed === true && indexRateRaw !== undefined
        ? { isIndexed: true, indexationRate: Number(indexRateRaw) }
        : {}),
    });
  }

  // -----------------------------------------------------------------------
  // governmentBenefits — CPP/OAS default to 65 (D-02)
  // -----------------------------------------------------------------------
  // Read CPP from either legacy primaryCpp or wizard cpp_primary
  const primaryCppEstimate =
    benefits.primaryCpp?.estimatedAnnual ?? benefits.cpp_primary?.estimatedAnnual;
  const governmentBenefits: FrontendInputData['governmentBenefits'] = {
    cppStartAge: 65,
    oasStartAge: 65,
    ...(primaryCppEstimate !== undefined ? { estimatedCppAmount: Number(primaryCppEstimate) } : {}),
  };

  // -----------------------------------------------------------------------
  // expenses — read order:
  //   1. stepData.spending.{retirement,current}AnnualSpending (new dedicated step)
  //   2. stepData.property_goals.retirementSpending           (legacy slot, retirement only)
  //   3. 70% of total annual income                           (fallback, retirement only)
  // currentAnnualExpenses falls back to retirementAnnualExpenses to preserve
  // behaviour for profiles that have not yet visited the new step.
  // retirementAnnualExpenses is a HOUSEHOLD target for couples (see
  // coupleSettings.sharedRetirementSpending wiring below).
  // -----------------------------------------------------------------------
  const spendingStep = (profile.stepData['spending'] ?? {}) as {
    currentAnnualSpending?: number | string;
    retirementAnnualSpending?: number | string;
  };
  const propertyGoals = (profile.stepData['property_goals'] ?? {}) as {
    retirementSpending?: number | string;
  };

  const toFiniteNumber = (v: unknown): number | undefined =>
    v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;

  const newRetirement = toFiniteNumber(spendingStep.retirementAnnualSpending);
  const legacyRetirement = toFiniteNumber(propertyGoals.retirementSpending);
  const newCurrent = toFiniteNumber(spendingStep.currentAnnualSpending);

  const totalAnnualIncome = incomeSourcesList.reduce((sum, s) => sum + s.annualAmount, 0);
  const estimatedExpenses = Math.round(totalAnnualIncome * 0.7);

  const retirementAnnualExpenses = newRetirement ?? legacyRetirement ?? estimatedExpenses;
  const currentAnnualExpenses = newCurrent ?? retirementAnnualExpenses;

  const rawDebts = profile.stepData['debts'] ?? {};
  const debtCards: DebtCard[] = Array.isArray(rawDebts)
    ? (rawDebts as DebtCard[])
    : ((rawDebts as DebtsStepData).cards ?? []);
  const annualDebtPayments = debtCards.reduce((sum, card) => {
    const monthlyPayment = toFiniteNumber(card.monthlyPayment) ?? 0;
    return sum + monthlyPayment * 12;
  }, 0);
  const debtPaymentYears = debtCards.reduce((maxYears, card) => {
    const years = toFiniteNumber(card.amortizationYears);
    return years === undefined ? maxYears : Math.max(maxYears, Math.ceil(years));
  }, 0);

  const expenses: FrontendInputData['expenses'] = {
    currentAnnualExpenses,
    retirementAnnualExpenses,
    ...(annualDebtPayments > 0 ? { debtPaymentsAnnual: annualDebtPayments } : {}),
    ...(annualDebtPayments > 0 && debtPaymentYears > 0 ? { debtPaymentYears } : {}),
  };

  // -----------------------------------------------------------------------
  // coupleSettings — pass household spending as shared so the engine splits
  // it per-person. Without this, multi-year.ts applies the full household
  // amount to EACH spouse, doubling the effective retirement budget.
  // @see packages/calculation-engine/src/projection/multi-year.ts — perPersonSpending
  // -----------------------------------------------------------------------
  const coupleSettings: FrontendInputData['coupleSettings'] | undefined =
    spouseData !== undefined ? { sharedRetirementSpending: retirementAnnualExpenses } : undefined;

  // -----------------------------------------------------------------------
  // assumptions — pass through if present in about_you step
  // -----------------------------------------------------------------------
  const assumptions: FrontendInputData['assumptions'] = {
    ...(aboutYou.inflationRate !== undefined
      ? { inflationRate: Number(aboutYou.inflationRate) }
      : {}),
    ...(aboutYou.investmentReturnRate !== undefined
      ? { investmentReturnRate: Number(aboutYou.investmentReturnRate) }
      : {}),
  };
  const hasAssumptions = Object.keys(assumptions).length > 0;

  return {
    personalInfo,
    ...(spouseData !== undefined ? { spouse: spouseData } : {}),
    ...(coupleSettings !== undefined ? { coupleSettings } : {}),
    accounts: accountsList,
    incomeSources: incomeSourcesList,
    governmentBenefits,
    expenses,
    ...(hasAssumptions ? { assumptions } : {}),
  };
}
