// src/modules/departments/departments.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DepartmentsController } from './departments.controller';
import { InternalDepartmentsController } from './internal-departments.controller';
import { DepartmentsService } from './departments.service';
import { InternalApiGuard } from '../../common/gaurds/internal-api.guard';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [ConfigModule, AuthModule, CommonModule],
  controllers: [DepartmentsController, InternalDepartmentsController],
  providers: [DepartmentsService, InternalApiGuard],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}