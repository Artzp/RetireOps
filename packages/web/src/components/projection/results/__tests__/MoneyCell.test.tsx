/**
 * Unit tests for MoneyCell — Phase 12 / UI-05.
 *
 * @see ../MoneyCell.tsx
 * @see .planning/phases/12-yearbyyear-column-registry/12-01-PLAN.md
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MoneyCell } from '../MoneyCell';

describe('MoneyCell', () => {
  it('renders $0 when value is 0', () => {
    const { container } = render(<MoneyCell value={0} />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('$0');
  });

  it('renders $0 when value is null', () => {
    const { container } = render(<MoneyCell value={null} />);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('$0');
  });

  it('renders $0 when value is undefined', () => {
    const { container } = render(<MoneyCell value={undefined} />);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('$0');
  });

  it('renders formatCurrency(value) for a positive number', () => {
    const { container } = render(<MoneyCell value={12345} />);
    const span = container.querySelector('span');
    // formatCurrency uses en-CA / CAD with no fraction digits → "$12,345"
    expect(span?.textContent).toBe('$12,345');
  });

  it('applies tabular-nums class on the rendered span', () => {
    const { container } = render(<MoneyCell value={100} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('tabular-nums');
  });

  it('passes through optional className and merges with tabular-nums', () => {
    const { container } = render(<MoneyCell value={100} className="text-ds-error font-medium" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('tabular-nums');
    expect(span?.className).toContain('text-ds-error');
    expect(span?.className).toContain('font-medium');
  });

  it('renders optional children AFTER the formatted value', () => {
    const { container } = render(
      <MoneyCell value={500}>
        <span data-testid="badge">B</span>
      </MoneyCell>
    );
    const outer = container.querySelector('span');
    expect(outer?.textContent).toBe('$500B');
    // Confirm the badge node is the LAST child of the outer span
    const badge = container.querySelector('[data-testid="badge"]');
    expect(badge).not.toBeNull();
    expect(outer?.lastChild).toBe(badge);
  });
});
