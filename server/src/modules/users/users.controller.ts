// src/modules/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── ROLE CONSTRAINT CHECKS ──────────────────────────────────────────────────

  @Get('check-md')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.ADMIN)
  async checkMd() {
    const exists = await this.usersService.checkMdExists();
    return { exists };
  }

  @Get('check-hod/:departmentId')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.ADMIN)
  async checkHod(@Param('departmentId') departmentId: string) {
    const exists = await this.usersService.checkHodExists(departmentId);
    return { exists };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  @Get()
  @Roles(role_enum.MD, role_enum.ADMIN, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  async findAll(@Query('active') active?: string) {
    const users = await this.usersService.findAll(active === 'true');
    console.log("Users API Response:", users);
    return users;
  }

  @Get('assignable')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.DEPARTMENT_CONTROLLER, role_enum.PURCHASE_HEAD)
  findAssignable(
    @CurrentUser() user: JwtPayload,
    @Query('departmentId') departmentId?: string,
    @Query('role') role?: role_enum,
  ) {
    return this.usersService.findAssignable(user, departmentId, role);
  }

  @Get('department/:departmentId')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.ADMIN, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  findByDepartment(@Param('departmentId') departmentId: string) {
    return this.usersService.findByDepartment(departmentId);
  }

  @Get(':id')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.ADMIN, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(role_enum.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(role_enum.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(role_enum.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // ─── APPROVAL WORKFLOW ────────────────────────────────────────────────────────

  @Get('pending')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  findPending(@CurrentUser() user: JwtPayload) {
    return this.usersService.findPending(user);
  }

  @Patch(':id/approve')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.approve(id, user);
  }

  @Patch(':id/reject')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.reject(id, user);
  }

  // ─── PASSWORD RESET WORKFLOW ──────────────────────────────────────────────────

  @Get('password-reset-requests')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  findPasswordResetRequests(@CurrentUser() user: JwtPayload) {
    return this.usersService.findPasswordResetRequests(user);
  }

  @Patch(':id/reset-password')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.ADMIN)
  resetPassword(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.resetPassword(id, user);
  }

  @Patch(':id/admin-reset-password')
  @Roles(role_enum.ADMIN)
  adminResetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.usersService.adminResetPassword(id, newPassword);
  }
}
