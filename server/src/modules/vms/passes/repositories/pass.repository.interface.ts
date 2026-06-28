import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { VisitStatus } from '../../common/enums/visit-status.enum';

export const PASS_SELECT = {
  id: true,
  visitorId: true,
  hostEmployeeId: true,
  status: true,
  visitCode: true,
  checkInTime: true,
  qrPassIssuedAt: true,
  qrPassExpiresAt: true,
  visitor: {
    select: {
      id: true,
      fullName: true,
      mobileNumber: true,
      email: true,
      companyName: true,
      address: true,
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
    }
  },
  hostEmployee: {
    select: {
      id: true,
      full_name: true,
    }
  }
} satisfies Prisma.VisitSelect;

export type PassRecord = Prisma.VisitGetPayload<{
  select: typeof PASS_SELECT;
}>;

export type PassDbClient = PrismaClient | Prisma.TransactionClient;

export interface PassSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: VisitStatus;
}

export interface PassRepository {
  create(visitId: string, passNumber: string, tx?: PassDbClient): Promise<PassRecord>;
  update(visitId: string, data: Prisma.VisitUncheckedUpdateInput, tx?: PassDbClient): Promise<PassRecord>;
  findById(visitId: string, tx?: PassDbClient): Promise<PassRecord | null>;
  findByVisitId(visitId: string, tx?: PassDbClient): Promise<PassRecord | null>;
  findByPassNumber(passNumber: string, tx?: PassDbClient): Promise<PassRecord | null>;
  reprint(visitId: string, tx?: PassDbClient): Promise<PassRecord>;
  search(params?: PassSearchParams, tx?: PassDbClient): Promise<PaginatedResponse<PassRecord>>;
  count(params?: PassSearchParams, tx?: PassDbClient): Promise<number>;
}
