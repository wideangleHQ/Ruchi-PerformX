import axiosClient from './client';
import { PaginatedResponse } from './types';

// Internal Vendor Management only. Nothing here is reachable from the external
// vendor portal, which lives on its own /vendor/* namespace and its own screens.
// Endpoint contract: docs/src/p2_vendors.md section 21.

export type VendorStatus =
  | 'PROSPECT'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'EXPIRED'
  | 'TERMINATED';

export type VendorAccessLevel =
  | 'VENDOR_ADMIN'
  | 'VENDOR_MANAGER'
  | 'VENDOR_VIEWER';

export type DeliverableStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'OVERDUE';

/** Derived server-side from expiry_date. Never recomputed on this side. */
export type VendorDocumentStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

/** Mirrors UserSummary from server/src/common/helpers/user-lookup.helper.ts. */
export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
}

export interface VendorCategory {
  id: string;
  name: string;
  is_active: boolean;
}

/**
 * A `vendors` row. Column names are the Prisma ones because Phase 2 services
 * return rows directly; `*_id_user` siblings are what `attachUsers` adds.
 *
 * The joined and rolled-up fields at the bottom are optional so a directory
 * built against a backend that has not landed its joins yet renders a dash
 * rather than throwing.
 */
export interface Vendor {
  id: string;
  vendor_code: string;
  name: string;
  vendor_type?: string | null;
  category_id?: string | null;
  description?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  alternate_contact?: string | null;
  company_address?: string | null;
  website?: string | null;
  start_date?: string | null;
  status: VendorStatus;
  owner_id: string;
  department_id?: string | null;
  secondary_owner_id?: string | null;
  notes?: string | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;

  category?: VendorCategory | null;
  department?: { id: string; name: string } | null;
  owner_id_user?: UserSummary | null;
  secondary_owner_id_user?: UserSummary | null;

  /** Section 17 row fields, joined from the current contract and open work. */
  active_work_count?: number;
  next_deadline?: string | null;
  contract_end_date?: string | null;
}

export interface VendorContract {
  id: string;
  vendor_id: string;
  contract_number: string;
  contract_type?: string | null;
  start_date: string;
  end_date?: string | null;
  renewal_date?: string | null;
  status: string;
  description?: string | null;
  created_at?: string;
}

export interface VendorAssignment {
  id: string;
  vendor_id: string;
  entity_type: string;
  entity_id?: string | null;
  entity_title?: string | null;
  assigned_by_id: string;
  assigned_by_id_user?: UserSummary | null;
  start_date?: string | null;
  deadline?: string | null;
  status: string;
  description?: string | null;
  priority?: string | null;
  /** 0-100, present when the referenced project or task reports one. */
  progress?: number | null;
  created_at?: string;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  contract_id?: string | null;
  category: 'LEGAL' | 'OPERATIONAL';
  document_type: string;
  document_name: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_url: string;
  uploaded_by_id: string;
  uploaded_by_id_user?: UserSummary | null;
  status: VendorDocumentStatus;
  created_at?: string;
}

export interface VendorDeliverable {
  id: string;
  vendor_id: string;
  name: string;
  description?: string | null;
  project_id?: string | null;
  owner_id: string;
  owner_id_user?: UserSummary | null;
  due_date?: string | null;
  submitted_date?: string | null;
  status: DeliverableStatus;
  remarks?: string | null;
  created_at?: string;
}

export interface VendorNote {
  id: string;
  vendor_id: string;
  author_id: string;
  author_id_user?: UserSummary | null;
  content: string;
  /** true is the internal thread, false is the thread shared with the vendor. */
  is_internal: boolean;
  created_at: string;
}

export interface VendorReview {
  id: string;
  vendor_id: string;
  reviewer_id: string;
  reviewer_id_user?: UserSummary | null;
  review_date: string;
  /** 1-5. Not a percentage and not a weighted composite, see section 14. */
  rating: number;
  quality?: number | null;
  timeliness?: number | null;
  communication?: number | null;
  reliability?: number | null;
  remarks?: string | null;
  action_required?: string | null;
  created_at?: string;
}

