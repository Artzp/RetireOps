'use client';

// Presentational timing inputs extracted from YearByYearTab — props-only, no
// owned state. Reusable age-select and number-input primitives used by the
// timing comparison panel.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ageLabel } from './year-by-year-helpers';

export function TimingAgeSelect({
  label,
  value,
  ages,
  onChange,
}: {
  label: string;
  value: number;
  ages: ReadonlyArray<number>;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-28 text-xs font-medium text-ds-on-surface-variant">
      <span className="mb-1 block">{label}</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger
          aria-label={`${label} age`}
          className="h-9 rounded-sm border-ds-outline-variant bg-ds-surface text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ages.map((age) => (
            <SelectItem key={age} value={String(age)}>
              {ageLabel(age)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TimingNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="min-w-32 text-xs font-medium text-ds-on-surface-variant">
      <Label htmlFor={id} className="mb-1 block text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 rounded-sm border-ds-outline-variant bg-ds-surface text-xs"
      />
    </div>
  );
}
