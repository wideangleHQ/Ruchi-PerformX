import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { VisitorRequestStatus } from '../dto/search-visitor-request.dto';

export const VISITOR_REQUEST_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  status: true,
  priority: true,
  department_id: true,
  rejection_reason: true,
  task_id: true,
  task_title: true,
  task_description: true,
  current_assignee_id: true,
  requested_assignee_id: true,
  request_reason: true,
  requested_by_id: true,
  reviewed_by_id: true,
  reviewed_at: true,
  generated_task_id: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.task_requestsSelect;

export type VisitorRequestRecord = Prisma.task_requestsGetPayload<{
  select: typeof VISITOR_REQUEST_SELECT;
}>;

export type VisitorRequestDbClient = PrismaClient | Prisma.TransactionClient;
export type VisitorRequestSortOrder = 'asc' | 'desc';

export interface VisitorRequestSearchParams {
  page?: number;
  limit?: number;
  status?: VisitorRequestStatus;
  hostEmployeeId?: string;
  requestedById?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  includeCancelled?: boolean;
}

export interface VisitorRequestLookupOptions {
  includeCancelled?: boolean;
  tx?: VisitorRequestDbClient;
}

export interface VisitorRequestRepository {
  create(
    data: Prisma.task_requestsUncheckedCreateInput,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestRecord>;

  update(
    id: string,
    data: Prisma.task_requestsUncheckedUpdateInput,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestRecord>;

  findById(
    id: string,
    options?: VisitorRequestLookupOptions,
  ): Promise<VisitorRequestRecord | null>;

  search(
    params?: VisitorRequestSearchParams,
    tx?: VisitorRequestDbClient,
  ): Promise<PaginatedResponse<VisitorRequestRecord>>;

  count(params?: VisitorRequestSearchParams, tx?: VisitorRequestDbClient): Promise<number>;

  softDelete(
    id: string,
    tx?: VisitorRequestDbClient,
    reason?: string,
  ): Promise<VisitorRequestRecord>;
}
