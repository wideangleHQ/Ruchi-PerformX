import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
  ],

  controllers: [
    AttachmentsController,
  ],

  providers: [
    AttachmentsService,
  ],

  exports: [
    AttachmentsService,
  ],
})
export class AttachmentsModule {}