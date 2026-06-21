/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Profile Scenario Service
 *
 * CRUD operations for profile_scenarios — the decisions layer on top of
 * the Household Profile. Implements SCEN-06 (clone) and SCEN-07 (delete
 * with base guard). Also implements SCEN-08 recompute pipeline triggered
 * by profile PATCH. Also implements run (D-01–D-03) and compare (D-15–D-16)
 * for Phase 21.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-06, SCEN-07, SCEN-08
 */
import { db } from '../db/connection.js';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/error-handler.js';
import type { ProfileData } from './profile.service.js';
import { assembleProfileInputData } from './profile-assembler.js';
import { applyScenarioDecisions } from './scenario-decisions.js';
import {
  transformToProjectionInput,
  transformToFrontendOutput,
  type FrontendSummary,
  type FrontendYearlyResult,
} from './projection-transformer.js';
import { runProjection } from '@retireops/calculation-engine';
import type { ScenarioDecisions } from '@retireops/shared';
import { ScenarioDecisionsSchema, scenarioDecisionTemplates } from '@retireops/shared';
import { logger } from '../utils/logger.js';

/**
 * Resolve the household profile ID for a given user.
 * Throws NotFoundError if no profile exists yet.
 */
async function resolveProfileId(userId: string): Promise<string> {
  const profile = await db
    .selectFrom('household_profiles')
    .select(['id'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!profile) throw new NotFoundError('Profile');
  return profile.id;
}

/**
 * List all scenarios for the authenticated user's profile.
 * Returns metadata only — result_data is excluded (D-05).
 *
 * @see docs/source-of-truth/10-scenarios.md - D-05
 */
export async function listProfileScenarios(userId: string) {
  const profileId = await resolveProfileId(userId);
  return db
    .selectFrom('profile_scenarios')
    .select([
      'id',
      'name',
      'is_base',
      'status',
      'calculated_at',
      'decisions',
      'created_at',
      'updated_at',
    ])
    .where('profile_id', '=', profileId)
    .orderBy('created_at', 'asc')
    .execute();
}

/**
 * Get a single scenario including result_data (D-06).
 * Throws NotFoundError if the scenario does not belong to the user's profile.
 *
 * @see docs/source-of-truth/10-scenarios.md - D-06
 */
export async function getProfileScenario(userId: string, scenarioId: string) {
  const profileId = await resolveProfileId(userId);
  const scenario = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenario) throw new NotFoundError('Scenario');
  return scenario;
}

/**
 * Clone a scenario — deep copy with name suffixed "(copy)" and is_base=false.
 * Implements SCEN-06.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-06
 */
