'use client';

import { useEffect, useState } from 'react';
import { Save, User, Bell, Shield, Palette, Calculator, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { SpouseProfileForm } from '@/components/SpouseProfileForm';
import { api } from '@/lib/api/client';
import {
  readSettingsAssumptions,
  writeSettingsAssumptions,
  SETTINGS_SAFE_ASSUMPTIONS,
} from '@/lib/settings-assumptions';

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
] as const;

type ProvinceCode = (typeof provinces)[number]['code'];
type Theme = 'light' | 'dark' | 'system';
type MaritalStatus = 'single' | 'married' | 'commonLaw' | 'divorced' | 'widowed' | null;

interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  settings: {
    province: ProvinceCode;
    dateOfBirth: string | null;
    gender: string | null;
    maritalStatus: MaritalStatus;
    retirementAge: number | null;
    lifeExpectancy: number | null;
    theme: Theme;
    notificationsEnabled: boolean;
  } | null;
}

interface ProfileFormState {
  firstName: string;
  lastName: string;
  email: string;
  birthdate: string;
  province: ProvinceCode;
  maritalStatus: MaritalStatus;
  retirementAge: number | null;
  lifeExpectancy: number | null;
}

interface PreferenceState {
  theme: Theme;
  emailNotifications: boolean;
}

interface AssumptionState {
  inflationRate: number;
  investmentReturn: number;
  riskProfile: string;
  withdrawalStrategy: string;
}

const defaultProfile: ProfileFormState = {
  firstName: '',
  lastName: '',
  email: '',
  birthdate: '',
  province: 'ON',
  maritalStatus: null,
  retirementAge: null,
  lifeExpectancy: null,
};

const defaultPreferences: PreferenceState = {
  theme: 'system',
  emailNotifications: true,
};

const defaultAssumptions: AssumptionState = SETTINGS_SAFE_ASSUMPTIONS;

function splitName(name: string): Pick<ProfileFormState, 'firstName' | 'lastName'> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName ?? '',
    lastName: rest.join(' '),
  };
}

