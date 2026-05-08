import { solveSingle, runSingleProjection } from '@retireops/calculation-engine';
import type { SolverInput, SolverResult } from '@retireops/shared';
import { db } from '../db/connection.js';

/**
 * Run the solver with the provided input.
 * Injects runSingleProjection as the callback — never import multi-year.ts directly.
 * @see packages/calculation-engine/src/projection/solver.ts
 */
export function runSolver(input: SolverInput): SolverResult {
  return solveSingle(input, runSingleProjection);
}

/**
 * Pre-fill data extracted from the user's household profile step_data JSONB.
 * Returns 8 fields for the solver form, or null if no profile exists.
 * @see docs/source-of-truth/01-user-profile.md
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
 * Extract 8 solver pre-fill fields from the user's household profile.
 * Returns null (not 404) when no profile exists — client handles the no-profile case.
 * userId is sourced from req.user!.id (JWT-validated) so no cross-user access is possible.
 * @see docs/TESTABLE-SURFACES.md — TC-SOLVER-008
 */
export async function getPrefillData(userId: string): Promise<SolverPrefillData | null> {
  const row = await db
    .selectFrom('household_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!row) return null;

  const stepData = (row.step_data ?? {}) as Record<string, unknown>;

  // about_you step — province and date of birth
  const aboutYou = (stepData['about_you'] ?? {}) as Record<string, unknown>;
  const province = typeof aboutYou['province'] === 'string' ? aboutYou['province'] : null;
  const dobStr = typeof aboutYou['dateOfBirth'] === 'string' ? aboutYou['dateOfBirth'] : null;
  const currentAge = dobStr
    ? Math.floor((Date.now() - new Date(dobStr).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  // accounts step — extract RRSP, TFSA, Non-Registered balances from cards array
  const accountsStep = (stepData['accounts'] ?? {}) as Record<string, unknown>;
  const accountCards = Array.isArray(accountsStep['cards']) ? accountsStep['cards'] : [];
  let rrspBalance = 0;
  let tfsaBalance = 0;
  let nonRegBalance = 0;
  for (const card of accountCards) {
    const c = card as Record<string, unknown>;
    const bal = Number(c['currentBalance'] ?? c['balance'] ?? 0) || 0;
    const type = String(c['type'] ?? '');
    if (type === 'RRSP') rrspBalance += bal;
    else if (type === 'TFSA') tfsaBalance += bal;
    else if (type === 'Non-Registered') nonRegBalance += bal;
  }

  // income step — extract employment income from cards array
  const incomeStep = (stepData['income'] ?? {}) as Record<string, unknown>;
  const incomeCards = Array.isArray(incomeStep['cards']) ? incomeStep['cards'] : [];
  let employmentIncome = 0;
  for (const card of incomeCards) {
    const c = card as Record<string, unknown>;
    const type = String(c['type'] ?? '');
    if (type === 'Employment Salary' || type === 'employment') {
      employmentIncome += Number(c['annualAmount'] ?? 0) || 0;
    }
  }

  // CPP/OAS start age defaults to 65 — benefits step stores estimated amounts, not start ages
  const cppStartAge = 65;
  const oasStartAge = 65;

  return {
    province,
    currentAge,
    rrspBalance,
    tfsaBalance,
    nonRegBalance,
    employmentIncome,
    cppStartAge,
    oasStartAge,
  };
}
