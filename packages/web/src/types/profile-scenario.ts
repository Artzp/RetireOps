export type ProfileScenarioStatus = 'pending' | 'stale' | 'completed' | 'failed';

export interface ProfileScenarioListItem {
  id: string;
  name: string;
  is_base: boolean;
  status: ProfileScenarioStatus;
  calculated_at: string | null;
  decisions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProfileScenarioDetail extends ProfileScenarioListItem {
  profile_id: string;
  result_data: Record<string, unknown> | null;
}

// ScenarioDecisions shape for frontend — mirrors @retireops/shared ScenarioDecisions
// The frontend sends partial objects to PUT /decisions; validation happens server-side.
export type ScenarioDecisionsPatch = Record<string, unknown>;
