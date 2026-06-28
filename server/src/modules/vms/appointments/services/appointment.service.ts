import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Visit, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IAppointmentService } from './appointment.service.interface';
import {
  DbClient,
  IAppointmentRepository,
  IAppointmentRepositoryToken,
  PaginatedVisitResponse,
} from '../repositories/appointment.repository.interface';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../dto/update-appointment.dto';
import { SearchAppointmentDto } from '../dto/search-appointment.dto';
import { VisitorService } from '../../visitors/services/visitor.service';

@Injectable()
export class AppointmentService implements IAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IAppointmentRepositoryToken)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly visitorService: VisitorService,
  ) {}

  async createAppointment(dto: CreateAppointmentDto, actorId: string, tx?: DbClient): Promise<Visit> {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt < new Date()) {
      throw new BadRequestException('Appointment date cannot be in the past.');
    }

    const visitorExists = await this.visitorService.exists({ id: dto.visitorId }, tx as any);
    if (!visitorExists) {
      throw new NotFoundException('Visitor not found.');
    }

    const client = tx || this.prisma;
    const employeeExists = await client.users.findUnique({ where: { id: dto.hostEmployeeId } });
    if (!employeeExists) {
      throw new NotFoundException('Host employee not found.');
    }

    const overlap = await client.visit.findFirst({
      where: {
        hostEmployeeId: dto.hostEmployeeId,
        scheduledAt: scheduledAt,
        status: VisitStatus.SCHEDULED,
        deletedAt: null,
      },
    });

    if (overlap) {
      throw new BadRequestException('Host employee already has an appointment at this time.');
    }

    return this.appointmentRepository.create(
      {
        visitorId: dto.visitorId,
        branchId: dto.branchId,
        hostEmployeeId: dto.hostEmployeeId,
        purpose: dto.purpose,
        meetingDetails: dto.meetingDetails || null,
        scheduledAt,
        status: VisitStatus.SCHEDULED,
        createdById: actorId,
      },
      client,
    );
  }

  async updateAppointment(id: string, dto: UpdateAppointmentDto, actorId: string, tx?: DbClient): Promise<Visit> {
    const existing = await this.appointmentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundException('Appointment not found.');
    }

    if (dto.scheduledAt) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt < new Date()) {
        throw new BadRequestException('Appointment date cannot be in the past.');
      }
    }

    return this.appointmentRepository.update(
      id,
      {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt,
        updatedById: actorId,
      },
      tx,
    );
  }

  async cancelAppointment(id: string, actorId: string, tx?: DbClient): Promise<Visit> {
    const existing = await this.appointmentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundException('Appointment not found.');
    }

    return this.appointmentRepository.cancel(id, tx);
  }

  async completeAppointment(id: string, actorId: string, tx?: DbClient): Promise<Visit> {
    const existing = await this.appointmentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundException('Appointment not found.');
    }

    return this.appointmentRepository.complete(id, tx);
  }

  async rescheduleAppointment(id: string, newDate: string, actorId: string, tx?: DbClient): Promise<Visit> {
    const existing = await this.appointmentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundException('Appointment not found.');
    }

    const scheduledAt = new Date(newDate);
    if (scheduledAt < new Date()) {
      throw new BadRequestException('Appointment date cannot be in the past.');
    }

    const client = tx || this.prisma;
    const overlap = await client.visit.findFirst({
      where: {
        hostEmployeeId: existing.hostEmployeeId,
        scheduledAt,
        status: VisitStatus.SCHEDULED,
        deletedAt: null,
        id: { not: id },
      },
    });

    if (overlap) {
      throw new BadRequestException('Host employee already has an appointment at this time.');
    }

    return this.appointmentRepository.update(
      id,
      {
        scheduledAt,
        updatedById: actorId,
      },
      tx,
    );
  }

  async getAppointment(id: string, tx?: DbClient): Promise<Visit> {
    const appointment = await this.appointmentRepository.findById(id, tx);
    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }
    return appointment;
  }

  async searchAppointments(filters: SearchAppointmentDto, tx?: DbClient): Promise<PaginatedVisitResponse> {
    return this.appointmentRepository.search(filters, tx);
  }

  async getTodayAppointments(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]> {
    return this.appointmentRepository.findToday(hostEmployeeId, tx);
  }

  async getUpcomingAppointments(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]> {
    return this.appointmentRepository.findUpcoming(hostEmployeeId, tx);
  }
}
