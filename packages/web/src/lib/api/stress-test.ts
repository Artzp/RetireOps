/**
 * Stress Test API Client — Feature 3.3
 *
 * Calls POST /api/profile/scenarios/:id/stress-test.
 */
import { api } from './client';

export interface StressYearData {
  year: number;
  returnRate: number;
  balance: number;
}

export interface StressScenarioResult {
  scenario: 'market_crash_at_retirement' | 'lost_decade' | 'high_inflation' | '2008_replay';
  description: string;
  finalBalance: number;
  depletionYear: number | null;
  yearlyData: StressYearData[];
}

export interface StressTestResults {
  results: StressScenarioResult[];
}

/**
 * Run all 4 stress-test scenarios for a profile scenario.
 * POST /api/profile/scenarios/:id/stress-test → 200 { data: StressTestResults }
 */
export async function runProfileScenarioStressTest(scenarioId: string): Promise<StressTestResults> {
  const result = await api.post<StressTestResults>(`/profile/scenarios/${scenarioId}/stress-test`);
  return result.data;
}
