import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { ProjectClosureService } from './project-closure.service';
import { CreateClosureReportDto } from './dto/closure/create-closure-report.dto';

// Anyone on staff can lead a project, so the role list is every internal role.
// Lead and Co-Lead are project membership, not JWT roles, and RolesGuard cannot
// see membership — the service checks that.
const INTERNAL_ROLES: role_enum[] = [
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

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectClosureController {
  constructor(private readonly service: ProjectClosureService) {}

  /** File the closure report. Lead and Co-Lead only, enforced in the service. */
  @Post(':id/closure')
  @Roles(...INTERNAL_ROLES)
  submit(
    @Param('id') id: string,
    @Body() dto: CreateClosureReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submit(id, dto, user);
  }

  /** Read the closure report. Visible to everyone who can read the project. */
  @Get(':id/closure')
  @Roles(...INTERNAL_ROLES)
  find(@Param('id') id: string) {
    return this.service.find(id);
  }

  /** Complete the project. Requires the closure report to already exist. */
  @Patch(':id/close')
  @Roles(...INTERNAL_ROLES)
  close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.close(id, user);
  }
}
