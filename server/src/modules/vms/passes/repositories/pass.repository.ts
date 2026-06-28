import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import {
  PASS_SELECT,
  PassDbClient,
  PassRecord,
  PassRepository,
  PassSearchParams,
} from './pass.repository.interface';

@Injectable()
export class PassRepositoryImpl implements PassRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: PassDbClient): PassDbClient {
    return tx ?? this.prisma;
  }

  async create(visitId: string, passNumber: string, tx?: PassDbClient): Promise<PassRecord> {
    return this.client(tx).visit.update({
      where: { id: visitId },
      data: {
        visitCode: passNumber,
        qrPassIssuedAt: new Date(),
      },
      select: PASS_SELECT,
    });
  }

  async update(visitId: string, data: Prisma.VisitUncheckedUpdateInput, tx?: PassDbClient): Promise<PassRecord> {
    return this.client(tx).visit.update({
      where: { id: visitId },
      data,
      select: PASS_SELECT,
    });
  }

  async findById(visitId: string, tx?: PassDbClient): Promise<PassRecord | null> {
    return this.client(tx).visit.findFirst({
      where: { id: visitId, deletedAt: null },
      select: PASS_SELECT,
    });
  }

  async findByVisitId(visitId: string, tx?: PassDbClient): Promise<PassRecord | null> {
    return this.findById(visitId, tx);
  }

  async findByPassNumber(passNumber: string, tx?: PassDbClient): Promise<PassRecord | null> {
    return this.client(tx).visit.findFirst({
      where: { visitCode: passNumber, deletedAt: null },
      select: PASS_SELECT,
    });
  }

  async reprint(visitId: string, tx?: PassDbClient): Promise<PassRecord> {
    return this.client(tx).visit.update({
      where: { id: visitId },
      data: { updatedAt: new Date() },
      select: PASS_SELECT,
    });
  }

  async search(params: PassSearchParams = {}, tx?: PassDbClient): Promise<PaginatedResponse<PassRecord>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    
    const where: Prisma.VisitWhereInput = {
      deletedAt: null,
      visitCode: { not: null },
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { visitCode: { contains: params.search, mode: 'insensitive' } },
        { visitor: { fullName: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, totalItems] = await Promise.all([
      this.client(tx).visit.findMany({
        where,
        select: PASS_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.client(tx).visit.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1,
      }
    };
  }

  async count(params: PassSearchParams = {}, tx?: PassDbClient): Promise<number> {
    const where: Prisma.VisitWhereInput = {
      deletedAt: null,
      visitCode: { not: null },
    };

    if (params.status) {
      where.status = params.status;
    }

    return this.client(tx).visit.count({ where });
  }
}
