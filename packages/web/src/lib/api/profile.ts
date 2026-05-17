import { api } from '@/lib/api/client';

export interface ProfileStepData {
  [key: string]: unknown;
}

export interface ProfileData {
  id: string;
  userId: string;
  stepData: ProfileStepData;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export type StepSlug =
  | 'about_you'
  | 'spouse'
  | 'income'
  | 'spending'
  | 'accounts'
  | 'debts'
  | 'benefits'
  | 'government_pensions'
  | 'property_goals';

export async function getProfile(): Promise<ProfileData | null> {
  try {
    const result = await api.get<ProfileData>('/profile');
    return result.data;
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('not found')) return null;
    throw err;
  }
}

export async function patchProfileStep(
  step: StepSlug,
  data: unknown,
  currentStep: number
): Promise<ProfileData> {
  const result = await api.patch<ProfileData>(`/profile/${step}`, {
    currentStep,
    data,
  });
  return result.data;
}

export interface ProjectionDetail {
  id: string;
  name: string;
  status: string;
  // Allow additional fields from the API response
  [key: string]: unknown;
}

export async function runProjectionFromProfile(): Promise<ProjectionDetail> {
  const result = await api.post<ProjectionDetail>('/profile/calculate');
  return result.data;
}
