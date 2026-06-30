import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateVisitDto } from '../dto/create-visit.dto';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { UpdateVisitDto } from '../dto/update-visit.dto';
import { VisitorRepository } from '../../visitors/repositories/visitor.repository.interface';
import {
  VisitHistoryParams,
  VisitInsideVisitorsParams,
  VisitLookupOptions,
  VisitQueryRecord,
  VisitRepository,
  VisitSearchParams,
  VisitTodayParams,
} from '../repositories/visit.repository.interface';
import {
  VisitBranchNotResolvedException,
  VisitHostEmployeeNotFoundException,
  VisitLockedException,
  VisitNotFoundException,
  VisitServiceContract,
  VisitStateViolationException,
  VisitVisitorNotFoundException,
} from './visit.service.interface';
import { VisitStatus } from '../../common/enums/visit-status.enum';

const VISIT_CODE_PREFIX = 'VISIT';
const MAX_VISIT_CODE_ATTEMPTS = 5;

@Injectable()
export class VisitService implements VisitServiceContract {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('VisitRepository')
    private readonly visitRepository: VisitRepository,
    @Inject('VisitorRepository')
    private readonly visitorRepository: VisitorRepository,
  ) {}

  async createVisit(dto: CreateVisitDto, actorId: string, tx?: Prisma.TransactionClient): Promise<VisitQueryRecord> {
    return this.runInTransaction(tx, (client) => this.createVisitWithinTransaction(client, dto, actorId));
  }

  async updateVisit(id: string, dto: UpdateVisitDto, actorId: string, tx?: Prisma.TransactionClient): Promise<VisitQueryRecord> {
    return this.runInTransaction(tx, async (client) => {
      const visit = await this.requireVisit(id, client, true, true);
      if (visit.status === VisitStatus.CHECKED_OUT) return visit;
      const data = await this.buildUpdateData(client, visit, dto, actorId);
      return client.visit.update({ where: { id: visit.id }, data, select: this.visitSelect(true, true) });
    });
  }

  async checkIn(dto: CheckInDto, actorId: string, tx?: Prisma.TransactionClient): Promise<VisitQueryRecord> {
    return this.runInTransaction(tx, async (client) => {
      const visit = await this.requireVisit(dto.visitId, client, false, false);
      if (visit.status !== VisitStatus.SCHEDULED) throw new VisitStateViolationException('Only scheduled visits can be checked in');
      return client.visit.update({
        where: { id: visit.id },
        data: {
          checkInTime: visit.checkInTime ?? new Date(dto.checkInTime ?? new Date().toISOString()),
          status: VisitStatus.CHECKED_IN,
          updatedById: actorId,
        },
        select: this.visitSelect(true, true),
      });
    });
  }

  async checkOut(dto: CheckOutDto, actorId: string, tx?: Prisma.TransactionClient): Promise<VisitQueryRecord> {
    return this.runInTransaction(tx, async (client) => {
      const visit = await this.requireVisit(dto.visitId, client, false, false);
      if (visit.status !== VisitStatus.CHECKED_IN) throw new VisitStateViolationException('Only checked-in visits can be checked out');
      return client.visit.update({
        where: { id: visit.id },
        data: {
          checkOutTime: visit.checkOutTime ?? new Date(dto.checkOutTime ?? new Date().toISOString()),
          status: VisitStatus.CHECKED_OUT,
          updatedById: actorId,
        },
        select: this.visitSelect(true, true),
      });
    });
  }

  async cancelVisit(id: string, actorId: string, tx?: Prisma.TransactionClient): Promise<VisitQueryRecord> {
    return this.runInTransaction(tx, async (client) => {
      const visit = await this.requireVisit(id, client, false, false);
      if (visit.status !== VisitStatus.SCHEDULED) throw new VisitStateViolationException('Only scheduled visits can be cancelled');
      return client.visit.update({
        where: { id: visit.id },
        data: { status: VisitStatus.CANCELLED, updatedById: actorId },
        select: this.visitSelect(true, true),
      });
    });
  }

  async getVisit(id: string, options: VisitLookupOptions = {}) {
    return this.visitRepository.findById(id, {
      ...options,
      includeVisitor: options.includeVisitor ?? true,
      includeHostEmployee: options.includeHostEmployee ?? true,
    });
  }

  async searchVisits(params: VisitSearchParams = {}, tx?: Prisma.TransactionClient) {
    return this.visitRepository.search(params, tx);
  }

  async getTodayVisits(params: VisitTodayParams = {}) {
    return this.visitRepository.findToday({
      ...params,
      includeVisitor: params.includeVisitor ?? true,
      includeHostEmployee: params.includeHostEmployee ?? true,
    });
  }

  async getVisitorsInside(params: VisitInsideVisitorsParams = {}) {
    return this.visitRepository.findInsideVisitors({
      ...params,
      includeVisitor: params.includeVisitor ?? true,
      includeHostEmployee: params.includeHostEmployee ?? true,
    });
  }

  async getVisitHistory(visitorId: string, params: Omit<VisitHistoryParams, 'visitorId'> = {}) {
    const searchParams: VisitSearchParams = {
      visitorId,
      status: VisitStatus.CHECKED_OUT,
      sortBy: 'checkOutTime',
      sortOrder: 'desc',
      includeVisitor: params.includeVisitor ?? true,
      includeHostEmployee: params.includeHostEmployee ?? true,
    };

    if (params.page !== undefined) searchParams.page = params.page;
    if (params.limit !== undefined) searchParams.limit = params.limit;

    return this.visitRepository.search(searchParams);
  }

  private async createVisitWithinTransaction(
    client: Prisma.TransactionClient,
    dto: CreateVisitDto,
    actorId: string,
  ) {
    const visitor = await this.visitorRepository.findById(dto.visitorId, { tx: client });
    if (!visitor) throw new VisitVisitorNotFoundException();

    const hostEmployee = await client.users.findFirst({
      where: { id: dto.hostEmployeeId, deleted_at: null },
      select: {
        id: true,
        department_id: true,
        hod_departments: { select: { department_id: true }, take: 1 },
        assistant_departments: { select: { department_id: true }, take: 1 }
      },
    });
    if (!hostEmployee) throw new VisitHostEmployeeNotFoundException();

    const actor = await client.users.findFirst({
      where: { id: actorId, deleted_at: null },
      select: {
        department_id: true,
        hod_departments: { select: { department_id: true }, take: 1 },
        assistant_departments: { select: { department_id: true }, take: 1 }
      },
    });

    let branchId = hostEmployee.department_id
      ?? hostEmployee.hod_departments[0]?.department_id
      ?? hostEmployee.assistant_departments[0]?.department_id
      ?? actor?.department_id
      ?? actor?.hod_departments[0]?.department_id
      ?? actor?.assistant_departments[0]?.department_id;

    if (!branchId) {
      const fallbackDept = await client.departments.findFirst({
        where: { is_active: true },
        select: { id: true },
        orderBy: { sort_order: 'asc' }
      });
      branchId = fallbackDept?.id;
    }

    if (!branchId) throw new VisitBranchNotResolvedException();

    for (let attempt = 0; attempt < MAX_VISIT_CODE_ATTEMPTS; attempt += 1) {
      try {
        const visitCode = this.generateVisitCode();
        const data: Prisma.VisitUncheckedCreateInput = {
          visitorId: dto.visitorId,
          branchId,
          hostEmployeeId: dto.hostEmployeeId,
          purpose: dto.purpose,
          peopleCount: dto.peopleCount ?? 1,
          status: VisitStatus.SCHEDULED,
          visitCode,
          createdById: actorId,
          updatedById: actorId,
        };

        if (dto.meetingDetails !== undefined) {
          data.meetingDetails = dto.meetingDetails;
        }

        if (dto.scheduledAt !== undefined) {
          data.scheduledAt = new Date(dto.scheduledAt);
        }

        return await client.visit.create({
          data,
          select: this.visitSelect(true, true),
        });
      } catch (error) {
        if (!this.isUniqueCodeCollision(error)) throw error;
      }
    }

    throw new VisitLockedException('Unable to generate a unique visit code');
  }

  private async buildUpdateData(
    client: Prisma.TransactionClient,
    visit: VisitQueryRecord,
    dto: UpdateVisitDto,
    actorId: string,
  ): Promise<Prisma.VisitUncheckedUpdateInput> {
    const data: Prisma.VisitUncheckedUpdateInput = { updatedById: actorId };

    if (dto.purpose !== undefined) data.purpose = dto.purpose;
    if (dto.peopleCount !== undefined) data.peopleCount = dto.peopleCount;
    if (dto.meetingDetails !== undefined) data.meetingDetails = dto.meetingDetails;
    if (dto.scheduledAt !== undefined) data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    if (dto.hostEmployeeId !== undefined) {
      const hostEmployee = await client.users.findFirst({
        where: { id: dto.hostEmployeeId, deleted_at: null },
        select: {
          id: true,
          department_id: true,
          hod_departments: { select: { department_id: true }, take: 1 },
          assistant_departments: { select: { department_id: true }, take: 1 }
        },
      });
      if (!hostEmployee) throw new VisitHostEmployeeNotFoundException();
      data.hostEmployeeId = dto.hostEmployeeId;
      
      let newBranchId = hostEmployee.department_id
        ?? hostEmployee.hod_departments[0]?.department_id
        ?? hostEmployee.assistant_departments[0]?.department_id;
        
      if (!newBranchId) {
        const fallbackDept = await client.departments.findFirst({
          where: { is_active: true },
          select: { id: true },
          orderBy: { sort_order: 'asc' }
        });
        newBranchId = fallbackDept?.id;
      }

      
        
      data.branchId = newBranchId ?? visit.branchId;
    }

    return data;
  }

  private async requireVisit(
    id: string,
    client: Prisma.TransactionClient,
    includeVisitor: boolean,
    includeHostEmployee: boolean,
  ) {
    const visit = await client.visit.findFirst({
      where: { id, deletedAt: null },
      select: this.visitSelect(includeVisitor, includeHostEmployee),
    });

    if (!visit) throw new VisitNotFoundException();
    return visit;
  }

  private visitSelect(includeVisitor: boolean, includeHostEmployee: boolean) {
    if (includeVisitor && includeHostEmployee) return {
      id: true,
      visitorId: true,
      branchId: true,
      hostEmployeeId: true,
      status: true,
      visitCode: true,
      purpose: true,
      peopleCount: true,
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
      visitor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          mobileNumber: true,
          status: true,
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

    if (includeVisitor) return {
      id: true,
      visitorId: true,
      branchId: true,
      hostEmployeeId: true,
      status: true,
      visitCode: true,
      purpose: true,
      peopleCount: true,
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
      visitor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          mobileNumber: true,
          status: true,
        },
      },
    } satisfies Prisma.VisitSelect;

    if (includeHostEmployee) return {
      id: true,
      visitorId: true,
      branchId: true,
      hostEmployeeId: true,
      status: true,
      visitCode: true,
      purpose: true,
      peopleCount: true,
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

    return {
      id: true,
      visitorId: true,
      branchId: true,
      hostEmployeeId: true,
      status: true,
      visitCode: true,
      purpose: true,
      peopleCount: true,
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
  }

  private generateVisitCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${VISIT_CODE_PREFIX}-${timestamp}-${random}`;
  }

  private isUniqueCodeCollision(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async runInTransaction<T>(
    tx: Prisma.TransactionClient | undefined,
    work: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (tx) return work(tx);
    return this.prisma.$transaction((client) => work(client));
  }
}
