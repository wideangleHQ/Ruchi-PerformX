import { Module } from '@nestjs/common';
import { AccessController } from './controllers/access.controller';
import { AccessService } from './services/access.service';
import { IAccessServiceToken } from './services/access.service.interface';
import { AccessRepository } from './repositories/access.repository';
import { IAccessRepositoryToken } from './repositories/access.repository.interface';

@Module({
  controllers: [AccessController],
  providers: [
    {
      provide: IAccessServiceToken,
      useClass: AccessService,
    },
    {
      provide: IAccessRepositoryToken,
      useClass: AccessRepository,
    },
  ],
  exports: [IAccessServiceToken],
})
export class AccessModule {}
