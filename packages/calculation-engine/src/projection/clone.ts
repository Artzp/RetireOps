/**
 * Deep clone helper for ProjectionInput.
 * Uses structuredClone (available in Node 20+ runtime) to preserve Date objects.
 * @see STATE.md - OPT-3: shallow spread corrupts shared state
 * @see docs/source-of-truth/08-projection-engine.md
 */
import type { ProjectionInput } from '@retireops/shared';

// structuredClone is available at runtime (Node 20+) but not in lib: ["ES2022"] typings.
// Declare it to avoid TypeScript error "Cannot find name 'structuredClone'".
declare function structuredClone<T>(value: T): T;

/**
 * Deep clone a ProjectionInput for safe mutation in optimization what-if runs.
 * Preserves Date objects (birthdate, spouse.birthdate) unlike JSON.parse/stringify.
 * @param input - The ProjectionInput to clone (will NOT be mutated)
 * @returns A deep copy safe to mutate
 */
export function cloneProjectionInput(input: ProjectionInput): ProjectionInput {
  return structuredClone(input);
}
