/**
 * GIS-07 cross-tab reactivity integration test.
 *
 * Plan 23-04. Mounts BOTH primary and spouse GisEstimatorCard instances under
 * a single FormProvider, exercising the shared react-hook-form context they
 * have at runtime under GovernmentPensionsStep.tsx. Asserts that committing
 * income on one panel updates the OTHER panel's live preview without a
 * save round-trip — the GIS-07 contract.
 *
 * Why integration test (vs Phase 23-03 unit test): the unit test in 23-03
 * exercises a SINGLE card instance with seeded spouse income via default
 * values. This file exercises the actual cross-tab subscription mechanism —
 * the useWatch hook firing on form-state mutation from a sibling component.
 *
 * Reactivity level — COMMIT-LEVEL (per Plan 23-02):
 *   Plan 23-02 holds `helperIncomeInput` as LOCAL React useState (the helper
 *   income input is NOT RHF-registered). The useWatch on the primary card
 *   only fires AFTER the spouse-side helper commits via "Use this estimate"
 *   (because that is when setValue writes incomeExcludingOAS to RHF state).
 *
 *   The ROADMAP success criterion 4 phrase "without a save round-trip" means
 *   without leaving the wizard / persisting to the API. It does NOT preclude
 *   an in-form commit between helper inputs and form state. Each test below
 *   commits the spouse-side helper before asserting cross-tab reactivity.
 *
 * Note on income input typing:
 *   The helper income input is type="number" with a React controlled value
 *   (helperIncomeInput local state). userEvent.type does not work reliably for
 *   multi-digit numbers on type="number" inputs in jsdom — only the first digit
 *   registers. fireEvent.change is used instead to set the full numeric string
 *   atomically, which triggers the onChange handler directly (W2 fix).
 *
 * @see .planning/REQUIREMENTS.md GIS-07
 * @see .planning/phases/23-gis-estimate-helper/23-CONTEXT.md D-16
 * @see .planning/phases/23-gis-estimate-helper/23-UI-SPEC.md §"Interaction Contract" Cross-tab section
 */

import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { GisEstimatorCard } from './GisEstimatorCard';

// ── TwoCardHarness ────────────────────────────────────────────────────────────
// Mounts BOTH primary and spouse GisEstimatorCard instances under a single
// FormProvider with kind='couple'. Both cards share the same RHF form-state
// store — the same arrangement they have at runtime under GovernmentPensionsStep.tsx.
//
// The spouse panel stays visible (no Tabs primitive in the harness); Tabs
// mount/unmount behaviour is orthogonal to the cross-tab form-state contract
// (RHF preserves form state across mount/unmount via its central store). Phase
// 25 Playwright E2E will exercise the actual Tabs.Content unmount cycle.

interface HarnessProps {
  onFormReady: (form: UseFormReturn<Record<string, unknown>>) => void;
}

