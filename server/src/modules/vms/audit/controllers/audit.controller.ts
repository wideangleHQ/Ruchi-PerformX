import { Controller, Get, Param, Query, UseGuards, ValidationPipe, ParseUUIDPipe, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../../common/gaurds/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditFilterDto } from '../dto/audit-filter.dto';
import { IAuditService, IAuditServiceToken } from '../services/audit.service.interface';
import { PaginatedAuditResponseDto, AuditResponseDto } from '../dto/audit-response.dto';
import { ApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(
    @Inject(IAuditServiceToken)
    private readonly auditService: IAuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search audit logs' })
  @SwaggerResponse({ type: PaginatedAuditResponseDto })
  async searchAudit(
    @Query(new ValidationPipe({ transform: true })) filters: AuditFilterDto,
  ): Promise<ApiResponse> {
    const result = await this.auditService.searchAudit(filters);
    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      data: result,
    };
  }

  @Get('visitor/:visitorId')
  @ApiOperation({ summary: 'Get visitor timeline' })
  @SwaggerResponse({ type: PaginatedAuditResponseDto })
  async getVisitorTimeline(
    @Param('visitorId', ParseUUIDPipe) visitorId: string,
    @Query(new ValidationPipe({ transform: true })) filters: AuditFilterDto,
  ): Promise<ApiResponse> {
    const result = await this.auditService.getVisitorTimeline(visitorId, filters);
    return {
      success: true,
      message: 'Visitor timeline retrieved successfully',
      data: result,
    };
  }

  @Get('visit/:visitId')
  @ApiOperation({ summary: 'Get visit timeline' })
  @SwaggerResponse({ type: PaginatedAuditResponseDto })
  async getVisitTimeline(
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Query(new ValidationPipe({ transform: true })) filters: AuditFilterDto,
  ): Promise<ApiResponse> {
    const result = await this.auditService.getVisitTimeline(visitId, filters);
    return {
      success: true,
      message: 'Visit timeline retrieved successfully',
      data: result,
    };
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get employee activity' })
  @SwaggerResponse({ type: PaginatedAuditResponseDto })
  async getEmployeeActivity(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ValidationPipe({ transform: true })) filters: AuditFilterDto,
  ): Promise<ApiResponse> {
    const result = await this.auditService.getEmployeeActivity(employeeId, filters);
    return {
      success: true,
      message: 'Employee activity retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @SwaggerResponse({ type: AuditResponseDto })
  async getAuditById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse> {
    const result = await this.auditService.getAuditById(id);
    return {
      success: true,
      message: 'Audit log retrieved successfully',
      data: result,
    };
  }
}
