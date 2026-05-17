'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import { useState } from 'react';
import type {
  FundedStatus,
  LedgerWarning,
  MonteCarloJobResult,
  ProjectionYearRow,
  RemediationPlan,
} from '@retireops/shared/types';
import type { DisplayMode } from '@retireops/shared/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { AssumptionsCard, type AssumptionsCardData } from './AssumptionsCard';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  PiggyBank,
  CheckCircle,
  AlertCircle,
  Info,
  Users,
  User,
  Home,
  Percent,
} from 'lucide-react';
import { FundedStatusIndicator } from './FundedStatusIndicator';

interface PersonSummary {
  peakNetWorth: number;
  portfolioLongevity: number;
  totalTaxesPaid: number;
  averageRetirementIncome: number;
}

interface CoupleSummary {
  householdPeakNetWorth: number;
  householdTotalTaxesPaid: number;
  householdAverageRetirementIncome: number;
  totalPensionSplitSavings: number;
  primarySummary: PersonSummary;
  spouseSummary: PersonSummary;
}

interface SummaryTabProps {
  data: {
    summary: {
      peakNetWorth: number;
      portfolioLongevity: number;
      totalTaxesPaid: number;
      averageRetirementIncome: number;
      probabilityOfSuccess?: number;
      // New fields from Plan 01 transformer extension
      peakNetWorthYear?: number;
      lowestNetWorth?: number;
      portfolioLongevityAge?: number | null;
      moneyLastsToLifeExpectancy?: boolean;
      averageEffectiveTaxRate?: number;
      // Couple-specific fields
      isCouple?: boolean;
      coupleSummary?: CoupleSummary;
      // Phase 48: optional for pre-Phase-48 stored projections (FR-011 guard)
      fundedStatus?: FundedStatus;
      // Phase 48: nullable, also optional for old data (remediationPlan: null in Phase 48 stub)
      remediationPlan?: RemediationPlan | null;
      // M005/S06: aggregate ledger warnings from the contribution-room ledger
      ledgerWarnings?: LedgerWarning[];
    };
    yearlyResults: Array<{
      year?: number;
      age: number;
      totalNetWorth: number;
      // Couple-specific fields
      spouseAge?: number;
      householdNetWorth?: number;
      pensionSplitSavings?: number;
    }>;
    /** M005/P3: typed rows used for per-year pension-split chart + totals */
    projectionRows?: ProjectionYearRow[];
    /** Surfaced from calcInput by profile-scenario.service for the Assumptions Used panel. */
    assumptions?: AssumptionsCardData;
  };
  /**
   * Active inflation-toggle mode propagated from the results page so the
   * Assumptions Used panel can render the current display setting prominently.
   */
  displayMode: DisplayMode;
  /**
   * Optional callback to switch the parent results-page tab (e.g. to 'monte-carlo').
   * When provided, the "See the range of outcomes" CTA renders an action button.
   */
  onSwitchTab?: (tab: string) => void;
  /**
   * Optional Monte Carlo result lifted from the parent. When present, a compact
   * probabilistic summary renders inline directly under the deterministic
   * headline so the user is not stuck with a single-path number.
   */
  monteCarloSummary?: MonteCarloJobResult | null;
}

