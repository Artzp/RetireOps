import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Source-of-truth document identifiers permitted in v4.7. Restricting
 * the `doc` prop to a union (not a string) makes typos a TypeScript
 * error and gives Phase 21–25 estimators autocomplete on the doc set.
 *
 * Add new entries here as new dated source-of-truth files land. The
 * citation-roundtrip CI gate (PARAM-03, shipped in Phase 19) still
 * validates that the resolved `#${anchor}` exists in the linked file
 * — it parses both `// per docs/source-of-truth/<doc>#<anchor>`
 * comments in `packages/shared/src/` (Phase 19) and (in a future
 * phase) `<SourceCitationLink doc=... anchor=... />` JSX in
 * `packages/web/src/`. Phase 20 does not yet cover the JSX side of
 * the gate; that's a v4.8 follow-up.
 */
export type SourceCitationDoc =
  | '05-government-benefits.md'
  | '18-pensions-2026.md'
  | '19-benefits-tax-credits-2026.md';

interface SourceCitationLinkProps {
  doc: SourceCitationDoc;
  anchor: string;
  label?: string;
  className?: string;
}

/**
 * Chip linking a dollar amount (or any displayed value) to its
 * source-of-truth anchor on GitHub. Opens in a new tab.
 *
 * Per WIZ-04 (v4.7): in-app docs viewer is deferred — Phase 20 ships
 * GitHub blob URLs. Per D-14: this is a pure presentational
 * component; no data fetching, no analytics, no state.
 */
export function SourceCitationLink({
  doc,
  anchor,
  label,
  className,
}: SourceCitationLinkProps): JSX.Element {
  const href = `https://github.com/Artzp/RetireOps/blob/main/docs/source-of-truth/${doc}#${anchor}`;
  const displayLabel = label ?? 'Source';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline text-muted-foreground hover:text-ds-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary rounded',
        className
      )}
      aria-label={`Open source-of-truth citation: ${doc}#${anchor}`}
      title={`${doc}#${anchor}`}
      data-testid="source-citation-link"
    >
      <BookOpen className="h-3 w-3" aria-hidden="true" />
      <span>{displayLabel}</span>
    </a>
  );
}
