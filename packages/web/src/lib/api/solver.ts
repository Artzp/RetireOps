/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { api } from '@/lib/api/client';
import type { SolverInput, SolverResult } from '@retireops/shared';

/**
 * Prefill data returned by GET /api/solver/prefill.
 * Mirrors packages/api/src/services/solver.service.ts SolverPrefillData exactly.
 */
export interface SolverPrefillData {
  province: string | null;
  currentAge: number | null;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  employmentIncome: number;
  cppStartAge: number;
  oasStartAge: number;
}

/**
 * Fetch pre-fill data from the user's active household profile.
 * Returns null silently when no profile exists or on any API error.
 *
 * @see packages/api/src/routes/solver.routes.ts - GET /solver/prefill
 */
export async function getSolverPrefill(): Promise<SolverPrefillData | null> {
  try {
    const result = await api.get<SolverPrefillData | null>('/solver/prefill');
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Submit a solver request to the API.
 * Does NOT catch errors — callers should handle field-level error display.
 *
 * @see packages/api/src/routes/solver.routes.ts - POST /solver
 */
export async function postSolver(input: SolverInput): Promise<SolverResult> {
  const result = await api.post<SolverResult>('/solver', input);
  return result.data;
}
