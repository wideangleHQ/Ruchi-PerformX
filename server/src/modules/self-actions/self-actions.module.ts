// src/modules/self-actions/self-actions.module.ts

import { Module } from '@nestjs/common';
import { SelfActionsController } from './self-actions.controller';
import { SelfActionsService } from './self-actions.service';
import { AuthModule } from '../auth/auth.module'
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [AuthModule, AttachmentsModule],
  controllers: [SelfActionsController],
  providers: [SelfActionsService],
  exports: [SelfActionsService],
})
export class SelfActionsModule {}
