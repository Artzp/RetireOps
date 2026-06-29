'use client';

import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { numVal } from '@/lib/coerce';
import type { AccountCardInfo } from '@/lib/profile-utils';
import type { RoomViolation } from '@/lib/contribution-room';
import type { SavingsState } from './editor-types';

interface SavingsSectionProps {
  state: SavingsState;
  setState: Dispatch<SetStateAction<SavingsState>>;
  setDirty: (dirty: boolean) => void;
  saving: boolean;
  saveError: boolean;
  onSave: () => void;
  accountCards: AccountCardInfo[];
  roomViolations: RoomViolation[];
  accountMap: Map<string, string>;
}

/** Savings section body of the scenario decisions editor (contribution
 * overrides). State stays owned by the parent page and flows down via props. */
export function SavingsSection({
  state,
  setState,
  setDirty,
  saving,
  saveError,
  onSave,
  accountCards,
  roomViolations,
  accountMap,
}: SavingsSectionProps) {
  return (
    <CardContent className="p-6 pt-0 space-y-6">
      {/* Contribution Overrides */}
      <div className="space-y-3">
        <span className="text-sm font-semibold text-ds-on-surface">Contribution Overrides</span>
        <div className="space-y-2">
          {state.contributionOverrides.map((row, i) => (
            <div key={i} className="flex items-center gap-2 min-h-[44px] flex-wrap">
              <Select
                value={row.accountId}
                onValueChange={(val) => {
                  setState((prev) => {
                    const rows = [...prev.contributionOverrides];
                    rows[i] = { ...rows[i], accountId: val };
                    return { ...prev, contributionOverrides: rows };
                  });
                  setDirty(true);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountCards.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label} ({a.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Annual Amount $</Label>
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  value={row.annualAmount}
                  onChange={(e) => {
                    setState((prev) => {
                      const rows = [...prev.contributionOverrides];
                      rows[i] = {
                        ...rows[i],
                        annualAmount: numVal(e.target.value, 0),
                      };
                      return { ...prev, contributionOverrides: rows };
                    });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={row.startYear}
                  onChange={(e) => {
                    setState((prev) => {
                      const rows = [...prev.contributionOverrides];
                      rows[i] = {
                        ...rows[i],
                        startYear: numVal(e.target.value, 2025),
                      };
                      return { ...prev, contributionOverrides: rows };
                    });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={row.endYear}
                  onChange={(e) => {
                    setState((prev) => {
                      const rows = [...prev.contributionOverrides];
                      rows[i] = {
                        ...rows[i],
                        endYear: numVal(e.target.value, 2030),
                      };
                      return { ...prev, contributionOverrides: rows };
                    });
                    setDirty(true);
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove"
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    contributionOverrides: prev.contributionOverrides.filter((_, idx) => idx !== i),
                  }));
                  setDirty(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState((prev) => ({
              ...prev,
              contributionOverrides: [
                ...prev.contributionOverrides,
                {
                  accountId: accountCards[0]?.id ?? '',
                  annualAmount: 0,
                  startYear: 2025,
                  endYear: 2030,
                },
              ],
            }));
            setDirty(true);
          }}
        >
          + Add Contribution Override
        </Button>
      </div>

      {/* M005/P4: RRSP over-contribution warning */}
      {roomViolations.length > 0 && (
        <div className="rounded-card border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            RRSP contribution overrides exceed available room
          </p>
          <ul className="mt-2 space-y-1 text-amber-900 dark:text-amber-100">
            {roomViolations.slice(0, 6).map((v, i) => (
              <li key={`${v.accountId}-${v.year}-${i}`}>
                {accountMap.get(v.accountId) ?? 'Account'} · {v.year}: requested{' '}
                {formatCurrency(v.requested)} vs. room {formatCurrency(v.available)}{' '}
                <span className="font-medium">(over by {formatCurrency(v.overage)})</span>
              </li>
            ))}
            {roomViolations.length > 6 && <li>…and {roomViolations.length - 6} more year(s).</li>}
          </ul>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
            Room is 18% of prior-year earned income plus carry-forward, capped at the annual
            statutory maximum — see <code>docs/source-of-truth/02-account-types.md</code> · RRSP
            Contribution Room. Save and re-run the projection to refresh these numbers.
          </p>
        </div>
      )}

      {/* Save Savings */}
      <div className="pt-2">
        <Button
          className="bg-ds-primary text-ds-on-primary rounded-button"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving...' : 'Save Savings'}
        </Button>
        {saveError && (
          <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
        )}
      </div>
    </CardContent>
  );
}
