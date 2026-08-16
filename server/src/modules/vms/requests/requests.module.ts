import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { VisitorRepositoryImpl } from '../visitors/repositories/visitor.repository';
import { VisitRepositoryImpl } from '../visits/repositories/visit.repository';
import { VisitService } from '../visits/services/visit.service';
import { VisitorRequestController } from './controllers/visitor-request.controller';
import { VisitorRequestRepositoryImpl } from './repositories/visitor-request.repository';
import { VisitorRequestService } from './services/visitor-request.service';
import { AuthModule } from '../../../modules/auth/auth.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  // This module provides its own VisitService instance rather than importing
  // VisitsModule, so it has to satisfy that service's dependencies itself.
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [VisitorRequestController],
  providers: [
    VisitorRequestService,
    VisitService,
    VisitorRepositoryImpl,
    VisitRepositoryImpl,
    VisitorRequestRepositoryImpl,
    { provide: 'VisitorRepository', useExisting: VisitorRepositoryImpl },
    { provide: 'VisitRepository', useExisting: VisitRepositoryImpl },
    { provide: 'VisitorRequestRepository', useExisting: VisitorRequestRepositoryImpl },
  ],
  exports: [VisitorRequestService],
})
export class RequestsModule {}
