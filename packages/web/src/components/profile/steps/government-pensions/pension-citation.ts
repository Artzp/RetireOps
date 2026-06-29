// Canonical source-of-truth doc + citation-path builder shared by the
// government-pension estimator cards (CPP/QPP, OAS, GIS). Every card cites the
// same doc; only the anchor differs. Consolidated from three identical per-card
// copies so a doc-version bump is a one-line change.

export const PENSION_CITATION_DOC = '18-pensions-2026.md';

/** Build a `docs/source-of-truth/<doc>#<anchor>` citation path. */
export function pensionCitation(anchor: string): string {
  return `docs/source-of-truth/${PENSION_CITATION_DOC}#${anchor}`;
}
