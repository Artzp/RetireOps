'use client';

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, TrendingUp, Calendar, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useProjections } from '@/hooks/useProjections';
import { listProfileScenarios } from '@/lib/api/profile-scenarios';
import type { ProfileScenarioListItem } from '@/types/profile-scenario';

const SCENARIO_STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  pending: 'Not yet run',
  stale: 'Outdated',
  failed: 'Failed',
};

export default function DashboardPage() {
  const { projections, isLoading } = useProjections({ limit: 3 });
  const [userName, setUserName] = useState('');
  // One vocabulary across the app: the dashboard lists SCENARIOS (what the
  // Scenarios page shows), not the underlying projection records — the old
  // "Active Projections: 1" tile contradicted the 2 cards on /profile/scenarios.
  const [scenarios, setScenarios] = useState<ProfileScenarioListItem[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('userName');
    if (stored) setUserName(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listProfileScenarios()
      .then((list) => {
        if (!cancelled) setScenarios(list);
      })
      .catch(() => {
        /* tile and list fall back to empty state */
      })
      .finally(() => {
        if (!cancelled) setScenariosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Use the most recently completed projection for summary stats
  const latestCompleted = projections.find((p) => p.status === 'completed');

  const netWorthValue =
    latestCompleted?.peakNetWorth !== undefined
      ? formatCurrency(latestCompleted.peakNetWorth)
      : '—';

  const retirementIncomeValue =
    latestCompleted?.averageRetirementIncome !== undefined
      ? formatCurrency(latestCompleted.averageRetirementIncome) + '/yr'
      : '—';

  const yearsToRetirementValue = (() => {
    if (!latestCompleted?.retirementAge || !latestCompleted.dateOfBirth) return '—';
    const dob = new Date(latestCompleted.dateOfBirth);
    const today = new Date();
    const currentAge = today.getFullYear() - dob.getFullYear();
    const years = Math.max(0, latestCompleted.retirementAge - currentAge);
    return String(years);
  })();

  const retirementAgeLabel = latestCompleted?.retirementAge
    ? `Target age: ${latestCompleted.retirementAge}`
    : 'No projection yet';

  // Stats derived from real projection data
  const stats = [
    {
      title: 'Projected Peak Net Worth',
      value: isLoading ? '...' : netWorthValue,
      change: latestCompleted
        ? 'Highest point in your projection, in future dollars — not your net worth today'
        : 'Run a projection to see',
      trend: 'neutral',
      icon: PiggyBank,
    },
    {
      title: 'Projected After-Tax Spending Covered',
      value: isLoading ? '...' : retirementIncomeValue,
      change: latestCompleted
        ? 'Average across retirement, in future dollars'
        : 'Run a projection to see',
      trend: 'neutral',
      icon: TrendingUp,
    },
    {
      title: 'Years to Retirement',
      value: isLoading ? '...' : yearsToRetirementValue,
      change: retirementAgeLabel,
      trend: 'neutral',
      icon: Calendar,
    },
    {
      title: 'Scenarios',
      value: scenariosLoading ? '...' : String(scenarios.length),
      change: 'Your Base Scenario plus what-if variations',
      trend: 'neutral',
      icon: Calculator,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight font-display text-ds-on-background">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back{userName ? `, ${userName}` : ''}! Here&apos;s your retirement overview.
          </p>
        </div>
        <Link href="/profile">
          <Button>
            <Calculator className="mr-2 h-4 w-4" />
            Update Profile &amp; Run
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-ds-surface rounded-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{stat.value}</div>
              <p
                className={`text-xs ${
                  stat.trend === 'up' ? 'text-ds-primary' : 'text-muted-foreground'
                }`}
              >
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Your Scenarios — same entities the Scenarios page shows */}
        <Card className="bg-ds-surface-raised rounded-card border-0">
          <CardHeader>
            <CardTitle>Your Scenarios</CardTitle>
            <CardDescription>Your Base Scenario plus any what-if variations</CardDescription>
          </CardHeader>
          <CardContent>
            {scenariosLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="h-4 w-48 bg-ds-surface-raised rounded animate-pulse" />
                      <div className="h-3 w-32 bg-ds-surface-raised rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-20 bg-ds-surface-raised rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : scenarios.length === 0 ? (
              <div className="text-center py-8">
                <Calculator className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No scenarios yet</p>
                <Link href="/profile">
                  <Button variant="outline" size="sm">
                    Set Up Your Profile
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {scenarios.slice(0, 3).map((scenario) => (
                  <Link
                    key={scenario.id}
                    href={
                      scenario.status === 'completed' || scenario.status === 'stale'
                        ? `/profile/scenarios/${scenario.id}/results`
                        : '/profile/scenarios'
                    }
                    className="flex items-center justify-between rounded-lg p-4 hover:bg-ds-surface-overlay transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{scenario.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {scenario.calculated_at
                          ? `Last run: ${formatDate(scenario.calculated_at)}`
                          : `Created ${formatDate(scenario.created_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          scenario.status === 'completed'
                            ? 'bg-ds-primary-container text-ds-on-primary-container'
                            : scenario.status === 'failed'
                              ? 'bg-ds-error-container text-ds-on-error-container'
                              : 'bg-ds-tertiary-container text-ds-on-tertiary-container'
                        }`}
                      >
                        {SCENARIO_STATUS_LABELS[scenario.status] ?? scenario.status}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link href="/profile/scenarios">
                <Button variant="outline" className="w-full">
                  View All Scenarios
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-ds-surface-raised rounded-card border-0">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <Link
                href="/profile"
                className="flex items-center gap-4 rounded-lg p-4 hover:bg-ds-surface-overlay transition-colors"
              >
                <div className="rounded-full bg-primary/10 p-2">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Update Your Profile</p>
                  <p className="text-sm text-muted-foreground">
                    Edit your info, then re-run your projection
                  </p>
                </div>
              </Link>
              <Link
                href="/profile/scenarios"
                className="flex items-center gap-4 rounded-lg p-4 hover:bg-ds-surface-overlay transition-colors"
              >
                <div className="rounded-full bg-primary/10 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Compare Scenarios</p>
                  <p className="text-sm text-muted-foreground">
                    Analyze different retirement strategies
                  </p>
                </div>
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-4 rounded-lg p-4 hover:bg-ds-surface-overlay transition-colors"
              >
                <div className="rounded-full bg-primary/10 p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Update Profile</p>
                  <p className="text-sm text-muted-foreground">Keep your information current</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
