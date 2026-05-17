/**
 * Tests for the Callout UI primitive (Phase 22-02 D-01 design system addition).
 *
 * The Callout is a lightweight inline <aside> for informational and warning
 * notices (the 10-year-floor message and the clawback warning in
 * OasEstimatorCard). It is composed entirely from Tailwind utilities — no
 * Radix dependency, no Lucide icon. Tests assert variant semantics (role) +
 * the exact Tailwind composition per UI-SPEC §Color "Callout colors" table.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Callout } from './callout';

describe('Callout', () => {
  it('renders info variant with role="note"', () => {
    render(<Callout variant="info">Sample info notice</Callout>);
    const aside = screen.getByRole('note');
    expect(aside.tagName).toBe('ASIDE');
    expect(aside.textContent).toContain('Sample info notice');
  });

  it('renders warning variant with role="alert"', () => {
    render(<Callout variant="warning">Sample warning notice</Callout>);
    const aside = screen.getByRole('alert');
    expect(aside.tagName).toBe('ASIDE');
    expect(aside.textContent).toContain('Sample warning notice');
  });

  it('info variant has the UI-SPEC Tailwind composition', () => {
    render(<Callout variant="info">x</Callout>);
    const aside = screen.getByRole('note');
    const cls = aside.className;
    // Per UI-SPEC §Color "Callout colors" info row:
    expect(cls).toMatch(/rounded-md/);
    expect(cls).toMatch(/border/);
    expect(cls).toMatch(/border-ds-outline-variant/);
    expect(cls).toMatch(/bg-muted/);
    expect(cls).toMatch(/p-3/);
    expect(cls).toMatch(/text-sm/);
    expect(cls).toMatch(/text-foreground/);
    expect(cls).toMatch(/space-y-1/);
  });

  it('warning variant has the UI-SPEC Tailwind composition', () => {
    render(<Callout variant="warning">x</Callout>);
    const aside = screen.getByRole('alert');
    const cls = aside.className;
    // Per UI-SPEC §Color "Callout colors" warning row:
    expect(cls).toMatch(/rounded-md/);
    expect(cls).toMatch(/border-amber-300/);
    expect(cls).toMatch(/bg-amber-50/);
    expect(cls).toMatch(/p-3/);
    expect(cls).toMatch(/text-sm/);
    expect(cls).toMatch(/text-amber-900/);
    expect(cls).toMatch(/space-y-1/);
  });

  it('renders no icon in either variant (icon-free per UI-SPEC §Design System)', () => {
    const { rerender } = render(<Callout variant="info">x</Callout>);
    expect(screen.queryByTestId('callout-icon')).toBeNull();
    rerender(<Callout variant="warning">x</Callout>);
    expect(screen.queryByTestId('callout-icon')).toBeNull();
  });

  it('appends a custom className while preserving variant defaults', () => {
    render(
      <Callout variant="info" className="my-2 mt-4">
        x
      </Callout>
    );
    const cls = screen.getByRole('note').className;
    expect(cls).toMatch(/my-2/);
    expect(cls).toMatch(/mt-4/);
    expect(cls).toMatch(/bg-muted/);
  });

  it('renders children verbatim including an inline <a>', () => {
    render(
      <Callout variant="info">
        Threshold exceeded. <a href="https://example.com/citation">See source</a>
      </Callout>
    );
    expect(screen.getByRole('link', { name: 'See source' })).toHaveAttribute(
      'href',
      'https://example.com/citation'
    );
  });
});
