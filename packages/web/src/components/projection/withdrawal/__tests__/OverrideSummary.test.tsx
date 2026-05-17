/**
 * Tests for OverrideSummary (Phase 30 Plan 02).
 *
 * Covers:
 *  - Empty / undefined overrides → null render (no DOM)
 *  - One-year override (applyForward=false) → "{year}: Take {amount} from {account}"
 *  - Permanent override (applyForward=true, no later sibling) →
 *      "From {year}: Take {amount}/yr from {account}"
 *  - Range override (applyForward=true with a later sibling on same owner/field) →
 *      "{start}-{end}: Take {amount}/yr from {account}"
 *  - Mixed primary + spouse rows render an owner prefix
 *  - Accessibility: role="region" + aria-label landmark
 *
 * @see .planning/phases/30-explainability-adapter-override-summary/30-02-PLAN.md
 * @see packages/web/src/components/projection/withdrawal/OverrideSummary.tsx
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OverrideSummary, { summarizeOverrides } from '../OverrideSummary.js';
import type { ScenarioDecisions } from '@retireops/shared/types';

type Overrides = ScenarioDecisions['withdrawalOverrides'];

describe('OverrideSummary', () => {
  it('renders nothing for an empty / undefined overrides array', () => {
    const { container: emptyArr } = render(<OverrideSummary overrides={[]} />);
    expect(emptyArr.firstChild).toBeNull();

    const { container: undef } = render(<OverrideSummary overrides={undefined} />);
    expect(undef.firstChild).toBeNull();

    expect(screen.queryByTestId('override-summary')).toBeNull();
  });

  it('renders a one-year override using the "{year}: Take {amount} from {account}" copy', () => {
    const overrides: Overrides = [
      {
        field: 'tfsa',
        year: 2030,
        amount: 5000,
        applyForward: false,
        owner: 'primary',
      },
    ];
    render(<OverrideSummary overrides={overrides} />);
    const item = screen.getByRole('listitem');
    expect(item.getAttribute('data-override-kind')).toBe('one-year');
    expect(item.textContent).toMatch(/2030: Take .*5,?000.* from TFSA/);
  });

  it('renders a permanent override using "From {year}: Take {amount}/yr from {account}"', () => {
    const overrides: Overrides = [
      {
        field: 'rrif',
        year: 2035,
        amount: 12000,
        applyForward: true,
        owner: 'primary',
      },
    ];
    render(<OverrideSummary overrides={overrides} />);
    const item = screen.getByRole('listitem');
    expect(item.getAttribute('data-override-kind')).toBe('permanent');
    expect(item.textContent).toMatch(/From 2035: Take .*12,?000.*\/yr from RRIF/);
  });

  it('renders a range when a later same-owner / same-field override defines the implicit end', () => {
    const overrides: Overrides = [
      {
        field: 'nonreg',
        year: 2030,
        amount: 8000,
        applyForward: true,
        owner: 'primary',
      },
      {
        field: 'nonreg',
        year: 2034,
        amount: 4000,
        applyForward: true,
        owner: 'primary',
      },
    ];
    render(<OverrideSummary overrides={overrides} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    // First (2030 → 2033 inclusive end) is a range.
    expect(items[0]?.getAttribute('data-override-kind')).toBe('range');
    expect(items[0]?.textContent).toMatch(/2030-2033: Take .*8,?000.*\/yr from Non-Registered/);

    // Second (2034, no later sibling) is permanent.
    expect(items[1]?.getAttribute('data-override-kind')).toBe('permanent');
    expect(items[1]?.textContent).toMatch(/From 2034: Take .*4,?000.*\/yr from Non-Registered/);
  });

  it('prefixes each row with the owner label when primary + spouse overrides coexist', () => {
    const overrides: Overrides = [
      {
        field: 'tfsa',
        year: 2030,
        amount: 5000,
        applyForward: false,
        owner: 'primary',
      },
      {
        field: 'rrif',
        year: 2031,
        amount: 9000,
        applyForward: true,
        owner: 'spouse',
      },
    ];
    render(<OverrideSummary overrides={overrides} />);
    expect(screen.getByText('Main:')).toBeInTheDocument();
    expect(screen.getByText('Spouse:')).toBeInTheDocument();
  });

  it('omits the owner prefix when all overrides are primary-owned', () => {
    const overrides: Overrides = [
      {
        field: 'tfsa',
        year: 2030,
        amount: 5000,
        applyForward: false,
        owner: 'primary',
      },
    ];
    render(<OverrideSummary overrides={overrides} />);
    expect(screen.queryByText('Main:')).toBeNull();
    expect(screen.queryByText('Spouse:')).toBeNull();
  });

  it('exposes a named region for screen-reader landmark navigation', () => {
    const overrides: Overrides = [
      {
        field: 'tfsa',
        year: 2030,
        amount: 5000,
        applyForward: false,
        owner: 'primary',
      },
    ];
    render(<OverrideSummary overrides={overrides} />);
    const region = screen.getByRole('region', { name: 'Active withdrawal overrides' });
    expect(region).toBeInTheDocument();
    expect(region.getAttribute('aria-label')).toBe('Active withdrawal overrides');
  });

  it('summarizeOverrides() — pure formatter exposes kind metadata for analytics', () => {
    const overrides: Overrides = [
      { field: 'tfsa', year: 2030, amount: 5000, applyForward: false, owner: 'primary' },
      { field: 'rrif', year: 2031, amount: 9000, applyForward: true, owner: 'primary' },
      { field: 'rrif', year: 2034, amount: 5000, applyForward: true, owner: 'primary' },
    ];
    const items = summarizeOverrides(overrides);
    expect(items.map((i) => i.kind)).toEqual(['one-year', 'range', 'permanent']);
  });
});
