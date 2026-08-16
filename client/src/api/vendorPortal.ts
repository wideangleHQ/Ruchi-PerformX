import axiosClient from './client';

/**
 * The external vendor portal's whole API surface. Nine calls, and they are the
 * only ones a `/vendor` screen may make.
 *
 * Everything else in `src/api` assumes an employee token. Do not reach into
 * tasksApi, usersApi, or dashboardApi from a vendor screen: those endpoints
 * 403 for a VENDOR role, and a screen that calls them is a screen built on a
 * permission the portal does not have.
 */

export type VendorTaskStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'HOD_VERIFIED_PENDING'
  | 'HOD_VERIFIED'
  | 'REVIEWED'
  | 'CLOSED';

/** The four a vendor may set. The server enforces this; the UI only shows it. */
export const VENDOR_ACTIONS = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;
export type VendorAction = (typeof VENDOR_ACTIONS)[number];

/**
 * No department, no assignee, no history. That is not an omission in this type,
 * it is what the server sends.
 */
export interface VendorTask {
  id: string;
  title: string;
  description: string;
  status: VendorTaskStatus | null;
  priority: string | null;
  due_date: string;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface VendorTaskAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size_kb: number | null;
  created_at: string;
}

export interface VendorMessage {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
  from_vendor: boolean;
}

export interface VendorTaskDetail extends VendorTask {
  attachments: VendorTaskAttachment[];
  messages: VendorMessage[];
}

export interface VendorProject {
  id: string;
  project_code: string;
  title: string;
  objective: string;
  description: string;
  status: string;
  priority: string;
  start_date: string | null;
  deadline: string | null;
}

export interface VendorDeliverable {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  submitted_date: string | null;
  status: string;
  remarks: string | null;
}

export interface VendorDashboard {
  tasksByStatus: Record<string, VendorTask[]>;
  projects: VendorProject[];
  deliverables: VendorDeliverable[];
  messages: VendorMessage[];
  counts: {
    tasks: number;
    projects: number;
    deliverables: number;
    deliverablesPending: number;
    messages: number;
  };
}

export const vendorPortalApi = {
  getDashboard: async (): Promise<VendorDashboard> => {
    const res = await axiosClient.get<VendorDashboard>('/vendor/dashboard');
    return res.data;
  },

  getTasks: async (status?: VendorTaskStatus): Promise<VendorTask[]> => {
    const res = await axiosClient.get<VendorTask[]>('/vendor/tasks', {
      params: status ? { status } : undefined,
    });
    return res.data;
  },

  getTask: async (id: string): Promise<VendorTaskDetail> => {
    const res = await axiosClient.get<VendorTaskDetail>(`/vendor/tasks/${id}`);
    return res.data;
  },

  updateTaskStatus: async (id: string, status: VendorAction, reason?: string): Promise<VendorTask> => {
    const res = await axiosClient.patch<VendorTask>(`/vendor/tasks/${id}/status`, {
      status,
      ...(reason ? { reason } : {}),
    });
    return res.data;
  },

  getProjects: async (): Promise<VendorProject[]> => {
    const res = await axiosClient.get<VendorProject[]>('/vendor/projects');
    return res.data;
  },

  getProject: async (id: string): Promise<VendorProject> => {
    const res = await axiosClient.get<VendorProject>(`/vendor/projects/${id}`);
    return res.data;
  },

  getDeliverables: async (): Promise<VendorDeliverable[]> => {
    const res = await axiosClient.get<VendorDeliverable[]>('/vendor-deliverables/mine');
    return res.data;
  },

  submitDeliverable: async (id: string, remarks?: string): Promise<VendorDeliverable> => {
    const res = await axiosClient.patch<VendorDeliverable>(`/vendor-deliverables/${id}/submit`, {
      ...(remarks ? { remarks } : {}),
    });
    return res.data;
  },

  getMessages: async (): Promise<VendorMessage[]> => {
    const res = await axiosClient.get<VendorMessage[]>('/vendor/messages');
    return res.data;
  },

  postMessage: async (content: string): Promise<{ id: string }> => {
    const res = await axiosClient.post<{ id: string }>('/vendor/messages', { content });
    return res.data;
  },
};
