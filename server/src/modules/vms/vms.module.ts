import { Module } from '@nestjs/common';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PassesModule } from './passes/passes.module';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { VisitorsModule } from './visitors/visitors.module';
import { VisitsModule } from './visits/visits.module';
import { AccessModule } from './access/access.module';

@Module({
  imports: [
    AccessModule,
    AppointmentsModule,
    AuditModule,
    DashboardModule,
    PassesModule,
    ReportsModule,
    RequestsModule,
    VisitorsModule,
    VisitsModule,
  ],
})
export class VmsModule {}