export function SummaryTab({ data, displayMode, onSwitchTab, monteCarloSummary }: SummaryTabProps) {
  const { summary, yearlyResults } = data;
  const [viewMode, setViewMode] = useState<'household' | 'primary' | 'spouse'>('household');

  const isCouple = summary.isCouple ?? false;
  const coupleSummary = summary.coupleSummary;

  const finalNetWorth = yearlyResults[yearlyResults.length - 1]?.totalNetWorth || 0;
  const householdFinalNetWorth =
    yearlyResults[yearlyResults.length - 1]?.householdNetWorth || finalNetWorth;
  const retirementStartIndex = yearlyResults.findIndex((y) => y.age === 65);
  const retirementNetWorth =
    retirementStartIndex >= 0 ? yearlyResults[retirementStartIndex]?.totalNetWorth || 0 : 0;

  // Calculate total pension split savings for couples.
  // M005/P3: prefer the typed projectionRows (pensionSplitTaxSavings) since the
  // legacy yearlyResults shape never carried this field.
  const projectionRows = data.projectionRows ?? [];
  const pensionSplitRows = isCouple
    ? projectionRows.filter((r) => (r.pensionSplitPercentage ?? 0) > 0)
    : [];
  const totalPensionSplitSavings = isCouple
    ? pensionSplitRows.reduce((sum, r) => sum + (r.pensionSplitTaxSavings ?? 0), 0) ||
      yearlyResults.reduce((sum, y) => sum + (y.pensionSplitSavings || 0), 0)
    : 0;
  const pensionSplitChartData = pensionSplitRows.map((r) => ({
    year: r.year,
    splitPct: Math.round((r.pensionSplitPercentage ?? 0) * 1000) / 10, // percent, one decimal
  }));
  // M005/P5: lifetime bracket-fill withdrawals (client-side sum — the engine
  // does not yet expose a summary aggregate; follow-up tracked post-M005).
  const totalBracketFillWithdrawals = projectionRows.reduce(
    (sum, r) => sum + (r.bracketFillWithdrawal ?? 0) + (r.spouseBracketFillWithdrawal ?? 0),
    0
  );

  const successRate = summary.probabilityOfSuccess ?? 0;
  const isSuccessful = successRate >= 80;
  const progressIndicatorColor =
    successRate >= 80 ? 'bg-ds-primary' : successRate >= 60 ? 'bg-ds-tertiary' : 'bg-ds-error';
  const progressTrackColor =
    successRate >= 80
      ? 'bg-ds-primary-container'
      : successRate >= 60
        ? 'bg-ds-tertiary-container'
        : 'bg-ds-error-container';

  // Helper function to get current view's metrics
  const getCurrentMetrics = () => {
    if (!isCouple || viewMode === 'household') {
      return {
        peakNetWorth: isCouple
          ? coupleSummary?.householdPeakNetWorth || summary.peakNetWorth
          : summary.peakNetWorth,
        totalTaxesPaid: isCouple
          ? coupleSummary?.householdTotalTaxesPaid || summary.totalTaxesPaid
          : summary.totalTaxesPaid,
        averageRetirementIncome: isCouple
          ? coupleSummary?.householdAverageRetirementIncome || summary.averageRetirementIncome
          : summary.averageRetirementIncome,
        portfolioLongevity: summary.portfolioLongevity,
      };
    }
    if (viewMode === 'primary' && coupleSummary?.primarySummary) {
      return coupleSummary.primarySummary;
    }
    if (viewMode === 'spouse' && coupleSummary?.spouseSummary) {
      return coupleSummary.spouseSummary;
    }
    return summary;
  };

  const metrics = getCurrentMetrics();

  // Peak net worth age context (URES-04)
  const peakYear = yearlyResults.find((r) => r.year === summary.peakNetWorthYear);
  const peakAge = peakYear?.age;

  // Derive projection warnings (URES-05)
  const warnings: Array<{ text: string; severity: 'destructive' | 'amber' }> = [];

  if (
    summary.moneyLastsToLifeExpectancy === false ||
    (summary.lowestNetWorth !== undefined && summary.lowestNetWorth < 0)
  ) {
    warnings.push({
      text: 'Portfolio runs out before life expectancy \u2014 consider increasing savings or delaying retirement',
      severity: 'destructive',
    });
  }
  if (summary.portfolioLongevityAge !== undefined && summary.portfolioLongevityAge !== null) {
    warnings.push({
      text: `Portfolio exhausted at age ${String(summary.portfolioLongevityAge)} \u2014 adjust withdrawal rate or retirement date`,
      severity: 'amber',
    });
  }
  if (summary.averageEffectiveTaxRate !== undefined && summary.averageEffectiveTaxRate > 0.3) {
    warnings.push({
      text: `High average effective tax rate (${String(Math.round(summary.averageEffectiveTaxRate * 100))}%) \u2014 consider RRIF meltdown or income-splitting strategies`,
      severity: 'amber',
    });
  }
  for (const lw of summary.ledgerWarnings ?? []) {
    const person = lw.person === 'spouse' ? 'Spouse' : 'Primary';
    const account = lw.accountType.toUpperCase();
    const penaltyNote =
      lw.penaltyAmount > 0 ? ` \u2014 CRA penalty: ${formatCurrency(lw.penaltyAmount)}/month` : '';
    warnings.push({
      text: `${String(lw.year)} ${person} ${account}: ${lw.message}${penaltyNote}`,
      severity: lw.kind === 'lifetime-cap-exceeded' ? 'destructive' : 'amber',
    });
  }

  return (
    <div className="space-y-6">
      {/* Funded Status Banner (Phase 48 — FUND-09, FR-011) */}
      {/* FR-011: guard on fundedStatus !== undefined — renders nothing for pre-Phase-48 projections */}
      {data.summary.fundedStatus !== undefined && (
        <FundedStatusIndicator
          fundedStatus={data.summary.fundedStatus}
          remediationPlan={data.summary.remediationPlan ?? null}
        />
      )}

      {/* Peak Net Worth Hero Block (RES-01) */}
      <div className="bg-ds-surface rounded-card p-8 mb-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-sans font-bold text-muted-foreground uppercase tracking-wide">
            Peak net worth
          </p>
          <p className="text-5xl font-display font-bold text-ds-on-background">
            {formatCurrency(metrics.peakNetWorth)}
          </p>
          <p className="text-sm font-sans text-muted-foreground">
            {peakAge !== undefined ? `at age ${String(peakAge)}` : 'Maximum portfolio value'}
          </p>
        </div>
      </div>

      {/* Couple View Switcher */}
      {isCouple && (
        <Card className="bg-ds-surface rounded-card border-0">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5" />
                <span className="font-medium">Couple Projection</span>
              </div>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                <TabsList>
                  <TabsTrigger value="household" className="flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    Household
                  </TabsTrigger>
                  <TabsTrigger value="primary" className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    You
                  </TabsTrigger>
                  <TabsTrigger value="spouse" className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Spouse
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pension Split Savings Banner - Only for couples with savings */}
      {isCouple && totalPensionSplitSavings > 0 && viewMode === 'household' && (
        <div className="bg-ds-secondary-container rounded-card p-4">
          <div className="flex items-center gap-4">
            <Percent className="h-10 w-10 text-ds-secondary" />
            <div className="flex-1">
              <h3 className="font-semibold text-ds-on-secondary-container">
                Pension Income Splitting Savings
              </h3>
              <p className="text-sm text-ds-on-secondary-container/80">
                By optimizing pension income splitting, your household saves on taxes.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-ds-secondary">
                {formatCurrency(totalPensionSplitSavings)}
              </div>
              <p className="text-sm text-muted-foreground">Total Tax Savings</p>
            </div>
          </div>
          {pensionSplitChartData.length > 1 && (
            <div className="mt-4">
              <p className="text-xs text-ds-on-secondary-container/80 mb-1">
                Pension share transferred over time
              </p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pensionSplitChartData}>
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis
                      domain={[0, 50]}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 10 }}
                      width={32}
                    />
                    <Tooltip
                      formatter={(v: unknown) => [
                        `${(typeof v === 'number' ? v : 0).toFixed(1)}%`,
                        'Split',
                      ]}
                      labelFormatter={(y) => `Year ${String(y)}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="splitPct"
                      stroke="currentColor"
                      className="text-ds-secondary"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Public-beta framing: every figure on this page is one deterministic
          path through the assumptions. Sits directly above the Success Indicator
          so the headline number is read in context. */}
      <div
        role="note"
        className="flex gap-3 rounded-md border-l-4 border-ds-primary bg-ds-surface-raised p-4"
      >
        <Info className="h-5 w-5 shrink-0 text-ds-primary mt-0.5" aria-hidden />
        <p className="text-sm text-ds-on-background">
          <span className="font-bold">This is one projected path</span> based on your assumptions.
          Actual results may vary. Review Monte Carlo and stress tests for a range of possible
          outcomes.
        </p>
      </div>

      {/* Success Indicator */}
      <div
        className={
          isSuccessful
            ? 'bg-ds-primary-container rounded-card p-6'
            : 'bg-ds-tertiary-container rounded-card p-6'
        }
      >
        <div className="flex items-center gap-4">
          {isSuccessful ? (
            <CheckCircle className="h-12 w-12 text-ds-primary" />
          ) : (
            <AlertCircle className="h-12 w-12 text-ds-tertiary" />
          )}
          <div className="flex-1">
            <h3
              className={`text-xl font-bold ${isSuccessful ? 'text-ds-on-primary-container' : 'text-ds-on-tertiary-container'}`}
            >
              {isSuccessful
                ? isCouple
                  ? 'Your household retirement plan looks solid!'
                  : 'Your retirement plan looks solid!'
                : 'Your plan may need adjustments'}
            </h3>
            <p
              className={`text-sm ${isSuccessful ? 'text-ds-on-primary-container/80' : 'text-ds-on-tertiary-container/80'}`}
            >
              On this projected path, {isCouple ? 'your household' : 'your'} plan funds{' '}
              {successRate}% of the planned retirement years. For a probability across market
              scenarios, run a Monte Carlo simulation.
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl font-bold ${isSuccessful ? 'text-ds-primary' : 'text-ds-tertiary'}`}
            >
              {successRate}%
            </div>
            <p className="text-sm text-muted-foreground">Years funded</p>
          </div>
        </div>
      </div>

      {/* Inline Monte Carlo summary — only when a result is available from the
          parent (cached in sessionStorage after the user runs MC). Probabilistic
          counterpart to the deterministic Success Indicator above. */}
      {monteCarloSummary !== undefined && monteCarloSummary !== null && (
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-ds-primary" aria-hidden />
              Monte Carlo summary — across{' '}
              {monteCarloSummary.numSimulations.toLocaleString('en-CA')} market scenarios
            </CardTitle>
            {onSwitchTab ? (
              <button
                type="button"
                onClick={() => onSwitchTab('monte-carlo')}
                className="text-xs underline underline-offset-2 hover:text-ds-on-background"
              >
                View full Monte Carlo
              </button>
            ) : null}
          </CardHeader>
          <CardContent>
            {(() => {
              const lastBand =
                monteCarloSummary.percentileBands.length > 0
                  ? monteCarloSummary.percentileBands[monteCarloSummary.percentileBands.length - 1]
                  : null;
              return (
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Probability of success</p>
                    <p className="text-2xl font-bold text-ds-on-background">
                      {monteCarloSummary.successRate.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Trials ending without depletion</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pessimistic (P10)</p>
                    <p className="text-2xl font-bold text-ds-on-background">
                      {lastBand ? formatCurrency(lastBand.p10) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">End-of-plan net worth, 10th pct</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Median (P50)</p>
                    <p className="text-2xl font-bold text-ds-on-background">
                      {lastBand ? formatCurrency(lastBand.p50) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">End-of-plan net worth, 50th pct</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Optimistic (P90)</p>
                    <p className="text-2xl font-bold text-ds-on-background">
                      {lastBand ? formatCurrency(lastBand.p90) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">End-of-plan net worth, 90th pct</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isCouple && viewMode === 'household' ? 'Household Peak Net Worth' : 'Peak Net Worth'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-on-background">
              {formatCurrency(metrics.peakNetWorth)}
            </div>
            <p className="text-xs text-muted-foreground">
              {peakAge !== undefined ? `at age ${String(peakAge)}` : 'Maximum portfolio value'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio Longevity
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-on-background">
              Age {metrics.portfolioLongevity}
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              <span>Single projected path &mdash; actual outcomes will vary.</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isCouple && viewMode === 'household'
                ? 'Household Avg. Income'
                : 'Avg. After-Tax Spending'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-on-background">
              {formatCurrency(metrics.averageRetirementIncome)}
            </div>
            <p className="text-xs text-muted-foreground">Per year after tax</p>
          </CardContent>
        </Card>

        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isCouple && viewMode === 'household' ? 'Household Taxes' : 'Total Taxes Paid'}
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-on-background">
              {formatCurrency(metrics.totalTaxesPaid)}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime tax burden</p>
          </CardContent>
        </Card>
      </div>

      {/* Monte Carlo CTA — only when no MC result is cached. The inline summary
          card above replaces this CTA once MC has been run in this session. */}
      {!monteCarloSummary && (
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <TrendingUp className="h-4 w-4 text-ds-primary" aria-hidden />
            <CardTitle className="text-sm">See the range of outcomes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              This page shows one deterministic path using your assumed return. Run Monte Carlo to
              see how your plan performs across thousands of market scenarios.
            </p>
            {onSwitchTab ? (
              <Button
                size="sm"
                variant="outline"
                className="border-ds-outline-variant shrink-0"
                onClick={() => onSwitchTab('monte-carlo')}
              >
                Run Monte Carlo
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* M005/P5: Lifetime bracket-fill withdrawals — rendered only when the
          withdrawal optimizer fired at least once across the projection. */}
      {totalBracketFillWithdrawals > 0 && (
        <p className="text-sm text-muted-foreground">
          Lifetime bracket-fill withdrawals:{' '}
          <span className="font-semibold text-ds-on-background">
            {formatCurrency(totalBracketFillWithdrawals)}
          </span>
        </p>
      )}

      {/* Projection Warnings (URES-05) — only rendered when warnings exist */}
      {warnings.length > 0 && (
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader>
            <CardTitle>Projection Warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle
                  className={`h-5 w-5 mt-0.5 shrink-0 ${w.severity === 'destructive' ? 'text-ds-error' : 'text-ds-tertiary'}`}
                />
                <span className="text-sm">{w.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assumptions Used — surfaces the calcInput-derived inputs that drove the projection */}
      <AssumptionsCard assumptions={data.assumptions} displayMode={displayMode} />

      {/* Additional Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader>
            <CardTitle>
              {isCouple && viewMode === 'household'
                ? 'Household Net Worth Timeline'
                : 'Net Worth Timeline'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">At Retirement (Age 65)</span>
              <span className="font-semibold">{formatCurrency(retirementNetWorth)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Peak Value</span>
              <span className="font-semibold">{formatCurrency(metrics.peakNetWorth)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">At End of Plan</span>
              <span className="font-semibold">
                {formatCurrency(
                  isCouple && viewMode === 'household' ? householdFinalNetWorth : finalNetWorth
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader>
            <CardTitle>Funded retirement years</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Years funded</span>
                <span className="font-medium">{successRate}%</span>
              </div>
              <Progress
                value={successRate}
                className={`h-2 ${progressTrackColor}`}
                indicatorClassName={progressIndicatorColor}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This is the share of {isCouple ? 'the planned' : 'your planned'} retirement years
              funded by this single deterministic projection. For a true probability across market
              scenarios,{' '}
              {onSwitchTab ? (
                <button
                  type="button"
                  onClick={() => onSwitchTab('monte-carlo')}
                  className="underline underline-offset-2 hover:text-ds-on-background"
                >
                  run a Monte Carlo simulation
                </button>
              ) : (
                'run a Monte Carlo simulation'
              )}
              .
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Spouse Balance Summary - Only for couples in household view */}
      {isCouple && viewMode === 'household' && coupleSummary && (
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Per-Spouse Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4" />
                  You (Primary)
                </div>
                <div className="space-y-2 text-sm pl-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peak Net Worth</span>
                    <span className="font-medium">
                      {formatCurrency(coupleSummary.primarySummary.peakNetWorth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. After-Tax Spending</span>
                    <span className="font-medium">
                      {formatCurrency(coupleSummary.primarySummary.averageRetirementIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Taxes Paid</span>
                    <span className="font-medium">
                      {formatCurrency(coupleSummary.primarySummary.totalTaxesPaid)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4" />
                  Spouse
                </div>
                <div className="space-y-2 text-sm pl-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peak Net Worth</span>
                    <span className="font-medium">
                      {formatCurrency(coupleSummary.spouseSummary.peakNetWorth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. After-Tax Spending</span>
                    <span className="font-medium">
                      {formatCurrency(coupleSummary.spouseSummary.averageRetirementIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Taxes Paid</span>
                    <span className="font-medium">
                      {formatCurrency(coupleSummary.spouseSummary.totalTaxesPaid)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="bg-ds-surface rounded-card border-0">
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {successRate < 80 && (
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-ds-tertiary mt-0.5" />
                <span>
                  Consider increasing {isCouple ? 'household' : 'your'} savings rate or delaying
                  retirement to improve your success probability.
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-ds-primary mt-0.5" />
              <span>Your CPP deferral strategy is optimized for your situation.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-ds-primary mt-0.5" />
              <span>TFSA withdrawals are being used tax-efficiently in retirement.</span>
            </li>
            {isCouple && totalPensionSplitSavings > 0 && (
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ds-primary mt-0.5" />
                <span>
                  Pension income splitting is saving your household{' '}
                  {formatCurrency(totalPensionSplitSavings)} in taxes over the retirement period.
                </span>
              </li>
            )}
            {isCouple && (
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ds-primary mt-0.5" />
                <span>
                  Both spouses&apos; accounts are being coordinated for optimal tax efficiency.
                </span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
