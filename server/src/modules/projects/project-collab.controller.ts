import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { ProjectCollabService } from './project-collab.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectCollabController {
  constructor(private readonly service: ProjectCollabService) {}
}
