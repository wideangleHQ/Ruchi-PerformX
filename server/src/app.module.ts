import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
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
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [
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
    ScoringModule,
    DashboardModule,
    ProfileModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
    }),
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
