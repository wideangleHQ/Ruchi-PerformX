import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AppointmentController } from './controllers/appointment.controller';
import { AppointmentService } from './services/appointment.service';
import { IAppointmentServiceToken } from './services/appointment.service.interface';
import { AppointmentRepository } from './repositories/appointment.repository';
import { IAppointmentRepositoryToken } from './repositories/appointment.repository.interface';
import { VisitorsModule } from '../visitors/visitors.module';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [PrismaModule, VisitorsModule, AuthModule],
  controllers: [AppointmentController],
  providers: [
    {
      provide: IAppointmentServiceToken,
      useClass: AppointmentService,
    },
    {
      provide: IAppointmentRepositoryToken,
      useClass: AppointmentRepository,
    },
  ],
  exports: [IAppointmentServiceToken],
})
export class AppointmentsModule {}