function joinName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toDateInput(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().split('T')[0] ?? '';
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileFormState>(defaultProfile);
  const [preferences, setPreferences] = useState<PreferenceState>(defaultPreferences);
  const [assumptions, setAssumptions] = useState<AssumptionState>(defaultAssumptions);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSavingAssumptions, setIsSavingAssumptions] = useState(false);

  useEffect(() => {
    void loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const result = await api.get<UserProfileResponse>('/users/me');
      const { firstName, lastName } = splitName(result.data.name);

      setProfile({
        firstName,
        lastName,
        email: result.data.email,
        birthdate: toDateInput(result.data.settings?.dateOfBirth ?? null),
        province: result.data.settings?.province ?? 'ON',
        maritalStatus: result.data.settings?.maritalStatus ?? null,
        retirementAge: result.data.settings?.retirementAge ?? 65,
        lifeExpectancy: result.data.settings?.lifeExpectancy ?? 95,
      });

      setPreferences({
        theme: result.data.settings?.theme ?? 'system',
        emailNotifications: result.data.settings?.notificationsEnabled ?? true,
      });

      setAssumptions(readSettingsAssumptions());
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load settings',
        description: error instanceof Error ? error.message : 'Could not load your account data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);

    try {
      const fullName = joinName(profile.firstName, profile.lastName);

      await api.put('/users/me', {
        name: fullName,
      });

      await api.put('/users/me/settings', {
        province: profile.province,
        dateOfBirth: profile.birthdate || null,
        maritalStatus: profile.maritalStatus,
        retirementAge: profile.retirementAge,
        lifeExpectancy: profile.lifeExpectancy,
      });

      localStorage.setItem('userName', fullName);

      toast({
        title: 'Profile updated',
        description: 'Your profile settings have been saved.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Profile update failed',
        description: error instanceof Error ? error.message : 'Could not save your profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPreferences(true);

    try {
      await api.put('/users/me/settings', {
        theme: preferences.theme,
        notificationsEnabled: preferences.emailNotifications,
      });

      toast({
        title: 'Preferences updated',
        description: 'Your preferences have been saved.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Preferences update failed',
        description: error instanceof Error ? error.message : 'Could not save your preferences.',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleSaveAssumptions = async () => {
    setIsSavingAssumptions(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    writeSettingsAssumptions(assumptions);
    setIsSavingAssumptions(false);

    toast({
      title: 'Assumptions saved',
      description: 'New projections will start with these defaults.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="spouse" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Spouse</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="assumptions" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Assumptions</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and retirement profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={profile.email} disabled readOnly />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birthdate">Date of Birth</Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={profile.birthdate}
                    onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Select
                    value={profile.province}
                    onValueChange={(value: ProvinceCode) =>
                      setProfile({ ...profile, province: value })
                    }
                  >
                    <SelectTrigger id="province">
                      <SelectValue />
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
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Marital Status</Label>
                  <Select
                    value={profile.maritalStatus ?? 'single'}
                    onValueChange={(value: Exclude<MaritalStatus, null>) =>
                      setProfile({ ...profile, maritalStatus: value })
                    }
                  >
                    <SelectTrigger id="maritalStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="commonLaw">Common-Law</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retirementAge">Planned Retirement Age</Label>
                  <Input
                    id="retirementAge"
                    type="number"
                    min={55}
                    max={75}
                    value={profile.retirementAge ?? ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        retirementAge: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lifeExpectancy">Life Expectancy</Label>
                  <Input
                    id="lifeExpectancy"
                    type="number"
                    min={70}
                    max={110}
                    value={profile.lifeExpectancy ?? ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        lifeExpectancy: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spouse" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Spouse Profile</CardTitle>
              <CardDescription>
                Enter your spouse&apos;s information for couple projections and pension splitting
                optimization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpouseProfileForm maritalStatus={profile.maritalStatus} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize how information is displayed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={preferences.theme}
                    onValueChange={(value: Theme) =>
                      setPreferences({ ...preferences, theme: value })
                    }
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePreferences} disabled={isSavingPreferences}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingPreferences ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure email notifications and alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications about your projections.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.emailNotifications}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      emailNotifications: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assumptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Default Assumptions</CardTitle>
              <CardDescription>
                Set default values for new projections. These can be overridden in individual
                projections.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inflationRate">Inflation Rate (%)</Label>
                  <Input
                    id="inflationRate"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={assumptions.inflationRate}
                    onChange={(e) =>
                      setAssumptions({
                        ...assumptions,
                        inflationRate: parseFloat(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Historical average: 2-3%</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentReturn">
                    Nominal Annual Return Before Inflation (%)
                  </Label>
                  <Input
                    id="investmentReturn"
                    type="number"
                    min={0}
                    max={15}
                    step={0.1}
                    value={assumptions.investmentReturn}
                    onChange={(e) =>
                      setAssumptions({
                        ...assumptions,
                        investmentReturn: parseFloat(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Balanced portfolio average: 5-6%</p>
                  {Number.isFinite(assumptions.investmentReturn) &&
                    Number.isFinite(assumptions.inflationRate) && (
                      <p className="text-xs text-muted-foreground">
                        ≈ {(assumptions.investmentReturn - assumptions.inflationRate).toFixed(1)}%
                        real return after {assumptions.inflationRate.toFixed(1)}% inflation
                      </p>
                    )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="riskProfile">Risk Profile</Label>
                  <Select
                    value={assumptions.riskProfile}
                    onValueChange={(value) =>
                      setAssumptions({ ...assumptions, riskProfile: value })
                    }
                  >
                    <SelectTrigger id="riskProfile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">
                        Conservative (4% return, low risk)
                      </SelectItem>
                      <SelectItem value="balanced">
                        Balanced (5.5% return, moderate risk)
                      </SelectItem>
                      <SelectItem value="growth">Growth (7% return, higher risk)</SelectItem>
                      <SelectItem value="aggressive">Aggressive (8% return, high risk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdrawalStrategy">Withdrawal Strategy</Label>
                  <Select
                    value={assumptions.withdrawalStrategy}
                    onValueChange={(value) =>
                      setAssumptions({
                        ...assumptions,
                        withdrawalStrategy: value,
                      })
                    }
                  >
                    <SelectTrigger id="withdrawalStrategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (Non-registered first)</SelectItem>
                      <SelectItem value="tfsaFirst">TFSA First (Minimize OAS clawback)</SelectItem>
                      <SelectItem value="taxOptimized">Tax Optimized (Fill brackets)</SelectItem>
                      <SelectItem value="rrspMeltdown">
                        RRSP Meltdown (Reduce RRIF income)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveAssumptions} disabled={isSavingAssumptions}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingAssumptions ? 'Saving...' : 'Save Assumptions'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input id="confirmPassword" type="password" />
              </div>
              <div className="flex justify-end">
                <Button disabled>Update Password</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions for your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data.
                  </p>
                </div>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
