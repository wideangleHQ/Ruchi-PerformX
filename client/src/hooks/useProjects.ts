'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
  type ChecklistItemPayload,
  type ClosureReportPayload,
  type CreateProjectPayload,
  type KpiPayload,
  type MilestonePayload,
  type OutcomeType,
  type Project,
  type ProjectFilters,
  type ProjectMemberRole,
  type UpdateChecklistItemPayload,
  type UpdateProjectPayload,
} from '@/api/projects';
import { useSocket } from '@/hooks/useSocket';

/**
 * Query keys. Socket handlers invalidate by key, so keep these structured and
 * stable. They nest under `['projects', id]`, so invalidating a project's
 * detail key also refreshes its panels, and `['projects']` refreshes the lot.
 */
export const projectKeys = {
  list: (filters?: ProjectFilters) => ['projects', filters] as const,
  mine: (filters?: ProjectFilters) => ['projects', 'mine', filters] as const,
  detail: (projectId: string) => ['projects', projectId] as const,
  checklist: (projectId: string) => ['projects', projectId, 'checklist'] as const,
  milestones: (projectId: string) => ['projects', projectId, 'milestones'] as const,
  successCriteria: (projectId: string) => ['projects', projectId, 'success-criteria'] as const,
  kpis: (projectId: string) => ['projects', projectId, 'kpis'] as const,
  messages: (projectId: string) => ['projects', projectId, 'messages'] as const,
  outcomes: (projectId: string) => ['projects', projectId, 'outcomes'] as const,
  activity: (projectId: string) => ['projects', projectId, 'activity'] as const,
  closure: (projectId: string) => ['projects', projectId, 'closure'] as const,
};

/**
 * Every project mutation invalidates the whole `['projects']` tree on success.
 * Only mounted queries refetch, and a checklist tick moves the directory's
 * progress fraction as readily as the panel it was ticked in, so one key is
 * both correct and shorter than tracking what each mutation touches.
 * ponytail: narrow the key per mutation if a project page ever holds enough
 * live queries for the extra refetches to show.
 */
function useProjectMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export const useProjects = (filters?: ProjectFilters, mineOnly = false) =>
  useQuery({
    queryKey: mineOnly ? projectKeys.mine(filters) : projectKeys.list(filters),
    queryFn: () => (mineOnly ? projectsApi.getMyProjects(filters) : projectsApi.getProjects(filters)),
  });

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
    enabled: Boolean(projectId),
  });

export const useProjectChecklist = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.checklist(projectId),
    queryFn: () => projectsApi.getChecklist(projectId),
    enabled: Boolean(projectId),
  });

export const useProjectMilestones = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.milestones(projectId),
    queryFn: () => projectsApi.getMilestones(projectId),
    enabled: Boolean(projectId),
  });

export const useProjectSuccessCriteria = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.successCriteria(projectId),
    queryFn: () => projectsApi.getSuccessCriteria(projectId),
    enabled: Boolean(projectId),
  });

export const useProjectKpis = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.kpis(projectId),
    queryFn: () => projectsApi.getKpis(projectId),
    enabled: Boolean(projectId),
  });

export const useProjectMessages = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.messages(projectId),
    queryFn: () => projectsApi.getMessages(projectId),
    enabled: Boolean(projectId) && enabled,
  });

export const useProjectOutcomes = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.outcomes(projectId),
    queryFn: () => projectsApi.getOutcomes(projectId),
    enabled: Boolean(projectId) && enabled,
  });

export const useProjectActivity = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.activity(projectId),
    queryFn: () => projectsApi.getActivity(projectId),
    enabled: Boolean(projectId) && enabled,
  });

