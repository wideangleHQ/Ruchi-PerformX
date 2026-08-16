import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PollsModule } from '../polls/polls.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, PollsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
