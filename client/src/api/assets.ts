import axiosClient from './client';

export type AssetType = 'PASSWORD' | 'DOCUMENT' | 'HARDWARE' | 'LICENSE' | 'OTHER';

export const ASSET_TYPES: AssetType[] = ['PASSWORD', 'DOCUMENT', 'HARDWARE', 'LICENSE', 'OTHER'];

/**
 * An asset as every list and detail route returns it. There is no secret field:
 * the plaintext only ever comes back from `revealSecret`.
 */
export interface CompanyAsset {
  id: string;
  owner_id: string;
  owner_name: string | null;
  asset_type: AssetType;
  label: string;
  username: string | null;
  url: string | null;
  file_url: string | null;
  storage_path: string | null;
  notes: string | null;
  has_secret: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetHandover {
  id: string;
  asset_id: string;
  asset_label: string | null;
  asset_type: AssetType | null;
  from_user_id: string;
  from_user_name: string | null;
  to_user_id: string;
  to_user_name: string | null;
  initiated_by_id: string;
  initiated_by_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EmployeeAssets {
  assets: CompanyAsset[];
  handovers: AssetHandover[];
}

export interface RevealedSecret {
  id: string;
  label: string;
  username: string | null;
  secret: string;
}

export interface CreateAssetInput {
  assetType: AssetType;
  label: string;
  username?: string;
  secret?: string;
  url?: string;
  notes?: string;
  /** Required when `assetType` is DOCUMENT, ignored otherwise. */
  file?: File | null;
}

export type UpdateAssetInput = Partial<Omit<CreateAssetInput, 'assetType' | 'file'>>;

/** EA, PA, MD and HR can open another employee's asset list. */
const OFFBOARDING_ROLES = ['EA', 'PA', 'MD', 'HR'];

export function canViewEmployeeAssets(role: string | undefined): boolean {
  return OFFBOARDING_ROLES.includes(role ?? '');
}

/** The directory entry the handover screen needs, and nothing more. */
export interface AssetUser {
  id: string;
  fullName: string;
  role: string;
  departmentName?: string | null;
}

export const assetsApi = {
  /**
   * GET /users, narrowed to the four fields the handover picker renders.
   * `usersApi.getUsers` returns the same list as full `User` rows.
   */
  getDirectory: async (): Promise<AssetUser[]> => {
    const response = await axiosClient.get<AssetUser[]>('/users', { params: { active: 'true' } });
    return response.data;
  },

  /** GET /assets - own assets, or every asset for EA, PA and MD. */
  getAssets: async (): Promise<CompanyAsset[]> => {
    const response = await axiosClient.get<CompanyAsset[]>('/assets');
    return response.data;
  },

  /** GET /assets/employee/:userId - one employee's assets plus their handover history. */
  getEmployeeAssets: async (userId: string): Promise<EmployeeAssets> => {
    const response = await axiosClient.get<EmployeeAssets>(`/assets/employee/${userId}`);
    return response.data;
  },

  /**
   * GET /assets/:id/reveal - the decrypted secret. Every call writes an
   * `audit_logs` row, so do not call it to prefetch or to render a list.
   */
  revealSecret: async (id: string): Promise<RevealedSecret> => {
    const response = await axiosClient.get<RevealedSecret>(`/assets/${id}/reveal`);
    return response.data;
  },

  /** POST /assets - multipart when a file comes with it, JSON otherwise. */
  createAsset: async (input: CreateAssetInput): Promise<CompanyAsset> => {
    if (input.file) {
      const form = new FormData();
      form.append('assetType', input.assetType);
      form.append('label', input.label);
      if (input.username) form.append('username', input.username);
      if (input.secret) form.append('secret', input.secret);
      if (input.url) form.append('url', input.url);
      if (input.notes) form.append('notes', input.notes);
      form.append('file', input.file);

      const response = await axiosClient.post<CompanyAsset>('/assets', form);
      return response.data;
    }

    const { file, ...body } = input;
    const response = await axiosClient.post<CompanyAsset>('/assets', body);
    return response.data;
  },

  /** PATCH /assets/:id */
  updateAsset: async (id: string, input: UpdateAssetInput): Promise<CompanyAsset> => {
    const response = await axiosClient.patch<CompanyAsset>(`/assets/${id}`, input);
    return response.data;
  },

  /** DELETE /assets/:id - soft delete. */
  deleteAsset: async (id: string): Promise<{ message: string }> => {
    const response = await axiosClient.delete<{ message: string }>(`/assets/${id}`);
    return response.data;
  },

  /** POST /assets/handovers - one submit for the whole leaver list. */
  createHandovers: async (
    items: { assetId: string; toUserId: string }[],
  ): Promise<AssetHandover[]> => {
    const response = await axiosClient.post<AssetHandover[]>('/assets/handovers', { items });
    return response.data;
  },

  /** GET /assets/handovers/pending - what is waiting for the caller to confirm. */
  getPendingHandovers: async (): Promise<AssetHandover[]> => {
    const response = await axiosClient.get<AssetHandover[]>('/assets/handovers/pending');
    return response.data;
  },

  /** PATCH /assets/handovers/:id/confirm - the call that moves ownership. */
  confirmHandover: async (id: string): Promise<AssetHandover> => {
    const response = await axiosClient.patch<AssetHandover>(`/assets/handovers/${id}/confirm`);
    return response.data;
  },
};
