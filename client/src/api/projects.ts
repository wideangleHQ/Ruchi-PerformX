import axiosClient from './client';

export type ProjectStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'AT_RISK'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type ProjectHealth = 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProjectMemberRole = 'PROJECT_LEAD' | 'CO_LEAD' | 'MEMBER' | 'OBSERVER';
export type OutcomeType = 'TRY' | 'FAILURE' | 'OUTCOME';
export type MilestoneStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'MISSED';

/**
 * The `UserSummary` that `attachUsers` hangs off each row. Phase 2 tables carry
 * plain FK columns, so every resolved person arrives as `<fk>_user`.
 */
export interface ProjectUserRef {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
  department_id?: string | null;
}

export interface Project {
  id: string;
  project_code: string;
  title: string;
  project_type: string | null;
  category: string | null;
  priority: ProjectPriority;
  objective: string;
  description: string;
  tags: string[];
  status: ProjectStatus;
  health: ProjectHealth;
  lead_id: string;
  co_lead_id: string | null;
  created_by_id: string;
  start_date: string | null;
  deadline: string | null;
  closed_at: string | null;
  is_rnd: boolean;
  rnd_category: string | null;
  created_at: string;
  updated_at: string;
  lead_id_user?: ProjectUserRef | null;
  co_lead_id_user?: ProjectUserRef | null;
  members?: ProjectMember[];
  /** Checklist rollup the directory renders as a fraction. Absent on older payloads. */
  checklist_total?: number;
  checklist_done?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  joined_at: string;
  user_id_user?: ProjectUserRef | null;
}

export interface ChecklistItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: ProjectPriority | null;
  is_done: boolean;
  assigned_to_id: string | null;
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  assigned_to_id_user?: ProjectUserRef | null;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  owner_id_user?: ProjectUserRef | null;
}

export interface SuccessCriterion {
  id: string;
  project_id: string;
  criterion: string;
  is_met: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProjectKpi {
  id: string;
  project_id: string;
  metric: string;
  target: string | null;
  actual: string | null;
  status: string | null;
  created_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_id_user?: ProjectUserRef | null;
}

export interface ProjectOutcome {
  id: string;
  project_id: string;
  entry_type: OutcomeType;
  content: string;
  logged_by_id: string;
  created_at: string;
  logged_by_id_user?: ProjectUserRef | null;
}

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  actor_id: string;
  action_type: string;
  description: string;
  created_at: string;
  actor_id_user?: ProjectUserRef | null;
}

export interface ClosureReport {
  id: string;
  project_id: string;
  executive_summary: string;
  objective: string;
  final_outcome: string;
  achievements: string | null;
  failures: string | null;
  learnings: string | null;
  kpi_results: string | null;
  recommendations: string | null;
  attachments: string[];
  submitted_by_id: string;
  submitted_at: string;
  submitted_by_id_user?: ProjectUserRef | null;
}

/**
 * Server-side directory filters. "Overdue" and "Due This Week" are derived on
 * the client from `deadline`, so they are not here.
 * ponytail: client-side derivation avoids inventing query params the API would
 * reject; move them here once the backend declares them.
 */
export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus;
  health?: ProjectHealth;
  priority?: ProjectPriority;
  departmentId?: string;
  leadId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * The projects DTOs are snake_case, matching their columns. `main.ts` sets
 * `forbidNonWhitelisted`, so a camelCase key here is a 400 rather than a field
 * the server quietly ignores. The forms keep their own names and map at the
 * boundary; `api-contract.spec.ts` on the server holds the two in agreement.
 */
export interface CreateProjectPayload {
  title: string;
  project_type?: string;
  category?: string;
  priority: ProjectPriority;
  objective: string;
  description: string;
  tags?: string[];
  start_date?: string;
  deadline?: string;
  co_lead_id?: string;
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  status?: ProjectStatus;
}

export interface ChecklistItemPayload {
  title: string;
  description?: string;
  priority?: ProjectPriority;
  assigned_to_id?: string;
  due_date?: string;
  sort_order?: number;
}

/** Lead and Co-Lead may send any field; a member may only send `isDone`. */
export interface UpdateChecklistItemPayload extends Partial<ChecklistItemPayload> {
  is_done?: boolean;
}

