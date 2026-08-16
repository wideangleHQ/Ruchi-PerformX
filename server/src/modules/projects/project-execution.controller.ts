import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { ProjectExecutionService } from './project-execution.service';

import { CreateChecklistItemDto } from './dto/checklist/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/checklist/update-checklist-item.dto';
import { CreateMilestoneDto } from './dto/milestone/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/milestone/update-milestone.dto';
import { CreateSuccessCriterionDto } from './dto/criteria/create-success-criterion.dto';
import { CreateKpiDto } from './dto/kpi/create-kpi.dto';
import { UpdateKpiDto } from './dto/kpi/update-kpi.dto';

/**
 * Every internal role. Project visibility is company-wide, so the only thing
 * `@Roles` has to do here is keep VENDOR out: a vendor sees the projects listed
 * for it in `vendor_assignments` through the vendor portal, never this
 * controller. Lead and Co-Lead gating is service-layer work, because the JWT
 * does not know who leads which project.
 */
const INTERNAL_ROLES = [
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
 * The execution surface of a project: checklist, milestones, success criteria
 * and KPIs. Ownership, membership and messaging live in the sibling
 * controllers on the same `projects` prefix.
 */
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectExecutionController {
  constructor(private readonly service: ProjectExecutionService) {}

  // ------------------------------------------------------------ checklist

  /** Checklist items with derived `is_overdue`, plus the derived progress. */
  @Get(':id/checklist')
  @Roles(...INTERNAL_ROLES)
  listChecklist(@Param('id') id: string) {
    return this.service.listChecklist(id);
  }

  @Post(':id/checklist')
  @Roles(...INTERNAL_ROLES)
  addChecklistItem(
    @Param('id') id: string,
    @Body() dto: CreateChecklistItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addChecklistItem(id, dto, user);
  }

  /**
   * Lead and Co-Lead may write any field. A member's body is narrowed to
   * `is_done` on an item assigned to them, in the service, whatever it carried.
   */
  @Patch(':id/checklist/:itemId')
  @Roles(...INTERNAL_ROLES)
  updateChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateChecklistItem(id, itemId, dto, user);
  }

  @Delete(':id/checklist/:itemId')
  @Roles(...INTERNAL_ROLES)
  removeChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeChecklistItem(id, itemId, user);
  }

  // ------------------------------------------------------------ milestones

  @Get(':id/milestones')
  @Roles(...INTERNAL_ROLES)
  listMilestones(@Param('id') id: string) {
    return this.service.listMilestones(id);
  }

  @Post(':id/milestones')
  @Roles(...INTERNAL_ROLES)
  addMilestone(
    @Param('id') id: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addMilestone(id, dto, user);
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles(...INTERNAL_ROLES)
  updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateMilestone(id, milestoneId, dto, user);
  }

  @Delete(':id/milestones/:milestoneId')
  @Roles(...INTERNAL_ROLES)
  removeMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeMilestone(id, milestoneId, user);
  }

  // ------------------------------------------------------ success criteria

  @Get(':id/success-criteria')
  @Roles(...INTERNAL_ROLES)
  listSuccessCriteria(@Param('id') id: string) {
    return this.service.listSuccessCriteria(id);
  }

  @Post(':id/success-criteria')
  @Roles(...INTERNAL_ROLES)
  addSuccessCriterion(
    @Param('id') id: string,
    @Body() dto: CreateSuccessCriterionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addSuccessCriterion(id, dto, user);
  }

  @Delete(':id/success-criteria/:criterionId')
  @Roles(...INTERNAL_ROLES)
  removeSuccessCriterion(
    @Param('id') id: string,
    @Param('criterionId') criterionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeSuccessCriterion(id, criterionId, user);
  }

  // ------------------------------------------------------------------ KPIs

  @Get(':id/kpis')
  @Roles(...INTERNAL_ROLES)
  listKpis(@Param('id') id: string) {
    return this.service.listKpis(id);
  }

  @Post(':id/kpis')
  @Roles(...INTERNAL_ROLES)
  addKpi(
    @Param('id') id: string,
    @Body() dto: CreateKpiDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addKpi(id, dto, user);
  }

  @Patch(':id/kpis/:kpiId')
  @Roles(...INTERNAL_ROLES)
  updateKpi(
    @Param('id') id: string,
    @Param('kpiId') kpiId: string,
    @Body() dto: UpdateKpiDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateKpi(id, kpiId, dto, user);
  }
}
