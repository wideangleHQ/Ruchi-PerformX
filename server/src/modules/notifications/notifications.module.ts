import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],

  controllers: [NotificationsController],

  providers: [
    NotificationsService,
    NotificationsGateway,
  ],

  exports: [
    NotificationsService,
    NotificationsGateway,
  ],
})
export class NotificationsModule {}
