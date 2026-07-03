// src/common/common.module.ts

import { Global, Module } from '@nestjs/common';
import { DepartmentScopeService } from './services/department-scope.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * CommonModule
 * 
 * Global module providing shared services across the application.
 * 
 * DepartmentScopeService is request-scoped for per-request caching.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [DepartmentScopeService],
  exports: [DepartmentScopeService],
})
export class CommonModule {}