/** GET /vendors/:id/performance, computed from deliverables and reviews. */
export interface VendorPerformance {
  on_time_percent?: number | null;
  /** Average of recorded reviews, 1-5. */
  rating?: number | null;
  deliverables_completed?: number;
  deliverables_overdue?: number;
  deliverables_rejected?: number;
  open_assignments?: number;
  last_review_date?: string | null;
}

export type VendorDeadlineSource =
  | 'CONTRACT_EXPIRY'
  | 'CONTRACT_RENEWAL'
  | 'DOCUMENT_EXPIRY'
  | 'ASSIGNMENT_DEADLINE'
  | 'PROJECT_DEADLINE'
  | 'DELIVERABLE_DUE'
  | 'REVIEW_DATE'
  | 'COMPLIANCE';

/** One row of GET /vendors/:id/deadlines. Already sorted ascending by date. */
export interface VendorDeadline {
  source: VendorDeadlineSource;
  label: string;
  date: string;
  is_soon: boolean;
  is_overdue: boolean;
  entity_id?: string | null;
}

/** GET /vendors/:id. The profile screen, section 16, in one request. */
export interface VendorProfile extends Vendor {
  counts?: {
    active_assignments?: number;
    completed?: number;
    overdue?: number;
    upcoming_deadlines?: number;
  };
  current_contract?: VendorContract | null;
  documents?: { total?: number; expiring_soon?: number };
  performance?: VendorPerformance;
}

export interface VendorFilters {
  search?: string;
  status?: VendorStatus;
  categoryId?: string;
  departmentId?: string;
  ownerId?: string;
  /** Contract expiry range, ISO dates. */
  expiryFrom?: string;
  expiryTo?: string;
  page?: number;
  limit?: number;
}

/** POST /vendors. Section 1 fields only — contracts carry their own dates. */
/**
 * `CreateVendorDto` is camelCase, unlike the vendor work DTOs below it, which
 * are snake_case. The rows that come back are snake_case either way, because
 * those are column names. Mapping happens in `VendorForm.toPayload`.
 */
export interface CreateVendorPayload {
  name: string;
  ownerId: string;
  vendorType?: string;
  categoryId?: string;
  description?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  alternateContact?: string;
  companyAddress?: string;
  website?: string;
  startDate?: string;
  departmentId?: string;
  secondaryOwnerId?: string;
  notes?: string;
  tags?: string[];
}

export type UpdateVendorPayload = Partial<CreateVendorPayload>;

export interface VendorAccessGrant {
  id: string;
  user_id: string;
  user_id_user?: UserSummary | null;
  access_level: VendorAccessLevel;
  granted_by_id: string;
  granted_by_id_user?: UserSummary | null;
  granted_at: string;
}

/**
 * Drop empty strings and empty arrays before they reach the API.
 *
 * The ValidationPipe runs with `forbidNonWhitelisted`, and an optional field
 * sent as "" still fails @IsEmail or @IsDateString. A cleared input has to
 * become an absent key, not a blank one.
 */
function pruneBlanks<T extends object>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  ) as Partial<T>;
}

/**
 * List endpoints in this repository are split between a bare array and a
 * PaginatedResponse envelope, and the vendor backend is not merged yet.
 * ponytail: accept both here rather than in every component; drop the array
 * branch once the module lands on one shape.
 */
