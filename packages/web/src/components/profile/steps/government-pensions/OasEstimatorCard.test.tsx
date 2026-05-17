/**
 * Regression test for OAS helper-provenance preservation across plannedStartAge change.
 *
 * Mirror of Phase 21 21-03 CppEstimatorCard.test.tsx — see that file for the
 * Harness + FormProvider + fake-timers pattern. The OAS variant has a SINGLE
 * helper path (residence years only — no SOC vs YMPE-proxy radio split), so
 * the helper user-event sequence is shorter (just open + type + commit). All
 * other test scaffolding is identical.
 *
 * Tests A, B exercise the gap-class bug (helper commit + setTimeout focus
 * restore + blur on next click would silently flip provenance to 'manual'
 * without the manualInputTouchedRef guard added in Plan 22-02). Test C is the
 * positive control (real keystroke DOES promote). Test D is the floor-case
 * gate (years < 10 ⇒ commit button disabled ⇒ no provenance write).
 *
 * Computation reference:
 *   maxMonthlyAge65To74 = 743.05   (docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74)
 *   maxAnnualAt65       = 743.05 × 12 = 8916.60
 *   partialFactor_35    = 35/40 = 0.875  →  baseAt65_35 = 8916.60 × 0.875 = 7802.025
 *   annualGross_35_at67 = 7802.025 × (1 + 24 × 0.006) = 7802.025 × 1.144 ≈ 8925.516
 *   annualGross_40_at65 = 8916.60
 *   annualGross_40_at67 = 8916.60 × 1.144 ≈ 10200.590
 *
 * @see .planning/phases/22-oas-estimate-helper/22-03-PLAN.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { useEffect } from 'react';

import { OasEstimatorCard } from './OasEstimatorCard';

// ── Harness ──────────────────────────────────────────────────────────────────
// Mounts the card inside a FormProvider with realistic default values and
// exposes the RHF form via a ref-prop callback so tests can introspect state.
interface HarnessProps {
  defaultValues?: Record<string, unknown>;
  onFormReady: (form: UseFormReturn<Record<string, unknown>>) => void;
}

function Harness({ defaultValues = {}, onFormReady }: HarnessProps): JSX.Element {
  const form = useForm({
    defaultValues: {
      about_you: { dateOfBirth: '1960-04-15', province: 'ON' },
      income: [],
      government_pensions: { kind: 'single', oas_primary: {} },
      ...defaultValues,
    },
  });

  useEffect(() => {
    onFormReady(form as unknown as UseFormReturn<Record<string, unknown>>);
  }, [form, onFormReady]);

  return (
    <FormProvider {...form}>
      <OasEstimatorCard person="primary" provinceLabel="Ontario" />
    </FormProvider>
  );
}

// ── Shared test helpers ───────────────────────────────────────────────────────
function readFormState(formRef: {
  current: UseFormReturn<Record<string, unknown>> | null;
}): Record<string, unknown> {
  if (!formRef.current) throw new Error('formRef not ready');
  return formRef.current.getValues() as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OasEstimatorCard — helper-provenance preservation (Plan 22-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Test A: helper commit (35 years) + startAge change preserves provenance ──

  it('Test A — helper commit at 35 years + startAge=65; provenance preserved on startAge change to 67', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        defaultValues={{
          government_pensions: {
            kind: 'single',
            oas_primary: { plannedStartAge: 65 },
          },
        }}
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Open the helper panel.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate OAS amount/i }));

    // Type residence years into the helper input.
    const yearsInput = screen.getByLabelText(
      /How many years have you lived in Canada after your 18th birthday\?/i
    );
    await user.type(yearsInput, '35');

    // Click the commit button.
    await user.click(screen.getByRole('button', { name: /^Use this estimate$/ }));

    // Flush the 50ms focus-restore setTimeout inside commitHelper.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Post-commit assertions (BEFORE startAge change).
    const after = readFormState(formRef) as {
      government_pensions: { oas_primary: Record<string, unknown> };
    };
    const oas1 = after.government_pensions.oas_primary;

    expect(oas1.inputPath).toBe('helper');
    expect(oas1.residenceYearsAfter18).toBe(35);
    expect((oas1.value_source as Record<string, unknown>).mode).toBe('estimated');
    expect((oas1.value_source as Record<string, unknown>).confidence).toBe('low');
    expect((oas1.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74'
    );
    // D-08 verbatim partial-pension note. partialFactor = 35/40 = 0.875 → Math.round(87.5) = 88%
    expect((oas1.value_source as Record<string, unknown>).note).toBe(
      'Estimated from 35/40 qualifying years (partial-pension factor 88%); start-age 65'
    );
    // 743.05 × 12 × (35/40) = 8916.60 × 0.875 = 7802.025 (no deferral at age 65)
    expect(oas1.manualOverrideAnnual as number).toBeCloseTo(7802.025, 1);

    // ── THE BUG-TRIGGERING ACTION ─────────────────────────────────────────
    // Change start age — focus moves from the manual input (where commitHelper
    // placed it via setTimeout) to the start-age input, firing onBlur on the
    // manual input. Without the manualInputTouchedRef guard this would silently
    // promote value_source.mode to 'user_entered'.
    fireEvent.change(screen.getByLabelText('Planned start age'), {
      target: { value: '67' },
    });

    // Flush any pending reactive useEffect (re-derive manualOverrideAnnual).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Post-startAge-change assertions — provenance MUST be preserved (gap fix).
    const final = readFormState(formRef) as {
      government_pensions: { oas_primary: Record<string, unknown> };
    };
    const oas2 = final.government_pensions.oas_primary;

    expect(oas2.inputPath).toBe('helper'); // STILL helper
    expect((oas2.value_source as Record<string, unknown>).mode).toBe('estimated'); // STILL estimated
    expect((oas2.value_source as Record<string, unknown>).confidence).toBe('low'); // STILL low
    expect((oas2.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74'
    );
    // D-08 verbatim note must be preserved byte-for-byte (lock against drift).
    expect((oas2.value_source as Record<string, unknown>).note).toBe(
      'Estimated from 35/40 qualifying years (partial-pension factor 88%); start-age 65'
    );
    // Re-derived for startAge=67: 7802.025 × (1 + 24 × 0.006) = 7802.025 × 1.144 ≈ 8925.52
    expect(oas2.manualOverrideAnnual as number).toBeCloseTo(7802.025 * 1.144, 1);
    expect(oas2.residenceYearsAfter18).toBe(35);
  });

  // ── Test B: full-pension (40 years) preserves MEDIUM confidence across startAge ──

  it('Test B — full pension (years=40) preserves MEDIUM confidence + full-pension note across startAge change', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        defaultValues={{
          government_pensions: {
            kind: 'single',
            oas_primary: { plannedStartAge: 65 },
          },
        }}
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /Open helper to estimate OAS amount/i }));
    await user.type(
      screen.getByLabelText(/How many years have you lived in Canada after your 18th birthday\?/i),
      '40'
    );
    await user.click(screen.getByRole('button', { name: /^Use this estimate$/ }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Post-commit assertions.
    const after = readFormState(formRef) as {
      government_pensions: { oas_primary: Record<string, unknown> };
    };
    const oas1 = after.government_pensions.oas_primary;

    expect((oas1.value_source as Record<string, unknown>).confidence).toBe('medium');
    // D-08 verbatim full-pension note.
    expect((oas1.value_source as Record<string, unknown>).note).toBe(
      'Estimated full OAS from 40+ years of residence; start-age 65'
    );

    // ── THE BUG-TRIGGERING ACTION ──
    fireEvent.change(screen.getByLabelText('Planned start age'), { target: { value: '67' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Post-startAge-change assertions — all provenance fields must survive.
    const final = readFormState(formRef) as {
      government_pensions: { oas_primary: Record<string, unknown> };
    };
    const oas2 = final.government_pensions.oas_primary;

    expect(oas2.inputPath).toBe('helper');
    expect((oas2.value_source as Record<string, unknown>).mode).toBe('estimated');
    expect((oas2.value_source as Record<string, unknown>).confidence).toBe('medium'); // STILL medium
    // D-08 full-pension note preserved byte-for-byte.
    expect((oas2.value_source as Record<string, unknown>).note).toBe(
      'Estimated full OAS from 40+ years of residence; start-age 65'
    );
    // Re-derived for startAge=67: 743.05 × 12 × 1.144 = 8916.60 × 1.144 ≈ 10200.59
    expect(oas2.manualOverrideAnnual as number).toBeCloseTo(8916.6 * 1.144, 1);
  });

  // ── Test C: real keystroke in manual amount input DOES promote provenance ────

  it('Test C — real keystroke in manual amount input DOES promote provenance', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        defaultValues={{
          government_pensions: {
            kind: 'single',
            oas_primary: {
              plannedStartAge: 65,
              residenceYearsAfter18: 35,
              manualOverrideAnnual: 7802.025,
              inputPath: 'helper',
              value_source: {
                mode: 'estimated',
                confidence: 'low',
                citation: 'docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74',
                note: 'Estimated from 35/40 qualifying years (partial-pension factor 88%); start-age 65',
              },
            },
          },
        }}
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Clear and type a new amount in the manual input → marks manualInputTouchedRef.
    const manualInput = screen.getByLabelText('Annual OAS amount');
    await user.clear(manualInput);
    await user.type(manualInput, '9500');

    // Blur via tab — triggers writeUserEntered (which MUST fire because touched).
    await user.tab();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Provenance must flip to user_entered (positive control — guard must NOT over-fire).
    const final = readFormState(formRef) as {
      government_pensions: { oas_primary: Record<string, unknown> };
    };
    const oas = final.government_pensions.oas_primary;

    expect(oas.inputPath).toBe('manual');
    expect((oas.value_source as Record<string, unknown>).mode).toBe('user_entered');
    expect((oas.value_source as Record<string, unknown>).confidence).toBe('high');
    expect((oas.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74'
    );
  });

  // ── Test D: floor case (years < 10) — commit button disabled; no provenance write ──

  it('Test D — floor case (years < 10): commit button disabled; no provenance write', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        defaultValues={{
          government_pensions: {
            kind: 'single',
            oas_primary: { plannedStartAge: 65 },
          },
        }}
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Open the helper.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate OAS amount/i }));

    // Type fewer than 10 years — triggers the floor message Callout.
    await user.type(
      screen.getByLabelText(/How many years have you lived in Canada after your 18th birthday\?/i),
      '5'
    );

    // The floor case renders a Callout with role="alert" containing OAS_FLOOR_MESSAGE.
    const callout = await screen.findByRole('alert');
    expect(callout.textContent).toContain(
      'You need at least 10 years of residence after 18 to qualify for OAS while living in Canada.'
    );

    // The commit button must be disabled when years < 10.
    const commitBtn = screen.getByRole('button', { name: /^Use this estimate$/ });
    expect(commitBtn).toBeDisabled();

    // Attempt click — userEvent throws on disabled buttons; swallow and proceed.
    await user.click(commitBtn).catch(() => undefined);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // No provenance write must have occurred.
    const final = readFormState(formRef) as {
      government_pensions: { oas_primary: Record<string, unknown> };
    };
    expect(final.government_pensions.oas_primary.value_source).toBeUndefined();
    expect(final.government_pensions.oas_primary.inputPath).toBeUndefined();
  });
});
