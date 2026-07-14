import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { InternalApiGuard } from '../../common/gaurds/internal-api.guard';

@ApiExcludeController()
@Controller('api/v1/internal/departments')
@UseGuards(InternalApiGuard)
export class InternalDepartmentsController {
  private readonly logger = new Logger(InternalDepartmentsController.name);

  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async getDepartments() {
    this.logger.log('Internal Department Sync Request');
    return this.departmentsService.findInternal();
  }
}
