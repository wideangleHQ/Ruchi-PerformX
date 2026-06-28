import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { VisitStatus } from '../../common/enums/visit-status.enum';

export const VISIT_BASE_SELECT = {
  id: true,
  visitorId: true,
  branchId: true,
  hostEmployeeId: true,
  status: true,
  visitCode: true,
  purpose: true,
  meetingDetails: true,
  scheduledAt: true,
  checkInTime: true,
  checkOutTime: true,
  qrPassIssuedAt: true,
  qrPassExpiresAt: true,
  faceVerifiedAt: true,
  faceMatchScore: true,
  aadhaarVerifiedAt: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.VisitSelect;

export const VISIT_WITH_VISITOR_SELECT = {
  ...VISIT_BASE_SELECT,
  visitor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      status: true,
      images: {
        where: {
          imageType: 'PROFILE',
          isPrimary: true,
          deletedAt: null,
        },
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileUrl: true,
          mimeType: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.VisitSelect;

export const VISIT_WITH_HOST_EMPLOYEE_SELECT = {
  ...VISIT_BASE_SELECT,
  hostEmployee: {
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      department_id: true,
    },
  },
} satisfies Prisma.VisitSelect;

export const VISIT_WITH_RELATIONS_SELECT = {
  ...VISIT_BASE_SELECT,
  visitor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      status: true,
      images: {
        where: {
          imageType: 'PROFILE',
          isPrimary: true,
          deletedAt: null,
        },
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileUrl: true,
          mimeType: true,
          createdAt: true,
        },
      },
    },
  },
  hostEmployee: {
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      department_id: true,
    },
  },
} satisfies Prisma.VisitSelect;

export type VisitRecord = Prisma.VisitGetPayload<{
  select: typeof VISIT_BASE_SELECT;
}>;

export type VisitWithVisitorRecord = Prisma.VisitGetPayload<{
  select: typeof VISIT_WITH_VISITOR_SELECT;
}>;

export type VisitWithHostEmployeeRecord = Prisma.VisitGetPayload<{
  select: typeof VISIT_WITH_HOST_EMPLOYEE_SELECT;
}>;

export type VisitWithRelationsRecord = Prisma.VisitGetPayload<{
  select: typeof VISIT_WITH_RELATIONS_SELECT;
}>;

export type VisitQueryRecord =
  | VisitRecord
  | VisitWithVisitorRecord
  | VisitWithHostEmployeeRecord
  | VisitWithRelationsRecord;

export type VisitSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'scheduledAt'
  | 'checkInTime'
  | 'checkOutTime'
  | 'purpose'
  | 'visitCode'
  | 'status';

export type VisitSortOrder = 'asc' | 'desc';

export type VisitDbClient = PrismaClient | Prisma.TransactionClient;

export interface VisitSearchParams {
  page?: number;
  limit?: number;
  visitorId?: string;
  hostEmployeeId?: string;
  status?: VisitStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: VisitSortBy;
  sortOrder?: VisitSortOrder;
  includeDeleted?: boolean;
  includeVisitor?: boolean;
  includeHostEmployee?: boolean;
}

export interface VisitLookupOptions {
  includeDeleted?: boolean;
  includeVisitor?: boolean;
  includeHostEmployee?: boolean;
  tx?: VisitDbClient;
}

export interface VisitHistoryParams {
  visitorId: string;
  page?: number;
  limit?: number;
  includeVisitor?: boolean;
  includeHostEmployee?: boolean;
  tx?: VisitDbClient;
}

export interface VisitTodayParams {
  branchId?: string;
  page?: number;
  limit?: number;
  includeVisitor?: boolean;
  includeHostEmployee?: boolean;
  tx?: VisitDbClient;
}

export interface VisitInsideVisitorsParams {
  branchId?: string;
  includeVisitor?: boolean;
  includeHostEmployee?: boolean;
  tx?: VisitDbClient;
}

export interface VisitRepository {
  create(data: Prisma.VisitUncheckedCreateInput, tx?: VisitDbClient): Promise<VisitRecord>;
  update(id: string, data: Prisma.VisitUncheckedUpdateInput, tx?: VisitDbClient): Promise<VisitRecord>;
  findById(id: string, options?: VisitLookupOptions): Promise<VisitRecord | VisitWithRelationsRecord | null>;
  findActiveVisitByVisitor(
    visitorId: string,
    options?: VisitLookupOptions,
  ): Promise<VisitRecord | VisitWithRelationsRecord | null>;
  search(
    params?: VisitSearchParams,
    tx?: VisitDbClient,
  ): Promise<PaginatedResponse<VisitQueryRecord>>;
  findToday(
    params?: VisitTodayParams,
  ): Promise<PaginatedResponse<VisitQueryRecord>>;
  findInsideVisitors(
    params?: VisitInsideVisitorsParams,
  ): Promise<VisitQueryRecord[]>;
  findHistory(
    params: VisitHistoryParams,
  ): Promise<PaginatedResponse<VisitQueryRecord>>;
  count(params?: VisitSearchParams, tx?: VisitDbClient): Promise<number>;
  softDelete(id: string, tx?: VisitDbClient): Promise<VisitRecord>;
}
