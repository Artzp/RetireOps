/**
 * Phase 2 — Doc-anchor resolution test (RED in Wave 0).
 *
 * Asserts that every `docRef` emitted by the engine in a representative projection resolves
 * to a real heading slug in `docs/source-of-truth/*.md`. CI failure is the contract (D-53).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-50, D-51, D-52, D-53, D-54
 * @see ROADMAP.md Phase 2 success criterion #4
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import {
  buildProvenanceFixtureSingle,
  buildProvenanceFixtureCouple,
  buildProvenanceFixtureWithOverride,
} from './__fixtures__/provenance.fixtures.js';

/**
 * GitHub heading-slug algorithm:
 *  1. Lowercase
 *  2. Strip non-word, non-space, non-hyphen characters (keeps emoji-free ASCII)
 *  3. Collapse spaces to single hyphen
 *  4. Collapse runs of hyphens
 *  5. Trim leading/trailing hyphens
 *
 * Note on collisions: GitHub disambiguates repeated identical slugs by appending -1, -2, ...
 * Our docs use unique heading text per file (e.g., "Step 4: Calculate Federal Tax" vs
 * "Step 5: Calculate Provincial Tax"), so no collision handling is needed for the v4.2 emit set.
 */
function headingToSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Reads every `docs/source-of-truth/*.md` and returns a Set of `docs/source-of-truth/{file}#{slug}` strings. */
function extractDocAnchors(): Set<string> {
  const docsDir = join(__dirname, '../../../../docs/source-of-truth');
  const files = readdirSync(docsDir).filter((f) => f.endsWith('.md'));
  const anchors = new Set<string>();
  for (const file of files) {
    const content = readFileSync(join(docsDir, file), 'utf-8');
    for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
      const heading = match[1].trim();
      anchors.add(`docs/source-of-truth/${file}#${headingToSlug(heading)}`);
    }
  }
  return anchors;
}

/** Walks every YearlyResult / PersonYearlyResult provenance entry and yields the docRef strings. */
function collectEmittedDocRefs(input: ReturnType<typeof buildProvenanceFixtureSingle>): string[] {
  const out = runProjection(input);
  const refs: string[] = [];
  for (const row of out.yearlyResults) {
    if (!row.provenance) continue;
    for (const meta of Object.values(row.provenance)) {
      if (meta) refs.push(meta.docRef);
    }
  }
  // Couple path — primary + spouse arrays.
  const primary = out.personYearlyResults?.primary ?? [];
  const spouse = out.personYearlyResults?.spouse ?? [];
  for (const row of [...primary, ...spouse]) {
    if (!row.provenance) continue;
    for (const meta of Object.values(row.provenance)) {
      if (meta) refs.push(meta.docRef);
    }
  }
  return refs;
}

describe('provenance docRef resolution (D-51, D-53, ROADMAP criterion #4)', () => {
  it('extracts >= 50 anchors from docs/source-of-truth/*.md', () => {
    const anchors = extractDocAnchors();
    expect(anchors.size).toBeGreaterThanOrEqual(50);
  });

  it('every emitted docRef in a single-person projection resolves to a real heading anchor', () => {
    const anchors = extractDocAnchors();
    const refs = collectEmittedDocRefs(buildProvenanceFixtureSingle());
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(anchors.has(ref), `docRef "${ref}" not found in docs/source-of-truth/*.md`).toBe(true);
    }
  });

  it('every emitted docRef in a couple projection resolves to a real heading anchor', () => {
    const anchors = extractDocAnchors();
    const refs = collectEmittedDocRefs(buildProvenanceFixtureCouple());
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(anchors.has(ref), `docRef "${ref}" not found in docs/source-of-truth/*.md`).toBe(true);
    }
  });

  it('every emitted docRef in an override-bearing projection includes #user-overrides and resolves (D-40, D-54)', () => {
    const anchors = extractDocAnchors();
    const refs = collectEmittedDocRefs(buildProvenanceFixtureWithOverride());
    // The override fixture should emit at least one docRef pointing to the user-overrides anchor.
    const userOverrideRef = 'docs/source-of-truth/07-withdrawal-strategies.md#user-overrides';
    expect(refs.includes(userOverrideRef)).toBe(true);
    expect(anchors.has(userOverrideRef), 'D-54 #user-overrides anchor missing from docs').toBe(
      true
    );
    for (const ref of refs) {
      expect(anchors.has(ref), `docRef "${ref}" not found`).toBe(true);
    }
  });
});

describe('headingToSlug algorithm — known fixtures (Pattern 4, A1)', () => {
  it('"Federal Tax Brackets (2024)" → "federal-tax-brackets-2024"', () => {
    expect(headingToSlug('Federal Tax Brackets (2024)')).toBe('federal-tax-brackets-2024');
  });
  it('"Step 4: Calculate Federal Tax" → "step-4-calculate-federal-tax"', () => {
    expect(headingToSlug('Step 4: Calculate Federal Tax')).toBe('step-4-calculate-federal-tax');
  });
  it('"User Overrides" → "user-overrides" (D-54)', () => {
    expect(headingToSlug('User Overrides')).toBe('user-overrides');
  });
  it('"Tax Calculation Algorithm" → "tax-calculation-algorithm"', () => {
    expect(headingToSlug('Tax Calculation Algorithm')).toBe('tax-calculation-algorithm');
  });
});
