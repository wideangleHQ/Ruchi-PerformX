// src/modules/hod-score/hod-score.module.ts

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { HodScoreController } from './hod-score.controller';
import { HodScoreService } from './hod-score.service';
import { HodScoreAccessGuard } from './guards/hod-score-access.guard';

/**
 * HodScoreModule
 *
 * Self-contained scoring module. The throttler is configured here rather than
 * globally so existing endpoints keep their current behaviour - only routes in
 * this module are rate limited.
 *
 * RedisService and DepartmentScopeService come from the @Global CommonModule.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ThrottlerModule.forRoot([
      { name: 'hod-score-short', ttl: 1_000, limit: 5 },
      { name: 'hod-score-long', ttl: 60_000, limit: 60 },
    ]),
  ],
  controllers: [HodScoreController],
  providers: [HodScoreService, HodScoreAccessGuard],
  exports: [HodScoreService],
})
export class HodScoreModule {}
