import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

// PS Score only. The AT Score engines are `scoring` and `hod-score`, and the
// framework keeps the two numbers apart on purpose, so this module does not
// import either.
@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [KpiController],
  providers: [KpiService],
  exports: [KpiService],
})
export class KpiModule {}
