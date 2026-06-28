import { Prisma, Visit } from '@prisma/client';
import { SearchAppointmentDto } from '../dto/search-appointment.dto';

export const IAppointmentRepositoryToken = Symbol('IAppointmentRepositoryToken');

export type DbClient = Prisma.TransactionClient | PrismaClient;
type PrismaClient = any; // Just for types, but we'll import from PrismaModule's PrismaService normally. Wait, @prisma/client has PrismaClient.

export interface PaginatedVisitResponse {
  data: Visit[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface IAppointmentRepository {
  create(data: Prisma.VisitUncheckedCreateInput, tx?: DbClient): Promise<Visit>;
  update(id: string, data: Prisma.VisitUncheckedUpdateInput, tx?: DbClient): Promise<Visit>;
  findById(id: string, tx?: DbClient): Promise<Visit | null>;
  search(filters: SearchAppointmentDto, tx?: DbClient): Promise<PaginatedVisitResponse>;
  findToday(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]>;
  findUpcoming(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]>;
  cancel(id: string, tx?: DbClient): Promise<Visit>;
  complete(id: string, tx?: DbClient): Promise<Visit>;
  count(filters: SearchAppointmentDto, tx?: DbClient): Promise<number>;
}