export async function cloneProfileScenario(userId: string, scenarioId: string) {
  const profileId = await resolveProfileId(userId);
  const source = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!source) throw new NotFoundError('Scenario');

  return db
    .insertInto('profile_scenarios')
    .values({
      profile_id: source.profile_id,
      name: `${source.name} (copy)`,
      is_base: false,
      decisions: source.decisions as never,
      result_data: null,
      status: 'pending',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Create a blank non-base scenario for the authenticated user's profile.
 * The new scenario has is_base=false, status='pending', and an empty decisions object.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-06
 */
export async function createProfileScenario(userId: string, name: string) {
  const profileId = await resolveProfileId(userId);
  return db
    .insertInto('profile_scenarios')
    .values({
      profile_id: profileId,
      name,
      is_base: false,
      decisions: {},
      result_data: null,
      status: 'pending',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Create a non-base scenario pre-filled with a template's `decisions` payload.
 * Template definitions live in `@retireops/shared/scenario-decision-templates`.
 * Throws NotFoundError if templateId does not match any known template.
 */
export async function createProfileScenarioFromTemplate(
  userId: string,
  templateId: string,
  name: string
) {
  const template = scenarioDecisionTemplates.find((t) => t.id === templateId);
  if (!template) throw new NotFoundError('Template');
  const profileId = await resolveProfileId(userId);
  return db
    .insertInto('profile_scenarios')
    .values({
      profile_id: profileId,
      name,
      is_base: false,
      decisions: template.decisions,
      result_data: null,
      status: 'pending',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Rename a non-base scenario.
 * Throws NotFoundError (404) if not found.
 * Throws ConflictError (409) if the target is the Base Scenario.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-06
 */
export async function renameProfileScenario(userId: string, scenarioId: string, name: string) {
  const profileId = await resolveProfileId(userId);
  const scenario = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenario) throw new NotFoundError('Scenario');
  if (scenario.is_base) throw new ConflictError('Cannot rename the Base Scenario');
  return db
    .updateTable('profile_scenarios')
    .set({ name, updated_at: new Date() })
    .where('id', '=', scenarioId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Delete a non-base scenario.
 * Throws ConflictError (409) if the scenario is_base=true (SCEN-07).
 * Throws NotFoundError (404) if not found.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-07
 */
export async function deleteProfileScenario(userId: string, scenarioId: string): Promise<void> {
  const profileId = await resolveProfileId(userId);
  const scenario = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenario) throw new NotFoundError('Scenario');
  if (scenario.is_base) throw new ConflictError('Cannot delete the Base Scenario');
  await db.deleteFrom('profile_scenarios').where('id', '=', scenarioId).execute();
}

/**
 * Phase 2 — D-46. Stamps ISO-8601 createdAt / updatedAt on each withdrawalOverrides[] /
 * spendingOverrides[] record in `patch`. Records identified by composite key:
 *   - withdrawalOverrides: (field, year)
 *   - spendingOverrides: (year)
 * createdAt is preserved from `existing` when the record already existed; updatedAt is
 * always set to `now`. New records get both = now.
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-46
 * @see docs/source-of-truth/10-scenarios.md - PROV-02
 */
function stampOverrideTimestamps<
  T extends { withdrawalOverrides?: any[]; spendingOverrides?: any[] },
>(
  patch: T,
  existing: { withdrawalOverrides?: any[]; spendingOverrides?: any[] } | undefined,
  now: string
): T {
  const result = { ...patch };

  if (Array.isArray(patch.withdrawalOverrides)) {
    result.withdrawalOverrides = patch.withdrawalOverrides.map((rec: any) => {
      const prior = existing?.withdrawalOverrides?.find(
        (r: any) => r.field === rec.field && r.year === rec.year
      );
      return {
        ...rec,
        // D-46: createdAt preserved from existing record; new records get now
        createdAt: prior?.createdAt ?? now,
        // D-46: updatedAt always set to now for new or modified records
        updatedAt: now,
        // originalEngineValue is set by injectOriginalEngineValues — preserve existing anchor.
        // Phase 2 migration note: pre-Phase-2 records have no originalEngineValue.
        // When prior.originalEngineValue is undefined, we intentionally omit the spread
        // here — injectOriginalEngineValues will compute the current baseline as the anchor
        // on this first Phase-2 PATCH. This is "first touch wins" for migrated rows, not
        // "first-ever override wins". Any "was $X" shown to the user reflects the engine
        // value at the time of their first Phase-2 save, not the original Phase-1 override.
        ...(prior?.originalEngineValue !== undefined
          ? { originalEngineValue: prior.originalEngineValue }
          : {}),
      };
    });
  }

  if (Array.isArray(patch.spendingOverrides)) {
    result.spendingOverrides = patch.spendingOverrides.map((rec: any) => {
      const prior = existing?.spendingOverrides?.find((r: any) => r.year === rec.year);
      return {
        ...rec,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        // Phase 2 migration note: same "first touch wins" semantics as withdrawalOverrides
        // above — pre-Phase-2 spending override records without originalEngineValue will
        // receive a fresh baseline anchor on their first Phase-2 PATCH.
        ...(prior?.originalEngineValue !== undefined
          ? { originalEngineValue: prior.originalEngineValue }
          : {}),
      };
    });
  }

  return result;
}

/**
 * Phase 2 — D-47. For records that did NOT exist in `existing` (newly-created overrides),
 * set `originalEngineValue` from the baseline projection at (year, field). For records that
 * already exist (re-save), preserve `originalEngineValue` — it anchors the FIRST engine value
 * the user overrode, not a moving target.
 *
 * Field mapping from withdrawalOverrides.field to projectionRows field:
 *   rrsp  → rrifWithdrawal  (RRSP converts to RRIF before drawdown; engine exposes via rrifWithdrawal)
 *   rrif  → rrifWithdrawal
 *   tfsa  → tfsaWithdrawal
 *   nonreg → nonRegWithdrawal
 *   lif   → lifWithdrawal
 * For spendingOverrides: read livingExpenses from the per-year row.
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-47
 * @see docs/source-of-truth/10-scenarios.md - PROV-02, T-PROV-02
 */
function injectOriginalEngineValues<
  T extends { withdrawalOverrides?: any[]; spendingOverrides?: any[] },
>(
  patch: T,
  baseline: { projectionRows?: any[]; yearlyResults?: any[] } | undefined,
  existing: { withdrawalOverrides?: any[]; spendingOverrides?: any[] } | undefined
): T {
  // Index baseline projection rows by year for O(1) lookup
  const rowsByYear = new Map<number, any>();
  const rows: any[] = baseline?.projectionRows ?? baseline?.yearlyResults ?? [];
  for (const row of rows) {
    if (typeof row.year === 'number') rowsByYear.set(row.year, row);
  }

  const result = { ...patch };

  if (Array.isArray(patch.withdrawalOverrides)) {
    result.withdrawalOverrides = patch.withdrawalOverrides.map((rec: any) => {
      // Preserve existing originalEngineValue anchor — it records the FIRST pre-override value
      if (typeof rec.originalEngineValue === 'number') return rec;
      const owner: 'primary' | 'spouse' = rec.owner ?? 'primary';
      const prior = existing?.withdrawalOverrides?.find(
        (r: any) => r.field === rec.field && r.year === rec.year && (r.owner ?? 'primary') === owner
      );
      if (prior?.originalEngineValue !== undefined) {
        return { ...rec, originalEngineValue: prior.originalEngineValue };
      }

      // New override record — capture baseline engine value for (year, field, owner)
      const row = rowsByYear.get(rec.year);
      if (!row) {
        // D-47: Year falls outside projection range or engine produced no row.
        // Audit C-09: anchor to 0 but flag it so the UI can show "unavailable"
        // instead of a misleading "was $0" (PROV-02).
        logger.error('injectOriginalEngineValues: no baseline row for year', {
          year: rec.year,
          field: rec.field,
          owner,
        });
        return { ...rec, originalEngineValue: 0, originalEngineValueMissing: true };
      }

      let baselineValue: number | undefined;
      // D-47 field mapping: rrsp and rrif both read rrifWithdrawal (RRSP converts to RRIF).
      // Spouse owner reads the spouse-prefixed counterpart from the same row.
      if (owner === 'spouse') {
        switch (rec.field) {
          case 'rrsp':
          case 'rrif':
            baselineValue = row.spouseRrifWithdrawal;
            break;
          case 'tfsa':
            baselineValue = row.spouseTfsaWithdrawal;
            break;
          case 'nonreg':
            baselineValue = row.spouseNonRegWithdrawal;
            break;
          case 'lif':
            baselineValue = row.spouseLifWithdrawal;
            break;
        }
      } else {
        switch (rec.field) {
          case 'rrsp':
          case 'rrif':
            baselineValue = row.rrifWithdrawal;
            break;
          case 'tfsa':
            baselineValue = row.tfsaWithdrawal;
            break;
          case 'nonreg':
            baselineValue = row.nonRegWithdrawal;
            break;
          case 'lif':
            baselineValue = row.lifWithdrawal;
            break;
        }
      }
      if (typeof baselineValue !== 'number' || !Number.isFinite(baselineValue)) {
        logger.error('injectOriginalEngineValues: no finite baseline for withdrawal field', {
          year: rec.year,
          field: rec.field,
          owner,
          baselineValue,
        });
        return { ...rec, originalEngineValue: 0, originalEngineValueMissing: true };
      }
      return { ...rec, originalEngineValue: Math.max(0, baselineValue) };
    });
  }

  if (Array.isArray(patch.spendingOverrides)) {
    result.spendingOverrides = patch.spendingOverrides.map((rec: any) => {
      if (typeof rec.originalEngineValue === 'number') return rec;
      const owner: 'primary' | 'spouse' = rec.owner ?? 'primary';
      const prior = existing?.spendingOverrides?.find(
        (r: any) => r.year === rec.year && (r.owner ?? 'primary') === owner
      );
      if (prior?.originalEngineValue !== undefined) {
        return { ...rec, originalEngineValue: prior.originalEngineValue };
      }
      const row = rowsByYear.get(rec.year);
      if (!row) {
        // Audit C-09: see withdrawalOverrides branch above.
        logger.error('injectOriginalEngineValues: no baseline row for year', {
          year: rec.year,
          field: 'spending',
          owner,
        });
        return { ...rec, originalEngineValue: 0, originalEngineValueMissing: true };
      }
      const baselineValue: number | undefined =
        owner === 'spouse' ? row.spouseLivingExpenses : row.livingExpenses;
      if (typeof baselineValue !== 'number' || !Number.isFinite(baselineValue)) {
        logger.error('injectOriginalEngineValues: no finite baseline for spending', {
          year: rec.year,
          owner,
          baselineValue,
        });
        return { ...rec, originalEngineValue: 0, originalEngineValueMissing: true };
      }
      return { ...rec, originalEngineValue: Math.max(0, baselineValue) };
    });
  }

  return result;
}

/**
 * Merge-patch scenario decisions.
 * Fetches existing decisions JSONB, shallow-merges the patch, writes back.
 * Always sets status='stale' because decisions changed invalidates result_data.
 *
 * @see .planning/phases/20-decisions-editor/20-CONTEXT.md - merge-patch requirement
 */
export async function updateScenarioDecisions(
  userId: string,
  scenarioId: string,
  patch: Partial<ScenarioDecisions>
): Promise<void> {
  const profileId = await resolveProfileId(userId);
  const scenario = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenario) throw new NotFoundError('Scenario');

  // decisions may be a raw object (real DB) or a JSON string (mock DB / legacy rows)
  const rawDecisions = (scenario as any).decisions ?? {};
  const decisionsObj =
    typeof rawDecisions === 'string' ? (JSON.parse(rawDecisions) as unknown) : rawDecisions;
  const existing = ScenarioDecisionsSchema.parse(decisionsObj);

  // Phase 2 — Detect whether this patch touches override arrays.
  // Only override-touching patches need the baseline recompute (T-LATENCY-01 optimisation).
  const touchesOverrides =
    Array.isArray(patch.withdrawalOverrides) || Array.isArray(patch.spendingOverrides);

  let augmentedPatch: Partial<ScenarioDecisions> = patch;

  if (touchesOverrides) {
    // D-46: Generate the service-layer timestamp (engine never calls Date.now — D-49).
    const now = new Date().toISOString();

    // D-47: Run a baseline projection against PRE-MERGE decisions to capture
    // the engine-calculated value for each newly-overridden (year, field) cell.
    // Uses computeScenarioResult which is the same code path as POST /run.
    // Typical latency < 50ms on a warm node process (T-LATENCY-01).
    // Pitfall 5: must use PRE-MERGE decisions (existing), not the patched ones.
    const profile = await getProfileById(profileId);
    const baseline = computeScenarioResult(profile, { ...(scenario as any), decisions: existing });

    // ORDER INVARIANT (WR-02): stampOverrideTimestamps MUST run before
    // injectOriginalEngineValues. stampOverrideTimestamps copies
    // prior.originalEngineValue onto re-saved records; injectOriginalEngineValues
    // then skips records where typeof rec.originalEngineValue === 'number',
    // correctly preserving the FIRST pre-override baseline anchor rather than
    // re-anchoring to a later PATCH's baseline. Swapping this order would
    // permanently reset originalEngineValue for re-saved overrides.
    augmentedPatch = stampOverrideTimestamps(
      patch as any,
      existing as any,
      now
    ) as Partial<ScenarioDecisions>;
    augmentedPatch = injectOriginalEngineValues(
      augmentedPatch as any,
      baseline.resultData as { projectionRows?: any[]; yearlyResults?: any[] },
      existing as any
    ) as Partial<ScenarioDecisions>;
  }

  const merged = { ...existing, ...augmentedPatch };

  // WR-09: Re-validate the merged object BEFORE writing. Shallow-merge replaces
  // array fields wholesale (withdrawalOverrides, spendingOverrides) — but a
  // future caller (direct DB write, migration path, bypassed route handler)
  // could leave the blob in a state that violates cross-field invariants
  // (duplicate (field, year) tuples, 200-record cap, negative amounts). The
  // route layer's Zod validation on the partial patch alone is insufficient
  // since invariants like "no duplicate (field, year)" span the full array.
  // Re-parsing is cheap and surfaces corruption at save time instead of
  // deferring to computeScenarioResult (line 302) which re-parses on run.
  // D-49: Zod re-parse validates the metadata fields (createdAt, updatedAt,
  // originalEngineValue) are within their declared optional bounds — engine
  // fields (amount, applyForward, year, field) pass through unchanged.
  const validated = ScenarioDecisionsSchema.parse(merged);

  await db
    .updateTable('profile_scenarios')
    .set({ decisions: validated, status: 'stale', updated_at: new Date() })
    .where('id', '=', scenarioId)
    .execute();
}

/**
 * Fetch household profile by primary key (internal helper — not exported).
 */
async function getProfileById(profileId: string): Promise<ProfileData> {
  const row = await db
    .selectFrom('household_profiles')
    .selectAll()
    .where('id', '=', profileId)
    .executeTakeFirst();
  if (!row) throw new NotFoundError('Profile');
  return {
    id: (row as any).id as string,
    stepData: ((row as any).step_data ?? {}) as Record<string, unknown>,
    currentStep: (row as any).current_step as number,
    createdAt: (row as any).created_at as Date,
    updatedAt: (row as any).updated_at as Date,
  };
}

/**
 * Mark all scenarios for a profile as 'stale'.
 * Called synchronously inside upsertProfileStep BEFORE the HTTP response (D-04).
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-08
 */
export async function markScenariosStale(profileId: string): Promise<void> {
  await db
    .updateTable('profile_scenarios')
    .set({ status: 'stale', updated_at: new Date() })
    .where('profile_id', '=', profileId)
    .execute();
}

/**
 * Shared per-scenario computation pipeline (no DB writes).
 * Accepts a raw DB profile and scenario row, returns computed resultData.
 *
 * Used by both recomputeAllScenarios (bulk) and runSingleScenario (single).
 *
 * @see docs/source-of-truth/10-scenarios.md - D-02
 */
function computeScenarioResult(
  profile: ProfileData,
  scenarioRow: any
): { resultData: ReturnType<typeof transformToFrontendOutput>; lifeExpectancy: number } {
  const baseInput = assembleProfileInputData(profile);
  // decisions may be a raw object (real DB) or a JSON string (mock DB / legacy rows)
  const rawDecisions = scenarioRow.decisions ?? {};
  const decisionsObj =
    typeof rawDecisions === 'string' ? (JSON.parse(rawDecisions) as unknown) : rawDecisions;
  const decisions = ScenarioDecisionsSchema.parse(decisionsObj);
  const inputWithDecisions = applyScenarioDecisions(baseInput, decisions);
  const calcInput = transformToProjectionInput(inputWithDecisions);
  const calcOutput = runProjection(calcInput);
  // Phase 2 — D-32, D-44: pass decisions so the transformer can compose overrideMeta
  // (createdAt / updatedAt / originalEngineValue) onto provenance cells whose
  // source === 'override'. Additive optional parameter — no existing callers break.
  const resultData = transformToFrontendOutput(
    calcOutput,
    inputWithDecisions.personalInfo.lifeExpectancy,
    decisions
  );
  // Feature 3.4 — expose the inflation assumption so the UI inflation toggle
  // can deflate monetary columns into today's-dollar terms without a re-run.
  // Additionally surface other calcInput-derived assumptions for the Summary
  // "Assumptions Used" panel. Engine math is unchanged; this is a read-out of
  // the input bundle the engine already consumed.
  // Conditional spread keeps optional fields out of the object when the source
  // is undefined, satisfying `exactOptionalPropertyTypes: true`.
  resultData.assumptions = {
    inflationRate: calcInput.inflationRate,
    investmentReturn: calcInput.investmentReturn,
    province: calcInput.province,
    retirementAge: calcInput.retirementAge,
    lifeExpectancy: calcInput.lifeExpectancy,
    ...(calcInput.cppStartAge !== undefined && { cppStartAge: calcInput.cppStartAge }),
    ...(calcInput.oasStartAge !== undefined && { oasStartAge: calcInput.oasStartAge }),
    ...(calcInput.yearsOfResidence !== undefined && {
      yearsOfResidence: calcInput.yearsOfResidence,
    }),
    ...(calcInput.expectedCPPAt65 !== undefined && {
      expectedCPPAt65: calcInput.expectedCPPAt65,
    }),
    taxYear: calcInput.projectionStartYear ?? new Date().getUTCFullYear(),
    federalTaxTableYear: 2026,
  };
  return { resultData, lifeExpectancy: inputWithDecisions.personalInfo.lifeExpectancy };
}

/**
 * Recompute all scenarios for a given profile.
 * Called as fire-and-forget after profile PATCH (D-02, D-03).
 * Errors are caught per-scenario and logged, never propagated.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-08
 */
/**
 * Per-profile recompute coalescer (SCEN-08 race fix).
 *
 * Fire-and-forget recomputes triggered by rapid PATCH /profile calls used to race:
 * recompute A would fetch step_data at T0, recompute B would fetch at T1 (newer),
 * and if A finished after B, A's stale result would overwrite B's correct one —
 * leaving benefit fields (DB pension, CPP estimate) at zero in stored result_data.
 *
 * Guarantees:
 *   - At most ONE recomputeAllScenarios runs per profile at any time.
 *   - If a recompute is requested while one is in flight, exactly one follow-up
 *     run is scheduled after it completes (coalesced — further requests during
 *     the same window all collapse into that single follow-up, which fetches
 *     fresh step_data at start). Final state always reflects the latest save.
 */
const recomputeChain = new Map<string, { running: Promise<void>; pending: boolean }>();

export function scheduleRecomputeAllScenarios(profileId: string): Promise<void> {
  const existing = recomputeChain.get(profileId);
  if (existing) {
    existing.pending = true;
    return existing.running;
  }
  const state: { running: Promise<void>; pending: boolean } = {
    running: Promise.resolve(),
    pending: false,
  };
  state.running = (async () => {
    try {
      do {
        state.pending = false;
        await recomputeAllScenarios(profileId);
        // state.pending can flip to true during the await via a concurrent
        // scheduleRecomputeAllScenarios call; TS can't see that cross-call
        // mutation, so it narrows to `false` here incorrectly.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      } while (state.pending);
    } finally {
      recomputeChain.delete(profileId);
    }
  })();
  recomputeChain.set(profileId, state);
  return state.running;
}

export async function recomputeAllScenarios(profileId: string): Promise<void> {
  const scenarios = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('profile_id', '=', profileId)
    .execute();

  // Fetch fresh profile ONCE — computeScenarioResult assembles per-scenario
  const profile = await getProfileById(profileId);

  for (const scenario of scenarios) {
    try {
      const { resultData } = computeScenarioResult(profile, scenario);
      await db
        .updateTable('profile_scenarios')
        .set({
          status: 'completed',
          result_data: resultData,
          calculated_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', (scenario as any).id as string)
        .execute();
    } catch (err) {
      logger.error('Scenario recompute failed', {
        scenarioId: String((scenario as any).id),
        error: err,
      });
      await db
        .updateTable('profile_scenarios')
        .set({ status: 'failed', updated_at: new Date() })
        .where('id', '=', (scenario as any).id as string)
        .execute();
    }
  }
}

/**
 * Run a single scenario synchronously, store result_data + status='completed'.
 * On error: sets status='failed' before re-throwing (D-03).
 *
 * @see docs/source-of-truth/10-scenarios.md - D-01, D-02, D-03
 */
export async function runSingleScenario(userId: string, scenarioId: string): Promise<unknown> {
  const profileId = await resolveProfileId(userId);
  const scenarioRow = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenarioRow) throw new NotFoundError('Scenario');

  const profile = await getProfileById(profileId);

  try {
    const { resultData } = computeScenarioResult(profile, scenarioRow);
    const updated = await db
      .updateTable('profile_scenarios')
      .set({
        status: 'completed',
        result_data: resultData,
        calculated_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', scenarioId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return updated;
  } catch (err) {
    // Mark failed before re-throwing so callers see status='failed' in DB
    await db
      .updateTable('profile_scenarios')
      .set({ status: 'failed', updated_at: new Date() })
      .where('id', '=', scenarioId)
      .execute();
    throw err;
  }
}

// ─── Compare helpers ──────────────────────────────────────────────────────────

/**
 * Preview a scenario with an in-memory decisions patch.
 * Computes through the same projection pipeline as POST /run, but deliberately
 * performs no DB writes so scenario decisions/status/result_data remain intact.
 */
export async function previewScenarioDecisions(
  userId: string,
  scenarioId: string,
  patch: Partial<ScenarioDecisions>
): Promise<{
  decisions: ScenarioDecisions;
  result_data: ReturnType<typeof transformToFrontendOutput>;
}> {
  const profileId = await resolveProfileId(userId);
  const scenarioRow = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenarioRow) throw new NotFoundError('Scenario');

  const rawDecisions = (scenarioRow as any).decisions ?? {};
  const decisionsObj =
    typeof rawDecisions === 'string' ? (JSON.parse(rawDecisions) as unknown) : rawDecisions;
  const existing = ScenarioDecisionsSchema.parse(decisionsObj);
  const decisions = ScenarioDecisionsSchema.parse({ ...existing, ...patch });
  const profile = await getProfileById(profileId);
  const { resultData } = computeScenarioResult(profile, {
    ...(scenarioRow as any),
    decisions,
  });

  return { decisions, result_data: resultData };
}

const METRICS_CONFIG = [
  { name: 'portfolioLongevity', label: 'Portfolio Longevity (Age)', higherIsBetter: true },
  { name: 'peakNetWorth', label: 'Peak Net Worth', higherIsBetter: true },
  { name: 'totalTaxesPaid', label: 'Total Taxes Paid', higherIsBetter: false },
  { name: 'averageRetirementIncome', label: 'Average Retirement Income', higherIsBetter: true },
  { name: 'probabilityOfSuccess', label: 'Probability of Success (%)', higherIsBetter: true },
  { name: 'yearsInRetirement', label: 'Years in Retirement', higherIsBetter: true },
] as const;

/**
 * Distinguishes a well-formed stored result from a null / failed / corrupted
 * result_data blob (audit C-03). 'missing' covers: never run, run failed
 * (result_data left null), or a blob that lost its expected shape.
 */
export type ScenarioResultStatus = 'ok' | 'missing';

function extractSummary(resultData: unknown): {
  summary: FrontendSummary | null;
  status: ScenarioResultStatus;
} {
  if (!resultData || typeof resultData !== 'object') return { summary: null, status: 'missing' };
  const data = resultData as Record<string, unknown>;
  if (!data['summary'] || typeof data['summary'] !== 'object') {
    return { summary: null, status: 'missing' };
  }
  return { summary: data['summary'] as FrontendSummary, status: 'ok' };
}

function extractYearlyResults(resultData: unknown): {
  yearlyResults: FrontendYearlyResult[];
  status: ScenarioResultStatus;
} {
  if (!resultData || typeof resultData !== 'object') {
    return { yearlyResults: [], status: 'missing' };
  }
  const data = resultData as Record<string, unknown>;
  if (!Array.isArray(data['yearlyResults'])) {
    return { yearlyResults: [], status: 'missing' };
  }
  return { yearlyResults: data['yearlyResults'] as FrontendYearlyResult[], status: 'ok' };
}

/**
 * Extract both halves of a stored scenario result and collapse the two
 * extraction statuses into one per-scenario resultStatus (audit C-03, C-10).
 */
function extractScenarioResult(resultData: unknown): {
  summary: FrontendSummary | null;
  yearlyResults: FrontendYearlyResult[];
  resultStatus: ScenarioResultStatus;
} {
  const { summary, status: summaryStatus } = extractSummary(resultData);
  const { yearlyResults, status: yearlyStatus } = extractYearlyResults(resultData);
  return {
    summary,
    yearlyResults,
    resultStatus: summaryStatus === 'ok' && yearlyStatus === 'ok' ? 'ok' : 'missing',
  };
}

/**
 * Compare 2–4 completed profile scenarios.
 * Base Scenario is always the delta reference column (D-16).
 * If Base Scenario is not in ids, it is fetched separately as the reference.
 *
 * @see docs/source-of-truth/10-scenarios.md - D-15, D-16
 */
export async function compareProfileScenarios(userId: string, ids: string[]): Promise<unknown> {
  if (ids.length < 2 || ids.length > 4) {
    throw new ValidationError('Provide between 2 and 4 scenario IDs to compare');
  }

  const profileId = await resolveProfileId(userId);

  // Fetch all requested scenarios (ownership via profile_id)
  const fetched = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('profile_id', '=', profileId)
    .execute();

  // Filter to only the requested IDs
  const requestedScenarios = (fetched as any[]).filter((s) => ids.includes(s.id as string));

  // Verify all requested scenarios are completed
  for (const s of requestedScenarios) {
    if (s.status !== 'completed') {
      throw new ConflictError('All scenarios must be completed before comparison');
    }
  }

  // Find base scenario — it may or may not be among the requested IDs
  let baseScenario = (fetched as any[]).find((s) => s.is_base === true);
  if (!baseScenario) {
    // Fetch separately — base not in the already-fetched set
    baseScenario = await db
      .selectFrom('profile_scenarios')
      .selectAll()
      .where('profile_id', '=', profileId)
      .where('is_base', '=', true as never)
      .executeTakeFirst();
  }
  if (!baseScenario) {
    throw new NotFoundError('Base Scenario');
  }

  // Non-base scenarios to display as comparison columns
  // Include all requested non-base scenarios; exclude base from the column list
  const nonBaseScenarios = requestedScenarios.filter((s) => s.id !== baseScenario.id);

  // Audit C-04: a request that resolves to zero non-base columns (e.g. ids
  // containing only the base scenario, duplicates of it, or IDs not belonging
  // to this profile) would previously return a structurally valid but empty
  // comparison. Reject it explicitly instead.
  if (nonBaseScenarios.length === 0) {
    throw new ConflictError('Comparison requires at least one non-base scenario');
  }

  const baseExtract = extractScenarioResult(baseScenario.result_data);
  const baseSummary = baseExtract.summary;
  const baseYearly = baseExtract.yearlyResults;

  // Per-scenario extraction, computed once and reused by metrics + yearly
  // loops. Carries resultStatus so failed/missing results are distinguishable
  // from legitimately empty ones (audit C-03).
  const scenarioExtracts = new Map<string, ReturnType<typeof extractScenarioResult>>();
  for (const s of nonBaseScenarios) {
    scenarioExtracts.set(s.id as string, extractScenarioResult(s.result_data));
  }

  // Audit C-10: surface explicit warnings instead of silently rendering empty
  // columns when the base (or any compared scenario) has no usable results.
  const warnings: string[] = [];
  if (baseExtract.resultStatus !== 'ok') {
    warnings.push(
      `Base scenario "${String(baseScenario.name)}" has no stored results; comparison deltas are unavailable.`
    );
  }
  for (const s of nonBaseScenarios) {
    if (scenarioExtracts.get(s.id as string)?.resultStatus !== 'ok') {
      warnings.push(
        `Scenario "${String(s.name)}" has no stored results; its comparison column is incomplete.`
      );
    }
  }

  // Build metric comparisons
  const metrics = METRICS_CONFIG.map((config) => {
    const baseValue = baseSummary
      ? ((baseSummary[config.name as keyof FrontendSummary] as number | null) ?? null)
      : null;

    const scenarioMetrics = nonBaseScenarios.map((s: any) => {
      const summary = scenarioExtracts.get(s.id as string)?.summary ?? null;
      const value = summary
        ? ((summary[config.name as keyof FrontendSummary] as number | null) ?? null)
        : null;
      let delta: number | null = null;
      let percentChange: number | null = null;
      if (value !== null && baseValue !== null) {
        delta = value - baseValue;
        percentChange = baseValue !== 0 ? (delta / Math.abs(baseValue)) * 100 : null;
      }
      return { id: s.id as string, value, delta, percentChange };
    });

    // Find best scenario (among non-base columns only)
    let bestId: string | null = null;
    const validScenarios = scenarioMetrics.filter((sm) => sm.value !== null);
    if (validScenarios.length > 0) {
      if (config.higherIsBetter) {
        const best = validScenarios.reduce((a, b) => ((a.value ?? 0) >= (b.value ?? 0) ? a : b));
        if (baseValue === null || (best.value ?? 0) >= baseValue) {
          bestId = best.id;
        }
      } else {
        const best = validScenarios.reduce((a, b) => ((a.value ?? 0) <= (b.value ?? 0) ? a : b));
        if (baseValue === null || (best.value ?? 0) <= baseValue) {
          bestId = best.id;
        }
      }
    }

    return {
      name: config.name,
      label: config.label,
      base: baseValue,
      scenarios: scenarioMetrics,
      bestId,
      higherIsBetter: config.higherIsBetter,
    };
  });

  // Build yearly comparison aligned by year
  const allYears = new Map<
    number,
    {
      year: number;
      age: number;
      base: { netWorth: number; income: number; taxes: number };
      scenarios: Array<{ id: string; netWorth: number; income: number; taxes: number }>;
    }
  >();

  for (const yr of baseYearly) {
    allYears.set(yr.year, {
      year: yr.year,
      age: yr.age,
      base: { netWorth: yr.totalNetWorth, income: yr.totalIncome, taxes: yr.totalTax },
      scenarios: [],
    });
  }

  for (const s of nonBaseScenarios) {
    const yearly = scenarioExtracts.get(s.id as string)?.yearlyResults ?? [];
    for (const yr of yearly) {
      const row = allYears.get(yr.year);
      if (row) {
        row.scenarios.push({
          id: s.id as string,
          netWorth: yr.totalNetWorth,
          income: yr.totalIncome,
          taxes: yr.totalTax,
        });
      }
    }
  }

  const yearlyComparison = Array.from(allYears.values()).sort((a, b) => a.year - b.year);

  return {
    baseProjection: {
      id: baseScenario.id as string,
      name: baseScenario.name as string,
      resultData: baseScenario.result_data,
      // Audit C-03/C-10: 'missing' when result_data is absent, failed, or corrupted.
      resultStatus: baseExtract.resultStatus,
    },
    scenarios: nonBaseScenarios.map((s: any) => ({
      id: s.id as string,
      name: s.name as string,
      modifications: (s.decisions ?? {}) as Record<string, unknown>,
      resultData: s.result_data,
      resultStatus: scenarioExtracts.get(s.id as string)?.resultStatus ?? 'missing',
    })),
    comparison: {
      metrics,
      yearlyComparison,
    },
    // Audit C-10: always present; empty when every compared result is usable.
    warnings,
  };
}
