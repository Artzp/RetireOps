/**
 * Regression test for GIS helper-provenance preservation.
 *
 * Mirror of Phase 22 22-03 OasEstimatorCard.test.tsx — see that file for the
 * Harness + FormProvider + fake-timers pattern. The GIS variant adds:
 *   - Test B: couple-tab helper commit with spouse-OAS RadioGroup interaction
 *     + cross-tab seeded spouse income (combined-income aggregation).
 *   - Test D: above-threshold commit writes $0 with confidence='low' and the
 *     "Use this estimate" button STAYS ENABLED (D-13 — differs from Phase 22
 *     OAS floor case which DISABLED the button).
 *   - Test E: single-tab vs couple-tab RadioGroup visibility (GIS-04).
 *   - Test F: couple-tier (couple-on-oas) above-threshold commit surfaces the
 *     $29,760 threshold string (GIS-03 per-tier threshold visibility).
 *
 * Tests A, B exercise the gap-class bug from Phase 21 (helper commit + focus-
 * restore + next click would silently flip provenance to 'manual' without the
 * manualInputTouchedRef guard from Plan 23-02). Test C is the positive control
 * (real keystroke DOES promote). Test D enforces the GIS-specific contract
 * that $0 commits are valid. Test E verifies the couple-only RadioGroup gate.
 *
 * Computation reference (single tier, income=10_000):
 *   maxMonthly_single = 1109.85  (18-pensions-2026.md#2026-gis-q2-single-max)
 *   maxAnnual_single  = 1109.85 × 12 = 13,318.20
 *   reductionRate     = 0.50  (#2026-gis-reduction-rate-single)
 *   reduction_10k     = 10,000 × 0.50 = 5,000
 *   annualGross_10k   = 13,318.20 − 5,000 = 8,318.20
 *
 * Computation reference (couple-on-oas tier, own=10_000 + spouse=5_000):
 *   maxMonthly_coupleOnOas = 668.08  (#2026-gis-q2-spouse-on-oas-max)
 *   maxAnnual_coupleOnOas  = 668.08 × 12 = 8,016.96
 *   reductionRate          = 0.25  (#2026-gis-reduction-rate-couple-both-oas)
 *   combinedIncome         = 10,000 + 5,000 = 15,000
 *   reduction_15k          = 15,000 × 0.25 = 3,750
 *   annualGross_15k        = 8,016.96 − 3,750 = 4,266.96
 *
 * @see .planning/phases/23-gis-estimate-helper/23-03-PLAN.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

import { GisEstimatorCard } from './GisEstimatorCard';

// ── Harness ───────────────────────────────────────────────────────────────────
// Mounts the card inside a FormProvider with realistic default values and
// exposes the RHF form via a ref-prop callback so tests can introspect state.

interface HarnessProps {
  defaultValues?: Record<string, unknown>;
  kind?: 'single' | 'couple';
  onFormReady: (form: UseFormReturn<Record<string, unknown>>) => void;
}

function Harness({ defaultValues = {}, kind = 'single', onFormReady }: HarnessProps): JSX.Element {
  const baseGov =
    kind === 'couple' ? { kind, gis_primary: {}, gis_spouse: {} } : { kind, gis_primary: {} };

  const form = useForm({
    defaultValues: {
      about_you: { kind, dateOfBirth: '1960-04-15', province: 'ON' },
      government_pensions: baseGov,
      ...defaultValues,
    },
  });

  useEffect(() => {
    onFormReady(form as unknown as UseFormReturn<Record<string, unknown>>);
  }, [form, onFormReady]);

  return (
    <FormProvider {...form}>
      <GisEstimatorCard person="primary" provinceLabel="Ontario" />
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

describe('GisEstimatorCard — helper-provenance preservation (Plan 23-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Test A: single-tab helper commit + post-commit blur preserves provenance ──

  it('Test A — single-tab helper commit preserves provenance after post-commit blur', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        kind="single"
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Open helper.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    // Type income.
    await user.type(screen.getByLabelText('Your estimated annual income excluding OAS'), '10000');

    // Commit.
    await user.click(screen.getByRole('button', { name: /^Use this estimate$/ }));

    // Flush the 50ms focus-restore setTimeout inside commitHelper.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Post-commit assertions (BEFORE bug-triggering action).
    const after = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis1 = after.government_pensions.gis_primary;

    expect(gis1.inputPath).toBe('helper');
    expect((gis1.value_source as Record<string, unknown>).mode).toBe('estimated');
    expect((gis1.value_source as Record<string, unknown>).confidence).toBe('medium');
    expect((gis1.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max'
    );
    expect((gis1.value_source as Record<string, unknown>).note).toBe(
      'Estimated single; projected non-OAS income $10,000; reduction $5,000/yr per 50% rate'
    );
    // 1109.85 × 12 − 10000 × 0.50 = 13318.20 − 5000 = 8318.20
    expect(gis1.manualOverrideAnnual as number).toBeCloseTo(8318.2, 2);
    expect(gis1.incomeExcludingOAS).toBe(10000);

    // ── THE BUG-TRIGGERING ACTION ──────────────────────────────────────────────
    // Re-open and re-close the helper. This moves focus around the manual amount
    // input (commitHelper placed focus there via setTimeout). Without the
    // manualInputTouchedRef guard, the blur on the manual input would silently
    // promote value_source.mode to 'user_entered'.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Post-blur assertions — provenance MUST be preserved (gap fix from Plan 23-02).
    const final = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis2 = final.government_pensions.gis_primary;

    expect(gis2.inputPath).toBe('helper'); // STILL helper
    expect((gis2.value_source as Record<string, unknown>).mode).toBe('estimated'); // STILL estimated
    expect((gis2.value_source as Record<string, unknown>).confidence).toBe('medium'); // STILL medium
    // D-09 verbatim note preserved byte-for-byte.
    expect((gis2.value_source as Record<string, unknown>).note).toBe(
      'Estimated single; projected non-OAS income $10,000; reduction $5,000/yr per 50% rate'
    );
  });

  // ── Test B: couple-tab helper commit (couple-on-oas) preserves provenance ────

  it('Test B — couple-tab helper commit (couple-on-oas) preserves provenance + cross-tab spouse income', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        kind="couple"
        defaultValues={{
          government_pensions: {
            kind: 'couple',
            gis_primary: {},
            gis_spouse: { incomeExcludingOAS: 5000 }, // seed cross-tab subscription
          },
        }}
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Open helper.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    // Select spouse-OAS radio option: couple-on-oas.
    await user.click(screen.getByLabelText('Spouse is receiving OAS'));

    // Type own income.
    await user.type(screen.getByLabelText('Your estimated annual income excluding OAS'), '10000');

    // Commit.
    await user.click(screen.getByRole('button', { name: /^Use this estimate$/ }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Post-commit assertions.
    const after = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis1 = after.government_pensions.gis_primary;

    expect(gis1.inputPath).toBe('helper');
    expect(gis1.spouseOasStatus).toBe('on-oas');
    expect((gis1.value_source as Record<string, unknown>).mode).toBe('estimated');
    // combinedIncome = 10000 + 5000 = 15000; cutoff = 29760; ratio = 0.504 < 0.8 → MEDIUM
    expect((gis1.value_source as Record<string, unknown>).confidence).toBe('medium');
    expect((gis1.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-max'
    );
    // D-09 verbatim couple-on-oas note.
    expect((gis1.value_source as Record<string, unknown>).note).toBe(
      'Estimated couple (spouse on OAS); projected non-OAS income $15,000; reduction $3,750/yr per 25% rate'
    );
    // 668.08 × 12 − 15000 × 0.25 = 8016.96 − 3750 = 4266.96
    expect(gis1.manualOverrideAnnual as number).toBeCloseTo(4266.96, 2);
    expect(gis1.incomeExcludingOAS).toBe(10000);

    // ── THE BUG-TRIGGERING ACTION ──────────────────────────────────────────────
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Post-blur assertions — provenance MUST be preserved.
    const final = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis2 = final.government_pensions.gis_primary;

    expect(gis2.inputPath).toBe('helper');
    expect((gis2.value_source as Record<string, unknown>).mode).toBe('estimated');
    expect((gis2.value_source as Record<string, unknown>).confidence).toBe('medium');
    expect(gis2.spouseOasStatus).toBe('on-oas');
    // D-09 couple-on-oas note preserved byte-for-byte.
    expect((gis2.value_source as Record<string, unknown>).note).toBe(
      'Estimated couple (spouse on OAS); projected non-OAS income $15,000; reduction $3,750/yr per 25% rate'
    );
  });

  // ── Test C: real keystroke in manual amount input DOES promote provenance ────

  it('Test C — real keystroke in manual amount input DOES promote provenance', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        kind="single"
        defaultValues={{
          government_pensions: {
            kind: 'single',
            gis_primary: {
              manualOverrideAnnual: 8318.2,
              incomeExcludingOAS: 10000,
              inputPath: 'helper',
              value_source: {
                mode: 'estimated',
                confidence: 'medium',
                citation: 'docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max',
                note: 'Estimated single; projected non-OAS income $10,000; reduction $5,000/yr per 50% rate',
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
    const manualInput = screen.getByLabelText('Annual GIS amount');
    await user.clear(manualInput);
    await user.type(manualInput, '9000');

    // Blur via tab — triggers writeUserEntered (which MUST fire because touched).
    await user.tab();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Provenance must flip to user_entered (positive control — guard must NOT over-fire).
    const final = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis = final.government_pensions.gis_primary;

    expect(gis.inputPath).toBe('manual');
    expect((gis.value_source as Record<string, unknown>).mode).toBe('user_entered');
    expect((gis.value_source as Record<string, unknown>).confidence).toBe('high');
    expect((gis.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max'
    );
  });

  // ── Test D: above-threshold single commit writes $0; button stays enabled ────

  it('Test D — above-threshold helper commit writes $0 with confidence=low; button stays ENABLED (D-13)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        kind="single"
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Open helper.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    // Type income above the $22,512 single cutoff.
    await user.type(screen.getByLabelText('Your estimated annual income excluding OAS'), '30000');

    // Verbatim ineligibility text must appear in live preview.
    expect(screen.getByText('Not eligible at this projected income')).toBeInTheDocument();

    // Button MUST stay enabled (D-13 — differs from Phase 22 floor case that disabled it).
    const commitBtn = screen.getByRole('button', { name: /^Use this estimate$/ });
    expect(commitBtn).not.toBeDisabled();

    // Commit the $0 / above-threshold case.
    await user.click(commitBtn);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Post-commit assertions.
    const final = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis = final.government_pensions.gis_primary;

    expect(gis.manualOverrideAnnual).toBe(0);
    expect(gis.inputPath).toBe('helper');
    expect((gis.value_source as Record<string, unknown>).mode).toBe('estimated');
    expect((gis.value_source as Record<string, unknown>).confidence).toBe('low');
    // D-09 above-threshold note — verbatim threshold string (GIS-03).
    expect((gis.value_source as Record<string, unknown>).note as string).toContain(
      'At or above single GIS threshold of $22,512'
    );
    expect((gis.value_source as Record<string, unknown>).note as string).toContain(
      'at projected income $30,000'
    );
  });

  // ── Test E: single-tab does NOT render RadioGroup; couple-tab does ────────────

  it('Test E — single-tab does NOT render spouse-OAS RadioGroup; couple-tab does', async () => {
    // (a) Single tab — RadioGroup must NOT be rendered.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRefSingle: { current: UseFormReturn<Record<string, unknown>> | null } = {
      current: null,
    };

    const { unmount } = render(
      <Harness
        kind="single"
        onFormReady={(f) => {
          formRefSingle.current = f;
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    // Legend and radio options must be absent on the single tab.
    expect(screen.queryByText('Does your spouse currently receive OAS or Allowance?')).toBeNull();
    expect(screen.queryByLabelText('Spouse is receiving OAS')).toBeNull();

    unmount();

    // (b) Couple tab — RadioGroup MUST be rendered with all 3 options.
    const formRefCouple: { current: UseFormReturn<Record<string, unknown>> | null } = {
      current: null,
    };

    render(
      <Harness
        kind="couple"
        onFormReady={(f) => {
          formRefCouple.current = f;
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));

    expect(
      screen.getByText('Does your spouse currently receive OAS or Allowance?')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Spouse is receiving OAS')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Spouse is receiving Allowance or Allowance for Survivor')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Spouse is not yet receiving OAS')).toBeInTheDocument();
  });

  // ── Test F: couple-on-oas above-threshold commit surfaces the $29,760 threshold ──

  it('Test F — couple-tier (couple-on-oas) above-threshold commit surfaces the $29,760 threshold (GIS-03)', async () => {
    // Per-tier threshold visibility (GIS-03 UI surface).
    // Proves the Callout body and committed note use the COUPLE-on-OAS combined cutoff
    // ($29,760 from GIS_2026.q2.spouseOnOas.combinedAnnualCutoff), NOT the single cutoff.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <Harness
        kind="couple"
        defaultValues={{
          government_pensions: {
            kind: 'couple',
            gis_primary: {},
            gis_spouse: { incomeExcludingOAS: 20000 }, // seed spouse income (cross-tab combined)
          },
        }}
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    // Open helper, select couple-on-oas, type own income to push combined above $29,760.
    await user.click(screen.getByRole('button', { name: /Open helper to estimate GIS amount/i }));
    await user.click(screen.getByLabelText('Spouse is receiving OAS'));
    await user.type(screen.getByLabelText('Your estimated annual income excluding OAS'), '15000');

    // Combined = 15000 + 20000 = 35000 > 29760 → not eligible.
    expect(screen.getByText('Not eligible at this projected income')).toBeInTheDocument();

    // Button MUST stay enabled (D-13).
    const commitBtn = screen.getByRole('button', { name: /^Use this estimate$/ });
    expect(commitBtn).not.toBeDisabled();

    await user.click(commitBtn);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Post-commit form-state assertions.
    const final = readFormState(formRef) as {
      government_pensions: { gis_primary: Record<string, unknown> };
    };
    const gis = final.government_pensions.gis_primary;

    expect(gis.manualOverrideAnnual).toBe(0);
    expect(gis.inputPath).toBe('helper');
    expect((gis.value_source as Record<string, unknown>).mode).toBe('estimated');
    expect((gis.value_source as Record<string, unknown>).confidence).toBe('low');
    expect(gis.spouseOasStatus).toBe('on-oas');

    // D-09 above-threshold note — couple-on-OAS threshold verbatim (GIS-03).
    expect((gis.value_source as Record<string, unknown>).note as string).toContain(
      'At or above couple (spouse on OAS) GIS threshold of $29,760'
    );
    expect((gis.value_source as Record<string, unknown>).note as string).toContain(
      'at projected income $35,000'
    );

    // Tier-routed citation (GIS-03): must be the spouse-on-oas anchor, NOT the single anchor.
    expect((gis.value_source as Record<string, unknown>).citation).toBe(
      'docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-max'
    );

    // Rendered Callout body must contain the verbatim couple-on-OAS threshold string.
    // The Callout renders because committed value is $0 + mode='estimated' + confidence='low'.
    expect(
      screen.getByText(/above the couple \(spouse on OAS\) GIS threshold of \$29,760/)
    ).toBeInTheDocument();
  });
});
