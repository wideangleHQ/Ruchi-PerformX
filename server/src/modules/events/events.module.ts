import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file.
//
// AttachmentsModule is here for receipt uploads: the events tables have no
// attachment foreign key, but the Supabase client, the file type and size
// rules, and the URL signing all live there and are not worth a second copy.
// NotificationsModule came off the stub because nothing here notifies anyone.
@Module({
  imports: [AuthModule, PrismaModule, AttachmentsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
