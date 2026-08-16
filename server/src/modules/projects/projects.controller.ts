import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectFilterDto } from './dto/project-filter.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

/**
 * Every role except VENDOR.
 *
 * Project visibility is company wide, so the guard's job here is only to keep
 * external accounts out. A vendor sees the projects in `vendor_assignments`
 * and nothing else, through the vendor portal; adding VENDOR to any list on
 * this controller would hand them the whole directory, and `just vendor-roles`
 * fails the build if anyone tries.
 */
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
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  /** Creates a project with the caller, or a named user, as its Lead. */
  @Post()
  @Roles(...INTERNAL_ROLES)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  /** The project directory. See ProjectFilterDto for the filter set. */
  @Get()
  @Roles(...INTERNAL_ROLES)
  findAll(
    @Query() filter: ProjectFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(filter, user);
  }

  /**
   * The directory narrowed to the caller's own projects.
   *
   * Declared above `/projects/:id` because Nest matches in declaration order
   * and would otherwise read "mine" as an id.
   */
  @Get('mine')
  @Roles(...INTERNAL_ROLES)
  findMine(
    @Query() filter: ProjectFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findMine(filter, user);
  }

  /** One project with its member list. Readable by any internal user. */
  @Get(':id')
  @Roles(...INTERNAL_ROLES)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /** Lead and Co-Lead only. Status moves through the transition table. */
  @Patch(':id')
  @Roles(...INTERNAL_ROLES)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  /** Soft delete. Lead or MD only, enforced in the service. */
  @Delete(':id')
  @Roles(...INTERNAL_ROLES)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user);
  }

  /** Invites a MEMBER or OBSERVER. Lead and Co-Lead only. */
  @Post(':id/members')
  @Roles(...INTERNAL_ROLES)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addMember(id, dto, user);
  }

  /** Removes a member. Lead and Co-Lead only, and never the Lead. */
  @Delete(':id/members/:userId')
  @Roles(...INTERNAL_ROLES)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeMember(id, userId, user);
  }

  /** The immutable activity history. Readable by any internal user. */
  @Get(':id/activity')
  @Roles(...INTERNAL_ROLES)
  findActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findActivity(id);
  }
}
