'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';
import { ChevronRight, ChevronLeft, RefreshCw, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileSaveIndicator } from './ProfileSaveIndicator';
import { ProfileStepperSidebar } from './ProfileStepperSidebar';
import {
  ALL_STEPS,
  EMPTY_PROFILE_DEFAULTS,
  type IncomeCard,
  type AccountCard,
  type DebtCard,
  type PensionCard,
  type PropertyCard,
  type GoalCard,
  type SaveState,
  type StepConfig,
} from './lib/profile-constants';
import { useRouter } from 'next/navigation';
import {
  getProfile,
  patchProfileStep,
  runProjectionFromProfile,
  type ProfileData,
  type StepSlug,
} from '@/lib/api/profile';
import { AboutYouStep } from '@/components/profile/steps/AboutYouStep';
import { SpouseStep } from '@/components/profile/steps/SpouseStep';
import { IncomeStep } from '@/components/profile/steps/IncomeStep';
import { SpendingStep } from '@/components/profile/steps/SpendingStep';
import { AccountsStep } from '@/components/profile/steps/AccountsStep';
import { DebtsStep } from '@/components/profile/steps/DebtsStep';
import { BenefitsStep } from '@/components/profile/steps/BenefitsStep';
import { GovernmentPensionsStep } from '@/components/profile/steps/GovernmentPensionsStep';
import { PropertyGoalsStep } from '@/components/profile/steps/PropertyGoalsStep';
import {
  fillBlankAssumption,
  getWizardAssumptionDefaults,
  type WizardAssumptionDefaults,
} from '@/lib/settings-assumptions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileFormValues = typeof EMPTY_PROFILE_DEFAULTS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillAccountAssumptionDefaults(
  accounts: AccountCard[],
  defaults: WizardAssumptionDefaults
): AccountCard[] {
  return accounts.map((account) => ({
    ...account,
    expectedReturn: String(
      fillBlankAssumption(account.expectedReturn, defaults.investmentReturnRate)
    ),
  }));
}

function fillPensionAssumptionDefaults(
  benefits: typeof EMPTY_PROFILE_DEFAULTS.benefits,
  defaults: WizardAssumptionDefaults
): typeof EMPTY_PROFILE_DEFAULTS.benefits {
  return {
    ...benefits,
    pensions: benefits.pensions.map((pension) => ({
      ...pension,
      ...(pension.type === 'DC Pension'
        ? {
            expectedReturn: fillBlankAssumption(
              pension.expectedReturn,
              defaults.investmentReturnRate
            ).toString(),
          }
        : {}),
      ...(pension.type === 'DB Pension'
        ? { indexingRate: String(fillBlankAssumption(pension.indexingRate, defaults.indexingRate)) }
        : {}),
    })),
  };
}

