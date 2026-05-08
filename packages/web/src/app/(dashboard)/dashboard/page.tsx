'use client';

/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calculator,
  TrendingUp,
  Calendar,
  PiggyBank,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { useProjections } from '@/hooks/useProjections';

export default function DashboardPage() {
  const { projections, pagination, isLoading, error, refetch } = useProjections({ limit: 3 });
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('userName');
    if (stored) setUserName(stored);
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
      title: 'Total Net Worth',
      value: isLoading ? '...' : netWorthValue,
      change: latestCompleted ? 'Peak net worth' : 'Run a projection to see',
      trend: latestCompleted ? 'up' : 'neutral',
      icon: PiggyBank,
    },
    {
      title: 'Projected Retirement Income',
      value: isLoading ? '...' : retirementIncomeValue,
      change: latestCompleted ? 'Average in retirement' : 'Run a projection to see',
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
      title: 'Active Projections',
      value: isLoading ? '...' : String(pagination?.total ?? projections.length),
      change: 'Total projections',
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
            New Projection
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
        {/* Recent Projections */}
        <Card className="bg-ds-surface-raised rounded-card border-0">
          <CardHeader>
            <CardTitle>Recent Projections</CardTitle>
            <CardDescription>Your latest retirement projections and scenarios</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <AlertCircle className="h-8 w-8 text-ds-error" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : projections.length === 0 ? (
              <div className="text-center py-8">
                <Calculator className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No projections yet</p>
                <Link href="/profile">
                  <Button variant="outline" size="sm">
                    Create Your First Projection
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {projections.map((projection) => (
                  <Link
                    key={projection.id}
                    href={`/projections/${projection.id}`}
                    className="flex items-center justify-between rounded-lg p-4 hover:bg-ds-surface-overlay transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{projection.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Updated {new Date(projection.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          projection.status === 'completed'
                            ? 'bg-ds-primary-container text-ds-on-primary-container'
                            : projection.status === 'failed'
                              ? 'bg-ds-error-container text-ds-on-error-container'
                              : 'bg-ds-tertiary-container text-ds-on-tertiary-container'
                        }`}
                      >
                        {projection.status}
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
                  View All Projections
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
                  <p className="font-medium">Create New Projection</p>
                  <p className="text-sm text-muted-foreground">
                    Start a new retirement calculation
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
