import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { VisitorRepositoryImpl } from '../visitors/repositories/visitor.repository';
import { VisitController } from './controllers/visit.controller';
import { EmployeeController } from './employee.controller';
import { EmployeeRepository } from './employee.repository';
import { EmployeeService } from './employee.service';
import { VisitRepositoryImpl } from './repositories/visit.repository';
import { VisitService } from './services/visit.service';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [PrismaModule, VisitorsModule, AuthModule],
  controllers: [EmployeeController, VisitController],
  providers: [
    VisitService,
    EmployeeService,
    EmployeeRepository,
    { provide: 'VisitRepository', useClass: VisitRepositoryImpl },
    { provide: 'VisitorRepository', useExisting: VisitorRepositoryImpl },
  ],
  exports: [VisitService],
})
export class VisitsModule {}
