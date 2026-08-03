// src/modules/hod-score/hod-score.controller.ts

import {
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { HodScoreService } from './hod-score.service';
import { HodScoreAccessGuard } from './guards/hod-score-access.guard';
import { HodScoreQueryDto } from './dto/hod-score-query.dto';
import { HodScoreTrendsQueryDto } from './dto/hod-score-trends-query.dto';

/**
 * HOD Score API.
 *
 * Every route is protected by, in order:
 *   JwtAuthGuard      - valid, unexpired JWT
 *   RolesGuard        - @Roles metadata (EMPLOYEE is never listed)
 *   HodScoreAccessGuard - module-level allow-list backstop
 *   ThrottlerGuard    - per-IP rate limit, scoped to this controller only
 *
 * Row-level visibility (own score vs department vs company) is enforced again
 * inside the service against DepartmentScopeService.
 */
@Controller('hod-score')
@UseGuards(JwtAuthGuard, RolesGuard, HodScoreAccessGuard, ThrottlerGuard)
@Roles(
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
)
export class HodScoreController {
  constructor(private readonly hodScoreService: HodScoreService) {}

  /** Own score. Identity is taken from the JWT, never from the query string. */
  @Get('me')
  getMyScore(
    @Query() query: HodScoreQueryDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.hodScoreService.getMyScore(user, query, { ip });
  }

  /** Company-wide list, already narrowed to what the caller may see. */
  @Get('company')
  getCompanyScores(
    @Query() query: HodScoreQueryDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.hodScoreService.getCompanyScores(user, query, { ip });
  }

  /** Monthly trend for a HOD, a department, or the visible company average. */
  @Get('trends')
  getTrends(
    @Query() query: HodScoreTrendsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hodScoreService.getTrends(user, query);
  }

  /** Every HOD of a department plus the department aggregate. */
  @Get('department/:departmentId')
  getDepartmentScore(
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Query() query: HodScoreQueryDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.hodScoreService.getDepartmentScore(user, departmentId, query, { ip });
  }

  /**
   * A single HOD's score.
   *
   * Declared last so the literal routes above are matched first and a HOD can
   * never shadow them with a crafted id.
   */
  @Get(':hodId')
  getHodScore(
    @Param('hodId', new ParseUUIDPipe()) hodId: string,
    @Query() query: HodScoreQueryDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.hodScoreService.getHodScore(user, hodId, query, { ip });
  }
}
