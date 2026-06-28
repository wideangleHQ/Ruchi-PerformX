import { Inject, Injectable } from '@nestjs/common';
import { Prisma, request_status_enum, request_type_enum, VisitorStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VisitorRepository } from '../../visitors/repositories/visitor.repository.interface';
import { VisitorRecord } from '../../visitors/repositories/visitor.repository.interface';
import { VisitResponseDto } from '../../visits/dto/visit-response.dto';
import { VisitService } from '../../visits/services/visit.service';
import { CreateVisitDto } from '../../visits/dto/create-visit.dto';
import { SearchVisitorRequestDto, VisitorRequestStatus } from '../dto/search-visitor-request.dto';
import { UpdateVisitorRequestDto } from '../dto/update-visitor-request.dto';
import { CreateVisitorRequestDto } from '../dto/create-visitor-request.dto';
import { VisitorRequestResponseDto } from '../dto/visitor-request-response.dto';
import {
  VISITOR_REQUEST_SELECT,
  VisitorRequestDbClient,
  VisitorRequestRecord,
  VisitorRequestRepository,
  VisitorRequestSearchParams,
} from '../repositories/visitor-request.repository.interface';
import {
  VisitorRequestAccessDeniedException,
  VisitorRequestConversionException,
  VisitorRequestHostEmployeeNotFoundException,
  VisitorRequestInvalidStateException,
  VisitorRequestNotFoundException,
  VisitorRequestServiceContract,
} from './visitor-request.service.interface';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { VisitStatus } from '../../common/enums/visit-status.enum';

const CANCELLED_REASON_PREFIX = 'CANCELLED::';

