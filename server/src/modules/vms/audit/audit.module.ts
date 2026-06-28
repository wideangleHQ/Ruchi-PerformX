import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { IAuditServiceToken } from './services/audit.service.interface';
import { AuditRepository } from './repositories/audit.repository';
import { IAuditRepositoryToken } from './repositories/audit.repository.interface';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [AuditController],
  providers: [
    {
      provide: IAuditServiceToken,
      useClass: AuditService,
    },
    {
      provide: IAuditRepositoryToken,
      useClass: AuditRepository,
    },
  ],
  exports: [IAuditServiceToken],
})
export class AuditModule {}