export function mapProfileToForm(
  profile: ProfileData,
  defaults: WizardAssumptionDefaults = getWizardAssumptionDefaults()
): ProfileFormValues {
  const stepData = profile.stepData ?? {};
  const aboutYou =
    typeof stepData['about_you'] === 'object' && stepData['about_you'] !== null
      ? (stepData['about_you'] as Partial<typeof EMPTY_PROFILE_DEFAULTS.about_you>)
      : {};
  const spendingRaw =
    typeof stepData['spending'] === 'object' && stepData['spending'] !== null
      ? (stepData['spending'] as Partial<typeof EMPTY_PROFILE_DEFAULTS.spending>)
      : {};
  const legacyPropertyGoals =
    typeof stepData['property_goals'] === 'object' && stepData['property_goals'] !== null
      ? (stepData['property_goals'] as { retirementSpending?: number | string })
      : {};
  const legacyRetirementSpending =
    legacyPropertyGoals.retirementSpending !== undefined &&
    legacyPropertyGoals.retirementSpending !== '' &&
    Number.isFinite(Number(legacyPropertyGoals.retirementSpending))
      ? Number(legacyPropertyGoals.retirementSpending)
      : undefined;
  const benefits =
    typeof stepData['benefits'] === 'object' && stepData['benefits'] !== null
      ? {
          ...EMPTY_PROFILE_DEFAULTS.benefits,
          ...(stepData['benefits'] as {
            cpp_primary?: {
              estimatedAnnual: string;
              survivorsPensionEnabled: boolean;
              survivorsPensionAmount: string;
            };
            oas_primary?: { estimatedAnnual: string; residencyYears: string };
            cpp_spouse?: {
              estimatedAnnual: string;
              survivorsPensionEnabled: boolean;
              survivorsPensionAmount: string;
            };
            oas_spouse?: { estimatedAnnual: string; residencyYears: string };
            pensions?: PensionCard[];
          }),
        }
      : EMPTY_PROFILE_DEFAULTS.benefits;

  const governmentPensions =
    typeof stepData['government_pensions'] === 'object' && stepData['government_pensions'] !== null
      ? {
          ...EMPTY_PROFILE_DEFAULTS.government_pensions,
          ...(stepData['government_pensions'] as Partial<
            typeof EMPTY_PROFILE_DEFAULTS.government_pensions
          >),
        }
      : EMPTY_PROFILE_DEFAULTS.government_pensions;

  return {
    about_you: {
      ...EMPTY_PROFILE_DEFAULTS.about_you,
      ...aboutYou,
      inflationRate: fillBlankAssumption(aboutYou.inflationRate, defaults.inflationRate) as number,
      investmentReturnRate: fillBlankAssumption(
        aboutYou.investmentReturnRate,
        defaults.investmentReturnRate
      ) as number,
    },
    spouse: {
      ...EMPTY_PROFILE_DEFAULTS.spouse,
      ...(typeof stepData['spouse'] === 'object' && stepData['spouse'] !== null
        ? (stepData['spouse'] as Partial<typeof EMPTY_PROFILE_DEFAULTS.spouse>)
        : {}),
    },
    income: Array.isArray(stepData['income']) ? (stepData['income'] as IncomeCard[]) : [],
    spending: {
      ...EMPTY_PROFILE_DEFAULTS.spending,
      ...spendingRaw,
      retirementAnnualSpending: spendingRaw.retirementAnnualSpending ?? legacyRetirementSpending,
    },
    accounts: Array.isArray(stepData['accounts'])
      ? fillAccountAssumptionDefaults(stepData['accounts'] as AccountCard[], defaults)
      : [],
    debts: Array.isArray(stepData['debts']) ? (stepData['debts'] as DebtCard[]) : [],
    benefits: fillPensionAssumptionDefaults(benefits, defaults),
    government_pensions: governmentPensions,
    property_goals:
      typeof stepData['property_goals'] === 'object' && stepData['property_goals'] !== null
        ? {
            ...EMPTY_PROFILE_DEFAULTS.property_goals,
            ...(stepData['property_goals'] as {
              properties?: PropertyCard[];
              goals?: GoalCard[];
              legacy?: { enabled: boolean; targetAmount: string };
            }),
          }
        : EMPTY_PROFILE_DEFAULTS.property_goals,
  };
}

