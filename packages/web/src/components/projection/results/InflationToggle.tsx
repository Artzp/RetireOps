'use client';

/**
 * Inflation Toggle Component — Feature 3.4
 *
 * A two-button toggle that lets users switch between nominal (future dollars)
 * and real (today's dollars) display modes for projection results.
 *
 * - Renders both options at all times so the alternative is always visible.
 * - Active option is signalled via `aria-pressed="true"` for accessibility.
 * - Clicking a button calls `onChange` with the new mode — no API calls.
 *
 * @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-001, TC-INF-002, TC-INF-006, TC-INF-008
 * @see docs/source-of-truth/14-visualization-ux.md — results visualization patterns
 */

import type { DisplayMode } from '@retireops/shared';

interface InflationToggleProps {
  displayMode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

/**
 * Toggle control for nominal/real display mode.
 *
 * Both mode buttons are always rendered. The active mode button has
 * `aria-pressed="true"` and `data-state="active"`.
 */
export function InflationToggle({ displayMode, onChange }: InflationToggleProps) {
  return (
    <div
      role="group"
      aria-label="Display currency mode"
      className="inline-flex rounded-md border border-ds-outline-variant overflow-hidden"
    >
      <button
        type="button"
        aria-pressed={displayMode === 'nominal'}
        data-state={displayMode === 'nominal' ? 'active' : undefined}
        onClick={() => onChange('nominal')}
        className={
          displayMode === 'nominal'
            ? 'px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm bg-ds-primary text-ds-on-primary'
            : 'px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm bg-transparent text-ds-on-surface hover:bg-ds-surface-raised'
        }
      >
        Nominal CAD
      </button>
      <button
        type="button"
        aria-pressed={displayMode === 'real'}
        data-state={displayMode === 'real' ? 'active' : undefined}
        onClick={() => onChange('real')}
        className={
          displayMode === 'real'
            ? 'px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm bg-ds-primary text-ds-on-primary'
            : 'px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm bg-transparent text-ds-on-surface hover:bg-ds-surface-raised'
        }
      >
        {`Real CAD (today's dollars)`}
      </button>
    </div>
  );
}
