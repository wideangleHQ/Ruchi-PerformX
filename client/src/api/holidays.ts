import axiosClient from './client';

/** One row of the caller's effective calendar. `date` is `YYYY-MM-DD`. */
export interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
  departmentId: string | null;
  departmentName: string | null;
  tier: 'COMMON' | 'DEPARTMENT';
}

export interface UpcomingHoliday extends Holiday {
  daysUntil: number;
}

export interface CreateHolidayInput {
  name: string;
  date: string;
  isOptional?: boolean;
  /** Omit for the company-wide tier. HR and ADMIN only. */
  departmentId?: string;
}

/** No `departmentId`: moving tiers is a delete plus a create, and the API 400s on it. */
export type UpdateHolidayInput = Partial<Omit<CreateHolidayInput, 'departmentId'>>;

export const holidaysApi = {
  getHolidays: async (year?: number): Promise<Holiday[]> => {
    const response = await axiosClient.get<Holiday[]>('/holidays', {
      params: year ? { year } : undefined,
    });
    return response.data;
  },

  getUpcomingHolidays: async (limit?: number): Promise<UpcomingHoliday[]> => {
    const response = await axiosClient.get<UpcomingHoliday[]>('/holidays/upcoming', {
      params: limit ? { limit } : undefined,
    });
    return response.data;
  },

  createHoliday: async (data: CreateHolidayInput): Promise<Holiday> => {
    const response = await axiosClient.post<Holiday>('/holidays', data);
    return response.data;
  },

  updateHoliday: async (id: string, data: UpdateHolidayInput): Promise<Holiday> => {
    const response = await axiosClient.patch<Holiday>(`/holidays/${id}`, data);
    return response.data;
  },

  deleteHoliday: async (id: string): Promise<{ id: string }> => {
    const response = await axiosClient.delete<{ id: string }>(`/holidays/${id}`);
    return response.data;
  },
};
