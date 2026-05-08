/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-misused-promises */

'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RequiredSavingsInputSchema,
  SustainableSpendingInputSchema,
  EarliestRetirementAgeInputSchema,
  RequiredTotalSavingsInputSchema,
} from '@retireops/shared';
import type { SolverMode, SolverInput } from '@retireops/shared';
import type { SolverPrefillData } from '@/lib/api/solver';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FieldLabelHelp } from '@/components/ui/field-help';
import { cn } from '@/lib/utils';

interface SolverFormProps {
  prefillData: SolverPrefillData | null;
  onSubmit: (input: SolverInput) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

const MODES: { id: SolverMode; label: string; description: string }[] = [
  {
    id: 'required-savings',
    label: 'Required Annual Savings',
    description: 'How much do I need to save each year?',
  },
  {
    id: 'sustainable-spending',
    label: 'Sustainable Spending',
    description: 'How much can I safely spend in retirement?',
  },
  {
    id: 'earliest-retirement-age',
    label: 'Earliest Retirement Age',
    description: 'When can I afford to retire?',
  },
  {
    id: 'required-total-savings',
    label: 'Required Total Savings',
    description: 'How much do I need saved to retire?',
  },
];

const PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

const CPP_START_AGES = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];
const OAS_START_AGES = [65, 66, 67, 68, 69, 70];
const EMPTY_NUMERIC_VALUE = undefined as unknown as number;

const numericField = {
  setValueAs: (value: unknown) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return Number(value);
  },
};

function getSchemaForMode(mode: SolverMode) {
  switch (mode) {
    case 'required-savings':
      return RequiredSavingsInputSchema.omit({ dateOfBirth: true });
    case 'sustainable-spending':
      return SustainableSpendingInputSchema.omit({ dateOfBirth: true });
    case 'earliest-retirement-age':
      return EarliestRetirementAgeInputSchema.omit({ dateOfBirth: true });
    case 'required-total-savings':
      return RequiredTotalSavingsInputSchema.omit({ dateOfBirth: true });
  }
}

function buildDefaultValues(mode: SolverMode, prefill: SolverPrefillData | null) {
  const baseValues = {
    mode,
    province: prefill?.province ?? '',
    currentAge:
      prefill?.currentAge !== null && prefill?.currentAge !== undefined
        ? prefill.currentAge
        : ('' as unknown as number),
    rrspBalance:
      prefill?.rrspBalance !== undefined ? prefill.rrspBalance : ('' as unknown as number),
    tfsaBalance:
      prefill?.tfsaBalance !== undefined ? prefill.tfsaBalance : ('' as unknown as number),
    nonRegBalance:
      prefill?.nonRegBalance !== undefined ? prefill.nonRegBalance : ('' as unknown as number),
    employmentIncome:
      prefill?.employmentIncome !== undefined
        ? prefill.employmentIncome
        : ('' as unknown as number),
    cppStartAge: prefill?.cppStartAge ?? 65,
    oasStartAge: prefill?.oasStartAge ?? 65,
    inflationRate: 0.025,
    investmentReturnRate: 0.06,
    lifeExpectancy: 90,
    // dateOfBirth will be derived at submit time from currentAge
    dateOfBirth: '',
    // mode-specific fields
    targetRetirementAge: EMPTY_NUMERIC_VALUE,
    retirementSpending: EMPTY_NUMERIC_VALUE,
    retirementAge: EMPTY_NUMERIC_VALUE,
    annualSavingsRate: EMPTY_NUMERIC_VALUE,
  };
  return baseValues;
}

/**
 * SolverForm — Four-mode reverse calculator form with profile pre-fill support.
 *
 * @see packages/web/src/app/(dashboard)/reverse-calculator/page.tsx
 * @see docs/TESTABLE-SURFACES.md TC-E2E-REVERSE-001
 */
