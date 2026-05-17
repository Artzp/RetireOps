/**
 * Tests for ConstraintWarningBanner (Phase 29 Plan 02).
 *
 * Covers:
 *  - Null render for empty warnings array (CON-06 banner contract)
 *  - Count rendering matches warnings length
 *  - Title + message text faithfully rendered
 *  - Source line rendered when present, omitted when absent
 *  - Accessibility region attributes (role + aria-label) for SR landmark nav
 *  - Byte-equivalence pin: `ConstraintAccountType` accepts every discriminator
 *    from the shared source (rrsp / rrif / tfsa / nonReg / lif) — drift fails
 *    at type-check time. (Inline-type pattern per Phase 27/28 resilience.)
 *
 * @see .planning/phases/29-constraint-validators/29-02-PLAN.md
 * @see packages/shared/src/withdrawal/constraints.ts (type source of truth)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConstraintWarningBanner } from '../ConstraintWarningBanner.js';
import type { ConstraintAccountType, ConstraintWarning } from '@/lib/constraint-warnings';

const sample: ConstraintWarning[] = [
  {
    id: 'oas-clawback-risk',
    severity: 'info',
    title: 'Near OAS clawback threshold',
    message:
      'Projected gross income is near the 2026 OAS recovery-tax threshold (95323). Additional taxable withdrawals may trigger OAS clawback.',
    source: 'docs/source-of-truth/18-pensions-2026.md',
  },
  {
    id: 'tfsa-recontribution-timing',
    severity: 'info',
    accountType: 'tfsa',
    title: 'TFSA room restored next year',
    message:
      'TFSA withdrawals do not free up contribution room until the following calendar year. Room from your 2030 withdrawal will be restored on Jan 1, 2031.',
    source: 'docs/source-of-truth/06-tfsa-2026.md',
  },
];

describe('ConstraintWarningBanner', () => {
  it('renders nothing for an empty warnings array (CON-06 empty contract)', () => {
    const { container } = render(<ConstraintWarningBanner warnings={[]} />);
    // Component returns null → no banner DOM at all.
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('constraint-warning-banner')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Constraint warnings' })).toBeNull();
  });

  it('renders count matching warnings length in the heading', () => {
    render(<ConstraintWarningBanner warnings={sample} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toContain('(2)');
  });

  it('renders an <li> per warning', () => {
    render(<ConstraintWarningBanner warnings={sample} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders each warning title and message text verbatim', () => {
    render(<ConstraintWarningBanner warnings={sample} />);
    expect(screen.getByText('Near OAS clawback threshold')).toBeInTheDocument();
    expect(screen.getByText(/95323/)).toBeInTheDocument();
    expect(screen.getByText('TFSA room restored next year')).toBeInTheDocument();
    // Pitfall 2 verification — message embeds withdrawalYear + 1 = 2031.
    expect(screen.getByText(/Jan 1, 2031/)).toBeInTheDocument();
  });

  it('renders the source line when present and omits it when absent', () => {
    const withAndWithout: ConstraintWarning[] = [
      {
        id: 'with-source',
        severity: 'info',
        title: 'Has source',
        message: 'sourced',
        source: 'docs/source-of-truth/03-rrif-2026.md',
      },
      {
        id: 'no-source',
        severity: 'info',
        title: 'No source',
        message: 'unsourced',
      },
    ];
    render(<ConstraintWarningBanner warnings={withAndWithout} />);
    expect(screen.getByText('docs/source-of-truth/03-rrif-2026.md')).toBeInTheDocument();
    // The "No source" warning must NOT render an empty source line.
    const items = screen.getAllByRole('listitem');
    const noSourceItem = items.find((el) => el.getAttribute('data-warning-id') === 'no-source');
    expect(noSourceItem).toBeDefined();
    expect(noSourceItem?.textContent ?? '').not.toMatch(/docs\/source-of-truth/);
  });

  it('exposes a named region for screen-reader landmark navigation', () => {
    render(<ConstraintWarningBanner warnings={sample} />);
    const region = screen.getByRole('region', { name: 'Constraint warnings' });
    expect(region).toBeInTheDocument();
    // Both aria attributes assert-listed for the acceptance-criteria grep.
    expect(region.getAttribute('aria-label')).toBe('Constraint warnings');
  });

  it('tags each item with data-warning-account-type so per-card filters can match', () => {
    render(<ConstraintWarningBanner warnings={sample} />);
    const items = screen.getAllByRole('listitem');
    const tfsa = items.find(
      (el) => el.getAttribute('data-warning-id') === 'tfsa-recontribution-timing'
    );
    expect(tfsa?.getAttribute('data-warning-account-type')).toBe('tfsa');
    const oas = items.find((el) => el.getAttribute('data-warning-id') === 'oas-clawback-risk');
    // OAS has no accountType — slot becomes empty string.
    expect(oas?.getAttribute('data-warning-account-type')).toBe('');
  });

  it('accepts every ConstraintAccountType discriminator (byte-equivalence pin)', () => {
    // Compile-time pin: if the shared source ever drops or renames a token,
    // this array fails type-checking (the union literally enumerates all five).
    const allTypes: ConstraintAccountType[] = ['rrsp', 'rrif', 'tfsa', 'nonReg', 'lif'];
    const warnings: ConstraintWarning[] = allTypes.map((t) => ({
      id: `pin-${t}`,
      severity: 'info' as const,
      accountType: t,
      title: `Pin ${t}`,
      message: `Pin message for ${t}`,
    }));
    render(<ConstraintWarningBanner warnings={warnings} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    for (const t of allTypes) {
      expect(screen.getByText(`Pin ${t}`)).toBeInTheDocument();
    }
  });
});
