import { DEFAULT_ASSUMPTIONS, DEFAULT_RETURNS } from '@retireops/shared/constants';

export interface SettingsAssumptions {
  inflationRate?: number;
  investmentReturn?: number;
  riskProfile?: string;
  withdrawalStrategy?: string;
}

export interface WizardAssumptionDefaults {
  inflationRate: number;
  investmentReturnRate: number;
  indexingRate: number;
}

export const SETTINGS_ASSUMPTIONS_STORAGE_KEY = 'retireops.settings.assumptions';
export const DEFAULT_ASSUMPTION_COPY = 'Using default assumption. You can change this.';

export const SETTINGS_SAFE_ASSUMPTIONS: Required<SettingsAssumptions> = {
  inflationRate: DEFAULT_ASSUMPTIONS.inflationRate * 100,
  investmentReturn: DEFAULT_RETURNS.moderate * 100,
  riskProfile: 'balanced',
  withdrawalStrategy: 'standard',
};

function finiteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readSettingsAssumptions(): Required<SettingsAssumptions> {
  if (typeof window === 'undefined') {
    return SETTINGS_SAFE_ASSUMPTIONS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_ASSUMPTIONS_STORAGE_KEY);
    if (!raw) {
      return SETTINGS_SAFE_ASSUMPTIONS;
    }

    const parsed = JSON.parse(raw) as Partial<SettingsAssumptions>;
    return {
      inflationRate: finiteNumber(parsed.inflationRate) ?? SETTINGS_SAFE_ASSUMPTIONS.inflationRate,
      investmentReturn:
        finiteNumber(parsed.investmentReturn) ?? SETTINGS_SAFE_ASSUMPTIONS.investmentReturn,
      riskProfile:
        typeof parsed.riskProfile === 'string'
          ? parsed.riskProfile
          : SETTINGS_SAFE_ASSUMPTIONS.riskProfile,
      withdrawalStrategy:
        typeof parsed.withdrawalStrategy === 'string'
          ? parsed.withdrawalStrategy
          : SETTINGS_SAFE_ASSUMPTIONS.withdrawalStrategy,
    };
  } catch {
    return SETTINGS_SAFE_ASSUMPTIONS;
  }
}

export function writeSettingsAssumptions(assumptions: SettingsAssumptions): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SETTINGS_ASSUMPTIONS_STORAGE_KEY, JSON.stringify(assumptions));
}

export function getWizardAssumptionDefaults(): WizardAssumptionDefaults {
  const settings = readSettingsAssumptions();
  return {
    inflationRate: settings.inflationRate,
    investmentReturnRate: settings.investmentReturn,
    indexingRate: settings.inflationRate,
  };
}

export function fillBlankAssumption(
  value: number | string | null | undefined,
  fallback: number
): number | string {
  return value === undefined || value === null || value === '' ? fallback : value;
}
