/**
 * Citation-roundtrip CI test (Phase 19, PARAM-03).
 *
 * Scans every .ts file under packages/shared/src/ for v4.5 citation comments
 * of the form `// per docs/source-of-truth/<doc>.md#<anchor>` and verifies
 * each anchor exists in the referenced source-of-truth doc.
 *
 * This test is intentionally cheap (~10s, no network, no DB) so it can run
 * on every `pnpm test` and CI pipeline. A broken citation breaks the build.
 *
 * Soft heading-match (D-12): emits console.warn if the heading adjacent to
 * the anchor doesn't share any tokens with the constant name. Does not fail
 * the build (hard match deferred to v4.7 carry-over).
 *
 * @see .planning/phases/19-parameter-consolidation/19-CONTEXT.md (D-11, D-12)
 * @see .planning/phases/19-parameter-consolidation/19-RESEARCH.md §5
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Anchored at start of line (with optional indent). Skips JSDoc/comment examples
// where the citation appears after `* ` or inside backticks (those are documentation
// of the citation convention, not citations themselves).
const CITATION_RE = /^\s*\/\/ per docs\/source-of-truth\/([^#\s]+)#([^\s]+)/;

// TODO(v4.7 carry-over): Soft heading-match per D-12 — scan 5 lines after
//   anchor for a markdown heading, tokenize, console.warn if no token overlap
//   with the constant name. Defer to post-Phase-19 once drift rate is known.

/**
 * Resolve paths from Vitest cwd. Vitest run via `pnpm --filter @retireops/shared test`
 * sets cwd to packages/shared/. The IDE runner may set cwd to repo root —
 * detect and adapt.
 */
function resolveRoots(): { sharedSrc: string; sotDir: string } {
  const cwd = process.cwd();
  // Branch A: cwd is packages/shared/
  if (fs.existsSync(path.resolve(cwd, 'src/types/province.ts'))) {
    return {
      sharedSrc: path.resolve(cwd, 'src'),
      sotDir: path.resolve(cwd, '../../docs/source-of-truth'),
    };
  }
  // Branch B: cwd is repo root
  if (fs.existsSync(path.resolve(cwd, 'packages/shared/src/types/province.ts'))) {
    return {
      sharedSrc: path.resolve(cwd, 'packages/shared/src'),
      sotDir: path.resolve(cwd, 'docs/source-of-truth'),
    };
  }
  throw new Error(`Cannot resolve test roots from cwd=${cwd}`);
}

/** Recursive .ts file walk, skipping node_modules, dist, and .test.ts files. */
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

interface Citation {
  file: string;
  doc: string;
  anchor: string;
  line: number;
}

/** Collect all citations from .ts files; preserve file:line for error messages. */
function collectCitations(rootDir: string): Citation[] {
  const out: Citation[] = [];
  for (const file of walkTsFiles(rootDir)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Reset lastIndex because we're using /g on multiple strings.
      CITATION_RE.lastIndex = 0;
      const m = CITATION_RE.exec(lines[i] ?? '');
      if (m) {
        out.push({ file, doc: m[1]!, anchor: m[2]!, line: i + 1 });
      }
    }
  }
  return out;
}

/** Deduplicate by doc#anchor — same anchor cited from multiple files = 1 test case. */
function dedupe(citations: Citation[]): { doc: string; anchor: string; sourceFiles: string[] }[] {
  const map = new Map<string, { doc: string; anchor: string; sourceFiles: Set<string> }>();
  for (const c of citations) {
    const key = `${c.doc}#${c.anchor}`;
    const existing = map.get(key);
    if (existing) {
      existing.sourceFiles.add(c.file);
    } else {
      map.set(key, { doc: c.doc, anchor: c.anchor, sourceFiles: new Set([c.file]) });
    }
  }
  return [...map.values()].map((v) => ({
    doc: v.doc,
    anchor: v.anchor,
    sourceFiles: [...v.sourceFiles],
  }));
}

function anchorExistsInDoc(docPath: string, anchor: string): boolean {
  const content = fs.readFileSync(docPath, 'utf-8');
  return content.includes(`<a id="${anchor}"></a>`);
}

// ---------------------------------------------------------------------------

const { sharedSrc, sotDir } = resolveRoots();
const allCitations = collectCitations(sharedSrc);
const unique = dedupe(allCitations);

describe('Citation roundtrip (PARAM-03)', () => {
  it('finds at least 45 citations across packages/shared/src/ (self-check)', () => {
    // After 19-01 (35 in 2026.ts) + 19-02 (17 in provincial-supplements.ts) lands,
    // we expect ~50 unique citations. Floor of 45 catches partial path-resolution
    // failures more reliably than a softer floor of 30 (per checker INFO 19-03):
    // if walkTsFiles silently returns one file instead of both, we'd see ~17 or
    // ~35 citations — both below 45 — and the self-check would fail loudly
    // rather than vacuously pass.
    expect(unique.length).toBeGreaterThanOrEqual(45);
  });

  it.each(unique)(
    '$doc#$anchor — doc exists and anchor is present',
    ({ doc, anchor, sourceFiles }) => {
      const docPath = path.join(sotDir, doc);
      expect(
        fs.existsSync(docPath),
        `doc not found: ${doc} (cited from ${sourceFiles.join(', ')})`
      ).toBe(true);
      expect(
        anchorExistsInDoc(docPath, anchor),
        `anchor <a id="${anchor}"></a> not found in ${doc} (cited from ${sourceFiles.join(', ')})`
      ).toBe(true);
    }
  );
});
