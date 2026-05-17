/**
 * profile-scenarios-preview.ts — typed wrapper around the
 * `POST /api/profile/scenarios/:id/preview-decisions` endpoint.
 *
 * Phase 31 Plan 01 (IMP-02): the ImpactPreview component debounces the user's
 * working `taxState` patch and asks the server to project the scenario without
 * persisting changes. The endpoint already exists at
 * `packages/api/src/routes/profile-scenarios.routes.ts:229` and is backed by
 * `previewScenarioDecisions()` at
 * `packages/api/src/services/profile-scenario.service.ts:740`.
 *
 * Why a separate file (vs. reusing the existing `previewProfileScenarioDecisions`
 * helper in `profile-scenarios.ts`):
 *  - Phase 31 wants a focused module so the ImpactPreview component and the
 *    PresetSelectorCard per-preset previews (Plan 31-02) can depend on the same
 *    tiny surface area without dragging in the full scenarios CRUD client.
 *  - The shape the ImpactPreview consumes (`{ decisions, result_data }`) is
 *    intentionally untyped on `result_data` so the extractor's `ResultDataLike`
 *    can evolve independently of the wire response.
 *
 * Reuses the existing `api` client so auth-token refresh, error normalization,
 * and AbortSignal plumbing remain centralized.
 *
 * @see .planning/phases/31-impact-preview/31-01-PLAN.md (Task 1)
 * @see packages/web/src/lib/api/profile-scenarios.ts (canonical scenarios client)
 * @see packages/web/src/lib/api/client.ts (auth + retry plumbing)
 */
import { api } from '@/lib/api/client';
import type { ScenarioDecisionsPatch } from '@/types/profile-scenario';

/**
 * Response shape returned by `POST /preview-decisions`.
 *
 * `decisions` is the merged, validated `ScenarioDecisions` (existing ∪ patch);
 * `result_data` is the same projection payload as a normal scenario run, but
 * is NOT persisted to the database.
 *
 * `result_data` is typed as `Record<string, unknown>` so consumers (notably
 * `extractImpactMetrics` in `lib/impact-metrics.ts`) can narrow with their own
 * structural types instead of taking a hard dependency on engine internals.
 */
export interface ScenarioPreviewResponse {
  decisions: ScenarioDecisionsPatch;
  result_data: Record<string, unknown>;
}

/**
 * Preview a scenario with an in-memory decisions patch.
 *
 * The server merges `patch` over the persisted decisions, runs the projection,
 * and returns `{ decisions, result_data }` without writing to the DB. Pass an
 * `AbortSignal` to cancel an in-flight request when the user edits again
 * before the previous preview returns (typical debounce / latest-wins flow).
 */
export async function previewScenarioDecisions(
  scenarioId: string,
  patch: ScenarioDecisionsPatch,
  options?: { signal?: AbortSignal }
): Promise<ScenarioPreviewResponse> {
  const result = await api.post<ScenarioPreviewResponse>(
    `/profile/scenarios/${scenarioId}/preview-decisions`,
    patch,
    options
  );
  return result.data;
}
