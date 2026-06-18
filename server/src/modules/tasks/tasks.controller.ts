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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── Create ────────────────────────────────────────────────────

  @Post()
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
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
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  findAll(@Query() filters: TaskFilterDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findAll(filters, user);
  }

  // ─── Pending Bar ───────────────────────────────────────────────

  @Get('pending')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  getPending(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getPending(user);
  }

  // ─── Overdue ───────────────────────────────────────────────────

  @Get('overdue')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  getOverdue(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getOverdue(user);
  }

  @Get('meta/departments')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  getDepartments(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getDepartments(user);
  }

  @Get('meta/assignees')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  getAssignees(
    @Query('departmentIds') departmentIds: string | string[] | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.getAssignees(departmentIds, user);
  }

  // ─── Find One ──────────────────────────────────────────────────

  @Get(':id')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findOne(id, user);
  }

  // ─── Update Fields ─────────────────────────────────────────────

  @Patch(':id')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  // ─── Delete ────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.remove(id, user);
  }

  // ─── State Transitions ─────────────────────────────────────────

  @Patch(':id/accept')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.ACCEPTED, user);
  }

  @Patch(':id/reject')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transition(id, task_status_enum.REJECTED, user, reason);
  }

  @Patch(':id/progress')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  markInProgress(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.IN_PROGRESS, user);
  }

  @Patch(':id/complete')
  @Roles(role_enum.MD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA)
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.COMPLETED, user);
  }

  @Patch(':id/review')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  review(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.REVIEWED, user);
  }

  @Patch(':id/close')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.transition(id, task_status_enum.CLOSED, user);
  }

  @Patch(':id/return')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA)
  returnForRework(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transition(id, task_status_enum.IN_PROGRESS, user, reason);
  }
}
