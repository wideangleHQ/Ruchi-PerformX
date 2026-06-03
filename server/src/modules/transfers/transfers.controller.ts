import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferActionDto } from './dto/transfer-action.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @Roles(role_enum.HOD, role_enum.MD)
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: JwtPayload) {
    return this.transfersService.create(dto, user);
  }

  @Get()
  @Roles(role_enum.HOD, role_enum.MD)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.transfersService.findAll(user);
  }

  @Get(':id')
  @Roles(role_enum.HOD, role_enum.MD)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.transfersService.findOne(id, user);
  }

  @Patch(':id/approve')
  @Roles(role_enum.HOD, role_enum.MD)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body() dto: TransferActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transfersService.approve(id, dto, user);
  }

  @Patch(':id/reject')
  @Roles(role_enum.HOD, role_enum.MD)
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body() dto: TransferActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transfersService.reject(id, dto, user);
  }
}