function toList<T>(payload: T[] | PaginatedResponse<T> | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

/** Mirrors CreateVendorAssignmentDto. */
export interface CreateAssignmentPayload {
  vendor_id: string;
  entity_type: 'task' | 'project' | 'deliverable' | 'service';
  entity_id?: string;
  start_date?: string;
  deadline?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  description?: string;
  priority?: string;
}

/** Mirrors CreateVendorContractDto. */
export interface CreateContractPayload {
  vendor_id: string;
  contract_number: string;
  contract_type?: string;
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  description?: string;
}

/**
 * Mirrors CreateVendorDocumentDto. `file_url` and `storage_path` are required
 * because the endpoint records an already-stored file rather than uploading one.
 */
export interface CreateDocumentPayload {
  vendor_id: string;
  contract_id?: string;
  category: 'LEGAL' | 'OPERATIONAL';
  document_type: string;
  document_name: string;
  issue_date?: string;
  expiry_date?: string;
  file_url: string;
  storage_path: string;
}

/** Mirrors CreateVendorDeliverableDto. */
export interface CreateDeliverablePayload {
  vendor_id: string;
  name: string;
  description?: string;
  project_id?: string;
  owner_id: string;
  due_date?: string;
  status?: string;
  remarks?: string;
}

/** Mirrors CreateVendorReviewDto. Sub-scores are optional, `rating` is not. */
export interface CreateReviewPayload {
  vendor_id: string;
  review_date: string;
  rating: number;
  quality?: number;
  timeliness?: number;
  communication?: number;
  reliability?: number;
  remarks?: string;
  action_required?: string;
}

export const vendorsApi = {
  /** GET /vendors — the directory, section 17. */
  getVendors: async (filters?: VendorFilters): Promise<Vendor[]> => {
    const response = await axiosClient.get<Vendor[] | PaginatedResponse<Vendor>>(
      '/vendors',
      { params: filters },
    );
    return toList(response.data);
  },

  /** GET /vendors/:id — the profile, section 16. */
  getVendor: async (id: string): Promise<VendorProfile> => {
    const response = await axiosClient.get<VendorProfile>(`/vendors/${id}`);
    return response.data;
  },

  createVendor: async (payload: CreateVendorPayload): Promise<Vendor> => {
    const response = await axiosClient.post<Vendor>('/vendors', pruneBlanks(payload));
    return response.data;
  },

  updateVendor: async (id: string, payload: UpdateVendorPayload): Promise<Vendor> => {
    const response = await axiosClient.patch<Vendor>(`/vendors/${id}`, pruneBlanks(payload));
    return response.data;
  },

  /** PATCH /vendors/:id/status. The only lifecycle control; vendors are never deleted. */
  setVendorStatus: async (id: string, status: VendorStatus): Promise<Vendor> => {
    const response = await axiosClient.patch<Vendor>(`/vendors/${id}/status`, { status });
    return response.data;
  },

  getDeadlines: async (id: string): Promise<VendorDeadline[]> => {
    const response = await axiosClient.get<VendorDeadline[]>(`/vendors/${id}/deadlines`);
    return response.data ?? [];
  },

  getPerformance: async (id: string): Promise<VendorPerformance> => {
    const response = await axiosClient.get<VendorPerformance>(`/vendors/${id}/performance`);
    return response.data;
  },

  getCategories: async (): Promise<VendorCategory[]> => {
    const response = await axiosClient.get<VendorCategory[] | PaginatedResponse<VendorCategory>>(
      '/vendor-categories',
    );
    return toList(response.data);
  },

  getAssignments: async (vendorId: string): Promise<VendorAssignment[]> => {
    const response = await axiosClient.get<VendorAssignment[] | PaginatedResponse<VendorAssignment>>(
      '/vendor-assignments',
      { params: { vendor_id: vendorId } },
    );
    return toList(response.data);
  },

  getContracts: async (vendorId: string): Promise<VendorContract[]> => {
    const response = await axiosClient.get<VendorContract[] | PaginatedResponse<VendorContract>>(
      '/vendor-contracts',
      { params: { vendor_id: vendorId } },
    );
    return toList(response.data);
  },

  getDocuments: async (vendorId: string): Promise<VendorDocument[]> => {
    const response = await axiosClient.get<VendorDocument[] | PaginatedResponse<VendorDocument>>(
      '/vendor-documents',
      { params: { vendor_id: vendorId } },
    );
    return toList(response.data);
  },

  getDeliverables: async (vendorId: string): Promise<VendorDeliverable[]> => {
    const response = await axiosClient.get<VendorDeliverable[] | PaginatedResponse<VendorDeliverable>>(
      '/vendor-deliverables',
      { params: { vendor_id: vendorId } },
    );
    return toList(response.data);
  },

  getNotes: async (vendorId: string): Promise<VendorNote[]> => {
    const response = await axiosClient.get<VendorNote[] | PaginatedResponse<VendorNote>>(
      '/vendor-notes',
      { params: { vendor_id: vendorId } },
    );
    return toList(response.data);
  },

  /** POST /vendor-notes. `is_internal` decides which of the two threads it joins. */
  addNote: async (payload: {
    vendor_id: string;
    content: string;
    is_internal: boolean;
  }): Promise<VendorNote> => {
    const response = await axiosClient.post<VendorNote>('/vendor-notes', payload);
    return response.data;
  },

  getReviews: async (vendorId: string): Promise<VendorReview[]> => {
    const response = await axiosClient.get<VendorReview[] | PaginatedResponse<VendorReview>>(
      '/vendor-reviews',
      { params: { vendor_id: vendorId } },
    );
    return toList(response.data);
  },

  /** GET /vendor-access/me. Null for an employee with no grant and no MD/EA role. */
  // ------------------------------------------------------------------ writes
  //
  // The five work entities shipped read-only: the endpoints existed and the
  // forms did not. Notes already had a write path, which is why it is absent
  // here.

  createAssignment: async (payload: CreateAssignmentPayload): Promise<VendorAssignment> => {
    const response = await axiosClient.post<VendorAssignment>('/vendor-assignments', payload);
    return response.data;
  },

  updateAssignment: async (
    id: string,
    payload: Partial<Pick<CreateAssignmentPayload, 'start_date' | 'deadline' | 'status' | 'description' | 'priority'>>,
  ): Promise<VendorAssignment> => {
    const response = await axiosClient.patch<VendorAssignment>(`/vendor-assignments/${id}`, payload);
    return response.data;
  },

  removeAssignment: async (id: string): Promise<void> => {
    await axiosClient.delete(`/vendor-assignments/${id}`);
  },

  createContract: async (payload: CreateContractPayload): Promise<VendorContract> => {
    const response = await axiosClient.post<VendorContract>('/vendor-contracts', payload);
    return response.data;
  },

  updateContract: async (
    id: string,
    payload: Partial<Omit<CreateContractPayload, 'vendor_id'>>,
  ): Promise<VendorContract> => {
    const response = await axiosClient.patch<VendorContract>(`/vendor-contracts/${id}`, payload);
    return response.data;
  },

  /**
   * Records a document that is already stored somewhere, rather than uploading
   * one. `POST /vendor-documents` takes a URL and a storage path, not
   * multipart: AttachmentsService could not be imported across the branch
   * boundary in Phase 2. The form says so instead of pretending otherwise.
   */
  createDocument: async (payload: CreateDocumentPayload): Promise<VendorDocument> => {
    const response = await axiosClient.post<VendorDocument>('/vendor-documents', payload);
    return response.data;
  },

  removeDocument: async (id: string): Promise<void> => {
    await axiosClient.delete(`/vendor-documents/${id}`);
  },

  createDeliverable: async (payload: CreateDeliverablePayload): Promise<VendorDeliverable> => {
    const response = await axiosClient.post<VendorDeliverable>('/vendor-deliverables', payload);
    return response.data;
  },

  updateDeliverable: async (
    id: string,
    payload: Partial<Omit<CreateDeliverablePayload, 'vendor_id'>>,
  ): Promise<VendorDeliverable> => {
    const response = await axiosClient.patch<VendorDeliverable>(`/vendor-deliverables/${id}`, payload);
    return response.data;
  },

  createReview: async (payload: CreateReviewPayload): Promise<VendorReview> => {
    const response = await axiosClient.post<VendorReview>('/vendor-reviews', payload);
    return response.data;
  },

  getMyAccess: async (): Promise<VendorAccessLevel | null> => {
    const response = await axiosClient.get<{ accessLevel: VendorAccessLevel | null }>(
      '/vendor-access/me',
    );
    return response.data?.accessLevel ?? null;
  },

  /** GET /vendor-access. MD and EA only. */
  getAccessGrants: async (): Promise<VendorAccessGrant[]> => {
    const response = await axiosClient.get<VendorAccessGrant[] | PaginatedResponse<VendorAccessGrant>>(
      '/vendor-access',
    );
    return toList(response.data);
  },

  grantAccess: async (payload: {
    userId: string;
    accessLevel: VendorAccessLevel;
  }): Promise<VendorAccessGrant> => {
    const response = await axiosClient.post<VendorAccessGrant>('/vendor-access', payload);
    return response.data;
  },

  revokeAccess: async (userId: string): Promise<void> => {
    await axiosClient.delete(`/vendor-access/${userId}`);
  },
};
