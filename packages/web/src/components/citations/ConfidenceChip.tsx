'use client';

import { cn } from '@/lib/utils';
import type { BenefitSourceMode, BenefitEstimateConfidence } from '@retireops/shared/types';

interface ConfidenceChipProps {
  mode: BenefitSourceMode;
  confidence: BenefitEstimateConfidence;
  /**
   * When `mode='defaulted'`, the chip is hidden if `amount` is 0 or undefined
   * (per UI-SPEC §Color "Defaulted (non-zero)" row). For 'user_entered' and
   * 'estimated' modes, the chip is always rendered when the component is
   * mounted.
   */
  amount?: number;
  className?: string;
}

const MODE_LABEL: Record<BenefitSourceMode, string> = {
  user_entered: 'From your statement',
  estimated: 'Estimated',
  defaulted: 'Defaulted',
};

/**
 * Token palette for the ConfidenceChip variants. Exported for the
 * regression test in `ConfidenceChip.test.tsx`, which computes WCAG 2.1
 * relative-luminance contrast ratios from these HSL values against the
 * body-bg constant (--ds-background per globals.css) and asserts:
 *   - chip text vs chip bg ≥ 4.5:1 (WCAG AA normal text)
 *   - decorative dot vs chip bg ≥ 3.0:1 (WCAG 1.4.11 non-text)
 *
 * If any value here changes, the test MUST recompute and stay above the
 * thresholds. This guards against the gap-2 regression where /20 opacity
 * tints were assumed AA-compliant but measured 2.5:1 (user_entered) and
 * 1.72:1 (estimated). See `.planning/phases/21-cpp-qpp-estimator/21-HUMAN-UAT.md`
 * Test 5 for the original failure measurement.
 */
export const CHIP_PALETTE = {
  /** `bg-muted` = `--muted` = `--ds-surface-raised` */
  chipBgHsl: { h: 218, s: 31, l: 95 },
  /** `text-foreground` = `--foreground` = `--ds-on-background` */
  chipTextHsl: { h: 211, s: 53, l: 11 },
  /** `border-border` = `--border` = `--ds-outline-variant` */
  borderHsl: { h: 212, s: 14, l: 79 },
  /** `bg-emerald-700` — Tailwind default rgb(4, 120, 87) */
  dotUserEnteredHsl: { h: 158, s: 94, l: 24 },
  /** `bg-amber-700` — Tailwind default rgb(180, 83, 9) */
  dotEstimatedHsl: { h: 28, s: 90, l: 37 },
} as const;

/**
 * Pure presentational chip reflecting `BenefitValueSource.mode` + `.confidence`.
 *
 * Design: solid-neutral chip surface (`bg-muted text-foreground`) with a
 * colored leading dot for variant identity (`bg-emerald-700` for user_entered,
 * `bg-amber-700` for estimated, no dot for defaulted). Color is a SECONDARY
 * signal — text ("From your statement" / "Estimated" / "Defaulted") is the
 * primary one (color-blind accessibility per UI-SPEC §Color).
 *
 * Contrast ratios (computed deterministically in `ConfidenceChip.test.tsx`):
 *   - text on chip:           ≈ 15.3:1   (WCAG AAA)
 *   - text on body bg:        ≈ 16.2:1   (WCAG AAA — defensive)
 *   - emerald dot on chip:    ≈ 4.5:1    (WCAG AA non-text — 3:1 minimum)
 *   - amber dot on chip:      ≈ 4.2:1    (WCAG AA non-text — 3:1 minimum)
 *   - chip border vs body bg: ≈ 1.5:1    (perceptible edge)
 *
 * Resolves UI-SPEC open decision 3 (the prior `bg-{token}/20 text-{token}`
 * composition measured 2.50:1 and 1.72:1 in live UAT — see 21-HUMAN-UAT.md
 * gap 2). The regression test imports `CHIP_PALETTE` from this file and
 * fails if any future palette change drops below the thresholds.
 *
 * Reused by Phases 22 (OAS) and 23 (GIS) without modification.
 */
export function ConfidenceChip({
  mode,
  confidence,
  amount,
  className,
}: ConfidenceChipProps): JSX.Element | null {
  if (mode === 'defaulted' && (amount === undefined || amount === 0)) {
    return null;
  }

  const label = MODE_LABEL[mode];

  const dot =
    mode === 'user_entered' ? (
      <span
        data-testid="chip-dot-user_entered"
        aria-hidden="true"
        className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-700 mr-1.5"
      />
    ) : mode === 'estimated' ? (
      <span
        data-testid="chip-dot-estimated"
        aria-hidden="true"
        className="inline-block w-1.5 h-1.5 rounded-full bg-amber-700 mr-1.5"
      />
    ) : null;

  const textClass = mode === 'defaulted' ? 'text-muted-foreground' : 'text-foreground';

  return (
    <span
      role="status"
      aria-label={`${label} — ${confidence} confidence`}
      className={cn(
        'inline-flex items-center rounded-md border bg-muted border-border px-2 py-0.5 text-xs font-semibold',
        textClass,
        className
      )}
      data-testid={`confidence-chip-${mode}`}
    >
      {dot}
      {label}
    </span>
  );
}
