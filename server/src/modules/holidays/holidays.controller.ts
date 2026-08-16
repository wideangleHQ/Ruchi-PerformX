// src/modules/holidays/holidays.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

// HR and ADMIN write both tiers, a HOD writes only their own departments. The
// department check is in the service, because RolesGuard knows nothing about
// which departments a HOD holds.
const HOLIDAY_WRITERS = [role_enum.HR, role_enum.HOD, role_enum.ADMIN];

@Controller('holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  /** Effective calendar for the caller, both tiers merged. Any authenticated user. */
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.holidaysService.findAll(user, year);
  }

  // Declared above the parameterised routes. Nest matches in declaration order
  // and would otherwise read "upcoming" as an id.
  /** The next few holidays with a day count, for the dashboard banner. */
  @Get('upcoming')
  findUpcoming(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.holidaysService.findUpcoming(user, limit);
  }

  @Post()
  @Roles(...HOLIDAY_WRITERS)
  create(@Body() dto: CreateHolidayDto, @CurrentUser() user: JwtPayload) {
    return this.holidaysService.create(dto, user);
  }

  @Patch(':id')
  @Roles(...HOLIDAY_WRITERS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.holidaysService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...HOLIDAY_WRITERS)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.holidaysService.remove(id, user);
  }
}
