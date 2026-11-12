import axiosClient from './client';

/**
 * Employee scoring.
 *
 * Every number here is `points`: an unbounded total, not a percentage and not a
 * rating out of anything. It is on a different scale to the 0-100 HOD score in
 * `hod-score.ts`, so the two are never mixed in one chart or averaged together.
 *
 * `points: null` with `hasScore: false` means no score was stored for that
 * month. That is not the same as a stored zero and must not be drawn as one.
 */
export interface ScoreTrendPoint {
  month: number;
  year: number;
  label: string;
  hasScore: boolean;
  points: number | null;
  assignedTasksCompleted: number;
  selfActionsCompleted: number;
  overdueTasksCount: number;
}

export interface EmployeeScoreSummary {
  userId: string;
  month: number;
  year: number;
  hasScore: boolean;
  points: number | null;
  assignedTasksCompleted: number;
  selfActionsCompleted: number;
  overdueTasksCount: number;
}

export interface EmployeeScoreTrend {
  userId: string;
  months: number;
  endMonth: number;
  endYear: number;
  trend: ScoreTrendPoint[];
}

export interface DepartmentMemberTrend {
  userId: string;
  fullName: string;
  trend: ScoreTrendPoint[];
}

export interface DepartmentScoreTrend {
  departmentId: string;
  months: number;
  endMonth: number;
  endYear: number;
  memberCount: number;
  trend: ScoreTrendPoint[];
  members: DepartmentMemberTrend[];
}

export interface DepartmentScoreSummary {
  departmentId: string;
  month: number;
  year: number;
  hasScore: boolean;
  averagePoints: number | null;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  role: string;
  department: string | null;
  points: number;
}

export interface Leaderboard {
  month: number;
  year: number;
  entries: LeaderboardEntry[];
}

export interface ScorePeriod {
  month?: number;
  year?: number;
}

export type ScoreTrendParams = ScorePeriod & { months?: number };

export interface SubcomponentDetail {
  score: number;
  weight: number;
  value?: string | number;
}

export interface ComponentBreakdown {
  score: number;
  weight: number;
  weightedScore: number;
  applicable: boolean;
  subcomponents: Record<string, SubcomponentDetail>;
}

export interface AtScoreDetail {
  score: number;
  status: string;
  isNormalized: boolean;
  components: {
    selfAction: ComponentBreakdown;
    assignedTask: ComponentBreakdown;
    project: ComponentBreakdown;
    departmentExecution?: ComponentBreakdown;
    leadership?: ComponentBreakdown;
  };
}

export interface DetailedScoreProfile {
  user: {
    id: string;
    fullName: string;
    role: string;
    department: string;
    departmentId: string | null;
  };
  period: {
    month: number;
    year: number;
  };
  atScore: AtScoreDetail;
  psScore: {
    ps_score: number;
    counted_weight: number;
    declared_weight: number;
    kpis: Array<{
      id: string;
      name: string;
      scope: string;
      mode: string;
      status: string;
      unit_label: string | null;
      unit_symbol: string | null;
      target_value: number | null;
      actual_value: number | null;
      achievement: number | null;
      score: number | null;
      weight: number;
      effective_weight: number;
      contribution_share: number;
      contribution: number | null;
      counted: boolean;
    }>;
  };
}

export interface ManagementScoresParams extends ScorePeriod {
  department_id?: string;
  role?: string;
  q?: string;
  page?: number;
  limit?: number;
  minAt?: number;
  maxAt?: number;
  minPs?: number;
  maxPs?: number;
}

export interface ManagementScoreItem {
  id: string;
  fullName: string;
  role: string;
  department: string;
  departmentId: string | null;
  atScore: number;
  psScore: number;
  atStatus: string;
  isNormalized: boolean;
  period: string;
}

