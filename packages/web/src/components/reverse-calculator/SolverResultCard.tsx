'use client';
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { SolverResult, SolverMode } from '@retireops/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

/**
 * SolverResultCard — displays the result of a reverse-calculator solver run.
 *
 * Feasible: hero answer (text-4xl bold primary) + Key Milestones table.
 * Infeasible: "Goal Unreachable" error card with ds-error tokens + mode-specific suggestion.
 *
 * @see docs/TESTABLE-SURFACES.md — TC-E2E-REVERSE-001
 * @see .planning/phases/54-web-ui/54-UI-SPEC.md — SolverResultCard layout
 * @see .planning/phases/54-web-ui/54-02-PLAN.md — REV-11
 */

interface SolverResultCardProps {
  result: SolverResult;
}

function formatHeroAnswer(result: SolverResult): string {
  const formatted = result.solvedValue.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  });
  switch (result.mode) {
    case 'required-savings':
      return `Save ${formatted}/year`;
    case 'sustainable-spending':
      return `Spend up to ${formatted}/year`;
    case 'earliest-retirement-age':
      // solvedValue is an age; use raw number (not currency)
      return `Retire at age ${Math.round(result.solvedValue)}`;
    case 'required-total-savings':
      return `You need ${formatted} total`;
    default: {
      const _exhaustive: never = result.mode;
      return String(_exhaustive);
    }
  }
}

function getModeLabel(mode: SolverMode): string {
  switch (mode) {
    case 'required-savings':
      return 'Required Annual Savings';
    case 'sustainable-spending':
      return 'Sustainable Annual Spending';
    case 'earliest-retirement-age':
      return 'Earliest Retirement Age';
    case 'required-total-savings':
      return 'Required Total Savings';
    default: {
      const _exhaustive: never = mode;
      return String(_exhaustive);
    }
  }
}

function getSolvedValueLabel(mode: SolverMode): string {
  switch (mode) {
    case 'required-savings':
      return 'Required annual savings';
    case 'sustainable-spending':
      return 'Sustainable annual spending';
    case 'earliest-retirement-age':
      return 'Earliest retirement age';
    case 'required-total-savings':
      return 'Required total savings';
    default: {
      const _exhaustive: never = mode;
      return String(_exhaustive);
    }
  }
}

function getInfeasibilityMessage(result: SolverResult): string {
  if (result.infeasibleReason) {
    return result.infeasibleReason;
  }
  switch (result.mode) {
    case 'required-savings':
      return 'Annual savings required exceed $250,000. Consider increasing your retirement age or reducing your target spending.';
    case 'sustainable-spending':
      return 'No sustainable spending amount was found within the search bounds. Review your savings balances and retirement age.';
    case 'earliest-retirement-age':
      return 'Retirement is not feasible before age 80 with current inputs. Consider increasing your savings rate.';
    case 'required-total-savings':
      return 'Required total savings exceed the search bound. Consider adjusting your retirement age or spending targets.';
    default: {
      const _exhaustive: never = result.mode;
      return String(_exhaustive);
    }
  }
}

export function SolverResultCard({ result }: SolverResultCardProps) {
  if (!result.feasible) {
    return (
      <Card className="border-ds-error bg-ds-error-container text-ds-on-error-container">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" />
            <CardTitle className="text-lg font-bold">Goal Unreachable</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{getInfeasibilityMessage(result)}</p>
        </CardContent>
      </Card>
    );
  }

  const heroAnswer = formatHeroAnswer(result);
  const modeLabel = getModeLabel(result.mode);
  const solvedLabel = getSolvedValueLabel(result.mode);
  const summary = result.projectionSummary;

  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary">{modeLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-4xl font-bold text-primary font-display">{heroAnswer}</p>
          <p className="text-sm text-muted-foreground mt-1">{solvedLabel}</p>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-base font-medium">Key Milestones</p>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total retirement years</span>
            <span>{summary.totalRetirementYears}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Final portfolio balance</span>
            <span>{formatCurrency(summary.finalPortfolioBalance)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CPP annual benefit</span>
            <span>{formatCurrency(summary.cppAnnualBenefit)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">OAS annual benefit</span>
            <span>{formatCurrency(summary.oasAnnualBenefit)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Peak net worth</span>
            <span>{formatCurrency(summary.peakNetWorth)}</span>
          </div>

          {result.mode === 'required-total-savings' && result.fundingGap !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Funding gap</span>
              <span>{formatCurrency(result.fundingGap)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
