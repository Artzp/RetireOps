/**
 * Phase 24 static-verification tests for INTG-06 + INTG-08.
 *
 * These tests do NOT render React components. They use `fs.readFileSync` to
 * assert the source-code presence of wiring established in earlier phases
 * (INTG-06 by Phase 20-04; INTG-08 by Phases 21/22/23). Phase 24 adds these
 * tests so that any future refactor that accidentally deletes the wiring
 * fails CI at the assertion site instead of silently regressing the wizard.
 *
 * Why static-text instead of render tests: render tests would require mounting
 * the full wizard shell (FormProvider, react-hook-form context, a configured
 * profile) and the estimator cards (RadioGroup primitives, SourceCitationLink,
 * etc.) plus mocking the auto-save pipeline. The cost-to-value of a render
 * test for "the file mentions GovernmentPensionsStep" is high. Static-text
 * grep is the right tool for verification-only Phase 24 scope (CONTEXT D-09,
 * D-10, D-11, D-15).
 *
 * @see .planning/phases/24-assembler-wiring-wizard-engine-integration/24-CONTEXT.md - INTG-06, INTG-08, D-09..D-15
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Resolve paths relative to the package root so the tests are CWD-independent.
// import.meta.dirname is the Node 20+ idiom for the directory of the current module.
// The fallback covers any transpilation target that still emits CJS-style globals.
const PKG_ROOT = resolve(
  (import.meta as { dirname?: string }).dirname ?? __dirname,
  '..',
  '..',
  '..',
  '..'
);

function readSource(relPath: string): string {
  return readFileSync(resolve(PKG_ROOT, relPath), 'utf8');
}

describe('INTG-06 — ProfileWizardShell wires government_pensions slug (Phase 20-04 → Phase 24 lock)', () => {
  const shellSource = readSource('src/components/profile/ProfileWizardShell.tsx');

  it('getStepSlugForField returns "government_pensions" for government_pensions.* field names', () => {
    // Phase 20-04 wired the slug recognizer. Lock the pattern against deletion.
    expect(shellSource).toMatch(/fieldName\.startsWith\(['"]government_pensions['"]\)/);
    expect(shellSource).toMatch(/return ['"]government_pensions['"]/);
  });

  it('watch subscription routes the government_pensions slug to formValues.government_pensions', () => {
    // Lock the watch-branch selection — without this, auto-save fires the wrong
    // payload shape for the wizard step.
    expect(shellSource).toContain("slug === 'government_pensions'");
    expect(shellSource).toContain('formValues.government_pensions');
  });

  it('conditional render block mounts <GovernmentPensionsStep /> when step id is "government-pensions"', () => {
    // Lock the renderer registration — without this, the step renders blank
    // ("Coming soon" placeholder takes over).
    expect(shellSource).toContain("'government-pensions'");
    expect(shellSource).toMatch(/<GovernmentPensionsStep\s*\/>/);
  });

  it('imports GovernmentPensionsStep from the correct module path', () => {
    // Defensive: catches an accidental rename / move of GovernmentPensionsStep.tsx.
    expect(shellSource).toMatch(
      /import\s+\{\s*GovernmentPensionsStep\s*\}\s+from\s+['"]@\/components\/profile\/steps\/GovernmentPensionsStep['"];?/
    );
  });
});

describe('INTG-08 — ConfidenceChip mounted in all 3 estimator cards (Phases 21/22/23 → Phase 24 lock)', () => {
  const cards: Array<{ name: string; relPath: string }> = [
    {
      name: 'CppEstimatorCard',
      relPath: 'src/components/profile/steps/government-pensions/CppEstimatorCard.tsx',
    },
    {
      name: 'OasEstimatorCard',
      relPath: 'src/components/profile/steps/government-pensions/OasEstimatorCard.tsx',
    },
    {
      name: 'GisEstimatorCard',
      relPath: 'src/components/profile/steps/government-pensions/GisEstimatorCard.tsx',
    },
  ];

  for (const card of cards) {
    it(`${card.name} mounts <ConfidenceChip /> at least once`, () => {
      const source = readSource(card.relPath);
      // Lock the JSX usage — any future refactor that drops the confidence badge
      // (or renames the component without updating the card) will fail here.
      expect(source).toMatch(/<ConfidenceChip\b/);
    });

    it(`${card.name} imports ConfidenceChip from the project's component module`, () => {
      const source = readSource(card.relPath);
      // Defensive: catches a deleted/relocated ConfidenceChip module.
      expect(source).toMatch(
        /import\s+\{\s*[^}]*\bConfidenceChip\b[^}]*\}\s+from\s+['"][^'"]+['"];?/
      );
    });
  }
});
