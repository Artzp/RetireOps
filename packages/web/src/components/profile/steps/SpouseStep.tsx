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
import { GENDER_OPTIONS } from '@/components/profile/lib/profile-constants';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';
const SELECT_TRIGGER_STYLE =
  'border-0 border-b-2 border-ds-outline-variant rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function SpouseStep() {
  const { register, setValue, watch } = useFormContext();

  const spouseDob = watch('spouse.dateOfBirth') as string;
  const gender = watch('spouse.gender') as string;
  const retirementAge = watch('spouse.retirementAge') as number;

  const spouseAge = spouseDob ? differenceInYears(new Date(), new Date(spouseDob)) : null;

  return (
    <div className="space-y-6">
      {/* First Name / Last Name */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="spouse-firstName" className="text-sm font-bold">
            First Name
          </Label>
          <Input id="spouse-firstName" className={INPUT_STYLE} {...register('spouse.firstName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spouse-lastName" className="text-sm font-bold">
            Last Name
          </Label>
          <Input id="spouse-lastName" className={INPUT_STYLE} {...register('spouse.lastName')} />
        </div>
      </div>

      {/* DOB + Gender */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="spouse-dateOfBirth" className="text-sm font-bold">
            Date of Birth
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="spouse-dateOfBirth"
              type="date"
              className={INPUT_STYLE}
              aria-describedby={spouseAge !== null ? 'spouse-dob-age-display' : undefined}
              {...register('spouse.dateOfBirth')}
            />
            {spouseAge !== null && (
              <span
                id="spouse-dob-age-display"
                className="text-sm text-muted-foreground whitespace-nowrap"
              >
                Age: {spouseAge}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Gender (optional)</Label>
          <Select
            value={gender || ''}
            onValueChange={(v) => setValue('spouse.gender', v || undefined)}
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
      </div>

      {/* Retirement Age Slider */}
      <div className="space-y-2">
        <FieldLabelHelp
          htmlFor="spouse-retirementAge"
          helpId="spouse-retirementAge-help"
          help="The age your spouse or partner plans to stop full-time work. If unsure, use 65 and test other ages."
        >
          Target Retirement Age
        </FieldLabelHelp>
        <MilestoneSlider
          value={retirementAge ?? 65}
          onChange={(v) => setValue('spouse.retirementAge', v)}
          min={50}
          max={75}
          milestones={[55, 60, 65, 70]}
          id="spouse-retirementAge"
          aria-label="Spouse Target Retirement Age"
          aria-describedby="spouse-retirementAge-help"
        />
      </div>
    </div>
  );
}
