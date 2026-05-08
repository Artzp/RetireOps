import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptimizationsTab } from '../OptimizationsTab';
import { getScenarioOptimizations } from '@/lib/api/optimizations';

vi.mock('@/lib/api/optimizations', () => ({
  CoupleNotSupportedError: class CoupleNotSupportedError extends Error {},
  getScenarioOptimizations: vi.fn(),
}));

describe('OptimizationsTab', () => {
  it('renders structured recommendation fields with explanation as supporting detail', async () => {
    vi.mocked(getScenarioOptimizations).mockResolvedValue({
      wellOptimized: false,
      cards: [
        {
          module: 'rrsp-meltdown',
          title: 'RRSP Meltdown Strategy',
          recommendedAction: 'Withdraw about $20,000 per year from your RRSP.',
          whyItHelps: 'This fills lower tax brackets before mandatory RRIF withdrawals begin.',
          affectedYears: [2028, 2029, 2030, 2032],
          estimatedAnnualSavings: 1500,
          appliesTo: 'primary',
          explanation: 'Longer supporting explanation remains available.',
          estimatedDollarImpact: 6000,
          confidence: 'HIGH',
        },
      ],
    });

    render(<OptimizationsTab scenarioId="scenario-1" />);

    expect(await screen.findByText('Recommended action')).toBeInTheDocument();
    expect(screen.getByText('Withdraw about $20,000 per year from your RRSP.')).toBeInTheDocument();
    expect(screen.getByText('Why it helps')).toBeInTheDocument();
    expect(
      screen.getByText('This fills lower tax brackets before mandatory RRIF withdrawals begin.')
    ).toBeInTheDocument();
    expect(screen.getByText('Affected years')).toBeInTheDocument();
    expect(screen.getByText('2028-2030, 2032')).toBeInTheDocument();
    expect(screen.getByText('Annual savings')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(
      screen.getByText('Longer supporting explanation remains available.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare scenario/i })).not.toBeInTheDocument();
  });

  it('falls back to legacy card fields when structured fields are absent', async () => {
    vi.mocked(getScenarioOptimizations).mockResolvedValue({
      wellOptimized: false,
      cards: [
        {
          module: 'drawdown-order',
          title: 'Withdrawal Order Optimization',
          explanation: 'Legacy prose-only recommendation.',
          estimatedDollarImpact: 3000,
          confidence: 'MEDIUM',
        },
      ],
    });

    render(<OptimizationsTab scenarioId="scenario-1" />);

    expect(await screen.findAllByText('Withdrawal Order Optimization')).toHaveLength(2);
    expect(screen.getAllByText('Legacy prose-only recommendation.')).toHaveLength(2);
  });
});
