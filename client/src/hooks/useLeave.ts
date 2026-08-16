import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplyLeavePayload, LeaveStatus, leaveApi } from '@/api/leave';

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

export const useLeaveCalendar = (params: { month: number; year: number }, enabled = true) =>
  useQuery({
    queryKey: ['leave', 'calendar', params],
    queryFn: () => leaveApi.getCalendar(params),
    enabled,
  });

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
