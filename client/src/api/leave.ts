import axiosClient from './client';
import type { Holiday } from './holidays';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Day counts are `Decimal(5,1)` on the server and arrive as strings over JSON. */
export type Days = number | string;

/** Coerces a serialised Decimal to a number. Half days are the reason it is not an int. */
export const toDays = (value: Days | null | undefined) => Number(value ?? 0);

export interface LeaveType {
  id: string;
  name: string;
  annual_entitlement: number;
  is_paid: boolean;
  carry_forward: boolean;
  max_carry_forward: number;
  requires_proof: boolean;
  is_active: boolean;
}

/** Shape of `attachUsers` output on the server: a FK column plus `_user`. */
export interface LeaveUserSummary {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  entitled: Days;
  used: Days;
  carried_over: Days;
}

/** `GET /leave/balances`, HR only. The list rows carry the person and the type
 * resolved, which the per-user `/leave/balance` rows do not. */
export interface LeaveBalanceRow extends LeaveBalance {
  user_id_user?: LeaveUserSummary | null;
  remaining: Days;
  leave_type: LeaveType | null;
}

/** One person, one leave type, for the month asked for. */
export interface MonthlyReportRow {
  user_id: string;
  employee_name: string;
  employee_email: string;
  leave_type_id: string;
  leave_type_name: string;
  days_taken: number;
  days_remaining: number;
  unpaid_days: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  financial_year: number;
  rows: MonthlyReportRow[];
}

/** Mirrors CreateLeaveTypeDto. Every field optional server side except the name. */
export interface LeaveTypePayload {
  name: string;
  annual_entitlement: number;
  is_paid: boolean;
  carry_forward: boolean;
  max_carry_forward: number;
  requires_proof: boolean;
  is_active: boolean;
}

/** Phase 2 tables carry plain FK columns, so type names are resolved from `/leave/types`. */
export const leaveTypeName = (types: LeaveType[], id: string) =>
  types.find((type) => type.id === id)?.name ?? 'Leave';

/** Entitlement plus anything carried over, less what has been approved. */
export const remainingDays = (balance: LeaveBalance) =>
  toDays(balance.entitled) + toDays(balance.carried_over) - toDays(balance.used);

export interface LeaveApplication {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: Days;
  reason: string;
  status: LeaveStatus;
  manager_id: string | null;
  approved_by_id: string | null;
  approved_by_role: string | null;
  approved_at: string | null;
  approval_remark: string | null;
  cancelled_by_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  user_id_user?: LeaveUserSummary | null;
  approved_by_id_user?: LeaveUserSummary | null;
  cancelled_by_id_user?: LeaveUserSummary | null;
  /** Only on the pending-approvals response: the applicant's remaining days for this type. */
  /** The applicant's remaining balance for this type, sent on the pending list. */
  applicant_balance?: Days | null;
  /** Proof is a link on the row, not a `task_attachments` join. */
  attachment_url?: string | null;
}

// The holiday wire shape lives in `api/holidays.ts` and is camelCase, unlike
// the rest of this module. A second snake_case copy here read `holiday_date`,
// which the server has never sent, and the apply form's day-count preview threw
// on `undefined.slice(0, 10)` as soon as both dates were filled in.
export type { Holiday } from './holidays';

export interface ApplyLeavePayload {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  /** A link, not a file. See `apply` below. */
  attachment_url?: string;
}

/**
 * Endpoints return a bare array or one of three envelopes, depending on the
 * handler. `/leave/applications/mine` and `/pending` wrap in `items`,
 * `/leave/balance` wraps in `balances`, and `/leave/calendar` wraps in `items`
 * too. Reading only `data` meant every leave list on every screen rendered its
 * empty state no matter how many rows existed, with nothing logged.
 */
async function getList<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
  const response = await axiosClient.get<
    T[] | { items?: T[]; balances?: T[]; data?: T[] }
  >(url, { params });
  const body = response.data;
  if (Array.isArray(body)) return body;
  return body.items ?? body.balances ?? body.data ?? [];
}

