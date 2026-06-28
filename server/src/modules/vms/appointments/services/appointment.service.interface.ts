import { Visit } from '@prisma/client';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../dto/update-appointment.dto';
import { SearchAppointmentDto } from '../dto/search-appointment.dto';
import { PaginatedVisitResponse, DbClient } from '../repositories/appointment.repository.interface';

export const IAppointmentServiceToken = Symbol('IAppointmentServiceToken');

export interface IAppointmentService {
  createAppointment(dto: CreateAppointmentDto, actorId: string, tx?: DbClient): Promise<Visit>;
  updateAppointment(id: string, dto: UpdateAppointmentDto, actorId: string, tx?: DbClient): Promise<Visit>;
  cancelAppointment(id: string, actorId: string, tx?: DbClient): Promise<Visit>;
  completeAppointment(id: string, actorId: string, tx?: DbClient): Promise<Visit>;
  rescheduleAppointment(id: string, newDate: string, actorId: string, tx?: DbClient): Promise<Visit>;
  getAppointment(id: string, tx?: DbClient): Promise<Visit>;
  searchAppointments(filters: SearchAppointmentDto, tx?: DbClient): Promise<PaginatedVisitResponse>;
  getTodayAppointments(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]>;
  getUpcomingAppointments(hostEmployeeId?: string, tx?: DbClient): Promise<Visit[]>;
}
