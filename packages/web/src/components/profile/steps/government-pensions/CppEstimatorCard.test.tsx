/**
 * Regression test for Phase 21 Gap 1 (21-HUMAN-UAT.md Test 3).
 *
 * Reproduction: after a helper-SOC or helper-YMPE-proxy commit, changing
 * `plannedStartAge` (or clicking ANY field outside the manual amount input)
 * fires the manual-input onBlur — `writeUserEntered` then unconditionally
 * promotes `inputPath` to 'manual' and `value_source.mode` to 'user_entered',
 * wiping the helper-soc / helper-ympe-proxy provenance.
 *
 * Tests A and B (helper provenance preservation) FAIL with the current code
 * and PASS after Task 2's guard. Tests C and D are positive/negative controls
 * that should ALWAYS pass — they prove the test harness is sound and the
 * intentional "type-in-manual-input promotes provenance" behavior is preserved.
 *
 * @see .planning/phases/21-cpp-qpp-estimator/21-03-PLAN.md
 * @see .planning/phases/21-cpp-qpp-estimator/21-HUMAN-UAT.md (Tests 1–3 + new gap)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useImperativeHandle, forwardRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

import { CppEstimatorCard } from './CppEstimatorCard';

// ---------------------------------------------------------------------------
// Harness — mounts CppEstimatorCard inside a FormProvider and exposes the RHF
// methods via an imperative handle so tests can read getValues().
// ---------------------------------------------------------------------------

interface HarnessHandle {
  form: UseFormReturn;
}

interface HarnessProps {
  defaultValues?: Record<string, unknown>;
  person?: 'primary' | 'spouse';
  plan?: 'CPP' | 'QPP';
  provinceLabel?: string;
}

const Harness = forwardRef<HarnessHandle, HarnessProps>(function Harness(props, ref) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: {
      about_you: { province: 'ON' },
      government_pensions: {
        kind: 'single',
        cpp_primary: {},
        ...((props.defaultValues?.government_pensions as object | undefined) ?? {}),
      },
      ...props.defaultValues,
    },
  });
  useImperativeHandle(ref, () => ({ form: form as unknown as UseFormReturn }), [form]);
  return (
    <FormProvider {...form}>
      <CppEstimatorCard
        person={props.person ?? 'primary'}
        plan={props.plan ?? 'CPP'}
        provinceLabel={props.provinceLabel ?? 'Ontario'}
      />
    </FormProvider>
  );
});

// ---------------------------------------------------------------------------
// Shared setup — every test runs commitHelper's 50ms setTimeout (focus restore)
// using vi.useFakeTimers({ shouldAdvanceTime: true }) so the focus restore
// happens deterministically without blocking the user-event interaction model.
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Real timers are fine for these flows because userEvent already drains
  // microtasks. The 50ms setTimeout in commitHelper is small enough that we
  // can `act(() => vi.advanceTimersByTime(...))` if we ever switch to fake
  // timers, but tests pass with real timers + an explicit await.
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Test A — helper-SOC commit preserves provenance across plannedStartAge change
// (THE BUG: 21-HUMAN-UAT.md Test 3, gap 1).
// ---------------------------------------------------------------------------

describe('CppEstimatorCard — helper provenance preservation (21-03 gap 1)', () => {
  it('A) preserves helper-soc provenance when plannedStartAge changes after commit', async () => {
    const user = userEvent.setup();
    const ref = { current: null as HarnessHandle | null };

    render(
      <Harness
        ref={ref}
        defaultValues={{
          government_pensions: {
            kind: 'single',
            cpp_primary: { plannedStartAge: 65 },
          },
        }}
      />
    );

    // Step 1: open the helper panel.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate CPP amount/i }));

    // Step 2: SOC radio is the default — type the annual amount.
    // Note: type=number inputs and userEvent.type have a known interaction
    // where typing multi-digit numbers can drop keystrokes; use fireEvent.change
    // for deterministic value entry.
    fireEvent.change(screen.getByLabelText(/Annual amount at age 65 \(from your statement\)/i), {
      target: { value: '12000' },
    });

    // Step 3: commit.
    const commitBtn = screen.getByRole('button', { name: /^Use this estimate$/i });
    // Sanity check: commit button is enabled after typing 12000.
    expect(commitBtn).toBeEnabled();
    await user.click(commitBtn);

    // Allow the post-commit setTimeout focus restore to fire.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 75));
    });

    // First assertion block: helper-soc provenance landed correctly.
    {
      const values = ref.current!.form.getValues() as {
        government_pensions: { cpp_primary: Record<string, unknown> };
      };
      const cpp = values.government_pensions.cpp_primary;
      expect(cpp.inputPath).toBe('helper-soc');
      const vs = cpp.value_source as {
        mode: string;
        confidence: string;
        note?: string;
      };
      expect(vs.mode).toBe('estimated');
      expect(vs.confidence).toBe('medium');
      expect(vs.note).toBe('Service Canada statement amount; adjustment applied for start-age 65');
      expect(cpp.manualOverrideAnnualBaseAt65).toBe(12000);
      // manualOverrideAnnual at start-age 65 == base (no adjustment).
      expect(cpp.manualOverrideAnnual).toBeCloseTo(12000, 6);
    }

    // Step 4: bug-triggering action — focus moves from the manual amount input
    // (where commitHelper's setTimeout put it) to the start-age input. The
    // browser's native focus-change fires blur on the manual input → RHF onBlur
    // chain → writeUserEntered. We simulate this by firing blur on the manual
    // input directly (jsdom doesn't auto-blur on click/focus transitions
    // reliably), then changing the start-age value.
    const manualInput = screen.getByLabelText('Annual amount at age 65');
    fireEvent.blur(manualInput);
    const startAgeInput = screen.getByLabelText(/Planned start age/i);
    fireEvent.change(startAgeInput, { target: { value: '67' } });

    // Allow any pending re-derive useEffect to flush.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    // Step 5: provenance MUST still be helper-soc / estimated / medium and the
    // note must be preserved verbatim. manualOverrideAnnual must re-derive to
    // 12000 * (1 + 24 * 0.007) = 14016 (24 months × 0.7%/mo late credit).
    {
      const values = ref.current!.form.getValues() as {
        government_pensions: { cpp_primary: Record<string, unknown> };
      };
      const cpp = values.government_pensions.cpp_primary;
      expect(cpp.inputPath).toBe('helper-soc');
      const vs = cpp.value_source as {
        mode: string;
        confidence: string;
        note?: string;
      };
      expect(vs.mode).toBe('estimated');
      expect(vs.confidence).toBe('medium');
      expect(vs.note).toBe('Service Canada statement amount; adjustment applied for start-age 65');
      expect(cpp.manualOverrideAnnualBaseAt65).toBe(12000);
      expect(cpp.manualOverrideAnnual as number).toBeCloseTo(14016, 6);
    }
  });

  // ---------------------------------------------------------------------------
  // Test B — helper-YMPE-proxy commit preserves provenance across startAge.
  // ---------------------------------------------------------------------------

  it('B) preserves helper-ympe-proxy provenance when plannedStartAge changes after commit', async () => {
    const user = userEvent.setup();
    const ref = { current: null as HarnessHandle | null };

    render(
      <Harness
        ref={ref}
        defaultValues={{
          government_pensions: {
            kind: 'single',
            cpp_primary: { plannedStartAge: 65 },
          },
        }}
      />
    );

    // Open helper.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate CPP amount/i }));

    // Select the YMPE-proxy radio path.
    await user.click(screen.getByLabelText(/Estimate from my work history/i));

    // Enter 35 years (use fireEvent.change for number inputs — see Test A).
    fireEvent.change(screen.getByLabelText(/How many years have you contributed to CPP\?/i), {
      target: { value: '35' },
    });

    // Select Average or above bucket.
    await user.click(screen.getByLabelText(/Average or above \(around 65% of YMPE\)/i));

    // Commit.
    await user.click(screen.getByRole('button', { name: /^Use this estimate$/i }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 75));
    });

    // First assertion block: ympe-proxy provenance landed.
    {
      const values = ref.current!.form.getValues() as {
        government_pensions: { cpp_primary: Record<string, unknown> };
      };
      const cpp = values.government_pensions.cpp_primary;
      expect(cpp.inputPath).toBe('helper-ympe-proxy');
      const vs = cpp.value_source as {
        mode: string;
        confidence: string;
        note?: string;
      };
      expect(vs.mode).toBe('estimated');
      expect(vs.confidence).toBe('medium');
      expect(vs.note).toBe('Estimated from 35 years contributed × Average or above');
    }

    // Bug trigger: fire blur on the manual input (simulating focus moving
    // to the start-age field), then change plannedStartAge to 67.
    const manualInput = screen.getByLabelText('Annual amount at age 65');
    fireEvent.blur(manualInput);
    const startAgeInput = screen.getByLabelText(/Planned start age/i);
    fireEvent.change(startAgeInput, { target: { value: '67' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    // Provenance must still be helper-ympe-proxy.
    {
      const values = ref.current!.form.getValues() as {
        government_pensions: { cpp_primary: Record<string, unknown> };
      };
      const cpp = values.government_pensions.cpp_primary;
      expect(cpp.inputPath).toBe('helper-ympe-proxy');
      const vs = cpp.value_source as {
        mode: string;
        confidence: string;
        note?: string;
      };
      expect(vs.mode).toBe('estimated');
      expect(vs.confidence).toBe('medium');
      expect(vs.note).toBe('Estimated from 35 years contributed × Average or above');
    }
  });

  // ---------------------------------------------------------------------------
  // Test C — positive control: a real keystroke in the manual input DOES
  // promote provenance to 'manual' / 'user_entered' / 'high'. Proves the
  // guard does not over-fire (issue: a too-strict guard could break the
  // intentional "user types to override helper" path).
  // ---------------------------------------------------------------------------

  it('C) real keystroke in manual amount input promotes provenance', async () => {
    const user = userEvent.setup();
    const ref = { current: null as HarnessHandle | null };

    render(
      <Harness
        ref={ref}
        defaultValues={{
          government_pensions: {
            kind: 'single',
            cpp_primary: {
              plannedStartAge: 65,
              manualOverrideAnnualBaseAt65: 12000,
              manualOverrideAnnual: 12000,
              inputPath: 'helper-soc',
              value_source: {
                mode: 'estimated',
                confidence: 'medium',
                citation:
                  'docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension',
                note: 'Service Canada statement amount; adjustment applied for start-age 65',
              },
            },
          },
        }}
      />
    );

    // The manual amount input is labelled "Annual amount at age 65" (the
    // visible label on the card body, distinct from the helper-input label).
    const manualInput = screen.getByLabelText('Annual amount at age 65');

    // Clear and type a new amount — the onChange handler is what should mark
    // the manual-input as "touched".
    await user.clear(manualInput);
    await user.type(manualInput, '16000');

    // Blur by tabbing away.
    await user.tab();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const values = ref.current!.form.getValues() as {
      government_pensions: { cpp_primary: Record<string, unknown> };
    };
    const cpp = values.government_pensions.cpp_primary;
    expect(cpp.inputPath).toBe('manual');
    const vs = cpp.value_source as { mode: string; confidence: string };
    expect(vs.mode).toBe('user_entered');
    expect(vs.confidence).toBe('high');
    expect(cpp.manualOverrideAnnualBaseAt65).toBe(16000);
  });

  // ---------------------------------------------------------------------------
  // Test D — degenerate control: blur with no keystroke and no prior value
  // does nothing (no provenance writes, no value_source written from nothing).
  // ---------------------------------------------------------------------------

  it('D) blur with no keystroke and no prior value does not write provenance', async () => {
    const user = userEvent.setup();
    const ref = { current: null as HarnessHandle | null };

    render(
      <Harness
        ref={ref}
        defaultValues={{
          government_pensions: {
            kind: 'single',
            cpp_primary: { plannedStartAge: 65 },
          },
        }}
      />
    );

    // Click the manual input then blur (no keystroke).
    const manualInput = screen.getByLabelText('Annual amount at age 65');
    await user.click(manualInput);
    fireEvent.blur(manualInput);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const values = ref.current!.form.getValues() as {
      government_pensions: { cpp_primary: Record<string, unknown> };
    };
    const cpp = values.government_pensions.cpp_primary;
    expect(cpp.value_source).toBeUndefined();
    expect(cpp.inputPath).toBeUndefined();
  });
});
