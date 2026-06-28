import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { VisitorStatus } from '../../common/enums/visitor-status.enum';

export const VISITOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  email: true,
  mobileNumber: true,
  companyName: true,
  address: true,
  status: true,
  blacklistReason: true,
  blacklistedAt: true,
  faceRecognitionConsent: true,
  notes: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  images: {
    where: {
      imageType: 'PROFILE',
      isPrimary: true,
      deletedAt: null,
    },
    take: 1,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      fileUrl: true,
      mimeType: true,
      createdAt: true,
    },
  },
} satisfies Prisma.VisitorSelect;

export type VisitorRecord = Prisma.VisitorGetPayload<{
  select: typeof VISITOR_SELECT;
}>;

export type VisitorSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'fullName'
  | 'email'
  | 'mobileNumber'
  | 'status';

export type VisitorSortOrder = 'asc' | 'desc';

export type VisitorDbClient = PrismaClient | Prisma.TransactionClient;

export interface VisitorSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  mobileNumber?: string;
  email?: string;
  status?: VisitorStatus;
  sortBy?: VisitorSortBy;
  sortOrder?: VisitorSortOrder;
  includeDeleted?: boolean;
}

export interface VisitorLookupOptions {
  includeDeleted?: boolean;
  tx?: VisitorDbClient;
}

export interface VisitorExistsCriteria {
  id?: string;
  mobileNumber?: string;
  email?: string;
  includeDeleted?: boolean;
}

export interface VisitorRepository {
  create(data: Prisma.VisitorUncheckedCreateInput, tx?: VisitorDbClient): Promise<VisitorRecord>;
  update(id: string, data: Prisma.VisitorUncheckedUpdateInput, tx?: VisitorDbClient): Promise<VisitorRecord>;
  findById(id: string, options?: VisitorLookupOptions): Promise<VisitorRecord | null>;
  findByMobile(mobileNumber: string, options?: VisitorLookupOptions): Promise<VisitorRecord | null>;
  findByEmail(email: string, options?: VisitorLookupOptions): Promise<VisitorRecord | null>;
  search(params?: VisitorSearchParams, tx?: VisitorDbClient): Promise<PaginatedResponse<VisitorRecord>>;
  exists(criteria: VisitorExistsCriteria, tx?: VisitorDbClient): Promise<boolean>;
  softDelete(id: string, tx?: VisitorDbClient): Promise<VisitorRecord>;
  restore(id: string, tx?: VisitorDbClient): Promise<VisitorRecord>;
  count(params?: VisitorSearchParams, tx?: VisitorDbClient): Promise<number>;
}
