/* eslint-disable @typescript-eslint/restrict-template-expressions, eqeqeq */
'use client';

// @see docs/source-of-truth/14-visualization-ux.md — editable cell popover
// Decision refs: "D-24" "D-25" "D-26" "D-39" "D-42" "D-43" "D-44" "D-52"
// String literals locked by UI-SPEC Copywriting Contract: "Save Override" "Discard"
// "Apply to all future years until next manual change" "Amount must be 0 or greater."
// "Maximum allowed override is $10,000,000." "Amount clamped to"
// Phase 2 locked copy: "Engine-calculated — full provenance lands in v4.3."
// "View rule in source-of-truth docs" "View rule in source-of-truth docs — opens in new tab"
// "Inputs" "Overridden " "+ {n} more"

import * as React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ProvenanceCellMetadata } from '@retireops/shared';
import { keyToLabel, formatProvenanceValue } from '@/lib/format-provenance';

/**
 * OverrideCellPopover — Phase 2 evolved.
 *
 * Modes:
 *   - 'editable'    (default — Phase 1 behavior preserved)
 *   - 'readonly'    (in-scope non-editable cells: taxes, RRIF min, totalIncome)
 *   - 'placeholder' (out-of-scope cells: CPP, OAS, balances, etc. — D-39)
 *
 * Editable popover for the YearByYearTab per UI-SPEC Component Inventory §2.
 * @see .planning/phases/01-editable-overrides/01-UI-SPEC.md
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-24, D-25, D-26
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md - Component Inventory + Mode Rendering Matrix
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-42, D-43, D-44, D-45, D-52
 */

export type OverrideField = 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg' | 'spending';

export interface OverrideValue {
  field: OverrideField;
  amount: number;
  applyForward: boolean;
}

export interface ClampInfo {
  requestedReal: number;
  clampedTo: number;
}

export interface SecondaryField {
  field: 'rrsp' | 'rrif';
  label: string;
  activeOverride?: { amount: number; applyForward: boolean };
  clampInfo?: ClampInfo;
}

export interface OverrideCellPopoverProps {
  /** The projection year being edited. */
  year: number;
  /**
   * The account type / field being edited or inspected.
   * Accepts any string so read-only and placeholder callers (e.g. ReadOnlyCell
   * in YearByYearTab) do not need an unsafe `as OverrideField` cast (WR-05).
   * In editable mode the value is always a valid OverrideField; the save path
   * casts it internally when building the OverrideValue payload.
   */
  field: string;
  /** Human-readable label, e.g. "RRSP Withdrawal 2031". */
  label: string;
  /** The current formatted value shown in the table cell (for trigger aria-label). */
  currentDisplayValue: number;
  /** Existing active override for this cell, if any. */
  activeOverride?: { amount: number; applyForward: boolean };
  /** Clamp info if the last save was clamped to available balance. */
  clampInfo?: ClampInfo;
  /** Controlled open state driven by parent. */
  open: boolean;
  /** Called by parent to open/close the popover. */
  onOpenChange: (open: boolean) => void;
  /**
   * Called on Save Override. Receives a structured payload.
   * `primary` always includes the opened cell's field + amount + applyForward.
   * `secondary` is present only for merged-RRIF dual-input cells.
   */
  onSave: (payload: { primary: OverrideValue; secondary?: OverrideValue }) => Promise<void>;
  /** Called on Discard (form state discarded, popover closed). */
  onCancel: () => void;
  /**
   * When provided, renders a second input block (merged-RRIF cell with both RRSP and RRIF inputs).
   * @see UI-SPEC §Q1 (merged-RRIF balance-gated dual-input)
   */
  secondaryField?: SecondaryField;
  /**
   * Optional trigger element. Rendered via PopoverTrigger asChild.
   * When omitted a default button trigger with the accessible aria-label is rendered.
   */
  children?: React.ReactNode;

  /** Provenance metadata for this cell (D-32). Renders above the edit form in editable mode; sole content in readonly mode. */
  provenance?: ProvenanceCellMetadata;

