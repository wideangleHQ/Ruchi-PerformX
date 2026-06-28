import { Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { CreateVisitorDto } from '../dto/create-visitor.dto';
import { UpdateVisitorDto } from '../dto/update-visitor.dto';
import {
  VisitorDbClient,
  VisitorExistsCriteria,
  VisitorLookupOptions,
  VisitorRecord,
  VisitorSearchParams,
} from '../repositories/visitor.repository.interface';

export const VISITOR_DOMAIN_SERVICE = Symbol('VISITOR_DOMAIN_SERVICE');

export interface VisitorDomainService {
  prepareCreateInput(
    dto: CreateVisitorDto,
    actorId: string,
  ): Promise<Prisma.VisitorUncheckedCreateInput>;

  prepareUpdateInput(
    existing: VisitorRecord,
    dto: UpdateVisitorDto,
    actorId: string,
  ): Promise<Prisma.VisitorUncheckedUpdateInput>;

  assertCanDelete(existing: VisitorRecord, actorId: string): Promise<void> | void;

  assertCanRestore(existing: VisitorRecord, actorId: string): Promise<void> | void;
}

export interface VisitorServiceContract {
  create(
    dto: CreateVisitorDto,
    actorId: string,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord>;

  update(
    id: string,
    dto: UpdateVisitorDto,
    actorId: string,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord | null>;

  getById(
    id: string,
    options?: VisitorLookupOptions,
  ): Promise<VisitorRecord | null>;

  getByMobile(
    mobileNumber: string,
    options?: VisitorLookupOptions,
  ): Promise<VisitorRecord | null>;

  getByEmail(
    email: string,
    options?: VisitorLookupOptions,
  ): Promise<VisitorRecord | null>;

  search(
    params?: VisitorSearchParams,
    tx?: VisitorDbClient,
  ): Promise<PaginatedResponse<VisitorRecord>>;

  delete(id: string, actorId: string, tx?: VisitorDbClient): Promise<VisitorRecord | null>;

  restore(id: string, actorId: string, tx?: VisitorDbClient): Promise<VisitorRecord | null>;

  exists(criteria: VisitorExistsCriteria, tx?: VisitorDbClient): Promise<boolean>;
}

