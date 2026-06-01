import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { JwtPayload } from '../../common/types/jwt-payload.type';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  getMyNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.notificationsService.getUserNotifications(
      user.sub,
      Number(page),
      Number(limit),
    );
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.getUnreadCount(
      user.sub,
    );
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(
      id,
      user.sub,
    );
  }

  @Delete(':id')
  deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.deleteNotification(
      id,
      user.sub,
    );
  }
}