export function SolverForm({ prefillData, onSubmit, isSubmitting, error }: SolverFormProps) {
  const [mode, setMode] = useState<SolverMode>('required-savings');

  const methods = useForm({
    resolver: zodResolver(getSchemaForMode(mode)),
    defaultValues: buildDefaultValues(mode, prefillData),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = methods;

  useEffect(() => {
    reset(buildDefaultValues(mode, prefillData));
  }, [mode, prefillData, reset]);

  const provinceValue = watch('province');
  const cppStartAgeValue = watch('cppStartAge');
  const oasStartAgeValue = watch('oasStartAge');
  const inflationDec = watch('inflationRate') as number | undefined;
  const nominalDec = watch('investmentReturnRate') as number | undefined;
  const realDec =
    typeof inflationDec === 'number' &&
    typeof nominalDec === 'number' &&
    Number.isFinite(inflationDec) &&
    Number.isFinite(nominalDec)
      ? nominalDec - inflationDec
      : null;

  function handleModeChange(newMode: SolverMode) {
    setMode(newMode);
    reset(buildDefaultValues(newMode, prefillData));
  }

  async function handleFormSubmit(values: ReturnType<typeof buildDefaultValues>) {
    const currentAge = Number(values.currentAge);

    // Derive dateOfBirth from currentAge — mid-year approximation (±6 months accuracy)
    // This is a reasonable approximation when the exact DOB is not collected in this form.
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - currentAge;
    const dateOfBirth = `${birthYear}-07-01`;

    const baseInput = {
      province: values.province as SolverInput['province'],
      dateOfBirth,
      currentAge,
      lifeExpectancy: Number(values.lifeExpectancy),
      rrspBalance: Number(values.rrspBalance),
      tfsaBalance: Number(values.tfsaBalance),
      nonRegBalance: Number(values.nonRegBalance),
      employmentIncome: Number(values.employmentIncome),
      cppStartAge: Number(values.cppStartAge),
      oasStartAge: Number(values.oasStartAge),
      investmentReturnRate: Number(values.investmentReturnRate),
      inflationRate: Number(values.inflationRate),
    };

    let solverInput: SolverInput;

    switch (mode) {
      case 'required-savings':
        solverInput = {
          ...baseInput,
          mode: 'required-savings',
          targetRetirementAge: Number(values.targetRetirementAge),
          retirementSpending: Number(values.retirementSpending),
        };
        break;
      case 'sustainable-spending':
        solverInput = {
          ...baseInput,
          mode: 'sustainable-spending',
          retirementAge: Number(values.retirementAge),
        };
        break;
      case 'earliest-retirement-age':
        solverInput = {
          ...baseInput,
          mode: 'earliest-retirement-age',
          annualSavingsRate: Number(values.annualSavingsRate),
          retirementSpending: Number(values.retirementSpending),
        };
        break;
      case 'required-total-savings':
        solverInput = {
          ...baseInput,
          mode: 'required-total-savings',
          targetRetirementAge: Number(values.targetRetirementAge),
          retirementSpending: Number(values.retirementSpending),
        };
        break;
    }

    await onSubmit(solverInput);
  }

  return (
    <div>
      {/* Mode selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleModeChange(m.id)}
            className={cn(
              'min-h-[44px] rounded-xl border p-4 text-left transition-colors',
              mode === m.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-foreground hover:bg-muted'
            )}
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-sm text-muted-foreground">{m.description}</div>
          </button>
        ))}
      </div>

      {/* Form card */}
      <Card>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base flex items-center gap-2">
              {MODES.find((m) => m.id === mode)?.label ?? 'Solver'}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Beta
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              The solver is in beta. Use it for exploration; verify any specific recommendation
              before acting on it.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Section 1: Solver Inputs (mode-specific fields) */}
            <div>
              <h3 className="text-sm font-semibold text-ds-on-background mb-3">Solver Inputs</h3>
              <div className="space-y-4">
                {(mode === 'required-savings' || mode === 'required-total-savings') && (
                  <>
                    <div>
                      <Label htmlFor="targetRetirementAge">Target Retirement Age</Label>
                      <Input
                        id="targetRetirementAge"
                        type="number"
                        {...register('targetRetirementAge', numericField)}
                        placeholder="65"
                        className="mt-1"
                      />
                      {errors.targetRetirementAge && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.targetRetirementAge.message as string}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="retirementSpending">Retirement Spending ($/year)</Label>
                      <Input
                        id="retirementSpending"
                        type="number"
                        {...register('retirementSpending', numericField)}
                        placeholder="50000"
                        className="mt-1"
                      />
                      {errors.retirementSpending && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.retirementSpending.message as string}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {mode === 'sustainable-spending' && (
                  <div>
                    <Label htmlFor="retirementAge">Retirement Age</Label>
                    <Input
                      id="retirementAge"
                      type="number"
                      {...register('retirementAge', numericField)}
                      placeholder="65"
                      className="mt-1"
                    />
                    {errors.retirementAge && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.retirementAge.message as string}
                      </p>
                    )}
                  </div>
                )}

                {mode === 'earliest-retirement-age' && (
                  <>
                    <div>
                      <Label htmlFor="annualSavingsRate">Annual Savings Rate ($/year)</Label>
                      <Input
                        id="annualSavingsRate"
                        type="number"
                        {...register('annualSavingsRate', numericField)}
                        placeholder="20000"
                        className="mt-1"
                      />
                      {errors.annualSavingsRate && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.annualSavingsRate.message as string}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="retirementSpending">Retirement Spending ($/year)</Label>
                      <Input
                        id="retirementSpending"
                        type="number"
                        {...register('retirementSpending', numericField)}
                        placeholder="50000"
                        className="mt-1"
                      />
                      {errors.retirementSpending && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.retirementSpending.message as string}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Section 2: Profile Data */}
            <div>
              <h3 className="text-sm font-semibold text-ds-on-background mb-3">Profile Data</h3>

              {/* Pre-fill banner */}
              {prefillData !== null && (
                <div className="rounded-lg bg-ds-primary-container text-ds-on-primary-container px-4 py-3 text-sm mb-4 flex items-start gap-3">
                  <div className="flex-1">
                    Values loaded from your active profile. You can edit any field before
                    calculating.
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    Pre-filled from profile
                  </Badge>
                </div>
              )}

              <div className="space-y-4">
                {/* Province */}
                <div>
                  <Label htmlFor="province">Province</Label>
                  <Select
                    value={provinceValue}
                    onValueChange={(value) => setValue('province', value)}
                  >
                    <SelectTrigger id="province" className="mt-1">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.province && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.province.message as string}
                    </p>
                  )}
                </div>

                {/* Current Age */}
                <div>
                  <Label htmlFor="currentAge">Current Age</Label>
                  <Input
                    id="currentAge"
                    type="number"
                    {...register('currentAge', numericField)}
                    placeholder="45"
                    className="mt-1"
                  />
                  {errors.currentAge && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.currentAge.message as string}
                    </p>
                  )}
                </div>

                {/* RRSP Balance */}
                <div>
                  <FieldLabelHelp
                    htmlFor="rrspBalance"
                    help="Combined balance across all your RRSPs and RRIFs (registered retirement accounts). Withdrawals are 100% taxable as ordinary income."
                    learnMoreHref="/glossary#rrsp"
                  >
                    RRSP/RRIF Balance ($)
                  </FieldLabelHelp>
                  <Input
                    id="rrspBalance"
                    type="number"
                    {...register('rrspBalance', numericField)}
                    placeholder="200000"
                    className="mt-1"
                  />
                  {errors.rrspBalance && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.rrspBalance.message as string}
                    </p>
                  )}
                </div>

                {/* TFSA Balance */}
                <div>
                  <FieldLabelHelp
                    htmlFor="tfsaBalance"
                    help="Tax-Free Savings Account balance. Growth and withdrawals are completely tax-free; doesn't affect OAS or GIS."
                    learnMoreHref="/glossary#tfsa"
                  >
                    TFSA Balance ($)
                  </FieldLabelHelp>
                  <Input
                    id="tfsaBalance"
                    type="number"
                    {...register('tfsaBalance', numericField)}
                    placeholder="50000"
                    className="mt-1"
                  />
                  {errors.tfsaBalance && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.tfsaBalance.message as string}
                    </p>
                  )}
                </div>

                {/* Non-Registered Balance */}
                <div>
                  <Label htmlFor="nonRegBalance">Non-Registered Balance ($)</Label>
                  <Input
                    id="nonRegBalance"
                    type="number"
                    {...register('nonRegBalance', numericField)}
                    placeholder="30000"
                    className="mt-1"
                  />
                  {errors.nonRegBalance && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.nonRegBalance.message as string}
                    </p>
                  )}
                </div>

                {/* Employment Income */}
                <div>
                  <Label htmlFor="employmentIncome">Employment Income ($/year)</Label>
                  <Input
                    id="employmentIncome"
                    type="number"
                    {...register('employmentIncome', numericField)}
                    placeholder="80000"
                    className="mt-1"
                  />
                  {errors.employmentIncome && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.employmentIncome.message as string}
                    </p>
                  )}
                </div>

                {/* CPP Start Age */}
                <div>
                  <Label htmlFor="cppStartAge">CPP Start Age</Label>
                  <Select
                    value={String(cppStartAgeValue)}
                    onValueChange={(value) => setValue('cppStartAge', Number(value))}
                  >
                    <SelectTrigger id="cppStartAge" className="mt-1">
                      <SelectValue placeholder="65" />
                    </SelectTrigger>
                    <SelectContent>
                      {CPP_START_AGES.map((age) => (
                        <SelectItem key={age} value={String(age)}>
                          {age}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.cppStartAge && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.cppStartAge.message as string}
                    </p>
                  )}
                </div>

                {/* OAS Start Age */}
                <div>
                  <Label htmlFor="oasStartAge">OAS Start Age</Label>
                  <Select
                    value={String(oasStartAgeValue)}
                    onValueChange={(value) => setValue('oasStartAge', Number(value))}
                  >
                    <SelectTrigger id="oasStartAge" className="mt-1">
                      <SelectValue placeholder="65" />
                    </SelectTrigger>
                    <SelectContent>
                      {OAS_START_AGES.map((age) => (
                        <SelectItem key={age} value={String(age)}>
                          {age}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.oasStartAge && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.oasStartAge.message as string}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3: Assumptions */}
            <div>
              <h3 className="text-sm font-semibold text-ds-on-background mb-3">Assumptions</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="inflationRate">Inflation Rate (e.g. 0.025 = 2.5%)</Label>
                  <Input
                    id="inflationRate"
                    type="number"
                    step="0.001"
                    {...register('inflationRate', numericField)}
                    className="mt-1"
                  />
                  {errors.inflationRate && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.inflationRate.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="investmentReturnRate">
                    Nominal Annual Return Before Inflation (e.g. 0.06 = 6%)
                  </Label>
                  <Input
                    id="investmentReturnRate"
                    type="number"
                    step="0.001"
                    {...register('investmentReturnRate', numericField)}
                    className="mt-1"
                  />
                  {errors.investmentReturnRate && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.investmentReturnRate.message as string}
                    </p>
                  )}
                  {realDec !== null && typeof inflationDec === 'number' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ {(realDec * 100).toFixed(1)}% real return after{' '}
                      {(inflationDec * 100).toFixed(1)}% inflation
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lifeExpectancy">Life Expectancy (years)</Label>
                  <Input
                    id="lifeExpectancy"
                    type="number"
                    {...register('lifeExpectancy', numericField)}
                    placeholder="90"
                    className="mt-1"
                  />
                  {errors.lifeExpectancy && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.lifeExpectancy.message as string}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Calculating...' : 'Calculate'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => reset(buildDefaultValues(mode, null))}
              >
                Clear
              </Button>
            </div>

            {/* Error display */}
            {error !== null && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
