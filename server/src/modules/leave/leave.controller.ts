import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import type { Response } from 'express';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { LeaveService } from './leave.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import {
  ApproveLeaveDto,
  HrCancelLeaveDto,
  RejectLeaveDto,
} from './dto/leave-decision.dto';
import {
  LeaveApplicationFilterDto,
  LeaveBalanceFilterDto,
  LeaveCalendarQueryDto,
  MonthlyReportQueryDto,
} from './dto/leave-query.dto';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';

/**
 * Everybody on the payroll. Listed rather than left open, because an empty
 * `@Roles` means any authenticated principal and VENDOR is one of those.
 */
const STAFF_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.PURCHASE_HEAD,
  role_enum.HOD,
  role_enum.EMPLOYEE,
  role_enum.ADMIN,
  role_enum.HR,
];

/**
 * The MD is on approve and reject because an approver's own application routes
 * to them, and there is nobody else above a HOD or HR to close it.
 */
const APPROVER_ROLES: role_enum[] = [role_enum.HOD, role_enum.HR, role_enum.MD];

@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // Literal paths first. `applications/pending` and `applications/mine` below
  // `applications/:id` would be shadowed, and the 404 that produces looks like
  // a data problem rather than a routing one.

  @Post('applications')
  @Roles(...STAFF_ROLES)
  create(
    @Body() dto: CreateLeaveApplicationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.create(dto, user);
  }

  @Get('applications/pending')
  @Roles(...APPROVER_ROLES)
  findPending(
    @Query() filter: LeaveApplicationFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.findPending(user, filter);
  }

  @Get('applications/mine')
  @Roles(...STAFF_ROLES)
  findMine(
    @Query() filter: LeaveApplicationFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.findMine(user, filter);
  }

  @Get('applications/:id')
  @Roles(...STAFF_ROLES)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.findOne(id, user);
  }

  @Patch('applications/:id/cancel')
  @Roles(...STAFF_ROLES)
  cancelOwn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.cancelOwn(id, user);
  }

  @Patch('applications/:id/approve')
  @Roles(...APPROVER_ROLES)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveLeaveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.approve(id, dto, user);
  }

  @Patch('applications/:id/reject')
  @Roles(...APPROVER_ROLES)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectLeaveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.reject(id, dto, user);
  }

  @Patch('applications/:id/hr-cancel')
  @Roles(role_enum.HR)
  hrCancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HrCancelLeaveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.hrCancel(id, dto, user);
  }

  @Get('balance')
  @Roles(...STAFF_ROLES)
  myBalance(@CurrentUser() user: JwtPayload) {
    return this.leaveService.myBalance(user);
  }

  @Get('calendar')
  @Roles(...STAFF_ROLES)
  calendar(
    @Query() query: LeaveCalendarQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leaveService.calendar(query, user);
  }

  @Get('types')
  @Roles(...STAFF_ROLES)
  listTypes(@CurrentUser() user: JwtPayload) {
    return this.leaveService.listTypes(user);
  }

  @Post('types')
  @Roles(role_enum.HR, role_enum.ADMIN)
  createType(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveService.createType(dto);
  }

  @Patch('types/:id')
  @Roles(role_enum.HR, role_enum.ADMIN)
  updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leaveService.updateType(id, dto);
  }

  @Get('balances')
  @Roles(role_enum.HR)
  listBalances(@Query() filter: LeaveBalanceFilterDto) {
    return this.leaveService.listBalances(filter);
  }

  @Patch('balances/:id')
  @Roles(role_enum.HR)
  updateBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveBalanceDto,
  ) {
    return this.leaveService.updateBalance(id, dto);
  }

  @Get('reports/monthly')
  @Roles(role_enum.HR, role_enum.MD)
  monthlyReport(@Query() query: MonthlyReportQueryDto) {
    return this.leaveService.monthlyReport(query);
  }

  /** The same report as xlsx. Streams a file, so it sets its own headers. */
  @Get('reports/export')
  @Roles(role_enum.HR, role_enum.MD)
  async exportMonthly(
    @Query() query: MonthlyReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.leaveService.exportMonthly(query);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  }
}
