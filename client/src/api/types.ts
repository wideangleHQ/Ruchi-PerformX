import type { Poll } from './polls';

// ─── Enums ────────────────────────────────────────────────────────────────────
export type Role = 'MD' | 'EA' | 'PA' | 'PURCHASE_HEAD' | 'DEPARTMENT_CONTROLLER' | 'HOD' | 'EMPLOYEE' | 'ADMIN' | 'HR';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export type TaskStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'PENDING'
  | 'REVIEWED'
  | 'CLOSED'
  | 'HOD_VERIFIED_PENDING'
  | 'HOD_VERIFIED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TaskCategory =
  | 'OPERATIONAL'
  | 'SALES'
  | 'MARKETING'
  | 'PRODUCTION'
  | 'HR'
  | 'FINANCE'
  | 'OTHER';

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Shape returned by POST /auth/login */
export interface LoginResponse {
  accessToken: string;
  userId: string;
  username: string;
  role: Role;
  status?: UserStatus;
}

/** Shape returned by GET /auth/me (JWT payload) */
export interface JwtUser {
  sub: string;
  username: string;
  role: Role;
  departmentId: string | null;
  departmentIds: string[];
  departmentName?: string | null;
  fullName: string;
  canAccessCareerHR: boolean;
}

/** Normalised User used throughout the app */
export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role: Role;
  status?: UserStatus;
  departmentId?: string | null;
  departmentIds?: string[];
  departmentName?: string | null;
  // `toUserResponse` sends a display string, not a relation. For the four
  // multi-department roles it is a comma-joined list, so it is never an id.
  department?: string | null;
  canAccessCareerHR?: boolean;
}

/**
 * A row from either assignee picker. Not a `User`: the two `meta/assignees`
 * routes send `department` as a relation, where `GET /users` sends a display
 * string. Same word, two shapes, so they get two types.
 */
export interface Assignee {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role: Role;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  // The seven the signup form offers. The server takes any `role_enum`, but
  // ADMIN and HR are created by an admin and a VENDOR never self-registers.
  role:
    | 'MD'
    | 'EA'
    | 'PA'
    | 'PURCHASE_HEAD'
    | 'DEPARTMENT_CONTROLLER'
    | 'HOD'
    | 'EMPLOYEE';
  departmentId?: string;
  departmentIds?: string[];
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

/** `POST /auth/verify-reset-otp` answers with the token that authorises the reset. */
export interface VerifyResetOtpResponse {
  resetToken: string;
}

export interface MessageResponse {
  message: string;
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  task_type?: 'OFFICIAL' | 'EMPLOYEE_SHARED';
  priority: TaskPriority;
  category?: TaskCategory;
  dueDate?: string;
  due_date?: string;
  completedAt?: string;
  completed_at?: string;
  acceptedAt?: string;
  accepted_at?: string;
  reviewedAt?: string;
  reviewed_at?: string;
  closedAt?: string;
  closed_at?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  assignedToId?: string;
  assigned_to_id?: string;
  assignedById?: string;
  assigned_by_id?: string;
  departmentId?: string;
  department_id?: string;
  departmentIds?: string[];
  assignedTo?: User;
  assignedBy?: User;
  users_tasks_assigned_to_idTousers?: { id: string; full_name: string; role: Role };
  users_tasks_assigned_by_idTousers?: { id: string; full_name: string; role: Role };
  departments?: { id: string; name: string };
  task_departments?: Array<{ departments: { id: string; name: string } }>;
  task_attachments?: Attachment[];
}

export type RequestType =
  | 'BUDGET_APPROVAL'
  | 'TRANSPORT_SUPPORT'
  | 'CROSS_DEPT_ASSISTANCE'
  | 'RESOURCE_REQUEST'
  | 'OTHER'
  | 'TASK_REASSIGNMENT';

export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RequestAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size_kb?: number | null;
  created_at?: string;
}

export interface Request {
  id: string;
  title: string;
  description: string;
  type: RequestType;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  priority?: RequestPriority | null;
  departmentId?: string | null;
  taskId?: string | null;
  generatedTaskId?: string | null;
  taskDepartmentId?: string | null;
  currentAssigneeId?: string | null;
  requestedAssigneeId?: string | null;
  requestReason?: string | null;
  taskTitle?: string | null;
  taskDescription?: string | null;
  currentAssigneeName?: string | null;
  requestedAssigneeName?: string | null;
  requesterName?: string | null;
  requesterDepartmentId?: string | null;
  requestAttachments?: RequestAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size_kb?: number | null;
  uploaded_by_id?: string;
  task_id?: string | null;
  comment_id?: string | null;
  self_action_id?: string | null;
  self_action_comment_id?: string | null;
  created_at?: string;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  user?: User;
  taskId: string;
  parentCommentId?: string | null;
  isTagged: boolean;
  createdAt: string;
  updatedAt?: string;
  attachments?: Attachment[];
  replies?: Comment[];
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_ACCEPTED'
  | 'TASK_REJECTED'
  | 'TASK_COMPLETED'
  | 'TASK_OVERDUE'
  | 'ESCALATION_HOD'
  | 'ESCALATION_MD'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_REJECTED'
  | 'REVIEW_REQUESTED'
  | 'REMARKS_ADDED'
  | 'INCENTIVE_APPROVED'
  | 'TRANSFER_REQUESTED'
  | 'PASSWORD_RESET';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  taskId?: string;
  createdAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
// `GET /dashboard` returns one payload for every role. The scope changes with
// the caller's departments, the shape does not, so there is no per-role type
// here. Scoring has its own types in `api/scoring.ts`.
export interface Birthday {
  id: string;
  fullName: string;
  departmentName?: string | null;
}

export interface UpcomingHoliday {
  id: string;
  name: string;
  holidayDate: string;
  daysAway: number;
}

export interface DashboardData {
  activeTasks: number;
  pendingRequests: number;
  completionRate: number;
  incentives: number;
  pendingApprovals: number;
  transferRequests: number;
  escalatedTasks: number;
  overdueTasks: number;
  chartData: Array<{ label: string; value: number }>;
  departmentSummary: Array<{
    department: string;
    tasks: number;
    completion: string;
    status: string;
  }>;
  employeeSharedTasks: number;
  // The social layer rides along in the same call rather than in three more.
  birthdays: Birthday[];
  upcomingHoliday: UpcomingHoliday | null;
  activePolls: Poll[];
}

// ─── API Error ────────────────────────────────────────────────────────────────
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
