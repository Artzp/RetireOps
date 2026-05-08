/**
 * Session-scoped cache for Monte Carlo simulation results.
 *
 * MC jobs are not persisted on the scenario record — they live in worker state
 * during a job and in the panel component's React state after completion. To
 * surface a compact MC summary on the Summary tab without making MonteCarloPanel
 * the sole owner of the result, completed results are mirrored into sessionStorage
 * keyed by owner. This survives tab switches and a page refresh in the same
 * browser session, and is intentionally cleared when the tab closes.
 */

import type { MonteCarloJobResult } from '@retireops/shared';

type OwnerType = 'projection' | 'scenario';

function key(ownerType: OwnerType, ownerId: string): string {
  return `mc:${ownerType}:${ownerId}`;
}

export function readMonteCarloResult(
  ownerType: OwnerType,
  ownerId: string
): MonteCarloJobResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key(ownerType, ownerId));
    if (raw === null) return null;
    return JSON.parse(raw) as MonteCarloJobResult;
  } catch {
    // Malformed entry, sessionStorage unavailable, or parse failure — treat as miss.
    return null;
  }
}

export function writeMonteCarloResult(
  ownerType: OwnerType,
  ownerId: string,
  result: MonteCarloJobResult | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (result === null) {
      window.sessionStorage.removeItem(key(ownerType, ownerId));
    } else {
      window.sessionStorage.setItem(key(ownerType, ownerId), JSON.stringify(result));
    }
  } catch {
    // sessionStorage may be unavailable (Safari private mode, quota); proceed silently
  }
}
