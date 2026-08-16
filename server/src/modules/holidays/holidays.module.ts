import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file.
//
// No NotificationsModule. Nothing about a holiday notifies anybody; the
// dashboard banner reads GET /holidays/upcoming on load. DepartmentScopeService
// arrives through the global CommonModule.
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HolidaysController],
  providers: [HolidaysService],
  exports: [HolidaysService],
})
export class HolidaysModule {}
