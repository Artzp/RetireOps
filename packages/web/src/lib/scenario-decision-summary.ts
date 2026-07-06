import type { ScenarioDecisions } from '@retireops/shared/types';

const STRATEGY_LABELS: Record<string, string> = {
  standard: 'Standard drawdown',
  tfsaFirst: 'TFSA-first drawdown',
  oasProtection: 'OAS-protection drawdown',
  bracketFilling: 'Bracket-filling drawdown',
};

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString('en-CA', { maximumFractionDigits: 1 })}%`;
}

function dollars(amount: number): string {
  return `$${amount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
}

/**
 * Human-readable one-liners for what a scenario overrides vs the profile.
 * Rendered as chips on scenario cards so users don't have to open Edit
 * Decisions to learn what "Reduced Spending in Later Years" actually does.
 * Purely presentational — reads the stored decisions, computes nothing.
 */
export function summarizeScenarioDecisions(raw: Record<string, unknown>): string[] {
  const d = raw as ScenarioDecisions;
  const chips: string[] = [];

  if (d.retirementAge !== undefined) chips.push(`Retire at ${String(d.retirementAge)}`);
  if (d.spouseRetirementAge !== undefined)
    chips.push(`Spouse retires at ${String(d.spouseRetirementAge)}`);
  if (d.lifeExpectancy !== undefined) chips.push(`Plan to age ${String(d.lifeExpectancy)}`);
  if (d.spouseLifeExpectancy !== undefined)
    chips.push(`Spouse plans to age ${String(d.spouseLifeExpectancy)}`);
  if (d.cppStartAge !== undefined) chips.push(`CPP at ${String(d.cppStartAge)}`);
  if (d.spouseCppStartAge !== undefined) chips.push(`Spouse CPP at ${String(d.spouseCppStartAge)}`);
  if (d.oasStartAge !== undefined) chips.push(`OAS at ${String(d.oasStartAge)}`);
  if (d.spouseOasStartAge !== undefined) chips.push(`Spouse OAS at ${String(d.spouseOasStartAge)}`);
  if (d.expectedCPPAt65 !== undefined) chips.push(`CPP estimate ${dollars(d.expectedCPPAt65)}/yr`);
  if (d.spouseExpectedCPPAt65 !== undefined)
    chips.push(`Spouse CPP estimate ${dollars(d.spouseExpectedCPPAt65)}/yr`);
  if (d.dbPensionStartAge !== undefined) chips.push(`DB pension at ${String(d.dbPensionStartAge)}`);
  if (d.yearsOfResidence !== undefined)
    chips.push(`${String(d.yearsOfResidence)} yrs Canadian residence`);
  if (d.spouseYearsOfResidence !== undefined)
    chips.push(`Spouse ${String(d.spouseYearsOfResidence)} yrs residence`);
  for (const sale of d.propertySaleDecisions ?? []) {
    chips.push(`Sell property in ${String(sale.saleYear)}`);
  }

  if (d.targetRetirementSpending !== undefined)
    chips.push(`Spending ${dollars(d.targetRetirementSpending)}/yr`);
  for (const band of d.ageBandReductions ?? []) {
    chips.push(`−${pct(band.reductionPercent)} spending from ${String(band.fromAge)}`);
  }
  if (d.inflationRate !== undefined) chips.push(`Inflation ${pct(d.inflationRate)}`);
  if (d.investmentReturn !== undefined) chips.push(`Returns ${pct(d.investmentReturn)}`);
  if (d.legacyTarget !== undefined) chips.push(`Legacy ${dollars(d.legacyTarget)}`);

  if (d.strategyId !== undefined) chips.push(STRATEGY_LABELS[d.strategyId] ?? d.strategyId);
  else if (d.drawdownOrder !== undefined) chips.push('Custom drawdown order');
  if (d.rrspMeltdown?.enabled)
    chips.push(`RRSP meltdown ${dollars(d.rrspMeltdown.annualAmount)}/yr`);
  if (d.incomeSplitting?.enabled)
    chips.push(`Income splitting ${pct(d.incomeSplitting.splitPercent)}`);
  if (d.oasClawbackAvoidance?.enabled) chips.push('OAS clawback guard');
  if (d.bracketFill?.enabled) chips.push('Bracket filling');
  if (d.householdSpendingMode === 'household') chips.push('Pooled household spending');

  const contributionCount = d.contributionOverrides?.length ?? 0;
  if (contributionCount > 0)
    chips.push(
      `${String(contributionCount)} contribution override${contributionCount === 1 ? '' : 's'}`
    );
  const withdrawalCount = d.withdrawalOverrides?.length ?? 0;
  if (withdrawalCount > 0)
    chips.push(`${String(withdrawalCount)} withdrawal override${withdrawalCount === 1 ? '' : 's'}`);
  const spendingCount = d.spendingOverrides?.length ?? 0;
  if (spendingCount > 0)
    chips.push(
      `${String(spendingCount)} per-year spending override${spendingCount === 1 ? '' : 's'}`
    );

  return chips;
}
