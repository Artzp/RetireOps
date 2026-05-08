'use client';

/**
 * Projection Display Mode Hook — Feature 3.4
 *
 * Manages the nominal/real display mode state for projection results.
 * Mode switching is purely presentational — no API calls are triggered.
 *
 * @see docs/source-of-truth/14-visualization-ux.md — results visualization patterns
 */

import { useState } from 'react';
import type { DisplayMode } from '@retireops/shared';

export type { DisplayMode } from '@retireops/shared';

/**
 * Hook that manages the active display mode for projection results.
 * Defaults to `'nominal'` to preserve existing behaviour on first load.
 *
 * @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-001
 */
export function useProjectionDisplayMode() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('nominal');
  return { displayMode, setDisplayMode };
}