export interface MilestonePayload {
  name: string;
  description?: string;
  owner_id?: string;
  start_date?: string;
  due_date?: string;
  status?: MilestoneStatus;
}

export interface KpiPayload {
  metric: string;
  target?: string;
  actual?: string;
  status?: string;
}

export interface ClosureReportPayload {
  executiveSummary: string;
  objective: string;
  finalOutcome: string;
  achievements?: string;
  failures?: string;
  learnings?: string;
  kpiResults?: string;
  recommendations?: string;
  attachments?: string[];
}

/** List endpoints return a bare array or a paginated envelope depending on the route. */
const unwrap = <T>(data: T[] | { data?: T[] }): T[] =>
  Array.isArray(data) ? data : (data?.data ?? []);

export const projectsApi = {
  /** GET /projects */
  getProjects: async (filters?: ProjectFilters): Promise<Project[]> => {
    const response = await axiosClient.get<Project[] | { data?: Project[] }>('/projects', {
      params: filters,
    });
    return unwrap(response.data);
  },

  /** GET /projects/mine — projects the caller is a member of */
  getMyProjects: async (filters?: ProjectFilters): Promise<Project[]> => {
    const response = await axiosClient.get<Project[] | { data?: Project[] }>('/projects/mine', {
      params: filters,
    });
    return unwrap(response.data);
  },

  /** GET /projects/:id */
  getProject: async (id: string): Promise<Project> => {
    const response = await axiosClient.get<Project>(`/projects/${id}`);
    return response.data;
  },

  /** POST /projects */
  createProject: async (payload: CreateProjectPayload): Promise<Project> => {
    const response = await axiosClient.post<Project>('/projects', payload);
    return response.data;
  },

  /** PATCH /projects/:id — Lead and Co-Lead only */
  updateProject: async (id: string, payload: UpdateProjectPayload): Promise<Project> => {
    const response = await axiosClient.patch<Project>(`/projects/${id}`, payload);
    return response.data;
  },

  /** DELETE /projects/:id — soft delete, Lead or MD */
  deleteProject: async (id: string): Promise<void> => {
    await axiosClient.delete(`/projects/${id}`);
  },

  /** POST /projects/:id/members */
  addMember: async (id: string, payload: { user_id: string; role: ProjectMemberRole }): Promise<ProjectMember> => {
    const response = await axiosClient.post<ProjectMember>(`/projects/${id}/members`, payload);
    return response.data;
  },

  /** DELETE /projects/:id/members/:userId */
  removeMember: async (id: string, userId: string): Promise<void> => {
    await axiosClient.delete(`/projects/${id}/members/${userId}`);
  },

  /** GET /projects/:id/checklist */
  getChecklist: async (id: string): Promise<ChecklistItem[]> => {
    const response = await axiosClient.get<ChecklistItem[]>(`/projects/${id}/checklist`);
    return unwrap(response.data);
  },

  /** POST /projects/:id/checklist */
  createChecklistItem: async (id: string, payload: ChecklistItemPayload): Promise<ChecklistItem> => {
    const response = await axiosClient.post<ChecklistItem>(`/projects/${id}/checklist`, payload);
    return response.data;
  },

  /** PATCH /projects/:id/checklist/:itemId */
  updateChecklistItem: async (
    id: string,
    itemId: string,
    payload: UpdateChecklistItemPayload,
  ): Promise<ChecklistItem> => {
    const response = await axiosClient.patch<ChecklistItem>(`/projects/${id}/checklist/${itemId}`, payload);
    return response.data;
  },

  /** DELETE /projects/:id/checklist/:itemId */
  deleteChecklistItem: async (id: string, itemId: string): Promise<void> => {
    await axiosClient.delete(`/projects/${id}/checklist/${itemId}`);
  },

  /** GET /projects/:id/milestones */
  getMilestones: async (id: string): Promise<Milestone[]> => {
    const response = await axiosClient.get<Milestone[]>(`/projects/${id}/milestones`);
    return unwrap(response.data);
  },

  /** POST /projects/:id/milestones */
  createMilestone: async (id: string, payload: MilestonePayload): Promise<Milestone> => {
    const response = await axiosClient.post<Milestone>(`/projects/${id}/milestones`, payload);
    return response.data;
  },

  /** PATCH /projects/:id/milestones/:milestoneId */
  updateMilestone: async (
    id: string,
    milestoneId: string,
    payload: Partial<MilestonePayload>,
  ): Promise<Milestone> => {
    const response = await axiosClient.patch<Milestone>(`/projects/${id}/milestones/${milestoneId}`, payload);
    return response.data;
  },

  /** DELETE /projects/:id/milestones/:milestoneId */
  deleteMilestone: async (id: string, milestoneId: string): Promise<void> => {
    await axiosClient.delete(`/projects/${id}/milestones/${milestoneId}`);
  },

  /** GET /projects/:id/success-criteria */
  getSuccessCriteria: async (id: string): Promise<SuccessCriterion[]> => {
    const response = await axiosClient.get<SuccessCriterion[]>(`/projects/${id}/success-criteria`);
    return unwrap(response.data);
  },

  /** POST /projects/:id/success-criteria */
  createSuccessCriterion: async (
    id: string,
    payload: { criterion: string; sort_order?: number },
  ): Promise<SuccessCriterion> => {
    const response = await axiosClient.post<SuccessCriterion>(`/projects/${id}/success-criteria`, payload);
    return response.data;
  },

  /** GET /projects/:id/kpis */
  getKpis: async (id: string): Promise<ProjectKpi[]> => {
    const response = await axiosClient.get<ProjectKpi[]>(`/projects/${id}/kpis`);
    return unwrap(response.data);
  },

  /** POST /projects/:id/kpis */
  createKpi: async (id: string, payload: KpiPayload): Promise<ProjectKpi> => {
    const response = await axiosClient.post<ProjectKpi>(`/projects/${id}/kpis`, payload);
    return response.data;
  },

  /** PATCH /projects/:id/kpis/:kpiId */
  updateKpi: async (id: string, kpiId: string, payload: Partial<KpiPayload>): Promise<ProjectKpi> => {
    const response = await axiosClient.patch<ProjectKpi>(`/projects/${id}/kpis/${kpiId}`, payload);
    return response.data;
  },

  /** GET /projects/:id/messages — members only, observers excluded */
  getMessages: async (id: string): Promise<ProjectMessage[]> => {
    const response = await axiosClient.get<ProjectMessage[]>(`/projects/${id}/messages`);
    return unwrap(response.data);
  },

  /** POST /projects/:id/messages */
  postMessage: async (id: string, payload: { content: string }): Promise<ProjectMessage> => {
    const response = await axiosClient.post<ProjectMessage>(`/projects/${id}/messages`, payload);
    return response.data;
  },

  /** GET /projects/:id/outcomes — the TRY / FAILURE / OUTCOME log */
  getOutcomes: async (id: string): Promise<ProjectOutcome[]> => {
    const response = await axiosClient.get<ProjectOutcome[]>(`/projects/${id}/outcomes`);
    return unwrap(response.data);
  },

  /** POST /projects/:id/outcomes */
  createOutcome: async (
    id: string,
    payload: { entry_type: OutcomeType; content: string },
  ): Promise<ProjectOutcome> => {
    const response = await axiosClient.post<ProjectOutcome>(`/projects/${id}/outcomes`, payload);
    return response.data;
  },

  /** GET /projects/:id/activity */
  getActivity: async (id: string): Promise<ActivityLogEntry[]> => {
    const response = await axiosClient.get<ActivityLogEntry[]>(`/projects/${id}/activity`);
    return unwrap(response.data);
  },

  /** GET /projects/:id/closure — 404s until a report is submitted */
  getClosureReport: async (id: string): Promise<ClosureReport | null> => {
    const response = await axiosClient.get<ClosureReport | null>(`/projects/${id}/closure`);
    return response.data ?? null;
  },

  /** POST /projects/:id/closure — Lead and Co-Lead only */
  submitClosureReport: async (id: string, payload: ClosureReportPayload): Promise<ClosureReport> => {
    const response = await axiosClient.post<ClosureReport>(`/projects/${id}/closure`, payload);
    return response.data;
  },

  /** PATCH /projects/:id/close — moves to COMPLETED, requires a closure report */
  closeProject: async (id: string): Promise<Project> => {
    const response = await axiosClient.patch<Project>(`/projects/${id}/close`);
    return response.data;
  },
};
