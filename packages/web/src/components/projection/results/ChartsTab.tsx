'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { ProjectionYearRow } from '@retireops/shared';

interface ChartsTabProps {
  data: {
    projectionRows?: ProjectionYearRow[];
    yearlyResults?: Array<{
      year: number;
      age: number;
      employmentIncome: number;
      pensionIncome: number;
      cppIncome: number;
      oasIncome: number;
      withdrawals: number;
      totalIncome: number;
      federalTax: number;
      provincialTax: number;
      totalTax: number;
      rrspBalance: number;
      tfsaBalance: number;
      nonRegBalance: number;
      totalNetWorth: number;
    }>;
  };
  displayMode?: 'nominal' | 'real';
}

const COLORS = {
  primary: 'hsl(var(--ds-primary))',
  green: 'hsl(var(--ds-primary-fixed-dim))',
  amber: 'hsl(var(--ds-tertiary-fixed))',
  purple: 'hsl(var(--ds-secondary))',
  red: 'hsl(var(--ds-error))',
};

export function ChartsTab({ data, displayMode = 'nominal' }: ChartsTabProps) {
  const modeLabel = displayMode === 'real' ? "Today's Dollars" : 'Nominal CAD';
  const yearlyResults =
    data.projectionRows?.map((row) => ({
      year: row.year,
      age: row.age,
      employmentIncome: row.employmentIncome,
      pensionIncome: row.pensionIncome,
      cppIncome: row.cppIncome,
      oasIncome: row.oasIncome,
      withdrawals:
        row.rrifWithdrawal + row.tfsaWithdrawal + row.nonRegWithdrawal + (row.lifWithdrawal ?? 0),
      totalIncome: row.totalGrossIncome,
      federalTax: row.federalTax,
      provincialTax: row.provincialTax,
      totalTax: row.totalTax,
      rrspBalance:
        row.rrspBalance +
        row.rrifBalance +
        (row.liraBalance ?? 0) +
        (row.lifBalance ?? 0) +
        (row.spouseRrspBalance ?? 0) +
        (row.spouseRrifBalance ?? 0) +
        (row.spouseLiraBalance ?? 0) +
        (row.spouseLifBalance ?? 0),
      tfsaBalance: row.tfsaBalance + (row.spouseTfsaBalance ?? 0),
      nonRegBalance: row.nonRegBalance + (row.spouseNonRegBalance ?? 0),
      totalNetWorth: row.totalNetWorth,
    })) ??
    data.yearlyResults ??
    [];

  // Prepare data for net worth chart
  const netWorthData = yearlyResults.map((r) => ({
    age: r.age,
    rrsp: r.rrspBalance,
    tfsa: r.tfsaBalance,
    nonReg: r.nonRegBalance,
    total: r.totalNetWorth,
  }));

  // Prepare data for income chart (retirement years only)
  const incomeData = yearlyResults
    .filter((r) => r.age >= 65)
    .map((r) => ({
      age: r.age,
      pension: r.pensionIncome,
      cpp: r.cppIncome,
      oas: r.oasIncome,
      withdrawals: r.withdrawals,
    }));

  // Prepare data for tax chart
  const taxData = yearlyResults.map((r) => ({
    age: r.age,
    federal: r.federalTax,
    provincial: r.provincialTax,
  }));

  // Prepare data for account allocation pie chart (at retirement)
  const retirementYear = yearlyResults.find((r) => r.age === 65);
  const allocationData = retirementYear
    ? [
        { name: 'RRSP/RRIF', value: retirementYear.rrspBalance, color: COLORS.primary },
        { name: 'TFSA', value: retirementYear.tfsaBalance, color: COLORS.green },
        { name: 'Non-Registered', value: retirementYear.nonRegBalance, color: COLORS.amber },
      ]
    : [];

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${String(value)}`;
  };
  const formatTooltipCurrency = (value: unknown) =>
    formatCurrency(typeof value === 'number' ? value : 0);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-1">Age {label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground" data-testid="charts-mode">
        Currency basis: {modeLabel}
      </div>

      {/* Net Worth Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="age" className="text-xs" />
                <YAxis tickFormatter={formatYAxis} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="rrsp"
                  name="RRSP/RRIF"
                  stackId="1"
                  stroke={COLORS.primary}
                  fill={COLORS.primary}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="tfsa"
                  name="TFSA"
                  stackId="1"
                  stroke={COLORS.green}
                  fill={COLORS.green}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="nonReg"
                  name="Non-Registered"
                  stackId="1"
                  stroke={COLORS.amber}
                  fill={COLORS.amber}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* After-Tax Spending Sources Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>After-Tax Spending Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="age" className="text-xs" />
                  <YAxis tickFormatter={formatYAxis} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="pension" name="Pension" stackId="a" fill={COLORS.purple} />
                  <Bar dataKey="cpp" name="CPP" stackId="a" fill={COLORS.primary} />
                  <Bar dataKey="oas" name="OAS" stackId="a" fill={COLORS.green} />
                  <Bar dataKey="withdrawals" name="Withdrawals" stackId="a" fill={COLORS.amber} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Account Allocation at Retirement */}
        <Card>
          <CardHeader>
            <CardTitle>Account Allocation at Retirement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${String(index)}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltipCurrency} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Taxes Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={taxData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="age" className="text-xs" />
                <YAxis tickFormatter={formatYAxis} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="federal"
                  name="Federal Tax"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="provincial"
                  name="Provincial Tax"
                  stroke={COLORS.red}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
