import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Inject,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PassService } from '../services/pass.service.interface';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { GeneratePassDto } from '../dto/generate-pass.dto';

import { ReprintPassDto } from '../dto/reprint-pass.dto';
import { PassResponseDto } from '../dto/pass-response.dto';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../../common/gaurds/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { role_enum } from '@prisma/client';

@ApiTags('VMS Passes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('vms/passes')
@Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
export class PassController {
  constructor(
    @Inject('PassService')
    private readonly passService: PassService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new pass' })
  @ApiResponse({ status: 201, type: PassResponseDto })
  async generatePass(@Body() dto: GeneratePassDto, @Req() req: any): Promise<PassResponseDto> {
    return this.passService.generatePass(dto, req.user);
  }

  @Get(':visitId')
  @ApiOperation({ summary: 'Get pass by visit ID' })
  @ApiResponse({ status: 200, type: PassResponseDto })
  async getPass(
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Req() req: any,
  ): Promise<PassResponseDto> {
    return this.passService.getPassByVisit(visitId, req.user);
  }

  @Get(':visitId/print')
  @ApiOperation({ summary: 'Generate printable pass data' })
  @ApiResponse({ status: 200 })
  async getPrintablePass(
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.passService.generatePrintablePassData(visitId, req.user),
    };
  }

  @Post(':visitId/reprint')
  @ApiOperation({ summary: 'Reprint a pass' })
  @ApiResponse({ status: 201, type: PassResponseDto })
  async reprintPass(
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Body() dto: ReprintPassDto,
    @Req() req: any,
  ): Promise<PassResponseDto> {
    return this.passService.reprintPass(visitId, dto, req.user);
  }
}
