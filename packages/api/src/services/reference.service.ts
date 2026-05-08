/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/require-await */
import { getCache, setCache } from '../utils/redis.js';
import {
  FEDERAL_TAX_2024,
  PROVINCIAL_TAX_TABLES_2024,
  RRIF_MINIMUM_RATES,
  LIF_RULES,
  getAllLIFJurisdictions,
  getLIFRules,
  type LIFJurisdiction,
  type LIFJurisdictionRules,
} from '@retireops/shared';

// Cache TTL: 24 hours for reference data
const REFERENCE_CACHE_TTL = 86400;

export interface TaxTableResponse {
  year: number;
  federal: typeof FEDERAL_TAX_2024;
  provincial: Record<string, unknown>;
}

export interface BenefitRatesResponse {
  year: number;
  cpp: {
    maxPensionableEarnings: number;
    basicExemption: number;
    contributionRate: number;
    maxMonthlyBenefit: number;
    averageMonthlyBenefit: number;
  };
  oas: {
    maxMonthlyBenefit: number;
    recoveryThreshold: number;
    fullRecoveryThreshold: number;
  };
}

export interface AccountLimitsResponse {
  year: number;
  rrsp: {
    contributionLimit: number;
    contributionPercentage: number;
  };
  tfsa: {
    annualLimit: number;
    cumulativeLimit: number;
  };
  fhsa: {
    annualLimit: number;
    lifetimeLimit: number;
  };
}

export async function getTaxTables(year: number): Promise<TaxTableResponse> {
  const cacheKey = `reference:tax-tables:${year}`;
  const cached = await getCache<TaxTableResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  // For now, return hardcoded 2024 data
  // In production, this would query the config_data table
  const result: TaxTableResponse = {
    year,
    federal: FEDERAL_TAX_2024,
    provincial: PROVINCIAL_TAX_TABLES_2024,
  };

  await setCache(cacheKey, result, REFERENCE_CACHE_TTL);
  return result;
}

export async function getProvincialTaxTable(year: number, province: string): Promise<unknown> {
  const cacheKey = `reference:tax-table:${year}:${province}`;
  const cached = await getCache<unknown>(cacheKey);
  if (cached) {
    return cached;
  }

  const provincialBrackets = PROVINCIAL_TAX_TABLES_2024[province];

  const result = {
    year,
    province,
    brackets: provincialBrackets ?? null,
  };

  await setCache(cacheKey, result, REFERENCE_CACHE_TTL);
  return result;
}

export async function getBenefitRates(year: number): Promise<BenefitRatesResponse> {
  const cacheKey = `reference:benefit-rates:${year}`;
  const cached = await getCache<BenefitRatesResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  // 2024 CPP/OAS rates
  const result: BenefitRatesResponse = {
    year,
    cpp: {
      maxPensionableEarnings: 68500,
      basicExemption: 3500,
      contributionRate: 0.1195, // Combined employee + employer
      maxMonthlyBenefit: 1364.6,
      averageMonthlyBenefit: 816.52,
    },
    oas: {
      maxMonthlyBenefit: 713.34,
      recoveryThreshold: 86912,
      fullRecoveryThreshold: 142609,
    },
  };

  await setCache(cacheKey, result, REFERENCE_CACHE_TTL);
  return result;
}

export async function getAccountLimits(year: number): Promise<AccountLimitsResponse> {
  const cacheKey = `reference:account-limits:${year}`;
  const cached = await getCache<AccountLimitsResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  // 2024 limits
  const result: AccountLimitsResponse = {
    year,
    rrsp: {
      contributionLimit: 31560,
      contributionPercentage: 0.18,
    },
    tfsa: {
      annualLimit: 7000,
      cumulativeLimit: 95000, // For someone who was 18+ in 2009
    },
    fhsa: {
      annualLimit: 8000,
      lifetimeLimit: 40000,
    },
  };

  await setCache(cacheKey, result, REFERENCE_CACHE_TTL);
  return result;
}

export async function getRRIFMinimumRates(): Promise<typeof RRIF_MINIMUM_RATES> {
  const cacheKey = 'reference:rrif-rates';
  const cached = await getCache<typeof RRIF_MINIMUM_RATES>(cacheKey);
  if (cached) {
    return cached;
  }

  await setCache(cacheKey, RRIF_MINIMUM_RATES, REFERENCE_CACHE_TTL);
  return RRIF_MINIMUM_RATES;
}

export async function getProvinces(): Promise<Array<{ code: string; name: string }>> {
  return [
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
  ];
}

export interface LIFRulesResponse {
  jurisdictions: Array<{ code: LIFJurisdiction; name: string }>;
  rules: Record<LIFJurisdiction, LIFJurisdictionRules>;
}

export async function getAllLIFRulesData(): Promise<LIFRulesResponse> {
  const cacheKey = 'reference:lif-rules';
  const cached = await getCache<LIFRulesResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const result: LIFRulesResponse = {
    jurisdictions: getAllLIFJurisdictions(),
    rules: LIF_RULES,
  };

  await setCache(cacheKey, result, REFERENCE_CACHE_TTL);
  return result;
}

export async function getLIFRulesForJurisdiction(
  jurisdiction: LIFJurisdiction
): Promise<LIFJurisdictionRules & { jurisdiction: LIFJurisdiction }> {
  const cacheKey = `reference:lif-rules:${jurisdiction}`;
  const cached = await getCache<LIFJurisdictionRules & { jurisdiction: LIFJurisdiction }>(cacheKey);
  if (cached) {
    return cached;
  }

  const rules = getLIFRules(jurisdiction);
  const result = { ...rules, jurisdiction };

  await setCache(cacheKey, result, REFERENCE_CACHE_TTL);
  return result;
}
