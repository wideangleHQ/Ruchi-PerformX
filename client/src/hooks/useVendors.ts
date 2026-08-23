'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  CreateAssignmentPayload,
  CreateContractPayload,
  CreateDeliverablePayload,
  CreateDocumentPayload,
  CreateReviewPayload,
  CreateVendorPayload,
  UpdateVendorPayload,
  VendorAccessLevel,
  VendorFilters,
  VendorStatus,
  vendorsApi,
} from '@/api/vendors';

export const useVendors = (filters?: VendorFilters) =>
  useQuery({
    queryKey: ['vendors', filters],
    queryFn: () => vendorsApi.getVendors(filters),
  });

export const useVendor = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId],
    queryFn: () => vendorsApi.getVendor(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorDeadlines = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'deadlines'],
    queryFn: () => vendorsApi.getDeadlines(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorPerformance = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'performance'],
    queryFn: () => vendorsApi.getPerformance(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorCategories = () =>
  useQuery({
    queryKey: ['vendor-categories'],
    queryFn: () => vendorsApi.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

export const useVendorAssignments = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'assignments'],
    queryFn: () => vendorsApi.getAssignments(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorContracts = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'contracts'],
    queryFn: () => vendorsApi.getContracts(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorDocuments = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'documents'],
    queryFn: () => vendorsApi.getDocuments(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorDeliverables = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'deliverables'],
    queryFn: () => vendorsApi.getDeliverables(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorNotes = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'notes'],
    queryFn: () => vendorsApi.getNotes(vendorId),
    enabled: Boolean(vendorId),
  });

export const useVendorReviews = (vendorId: string) =>
  useQuery({
    queryKey: ['vendors', vendorId, 'reviews'],
    queryFn: () => vendorsApi.getReviews(vendorId),
    enabled: Boolean(vendorId),
  });

export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVendorPayload) => vendorsApi.createVendor(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });
};

export const useUpdateVendor = (vendorId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateVendorPayload) => vendorsApi.updateVendor(vendorId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });
};

/** PATCH /vendors/:id/status. There is no delete counterpart, by design. */
export const useSetVendorStatus = (vendorId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: VendorStatus) => vendorsApi.setVendorStatus(vendorId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });
};

export const useAddVendorNote = (vendorId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; is_internal: boolean }) =>
      vendorsApi.addNote({ vendor_id: vendorId, ...payload }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['vendors', vendorId, 'notes'] }),
  });
};

export interface VendorAccess {
  level: VendorAccessLevel | null;
  /** Any level at all, which is what opening the module requires. */
  canRead: boolean;
  /**
   * VENDOR_MANAGER and above. Every create and edit in the module: vendors,
   * assignments, contracts, documents, deliverables and reviews.
   */
  canWrite: boolean;
  /**
   * VENDOR_ADMIN. Document deletion only, which is the one write above manager
   * in `VendorWorkService`. Reviews are manager, despite what this comment used
   * to say.
   */
  canAdmin: boolean;
  /** MD and EA only: granting and revoking access. */
  canManageAccess: boolean;
  isLoading: boolean;
}

/**
 * The caller's own access level, for deciding which affordances to render.
 *
 * The sidebar already hides the whole module through useNavAccess, so this is
 * for deep links and for the difference between a viewer and a manager, which
 * a boolean cannot carry. MD and EA hold access implicitly with no row, so the
 * role is checked alongside the grant rather than instead of it.
 *
 * A failed request resolves to no access, which renders the empty state rather
 * than a broken page. The API is still the real gate.
 */
export const useVendorAccess = (): VendorAccess => {
  const { user } = useAuth();
  const isMdOrEa = user?.role === 'MD' || user?.role === 'EA';

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-access', 'me'],
    queryFn: () => vendorsApi.getMyAccess().catch(() => null),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const level = data ?? (isMdOrEa ? 'VENDOR_ADMIN' : null);

  return {
    level,
    canRead: Boolean(level),
    canWrite: isMdOrEa || level === 'VENDOR_MANAGER' || level === 'VENDOR_ADMIN',
    canAdmin: isMdOrEa || level === 'VENDOR_ADMIN',
    canManageAccess: isMdOrEa,
    isLoading,
  };
};

/** GET /vendor-access. The grant list behind Access Management. */
export const useVendorAccessGrants = (enabled = true) =>
  useQuery({
    queryKey: ['vendor-access'],
    queryFn: () => vendorsApi.getAccessGrants(),
    enabled,
  });

export const useGrantVendorAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: string; accessLevel: VendorAccessLevel }) =>
      vendorsApi.grantAccess(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-access'] }),
  });
};

export const useRevokeVendorAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => vendorsApi.revokeAccess(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-access'] }),
  });
};

/**
 * Every vendor write invalidates the whole `vendors` key rather than guessing
 * which panel is showing the row. The profile tabs all read from the same
 * vendor, so a narrower key would just be a way to miss one.
 */
function useVendorWorkMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });
}

export const useCreateAssignment = () =>
  useVendorWorkMutation((payload: CreateAssignmentPayload) =>
    vendorsApi.createAssignment(payload),
  );

export const useRemoveAssignment = () =>
  useVendorWorkMutation((id: string) => vendorsApi.removeAssignment(id));

export const useCreateContract = () =>
  useVendorWorkMutation((payload: CreateContractPayload) => vendorsApi.createContract(payload));

export const useCreateDocument = () =>
  useVendorWorkMutation((payload: CreateDocumentPayload) => vendorsApi.createDocument(payload));

export const useRemoveDocument = () =>
  useVendorWorkMutation((id: string) => vendorsApi.removeDocument(id));

export const useCreateDeliverable = () =>
  useVendorWorkMutation((payload: CreateDeliverablePayload) =>
    vendorsApi.createDeliverable(payload),
  );

export const useUpdateDeliverable = () =>
  useVendorWorkMutation(
    ({ id, payload }: { id: string; payload: Partial<Omit<CreateDeliverablePayload, 'vendor_id'>> }) =>
      vendorsApi.updateDeliverable(id, payload),
  );

export const useCreateReview = () =>
  useVendorWorkMutation((payload: CreateReviewPayload) => vendorsApi.createReview(payload));
