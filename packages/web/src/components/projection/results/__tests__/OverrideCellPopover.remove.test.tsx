/**
 * RED component tests for OverrideCellPopover Remove button.
 *
 * These tests MUST FAIL until Plan 03-03 adds `onRemoveOverride?` and `isRemoving?`
 * props to OverrideCellPopover and implements the Remove button UI.
 *
 * Decision refs: D-65, D-67, D-68, D-69, D-73
 * UI-SPEC locked copy: "Remove override" (button label AND aria-label)
 * UI-SPEC locked classes: text-destructive, flex + justify-between for metadata row
 *
 * @see .planning/phases/03-cascade-undo/03-CONTEXT.md
 * @see .planning/phases/03-cascade-undo/03-UI-SPEC.md
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverrideCellPopover } from '../OverrideCellPopover.js';

// ---------------------------------------------------------------------------
// Local type mirrors — onRemoveOverride + isRemoving do NOT yet exist on props
// Use `as any` casts so TypeScript doesn't reject the file.
// Casts will be removed by Plan 03-03 when the props are typed.
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
// Base props factory — mirrors OverrideCellPopover.test.tsx render helper
// ---------------------------------------------------------------------------

function makeBaseProps(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    open: true,
    onOpenChange: vi.fn(),
    year: 2031,
    field: 'rrsp',
    label: 'RRSP Withdrawal 2031',
    currentDisplayValue: 50000,
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  };
}

function makeOverrideMeta() {
  return {
    createdAt: '2026-04-24T15:00:00.000Z',
    updatedAt: '2026-04-24T15:00:00.000Z',
    originalEngineValue: 42000,
  };
}

function makeProvenance(withOverrideMeta = true): LocalProvenance {
  return {
    source: 'override',
    ruleId: 'override-user',
    ruleName: 'User override',
    inputs: {
      requestedReal: 50000,
      anchorYear: 2031,
      applyForward: 'false',
    },
    docRef: 'docs/source-of-truth/07-withdrawal-strategies.md#user-overrides',
    ...(withOverrideMeta ? { overrideMeta: makeOverrideMeta() } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverrideCellPopover Remove button', () => {
  it('Remove button is absent when activeOverride is undefined', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: undefined,
          mode: 'editable',
          onRemoveOverride: vi.fn(),
        }) as any)}
      />
    );
    expect(screen.queryByRole('button', { name: 'Remove override' })).not.toBeInTheDocument();
  });

  it('Remove button is absent when mode is "readonly"', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'readonly',
          onRemoveOverride: vi.fn(),
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    expect(screen.queryByRole('button', { name: 'Remove override' })).not.toBeInTheDocument();
  });

  it('Remove button is absent when mode is "placeholder"', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          mode: 'placeholder',
          onRemoveOverride: vi.fn(),
        }) as any)}
      />
    );
    expect(screen.queryByRole('button', { name: 'Remove override' })).not.toBeInTheDocument();
  });

  it('Remove button is absent when onRemoveOverride is undefined', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: undefined,
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    expect(screen.queryByRole('button', { name: 'Remove override' })).not.toBeInTheDocument();
  });

  it('Remove button renders when all 3 conditions met (D-73): activeOverride truthy + mode="editable" + onRemoveOverride provided', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    // Exact match — UI-SPEC locked label "Remove override"
    const button = screen.getByRole('button', { name: 'Remove override' });
    expect(button).toBeInTheDocument();
  });

  it('Remove button is on same flex row as override metadata (D-65)', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    // The button's parent container should have flex + justify-between
    const parent = button.parentElement;
    expect(parent).not.toBeNull();
    expect(parent!.className).toMatch(/flex/);
    expect(parent!.className).toMatch(/justify-between/);
  });

  it('Remove button has correct aria-label "Remove override"', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    // Visible label doubles as aria-label per UI-SPEC
    expect(button).toHaveAttribute('aria-label', 'Remove override');
  });

  it('Remove button is disabled when isRemoving=true', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          isRemoving: true,
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    expect(button).toBeDisabled();
  });

  it('Remove button is enabled when isRemoving=false (default)', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          isRemoving: false,
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    expect(button).not.toBeDisabled();
  });

  it('Click invokes onRemoveOverride exactly once', async () => {
    const onRemoveOverride = vi.fn().mockResolvedValue(undefined);
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride,
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    fireEvent.click(button);
    await waitFor(() => expect(onRemoveOverride).toHaveBeenCalledOnce());
  });

  it('Click does NOT close popover (D-68) — onOpenChange(false) not called', async () => {
    const onOpenChange = vi.fn();
    const onRemoveOverride = vi.fn().mockResolvedValue(undefined);
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride,
          onOpenChange,
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    fireEvent.click(button);
    await waitFor(() => expect(onRemoveOverride).toHaveBeenCalledOnce());
    // onOpenChange(false) must NOT have been called by the Remove button click
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('Focus moves to primary input when activeOverride transitions truthy→falsy while open (D-68)', async () => {
    const onRemoveOverride = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride,
          provenance: makeProvenance(true),
        }) as any)}
      />
    );

    // Click Remove
    const button = screen.getByRole('button', { name: 'Remove override' });
    fireEvent.click(button);

    // Simulate parent re-render with activeOverride gone (removal succeeded)
    rerender(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: undefined,
          mode: 'editable',
          onRemoveOverride,
          provenance: { ...makeProvenance(false), source: 'engine' },
        }) as any)}
      />
    );

    // Focus should move to the primary amount input (spinbutton or text input)
    await waitFor(() => {
      const activeEl = document.activeElement;
      expect(activeEl).not.toBeNull();
      expect(activeEl!.tagName === 'INPUT' || activeEl!.getAttribute('role') === 'spinbutton').toBe(
        true
      );
    });
  });

  it('tab order is Input → Apply-forward checkbox → Remove → Discard → Save Override (UI-SPEC)', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          provenance: makeProvenance(true),
        }) as any)}
      />
    );

    const input = screen.getByRole('spinbutton');
    const checkbox = screen.getByRole('checkbox');
    const removeBtn = screen.getByRole('button', { name: 'Remove override' });
    const discardBtn = screen.getByRole('button', { name: 'Discard' });
    const saveBtn = screen.getByRole('button', { name: 'Save Override' });

    expect(input).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();
    expect(removeBtn).toBeInTheDocument();
    expect(discardBtn).toBeInTheDocument();
    expect(saveBtn).toBeInTheDocument();

    // Assert DOM order (tab flow follows DOM order when tabIndex is not set)
    const allFocusable = Array.from(document.querySelectorAll('input, button, [role="checkbox"]'));
    const inputIdx = allFocusable.indexOf(input);
    const checkboxIdx = allFocusable.indexOf(checkbox);
    const removeIdx = allFocusable.indexOf(removeBtn);
    const discardIdx = allFocusable.indexOf(discardBtn);
    const saveIdx = allFocusable.indexOf(saveBtn);

    expect(inputIdx).toBeLessThan(checkboxIdx);
    expect(checkboxIdx).toBeLessThan(removeIdx);
    expect(removeIdx).toBeLessThan(discardIdx);
    expect(discardIdx).toBeLessThan(saveIdx);
  });

  it('button uses text-destructive class (UI-SPEC)', () => {
    render(
      <OverrideCellPopover
        {...(makeBaseProps({
          activeOverride: { amount: 50000, applyForward: false },
          mode: 'editable',
          onRemoveOverride: vi.fn().mockResolvedValue(undefined),
          provenance: makeProvenance(true),
        }) as any)}
      />
    );
    const button = screen.getByRole('button', { name: 'Remove override' });
    expect(button.className).toMatch(/text-destructive/);
  });
});
