import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';
import type { ProjectionYearRow } from '@retireops/shared';
import ScenarioResultsPage from './page';

function formatValue(value: number | undefined) {
  return value === undefined ? 'missing' : value.toFixed(2);
}

const {
  mockUseParams,
  mockPush,
  mockReplace,
  mockGetProfileScenario,
  mockRunProfileScenario,
  mockToast,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockGetProfileScenario: vi.fn(),
  mockRunProfileScenario: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/profile-scenarios', () => ({
  getProfileScenario: mockGetProfileScenario,
  runProfileScenario: mockRunProfileScenario,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Play: () => <svg data-testid="icon-play" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  Download: () => <svg data-testid="icon-download" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  BookOpen: () => <svg data-testid="icon-book-open" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/projection/results/SummaryTab', () => ({
  SummaryTab: () => <div data-testid="summary-tab" />,
}));

vi.mock('@/components/projection/results/ChartsTab', () => ({
  ChartsTab: ({
    data,
    displayMode,
  }: {
    data: { projectionRows?: ProjectionYearRow[] };
    displayMode?: 'nominal' | 'real';
  }) => (
    <div data-testid="charts-tab">
      {displayMode}:{formatValue(data.projectionRows?.[1]?.totalNetWorth)}
    </div>
  ),
}));

vi.mock('@/components/projection/results/YearByYearTab', () => ({
  YearByYearTab: ({
    data,
    displayMode,
  }: {
    data: { projectionRows?: ProjectionYearRow[] };
    displayMode?: 'nominal' | 'real';
  }) => (
    <div data-testid="year-by-year-tab">
      {displayMode}:{formatValue(data.projectionRows?.[1]?.totalNetWorth)}
    </div>
  ),
}));

vi.mock('@/components/projection/results/MonteCarloPanel', () => ({
  MonteCarloPanel: () => <div data-testid="monte-carlo-panel" />,
}));

vi.mock('@/components/projection/results/BacktestPanel', () => ({
  BacktestPanel: () => <div data-testid="backtest-panel" />,
}));

vi.mock('@/components/projection/results/OptimizationsTab', () => ({
  OptimizationsTab: () => <div data-testid="optimizations-tab" />,
}));

vi.mock('@/components/projection/results/EstateTab', () => ({
  EstateTab: () => <div data-testid="estate-tab" />,
}));

vi.mock('@/components/projection/results/InflationToggle', () => ({
  InflationToggle: ({
    displayMode,
    onChange,
  }: {
    displayMode: 'nominal' | 'real';
    onChange: (mode: 'nominal' | 'real') => void;
  }) => (
    <div data-testid="inflation-toggle">
      <button
        type="button"
        data-testid="toggle-nominal"
        aria-pressed={displayMode === 'nominal'}
        onClick={() => onChange('nominal')}
      >
        Nominal CAD
      </button>
      <button
        type="button"
        data-testid="toggle-real"
        aria-pressed={displayMode === 'real'}
        onClick={() => onChange('real')}
      >
        Real CAD
      </button>
    </div>
  ),
}));

const projectionRows = [
  {
    year: 2026,
    age: 65,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 0,
    netCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 100000,
    householdTotalIncome: 0,
    householdTotalTax: 0,
    householdNetCashFlow: 0,
    householdNetWorth: 100000,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
  },
  {
    year: 2027,
    age: 66,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 0,
    netCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 110000,
    householdTotalIncome: 0,
    householdTotalTax: 0,
    householdNetCashFlow: 0,
    householdNetWorth: 110000,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
  },
] as ProjectionYearRow[];

const scenarioDetail: ProfileScenarioDetail = {
  id: 'scenario-1',
  profile_id: 'profile-1',
  name: 'Base Scenario',
  is_base: true,
  status: 'completed',
  calculated_at: '2026-04-20T12:00:00Z',
  decisions: {},
  created_at: '2026-04-20T12:00:00Z',
  updated_at: '2026-04-20T12:00:00Z',
  result_data: {
    projectionRows,
    assumptions: {
      inflationRate: 0.1,
    },
  },
};

describe('ScenarioResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'scenario-1' });
    mockGetProfileScenario.mockResolvedValue(scenarioDetail);
    mockRunProfileScenario.mockResolvedValue(scenarioDetail);
  });

  it('renders the inflation toggle and updates charts plus year-by-year rows to real dollars', async () => {
    const user = userEvent.setup();

    render(<ScenarioResultsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('inflation-toggle')).toBeInTheDocument();
    });

    expect(screen.getByTestId('charts-tab')).toHaveTextContent('nominal:110000.00');
    expect(screen.getByTestId('year-by-year-tab')).toHaveTextContent('nominal:110000.00');

    await user.click(screen.getByTestId('toggle-real'));

    expect(screen.getByTestId('charts-tab')).toHaveTextContent('real:100000.00');
    expect(screen.getByTestId('year-by-year-tab')).toHaveTextContent('real:100000.00');
  });
});
