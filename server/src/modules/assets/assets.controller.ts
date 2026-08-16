import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { role_enum } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile as MulterFile } from '../../common/types/uploaded-file.type';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

/**
 * Everyone who works here. VENDOR is absent on purpose: this module holds the
 * company's credentials and is never exposed to an external party, so the guard
 * refuses a vendor before `AssetsService.assetScope` gets the chance to.
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

/** EA, PA and MD see and change everything; HR joins them for offboarding reads. */
const OFFBOARDING_ROLES: role_enum[] = [
  role_enum.EA,
  role_enum.PA,
  role_enum.MD,
  role_enum.HR,
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // The two literal routes below must stay above `:id`, or `handovers` and
  // `employee` get read as asset ids.

  /** Handovers waiting for the caller to confirm receipt. */
  @Get('handovers/pending')
  @Roles(...INTERNAL_ROLES)
  pendingHandovers(@CurrentUser() user: JwtPayload) {
    return this.assetsService.pendingHandovers(user);
  }

  /** One employee's assets and their handover history, for the offboarding screen. */
  @Get('employee/:userId')
  @Roles(...OFFBOARDING_ROLES)
  findForEmployee(@Param('userId') userId: string, @CurrentUser() user: JwtPayload) {
    return this.assetsService.findForEmployee(userId, user);
  }

  /** Open a handover per asset. Ownership moves only when the new owner confirms. */
  @Post('handovers')
  @Roles(...OFFBOARDING_ROLES)
  createHandovers(@Body() dto: CreateHandoverDto, @CurrentUser() user: JwtPayload) {
    return this.assetsService.createHandovers(dto, user);
  }

  /** Confirm receipt, which is what moves `owner_id`. */
  @Patch('handovers/:id/confirm')
  @Roles(...INTERNAL_ROLES)
  @HttpCode(HttpStatus.OK)
  confirmHandover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.assetsService.confirmHandover(id, user);
  }

  /** The caller's own assets, or every asset for EA, PA and MD. Never a secret. */
  @Get()
  @Roles(...INTERNAL_ROLES)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.assetsService.findAll(user);
  }

  /**
   * Create an asset owned by the caller. Accepts JSON, or multipart with a
   * `file` field when the type is DOCUMENT.
   */
  @Post()
  @Roles(...INTERNAL_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.assetsService.create(dto, file, user);
  }

  /** One asset without its secret. */
  @Get(':id')
  @Roles(...INTERNAL_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.assetsService.findOne(id, user);
  }

  /** Decrypt and return one secret. Writes an `audit_logs` row every time. */
  @Get(':id/reveal')
  @Roles(...INTERNAL_ROLES)
  reveal(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Ip() ip: string) {
    return this.assetsService.reveal(id, user, ip ?? null);
  }

  /** Edit an asset. A new `secret` is re-encrypted under the current key. */
  @Patch(':id')
  @Roles(...INTERNAL_ROLES)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assetsService.update(id, dto, user);
  }

  /** Soft delete. The ciphertext and any stored file are kept. */
  @Delete(':id')
  @Roles(...INTERNAL_ROLES)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.assetsService.remove(id, user);
  }
}
