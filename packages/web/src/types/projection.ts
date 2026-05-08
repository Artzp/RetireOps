/**
 * Projection types for frontend display
 */
import type { ProjectionYearRow } from '@retireops/shared';

export interface ProjectionDetail {
  id: string;
  name: string;
  description: string | null;
  status: 'pending' | 'completed' | 'failed';
  inputData: ProjectionInputData;
  resultData: ProjectionResultData | null;
  calculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionInputData {
  personalInfo: {
    dateOfBirth: string | Date;
    province: string;
    gender?: 'male' | 'female' | 'other';
    maritalStatus?: 'single' | 'married' | 'commonLaw' | 'divorced' | 'widowed';
    retirementAge: number;
    lifeExpectancy: number;
  };
  spouse?: {
    dateOfBirth?: string | Date;
    province?: string;
    retirementAge?: number;
    lifeExpectancy?: number;
    employmentIncome?: number;
    incomeEndAge?: number;
    expectedCppAt65?: number;
    cppStartAge?: number;
    oasStartAge?: number;
    yearsOfResidence?: number;
    rrspBalance?: number;
    rrspAnnualContribution?: number;
    tfsaBalance?: number;
    tfsaAnnualContribution?: number;
    nonRegBalance?: number;
  };
  coupleSettings?: {
    optimizePensionSplitting?: boolean;
    sharedRetirementSpending?: number;
    useYoungerSpouseForRRIF?: boolean;
  };
  accounts: Array<{
    type: string;
    name?: string;
    balance: number;
    annualContribution?: number;
    investmentReturnRate?: number;
    jurisdiction?: string;
    belongsTo?: 'primary' | 'spouse';
    contributorOwner?: 'primary' | 'spouse';
    contributionRoom?: number;
  }>;
  incomeSources: Array<{
    type: string;
    name?: string;
    annualAmount: number;
    startAge?: number;
    endAge?: number;
    isIndexed?: boolean;
    indexationRate?: number;
  }>;
  governmentBenefits: {
    cppStartAge: number;
    oasStartAge: number;
    estimatedCppAmount?: number;
    yearsContributedToCpp?: number;
  };
  expenses: {
    currentAnnualExpenses: number;
    retirementAnnualExpenses: number;
    oneTimeExpenses?: Array<{
      description: string;
      amount: number;
      year: number;
    }>;
  };
  assumptions?: {
    inflationRate?: number;
    investmentReturnRate?: number;
  };
}

export interface ProjectionResultData {
  summary: ProjectionSummary;
  yearlyResults: YearlyResult[];
  projectionRows?: ProjectionYearRow[];
  error?: string;
}

export interface ProjectionSummary {
  peakNetWorth: number;
  portfolioLongevity: number;
  totalTaxesPaid: number;
  averageRetirementIncome: number;
  probabilityOfSuccess: number;
  startYear: number;
  endYear: number;
  retirementYear: number;
  yearsInRetirement: number;
}

export interface YearlyResult {
  year: number;
  age: number;
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  oasIncome: number;
  withdrawals: number;
  totalIncome: number;
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  netIncome: number;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalNetWorth: number;
}

export interface ProjectionListItem {
  id: string;
  name: string;
  description: string | null;
  status: 'pending' | 'completed' | 'failed';
  calculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  probabilityOfSuccess?: number;
  peakNetWorth?: number;
  averageRetirementIncome?: number;
  retirementAge?: number;
  dateOfBirth?: string;
}

export interface PaginatedProjections {
  items: ProjectionListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