@Injectable()
export class VisitorRequestService implements VisitorRequestServiceContract {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('VisitorRequestRepository')
    private readonly requestRepository: VisitorRequestRepository,
    @Inject('VisitorRepository')
    private readonly visitorRepository: VisitorRepository,
    private readonly visitService: VisitService,
  ) {}

  async createRequest(
    dto: CreateVisitorRequestDto,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto> {
    return this.runInTransaction(tx, async (client) => {
      const hostEmployee = await this.requireHostEmployee(dto.hostEmployeeId, client);
      const record = await this.requestRepository.create(
        {
          title: dto.visitorName.trim(),
          description: this.serializeDetails({
            mobileNumber: dto.mobileNumber,
            address: dto.address,
            expectedArrival: dto.expectedArrival,
            remarks: dto.remarks ?? null,
          }),
          type: request_type_enum.OTHER,
          status: request_status_enum.PENDING,
          priority: null,
          department_id: hostEmployee.department_id,
          request_reason: dto.purpose.trim(),
          current_assignee_id: dto.hostEmployeeId,
          requested_by_id: actorId,
          reviewed_by_id: null,
          reviewed_at: null,
          generated_task_id: null,
          task_id: null,
          task_title: null,
          task_description: null,
          requested_assignee_id: null,
          rejection_reason: null,
        },
        client,
      );

      return this.toResponse(record);
    });
  }

  async updateRequest(
    id: string,
    dto: UpdateVisitorRequestDto,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await this.requireEditableRequest(id, actorId, client);
      const next = await this.buildUpdatedData(existing, dto, actorId, client);
      const updated = await this.requestRepository.update(existing.id, next, client);
      return this.toResponse(updated);
    });
  }

  async cancelRequest(id: string, actorId: string, tx?: VisitorRequestDbClient): Promise<VisitorRequestResponseDto> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await this.requireEditableRequest(id, actorId, client);
      const cancelled = await this.requestRepository.softDelete(existing.id, client, 'Cancelled by requester');
      return this.toResponse(cancelled);
    });
  }

  async getRequest(id: string): Promise<VisitorRequestResponseDto> {
    const record = await this.requestRepository.findById(id);
    if (!record) throw new VisitorRequestNotFoundException();
    return this.toResponse(record);
  }

  async getPendingRequests(params: Partial<SearchVisitorRequestDto> = {}): Promise<PaginatedResponse<VisitorRequestResponseDto>> {
    return this.searchWithMapping({ ...params, status: VisitorRequestStatus.PENDING });
  }

  async getEmployeeRequests(
    employeeId: string,
    params: Partial<SearchVisitorRequestDto> = {},
  ): Promise<PaginatedResponse<VisitorRequestResponseDto>> {
    return this.searchWithMapping({ ...params, requestedById: employeeId });
  }

  async searchRequests(params: Partial<SearchVisitorRequestDto> = {}): Promise<PaginatedResponse<VisitorRequestResponseDto>> {
    return this.searchWithMapping(params);
  }

  async approveRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await this.requirePendingRequest(id, client);
      const updated = await this.requestRepository.update(existing.id, {
        status: request_status_enum.ACCEPTED,
        reviewed_by_id: actorId,
        reviewed_at: new Date(),
        rejection_reason: null,
      }, client);

      return this.toResponse(updated);
    });
  }

  async rejectRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient,
  ): Promise<VisitorRequestResponseDto> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await this.requirePendingRequest(id, client);
      const updated = await this.requestRepository.update(existing.id, {
        status: request_status_enum.REJECTED,
        reviewed_by_id: actorId,
        reviewed_at: new Date(),
        rejection_reason: 'Rejected by reviewer',
      }, client);

      return this.toResponse(updated);
    });
  }

  async createVisitFromRequest(
    id: string,
    actorId: string,
    tx?: VisitorRequestDbClient & Prisma.TransactionClient,
  ): Promise<VisitResponseDto> {
    return this.runInTransaction(tx, async (client) => {
      const request = await this.requestRepository.findById(id, { tx: client });
      if (!request) throw new VisitorRequestNotFoundException();
      if (this.isCancelled(request)) throw new VisitorRequestInvalidStateException('Cancelled requests cannot be converted');
      if (request.status !== request_status_enum.ACCEPTED) throw new VisitorRequestInvalidStateException('Request must be approved first');

      if (request.generated_task_id) {
        const existingVisit = await this.visitService.getVisit(request.generated_task_id, {
          tx: client,
          includeVisitor: true,
          includeHostEmployee: true,
        });
        if (!existingVisit) throw new VisitorRequestConversionException('Generated visit could not be found');
        return this.toVisitResponse(existingVisit);
      }

      const details = this.parseDetails(request.description);
      const visitor = await this.resolveVisitor(request.title, details.mobileNumber, actorId, client);
      const hostEmployeeId = request.current_assignee_id ?? request.requested_assignee_id;

      if (typeof hostEmployeeId !== 'string' || !hostEmployeeId) {
        throw new VisitorRequestConversionException('Host employee is required to create a visit');
      }
      const resolvedHostEmployeeId = hostEmployeeId as string;

      const visit = await this.visitService.createVisit(
        {
          visitorId: visitor.id,
          hostEmployeeId: resolvedHostEmployeeId,
          purpose: request.request_reason ?? request.title ?? '',
          ...(this.buildMeetingDetails(details.address, details.remarks) ? { meetingDetails: this.buildMeetingDetails(details.address, details.remarks) as string } : {}),
          ...(details.expectedArrival ? { scheduledAt: details.expectedArrival.toISOString() } : {}),
        } as CreateVisitDto,
        actorId,
        client,
      );

      await this.requestRepository.update(
        request.id,
        { generated_task_id: visit.id },
        client,
      );

      return this.toVisitResponse(visit);
    });
  }

  private async searchWithMapping(
    params: VisitorRequestSearchDtoLike = { page: 1, limit: 20 },
  ): Promise<PaginatedResponse<VisitorRequestResponseDto>> {
    const result = await this.requestRepository.search(params);
    return {
      data: result.data.map((record) => this.toResponse(record)),
      meta: result.meta,
    };
  }

  private async requireHostEmployee(id: string, client: VisitorRequestDbClient) {
    const employee = await client.users.findFirst({
      where: { id, is_active: true, deleted_at: null },
      select: { id: true, department_id: true },
    });

    if (!employee) {
      throw new VisitorRequestHostEmployeeNotFoundException();
    }

    return employee;
  }

  private async requireEditableRequest(
    id: string,
    actorId: string,
    client: VisitorRequestDbClient,
  ): Promise<VisitorRequestRecord> {
    const request = await this.requestRepository.findById(id, { tx: client });
    if (!request) throw new VisitorRequestNotFoundException();
    if (this.isCancelled(request)) throw new VisitorRequestInvalidStateException('Cancelled requests cannot be modified');
    if (request.status !== request_status_enum.PENDING) throw new VisitorRequestInvalidStateException('Only pending requests can be modified');
    if (request.requested_by_id !== actorId) throw new VisitorRequestAccessDeniedException('You can only modify your own requests');
    return request;
  }

  private async requirePendingRequest(id: string, client: VisitorRequestDbClient): Promise<VisitorRequestRecord> {
    const request = await this.requestRepository.findById(id, { tx: client });
    if (!request) throw new VisitorRequestNotFoundException();
    if (this.isCancelled(request)) throw new VisitorRequestInvalidStateException('Cancelled requests cannot be reviewed');
    if (request.status !== request_status_enum.PENDING) throw new VisitorRequestInvalidStateException('Request has already been reviewed');
    return request;
  }

  private async buildUpdatedData(
    existing: VisitorRequestRecord,
    dto: UpdateVisitorRequestDto,
    actorId: string,
    client: VisitorRequestDbClient,
  ): Promise<Prisma.task_requestsUncheckedUpdateInput> {
    const data: Prisma.task_requestsUncheckedUpdateInput = {
      updated_at: new Date(),
    };

    if (dto.visitorName !== undefined) data.title = dto.visitorName.trim();
    if (dto.purpose !== undefined) data.request_reason = dto.purpose.trim();
    if (dto.mobileNumber !== undefined || dto.address !== undefined || dto.expectedArrival !== undefined || dto.remarks !== undefined) {
      const current = this.parseDetails(existing.description);
      data.description = this.serializeDetails({
        mobileNumber: dto.mobileNumber ?? current.mobileNumber,
        address: dto.address ?? current.address,
        expectedArrival: dto.expectedArrival ?? current.expectedArrival,
        remarks: dto.remarks ?? current.remarks ?? null,
      });
    }

    if (dto.hostEmployeeId !== undefined) {
      const hostEmployee = await this.requireHostEmployee(dto.hostEmployeeId, client);
      data.current_assignee_id = dto.hostEmployeeId;
      data.department_id = hostEmployee.department_id;
    }

    if (dto.mobileNumber !== undefined || dto.expectedArrival !== undefined || dto.remarks !== undefined || dto.address !== undefined) {
      const current = this.parseDetails(existing.description);
      data.description = this.serializeDetails({
        mobileNumber: dto.mobileNumber ?? current.mobileNumber,
        address: dto.address ?? current.address,
        expectedArrival: dto.expectedArrival ?? current.expectedArrival,
        remarks: dto.remarks ?? current.remarks ?? null,
      });
    }

    return data;
  }

  private async resolveVisitor(
    visitorName: string,
    mobileNumber: string,
    actorId: string,
    client: VisitorRequestDbClient,
  ): Promise<VisitorRecord> {
    const normalizedMobile = normalizePhoneNumber(mobileNumber);
    const existing = await this.visitorRepository.findByMobile(normalizedMobile, { tx: client });
    if (existing) {
      if (existing.status === VisitorStatus.BLACKLISTED) {
        throw new VisitorRequestConversionException('Blacklisted visitors cannot be converted into visits');
      }
      return existing;
    }

    const parts = visitorName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts.shift() ?? visitorName.trim();
    const lastName = parts.length ? parts.join(' ') : undefined;

    return this.visitorRepository.create(
      {
        firstName,
        lastName,
        fullName: visitorName.trim(),
        mobileNumber: normalizedMobile || mobileNumber.trim(),
        status: VisitorStatus.ACTIVE,
        faceRecognitionConsent: false,
        createdById: actorId,
        updatedById: actorId,
      } as Prisma.VisitorUncheckedCreateInput,
      client,
    );
  }

  private parseDetails(value: string): ParsedRequestDetails {
    try {
      const parsed = JSON.parse(value) as Partial<ParsedRequestDetails>;
      return {
        mobileNumber: typeof parsed.mobileNumber === 'string' ? parsed.mobileNumber : '',
        address: typeof parsed.address === 'string' ? parsed.address : '',
        expectedArrival: parsed.expectedArrival ? new Date(parsed.expectedArrival) : null,
        remarks: typeof parsed.remarks === 'string' ? parsed.remarks : null,
      };
    } catch {
      return {
        mobileNumber: '',
        address: '',
        expectedArrival: null,
        remarks: null,
      };
    }
  }

  private serializeDetails(details: {
    mobileNumber: string;
    address: string;
    expectedArrival?: Date | string | null;
    remarks?: string | null | undefined;
  }): string {
    return JSON.stringify({
      mobileNumber: normalizePhoneNumber(details.mobileNumber),
      address: details.address.trim(),
      expectedArrival: details.expectedArrival ? new Date(details.expectedArrival).toISOString() : null,
      remarks: details.remarks?.trim() ?? null,
    });
  }

  private buildMeetingDetails(address: string, remarks?: string | null | undefined): string | null {
    const payload = {
      address: address.trim(),
      remarks: remarks?.trim() ?? null,
    };

    if (!payload.address && !payload.remarks) {
      return null;
    }

    return JSON.stringify(payload);
  }

  private toResponse(record: VisitorRequestRecord): VisitorRequestResponseDto {
    const details = this.parseDetails(record.description);

    return {
      id: record.id,
      visitorName: record.title,
      mobileNumber: details.mobileNumber,
      address: details.address,
      hostEmployeeId: record.current_assignee_id ?? '',
      purpose: record.request_reason ?? record.title,
      expectedArrival: details.expectedArrival ?? new Date(record.created_at),
      remarks: details.remarks,
      status: this.mapStatus(record),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      reviewedById: record.reviewed_by_id ?? null,
      reviewedAt: record.reviewed_at ?? null,
      rejectionReason: record.rejection_reason ?? null,
      generatedVisitId: record.generated_task_id ?? null,
    };
  }

  private toVisitResponse(record: {
    id: string;
    visitorId: string;
    hostEmployeeId: string;
    status: VisitStatus | string;
    purpose: string;
    meetingDetails?: string | null;
    scheduledAt?: Date | null;
    checkInTime?: Date | null;
    checkOutTime?: Date | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }): VisitResponseDto {
    return {
      id: record.id,
      visitorId: record.visitorId,
      hostEmployeeId: record.hostEmployeeId,
      status: record.status as VisitStatus,
      purpose: record.purpose,
      meetingDetails: record.meetingDetails ?? null,
      scheduledAt: record.scheduledAt ?? null,
      checkInTime: record.checkInTime ?? null,
      checkOutTime: record.checkOutTime ?? null,
      createdAt: record.createdAt ?? null,
      updatedAt: record.updatedAt ?? null,
    };
  }

  private mapStatus(record: VisitorRequestRecord): VisitorRequestStatus {
    if (this.isCancelled(record)) {
      return VisitorRequestStatus.CANCELLED;
    }

    if (record.status === request_status_enum.ACCEPTED) {
      return VisitorRequestStatus.APPROVED;
    }

    if (record.status === request_status_enum.REJECTED) {
      return VisitorRequestStatus.REJECTED;
    }

    return VisitorRequestStatus.PENDING;
  }

  private isCancelled(record: Pick<VisitorRequestRecord, 'status' | 'rejection_reason'>): boolean {
    return record.status === request_status_enum.REJECTED && (record.rejection_reason ?? '').startsWith(CANCELLED_REASON_PREFIX);
  }

  private runInTransaction<T>(
    tx: VisitorRequestDbClient | undefined,
    work: (client: VisitorRequestDbClient) => Promise<T>,
  ): Promise<T> {
    if (tx) {
      return work(tx);
    }

    return this.prisma.$transaction((client) => work(client));
  }
}

interface ParsedRequestDetails {
  mobileNumber: string;
  address: string;
  expectedArrival: Date | null;
  remarks: string | null;
}

type VisitorRequestSearchDtoLike = Partial<SearchVisitorRequestDto> & VisitorRequestSearchParams;
