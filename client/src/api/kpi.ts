import axiosClient from './client';

/**
 * The PS Score half of the performance model. The AT Score lives in
 * `scoring.ts` and `hod-score.ts`, and the two are never merged into one
 * number, here or anywhere else.
 *
 * Field names are snake_case because the KPI tables and DTOs are. Sending a
 * camelCase key is a 400, not a field the server ignores.
 */

export type KpiScope = 'INDIVIDUAL' | 'DEPARTMENT' | 'PROJECT';
export type KpiMode = 'QUANTITATIVE' | 'BINARY' | 'MILESTONE' | 'RATING';
export type KpiDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'EXACT_TARGET';
export type KpiScoringMethod = 'DIRECT' | 'THRESHOLD' | 'RATING' | 'MILESTONE';
export type KpiPeriod = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export type KpiStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'EVALUATED'
  | 'FINALIZED'
  | 'LOCKED'
  | 'CANCELLED';

/** Phase 2 tables carry plain FK columns, so the server resolves them with
 * `attachUsers` and returns a sibling `<column>_user` property. */
export interface KpiUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

export interface KpiUnit {
  code: string;
  label: string;
  symbol: string;
  group: string;
}

export interface ThresholdBand {
  min_achievement: number;
  score: number;
}

export interface KpiScoringConfig {
  bands?: ThresholdBand[];
  below_band_score?: number;
  rating_scores?: number[];
  max_rating?: number;
  cap_at?: number;
}

export interface Kpi {
  id: string;
  scope: KpiScope;
  owner_user_id: string | null;
  department_id: string | null;
  project_id: string | null;
  name: string;
  description: string | null;
  mode: KpiMode;
  unit_label: string | null;
  unit_symbol: string | null;
  target_value: string | null;
  baseline_value: string | null;
  direction: KpiDirection | null;
  scoring_method: KpiScoringMethod;
  scoring_config: KpiScoringConfig | null;
  weight: string;
  period: KpiPeriod;
  period_start: string;
  period_end: string;
  evidence_required: boolean;
  review_required: boolean;
  status: KpiStatus;
  created_by_id: string;
  approved_by_id: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  locked_at: string | null;
  created_at: string;
  owner_user_id_user?: KpiUser | null;
  created_by_id_user?: KpiUser | null;
}

export interface KpiMilestone {
  id: string;
  kpi_id: string;
  title: string;
  weight: string;
  sequence: number;
  completed_at: string | null;
  completed_by_id: string | null;
}

export interface KpiContribution {
  id: string;
  kpi_id: string;
  user_id: string;
  share: string;
  user_id_user?: KpiUser | null;
}

export interface KpiUpdate {
  id: string;
  kpi_id: string;
  actual_value: string | null;
  binary_done: boolean | null;
  rating: number | null;
  remarks: string | null;
  evidence_url: string | null;
  entered_by_id: string;
  created_at: string;
  entered_by_id_user?: KpiUser | null;
}

export interface KpiRevision {
  id: string;
  kpi_id: string;
  old_target: string | null;
  new_target: string | null;
  old_weight: string | null;
  new_weight: string | null;
  effective_from: string;
  reason: string;
  changed_by_id: string;
  created_at: string;
  changed_by_id_user?: KpiUser | null;
}

/** Achievement and score are separate numbers on purpose: 80% achievement is
 * 80 under DIRECT and can be 100 under a threshold band. */
export interface KpiMeasurement {
  actual_value: number | null;
  rating: number | null;
  achievement: number | null;
  score: number | null;
}

export interface KpiDetail extends Kpi, KpiMeasurement {
  milestones: KpiMilestone[];
  contributions: KpiContribution[];
  updates: KpiUpdate[];
  revisions: KpiRevision[];
}

export interface PsScoreLine extends KpiMeasurement {
  id: string;
  name: string;
  scope: KpiScope;
  mode: KpiMode;
  status: KpiStatus;
  unit_label: string | null;
  unit_symbol: string | null;
  target_value: number | null;
  weight: number;
  effective_weight: number;
  contribution_share: number;
  contribution: number | null;
  counted: boolean;
}

export interface PsScore {
  user_id: string;
  month: number;
  year: number;
  ps_score: number;
  /** Weight that actually produced the score. Below `declared_weight` when a
   * KPI was cancelled or has no update yet. */
  counted_weight: number;
  /** Weight of every live KPI. Not 100 means the set is incomplete. */
  declared_weight: number;
  kpis: PsScoreLine[];
}

