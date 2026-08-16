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
};
