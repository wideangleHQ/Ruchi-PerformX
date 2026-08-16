import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { VendorAccessService } from './vendor-access.service';
import { GrantVendorAccessDto } from './dto/access/grant-vendor-access.dto';

/**
 * Who inside RUCHI can open Vendor Management. MD and EA only, because this is
 * the switch that decides who sees the vendor book.
 *
 * No external role appears on any route in this file, and none ever should:
 * `RolesGuard` checks the role list and nothing else, so a vendor listed here
 * would read which employees hold access and to what.
 */
@Controller('vendor-access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorAccessController {
  constructor(private readonly service: VendorAccessService) {}

  /**
   * The caller's own access level, `{ accessLevel: string | null }`.
   *
   * Declared before `:userId` routes and deliberately left without `@Roles`:
   * every authenticated user may ask about themselves, and the answer for
   * anyone without a grant is null, which is not a fact about the vendor book.
   * `useNavAccess` calls this to decide whether the sidebar entry renders.
   */
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.service.me(user);
  }

  /** Every explicit grant. MD and EA are absent: they hold access by role, not by row. */
  @Get()
  @Roles(role_enum.MD, role_enum.EA)
  list() {
    return this.service.list();
  }

  /** Grants one employee one level. The widest single action in the module. */
  @Post()
  @Roles(role_enum.MD, role_enum.EA)
  grant(@Body() dto: GrantVendorAccessDto, @CurrentUser() user: JwtPayload) {
    return this.service.grant(dto, user);
  }

  /** Removes a grant. Takes the granted user's id, not the grant row id. */
  @Delete(':userId')
  @Roles(role_enum.MD, role_enum.EA)
  revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.revoke(userId, user);
  }
}
