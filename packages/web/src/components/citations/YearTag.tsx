'use client';

/**
 * Phase 25 UI Polish — Inline "$ 2026" tag mounted next to every visible dollar
 * amount in the Government Pensions wizard step (CppEstimatorCard,
 * OasEstimatorCard, GisEstimatorCard).
 *
 * Per 25-UI-SPEC.md §New Primitive: `<YearTag>`:
 *   - Pure presentational; no event handlers, no animation, no focus state.
 *   - No className prop — cards control their own layout wrapping.
 *   - Rendered text `$ {year}` is a parameter-year SIGIL (not a currency formatter).
 *     The `$` is a literal ASCII character; the space is a literal space.
 *   - data-year-tag={year} is the canonical Playwright selector for the
 *     UAT-05 visual-contract crawler in plan 25-02.
 *   - aria-label provides a natural-language description for screen readers;
 *     the visual text is a supplementary shorthand (color is NOT the meaning carrier).
 *
 * @see .planning/phases/25-e2e-acceptance-polish/25-UI-SPEC.md
 * @see .planning/phases/25-e2e-acceptance-polish/25-CONTEXT.md D-16
 */
export function YearTag({ year }: { year: number }): JSX.Element {
  return (
    <span
      className="text-xs text-muted-foreground ml-1"
      data-year-tag={year}
      aria-label={`Parameter year ${year}`}
    >
      $ {year}
    </span>
  );
}
