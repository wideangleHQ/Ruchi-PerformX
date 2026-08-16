import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/vendor/create-vendor.dto';
import { UpdateVendorDto } from './dto/vendor/update-vendor.dto';
import { UpdateVendorStatusDto } from './dto/vendor/update-vendor-status.dto';
import { VendorFilterDto } from './dto/vendor/vendor-filter.dto';
import { CreateVendorCategoryDto } from './dto/vendor/create-vendor-category.dto';

/**
 * Every role that works at RUCHI, which is every role except the external
 * portal login.
 *
 * Listed one by one rather than filtered out of `Object.values(role_enum)`,
 * because naming the excluded role in a controller file is what
 * `just vendor-roles` fails the build on, and the grep is worth more than the
 * three lines this saves. A role added to the enum is excluded here until
 * someone adds it, which is the safe direction to fail in.
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

/**
 * The internal vendor master and the category list behind it.
 *
 * No route prefix: `/vendors` and `/vendor-categories` are two paths of one
 * concern, and `vendors.module.ts` registers this controller and no third one
 * to hang the second path on.
 *
 * `@Roles` here is only the outer fence, and it is a wide one. What actually
 * decides who reads the vendor book is the `vendor_dashboard_access` check the
 * service runs on every method, `pickable` excepted. The role list on these
 * routes exists to keep the external portal out, nothing more.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly service: VendorsService) {}

  /**
   * The assign-work picker: id, name, category, ACTIVE vendors only.
   *
   * Declared before `/vendors/:id` and it has to stay there. Nest matches in
   * declaration order, so the other way round binds `id: "pickable"` and the
   * picker 404s in a way that reads like missing data.
   */
  @Get('vendors/pickable')
  @Roles(...INTERNAL_ROLES)
  pickable() {
    return this.service.pickable();
  }

  /** The vendor directory. Any vendor management level. */
  @Get('vendors')
  @Roles(...INTERNAL_ROLES)
  findAll(@Query() filters: VendorFilterDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(filters, user);
  }

  /** Creates a vendor. VENDOR_MANAGER or above. */
  @Post('vendors')
  @Roles(...INTERNAL_ROLES)
  create(@Body() dto: CreateVendorDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  /** Vendor profile header. Any vendor management level. */
  @Get('vendors/:id')
  @Roles(...INTERNAL_ROLES)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findOne(id, user);
  }

  /**
   * Moves a vendor through its lifecycle. VENDOR_MANAGER or above.
   *
   * This route is the reason there is no DELETE on a vendor. Do not add one.
   */
  @Patch('vendors/:id/status')
  @Roles(...INTERNAL_ROLES)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateStatus(id, dto, user);
  }

  /** Edits the master record. VENDOR_MANAGER, or the vendor's internal owner. */
  @Patch('vendors/:id')
  @Roles(...INTERNAL_ROLES)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  /** The category list. Any vendor management level. */
  @Get('vendor-categories')
  @Roles(...INTERNAL_ROLES)
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.service.listCategories(user);
  }

  /** Adds a category. HR, EA and MD own this list. */
  @Post('vendor-categories')
  @Roles(role_enum.HR, role_enum.EA, role_enum.MD)
  createCategory(@Body() dto: CreateVendorCategoryDto) {
    return this.service.createCategory(dto);
  }
}
