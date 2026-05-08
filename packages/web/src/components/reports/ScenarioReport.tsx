/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { ReactNode } from 'react';
import { formatCurrency, formatPercentage } from '@/lib/utils';

type FundedState = 'green' | 'yellow' | 'red';

interface FundedStatusShape {
  state: FundedState;
  depletionAge: number | null;
  balanceAtLifeExpectancy: number;
  totalRetirementWithdrawals: number;
}

interface RemediationPlanShape {
  additionalAnnualSavings: number;
  annualSpendingReduction: number;
  retirementDelayYears: number;
  delayCapReached: boolean;
}

interface LedgerWarningShape {
  year: number;
  person: 'primary' | 'spouse';
  accountType: string;
  kind: string;
  message: string;
  penaltyAmount: number;
}

interface ReportSummaryShape {
  peakNetWorth?: number;
  peakNetWorthYear?: number;
  portfolioLongevity?: number;
  portfolioLongevityAge?: number | null;
  moneyLastsToLifeExpectancy?: boolean;
  totalTaxesPaid?: number;
  averageRetirementIncome?: number;
  averageEffectiveTaxRate?: number;
  startYear?: number;
  endYear?: number;
  retirementYear?: number;
  yearsInRetirement?: number;
  lowestNetWorth?: number;
  fundedStatus?: FundedStatusShape;
  remediationPlan?: RemediationPlanShape | null;
  ledgerWarnings?: LedgerWarningShape[];
}

interface ReportAssumptionsShape {
  inflationRate?: number;
  investmentReturn?: number;
  province?: string;
  retirementAge?: number;
  lifeExpectancy?: number;
  cppStartAge?: number;
  oasStartAge?: number;
  yearsOfResidence?: number;
  expectedCPPAt65?: number;
  taxYear?: number;
  federalTaxTableYear?: number;
}

interface ProjectionRowShape {
  year?: number;
  age?: number;
  spouseAge?: number;
  totalGrossIncome?: number;
  totalIncome?: number;
  totalTax?: number;
  livingExpenses?: number;
  totalNetWorth?: number;
  householdNetWorth?: number;
}

export interface ScenarioReportData {
  summary?: ReportSummaryShape;
  assumptions?: ReportAssumptionsShape;
  projectionRows?: ProjectionRowShape[];
}

export interface ScenarioReportProps {
  scenarioName: string;
  generatedAt: Date;
  resultData: ScenarioReportData | null;
}

const DISCLAIMER =
  'This report is for educational planning only. It is not financial, tax, or legal advice. RetireOps is in beta — values are estimates and may rely on incomplete or older assumptions.';

const FUNDED_STATE_LABEL: Record<FundedState, string> = {
  green: 'On track',
  yellow: 'Marginal — small buffer at life expectancy',
  red: 'Underfunded — portfolio is projected to run out',
};

const ACCOUNT_LABEL: Record<string, string> = {
  rrsp: 'RRSP',
  rrif: 'RRIF',
  tfsa: 'TFSA',
  fhsa: 'FHSA',
  lira: 'LIRA',
  lif: 'LIF',
  'non-reg': 'Non-registered',
};

const WARNING_KIND_LABEL: Record<string, string> = {
  'over-contribution': 'over-contribution penalty',
  'lifetime-cap-exceeded': 'lifetime contribution cap exceeded',
};

function plainAccount(code: string): string {
  return ACCOUNT_LABEL[code.toLowerCase()] ?? code.toUpperCase();
}

function plainKind(code: string): string {
  return WARNING_KIND_LABEL[code] ?? code.replace(/-/g, ' ');
}

function plainPerson(code: 'primary' | 'spouse'): string {
  return code === 'spouse' ? 'Spouse' : 'You';
}

function formatGeneratedDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

