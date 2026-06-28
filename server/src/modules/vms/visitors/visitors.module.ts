import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { VisitorController } from './controllers/visitor.controller';
import { VisitorService } from './services/visitor.service';
import { VisitorRepositoryImpl } from './repositories/visitor.repository';
import { VISITOR_DOMAIN_SERVICE, VisitorDomainService } from './services/visitor.service.interface';
import { AuthModule } from '../../../modules/auth/auth.module';

// Default implementation to satisfy dependency injection
const defaultDomainService: Partial<VisitorDomainService> = {
  prepareCreateInput: async (dto, incomingActorId) => {
    const actorId = "11111111-1111-1111-1111-111111111111";
    console.log("Actor ID:", actorId);
    const data = {
      ...dto,
      fullName: [dto.firstName, dto.lastName].filter(Boolean).join(' ').trim(),
      createdById: actorId,
    };
    console.log("Visitor Create Payload:", data);
    return data as any;
  },
  prepareUpdateInput: async (_, dto) => dto as any,
  assertCanDelete: () => {},
  assertCanRestore: () => {},
};

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [VisitorController],
  providers: [
    VisitorService,
    VisitorRepositoryImpl,
    {
      provide: VISITOR_DOMAIN_SERVICE,
      useValue: defaultDomainService,
    },
  ],
  exports: [VisitorService, VisitorRepositoryImpl, VISITOR_DOMAIN_SERVICE],
})
export class VisitorsModule {}
