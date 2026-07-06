/* eslint-disable @typescript-eslint/no-unnecessary-condition */
'use client';

import { useFormContext } from 'react-hook-form';
import { differenceInYears } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldLabelHelp } from '@/components/ui/field-help';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MilestoneSlider } from '@/components/projection/steps/MilestoneSlider';
import {
  PROVINCES,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from '@/components/profile/lib/profile-constants';
import { DEFAULT_ASSUMPTION_COPY } from '@/lib/settings-assumptions';
import { cn } from '@/lib/utils';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';
const SELECT_TRIGGER_STYLE =
  'border-0 border-b-2 border-ds-outline-variant rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function AboutYouStep() {
  const { register, setValue, watch } = useFormContext();

  const dob = watch('about_you.dateOfBirth') as string;
  const province = watch('about_you.province') as string;
  const gender = watch('about_you.gender') as string;
  const maritalStatus = watch('about_you.maritalStatus') as string;
  const retirementAge = watch('about_you.retirementAge') as number;
  const includeSpouse = watch('about_you.includeSpouse') as boolean;

  const inflationRaw = watch('about_you.inflationRate') as number | string | undefined;
  const nominalRaw = watch('about_you.investmentReturnRate') as number | string | undefined;
  const inflationPct =
    typeof inflationRaw === 'number' ? inflationRaw : Number.parseFloat(inflationRaw ?? '');
  const nominalPct =
    typeof nominalRaw === 'number' ? nominalRaw : Number.parseFloat(nominalRaw ?? '');
  const realPct =
    Number.isFinite(inflationPct) && Number.isFinite(nominalPct) ? nominalPct - inflationPct : null;

  const age = dob ? differenceInYears(new Date(), new Date(dob)) : null;

  return (
    <div className="space-y-6">
      {/* Projection Name */}
      <div className="space-y-2">
        <Label htmlFor="projectionName" className="text-sm font-bold">
          Projection Name
        </Label>
        <Input
          id="projectionName"
          placeholder="My Retirement Plan"
          className={INPUT_STYLE}
          {...register('about_you.projectionName')}
        />
      </div>

      {/* First Name / Last Name */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-sm font-bold">
            First Name
          </Label>
          <Input id="firstName" className={INPUT_STYLE} {...register('about_you.firstName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-sm font-bold">
            Last Name
          </Label>
          <Input id="lastName" className={INPUT_STYLE} {...register('about_you.lastName')} />
        </div>
      </div>

      {/* DOB + Province */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth" className="text-sm font-bold">
            Date of Birth{' '}
            <span className="font-normal text-xs text-muted-foreground">
              (required to run a projection)
            </span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="dateOfBirth"
              type="date"
              className={INPUT_STYLE}
              aria-describedby={age !== null ? 'dob-age-display' : undefined}
              {...register('about_you.dateOfBirth')}
            />
            {age !== null && (
              <span
                id="dob-age-display"
                className="text-sm text-muted-foreground whitespace-nowrap"
              >
                Age: {age}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">
            Province of Residence{' '}
            <span className="font-normal text-xs text-muted-foreground">
              (required to run a projection)
            </span>
          </Label>
          <Select value={province} onValueChange={(v) => setValue('about_you.province', v)}>
            <SelectTrigger className={SELECT_TRIGGER_STYLE}>
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
        </div>
      </div>

      {/* Gender + Marital Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-bold">Gender (optional)</Label>
          <Select
            value={gender || ''}
            onValueChange={(v) => setValue('about_you.gender', v || undefined)}
          >
            <SelectTrigger className={SELECT_TRIGGER_STYLE}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Marital Status (optional)</Label>
          <Select
            value={maritalStatus || ''}
            onValueChange={(v) => setValue('about_you.maritalStatus', v || undefined)}
          >
            <SelectTrigger className={SELECT_TRIGGER_STYLE}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Retirement Age Slider */}
      <div className="space-y-2">
        <FieldLabelHelp
          htmlFor="retirementAge"
          helpId="retirementAge-help"
          help="The age you plan to stop full-time work. If unsure, use 65 and test earlier or later ages."
        >
          Target Retirement Age
        </FieldLabelHelp>
        <MilestoneSlider
          value={retirementAge ?? 65}
          onChange={(v) => setValue('about_you.retirementAge', v)}
          min={50}
          max={75}
          milestones={[50, 55, 60, 65, 70, 75]}
          id="retirementAge"
          aria-label="Target Retirement Age"
          aria-describedby="retirementAge-help"
        />
      </div>

      {/* Life Expectancy */}
      <div className="space-y-2">
        <FieldLabelHelp
          htmlFor="lifeExpectancy"
          helpId="lifeExpectancy-help"
          help="The age projections run to. If unsure, use a longer age such as 90 or 95 to stress-test your plan."
        >
          Life Expectancy
        </FieldLabelHelp>
        <Input
          id="lifeExpectancy"
          type="number"
          min={70}
          max={110}
          className={INPUT_STYLE}
          aria-describedby="lifeExpectancy-help lifeExpectancy-average"
          {...register('about_you.lifeExpectancy')}
        />
        <p id="lifeExpectancy-average" className="text-xs text-muted-foreground">
          Average life expectancy in Canada is 82 years
        </p>
      </div>

      {/* Assumptions */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabelHelp
            htmlFor="inflationRate"
            helpId="inflationRate-help"
            help="Used to estimate how prices rise over time. This default can be changed in Settings or overridden here."
            learnMoreHref="/glossary#nominal-vs-real"
          >
            Inflation rate (%)
          </FieldLabelHelp>
          <Input
            id="inflationRate"
            type="number"
            min={0}
            max={20}
            step={0.1}
            className={INPUT_STYLE}
            aria-describedby="inflationRate-help inflationRate-default"
            {...register('about_you.inflationRate')}
          />
          <p id="inflationRate-default" className="text-xs text-muted-foreground">
            {DEFAULT_ASSUMPTION_COPY}
          </p>
        </div>

        <div className="space-y-2">
          <FieldLabelHelp
            htmlFor="investmentReturnRate"
            helpId="investmentReturnRate-help"
            help="Enter the average pre-inflation annual return on your investments — the kind of number a broker quotes (e.g. 6%). The app subtracts inflation to show real growth. This default can be changed in Settings or overridden here."
            learnMoreHref="/glossary#nominal-vs-real"
          >
            Nominal annual return before inflation (%)
          </FieldLabelHelp>
          <Input
            id="investmentReturnRate"
            type="number"
            min={0}
            max={20}
            step={0.1}
            className={INPUT_STYLE}
            aria-describedby="investmentReturnRate-help investmentReturnRate-default investmentReturnRate-real"
            {...register('about_you.investmentReturnRate')}
          />
          <p id="investmentReturnRate-default" className="text-xs text-muted-foreground">
            {DEFAULT_ASSUMPTION_COPY}
          </p>
          {realPct !== null && (
            <p id="investmentReturnRate-real" className="text-xs text-muted-foreground">
              ≈ {realPct.toFixed(1)}% real return after {inflationPct.toFixed(1)}% inflation
            </p>
          )}
        </div>
      </div>

      {/* Include Spouse Toggle */}
      <div className="flex items-center justify-between pt-4 border-t border-ds-outline-variant">
        <div className="space-y-0.5">
          <Label className="text-sm font-bold">Include Spouse or Partner</Label>
          <p className="text-xs text-muted-foreground">Model a two-person household</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={includeSpouse}
          aria-label="Include Spouse or Partner"
          onClick={() => setValue('about_you.includeSpouse', !includeSpouse)}
          className={cn(
            'relative inline-flex w-11 h-6 rounded-full transition-colors',
            includeSpouse ? 'bg-ds-primary' : 'bg-ds-surface-raised'
          )}
        >
          <span
            className={cn(
              'inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5',
              includeSpouse ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  );
}