function TwoCardHarness({ onFormReady }: HarnessProps): JSX.Element {
  const form = useForm({
    defaultValues: {
      about_you: { kind: 'couple', dateOfBirth: '1960-04-15', province: 'ON' },
      government_pensions: {
        kind: 'couple',
        gis_primary: {},
        gis_spouse: {},
      },
    },
  });

  useEffect(() => {
    onFormReady(form as unknown as UseFormReturn<Record<string, unknown>>);
  }, [form, onFormReady]);

  return (
    <FormProvider {...form}>
      <div data-testid="primary-panel">
        <GisEstimatorCard person="primary" provinceLabel="Ontario" />
      </div>
      <div data-testid="spouse-panel">
        <GisEstimatorCard person="spouse" provinceLabel="Ontario" />
      </div>
    </FormProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GisEstimatorCard — GIS-07 cross-tab reactivity (Plan 23-04)', () => {
  // ── Test 1: forward direction — spouse-side COMMIT drives primary preview ────
  //
  // Spouse commits incomeExcludingOAS=5000 via "Use this estimate" (writes to
  // RHF state via setValue). Primary opens helper, selects tier 'couple-on-oas',
  // types own income 10000. Primary's useWatch on gis_spouse.incomeExcludingOAS
  // fires and includes spouse=5000 in the combined-income preview.
  //
  // Math: estimateGIS({ tier:'couple-on-oas', own:10000, spouse:5000 })
  //   combined = 15000
  //   annualGross = 668.08*12 - 15000*0.25 = 8016.96 - 3750 = 4266.96
  //   roundAnnual(4266.96) = 4300 → "$ 4,300 / yr"

  it('Test 1 — primary preview reacts to spouse-side COMMIT (GIS-07 forward direction)', async () => {
    const user = userEvent.setup();
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <TwoCardHarness
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    const primaryPanel = screen.getByTestId('primary-panel');
    const spousePanel = screen.getByTestId('spouse-panel');

    // Step 1 — Spouse-side helper commit.
    // Writes government_pensions.gis_spouse.incomeExcludingOAS = 5000 to RHF state
    // via setValue inside commitHelper. This is the trigger for the primary card's
    // useWatch subscription.
    await user.click(
      within(spousePanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    // Select tier — required before a preview can be computed on the couple tab.
    await user.click(within(spousePanel).getByLabelText('Spouse is receiving OAS'));
    // W2: fireEvent.change for type="number" controlled inputs (userEvent.type only
    // registers the first digit in jsdom on number inputs).
    const spouseIncomeInput = within(spousePanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(spouseIncomeInput, { target: { value: '5000' } });
    // Commit — writes gis_spouse.incomeExcludingOAS=5000 to RHF form state.
    await user.click(within(spousePanel).getByRole('button', { name: /^Use this estimate$/ }));

    // Step 2 — Primary-side helper opens and types own income.
    // At this point, the primary card's useWatch subscription has already fired
    // (spouseIncomeExcludingOAS = 5000 in RHF state). Setting own income updates
    // helperIncomeInput (local state) which drives the live preview useMemo.
    await user.click(
      within(primaryPanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(primaryPanel).getByLabelText('Spouse is receiving OAS'));
    const primaryIncomeInput = within(primaryPanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(primaryIncomeInput, { target: { value: '10000' } });

    // Step 3 — Primary preview reflects combined = 10000 + 5000 = 15000.
    //   estimateGIS({ tier:'couple-on-oas', own:10000, spouse:5000 }).annualGross
    //     = 668.08*12 - 15000*0.25 = 8016.96 - 3750 = 4266.96
    //   roundAnnual(4266.96) = 4300 → toLocaleString('en-CA') = '4,300'
    // waitFor handles async Radix UI Collapsible animation flushes (Presence component).
    await waitFor(() => {
      expect(within(primaryPanel).getByText(/\$ 4,300 \/ yr/)).toBeInTheDocument();
    });
  });

  // ── Test 2: inverse direction — primary-side COMMIT drives spouse preview ────
  //
  // Primary commits incomeExcludingOAS=12000 via "Use this estimate" (writes to
  // RHF state via setValue). Spouse opens helper, selects tier 'couple-on-oas',
  // types own income 8000. Spouse's useWatch on gis_primary.incomeExcludingOAS
  // fires and includes primary=12000 in the combined-income preview.
  //
  // Math: estimateGIS({ tier:'couple-on-oas', own:8000, spouse:12000 })
  //   combined = 20000
  //   annualGross = 668.08*12 - 20000*0.25 = 8016.96 - 5000 = 3016.96
  //   roundAnnual(3016.96) = 3000 → "$ 3,000 / yr"

  it('Test 2 — spouse preview reacts to primary-side COMMIT (GIS-07 inverse direction)', async () => {
    const user = userEvent.setup();
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <TwoCardHarness
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    const primaryPanel = screen.getByTestId('primary-panel');
    const spousePanel = screen.getByTestId('spouse-panel');

    // Step 1 — Primary-side helper commit.
    // Writes government_pensions.gis_primary.incomeExcludingOAS = 12000 to RHF state.
    await user.click(
      within(primaryPanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(primaryPanel).getByLabelText('Spouse is receiving OAS'));
    const primaryIncomeInput = within(primaryPanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(primaryIncomeInput, { target: { value: '12000' } });
    // Commit — writes gis_primary.incomeExcludingOAS=12000 to RHF form state.
    await user.click(within(primaryPanel).getByRole('button', { name: /^Use this estimate$/ }));

    // Step 2 — Spouse-side helper opens and sets own income.
    // The spouse card watches gis_primary.incomeExcludingOAS via useWatch
    // (spousePath for the spouse card = 'government_pensions.gis_primary').
    await user.click(
      within(spousePanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(spousePanel).getByLabelText('Spouse is receiving OAS'));
    const spouseIncomeInput = within(spousePanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(spouseIncomeInput, { target: { value: '8000' } });

    // Spouse preview reflects combined = 12000 + 8000 = 20000.
    //   668.08*12 - 20000*0.25 = 8016.96 - 5000 = 3016.96 → roundAnnual = 3000
    await waitFor(() => {
      expect(within(spousePanel).getByText(/\$ 3,000 \/ yr/)).toBeInTheDocument();
    });
  });

  // ── Test 3 — combined-income aggregation is commutative (a+b === b+a) ────────
  //
  // Two separate it() blocks rendering a fresh TwoCardHarness each. Both scenarios
  // produce combined=20000 and the SAME primary-side preview ($3,000), regardless
  // of which spouse holds the larger share.
  //
  // NO form-state assertions in Test 3 (Blocker 2 fix): the helper income input
  // is local state until commit, and each scenario only commits one side. Asserting
  // on gis_primary.incomeExcludingOAS / gis_spouse.incomeExcludingOAS would be
  // contradictory. The rendered preview text IS the user-facing surface and the
  // correct place to assert commutativity.

  it('Test 3a — Scenario A: spouse=12000 (committed) + primary=8000 (live) → primary preview $3,000', async () => {
    const user = userEvent.setup();
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <TwoCardHarness
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    const primaryPanel = screen.getByTestId('primary-panel');
    const spousePanel = screen.getByTestId('spouse-panel');

    // Commit spouse=12000 (writes gis_spouse.incomeExcludingOAS=12000 to RHF).
    await user.click(
      within(spousePanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(spousePanel).getByLabelText('Spouse is receiving OAS'));
    const spouseIncomeInput = within(spousePanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(spouseIncomeInput, { target: { value: '12000' } });
    await user.click(within(spousePanel).getByRole('button', { name: /^Use this estimate$/ }));

    // Live primary=8000 (local state only; NOT committed).
    await user.click(
      within(primaryPanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(primaryPanel).getByLabelText('Spouse is receiving OAS'));
    const primaryIncomeInput = within(primaryPanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(primaryIncomeInput, { target: { value: '8000' } });

    // Combined = 8000 + 12000 = 20000 → $3,000 preview.
    //   668.08*12 - 20000*0.25 = 8016.96 - 5000 = 3016.96 → roundAnnual = 3000
    await waitFor(() => {
      expect(within(primaryPanel).getByText(/\$ 3,000 \/ yr/)).toBeInTheDocument();
    });
  });

  it('Test 3b — Scenario B: spouse=8000 (committed) + primary=12000 (live) → primary preview $3,000 (same combined → same result)', async () => {
    const user = userEvent.setup();
    const formRef: { current: UseFormReturn<Record<string, unknown>> | null } = { current: null };

    render(
      <TwoCardHarness
        onFormReady={(f) => {
          formRef.current = f;
        }}
      />
    );

    const primaryPanel = screen.getByTestId('primary-panel');
    const spousePanel = screen.getByTestId('spouse-panel');

    // Commit spouse=8000 (writes gis_spouse.incomeExcludingOAS=8000 to RHF).
    await user.click(
      within(spousePanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(spousePanel).getByLabelText('Spouse is receiving OAS'));
    const spouseIncomeInput = within(spousePanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(spouseIncomeInput, { target: { value: '8000' } });
    await user.click(within(spousePanel).getByRole('button', { name: /^Use this estimate$/ }));

    // Live primary=12000 (local state only; NOT committed).
    await user.click(
      within(primaryPanel).getByRole('button', { name: /Open helper to estimate GIS amount/i })
    );
    await user.click(within(primaryPanel).getByLabelText('Spouse is receiving OAS'));
    const primaryIncomeInput = within(primaryPanel).getByLabelText(
      'Your estimated annual income excluding OAS'
    );
    fireEvent.change(primaryIncomeInput, { target: { value: '12000' } });

    // Same combined = 12000 + 8000 = 20000 → same preview $3,000 (commutativity).
    //   668.08*12 - 20000*0.25 = 8016.96 - 5000 = 3016.96 → roundAnnual = 3000
    await waitFor(() => {
      expect(within(primaryPanel).getByText(/\$ 3,000 \/ yr/)).toBeInTheDocument();
    });
  });
});
