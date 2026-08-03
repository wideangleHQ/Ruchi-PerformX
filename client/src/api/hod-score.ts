import axiosClient from './client';

export type HodScoreComponent =
  | 'taskCreation'
  | 'selfAction'
  | 'departmentCompletion'
  | 'departmentHealth'
  | 'activeParticipation'
  | 'leadershipBonus';

/** `null` for a component means NEUTRAL - no data, weight redistributed. */
export type HodScoreBreakdown = Record<HodScoreComponent, number | null>;

export interface HodScoreMetrics {
  employeeCount: number;
  workingDays: number;
  createdTasks: number;
  expectedTasks: number;
  selfActionsTotal: number;
  selfActionsCompleted: number;
  selfActionDays: number;
  departmentTasksTotal: number;
  departmentTasksCompleted: number;
  departmentTasksPending: number;
  departmentTasksOverdue: number;
  activeDays: number;
  featuresUsed: number;
  reviewedTasks: number;
  avgReviewHours: number | null;
  requestsReviewed: number;
  avgRequestResponseHours: number | null;
}

export interface HodScoreDepartment {
  id: string;
  name: string;
}

export interface HodScoreTrendPoint {
  month: number;
  year: number;
  label: string;
  score: number | null;
}

export interface HodScoreRecord {
  hodId: string;
  hodName: string;
  departments: HodScoreDepartment[];
  primaryDepartment: HodScoreDepartment | null;
  month: number;
  year: number;
  score: number;
  hasData: boolean;
  departmentRank: number | null;
  departmentTotal: number;
  companyRank: number | null;
  companyTotal: number;
  breakdown: HodScoreBreakdown;
  neutralComponents: HodScoreComponent[];
  metrics: HodScoreMetrics;
}

export interface HodScoreResponse extends HodScoreRecord {
  trend: HodScoreTrendPoint[];
}

export interface DepartmentScoreResponse {
  department: HodScoreDepartment;
  month: number;
  year: number;
  departmentScore: number | null;
  hodCount: number;
  averageBreakdown: HodScoreBreakdown;
  hods: HodScoreRecord[];
}

export interface CompanyScoreResponse {
  month: number;
  year: number;
  companyAverage: number | null;
  hodCount: number;
  hods: HodScoreRecord[];
}

export interface TrendsResponse {
  scope: 'self' | 'hod' | 'department' | 'company';
  hodId: string | null;
  departmentId: string | null;
  months: number;
  trend: HodScoreTrendPoint[];
}

export interface HodScorePeriod {
  month?: number;
  year?: number;
}

/**
 * All calculation happens server-side. These calls only transport the result.
 * The backend derives identity from the JWT - no user id is ever sent.
 */
export const hodScoreApi = {
  getMyScore: async (period?: HodScorePeriod): Promise<HodScoreResponse> => {
    const response = await axiosClient.get<HodScoreResponse>('/hod-score/me', {
      params: period,
    });
    return response.data;
  },

  getCompanyScores: async (period?: HodScorePeriod): Promise<CompanyScoreResponse> => {
    const response = await axiosClient.get<CompanyScoreResponse>('/hod-score/company', {
      params: period,
    });
    return response.data;
  },

  getHodScore: async (hodId: string, period?: HodScorePeriod): Promise<HodScoreResponse> => {
    const response = await axiosClient.get<HodScoreResponse>(`/hod-score/${hodId}`, {
      params: period,
    });
    return response.data;
  },

  getDepartmentScore: async (
    departmentId: string,
    period?: HodScorePeriod,
  ): Promise<DepartmentScoreResponse> => {
    const response = await axiosClient.get<DepartmentScoreResponse>(
      `/hod-score/department/${departmentId}`,
      { params: period },
    );
    return response.data;
  },

  getTrends: async (
    params?: HodScorePeriod & { hodId?: string; departmentId?: string; months?: number },
  ): Promise<TrendsResponse> => {
    const response = await axiosClient.get<TrendsResponse>('/hod-score/trends', {
      params,
    });
    return response.data;
  },
};

export const HOD_SCORE_COMPONENT_LABELS: Record<HodScoreComponent, string> = {
  taskCreation: 'Task Creation',
  selfAction: 'Self Actions',
  departmentCompletion: 'Department Completion',
  departmentHealth: 'Department Health',
  activeParticipation: 'Active Participation',
  leadershipBonus: 'Leadership Bonus',
};

export const HOD_SCORE_COMPONENT_WEIGHTS: Record<HodScoreComponent, number> = {
  taskCreation: 25,
  selfAction: 20,
  departmentCompletion: 25,
  departmentHealth: 15,
  activeParticipation: 10,
  leadershipBonus: 5,
};

export const HOD_SCORE_COMPONENT_ORDER: HodScoreComponent[] = [
  'taskCreation',
  'selfAction',
  'departmentCompletion',
  'departmentHealth',
  'activeParticipation',
  'leadershipBonus',
];
