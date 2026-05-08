'use client';

/**
 * OptimizationsTab — M005 Phase 1
 *
 * Surfaces tax-optimization InsightCards produced by the four analyzers
 * (rrsp-meltdown, cpp-timing, drawdown-order, income-splitting).
 * Fetches GET /api/profile/scenarios/:id/analyze on mount.
 */

import { useCallback, useEffect, useState } from 'react';
import type { InsightCard, InsightModule, OptimizationResult } from '@retireops/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react';
import { getScenarioOptimizations, CoupleNotSupportedError } from '@/lib/api/optimizations';

interface OptimizationsTabProps {
  scenarioId: string;
}

const MODULE_LABELS: Record<InsightModule, string> = {
  'rrsp-meltdown': 'RRSP Meltdown',
  'cpp-timing': 'CPP / OAS Timing',
  'drawdown-order': 'Withdrawal Order',
  'income-splitting': 'Income Splitting',
};

const CONFIDENCE_STYLES: Record<InsightCard['confidence'], string> = {
  HIGH: 'bg-ds-primary/10 text-ds-primary',
  MEDIUM: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  LOW: 'bg-muted text-muted-foreground',
};

const APPLIES_TO_LABELS: Record<NonNullable<InsightCard['appliesTo']>, string> = {
  primary: 'Primary',
  spouse: 'Spouse',
  household: 'Household',
};

export function OptimizationsTab({ scenarioId }: OptimizationsTabProps) {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupleUnsupported, setCoupleUnsupported] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCoupleUnsupported(false);
    try {
      const r = await getScenarioOptimizations(scenarioId);
      setResult(r);
    } catch (err) {
      if (err instanceof CoupleNotSupportedError) {
        setCoupleUnsupported(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load optimization analysis');
      }
    } finally {
      setIsLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    void fetchAnalysis();
  }, [fetchAnalysis]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-ds-primary" />
      </div>
    );
  }

  if (coupleUnsupported) {
    return (
      <div className="bg-ds-surface rounded-card py-12 px-6 text-center">
        <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h3 className="font-semibold text-ds-on-background mb-2">Analysis unavailable</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          This optimization endpoint could not analyze the couple scenario. Refresh the projection
          and try the analysis again.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-ds-surface rounded-card py-12 px-6 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-ds-error" />
        <p className="text-muted-foreground max-w-md">{error}</p>
        <Button
          variant="outline"
          className="border-ds-outline-variant"
          onClick={() => void fetchAnalysis()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  if (result.wellOptimized || result.cards.length === 0) {
    return (
      <div className="bg-ds-surface rounded-card py-12 px-6 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-ds-primary" />
        <h3 className="font-semibold text-ds-on-background mb-2">Your plan is well-optimized</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {result.message ??
            'No significant tax-saving opportunities were identified based on your current projections.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Beta
        </Badge>
        <span>
          {result.cards.length} recommendation{result.cards.length === 1 ? '' : 's'}, sorted by
          estimated lifetime impact. Optimization analysis is in beta — verify any specific strategy
          with a qualified advisor before acting.
        </span>
      </div>
      <div className="grid gap-4">
        {result.cards.map((card, idx) => (
          <InsightCardView key={`${card.module}-${idx}`} card={card} />
        ))}
      </div>
    </div>
  );
}

function InsightCardView({ card }: { card: InsightCard }) {
  const impactClass =
    card.estimatedDollarImpact > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : card.estimatedDollarImpact < 0
        ? 'text-ds-error'
        : 'text-ds-on-background';
  const impactSign = card.estimatedDollarImpact > 0 ? '+' : '';
  const recommendedAction = card.recommendedAction ?? card.title;
  const whyItHelps = card.whyItHelps ?? card.explanation;
  const affectedYears = formatAffectedYears(card.affectedYears);

  return (
    <Card className="bg-ds-surface rounded-card border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {MODULE_LABELS[card.module]}
          </p>
          <CardTitle className="text-base font-semibold text-ds-on-background mt-1">
            {card.title}
          </CardTitle>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_STYLES[card.confidence]}`}
          title={`${card.confidence} confidence`}
        >
          {card.confidence}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended action
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-ds-on-background">
              {recommendedAction}
            </p>
          </div>
          {card.appliesTo && (
            <div className="sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Applies to
              </p>
              <p className="mt-1 text-sm font-medium text-ds-on-background">
                {APPLIES_TO_LABELS[card.appliesTo]}
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lifetime impact
            </p>
            <div className={`mt-1 text-xl font-bold tabular-nums ${impactClass}`}>
              {impactSign}
              {formatCurrency(card.estimatedDollarImpact)}
            </div>
          </div>
          {card.estimatedAnnualSavings !== undefined && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Annual savings
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums text-ds-on-background">
                {formatCurrency(card.estimatedAnnualSavings)}
              </p>
            </div>
          )}
          {affectedYears && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Affected years
              </p>
              <p className="mt-1 text-sm font-medium text-ds-on-background">{affectedYears}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why it helps
          </p>
          <p className="mt-1 text-sm text-ds-on-background leading-relaxed">{whyItHelps}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Supporting detail
          </p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{card.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatAffectedYears(years: number[] | undefined): string | null {
  if (!years || years.length === 0) return null;

  const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = uniqueYears[0];
  let previous = uniqueYears[0];

  for (const year of uniqueYears.slice(1)) {
    if (previous !== undefined && year === previous + 1) {
      previous = year;
      continue;
    }

    if (rangeStart !== undefined && previous !== undefined) {
      ranges.push(
        rangeStart === previous ? String(rangeStart) : `${String(rangeStart)}-${String(previous)}`
      );
    }
    rangeStart = year;
    previous = year;
  }

  if (rangeStart !== undefined && previous !== undefined) {
    ranges.push(
      rangeStart === previous ? String(rangeStart) : `${String(rangeStart)}-${String(previous)}`
    );
  }

  return ranges.join(', ');
}