export interface ManagementScoresOverview {
  summary: {
    totalEmployees: number;
    avgAtScore: number;
    avgPsScore: number;
    completedCalculations: number;
    pendingCalculations: number;
  };
  items: ManagementScoreItem[];
  departments: Array<{ id: string; name: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DepartmentExecutionOverview {
  department: {
    id: string;
    name: string;
    totalActiveEmployees: number;
    departmentAtExecutionScore: number;
    departmentPsScore: number | null;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    period: string;
  };
  employees: Array<{
    id: string;
    fullName: string;
    role: string;
    atScore: number;
    psScore: number;
    period: string;
  }>;
}

export const scoringApi = {
  /** GET /scoring/me - the caller's own month. Identity comes from the JWT. */
  getMyScore: async (period?: ScorePeriod): Promise<EmployeeScoreSummary> => {
    const response = await axiosClient.get<EmployeeScoreSummary>('/scoring/me', {
      params: period,
    });
    return response.data;
  },

  /** GET /scoring/me/trend - own history, oldest month first, gaps included. */
  getMyTrend: async (params?: ScoreTrendParams): Promise<EmployeeScoreTrend> => {
    const response = await axiosClient.get<EmployeeScoreTrend>('/scoring/me/trend', {
      params,
    });
    return response.data;
  },

  /** GET /scoring/profile - caller's complete AT & PS detailed profile. */
  getMyProfile: async (period?: ScorePeriod): Promise<DetailedScoreProfile> => {
    const response = await axiosClient.get<DetailedScoreProfile>('/scoring/profile', {
      params: period,
    });
    return response.data;
  },

  /** GET /scoring/profile/:userId - specific employee's complete AT & PS detailed profile. */
  getUserProfile: async (userId: string, period?: ScorePeriod): Promise<DetailedScoreProfile> => {
    const response = await axiosClient.get<DetailedScoreProfile>(`/scoring/profile/${userId}`, {
      params: period,
    });
    return response.data;
  },

  /** GET /scoring/overview - management scores dashboard overview for EA, PA, MD and HODs. */
  getOverview: async (params?: ManagementScoresParams): Promise<ManagementScoresOverview> => {
    const response = await axiosClient.get<ManagementScoresOverview>('/scoring/overview', {
      params,
    });
    return response.data;
  },

  /** GET /scoring/department/:id/overview - Section A & B for HOD department scoring. */
  getDepartmentOverview: async (
    departmentId: string,
    period?: ScorePeriod,
  ): Promise<DepartmentExecutionOverview> => {
    const response = await axiosClient.get<DepartmentExecutionOverview>(
      `/scoring/department/${departmentId}/overview`,
      { params: period },
    );
    return response.data;
  },

  /** GET /scoring/department/:id - MD and HOD, within the caller's departments. */
  getDepartmentScore: async (
    departmentId: string,
    period?: ScorePeriod,
  ): Promise<DepartmentScoreSummary> => {
    const response = await axiosClient.get<DepartmentScoreSummary>(
      `/scoring/department/${departmentId}`,
      { params: period },
    );
    return response.data;
  },

  /** GET /scoring/department/:id/trend - department average plus one series per member. */
  getDepartmentTrend: async (
    departmentId: string,
    params?: ScoreTrendParams,
  ): Promise<DepartmentScoreTrend> => {
    const response = await axiosClient.get<DepartmentScoreTrend>(
      `/scoring/department/${departmentId}/trend`,
      { params },
    );
    return response.data;
  },

  /** GET /scoring/leaderboard - top 10 by points for a month. */
  getLeaderboard: async (period?: ScorePeriod): Promise<Leaderboard> => {
    const response = await axiosClient.get<Leaderboard>('/scoring/leaderboard', {
      params: period,
    });
    return response.data;
  },

  /**
   * Export matching scores to Excel for EA, PA, MD and HOD in a single go.
   * File name returned follows Scores_YYYY-MM-DD.xlsx.
   */
  exportScores: async (params?: ManagementScoresParams): Promise<void> => {
    const response = await axiosClient.get('/scoring/export', {
      params: params ? { ...params, page: undefined, limit: undefined } : undefined,
      responseType: 'blob',
    });

    const disposition = String(response.headers?.['content-disposition'] ?? '');
    const serverName = /filename="([^"]+)"/.exec(disposition)?.[1];

    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const defaultName = `Scores_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;
    link.download = serverName ?? defaultName;
    link.click();
    URL.revokeObjectURL(url);
  },
};
