import axiosClient from './client';

/**
 * Every money field on this domain is a fixed two place string, not a number.
 * The API keeps amounts in Decimal all the way to Postgres, and parsing them
 * into a JavaScript float here would put the rounding error back.
 */
export type Money = string;

export type EventStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';

export interface EventUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

export interface EventExpense {
  id: string;
  event_id: string;
  item: string;
  amount: Money;
  /** A signed download URL, valid for an hour from the moment it was fetched. */
  receipt_url: string | null;
  logged_by_id: string;
  created_at: string;
  logged_by_id_user: EventUser | null;
}

export interface EventCoordinator {
  id: string;
  event_id: string;
  user_id: string;
  user_id_user: EventUser | null;
}

export interface EventRecord {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  budget_estimated: Money | null;
  status: EventStatus;
  created_by_id: string;
  created_at: string;
}

export interface EventSummary extends EventRecord {
  created_by_id_user: EventUser | null;
}

export interface EventDetail extends EventSummary {
  coordinators: EventCoordinator[];
  expenses: EventExpense[];
}

export interface BudgetReport {
  /** The report carries the event without its creator; nothing on it shows one. */
  event: EventRecord;
  estimated: Money;
  actual: Money;
  /** Actual minus estimated. Positive is an overspend. */
  variance: Money;
  /** Null when nothing was budgeted, because there is nothing to divide by. */
  variance_pct: string | null;
  over_budget: boolean;
  items: EventExpense[];
}

export const eventsApi = {
  getEvents: async (): Promise<EventSummary[]> => {
    const response = await axiosClient.get<EventSummary[]>('/events');
    return response.data;
  },

  getEvent: async (id: string): Promise<EventDetail> => {
    const response = await axiosClient.get<EventDetail>(`/events/${id}`);
    return response.data;
  },

  createEvent: async (data: {
    name: string;
    eventDate: string;
    venue?: string;
    budgetEstimated?: Money;
    coordinatorIds?: string[];
  }): Promise<EventDetail> => {
    const response = await axiosClient.post<EventDetail>('/events', data);
    return response.data;
  },

  updateEvent: async (
    id: string,
    data: { name?: string; eventDate?: string; venue?: string; budgetEstimated?: Money; status?: EventStatus },
  ): Promise<EventDetail> => {
    const response = await axiosClient.patch<EventDetail>(`/events/${id}`, data);
    return response.data;
  },

  deleteEvent: async (id: string): Promise<void> => {
    await axiosClient.delete(`/events/${id}`);
  },

  addCoordinator: async (id: string, userId: string): Promise<EventDetail> => {
    const response = await axiosClient.post<EventDetail>(`/events/${id}/coordinators`, { userId });
    return response.data;
  },

  removeCoordinator: async (id: string, userId: string): Promise<EventDetail> => {
    const response = await axiosClient.delete<EventDetail>(`/events/${id}/coordinators/${userId}`);
    return response.data;
  },

  /** multipart, because the receipt rides along with the amount. */
  createExpense: async (
    id: string,
    data: { item: string; amount: Money; receipt?: File | null },
  ): Promise<EventExpense> => {
    const form = new FormData();
    form.append('item', data.item);
    form.append('amount', data.amount);
    if (data.receipt) form.append('receipt', data.receipt);

    const response = await axiosClient.post<EventExpense>(`/events/${id}/expenses`, form);
    return response.data;
  },

  deleteExpense: async (id: string, expenseId: string): Promise<void> => {
    await axiosClient.delete(`/events/${id}/expenses/${expenseId}`);
  },

  getBudgetReport: async (id: string): Promise<BudgetReport> => {
    const response = await axiosClient.get<BudgetReport>(`/events/${id}/budget-report`);
    return response.data;
  },
};
