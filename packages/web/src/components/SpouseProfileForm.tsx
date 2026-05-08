/**
 * SpouseProfileForm Component
 * @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
 *
 * Form for entering and editing spouse profile information.
 * Displays when marital status is 'married' or 'commonLaw'.
 */
'use client';
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api/client';

const provinces = [
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

export interface SpouseSettings {
  dateOfBirth: string | null;
  lifeExpectancy: number | null;
  retirementAge: number | null;
  province: string | null;
  expectedCppAt65: number | null;
  cppStartAge: number | null;
  oasStartAge: number | null;
  yearsOfResidence: number | null;
  employmentIncome: number | null;
  employmentGrowthRate: number | null;
  // Account balances
  rrspBalance: number | null;
  tfsaBalance: number | null;
}

interface SpouseProfileFormProps {
  maritalStatus: string | null;
}

export function SpouseProfileForm({ maritalStatus }: SpouseProfileFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [spouse, setSpouse] = useState<SpouseSettings>({
    dateOfBirth: null,
    lifeExpectancy: null,
    retirementAge: null,
    province: null,
    expectedCppAt65: null,
    cppStartAge: null,
    oasStartAge: null,
    yearsOfResidence: null,
    employmentIncome: null,
    employmentGrowthRate: null,
    rrspBalance: null,
    tfsaBalance: null,
  });

  const isMarriedOrCommonLaw = maritalStatus === 'married' || maritalStatus === 'commonLaw';

  useEffect(() => {
    if (isMarriedOrCommonLaw) {
      loadSpouseSettings();
    } else {
      setIsLoading(false);
    }
  }, [isMarriedOrCommonLaw]);

  const loadSpouseSettings = async () => {
    try {
      const result = await api.get<SpouseSettings | null>('/users/me/spouse');
      if (result.data) {
        setSpouse({
          ...result.data,
          dateOfBirth: result.data.dateOfBirth
            ? new Date(result.data.dateOfBirth).toISOString().split('T')[0]
            : null,
        });
      }
    } catch (error) {
      console.error('Failed to load spouse settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/users/me/spouse', {
        dateOfBirth: spouse.dateOfBirth || null,
        lifeExpectancy: spouse.lifeExpectancy,
        retirementAge: spouse.retirementAge,
        province: spouse.province,
        expectedCppAt65: spouse.expectedCppAt65,
        cppStartAge: spouse.cppStartAge,
        oasStartAge: spouse.oasStartAge,
        yearsOfResidence: spouse.yearsOfResidence,
        employmentIncome: spouse.employmentIncome,
        employmentGrowthRate: spouse.employmentGrowthRate
          ? spouse.employmentGrowthRate / 100
          : null,
      });
      toast({
        title: 'Spouse profile updated',
        description: "Your spouse's information has been saved.",
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save spouse profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/users/me/spouse');
      setSpouse({
        dateOfBirth: null,
        lifeExpectancy: null,
        retirementAge: null,
        province: null,
        expectedCppAt65: null,
        cppStartAge: null,
        oasStartAge: null,
        yearsOfResidence: null,
        employmentIncome: null,
        employmentGrowthRate: null,
        rrspBalance: null,
        tfsaBalance: null,
      });
      setShowDeleteConfirm(false);
      toast({
        title: 'Spouse profile removed',
        description: "Your spouse's information has been deleted.",
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete spouse profile',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isMarriedOrCommonLaw) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Spouse profile is only available for married or common-law status.</p>
        <p className="text-sm mt-2">
          Update your marital status in the Profile tab to enable spouse settings.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Demographics */}
      <div>
        <h3 className="text-lg font-medium mb-4">Basic Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spouse-dob">Date of Birth</Label>
            <Input
              id="spouse-dob"
              type="date"
              value={spouse.dateOfBirth || ''}
              onChange={(e) => setSpouse({ ...spouse, dateOfBirth: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-province">Province of Residence</Label>
            <Select
              value={spouse.province || ''}
              onValueChange={(value) => setSpouse({ ...spouse, province: value || null })}
            >
              <SelectTrigger id="spouse-province">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((province) => (
                  <SelectItem key={province.code} value={province.code}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-retirement-age">Planned Retirement Age</Label>
            <Input
              id="spouse-retirement-age"
              type="number"
              min={55}
              max={75}
              value={spouse.retirementAge || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  retirementAge: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-life-expectancy">Life Expectancy</Label>
            <Input
              id="spouse-life-expectancy"
              type="number"
              min={70}
              max={110}
              value={spouse.lifeExpectancy || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  lifeExpectancy: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Employment */}
      <div>
        <h3 className="text-lg font-medium mb-4">Employment</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spouse-employment-income">Current Annual Employment Income</Label>
            <Input
              id="spouse-employment-income"
              type="number"
              min={0}
              placeholder="0"
              value={spouse.employmentIncome || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  employmentIncome: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-employment-growth">Expected Annual Salary Growth (%)</Label>
            <Input
              id="spouse-employment-growth"
              type="number"
              min={-10}
              max={20}
              step={0.1}
              placeholder="2.5"
              value={spouse.employmentGrowthRate !== null ? spouse.employmentGrowthRate * 100 : ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  employmentGrowthRate: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Government Benefits */}
      <div>
        <h3 className="text-lg font-medium mb-4">Government Benefits (CPP/OAS)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spouse-cpp-amount">Expected CPP at Age 65 (annual)</Label>
            <Input
              id="spouse-cpp-amount"
              type="number"
              min={0}
              max={20000}
              placeholder="8000"
              value={spouse.expectedCppAt65 || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  expectedCppAt65: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
            <p className="text-xs text-muted-foreground">Max CPP in 2024 is ~$16,400/year</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-cpp-start">CPP Start Age</Label>
            <Input
              id="spouse-cpp-start"
              type="number"
              min={60}
              max={70}
              placeholder="65"
              value={spouse.cppStartAge || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  cppStartAge: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            <p className="text-xs text-muted-foreground">Early: 60 (-36%), Late: 70 (+42%)</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-oas-start">OAS Start Age</Label>
            <Input
              id="spouse-oas-start"
              type="number"
              min={65}
              max={70}
              placeholder="65"
              value={spouse.oasStartAge || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  oasStartAge: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            <p className="text-xs text-muted-foreground">Deferring increases OAS by 0.6%/month</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-years-residence">Years of Canadian Residence</Label>
            <Input
              id="spouse-years-residence"
              type="number"
              min={0}
              max={50}
              placeholder="40"
              value={spouse.yearsOfResidence || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  yearsOfResidence: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            <p className="text-xs text-muted-foreground">40 years required for full OAS</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Account Balances */}
      <div>
        <h3 className="text-lg font-medium mb-4">Account Balances</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spouse-rrsp">RRSP Balance</Label>
            <Input
              id="spouse-rrsp"
              type="number"
              min={0}
              placeholder="0"
              value={spouse.rrspBalance || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  rrspBalance: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spouse-tfsa">TFSA Balance</Label>
            <Input
              id="spouse-tfsa"
              type="number"
              min={0}
              placeholder="0"
              value={spouse.tfsaBalance || ''}
              onChange={(e) =>
                setSpouse({
                  ...spouse,
                  tfsaBalance: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Are you sure?</span>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Removing...' : 'Yes, Remove'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting || !spouse.dateOfBirth}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Spouse
          </Button>
        )}

        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Spouse Profile'}
        </Button>
      </div>
    </div>
  );
}
