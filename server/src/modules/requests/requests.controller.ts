import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestFilterDto } from './dto/request-filter.dto';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles(role_enum.EMPLOYEE, role_enum.HOD)
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: JwtPayload) {
    return this.requestsService.create(dto, user);
  }

  @Get()
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD)
  findAll(@Query() filters: RequestFilterDto, @CurrentUser() user: JwtPayload) {
    return this.requestsService.findAll(filters, user);
  }

  @Get(':id')
  @Roles(role_enum.EMPLOYEE, role_enum.HOD, role_enum.MD)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.requestsService.findOne(id, user);
  }

  @Patch(':id/approve')
  @Roles(role_enum.HOD, role_enum.MD)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.requestsService.approve(id, user);
  }

  @Patch(':id/reject')
  @Roles(role_enum.HOD, role_enum.MD)
  reject(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.requestsService.reject(id, dto, user);
  }
}