export const leaveApi = {
  getTypes: () => getList<LeaveType>('/leave/types'),

  /** Own balance for the current year, one row per active leave type. */
  getMyBalance: () => getList<LeaveBalance>('/leave/balance'),

  getMyApplications: (params?: { status?: LeaveStatus; year?: number }) =>
    getList<LeaveApplication>('/leave/applications/mine', params),

  /** Everything still `PENDING` that the caller may act on. HOD, HR and MD only. */
  getPending: () => getList<LeaveApplication>('/leave/applications/pending'),

  getById: async (id: string): Promise<LeaveApplication> => {
    const response = await axiosClient.get<LeaveApplication>(`/leave/applications/${id}`);
    return response.data;
  },

  /** Approved leave overlapping the month, scoped to what the caller may see. */
  // `LeaveCalendarQueryDto` declares `from` and `to` only, and
  // `forbidNonWhitelisted` turns a stray `month` into a 400 for the whole
  // request, which the dialog then rendered as "nobody is on leave".
  getCalendar: (params: { from: string; to: string }) =>
    getList<LeaveApplication>('/leave/calendar', params),

  /**
   * The caller's effective holiday calendar, common plus their department's.
   * ponytail: read-only here for the day-count preview. The holidays screen owns the CRUD.
   */
  getHolidays: (year: number) => getList<Holiday>('/holidays', { year }),

  /**
   * Submits an application as JSON. Not multipart: `POST /leave/applications`
   * takes `@Body()` with no file interceptor, so a FormData body arrives empty
   * and every field fails validation at once. Proof is `attachment_url`, a
   * link, because `task_attachments` has no leave column to upload into.
   *
   * Throws 400 when the server-side validation set in p2_leave.md fails.
   */
  apply: async (payload: ApplyLeavePayload): Promise<LeaveApplication> => {
    const response = await axiosClient.post<LeaveApplication>('/leave/applications', payload);
    return response.data;
  },

  /** Withdraws the caller's own application. `PENDING` only, nothing was deducted. */
  cancelMine: async (id: string): Promise<LeaveApplication> => {
    const response = await axiosClient.patch<LeaveApplication>(`/leave/applications/${id}/cancel`);
    return response.data;
  },

  /** Approves and deducts. 409 when someone else already closed the application. */
  approve: async (id: string, remark?: string): Promise<LeaveApplication> => {
    const response = await axiosClient.patch<LeaveApplication>(`/leave/applications/${id}/approve`, {
      remark: remark || undefined,
    });
    return response.data;
  },

  /** Rejects. The remark is mandatory: the applicant is told why. */
  reject: async (id: string, remark: string): Promise<LeaveApplication> => {
    const response = await axiosClient.patch<LeaveApplication>(`/leave/applications/${id}/reject`, {
      remark,
    });
    return response.data;
  },

  /** HR-only reversal of an `APPROVED` application. Credits the balance back. */
  hrCancel: async (id: string, cancellation_reason: string): Promise<LeaveApplication> => {
    const response = await axiosClient.patch<LeaveApplication>(`/leave/applications/${id}/hr-cancel`, {
      cancellation_reason,
    });
    return response.data;
  },

  // ------------------------------------------------------------------- admin

  /**
   * Creates a leave type. HR and ADMIN only.
   *
   * Nothing in the company can apply for leave until at least one of these
   * exists, which is why this screen exists at all: the endpoint shipped in
   * Phase 2 with no form in front of it.
   */
  createType: async (payload: LeaveTypePayload): Promise<LeaveType> => {
    const response = await axiosClient.post<LeaveType>('/leave/types', payload);
    return response.data;
  },

  /** Edits a type. Changing `annual_entitlement` does not restate existing balances. */
  updateType: async (id: string, payload: Partial<LeaveTypePayload>): Promise<LeaveType> => {
    const response = await axiosClient.patch<LeaveType>(`/leave/types/${id}`, payload);
    return response.data;
  },

  /** Every balance for the financial year, or one person's. HR only. */
  getBalances: (params?: { user_id?: string; leave_type_id?: string; year?: number }) =>
    getList<LeaveBalanceRow>('/leave/balances', params),

  /**
   * HR's manual correction of one row. Sets the columns outright rather than
   * incrementing, because this exists for migrated numbers that are wrong.
   */
  updateBalance: async (
    id: string,
    payload: { entitled?: number; used?: number; carried_over?: number },
  ): Promise<LeaveBalanceRow> => {
    const response = await axiosClient.patch<LeaveBalanceRow>(`/leave/balances/${id}`, payload);
    return response.data;
  },

  /** Approved leave for one month, per person and type. HR and MD only. */
  getMonthlyReport: async (params: { month: number; year: number }): Promise<MonthlyReport> => {
    const response = await axiosClient.get<MonthlyReport>('/leave/reports/monthly', { params });
    return response.data;
  },

  /**
   * The same report as xlsx. Returned as a blob and saved from the browser,
   * because the endpoint sets its own filename in the content-disposition and
   * axios will not follow that on its own.
   */
  exportMonthly: async (params: { month: number; year: number }): Promise<void> => {
    const response = await axiosClient.get('/leave/reports/export', {
      params,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leave-${String(params.month).padStart(2, '0')}-${params.year}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
