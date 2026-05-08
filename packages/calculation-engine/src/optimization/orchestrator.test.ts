/**
 * Optimization Orchestrator Tests
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-001, TC-OPT-ORCH-002, TC-OPT-ORCH-003, TC-OPT-ORCH-004
 * @see REQUIREMENTS.md — CARD-02, CARD-03, CARD-04
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOptimizationAnalysis } from './orchestrator.js';
import type { OptimizationInput } from './types.js';
import type { ProjectionOutput, InsightCard } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Mock all four analyzer modules
// ---------------------------------------------------------------------------
vi.mock('./analyzers/income-splitting.js', () => ({
  analyzeIncomeSplitting: vi.fn(),
}));

vi.mock('./analyzers/cpp-oas.js', () => ({
  analyzeCPPOAS: vi.fn(),
}));

vi.mock('./analyzers/rrsp-meltdown.js', () => ({
  analyzeRRSPMeltdown: vi.fn(),
}));

vi.mock('./analyzers/drawdown-order.js', () => ({
  analyzeDrawdownOrder: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper factory for InsightCard
// ---------------------------------------------------------------------------
function makeCard(module: InsightCard['module'], estimatedDollarImpact: number): InsightCard {
  return {
    module,
    title: `${module} card`,
    explanation: 'Test explanation',
    estimatedDollarImpact,
    confidence: 'MEDIUM',
  };
}

// ---------------------------------------------------------------------------
// Helper for minimal OptimizationInput
// ---------------------------------------------------------------------------
function makeInput(): OptimizationInput {
  const baselineOutput = {
    id: 'test-orch',
    yearlyResults: [],
    summary: { totalTaxesPaid: 100000 },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ProjectionOutput;

  const clonedInput = {
    birthdate: new Date('1960-01-01'),
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'single' as const,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 200000,
    rrspAnnualContribution: 0,
    tfsaBalance: 100000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 50000,
    retirementSpending: 50000,
    investmentReturn: 0.05,
    inflationRate: 0.02,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    spouse: undefined,
  };

  return { baselineOutput, clonedInput };
}

// ---------------------------------------------------------------------------
// TC-OPT-ORCH-001: Cards sorted by estimatedDollarImpact descending (CARD-02)
// ---------------------------------------------------------------------------

describe('TC-OPT-ORCH-001: runOptimizationAnalysis sorts cards by estimatedDollarImpact descending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cards in descending order of estimatedDollarImpact', async () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-001
     * CARD-02: Cards with impacts [5000, 15000, 2000, 8000] → sorted [15000, 8000, 5000, 2000]
     */
    const { analyzeIncomeSplitting } = await import('./analyzers/income-splitting.js');
    const { analyzeCPPOAS } = await import('./analyzers/cpp-oas.js');
    const { analyzeRRSPMeltdown } = await import('./analyzers/rrsp-meltdown.js');
    const { analyzeDrawdownOrder } = await import('./analyzers/drawdown-order.js');

    vi.mocked(analyzeIncomeSplitting).mockReturnValue(makeCard('income-splitting', 5000));
    vi.mocked(analyzeCPPOAS).mockReturnValue([makeCard('cpp-timing', 15000)]);
    vi.mocked(analyzeRRSPMeltdown).mockReturnValue(makeCard('rrsp-meltdown', 2000));
    vi.mocked(analyzeDrawdownOrder).mockReturnValue(makeCard('drawdown-order', 8000));

    const result = runOptimizationAnalysis(makeInput());

    expect(result.wellOptimized).toBe(false);
    expect(result.cards).toHaveLength(4);
    expect(result.cards[0]?.estimatedDollarImpact).toBe(15000);
    expect(result.cards[1]?.estimatedDollarImpact).toBe(8000);
    expect(result.cards[2]?.estimatedDollarImpact).toBe(5000);
    expect(result.cards[3]?.estimatedDollarImpact).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// TC-OPT-ORCH-002: Returns wellOptimized when all analyzers return null/empty (CARD-04)
// ---------------------------------------------------------------------------

