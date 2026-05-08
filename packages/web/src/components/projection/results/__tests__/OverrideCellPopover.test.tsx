// @see docs/source-of-truth/14-visualization-ux.md — editable cell popover
// Decision refs (grep anchors): "D-24" "D-25" "D-26"
// String literals locked by UI-SPEC Copywriting Contract: "Save Override" "Discard"
// "Apply to all future years until next manual change" "Amount must be 0 or greater."
// "Maximum allowed override is $10,000,000." "Amount clamped to"
/**
 * RED component unit test for OverrideCellPopover.
 * The component does NOT yet exist (created in Plan 07). These tests MUST FAIL until then.
 *
 * Locks the UI-SPEC contract (revised 2026-04-24):
 * - onSave receives structured { primary: OverrideValue; secondary?: OverrideValue } payload (NOT positional args).
 * - "Save Override" and "Discard" are the exact CTA labels.
 * - Apply-forward checkbox defaults unchecked (D-25).
 * - Input auto-focused on open.
 * - Clamp warning shown when clampInfo is present.
 * - Dual-input (merged RRIF) variant rendered when secondaryField is provided.
 *
 * Decision coverage: D-24 (minimal editable popover), D-25 (default unchecked),
 * D-26 (one popover at a time — Discard semantics), UI-SPEC §Component Inventory §2.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// OverrideCellPopover does NOT yet exist → import fails → all tests RED
// Path matches Plan 07 creation target: ../OverrideCellPopover.tsx
import { OverrideCellPopover } from '../OverrideCellPopover.js';

// ---------------------------------------------------------------------------
// Types (mirrored from UI-SPEC §Component Inventory §2, locked 2026-04-24)
// ---------------------------------------------------------------------------

type OverrideValue = {
  field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg' | 'spending';
  amount: number;
  applyForward: boolean;
};

interface OverrideCellPopoverProps {
  year: number;
  field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg' | 'spending';
  label: string;
  currentDisplayValue: number;
  activeOverride?: { amount: number; applyForward: boolean };
  clampInfo?: { requestedReal: number; clampedTo: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { primary: OverrideValue; secondary?: OverrideValue }) => Promise<void>;
  onCancel: () => void;
  secondaryField?: {
    field: 'rrsp' | 'rrif';
    label: string;
    activeOverride?: { amount: number; applyForward: boolean };
    clampInfo?: { requestedReal: number; clampedTo: number };
  };
  onRemoveOverride?: () => Promise<void>;
  isRemoving?: boolean;
}

// ---------------------------------------------------------------------------
// Base props factory — realistic defaults matching UI-SPEC
// ---------------------------------------------------------------------------

function makeBaseProps(
  overrides: Partial<OverrideCellPopoverProps> = {}
): OverrideCellPopoverProps {
  return {
    year: 2031,
    field: 'rrsp',
    label: 'RRSP Withdrawal 2031',
    currentDisplayValue: 30_000,
    open: false,
    onOpenChange: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverrideCellPopover (UI-SPEC §Component Inventory, D-24, D-25, D-26)', () => {
  // Test 1: CTA labels must match UI-SPEC §Copywriting Contract exactly
  it('renders with "Save Override" and "Discard" CTAs exactly (UI-SPEC Copywriting Contract)', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);
    expect(screen.getByRole('button', { name: 'Save Override' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  // Test 2: Apply-forward defaults unchecked (D-25 locked)
  it('apply-forward checkbox defaults unchecked (D-25)', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  // Test 3: Pre-checks apply-forward when activeOverride.applyForward is true
  it('pre-checks apply-forward when activeOverride.applyForward is true', () => {
    render(
      <OverrideCellPopover
        {...makeBaseProps({ open: true, activeOverride: { amount: 40_000, applyForward: true } })}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  // Test 4: Exact apply-forward label (UI-SPEC Copywriting Contract)
  it('apply-forward label reads exactly "Apply to all future years until next manual change"', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);
    expect(
      screen.getByLabelText('Apply to all future years until next manual change')
    ).toBeInTheDocument();
  });

  // Test 5: Input auto-focused on open
  it('input is auto-focused on open', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);
    const input = screen.getByRole('spinbutton');
    expect(document.activeElement).toBe(input);
  });

  // Test 6: Enter submits the form with structured { primary } payload
  it('Enter submits the form (calls onSave with structured { primary } payload)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OverrideCellPopover {...makeBaseProps({ open: true, onSave })} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50000' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          primary: expect.objectContaining({
            field: 'rrsp',
            amount: expect.any(Number),
            applyForward: expect.any(Boolean),
          }),
        })
      )
    );
  });

  // Test 7: Escape closes the popover (calls onCancel, not onSave)
  it('Escape closes the popover (calls onCancel, not onSave)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(<OverrideCellPopover {...makeBaseProps({ open: true, onSave, onCancel })} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(onSave).not.toHaveBeenCalled();
  });

  // Test 8: Validation error for amount < 0 (D-05 Copywriting Contract)
  it('rejects amount < 0 with validation message "Amount must be 0 or greater."', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Override' }));
    expect(screen.getByText('Amount must be 0 or greater.')).toBeInTheDocument();
  });

  // Test 9: Validation error for amount > $10M (D-05 Copywriting Contract)
  it('rejects amount > 10_000_000 with validation message "Maximum allowed override is $10,000,000."', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10000001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Override' }));
    expect(screen.getByText('Maximum allowed override is $10,000,000.')).toBeInTheDocument();
  });

  // Test 10: Inline clamp message when clampInfo is present (D-13 UI-SPEC §Clamp Warning Display)
  it('shows inline clamp message with exact copy when clampInfo is present', () => {
    render(
      <OverrideCellPopover
        {...makeBaseProps({
          open: true,
          clampInfo: { requestedReal: 50_000, clampedTo: 30_000 },
        })}
      />
    );
    expect(
      screen.getByText(/Amount clamped to \$30,000 — your requested \$50,000/i)
    ).toBeInTheDocument();
  });

  // Test 11: Secondary input block rendered when secondaryField is provided (merged RRIF)
  it('renders a secondary input block when secondaryField is provided (merged-RRIF dual-input)', () => {
    render(
      <OverrideCellPopover
        {...makeBaseProps({
          open: true,
          field: 'rrif',
          secondaryField: { field: 'rrsp', label: 'RRSP Withdrawal' },
        })}
      />
    );
    // Both inputs present for the dual-input variant
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(screen.getByText(/RRSP Withdrawal/i)).toBeInTheDocument();
  });

  // Test 12: Secondary block NOT rendered when secondaryField is undefined
  it('does NOT render secondary block when secondaryField is undefined', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true, secondaryField: undefined })} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
  });

  // Test 13: Discard calls onOpenChange(false) — D-26 explicit Save/Discard semantics
  it('calls onOpenChange(false) when Discard is clicked', () => {
    const onOpenChange = vi.fn();
    render(<OverrideCellPopover {...makeBaseProps({ open: true, onOpenChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // Test 14: Save Override calls onSave with structured { primary: {field,amount,applyForward} }
  it('calls onSave with structured { primary: {field,amount,applyForward} } payload when Save Override is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OverrideCellPopover {...makeBaseProps({ open: true, field: 'rrsp', onSave })} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '45000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Override' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          primary: expect.objectContaining({
            field: 'rrsp',
            amount: expect.any(Number),
            applyForward: expect.any(Boolean),
          }),
        })
      )
    );
  });

  // Test 15: Dual-input save includes both primary + secondary (merged RRIF)
  it('calls onSave with both primary + secondary when secondaryField is filled (merged-RRIF dual-input)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <OverrideCellPopover
        {...makeBaseProps({
          open: true,
          field: 'rrif',
          secondaryField: { field: 'rrsp', label: 'RRSP Withdrawal' },
          onSave,
        })}
      />
    );
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '30000' } });
    fireEvent.change(inputs[1], { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Override' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          primary: expect.objectContaining({ field: 'rrif' }),
          secondary: expect.objectContaining({ field: 'rrsp' }),
        })
      )
    );
  });

  // Test 16a: Tab order — create-flow (no activeOverride, no Remove button)
  // D-81: Conditional expected order based on activeOverride prop.
  // D-82: Explicit name matchers — no broad getAllByRole regex.
  it('tab order (create-flow, no activeOverride): Input → Checkbox → Discard → Save Override', () => {
    render(<OverrideCellPopover {...makeBaseProps({ open: true })} />);

    // Remove button MUST be absent in create-flow
    expect(screen.queryByRole('button', { name: 'Remove override' })).not.toBeInTheDocument();

    const input = screen.getByRole('spinbutton');
    const checkbox = screen.getByRole('checkbox');
    const discardBtn = screen.getByRole('button', { name: 'Discard' });
    const saveBtn = screen.getByRole('button', { name: 'Save Override' });

    // DOM-order assertion via compareDocumentPosition: a precedes b ⇒
    // (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(input.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(
      checkbox.compareDocumentPosition(discardBtn) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(discardBtn.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0
    );
  });

  // Test 16b: Tab order — edit-flow (activeOverride truthy, Remove button rendered)
  // D-81: Remove sits between Checkbox and Discard (matches DOM order in OverrideCellPopover.tsx
  //       lines 631-648 — Remove block is rendered AFTER InputBlock and BEFORE the CTA row).
  it('tab order (edit-flow, activeOverride): Input → Checkbox → Remove override → Discard → Save Override', () => {
    const onRemoveOverride = vi.fn().mockResolvedValue(undefined);
    render(
      <OverrideCellPopover
        {...makeBaseProps({
          open: true,
          activeOverride: { amount: 40_000, applyForward: false },
        })}
        onRemoveOverride={onRemoveOverride}
      />
    );

    const input = screen.getByRole('spinbutton');
    const checkbox = screen.getByRole('checkbox');
    const removeBtn = screen.getByRole('button', { name: 'Remove override' });
    const discardBtn = screen.getByRole('button', { name: 'Discard' });
    const saveBtn = screen.getByRole('button', { name: 'Save Override' });

    expect(input.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(checkbox.compareDocumentPosition(removeBtn) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0
    );
    expect(
      removeBtn.compareDocumentPosition(discardBtn) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(discardBtn.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0
    );
  });

  // Test 17: aria-label on trigger (accessibility — UI-SPEC §Accessibility Contract)
  it('aria-label on trigger reads "Edit {label} — current value {formatCurrency(value)}"', () => {
    render(
      <OverrideCellPopover
        {...makeBaseProps({
          label: 'RRSP Withdrawal 2031',
          currentDisplayValue: 30_000,
        })}
      />
    );
    // The trigger button (closed state) should have the accessible label
    expect(
      screen.getByRole('button', {
        name: /Edit RRSP Withdrawal 2031 — current value \$30,000/i,
      })
    ).toBeInTheDocument();
  });
});