export interface KpiFilters {
  scope?: KpiScope;
  status?: KpiStatus;
  owner_user_id?: string;
  department_id?: string;
  project_id?: string;
  month?: number;
  year?: number;
}

export interface KpiMilestonePayload {
  title: string;
  weight: number;
}

export interface KpiContributionPayload {
  user_id: string;
  share: number;
}

export interface CreateKpiPayload {
  scope: KpiScope;
  owner_user_id?: string;
  department_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  mode: KpiMode;
  unit_label?: string;
  unit_symbol?: string;
  target_value?: number;
  baseline_value?: number;
  direction?: KpiDirection;
  scoring_method: KpiScoringMethod;
  scoring_config?: KpiScoringConfig;
  weight: number;
  period: KpiPeriod;
  period_start: string;
  period_end: string;
  evidence_required?: boolean;
  review_required?: boolean;
  milestones?: KpiMilestonePayload[];
  contributions?: KpiContributionPayload[];
}

export type UpdateKpiPayload = Partial<
  Omit<
    CreateKpiPayload,
    'scope' | 'mode' | 'owner_user_id' | 'department_id' | 'project_id' | 'scoring_method' | 'milestones' | 'contributions'
  >
>;

export interface ChangeKpiStatusPayload {
  status: KpiStatus;
  reason?: string;
}

export interface RecordKpiUpdatePayload {
  actual_value?: number;
  binary_done?: boolean;
  rating?: number;
  remarks?: string;
  evidence_url?: string;
}

export interface SetKpiContributionsPayload {
  contributions: KpiContributionPayload[];
}

export interface CreateKpiRevisionPayload {
  new_target?: number;
  new_weight?: number;
  effective_from: string;
  reason: string;
}

export const kpiApi = {
  searchUnits: async (query: string): Promise<KpiUnit[]> => {
    const response = await axiosClient.get<KpiUnit[]>('/kpis/units', {
      params: { q: query },
    });
    return response.data;
  },

  getMyPsScore: async (month?: number, year?: number): Promise<PsScore> => {
    const response = await axiosClient.get<PsScore>('/kpis/ps-score', {
      params: { month, year },
    });
    return response.data;
  },

  getPsScoreFor: async (userId: string, month?: number, year?: number): Promise<PsScore> => {
    const response = await axiosClient.get<PsScore>(`/kpis/ps-score/${userId}`, {
      params: { month, year },
    });
    return response.data;
  },

  getKpis: async (filters: KpiFilters): Promise<Kpi[]> => {
    const response = await axiosClient.get<Kpi[]>('/kpis', {
      params: {
        scope: filters.scope,
        status: filters.status,
        owner_user_id: filters.owner_user_id,
        department_id: filters.department_id,
        project_id: filters.project_id,
        month: filters.month,
        year: filters.year,
      },
    });
    return response.data;
  },

  getKpi: async (id: string): Promise<KpiDetail> => {
    const response = await axiosClient.get<KpiDetail>(`/kpis/${id}`);
    return response.data;
  },

  createKpi: async (payload: CreateKpiPayload): Promise<Kpi> => {
    const response = await axiosClient.post<Kpi>('/kpis', payload);
    return response.data;
  },

  updateKpi: async (id: string, payload: UpdateKpiPayload): Promise<Kpi> => {
    const response = await axiosClient.patch<Kpi>(`/kpis/${id}`, payload);
    return response.data;
  },

  changeStatus: async (id: string, payload: ChangeKpiStatusPayload): Promise<Kpi> => {
    const response = await axiosClient.patch<Kpi>(`/kpis/${id}/status`, payload);
    return response.data;
  },

  recordUpdate: async (id: string, payload: RecordKpiUpdatePayload): Promise<KpiUpdate> => {
    const response = await axiosClient.post<KpiUpdate>(`/kpis/${id}/updates`, payload);
    return response.data;
  },

  tickMilestone: async (id: string, milestoneId: string): Promise<KpiMilestone> => {
    const response = await axiosClient.post<KpiMilestone>(
      `/kpis/${id}/milestones/${milestoneId}/tick`,
    );
    return response.data;
  },

  setContributions: async (
    id: string,
    payload: SetKpiContributionsPayload,
  ): Promise<KpiContribution[]> => {
    const response = await axiosClient.put<KpiContribution[]>(
      `/kpis/${id}/contributions`,
      payload,
    );
    return response.data;
  },

  createRevision: async (
    id: string,
    payload: CreateKpiRevisionPayload,
  ): Promise<KpiRevision> => {
    const response = await axiosClient.post<KpiRevision>(`/kpis/${id}/revisions`, payload);
    return response.data;
  },
};
