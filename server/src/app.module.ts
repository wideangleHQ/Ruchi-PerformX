import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/gaurds/jwt-auth.guard';
import { RolesGuard } from './common/gaurds/roles.guard';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EmailModule,
    PrismaModule,
    AuthModule,
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
  ],
})
export class AppModule {}