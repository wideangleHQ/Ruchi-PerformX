import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './modules/email/email.module';
import { JwtAuthGuard } from './common/gaurds/jwt-auth.guard';
import { RolesGuard } from './common/gaurds/roles.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EmailModule,
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
  ],
})
export class AppModule {}