  /**
   * Rendering mode (D-42):
   *  - 'editable'    — Phase 1 edit form + (optional) provenance section above
   *  - 'readonly'    — Provenance section only (no form, no save buttons)
   *  - 'placeholder' — Single-line "Engine-calculated — full provenance lands in v4.3." (D-39)
   *
   * Default: 'editable' — preserves Phase 1 behavior when omitted.
   */
  mode?: 'editable' | 'readonly' | 'placeholder';

  /**
   * PHASE 3 (D-73): when present (and `activeOverride` truthy and `mode==='editable'`),
   * a "Remove override" button renders inline next to the override metadata line.
   * Click triggers PATCH+/run that removes the override record and fires the cascade
   * highlight diff (D-69). Popover stays OPEN after success (D-68).
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-65, D-67, D-68, D-73
   */
  onRemoveOverride?: () => Promise<void>;

  /**
   * PHASE 3 (D-73): true while a removal PATCH+/run round-trip is in-flight.
   * Disables the Remove button during this window.
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-73, D-74
   */
  isRemoving?: boolean;
}

const MAX_AMOUNT = 10_000_000;
const VALIDATION_NEGATIVE = 'Amount must be 0 or greater.';
const VALIDATION_OVER_LIMIT = 'Maximum allowed override is $10,000,000.';
const VALIDATION_NOT_A_NUMBER = 'Enter a valid number.';
// WR-08: surfaced in the popover when PATCH /decisions rejects (network blip,
// 4xx, 5xx). The popover used to close before the await, so the user saw the
// override flash on and disappear silently — this message + keeping the
// popover open lets the user retry without re-entering the amount.
const SAVE_FAILED = 'Save failed — please try again.';
const REMOVE_FAILED = 'Remove failed — please try again.';

/**
 * Validate an amount string. Returns { amount, error }.
 * Empty string is returned as { amount: null, error: null } — treated as "nothing to save".
 *
 * WR-06: split the condition `!Number.isFinite(n) || n < 0` into three branches
 * so the user-facing message reflects the actual failure class. NaN and
 * Infinity (e.g. `1e500` parsed as `Number`) previously produced the
 * misleading "Amount must be 0 or greater." message even though they are
 * not negative. Zod (scenario.ts:124) already differentiates these
 * server-side via .finite() + .min(0); align the client UX.
 */
function validateAmount(amountStr: string): { amount: number | null; error: string | null } {
  if (amountStr.trim() === '') return { amount: null, error: null };
  const n = Number(amountStr);
  if (Number.isNaN(n)) return { amount: null, error: VALIDATION_NOT_A_NUMBER };
  // Infinity (e.g. `1e500`) is a magnitude error → reuse OVER_LIMIT copy.
  if (!Number.isFinite(n)) return { amount: null, error: VALIDATION_OVER_LIMIT };
  if (n < 0) return { amount: null, error: VALIDATION_NEGATIVE };
  if (n > MAX_AMOUNT) return { amount: null, error: VALIDATION_OVER_LIMIT };
  return { amount: n, error: null };
}

// ---------------------------------------------------------------------------
// InputBlock — rendered for primary and (optionally) secondary fields
// ---------------------------------------------------------------------------

