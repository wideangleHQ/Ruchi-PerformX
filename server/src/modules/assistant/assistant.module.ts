import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AssetsModule } from '../assets/assets.module';
import { DepartmentsModule } from '../departments/departments.module';
import { HodScoreModule } from '../hod-score/hod-score.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { LeaveModule } from '../leave/leave.module';
import { ProjectsModule } from '../projects/projects.module';
import { RndModule } from '../rnd/rnd.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { VendorsModule } from '../vendors/vendors.module';

import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { requireAnthropicKey } from './assistant.config';

// Fails at boot rather than on the first question, the way assets does with
// ASSET_ENCRYPTION_KEY and auth does with JWT_SECRET. A missing key surfacing
// as a 500 halfway through a streamed answer is worse than not starting.
requireAnthropicKey(process.env.ANTHROPIC_API_KEY);

/**
 * Tier 1 only: the assistant reaches data by calling the same services the
 * controllers call, with the caller's own token. There is no database access
 * of its own beyond writing `assistant_exchanges`, and no generated SQL.
 *
 * Every module here already exported its service before this one existed. That
 * is the whole reason this module is small: the permission model it needs was
 * already built and already tested.
 */
@Module({
  imports: [
    AuthModule,
    PrismaModule,
    LeaveModule,
    HolidaysModule,
    TasksModule,
    ProjectsModule,
    VendorsModule,
    RndModule,
    ScoringModule,
    HodScoreModule,
    UsersModule,
    DepartmentsModule,
    AssetsModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
