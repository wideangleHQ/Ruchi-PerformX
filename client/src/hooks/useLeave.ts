import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplyLeavePayload, LeaveStatus, LeaveTypePayload, leaveApi } from '@/api/leave';

export const useLeaveTypes = () =>
  useQuery({ queryKey: ['leave', 'types'], queryFn: () => leaveApi.getTypes() });

export const useLeaveBalance = () =>
  useQuery({ queryKey: ['leave', 'balance'], queryFn: () => leaveApi.getMyBalance() });

export const useMyLeaveApplications = (filters?: { status?: LeaveStatus; year?: number }) =>
  useQuery({
    queryKey: ['leave', 'applications', filters],
    queryFn: () => leaveApi.getMyApplications(filters),
  });

export const useLeaveApplication = (id: string) =>
  useQuery({
    queryKey: ['leave', 'application', id],
    queryFn: () => leaveApi.getById(id),
    enabled: Boolean(id),
  });

export const usePendingLeave = (enabled = true) =>
  useQuery({ queryKey: ['leave', 'pending'], queryFn: () => leaveApi.getPending(), enabled });

/**
 * The dialog thinks in months; the endpoint takes a date range. Converted here
 * so one place owns the month-to-range arithmetic. `Date.UTC` with day 0 of the
 * next month gives the last day of this one, leap years included.
 */
export const useLeaveCalendar = (params: { month: number; year: number }, enabled = true) => {
  const from = `${params.year}-${String(params.month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(params.year, params.month, 0)).getUTCDate();
  const to = `${params.year}-${String(params.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return useQuery({
    queryKey: ['leave', 'calendar', from, to],
    queryFn: () => leaveApi.getCalendar({ from, to }),
    enabled,
  });
};

export const useHolidays = (year: number) =>
  useQuery({ queryKey: ['holidays', year], queryFn: () => leaveApi.getHolidays(year) });

/**
 * Every leave transition moves a balance or a status that some other leave
 * screen is showing, so they all invalidate the whole `leave` key rather than
 * guessing which one.
 */
function useLeaveMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave'] }),
  });
}

export const useApplyLeave = () => useLeaveMutation((payload: ApplyLeavePayload) => leaveApi.apply(payload));

export const useCancelMyLeave = () => useLeaveMutation((id: string) => leaveApi.cancelMine(id));

export const useApproveLeave = () =>
  useLeaveMutation(({ id, remark }: { id: string; remark?: string }) => leaveApi.approve(id, remark));

export const useRejectLeave = () =>
  useLeaveMutation(({ id, remark }: { id: string; remark: string }) => leaveApi.reject(id, remark));

export const useHrCancelLeave = () =>
  useLeaveMutation(({ id, reason }: { id: string; reason: string }) => leaveApi.hrCancel(id, reason));

// ---------------------------------------------------------------------- admin

/** Every balance for the year, HR only. Separate key from the caller's own. */
export const useAllLeaveBalances = (
  filters?: { user_id?: string; leave_type_id?: string; year?: number },
  enabled = true,
) =>
  useQuery({
    queryKey: ['leave', 'balances', filters],
    queryFn: () => leaveApi.getBalances(filters),
    enabled,
  });

export const useMonthlyLeaveReport = (
  params: { month: number; year: number },
  enabled = true,
) =>
  useQuery({
    queryKey: ['leave', 'report', params],
    queryFn: () => leaveApi.getMonthlyReport(params),
    enabled,
  });

export const useCreateLeaveType = () =>
  useLeaveMutation((payload: LeaveTypePayload) => leaveApi.createType(payload));

export const useUpdateLeaveType = () =>
  useLeaveMutation(({ id, payload }: { id: string; payload: Partial<LeaveTypePayload> }) =>
    leaveApi.updateType(id, payload),
  );

export const useUpdateLeaveBalance = () =>
  useLeaveMutation(
    ({
      id,
      payload,
    }: {
      id: string;
      payload: { entitled?: number; used?: number; carried_over?: number };
    }) => leaveApi.updateBalance(id, payload),
  );
