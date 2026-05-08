import { api } from '@/lib/api/client';
import type {
  ProfileScenarioListItem,
  ProfileScenarioDetail,
  ScenarioDecisionsPatch,
} from '@/types/profile-scenario';
import type { ScenarioComparison } from '@/types/scenario';

export async function listProfileScenarios(): Promise<ProfileScenarioListItem[]> {
  const result = await api.get<ProfileScenarioListItem[]>('/profile/scenarios');
  return result.data;
}

export async function createProfileScenario(name: string): Promise<ProfileScenarioListItem> {
  const result = await api.post<ProfileScenarioListItem>('/profile/scenarios', { name });
  return result.data;
}

export async function cloneProfileScenario(id: string): Promise<ProfileScenarioListItem> {
  const result = await api.post<ProfileScenarioListItem>(`/profile/scenarios/${id}/clone`);
  return result.data;
}

export async function renameProfileScenario(
  id: string,
  name: string
): Promise<ProfileScenarioListItem> {
  const result = await api.patch<ProfileScenarioListItem>(`/profile/scenarios/${id}`, { name });
  return result.data;
}

export async function deleteProfileScenario(id: string): Promise<void> {
  await api.delete<undefined>(`/profile/scenarios/${id}`);
}

export async function getProfileScenario(id: string): Promise<ProfileScenarioDetail> {
  const result = await api.get<ProfileScenarioDetail>(`/profile/scenarios/${id}`);
  return result.data;
}

export async function updateDecisions(
  id: string,
  patch: ScenarioDecisionsPatch,
  options?: { signal?: AbortSignal }
): Promise<void> {
  await api.put<undefined>(`/profile/scenarios/${id}/decisions`, patch, options);
}

export async function runProfileScenario(
  id: string,
  options?: { signal?: AbortSignal }
): Promise<ProfileScenarioDetail> {
  const result = await api.post<ProfileScenarioDetail>(
    `/profile/scenarios/${id}/run`,
    undefined,
    options
  );
  return result.data;
}

export interface ProfileScenarioPreview {
  decisions: ScenarioDecisionsPatch;
  result_data: Record<string, unknown>;
}

export async function previewProfileScenarioDecisions(
  id: string,
  patch: ScenarioDecisionsPatch,
  options?: { signal?: AbortSignal }
): Promise<ProfileScenarioPreview> {
  const result = await api.post<ProfileScenarioPreview>(
    `/profile/scenarios/${id}/preview-decisions`,
    patch,
    options
  );
  return result.data;
}

export async function compareProfileScenarios(ids: string[]): Promise<ScenarioComparison> {
  const result = await api.post<ScenarioComparison>('/profile/scenarios/compare', { ids });
  return result.data;
}

export interface ScenarioDecisionTemplateSummary {
  id: string;
  name: string;
  description: string;
}

export async function listScenarioTemplates(): Promise<ScenarioDecisionTemplateSummary[]> {
  const result = await api.get<ScenarioDecisionTemplateSummary[]>('/profile/scenarios/templates');
  return result.data;
}

export async function createProfileScenarioFromTemplate(
  templateId: string,
  name: string
): Promise<ProfileScenarioListItem> {
  const result = await api.post<ProfileScenarioListItem>('/profile/scenarios/from-template', {
    templateId,
    name,
  });
  return result.data;
}
