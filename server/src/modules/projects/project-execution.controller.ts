import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { ProjectExecutionService } from './project-execution.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectExecutionController {
  constructor(private readonly service: ProjectExecutionService) {}
}