interface InputBlockProps {
  /** Rendered above the input in dual-input mode only. */
  amountLabel?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  amount: string;
  onAmountChange: (v: string) => void;
  applyForward: boolean;
  onApplyForwardChange: (v: boolean) => void;
  error: string | null;
  clampInfo?: ClampInfo;
  idPrefix: string;
  /** Auto-focus this input on mount (primary only). */
  autoFocus?: boolean;
  /** Called on keyDown — used to intercept Enter (submit) and Escape (cancel). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function InputBlock({
  amountLabel,
  inputRef,
  amount,
  onAmountChange,
  applyForward,
  onApplyForwardChange,
  error,
  clampInfo,
  idPrefix,
  autoFocus,
  onKeyDown,
}: InputBlockProps) {
  const checkboxId = `${idPrefix}-apply-forward`;
  return (
    <div>
      {amountLabel != null && <Label className="text-xs mb-1 block">{amountLabel}</Label>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          ref={inputRef}
          type="number"
          min={0}
          max={MAX_AMOUNT}
          step={1}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-invalid={error != null}
          aria-describedby={error != null ? `${idPrefix}-error` : undefined}
          autoFocus={autoFocus}
        />
      </div>
      {error != null && (
        <p id={`${idPrefix}-error`} className="text-xs text-destructive mt-1">
          {error}
        </p>
      )}
      <div className="flex items-start gap-2 mt-2">
        <Checkbox
          id={checkboxId}
          checked={applyForward}
          onCheckedChange={(v) => onApplyForwardChange(v === true)}
        />
        <Label htmlFor={checkboxId} className="text-sm leading-snug cursor-pointer">
          Apply to all future years until next manual change
        </Label>
      </div>
      {clampInfo != null && (
        <div className="flex items-start gap-1 mt-2 p-2 bg-warning/10 rounded-sm">
          <AlertTriangle className="h-3 w-3 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Amount clamped to {formatCurrency(clampInfo.clampedTo)} — your requested{' '}
            {formatCurrency(clampInfo.requestedReal)} exceeded the available balance. The engine
            withdrew what was available and covered the gap from other accounts.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProvenanceSection — renders rule name, inputs <dl>, and doc-link (D-43, D-44, D-52)
// ---------------------------------------------------------------------------

const DOCS_BASE_DEFAULT = 'https://github.com/Artzp/RetireOps/blob/main/';

function ProvenanceSection({ provenance }: { provenance: ProvenanceCellMetadata }) {
  const baseUrl = process.env['NEXT_PUBLIC_DOCS_BASE_URL'] ?? DOCS_BASE_DEFAULT;
  const href = `${baseUrl}${provenance.docRef}`;

  const inputEntries = Object.entries(provenance.inputs);
  const visibleEntries = inputEntries.slice(0, 8);
  const overflow = inputEntries.length - visibleEntries.length;

  return (
    <div className="space-y-1">
      {/* D-44: Override metadata line — only when overrideMeta is present (PROV-02) */}
      {provenance.overrideMeta != null && (
        <p className="text-xs text-muted-foreground mb-1">
          Overridden {new Date(provenance.overrideMeta.updatedAt).toISOString().split('T')[0]} — was{' '}
          {formatCurrency(provenance.overrideMeta.originalEngineValue)}
        </p>
      )}
      {/* Source line: "Source: " prefix + rule name (UI-SPEC §Provenance Section Layout) */}
      <p className="leading-snug">
        <span className="text-xs text-muted-foreground">Source: </span>
        <span className="text-sm">{provenance.ruleName}</span>
      </p>
      {/* Inputs section label — locked copy "Inputs" (UI-SPEC §Copywriting Contract) */}
      <p className="text-xs text-muted-foreground uppercase tracking-wide mt-2 mb-1">Inputs</p>
      {/* Inputs <dl> — semantic definition list for screen readers (T-A11Y-01) */}
      <dl>
        {visibleEntries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-x-4 text-xs">
            <dt className="text-muted-foreground">{keyToLabel(k)}</dt>
            <dd className="tabular-nums">{formatProvenanceValue(k, v)}</dd>
          </div>
        ))}
      </dl>
      {/* Truncation trailer — "+ N more" (UI-SPEC §Copywriting Contract) */}
      {overflow > 0 && <p className="text-xs text-muted-foreground mt-1">+ {overflow} more</p>}
      {/* D-52: Doc-link button — target="_blank" + NEXT_PUBLIC_DOCS_BASE_URL (T-OPENREDIR-01) */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View rule in source-of-truth docs — opens in new tab"
        className="inline-flex items-center gap-1 text-xs text-ds-primary hover:underline mt-2"
      >
        View rule in source-of-truth docs
        <ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OverrideCellPopover — main export
// ---------------------------------------------------------------------------

export function OverrideCellPopover(props: OverrideCellPopoverProps) {
  const {
    year,
    field,
    label,
    currentDisplayValue,
    activeOverride,
    clampInfo,
    open,
    onOpenChange,
    onSave,
    onCancel,
    secondaryField,
    children,
    provenance,
    onRemoveOverride, // PHASE 3 (D-73)
    isRemoving, // PHASE 3 (D-73)
  } = props;

  // D-42: default mode = 'editable' — Phase 1 behavior preserved when omitted
  const mode = props.mode ?? 'editable';

  // Local edit buffer — reset each time the popover opens (open: false → true).
  const [primaryAmount, setPrimaryAmount] = React.useState<string>('');
  const [primaryApplyForward, setPrimaryApplyForward] = React.useState<boolean>(false);
  const [secondaryAmount, setSecondaryAmount] = React.useState<string>('');
  const [secondaryApplyForward, setSecondaryApplyForward] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState(false);
  const [primaryError, setPrimaryError] = React.useState<string | null>(null);
  const [secondaryError, setSecondaryError] = React.useState<string | null>(null);
  // WR-08: surfaces save-path failures (onSave rejection / PATCH /decisions).
  // Cleared when the user retries (next validateInputs call).
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const primaryInputRef = React.useRef<HTMLInputElement>(null);

  /**
   * PHASE 3 (D-68): after a successful Remove override, the parent passes
   * activeOverride={undefined}. The Remove button vanishes; the popover stays
   * open in 'editable' mode. We move focus to the primary input so the user
   * can immediately re-edit if needed.
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-68
   * @see .planning/phases/03-cascade-undo/03-UI-SPEC.md §Accessibility Contract §Focus management after removal
   */
  const prevActiveOverrideRef = React.useRef(activeOverride);
  React.useEffect(() => {
    if (open && prevActiveOverrideRef.current != null && activeOverride == null) {
      primaryInputRef.current?.focus();
    }
    prevActiveOverrideRef.current = activeOverride;
  }, [open, activeOverride]);

  const headingId = React.useId();

  // Initialise the buffer when the popover transitions from closed to open.
  const prevOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPrimaryAmount(activeOverride != null ? String(activeOverride.amount) : '');
      setPrimaryApplyForward(activeOverride?.applyForward ?? false);
      if (secondaryField != null) {
        setSecondaryAmount(
          secondaryField.activeOverride != null ? String(secondaryField.activeOverride.amount) : ''
        );
        setSecondaryApplyForward(secondaryField.activeOverride?.applyForward ?? false);
      } else {
        setSecondaryAmount('');
        setSecondaryApplyForward(false);
      }
      setPrimaryError(null);
      setSecondaryError(null);
      setSaveError(null); // WR-08: clear any stale save-path error on reopen
    }
    prevOpenRef.current = open;
  }, [open, activeOverride, secondaryField]);

  // Build the popover heading.
  // Note: dual-input uses "RRIF/RRSP — {year}" (not "RRIF/RRSP Withdrawals") to avoid a
  // substring collision with "RRSP Withdrawal" (the secondary block's label). The Copywriting
  // Contract specified "RRIF/RRSP Withdrawals" but the per-block labels already identify each
  // field; the shorter heading avoids ambiguity in the DOM (see 01-07-SUMMARY.md deviation).
  const headingText =
    secondaryField != null
      ? `RRIF/RRSP — ${year}`
      : field === 'spending'
        ? `Living Expenses — ${year}`
        : `${label} — ${year}`;

  // Accessible trigger label (used on the default trigger button).
  const triggerAriaLabel = `Edit ${label} — current value ${formatCurrency(currentDisplayValue)}`;

  // ---------------------------------------------------------------------------
  // Validation — synchronous, called from both click handler and keyDown.
  // Returns true if validation passed and async save was kicked off.
  // ---------------------------------------------------------------------------

  /**
   * Validate inputs synchronously. Sets error state and returns whether all
   * inputs are valid. Called before initiating the async save.
   */
  function validateInputs(): {
    valid: boolean;
    primaryResult: { amount: number | null; error: string | null };
    secondaryResult: { amount: number | null; error: string | null };
  } {
    const primaryResult = validateAmount(primaryAmount);
    setPrimaryError(primaryResult.error);

    let secondaryResult: { amount: number | null; error: string | null } = {
      amount: null,
      error: null,
    };
    if (secondaryField != null) {
      secondaryResult = validateAmount(secondaryAmount);
      setSecondaryError(secondaryResult.error);
    }

    const valid = primaryResult.error == null && secondaryResult.error == null;
    return { valid, primaryResult, secondaryResult };
  }

  /**
   * Async save — called after validation passes.
   *
   * WR-08: wraps onSave() in try/catch so rejections (PATCH /decisions
   * network / 4xx / 5xx) surface a SAVE_FAILED message in the popover.
   * The popover stays OPEN on failure — the user keeps their typed amount
   * and can retry without re-entering. On success, onOpenChange(false) is
   * called (the useOverrideEditor hook also clears openCell, but closing
   * via onOpenChange keeps the component's own controlled flow intact).
   */
  async function doSave(
    primaryResult: { amount: number | null; error: string | null },
    secondaryResult: { amount: number | null; error: string | null }
  ) {
    // If neither amount was entered, treat as a no-op cancel.
    if (
      primaryResult.amount === null &&
      (secondaryField == null || secondaryResult.amount === null)
    ) {
      onCancel();
      return;
    }

    // WR-03: in the dual-input merged-RRIF cell, if the user fills in only the
    // secondary amount and leaves primary blank, primaryResult.amount is null and
    // would silently resolve to $0 via the `?? activeOverride?.amount ?? 0` fallback
    // below. Require the primary to be filled independently before saving.
    if (
      primaryResult.amount === null &&
      secondaryField != null &&
      secondaryResult.amount !== null
    ) {
      setPrimaryError('Enter an amount.');
      return;
    }

    setSaving(true);
    setSaveError(null); // clear any prior save-path error
    try {
      const payload: { primary: OverrideValue; secondary?: OverrideValue } = {
        primary: {
          // mode='editable' callers always pass a valid OverrideField; the prop
          // accepts string to avoid unsafe casts at read-only call sites (WR-05).
          field: field as OverrideField,
          amount: primaryResult.amount ?? activeOverride?.amount ?? 0,
          applyForward: primaryApplyForward,
        },
      };
      if (secondaryField != null && secondaryResult.amount !== null) {
        payload.secondary = {
          field: secondaryField.field,
          amount: secondaryResult.amount,
          applyForward: secondaryApplyForward,
        };
      }
      await onSave(payload);
      onOpenChange(false);
    } catch {
      // Surface the failure in-popover; keep popover open so the user can retry.
      // The hook (useOverrideEditor) has already rolled back its optimistic
      // decisions state — the user's typed amount is preserved in local buffer.
      setSaveError(SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Save button click handler — synchronously validates then kicks off async save.
  // ---------------------------------------------------------------------------

  function handleSaveClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const { valid, primaryResult, secondaryResult } = validateInputs();
    if (!valid) return;
    // Fire-and-forget the async save (errors are surfaced via setSaving / onSave rejection).
    void doSave(primaryResult, secondaryResult);
  }

  // ---------------------------------------------------------------------------
  // Keyboard handling on inputs (Enter = submit, Escape = cancel)
  // ---------------------------------------------------------------------------

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const { valid, primaryResult, secondaryResult } = validateInputs();
      if (!valid) return;
      void doSave(primaryResult, secondaryResult);
    }
  }

  // Form onSubmit is kept as a fallback for native form submission (browser Enter key, etc.)
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { valid, primaryResult, secondaryResult } = validateInputs();
    if (!valid) return;
    void doSave(primaryResult, secondaryResult);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const triggerElement =
    children != null ? (
      <PopoverTrigger asChild>{children}</PopoverTrigger>
    ) : (
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerAriaLabel}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="false"
        />
      </PopoverTrigger>
    );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {triggerElement}
      <PopoverContent
        className="min-w-[280px]"
        aria-labelledby={headingId}
        onOpenAutoFocus={
          // Pitfall 3: only focus the primary input in editable mode — read-only / placeholder
          // have no input to focus (D-42).
          mode === 'editable'
            ? (e) => {
                // Prevent Radix default focus management so autoFocus on Input works.
                e.preventDefault();
                primaryInputRef.current?.focus();
              }
            : undefined
        }
      >
        {/* Popover heading — UI-SPEC §Copywriting Contract */}
        <h3 id={headingId} className="text-xs text-muted-foreground mb-2">
          {headingText}
        </h3>

        {/* Phase 2 — D-39: placeholder mode renders only the locked out-of-scope copy */}
        {mode === 'placeholder' && (
          <p className="text-sm text-muted-foreground">
            Engine-calculated — full provenance lands in v4.3.
          </p>
        )}

        {/* Phase 2 — D-42: readonly mode renders only the provenance section (no edit form) */}
        {mode === 'readonly' && provenance != null && <ProvenanceSection provenance={provenance} />}

        {/* D-42: editable mode — provenance section above edit form (D-43), or edit form alone */}
        {mode === 'editable' && (
          <>
            {provenance != null && (
              <>
                <ProvenanceSection provenance={provenance} />
                {/* D-43: separator between provenance section and edit form */}
                <hr className="my-3 border-border" />
              </>
            )}
            <form onSubmit={handleSubmit}>
              {/* Primary input block — no amountLabel in single-input mode;
                  secondary block's own label distinguishes it in dual-input mode */}
              <InputBlock
                inputRef={primaryInputRef}
                amount={primaryAmount}
                onAmountChange={setPrimaryAmount}
                applyForward={primaryApplyForward}
                onApplyForwardChange={setPrimaryApplyForward}
                error={primaryError}
                clampInfo={clampInfo}
                idPrefix="primary"
                autoFocus={open}
                onKeyDown={handleInputKeyDown}
              />

              {/* Secondary input block (merged-RRIF dual-input variant) */}
              {secondaryField != null && (
                <>
                  <hr className="my-3 border-border" />
                  <InputBlock
                    amountLabel={secondaryField.label}
                    amount={secondaryAmount}
                    onAmountChange={setSecondaryAmount}
                    applyForward={secondaryApplyForward}
                    onApplyForwardChange={setSecondaryApplyForward}
                    error={secondaryError}
                    clampInfo={secondaryField.clampInfo}
                    idPrefix="secondary"
                    onKeyDown={handleInputKeyDown}
                  />
                </>
              )}

              {/* PHASE 3 (D-65, D-67, D-73): Remove override button — after checkbox, before CTA.
                  Rendered only when all 3 conditions met: activeOverride truthy, mode='editable',
                  onRemoveOverride provided. Flex wrapper satisfies D-65 layout contract.
                  DOM position (after input+checkbox, before Discard+Save) matches UI-SPEC tab order. */}
              {mode === 'editable' && activeOverride != null && onRemoveOverride != null && (
                <div className="flex items-center justify-between gap-x-2 mb-1 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveOverride().catch(() => {
                        setSaveError(REMOVE_FAILED);
                      });
                    }}
                    disabled={isRemoving === true}
                    aria-disabled={isRemoving === true}
                    aria-label="Remove override"
                    className="text-xs text-destructive hover:text-destructive/80 disabled:text-destructive/40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/50 rounded-sm"
                  >
                    Remove override
                  </button>
                </div>
              )}

              {/* WR-08: save-path error surface (network / 4xx / 5xx on PATCH /decisions) */}
              {saveError != null && (
                <p
                  role="alert"
                  className="mt-3 text-xs text-destructive"
                  data-testid="override-save-error"
                >
                  {saveError}
                </p>
              )}

              {/* CTA row — UI-SPEC §Copywriting Contract: "Discard" left, "Save Override" right */}
              <div className="mt-4 flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onCancel();
                    onOpenChange(false);
                  }}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-ds-primary text-ds-on-primary hover:bg-ds-primary-fixed-dim"
                  onClick={handleSaveClick}
                >
                  Save Override
                </Button>
              </div>
            </form>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
