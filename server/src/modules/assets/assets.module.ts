import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { loadAssetKey } from './asset-crypto';

// Same treatment JWT_SECRET gets in auth.module.ts: a missing or wrong length
// ASSET_ENCRYPTION_KEY kills the process at import. Booting without it would
// mean every stored password is unreadable, discovered by whoever pressed
// reveal first.
loadAssetKey(process.env.ASSET_ENCRYPTION_KEY);

// Registered in app.module.ts by the Phase 2 spine so that feature work never
// has to touch that file.
@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule, AttachmentsModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
