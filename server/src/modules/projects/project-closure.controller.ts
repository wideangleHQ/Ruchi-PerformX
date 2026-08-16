import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { ProjectClosureService } from './project-closure.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectClosureController {
  constructor(private readonly service: ProjectClosureService) {}
}
