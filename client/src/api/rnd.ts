import axiosClient from './client';

/**
 * Phase 2 tables carry plain FK columns, so the server resolves them with
 * `attachUsers` and returns a sibling `<column>_user` property. Same shape on
 * every R&D row.
 */
export interface RndUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

export interface RndTeamMember {
  id: string;
  user_id: string;
  added_by_id: string;
  added_at: string;
  user_id_user: RndUser | null;
  added_by_id_user: RndUser | null;
}

export interface RndReport {
  id: string;
  project_id: string | null;
  category: string;
  product_area: string;
  findings: string;
  recommendation: string;
  supporting_data: string | null;
  submitted_by_id: string;
  /** Null until an MD, EA, or PA opens the report. Also closes the edit window. */
  md_viewed_at: string | null;
  created_at: string;
  submitted_by_id_user: RndUser | null;
}

export interface CreateRndReportPayload {
  category: string;
  product_area: string;
  findings: string;
  recommendation: string;
  supporting_data?: string;
}

export type UpdateRndReportPayload = Partial<
  Omit<CreateRndReportPayload, 'category'>
>;

export const rndApi = {
  getTeam: async (): Promise<RndTeamMember[]> => {
    const response = await axiosClient.get<RndTeamMember[]>('/rnd/team');
    return response.data;
  },

  /** The same call `useNavAccess` makes to decide whether the R&D tab renders. */
  getMembership: async (): Promise<{ isMember: boolean }> => {
    const response = await axiosClient.get<{ isMember: boolean }>('/rnd/team/me');
    return response.data;
  },

  addTeamMember: async (userId: string): Promise<RndTeamMember> => {
    const response = await axiosClient.post<RndTeamMember>('/rnd/team', { userId });
    return response.data;
  },

  removeTeamMember: async (userId: string): Promise<void> => {
    await axiosClient.delete(`/rnd/team/${userId}`);
  },

  getReports: async (): Promise<RndReport[]> => {
    const response = await axiosClient.get<RndReport[]>('/rnd/reports');
    return response.data;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await axiosClient.get<string[]>('/rnd/reports/categories');
    return response.data;
  },

  getReport: async (id: string): Promise<RndReport> => {
    const response = await axiosClient.get<RndReport>(`/rnd/reports/${id}`);
    return response.data;
  },

  createReport: async (payload: CreateRndReportPayload): Promise<RndReport> => {
    const response = await axiosClient.post<RndReport>('/rnd/reports', payload);
    return response.data;
  },

  updateReport: async (
    id: string,
    payload: UpdateRndReportPayload,
  ): Promise<RndReport> => {
    const response = await axiosClient.patch<RndReport>(
      `/rnd/reports/${id}`,
      payload,
    );
    return response.data;
  },
};
