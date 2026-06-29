// Pure state factories + decisions->state mapping for the scenario decisions
// editor. Extracted from page.tsx so the page component stays focused on
// orchestration (state, effects, rendering) while this logic stays unit-testable.

import { asString, numVal } from '@/lib/coerce';
import type { AccountCardInfo } from '@/lib/profile-utils';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';
import type { TimingState, TaxState, SavingsState, SpendingState } from './editor-types';

export function defaultTimingState(): TimingState {
  return {
    cppStartAge: 65,
    spouseCppStartAge: 65,
    oasStartAge: 65,
    spouseOasStartAge: 65,
    retirementAge: 65,
    spouseRetirementAge: 65,
    dbPensionStartAge: 65,
    propertySaleDecisions: [],
  };
}

export function defaultTaxState(accounts: AccountCardInfo[]): TaxState {
  return {
    drawdownOrder: accounts.map((a) => a.id),
    rrspMeltdown: { enabled: false, annualAmount: 0, startYear: 2025, endYear: 2030 },
    incomeSplitting: { enabled: false, splitPercent: 50 },
    oasClawbackAvoidance: { enabled: false, incomeThreshold: 90000 },
    bracketFill: { enabled: false, bracketTarget: 'current', annualCap: undefined },
  };
}

export function defaultSavingsState(): SavingsState {
  return { contributionOverrides: [] };
}

export function defaultSpendingState(): SpendingState {
  return {
    targetRetirementSpending: 0,
    inflationRate: 2.0,
    ageBandReductions: [],
    legacyTarget: 0,
  };
}

/**
 * Pure mapping from a scenario's stored decisions to the four editor section
 * states. Extracted (verbatim) from the data-load effect so the coercion logic
 * is readable and unit-testable in isolation; `accounts` supplies the drawdown
 * fallback order when the scenario has no stored order yet.
 */
export function buildFormStates(
  d: ProfileScenarioDetail['decisions'],
  accounts: AccountCardInfo[]
): { timing: TimingState; tax: TaxState; savings: SavingsState; spending: SpendingState } {
  const saleDecs = Array.isArray(d.propertySaleDecisions)
    ? (d.propertySaleDecisions as Record<string, unknown>[]).map((row) => ({
        propertyId: asString(row.propertyId),
        saleYear: numVal(row.saleYear, 2030),
        sellingCostsPercent: numVal(row.sellingCostsPercent, 0) * 100,
      }))
    : [];

  const rrsp = (d.rrspMeltdown as Record<string, unknown> | undefined) ?? {};
  const splitting = (d.incomeSplitting as Record<string, unknown> | undefined) ?? {};
  const oasClawback = (d.oasClawbackAvoidance as Record<string, unknown> | undefined) ?? {};
  const bf = (d.bracketFill as Record<string, unknown> | undefined) ?? {};
  const rawOrder = Array.isArray(d.drawdownOrder)
    ? (d.drawdownOrder as string[])
    : accounts.map((a) => a.id);
  const drawdownOrder = [...new Set(rawOrder)];

  const contribOverrides = Array.isArray(d.contributionOverrides)
    ? (d.contributionOverrides as Record<string, unknown>[]).map((row) => ({
        accountId: asString(row.accountId),
        annualAmount: numVal(row.annualAmount, 0),
        startYear: numVal(row.startYear, 2025),
        endYear: numVal(row.endYear, 2030),
      }))
    : [];

  const ageBandReds = Array.isArray(d.ageBandReductions)
    ? (d.ageBandReductions as Record<string, unknown>[]).map((row) => ({
        fromAge: numVal(row.fromAge, 75),
        reductionPercent: numVal(row.reductionPercent, 0) * 100,
      }))
    : [];

  return {
    timing: {
      cppStartAge: numVal(d.cppStartAge, 65),
      spouseCppStartAge: numVal(d.spouseCppStartAge, 65),
      oasStartAge: numVal(d.oasStartAge, 65),
      spouseOasStartAge: numVal(d.spouseOasStartAge, 65),
      retirementAge: numVal(d.retirementAge, 65),
      spouseRetirementAge: numVal(d.spouseRetirementAge, 65),
      dbPensionStartAge: numVal(d.dbPensionStartAge, 65),
      propertySaleDecisions: saleDecs,
    },
    tax: {
      drawdownOrder,
      rrspMeltdown: {
        enabled: rrsp.enabled === true,
        annualAmount: numVal(rrsp.annualAmount, 0),
        startYear: numVal(rrsp.startYear, 2025),
        endYear: numVal(rrsp.endYear, 2030),
      },
      incomeSplitting: {
        enabled: splitting.enabled === true,
        splitPercent: numVal(splitting.splitPercent, 0.5) * 100,
      },
      oasClawbackAvoidance: {
        enabled: oasClawback.enabled === true,
        incomeThreshold: numVal(oasClawback.incomeThreshold, 90000),
      },
      bracketFill: {
        enabled: bf.enabled === true,
        bracketTarget: bf.bracketTarget === 'next' ? 'next' : 'current',
        // Preserve undefined when the stored decision omits annualCap (means "unlimited").
        annualCap: typeof bf.annualCap === 'number' && bf.annualCap > 0 ? bf.annualCap : undefined,
      },
    },
    savings: { contributionOverrides: contribOverrides },
    spending: {
      targetRetirementSpending: numVal(d.targetRetirementSpending, 0),
      inflationRate: numVal(d.inflationRate, 0.02) * 100,
      ageBandReductions: ageBandReds,
      legacyTarget: numVal(d.legacyTarget, 0),
    },
  };
}
