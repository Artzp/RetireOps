/**
 * Phase 2 — OverrideCellPopover provenance + mode props (RED in Wave 0).
 *
 * Locks the UI-SPEC contract for the new `provenance?` and `mode?` props:
 * - Three rendering modes: editable / readonly / placeholder (D-42, UI-SPEC §Mode Rendering Matrix)
 * - Provenance section content: rule name, inputs <dl>, doc-link button (UI-SPEC §Provenance Section Layout)
 * - Override metadata line: "Overridden YYYY-MM-DD — was $X" (D-44, PROV-02)
 * - Doc-link security: target="_blank" + NEXT_PUBLIC_DOCS_BASE_URL prefix (D-52, T-OPENREDIR-01)
 * - XSS guard: no <script> element created by ruleName injection (T-XSS-01)
 *
 * ALL tests in this file currently FAIL RED because Plan 07 has not yet added
 * the `provenance` / `mode` props to OverrideCellPopover. Plans 03 (types) +
 * Plan 07 (component extension) must turn every assertion GREEN.
 *
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md - Component Inventory + Mode Rendering Matrix
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-42, D-43, D-44, D-45
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-52, PROV-02, T-OPENREDIR-01, T-XSS-01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverrideCellPopover } from '../OverrideCellPopover.js';

// ---------------------------------------------------------------------------
// Local type mirrors — these types don't exist in shared yet (Plan 03 ships them).
// Use `as any` casts on new props so TypeScript doesn't reject the test file.
// Casts will be removed by Plan 07 once the props are typed.
// ---------------------------------------------------------------------------

type LocalProvenance = {
  source: 'engine' | 'override';
  ruleId: string;
  ruleName: string;
  inputs: Record<string, number | string>;
  docRef: string;
  overrideMeta?: {
    createdAt: string;
    updatedAt: string;
    originalEngineValue: number;
  };
};

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function provenanceFactory(overrides?: Partial<LocalProvenance>): LocalProvenance {
  return {
    source: 'engine',
    ruleId: 'tax-federal-bracket-2024',
    ruleName: 'Federal tax — 2024 bracket schedule',
    inputs: {
      totalTaxableIncome: 78400,
      federalBracket: '$57,375 – $114,750',
      marginalRate: 0.205,
    },
    docRef: 'docs/source-of-truth/04-tax-engine.md#tax-calculation-algorithm',
    ...overrides,
  };
}

function baseProps(
  overrides?: Partial<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    year: number;
    field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg' | 'spending';
    label: string;
    currentDisplayValue: number;
    activeOverride?: { amount: number; applyForward: boolean };
    onSave: (payload: unknown) => Promise<void>;
    onCancel: () => void;
    // New Phase 2 props (not yet in component — cast as any at call site)
    mode?: 'editable' | 'readonly' | 'placeholder';
    provenance?: LocalProvenance;
  }>
) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    year: 2031,
    field: 'rrsp' as const,
    label: 'RRSP Withdrawal 2031',
    currentDisplayValue: 30000,
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset env before each test so NEXT_PUBLIC_DOCS_BASE_URL is predictable
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Ensure default URL composition in tests
  process.env['NEXT_PUBLIC_DOCS_BASE_URL'] = 'https://github.com/Artzp/RetireOps/blob/main/';
});

// ---------------------------------------------------------------------------
// Suite 1: mode prop (D-42, UI-SPEC §Mode Rendering Matrix)
// ---------------------------------------------------------------------------

describe('OverrideCellPopover — mode prop (D-42, UI-SPEC §Mode Rendering Matrix)', () => {
  it('default mode = editable; existing edit form renders unchanged', () => {
    // No mode prop — should behave exactly like Phase 1 (backward compat)
    render(<OverrideCellPopover {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Save Override' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('mode="editable" renders edit form AND provenance section when provenance is provided', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'editable' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // Edit form still present
    expect(screen.getByRole('button', { name: 'Save Override' })).toBeInTheDocument();
    // Provenance section also present
    expect(screen.getByText('Inputs')).toBeInTheDocument();
    expect(screen.getByText(/Federal tax — 2024 bracket schedule/)).toBeInTheDocument();
  });

  it('mode="readonly" renders provenance section ONLY (no edit form, no Save Override)', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // No edit form
    expect(screen.queryByRole('button', { name: 'Save Override' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
    // Provenance section present
    expect(screen.getByText('Inputs')).toBeInTheDocument();
  });

  it('mode="placeholder" renders the locked placeholder copy and nothing else', () => {
    render(<OverrideCellPopover {...(baseProps({ mode: 'placeholder' as any }) as any)} />);
    // Locked copy string (D-39, UI-SPEC §Copywriting Contract)
    expect(
      screen.getByText('Engine-calculated — full provenance lands in v4.3.')
    ).toBeInTheDocument();
    // No provenance section
    expect(screen.queryByText('Inputs')).not.toBeInTheDocument();
    // No edit form
    expect(screen.queryByRole('button', { name: 'Save Override' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: provenance section content (UI-SPEC §Provenance Section Layout)
// ---------------------------------------------------------------------------

describe('OverrideCellPopover — provenance section content (UI-SPEC §Provenance Section Layout)', () => {
  it('renders rule name with "Source: " prefix at 12px label size', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // "Source: " label exists
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
    // Rule name rendered
    expect(screen.getByText('Federal tax — 2024 bracket schedule')).toBeInTheDocument();
  });

  it('renders inputs as a <dl> with <dt>/<dd> pairs (semantic accessibility)', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // Radix PopoverContent renders into a portal (document.body), not the container
    const dl = document.body.querySelector('dl');
    expect(dl).toBeInTheDocument();
    // provenanceFactory has 3 inputs — expect at least 3 dt/dd pairs
    expect(dl!.querySelectorAll('dt').length).toBeGreaterThanOrEqual(3);
    expect(dl!.querySelectorAll('dd').length).toBeGreaterThanOrEqual(3);
  });

  it('renders camelCase keys as Title Case labels (e.g. "totalTaxableIncome" → "Total taxable income")', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // camelCase → Title Case conversion per UI-SPEC §Provenance Section Layout
    expect(screen.getByText(/Total taxable income/i)).toBeInTheDocument();
  });

  it('formats numeric values: dollar amounts via formatCurrency', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // totalTaxableIncome: 78400 → "$78,400"
    expect(screen.getByText(/\$78,400/)).toBeInTheDocument();
  });

  it('formats numeric values: rates as percentages when key contains "rate" and value <= 1', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // marginalRate: 0.205 → "20.5%"
    expect(screen.getByText(/20\.5%/)).toBeInTheDocument();
  });

  it('passes string values through verbatim (e.g. bracket label)', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // federalBracket string value rendered as-is
    expect(screen.getByText(/\$57,375 – \$114,750/)).toBeInTheDocument();
  });

  it('truncates inputs at 8 rows with "+ N more" trailer', () => {
    const bigInputs: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      bigInputs[`field${i}`] = i;
    }
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory({ inputs: bigInputs }) as any,
        }) as any)}
      />
    );
    // Radix PopoverContent renders into a portal (document.body), not the container
    // At most 8 <dt> rows rendered
    expect(document.body.querySelectorAll('dt').length).toBeLessThanOrEqual(8);
    // Remaining 4 shown as "+ 4 more" (UI-SPEC §Copywriting Contract: "+ {n} more")
    expect(screen.getByText('+ 4 more')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: override metadata line (D-44, PROV-02)
// ---------------------------------------------------------------------------

describe('OverrideCellPopover — override metadata line (D-44, PROV-02)', () => {
  it('renders "Overridden YYYY-MM-DD — was $X" line when overrideMeta is present', () => {
    const provenance = provenanceFactory({
      source: 'override',
      ruleId: 'override-user',
      ruleName: 'User override',
      docRef: 'docs/source-of-truth/07-withdrawal-strategies.md#user-overrides',
      inputs: {
        requestedReal: 50000,
        anchorYear: 2031,
        applyForward: false as unknown as number,
      },
      overrideMeta: {
        createdAt: '2026-04-24T15:00:00.000Z',
        updatedAt: '2026-04-24T15:00:00.000Z',
        originalEngineValue: 42000,
      },
    });
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'editable' as any,
          provenance: provenance as any,
        }) as any)}
      />
    );
    // Locked copy: "Overridden 2026-04-24 — was $42,000" (UI-SPEC §Copywriting Contract, D-44)
    expect(screen.getByText(/Overridden 2026-04-24 — was \$42,000/)).toBeInTheDocument();
  });

  it('does NOT render the override line when overrideMeta is absent', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    expect(screen.queryByText(/Overridden /)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: doc-link button (UI-SPEC §Doc-link button, D-52)
// ---------------------------------------------------------------------------

describe('OverrideCellPopover — doc-link button (UI-SPEC §Doc-link button, D-52)', () => {
  it('renders an <a> tag with target="_blank" and rel="noopener noreferrer"', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // Radix PopoverContent renders into a portal (document.body), not the container
    const link = document.body.querySelector('a[target="_blank"]');
    expect(link).toBeInTheDocument();
    expect(link!.getAttribute('rel')).toMatch(/noopener/);
    expect(link!.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('href starts with NEXT_PUBLIC_DOCS_BASE_URL (default https://github.com/Artzp/RetireOps/blob/main/) — T-OPENREDIR-01 mitigation', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // Radix PopoverContent renders into a portal (document.body), not the container
    const link = document.body.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(link.href.startsWith('https://github.com/Artzp/RetireOps/blob/main/')).toBe(true);
    // docRef appended correctly
    expect(link.href).toMatch(/04-tax-engine\.md#tax-calculation-algorithm$/);
  });

  it('label reads exactly "View rule in source-of-truth docs"', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // UI-SPEC §Copywriting Contract: "View rule in source-of-truth docs"
    expect(
      screen.getByRole('link', { name: /View rule in source-of-truth docs/i })
    ).toBeInTheDocument();
  });

  it('aria-label announces new-tab behavior to screen readers', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // Radix PopoverContent renders into a portal (document.body), not the container
    const link = document.body.querySelector('a[target="_blank"]');
    // UI-SPEC §Copywriting Contract: "View rule in source-of-truth docs — opens in new tab"
    expect(link!.getAttribute('aria-label')).toBe(
      'View rule in source-of-truth docs — opens in new tab'
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5: XSS guards (T-XSS-01)
// ---------------------------------------------------------------------------

describe('OverrideCellPopover — XSS guards (T-XSS-01)', () => {
  it('escapes <script> in ruleName via standard React JSX rendering', () => {
    const { container } = render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory({
            ruleName: '<script>alert(1)</script>Bad rule',
          }) as any,
        }) as any)}
      />
    );
    // React renders text content safely — no actual <script> element in DOM
    expect(container.querySelector('script')).toBeNull();
    // The raw string is present as text content (escaped, not executed)
    expect(screen.getByText(/<script>alert\(1\)<\/script>Bad rule/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 6: "Inputs" section label locked (UI-SPEC §Copywriting Contract)
// ---------------------------------------------------------------------------

describe('OverrideCellPopover — "Inputs" section label (UI-SPEC §Copywriting Contract)', () => {
  it('renders the "Inputs" section heading with exact casing', () => {
    render(
      <OverrideCellPopover
        {...(baseProps({
          mode: 'readonly' as any,
          provenance: provenanceFactory() as any,
        }) as any)}
      />
    );
    // Exact match — UI-SPEC §Copywriting Contract locks this to "Inputs"
    expect(screen.getByText('Inputs')).toBeInTheDocument();
  });
});