function Section({
  title,
  children,
  breakBefore = false,
}: {
  title: string;
  children: ReactNode;
  breakBefore?: boolean;
}) {
  return (
    <section
      className={`report-section mb-6 ${breakBefore ? 'report-yearly-break' : ''}`}
      aria-label={title}
    >
      <h2 className="text-lg font-semibold border-b border-gray-400 pb-1 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function KeyValueRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-gray-700">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}

function buildWarnings(summary: ReportSummaryShape | undefined): string[] {
  if (!summary) return [];
  const out: string[] = [];

  if (summary.moneyLastsToLifeExpectancy === false) {
    out.push(
      'Portfolio runs out before life expectancy. Consider increasing savings, delaying retirement, or reducing planned spending.'
    );
  }
  if (summary.portfolioLongevityAge !== undefined && summary.portfolioLongevityAge !== null) {
    out.push(
      `Portfolio is exhausted at age ${summary.portfolioLongevityAge}. Adjust withdrawal rate or retirement timing.`
    );
  }
  if (summary.averageEffectiveTaxRate !== undefined && summary.averageEffectiveTaxRate > 0.3) {
    const pct = Math.round(summary.averageEffectiveTaxRate * 100);
    out.push(
      `High average effective tax rate (${pct}%). Consider RRIF meltdown timing or income-splitting strategies.`
    );
  }

  for (const lw of summary.ledgerWarnings ?? []) {
    const person = plainPerson(lw.person);
    const account = plainAccount(lw.accountType);
    const kind = plainKind(lw.kind);
    const penalty =
      lw.penaltyAmount > 0
        ? ` Estimated CRA penalty: ${formatCurrency(lw.penaltyAmount)}/month.`
        : '';
    out.push(`${lw.year} — ${person} ${account}: ${lw.message} (${kind}).${penalty}`);
  }

  return out;
}

function ExecutiveSummary({ summary }: { summary: ReportSummaryShape | undefined }) {
  if (!summary) {
    return <p className="text-sm text-gray-700">No projection results are available yet.</p>;
  }

  const lines: string[] = [];

  if (summary.retirementYear !== undefined) {
    lines.push(`Retirement begins in ${summary.retirementYear}.`);
  }
  if (summary.peakNetWorth !== undefined && summary.peakNetWorthYear !== undefined) {
    lines.push(
      `Peak portfolio value of ${formatCurrency(summary.peakNetWorth)} is reached in ${summary.peakNetWorthYear}.`
    );
  } else if (summary.peakNetWorth !== undefined) {
    lines.push(`Peak portfolio value: ${formatCurrency(summary.peakNetWorth)}.`);
  }
  if (summary.fundedStatus !== undefined) {
    lines.push(`Outlook: ${FUNDED_STATE_LABEL[summary.fundedStatus.state]}.`);
  }
  if (summary.moneyLastsToLifeExpectancy === true) {
    lines.push('Funds are projected to last through life expectancy.');
  } else if (summary.moneyLastsToLifeExpectancy === false) {
    lines.push('Funds are not projected to last through life expectancy.');
  }
  if (summary.totalTaxesPaid !== undefined) {
    lines.push(`Total lifetime taxes paid: ${formatCurrency(summary.totalTaxesPaid)}.`);
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-800">
      {lines.length > 0 ? (
        lines.map((line, i) => <p key={i}>{line}</p>)
      ) : (
        <p>No summary data is available for this scenario.</p>
      )}
    </div>
  );
}

function AssumptionsTable({ assumptions }: { assumptions: ReportAssumptionsShape | undefined }) {
  const a = assumptions ?? {};
  const federalYear = a.federalTaxTableYear ?? 2026;
  return (
    <div>
      <div className="space-y-0">
        {a.province !== undefined && <KeyValueRow label="Province">{a.province}</KeyValueRow>}
        {a.retirementAge !== undefined && (
          <KeyValueRow label="Retirement age">{a.retirementAge}</KeyValueRow>
        )}
        {a.lifeExpectancy !== undefined && (
          <KeyValueRow label="Life expectancy">{a.lifeExpectancy}</KeyValueRow>
        )}
        {a.inflationRate !== undefined && (
          <KeyValueRow label="Inflation rate">{formatPercentage(a.inflationRate)}</KeyValueRow>
        )}
        {a.investmentReturn !== undefined && (
          <KeyValueRow label="Investment return">
            {formatPercentage(a.investmentReturn)}
          </KeyValueRow>
        )}
        {a.cppStartAge !== undefined && (
          <KeyValueRow label="CPP start age">{a.cppStartAge}</KeyValueRow>
        )}
        {a.oasStartAge !== undefined && (
          <KeyValueRow label="OAS start age">{a.oasStartAge}</KeyValueRow>
        )}
        {a.yearsOfResidence !== undefined && (
          <KeyValueRow label="Years of Canadian residence">{a.yearsOfResidence}</KeyValueRow>
        )}
        {a.expectedCPPAt65 !== undefined && (
          <KeyValueRow label="Expected CPP at 65">{formatCurrency(a.expectedCPPAt65)}</KeyValueRow>
        )}
        {a.taxYear !== undefined && <KeyValueRow label="Tax year">{a.taxYear}</KeyValueRow>}
      </div>
      <p className="text-xs text-gray-600 mt-3">
        {`Tax tables: Federal ${federalYear}; provincial tables may use the latest available published values.`}
      </p>
    </div>
  );
}

function MoneyLongevity({ summary }: { summary: ReportSummaryShape | undefined }) {
  if (!summary?.fundedStatus) {
    return <p className="text-sm text-gray-700">Funded-status data is not available.</p>;
  }
  const { fundedStatus, portfolioLongevityAge, moneyLastsToLifeExpectancy, remediationPlan } =
    summary;

  return (
    <div className="space-y-2 text-sm text-gray-800">
      <p>
        <strong>Outlook: </strong>
        {FUNDED_STATE_LABEL[fundedStatus.state]}.
      </p>
      {fundedStatus.depletionAge !== null && fundedStatus.depletionAge !== undefined ? (
        <p>Portfolio is projected to be depleted at age {fundedStatus.depletionAge}.</p>
      ) : moneyLastsToLifeExpectancy ? (
        <p>
          Portfolio is projected to last through life expectancy with a balance of{' '}
          {formatCurrency(fundedStatus.balanceAtLifeExpectancy)}.
        </p>
      ) : null}
      {portfolioLongevityAge !== null && portfolioLongevityAge !== undefined ? (
        <p>Portfolio longevity reaches age {portfolioLongevityAge}.</p>
      ) : null}
      <p className="text-xs italic text-gray-500">
        Single projected path &mdash; actual outcomes will vary depending on market returns.
      </p>

      {fundedStatus.state === 'red' && remediationPlan ? (
        <div className="mt-3">
          <p className="font-medium">Suggested remediation (each lever, applied independently):</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {remediationPlan.additionalAnnualSavings > 0 ? (
              <li>
                Increase pre-retirement savings by{' '}
                {formatCurrency(remediationPlan.additionalAnnualSavings)} per year.
              </li>
            ) : null}
            {remediationPlan.annualSpendingReduction > 0 ? (
              <li>
                Reduce annual retirement spending by{' '}
                {formatCurrency(remediationPlan.annualSpendingReduction)}.
              </li>
            ) : null}
            {remediationPlan.retirementDelayYears > 0 ? (
              <li>
                Delay retirement by {remediationPlan.retirementDelayYears}{' '}
                {remediationPlan.retirementDelayYears === 1 ? 'year' : 'years'}
                {remediationPlan.delayCapReached
                  ? ' (delay alone may not be sufficient — consider combined adjustments)'
                  : ''}
                .
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function pickIncome(row: ProjectionRowShape): number {
  if (row.totalGrossIncome !== undefined) return row.totalGrossIncome;
  if (row.totalIncome !== undefined) return row.totalIncome;
  return 0;
}

function YearByYearTable({ rows }: { rows: ProjectionRowShape[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-700">No projection rows are available.</p>;
  }
  const isCouple = rows.some((r) => r.spouseAge !== undefined);

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b-2 border-gray-600 text-left">
          <th className="py-1 pr-2 font-semibold">Year</th>
          <th className="py-1 px-2 font-semibold">Age</th>
          {isCouple ? <th className="py-1 px-2 font-semibold">Spouse age</th> : null}
          <th className="py-1 px-2 font-semibold text-right">Total income</th>
          <th className="py-1 px-2 font-semibold text-right">Total tax</th>
          <th className="py-1 px-2 font-semibold text-right">Living expenses</th>
          <th className="py-1 pl-2 font-semibold text-right">Net worth</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const netWorth =
            isCouple && r.householdNetWorth !== undefined
              ? r.householdNetWorth
              : (r.totalNetWorth ?? 0);
          return (
            <tr key={i} className="border-b border-gray-300">
              <td className="py-1 pr-2 tabular-nums">{r.year ?? ''}</td>
              <td className="py-1 px-2 tabular-nums">{r.age ?? ''}</td>
              {isCouple ? <td className="py-1 px-2 tabular-nums">{r.spouseAge ?? ''}</td> : null}
              <td className="py-1 px-2 tabular-nums text-right">{formatCurrency(pickIncome(r))}</td>
              <td className="py-1 px-2 tabular-nums text-right">
                {formatCurrency(r.totalTax ?? 0)}
              </td>
              <td className="py-1 px-2 tabular-nums text-right">
                {formatCurrency(r.livingExpenses ?? 0)}
              </td>
              <td className="py-1 pl-2 tabular-nums text-right">{formatCurrency(netWorth)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ScenarioReport({ scenarioName, generatedAt, resultData }: ScenarioReportProps) {
  const summary = resultData?.summary;
  const assumptions = resultData?.assumptions;
  const projectionRows = resultData?.projectionRows ?? [];
  const warnings = buildWarnings(summary);
  const generatedLabel = formatGeneratedDate(generatedAt);

  return (
    <article className="bg-white text-gray-900 max-w-4xl mx-auto p-6 print:p-0 print:max-w-none">
      <header className="mb-6 border-b-2 border-gray-700 pb-4">
        <p className="text-xs uppercase tracking-wide text-gray-600">RetireOps</p>
        <h1 className="text-2xl font-bold mt-1">Scenario Report</h1>
        <p className="text-base mt-1">{scenarioName}</p>
        <p className="text-sm text-gray-600 mt-1">Generated {generatedLabel}</p>
      </header>

      <div className="report-section mb-6 border border-gray-400 rounded p-3 text-sm bg-gray-50 print:bg-white">
        <strong>Disclaimer.</strong> {DISCLAIMER}
      </div>

      <Section title="Executive summary">
        <ExecutiveSummary summary={summary} />
      </Section>

      <Section title="Key assumptions used">
        <AssumptionsTable assumptions={assumptions} />
      </Section>

      <Section title="Money longevity">
        <MoneyLongevity summary={summary} />
      </Section>

      <Section title="Year-by-year summary" breakBefore>
        <YearByYearTable rows={projectionRows} />
      </Section>

      {warnings.length > 0 ? (
        <Section title="Warnings and limitations">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <footer className="mt-8 pt-4 border-t border-gray-400 text-xs text-gray-600">
        <p>
          <strong>Disclaimer.</strong> {DISCLAIMER}
        </p>
        <p className="mt-2">
          RetireOps — Canadian retirement planning. Generated {generatedLabel}.
        </p>
      </footer>
    </article>
  );
}
