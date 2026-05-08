'use client';

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { ReactNode } from 'react';
import type { DisplayMode } from '@retireops/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/utils';

export interface AssumptionsCardData {
  inflationRate?: number;
  investmentReturn?: number;
  investmentReturnRate?: number;
  province?: string;
  retirementAge?: number;
  lifeExpectancy?: number;
  cppStartAge?: number;
  oasStartAge?: number;
  yearsOfResidence?: number;
  expectedCPPAt65?: number;
  taxYear?: number;
  federalTaxTableYear?: number;
  provincialTaxTableNote?: string;
  taxTableVersion?: string;
  monteCarlo?: {
    expectedReturn?: number;
    meanReturn?: number;
    volatility?: number;
    numSimulations?: number;
    simulationCount?: number;
  };
  monteCarloMeanReturn?: number;
  monteCarloVolatility?: number;
  monteCarloSimulationCount?: number;
  monteCarloSimulations?: number;
}

interface AssumptionsCardProps {
  assumptions?: AssumptionsCardData;
  displayMode: DisplayMode;
}

interface RowProps {
  label: string;
  children: ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-ds-on-background tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function formatAge(age: number): string {
  return `Age ${age}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-CA').format(value);
}

function normalizeRate(value: number): number {
  return Math.abs(value) > 1 ? value / 100 : value;
}

function formatRate(value: number): string {
  return formatPercentage(normalizeRate(value));
}

export function AssumptionsCard({ assumptions, displayMode }: AssumptionsCardProps) {
  const a = assumptions ?? {};
  const investmentReturn = a.investmentReturn ?? a.investmentReturnRate;
  const displayLabel = displayMode === 'real' ? `Today's dollars` : 'Future dollars / nominal CAD';
  const taxTablesNote =
    a.taxTableVersion ??
    (a.federalTaxTableYear !== undefined
      ? `Tax tables: Federal ${a.federalTaxTableYear}; ${
          a.provincialTaxTableNote ?? 'provincial tables use the latest available published values.'
        }`
      : undefined);
  const monteCarloExpectedReturn =
    a.monteCarlo?.expectedReturn ?? a.monteCarlo?.meanReturn ?? a.monteCarloMeanReturn;
  const monteCarloVolatility = a.monteCarlo?.volatility ?? a.monteCarloVolatility;
  const monteCarloSimulationCount =
    a.monteCarlo?.numSimulations ??
    a.monteCarlo?.simulationCount ??
    a.monteCarloSimulationCount ??
    a.monteCarloSimulations;
  const hasMonteCarlo =
    monteCarloExpectedReturn !== undefined ||
    monteCarloVolatility !== undefined ||
    monteCarloSimulationCount !== undefined;

  return (
    <Card className="bg-ds-surface rounded-card border-0">
      <CardHeader>
        <CardTitle className="text-base text-ds-on-background">Assumptions Used</CardTitle>
        <p className="text-sm text-muted-foreground">
          These assumptions drive the projection. Changing them can materially change the result.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md bg-ds-secondary-container px-4 py-3 mb-4">
          <Row label="Display mode">{displayLabel}</Row>
        </div>

        <dl className="divide-y divide-ds-outline-variant/40">
          {a.province !== undefined && <Row label="Province">{a.province}</Row>}
          {a.retirementAge !== undefined && (
            <Row label="Retirement age">{formatAge(a.retirementAge)}</Row>
          )}
          {a.lifeExpectancy !== undefined && (
            <Row label="Life expectancy">{formatAge(a.lifeExpectancy)}</Row>
          )}
          {a.inflationRate !== undefined && (
            <Row label="Inflation rate">{formatRate(a.inflationRate)}</Row>
          )}
          {investmentReturn !== undefined && (
            <Row label="Investment return">{formatRate(investmentReturn)}</Row>
          )}
          {a.cppStartAge !== undefined && (
            <Row label="CPP start age">{formatAge(a.cppStartAge)}</Row>
          )}
          {a.oasStartAge !== undefined && (
            <Row label="OAS start age">{formatAge(a.oasStartAge)}</Row>
          )}
          {a.yearsOfResidence !== undefined && (
            <Row label="Years of Canadian residence">{a.yearsOfResidence}</Row>
          )}
          {a.expectedCPPAt65 !== undefined && (
            <Row label="Expected CPP at 65">{formatCurrency(a.expectedCPPAt65)}</Row>
          )}
          {a.taxYear !== undefined && <Row label="Tax year">{a.taxYear}</Row>}
        </dl>

        {hasMonteCarlo && (
          <div className="mt-5 border-t border-ds-outline-variant/40 pt-4">
            <h3 className="text-sm font-semibold text-ds-on-background">Monte Carlo assumptions</h3>
            <dl className="mt-2 divide-y divide-ds-outline-variant/40">
              {monteCarloExpectedReturn !== undefined && (
                <Row label="Expected return">{formatRate(monteCarloExpectedReturn)}</Row>
              )}
              {monteCarloVolatility !== undefined && (
                <Row label="Volatility">{formatRate(monteCarloVolatility)}</Row>
              )}
              {monteCarloSimulationCount !== undefined && (
                <Row label="Number of simulations">{formatCount(monteCarloSimulationCount)}</Row>
              )}
            </dl>
          </div>
        )}

        {/* TODO: Render richer tax-table freshness/version metadata when the API exposes it. */}
        {taxTablesNote !== undefined && (
          <p className="text-xs text-muted-foreground mt-4">{taxTablesNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
