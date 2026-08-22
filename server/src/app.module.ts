import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './modules/email/email.module';
import { JwtAuthGuard } from './common/gaurds/jwt-auth.guard';
import { RolesGuard } from './common/gaurds/roles.guard';
import { DepartmentsModule } from './modules/departments/departments.module';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module'
import { CommentsModule } from './modules/comments/comments.module'
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { TransfersModule } from './modules/transfers/transfers.module'
import { SelfActionsModule } from './modules/self-actions/self-actions.module'
import { ScoringModule } from './modules/scoring/scoring.module'
import { HodScoreModule } from './modules/hod-score/hod-score.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProfileModule } from './modules/profile/profile.module';
import { RequestsModule } from './modules/requests/requests.module';
import { VmsModule } from './modules/vms/vms.module';
import { EscalationModule } from './modules/escalation/escalation.module';
import { LeaveModule } from './modules/leave/leave.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RndModule } from './modules/rnd/rnd.module';
import { AssetsModule } from './modules/assets/assets.module';
import { PollsModule } from './modules/polls/polls.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { VendorPortalModule } from './modules/vendor-portal/vendor-portal.module';
import { EventsModule } from './modules/events/events.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { InternalModule } from './modules/internal/internal.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    DepartmentsModule,
    AuthModule,
    EmailModule,
    UsersModule,
    TasksModule,
    NotificationsModule,
    CommentsModule,
    AttachmentsModule,
    TransfersModule,
    SelfActionsModule,
    RequestsModule,
    ScoringModule,
    HodScoreModule,
    DashboardModule,
    ProfileModule,
    VmsModule,
    // Written in Phase 1 and never imported, so nothing has ever escalated.
    // See docs/src/p1_known_gaps.md.
    EscalationModule,
    // Phase 2. Registered here by the spine so feature branches never edit
    // this file and never conflict with each other over it.
    LeaveModule,
    HolidaysModule,
    ProjectsModule,
    RndModule,
    AssetsModule,
    PollsModule,
    VendorsModule,
    VendorPortalModule,
    EventsModule,
    AssistantModule,
    InternalModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ]

})
export class AppModule {}
