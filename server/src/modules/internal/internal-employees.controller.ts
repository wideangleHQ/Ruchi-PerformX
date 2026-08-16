import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { InternalApiGuard } from '../../common/gaurds/internal-api.guard';
import { Public } from '../../common/decorators/public.decorator';

import { InternalEmployeesService } from './internal-employees.service';

@ApiExcludeController()
@Public()
@Controller('internal/employees')
@UseGuards(InternalApiGuard)
export class InternalEmployeesController {
  private readonly logger = new Logger(InternalEmployeesController.name);

  constructor(
    private readonly internalEmployeesService: InternalEmployeesService,
  ) {}

  /**
   * The endpoint the CareerX employee sync cron has been 404ing on since it was
   * written. Authenticated by the `x-internal-api-key` header, not a JWT.
   *
   * Throws UnauthorizedException from InternalApiGuard on a bad key.
   */
  @Get()
  async getEmployees() {
    this.logger.log('Internal Employee Sync Request');
    return this.internalEmployeesService.findInternal();
  }
}
