import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // AuthModule,
    // UsersModule,
    // TasksModule, 
    // ... future modules
  ],
})
export class AppModule {}