describe('TC-OPT-ORCH-002: runOptimizationAnalysis returns wellOptimized when all null', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { cards: [], wellOptimized: true, message: "well-optimized" } when all analyzers return null', async () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-002
     * CARD-04: All analyzers return null or empty array → wellOptimized message
     */
    const { analyzeIncomeSplitting } = await import('./analyzers/income-splitting.js');
    const { analyzeCPPOAS } = await import('./analyzers/cpp-oas.js');
    const { analyzeRRSPMeltdown } = await import('./analyzers/rrsp-meltdown.js');
    const { analyzeDrawdownOrder } = await import('./analyzers/drawdown-order.js');

    vi.mocked(analyzeIncomeSplitting).mockReturnValue(null);
    vi.mocked(analyzeCPPOAS).mockReturnValue([]);
    vi.mocked(analyzeRRSPMeltdown).mockReturnValue(null);
    vi.mocked(analyzeDrawdownOrder).mockReturnValue(null);

    const result = runOptimizationAnalysis(makeInput());

    expect(result.cards).toHaveLength(0);
    expect(result.wellOptimized).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('well-optimized');
  });
});

// ---------------------------------------------------------------------------
// TC-OPT-ORCH-003: Filters null results (CARD-03)
// ---------------------------------------------------------------------------

describe('TC-OPT-ORCH-003: runOptimizationAnalysis filters null results from card array', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes only non-null cards when some analyzers return null', async () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-003
     * CARD-03: Two analyzers return null, one returns a card — only the card is in result
     */
    const { analyzeIncomeSplitting } = await import('./analyzers/income-splitting.js');
    const { analyzeCPPOAS } = await import('./analyzers/cpp-oas.js');
    const { analyzeRRSPMeltdown } = await import('./analyzers/rrsp-meltdown.js');
    const { analyzeDrawdownOrder } = await import('./analyzers/drawdown-order.js');

    vi.mocked(analyzeIncomeSplitting).mockReturnValue(null);
    vi.mocked(analyzeCPPOAS).mockReturnValue([]);
    vi.mocked(analyzeRRSPMeltdown).mockReturnValue(null);
    vi.mocked(analyzeDrawdownOrder).mockReturnValue(makeCard('drawdown-order', 5000));

    const result = runOptimizationAnalysis(makeInput());

    expect(result.wellOptimized).toBe(false);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.module).toBe('drawdown-order');
  });
});

// ---------------------------------------------------------------------------
// TC-OPT-ORCH-004: flatMap handles InsightCard[] from analyzeCPPOAS
// ---------------------------------------------------------------------------

describe('TC-OPT-ORCH-004: runOptimizationAnalysis flattens InsightCard[] from analyzeCPPOAS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly flattens array from analyzeCPPOAS and single cards from other analyzers', async () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-ORCH-004
     * analyzeCPPOAS returns InsightCard[] (array) while others return InsightCard|null.
     * flatMap must handle both shapes correctly — all 3 cards should be in result.
     */
    const { analyzeIncomeSplitting } = await import('./analyzers/income-splitting.js');
    const { analyzeCPPOAS } = await import('./analyzers/cpp-oas.js');
    const { analyzeRRSPMeltdown } = await import('./analyzers/rrsp-meltdown.js');
    const { analyzeDrawdownOrder } = await import('./analyzers/drawdown-order.js');

    const card1 = makeCard('cpp-timing', 12000);
    const card2 = makeCard('cpp-timing', 8000);
    const card3 = makeCard('rrsp-meltdown', 5000);

    vi.mocked(analyzeIncomeSplitting).mockReturnValue(null);
    vi.mocked(analyzeCPPOAS).mockReturnValue([card1, card2]);
    vi.mocked(analyzeRRSPMeltdown).mockReturnValue(card3);
    vi.mocked(analyzeDrawdownOrder).mockReturnValue(null);

    const result = runOptimizationAnalysis(makeInput());

    expect(result.wellOptimized).toBe(false);
    expect(result.cards).toHaveLength(3);

    // Sorted by estimatedDollarImpact descending: 12000, 8000, 5000
    expect(result.cards[0]?.estimatedDollarImpact).toBe(12000);
    expect(result.cards[1]?.estimatedDollarImpact).toBe(8000);
    expect(result.cards[2]?.estimatedDollarImpact).toBe(5000);
  });
});
