import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { CreateVisitDto } from '../dto/create-visit.dto';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { UpdateVisitDto } from '../dto/update-visit.dto';
import {
  VisitDbClient,
  VisitHistoryParams,
  VisitInsideVisitorsParams,
  VisitLookupOptions,
  VisitQueryRecord,
  VisitSearchParams,
  VisitTodayParams,
} from '../repositories/visit.repository.interface';

export class VisitNotFoundException extends NotFoundException {
  constructor(message = 'Visit not found') {
    super(message);
  }
}

export class VisitVisitorNotFoundException extends NotFoundException {
  constructor(message = 'Visitor not found') {
    super(message);
  }
}

export class VisitHostEmployeeNotFoundException extends NotFoundException {
  constructor(message = 'Host employee not found') {
    super(message);
  }
}

export class VisitBranchNotResolvedException extends BadRequestException {
  constructor(message = 'Unable to resolve visit branch') {
    super(message);
  }
}

export class VisitStateViolationException extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}

export class VisitLockedException extends ConflictException {
  constructor(message = 'Visit cannot be modified') {
    super(message);
  }
}

export interface VisitServiceContract {
  createVisit(
    dto: CreateVisitDto,
    actorId: string,
    tx?: VisitDbClient,
  ): Promise<VisitQueryRecord>;

  updateVisit(
    id: string,
    dto: UpdateVisitDto,
    actorId: string,
    tx?: VisitDbClient,
  ): Promise<VisitQueryRecord>;

  checkIn(
    dto: CheckInDto,
    actorId: string,
    tx?: VisitDbClient,
  ): Promise<VisitQueryRecord>;

  checkOut(
    dto: CheckOutDto,
    actorId: string,
    tx?: VisitDbClient,
  ): Promise<VisitQueryRecord>;

  cancelVisit(
    id: string,
    actorId: string,
    tx?: VisitDbClient,
  ): Promise<VisitQueryRecord>;

  getVisit(
    id: string,
    options?: VisitLookupOptions,
  ): Promise<VisitQueryRecord | null>;

  searchVisits(
    params?: VisitSearchParams,
    tx?: VisitDbClient,
  ): Promise<PaginatedResponse<VisitQueryRecord>>;

  getTodayVisits(
    params?: VisitTodayParams,
  ): Promise<PaginatedResponse<VisitQueryRecord>>;

  getVisitorsInside(
    params?: VisitInsideVisitorsParams,
  ): Promise<VisitQueryRecord[]>;

  getVisitHistory(
    visitorId: string,
    params?: Omit<VisitHistoryParams, 'visitorId'>,
  ): Promise<PaginatedResponse<VisitQueryRecord>>;
}

export type VisitCreateData = Prisma.VisitUncheckedCreateInput;
export type VisitUpdateData = Prisma.VisitUncheckedUpdateInput;

