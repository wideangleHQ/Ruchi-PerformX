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
  ForbiddenException,
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
import { role_enum, task_type_enum } from '@prisma/client';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks/employee-sharing')
export class EmployeeSharingController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(role_enum.EMPLOYEE)
  @UseInterceptors(FilesInterceptor('attachments'))
  create(
    @Body() dto: CreateTaskDto,
    @UploadedFiles() attachments: UploadedFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.departmentId) {
      throw new ForbiddenException('User department not found');
    }
    
    dto.taskType = task_type_enum.EMPLOYEE_SHARED;
    dto.departmentId = user.departmentId;
    dto.departmentIds = [user.departmentId];

    return this.tasksService.create(dto, user, attachments ?? []);
  }

  @Get()
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  findAll(@Query() filters: TaskFilterDto, @CurrentUser() user: JwtPayload) {
    filters.taskType = task_type_enum.EMPLOYEE_SHARED;
    return this.tasksService.findAll(filters, user);
  }

  @Get('assignees')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  getAssignees(
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.departmentId) {
      return [];
    }
    
    return this.tasksService.getEmployeeSharedAssignees(user.departmentId, user.sub);
  }

  @Patch(':id/status')
  @Roles(role_enum.MD, role_enum.HOD, role_enum.EMPLOYEE, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: any,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transition(id, status, user, reason);
  }

  @Delete(':id')
  @Roles(role_enum.HOD, role_enum.MD)
  remove(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.remove(id, user, reason);
  }
}
