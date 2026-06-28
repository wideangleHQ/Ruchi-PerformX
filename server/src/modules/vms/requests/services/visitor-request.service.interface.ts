import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { CreateVisitorRequestDto } from '../dto/create-visitor-request.dto';
import { SearchVisitorRequestDto } from '../dto/search-visitor-request.dto';
import { UpdateVisitorRequestDto } from '../dto/update-visitor-request.dto';
import { VisitorRequestResponseDto } from '../dto/visitor-request-response.dto';
import { VisitorRequestDbClient, VisitorRequestRecord, VisitorRequestSearchParams } from '../repositories/visitor-request.repository.interface';
import { VisitResponseDto } from '../../visits/dto/visit-response.dto';
import { VisitDbClient } from '../../visits/repositories/visit.repository.interface';

export class VisitorRequestNotFoundException extends NotFoundException {
  constructor(message = 'Visitor request not found') {
    super(message);
  }
}

export class VisitorRequestHostEmployeeNotFoundException extends NotFoundException {
  constructor(message = 'Host employee not found') {
    super(message);
  }
}

export class VisitorRequestAccessDeniedException extends ForbiddenException {
  constructor(message = 'Access denied') {
    super(message);
  }
}

export class VisitorRequestInvalidStateException extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}

export class VisitorRequestConversionException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

export interface VisitorRequestServiceContract {
  createRequest(
    dto: CreateVisitorRequestDto,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto>;

  updateRequest(
    id: string,
    dto: UpdateVisitorRequestDto,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto>;

  cancelRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto>;

  getRequest(id: string): Promise<VisitorRequestResponseDto>;

  getPendingRequests(
    params?: SearchVisitorRequestDto,
  ): Promise<PaginatedResponse<VisitorRequestResponseDto>>;

  getEmployeeRequests(
    employeeId: string,
    params?: SearchVisitorRequestDto,
  ): Promise<PaginatedResponse<VisitorRequestResponseDto>>;

  searchRequests(
    params?: SearchVisitorRequestDto,
  ): Promise<PaginatedResponse<VisitorRequestResponseDto>>;

  approveRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto>;

  rejectRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto>;

  createVisitFromRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient & VisitDbClient,
  ): Promise<VisitResponseDto>;
}

export type VisitorRequestTransactionClient = Prisma.TransactionClient;