/** Returns null until a closure report is submitted; a 404 is that, not a failure. */
export const useProjectClosureReport = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.closure(projectId),
    queryFn: () => projectsApi.getClosureReport(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

/** The essentials plus whatever the optional sections of the creation form collected. */
export interface NewProjectDraft {
  project: CreateProjectPayload;
  milestones?: MilestonePayload[];
  kpis?: KpiPayload[];
  successCriteria?: string[];
}

/**
 * Creates the project, then posts the optional extras to their own endpoints.
 * ponytail: sequential follow-up posts use only documented routes instead of
 * guessing at a nested create DTO. Fold them into POST /projects if the DTO
 * ever accepts nested arrays.
 */
export const useCreateProject = () =>
  useProjectMutation(async (draft: NewProjectDraft) => {
    const project = await projectsApi.createProject(draft.project);

    for (const milestone of draft.milestones ?? []) {
      await projectsApi.createMilestone(project.id, milestone);
    }
    for (const kpi of draft.kpis ?? []) {
      await projectsApi.createKpi(project.id, kpi);
    }
    for (const criterion of draft.successCriteria ?? []) {
      await projectsApi.createSuccessCriterion(project.id, { criterion });
    }

    return project;
  });

export const useUpdateProject = (projectId: string) =>
  useProjectMutation((payload: UpdateProjectPayload) => projectsApi.updateProject(projectId, payload));

export const useAddProjectMember = (projectId: string) =>
  useProjectMutation((payload: { user_id: string; role: ProjectMemberRole }) =>
    projectsApi.addMember(projectId, payload),
  );

export const useRemoveProjectMember = (projectId: string) =>
  useProjectMutation((userId: string) => projectsApi.removeMember(projectId, userId));

export const useCreateChecklistItem = (projectId: string) =>
  useProjectMutation((payload: ChecklistItemPayload) => projectsApi.createChecklistItem(projectId, payload));

export const useUpdateChecklistItem = (projectId: string) =>
  useProjectMutation(({ itemId, payload }: { itemId: string; payload: UpdateChecklistItemPayload }) =>
    projectsApi.updateChecklistItem(projectId, itemId, payload),
  );

export const useDeleteChecklistItem = (projectId: string) =>
  useProjectMutation((itemId: string) => projectsApi.deleteChecklistItem(projectId, itemId));

export const useCreateMilestone = (projectId: string) =>
  useProjectMutation((payload: MilestonePayload) => projectsApi.createMilestone(projectId, payload));

export const useUpdateMilestone = (projectId: string) =>
  useProjectMutation(({ milestoneId, payload }: { milestoneId: string; payload: Partial<MilestonePayload> }) =>
    projectsApi.updateMilestone(projectId, milestoneId, payload),
  );

export const useDeleteMilestone = (projectId: string) =>
  useProjectMutation((milestoneId: string) => projectsApi.deleteMilestone(projectId, milestoneId));

export const useCreateSuccessCriterion = (projectId: string) =>
  useProjectMutation((payload: { criterion: string }) =>
    projectsApi.createSuccessCriterion(projectId, payload),
  );

export const useCreateKpi = (projectId: string) =>
  useProjectMutation((payload: KpiPayload) => projectsApi.createKpi(projectId, payload));

export const useUpdateKpi = (projectId: string) =>
  useProjectMutation(({ kpiId, payload }: { kpiId: string; payload: Partial<KpiPayload> }) =>
    projectsApi.updateKpi(projectId, kpiId, payload),
  );

export const usePostProjectMessage = (projectId: string) =>
  useProjectMutation((content: string) => projectsApi.postMessage(projectId, { content }));

export const useCreateOutcome = (projectId: string) =>
  useProjectMutation((payload: { entry_type: OutcomeType; content: string }) =>
    projectsApi.createOutcome(projectId, payload),
  );

export const useSubmitClosureReport = (projectId: string) =>
  useProjectMutation((payload: ClosureReportPayload) => projectsApi.submitClosureReport(projectId, payload));

export const useCloseProject = (projectId: string) =>
  useProjectMutation<void, Project>(() => projectsApi.closeProject(projectId));

/**
 * Joins the `project:<id>` socket room, sending the bare id the way the existing
 * `task:<id>` handlers expect, and invalidates the affected query key when the
 * server broadcasts. Payloads are never written into the cache with
 * `setQueryData` — the socket payload and the REST response are not guaranteed
 * to have the same shape.
 */
export const useProjectRoom = (projectId: string) => {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit('project:join', projectId);

    const onMessage = () => queryClient.invalidateQueries({ queryKey: projectKeys.messages(projectId) });
    // The detail key is a prefix of the checklist key, so this refreshes both the
    // list and the progress in the header.
    const onChecklist = () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });

    socket.on('project:message:new', onMessage);
    socket.on('project:checklist:updated', onChecklist);

    return () => {
      socket.emit('project:leave', projectId);
      socket.off('project:message:new', onMessage);
      socket.off('project:checklist:updated', onChecklist);
    };
  }, [socket, projectId, queryClient]);
};