function getStepSlugForField(fieldName: string): StepSlug | null {
  if (fieldName.startsWith('about_you.') || fieldName === 'about_you') return 'about_you';
  if (fieldName.startsWith('spouse.') || fieldName === 'spouse') return 'spouse';
  if (fieldName.startsWith('income') || fieldName === 'income') return 'income';
  if (fieldName.startsWith('spending') || fieldName === 'spending') return 'spending';
  if (fieldName.startsWith('accounts') || fieldName === 'accounts') return 'accounts';
  if (fieldName.startsWith('debts') || fieldName === 'debts') return 'debts';
  if (fieldName.startsWith('benefits') || fieldName === 'benefits') return 'benefits';
  if (fieldName.startsWith('government_pensions') || fieldName === 'government_pensions')
    return 'government_pensions';
  if (fieldName.startsWith('property_goals') || fieldName === 'property_goals')
    return 'property_goals';
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileWizardShell() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const methods = useForm<ProfileFormValues>({
    defaultValues: EMPTY_PROFILE_DEFAULTS,
    mode: 'onChange',
  });

  const includeSpouse = methods.watch('about_you.includeSpouse');

  const activeSteps: StepConfig[] = useMemo(
    () => (includeSpouse ? ALL_STEPS : ALL_STEPS.filter((s) => s.id !== 'spouse')),
    [includeSpouse]
  );

  // Clamp step index when spouse step disappears
  useEffect(() => {
    if (!includeSpouse) {
      setCurrentStepIndex((s) => {
        const clamped = Math.min(s, activeSteps.length - 1);
        return clamped;
      });
    }
  }, [includeSpouse, activeSteps.length]);

  // Load profile on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        if (profile !== null) {
          const formValues = mapProfileToForm(profile);
          methods.reset(formValues);
          const resumeIndex = Math.min(profile.currentStep, ALL_STEPS.length - 1);
          setCurrentStepIndex(resumeIndex);
          setVisitedSteps(new Set(Array.from({ length: resumeIndex + 1 }, (_, i) => i)));
        } else {
          methods.reset(
            mapProfileToForm({
              id: '',
              userId: '',
              stepData: {},
              currentStep: 0,
              createdAt: '',
              updatedAt: '',
            })
          );
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [methods]);

  // Auto-save: debounced callback
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useDebouncedCallback(
    async (slug: StepSlug, data: unknown, stepIndex: number) => {
      setSaveState('saving');
      try {
        await patchProfileStep(slug, data, stepIndex);
        setSaveState('saved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveState('idle'), 3000);
      } catch {
        setSaveState('error');
      }
    },
    800
  );

  // Watch subscription — fires on any field change
  useEffect(() => {
    const subscription = methods.watch((formValues, { name }) => {
      if (!name) return;
      const slug = getStepSlugForField(name);
      if (!slug) return;

      const currentStepConfig = activeSteps[currentStepIndex];
      if (!currentStepConfig) return;

      // Guard: don't save spouse step if spouse is toggled off
      if (slug === 'spouse' && !formValues.about_you?.includeSpouse) return;

      // Only save if the changed field belongs to the current step
      if (slug !== currentStepConfig.slug) return;

      const stepData =
        slug === 'about_you'
          ? formValues.about_you
          : slug === 'spouse'
            ? formValues.spouse
            : slug === 'income'
              ? formValues.income
              : slug === 'spending'
                ? formValues.spending
                : slug === 'accounts'
                  ? formValues.accounts
                  : slug === 'debts'
                    ? formValues.debts
                    : slug === 'benefits'
                      ? formValues.benefits
                      : slug === 'government_pensions'
                        ? formValues.government_pensions
                        : slug === 'property_goals'
                          ? formValues.property_goals
                          : null;

      if (stepData) {
        void debouncedSave(slug, stepData, currentStepIndex);
      }
    });

    return () => subscription.unsubscribe();
  }, [methods, activeSteps, currentStepIndex, debouncedSave]);

  // Navigation
  const navigateToStep = useCallback(
    (targetIndex: number) => {
      // D-05: Cancel pending debounce to prevent out-of-order writes
      debouncedSave.cancel();

      // D-03: Capture current step's live form values before state update
      const currentSlug = activeSteps[currentStepIndex]?.slug as StepSlug | undefined;
      if (currentSlug) {
        const stepData = methods.getValues(currentSlug as keyof ProfileFormValues);
        // D-01/D-04: Fire bootstrap PATCH with target step index
        // D-07: Silent fire-and-forget — navigation continues regardless
        void patchProfileStep(currentSlug, stepData, targetIndex).catch(() => {
          // Silent: bootstrap failures are non-blocking per D-07
        });
      }

      setCurrentStepIndex(targetIndex);
      setVisitedSteps((prev) => new Set([...prev, targetIndex]));
    },
    [activeSteps, currentStepIndex, debouncedSave, methods]
  );

  const handleNext = useCallback(() => {
    if (currentStepIndex < activeSteps.length - 1) {
      navigateToStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, activeSteps.length, navigateToStep]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      navigateToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, navigateToStep]);

  const handleStepClick = useCallback(
    (index: number) => {
      navigateToStep(index);
    },
    [navigateToStep]
  );

  const handleRunProjection = useCallback(async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const projection = await runProjectionFromProfile();
      router.push(`/projections/${projection.id}`);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to run projection');
      setIsRunning(false);
    }
  }, [router]);

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ds-background">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ds-background">
        <p className="text-sm text-destructive">
          Unable to load your profile. Please refresh the page.
        </p>
      </div>
    );
  }

  const currentStepConfig = activeSteps[currentStepIndex];

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-full min-h-screen">
        {/* Minimal header */}
        <header className="h-14 bg-ds-surface border-b border-ds-outline-variant flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-ds-primary flex items-center justify-center">
              <span className="text-ds-on-primary font-bold text-base">R</span>
            </div>
            <span className="font-bold text-lg text-ds-on-background">RetireOps</span>
          </div>
          <ProfileSaveIndicator saveState={saveState} />
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Stepper (handles both desktop sidebar and mobile dots) */}
          <ProfileStepperSidebar
            steps={activeSteps}
            currentStepIndex={currentStepIndex}
            visitedSteps={visitedSteps}
            onStepClick={handleStepClick}
          />

          {/* Content area */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="max-w-2xl mx-auto px-8 py-8 flex-1 w-full">
              {/* Step heading */}
              <h1 className="text-[20px] font-bold text-ds-on-background">
                {currentStepConfig.label}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{currentStepConfig.description}</p>

              {/* Step content */}
              <div className="mt-8">
                {/* About You step */}
                {currentStepConfig.id === 'about-you' && <AboutYouStep />}

                {/* Spouse step — always mounted (mount-but-hide per D-14) so RHF registrations persist */}
                <div
                  style={{
                    display:
                      currentStepConfig.id === 'spouse' && includeSpouse ? undefined : 'none',
                  }}
                  aria-hidden={currentStepConfig.id !== 'spouse' || !includeSpouse}
                >
                  <SpouseStep />
                </div>

                {/* Income step */}
                {currentStepConfig.id === 'income' && <IncomeStep />}

                {/* Spending step */}
                {currentStepConfig.id === 'spending' && <SpendingStep />}

                {/* Accounts step */}
                {currentStepConfig.id === 'accounts' && <AccountsStep />}

                {/* Debts step */}
                {currentStepConfig.id === 'debts' && <DebtsStep />}

                {/* Benefits step */}
                {currentStepConfig.id === 'benefits' && <BenefitsStep />}

                {/* Government Pensions step (v4.7 WIZ-03) */}
                {currentStepConfig.id === 'government-pensions' && <GovernmentPensionsStep />}

                {/* Property & Goals step */}
                {currentStepConfig.id === 'property-goals' && <PropertyGoalsStep />}

                {/* All other steps — placeholder */}
                {currentStepConfig.id !== 'about-you' &&
                  currentStepConfig.id !== 'spouse' &&
                  currentStepConfig.id !== 'income' &&
                  currentStepConfig.id !== 'spending' &&
                  currentStepConfig.id !== 'accounts' &&
                  currentStepConfig.id !== 'debts' &&
                  currentStepConfig.id !== 'benefits' &&
                  currentStepConfig.id !== 'government-pensions' &&
                  currentStepConfig.id !== 'property-goals' && (
                    <div className="py-12 text-center text-muted-foreground">Coming soon</div>
                  )}
              </div>
            </div>

            {/* Run Projection error */}
            {runError && (
              <div className="mx-8 mb-2 p-3 rounded-md bg-red-50 border border-ds-error text-sm text-ds-error">
                {runError}
              </div>
            )}

            {/* Footer nav */}
            <div className="flex items-center justify-between px-8 py-4 border-t border-ds-outline-variant bg-ds-surface shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className="border-ds-outline-variant hover:bg-ds-surface-raised"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              {currentStepIndex === activeSteps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => void handleRunProjection()}
                  disabled={isRunning}
                  className="bg-ds-primary text-ds-on-primary rounded-button"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      Run Projection
                      <Play className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-ds-primary text-ds-on-primary rounded-button"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
