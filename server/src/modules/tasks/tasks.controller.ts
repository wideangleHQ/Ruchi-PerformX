import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { role_enum , task_status_enum } from '@prisma/client';
import { UploadedFile } from '../../common/types/uploaded-file.type';

const ASSISTANT_ROLES = [role_enum.EA, role_enum.PA, role_enum.DEPARTMENT_CONTROLLER];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── Create ────────────────────────────────────────────────────

  @Post()
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  @UseInterceptors(FilesInterceptor('attachments'))
  create(
    @Body() dto: CreateTaskDto,
    @UploadedFiles() attachments: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.create(dto, user, attachments ?? []);
  }

  // ─── List ──────────────────────────────────────────────────────

  @Get()
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  findAll(@Query() filters: TaskFilterDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findAll(filters, user);
  }

  // ─── Pending Bar ───────────────────────────────────────────────

  @Get('pending')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  getPending(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getPending(user);
  }

  // ─── Overdue ───────────────────────────────────────────────────

  @Get('overdue')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  getOverdue(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getOverdue(user);
  }

  @Get('meta/departments')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  getDepartments(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getDepartments(user);
  }

  @Get('meta/assignees')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  getAssignees(
    @Query('departmentIds') departmentIds: string | string[] | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.getAssignees(departmentIds, user);
  }

  // ─── Find One ──────────────────────────────────────────────────

  @Get('meta/delegation-departments')
  @Roles(role_enum.HOD)
  getDelegationDepartments(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getDelegationDepartments(user);
  }

  @Get('delegated-out')
  @Roles(role_enum.HOD)
  getDelegatedOut(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getDelegatedOut(user);
  }

  @Get(':id')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findOne(id, user);
  }

  // ─── Update Fields ─────────────────────────────────────────────

  @Patch(':id')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  // ─── Delete ────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  remove(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.remove(id, user, reason);
  }

  // ─── State Transitions ─────────────────────────────────────────

  @Patch(':id/accept')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES)
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.IN_PROGRESS, user);
  }

  @Patch(':id/reject')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES)
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transition(id, task_status_enum.REJECTED, user, reason);
  }

  @Patch(':id/progress')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES)
  markInProgress(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.IN_PROGRESS, user);
  }

  @Patch(':id/complete')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, ...ASSISTANT_ROLES)
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.COMPLETED, user);
  }

  @Patch(':id/review')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD)
  review(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.CLOSED, user);
  }

  @Patch(':id/close')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES)
  close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.REJECTED, user);
  }

  @Patch(':id/return')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES)
  returnForRework(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transition(id, task_status_enum.IN_PROGRESS, user, reason);
  }
  @Patch(':id/status')
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: task_status_enum,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transition(id, status, user, reason);
  }
}

