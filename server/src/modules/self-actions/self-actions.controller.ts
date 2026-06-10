import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SelfActionsService } from './self-actions.service';
import { CreateSelfActionDto } from './dto/create-self-action.dto';
import { UpdateSelfActionDto } from './dto/update-self-action.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { SelfActionFilterDto } from './dto/self-action-filter.dto';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

@Controller('self-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SelfActionsController {
  constructor(private readonly selfActionsService: SelfActionsService) {}

  @Post()
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD, role_enum.EA, role_enum.PA)
  create(
    @Body() dto: CreateSelfActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.selfActionsService.create(dto, user);
  }

  @Get()
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD, role_enum.EA, role_enum.PA, role_enum.ADMIN)
  findAll(
    @Query() filter: SelfActionFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.selfActionsService.findAll(user, filter);
  }

  @Get(':id')
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD, role_enum.EA, role_enum.PA, role_enum.ADMIN)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.selfActionsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD, role_enum.EA, role_enum.PA, role_enum.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSelfActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.selfActionsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD, role_enum.EA, role_enum.PA, role_enum.ADMIN)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.selfActionsService.changeStatus(id, dto, user);
  }

  @Delete(':id')
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD, role_enum.EA, role_enum.PA, role_enum.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.selfActionsService.softDelete(id, user);
  }
}