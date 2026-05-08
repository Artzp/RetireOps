/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * SolverForm component tests — v1.12 Reverse Calculator
 *
 * @see docs/TESTABLE-SURFACES.md TC-E2E-REVERSE-001
 * @see .planning/phases/54-web-ui/54-UI-SPEC.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolverForm } from './SolverForm.js';
import type { SolverPrefillData } from '@/lib/api/solver.js';
import type { SolverInput } from '@retireops/shared';

const mockPrefillData: SolverPrefillData = {
  province: 'ON',
  currentAge: 45,
  rrspBalance: 200000,
  tfsaBalance: 50000,
  nonRegBalance: 30000,
  employmentIncome: 80000,
  cppStartAge: 65,
  oasStartAge: 65,
};

describe('SolverForm', () => {
  /**
   * Test 1: SolverForm renders 4 mode selector cards with correct labels.
   * @see TC-E2E-REVERSE-001
   */
  it('renders 4 mode selector cards with correct labels', () => {
    render(<SolverForm prefillData={null} onSubmit={vi.fn()} isSubmitting={false} error={null} />);

    // getAllByText because the selected mode label also appears in the CardTitle
    expect(screen.getAllByText('Required Annual Savings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sustainable Spending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Earliest Retirement Age').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Required Total Savings').length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Test 2: Selecting a mode shows mode-specific fields.
   * Mode 1 (default) shows targetRetirementAge and retirementSpending.
   * @see TC-E2E-REVERSE-001
   */
  it('shows mode-specific fields when a mode is selected', async () => {
    render(<SolverForm prefillData={null} onSubmit={vi.fn()} isSubmitting={false} error={null} />);

    // Mode 1 is selected by default — check for its specific fields
    expect(screen.getByLabelText(/Target Retirement Age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Retirement Spending/i)).toBeInTheDocument();

    // Switch to Mode 2 (Sustainable Spending)
    const sustainableSpendingButton = screen.getByText('Sustainable Spending');
    await userEvent.click(sustainableSpendingButton);

    // Mode 2 specific field
    expect(screen.getByLabelText(/Retirement Age/i)).toBeInTheDocument();
    // Mode 1 specific fields should be gone
    expect(screen.queryByLabelText(/Target Retirement Age/i)).not.toBeInTheDocument();
  });

  /**
   * Test 3: When prefillData is provided, the 8 profile fields are populated.
   * @see TC-E2E-REVERSE-001, REV-10
   */
  it('populates 8 profile fields from prefillData and shows pre-fill banner', () => {
    render(
      <SolverForm
        prefillData={mockPrefillData}
        onSubmit={vi.fn()}
        isSubmitting={false}
        error={null}
      />
    );

    // Pre-fill banner should be visible
    expect(screen.getByText(/Pre-filled from profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Values loaded from your active profile/i)).toBeInTheDocument();

    // Numeric fields should have their values
    const currentAgeInput = screen.getByLabelText(/Current Age/i) as HTMLInputElement;
    expect(currentAgeInput.value).toBe('45');

    const rrspInput = screen.getByLabelText(/RRSP.*Balance/i, {
      selector: 'input',
    }) as HTMLInputElement;
    expect(rrspInput.value).toBe('200000');

    const tfsaInput = screen.getByLabelText(/TFSA.*Balance/i, {
      selector: 'input',
    }) as HTMLInputElement;
    expect(tfsaInput.value).toBe('50000');
  });

  it('populates profile fields when prefillData arrives after initial render', () => {
    const { rerender } = render(
      <SolverForm prefillData={null} onSubmit={vi.fn()} isSubmitting={false} error={null} />
    );

    const currentAgeInput = screen.getByLabelText(/Current Age/i) as HTMLInputElement;
    expect(currentAgeInput.value).toBe('');

    rerender(
      <SolverForm
        prefillData={mockPrefillData}
        onSubmit={vi.fn()}
        isSubmitting={false}
        error={null}
      />
    );

    expect(screen.getByText(/Pre-filled from profile/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/Current Age/i) as HTMLInputElement).value).toBe('45');
    expect(
      (
        screen.getByLabelText(/RRSP.*Balance/i, {
          selector: 'input',
        }) as HTMLInputElement
      ).value
    ).toBe('200000');
    expect(
      (
        screen.getByLabelText(/TFSA.*Balance/i, {
          selector: 'input',
        }) as HTMLInputElement
      ).value
    ).toBe('50000');
  });

  /**
   * Test 4: Clicking Calculate calls onSubmit with properly shaped SolverInput including derived dateOfBirth.
   * Note: Province is a shadcn Select (not a native select) so we test the form structure
   * and dateOfBirth derivation separately using fireEvent to bypass the Radix UI Select.
   * @see TC-E2E-REVERSE-001
   */
  it('calls onSubmit with properly shaped SolverInput including numeric form values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <SolverForm
        prefillData={mockPrefillData}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
      />
    );

    // Fill in the required mode-specific fields for Mode 1
    const targetAgeInput = screen.getByLabelText(/Target Retirement Age/i);
    fireEvent.change(targetAgeInput, { target: { value: '65', valueAsNumber: 65 } });

    const spendingInput = screen.getByLabelText(/Retirement Spending/i);
    fireEvent.change(spendingInput, { target: { value: '50000', valueAsNumber: 50000 } });

    // Submit the form directly (bypasses Radix Select validation issues in jsdom)
    const form = targetAgeInput.closest('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    const currentYear = new Date().getFullYear();
    const expectedBirthYear = currentYear - 45; // mockPrefillData.currentAge = 45
    const expectedDOB = `${expectedBirthYear}-07-01`;

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'required-savings',
          province: 'ON',
          dateOfBirth: expectedDOB,
          currentAge: 45,
          targetRetirementAge: 65,
          retirementSpending: 50000,
          rrspBalance: 200000,
          tfsaBalance: 50000,
          nonRegBalance: 30000,
          employmentIncome: 80000,
        })
      );
    });
  });
});
