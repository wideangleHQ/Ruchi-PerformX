// src/modules/self-actions/self-actions.module.ts

import { Module } from '@nestjs/common';
import { SelfActionsController } from './self-actions.controller';
import { SelfActionsService } from './self-actions.service';
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [SelfActionsController],
  providers: [SelfActionsService],
  exports: [SelfActionsService],
})
export class SelfActionsModule {}