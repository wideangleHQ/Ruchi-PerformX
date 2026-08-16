import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { VendorPortalService } from './vendor-portal.service';
import { SubmitDeliverableDto } from './dto/vendor-portal.dto';

/**
 * The two `/vendor-deliverables` routes a vendor may reach. The rest of that
 * prefix belongs to the internal Vendor Management module and carries no
 * VENDOR role, which is why these two live in their own class here rather than
 * as a role branch over there.
 *
 * Both paths are literal or two-segment, so they do not shadow and are not
 * shadowed by a future internal `GET /vendor-deliverables/:id`. Keep it that
 * way: Nest matches in declaration order across modules too.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(role_enum.VENDOR)
@Controller('vendor-deliverables')
export class VendorDeliverablesController {
  constructor(private readonly service: VendorPortalService) {}

  /** Deliverables belonging to this vendor and no other. */
  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.service.deliverables(user);
  }

  /** Sets SUBMITTED and stamps the date. Own deliverables only. */
  @Patch(':id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitDeliverableDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitDeliverable(user, id, dto);
  }
}
