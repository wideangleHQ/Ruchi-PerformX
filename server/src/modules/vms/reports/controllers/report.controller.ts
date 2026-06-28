import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportService } from '../services/report.service';
import { ReportFilterDto } from '../dto/report-filter.dto';
import { DailyReportDto } from '../dto/daily-report.dto';
import { MonthlyReportDto } from '../dto/monthly-report.dto';
import { EmployeeReportDto } from '../dto/employee-report.dto';
import { VisitorHistoryDto } from '../dto/visitor-history.dto';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../../common/gaurds/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { role_enum } from '@prisma/client';

@ApiTags('VMS Reports')
@ApiBearerAuth()
@Controller('vms/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('daily')
  @Roles(role_enum.MD, role_enum.EA, role_enum.PA, role_enum.HOD, role_enum.ADMIN)
  @ApiOperation({ summary: 'Get daily visitor report' })
  @ApiQuery({ name: 'date', description: 'Report date (YYYY-MM-DD)', required: true })
  @ApiQuery({ name: 'departmentId', description: 'Filter by department', required: false })
  @ApiQuery({ name: 'employeeId', description: 'Filter by employee', required: false })
  @ApiResponse({ status: 200, description: 'Daily report generated', type: DailyReportDto })
  async getDailyReport(
    @Query('date') date: string,
    @Query(new ValidationPipe({ transform: true })) filters: ReportFilterDto,
  ): Promise<DailyReportDto> {
    return this.reportService.getDailyReport(date, filters);
  }

  @Get('monthly')
  @Roles(role_enum.MD, role_enum.EA, role_enum.PA, role_enum.HOD, role_enum.ADMIN)
  @ApiOperation({ summary: 'Get monthly visitor report' })
  @ApiQuery({ name: 'month', description: 'Report month (YYYY-MM)', required: true })
  @ApiQuery({ name: 'departmentId', description: 'Filter by department', required: false })
  @ApiResponse({ status: 200, description: 'Monthly report generated', type: MonthlyReportDto })
  async getMonthlyReport(
    @Query('month') month: string,
    @Query(new ValidationPipe({ transform: true })) filters: ReportFilterDto,
  ): Promise<MonthlyReportDto> {
    return this.reportService.getMonthlyReport(month, filters);
  }

  @Get('employee/:employeeId')
  @Roles(role_enum.MD, role_enum.EA, role_enum.PA, role_enum.HOD, role_enum.ADMIN)
  @ApiOperation({ summary: 'Get employee-specific visitor report' })
  @ApiResponse({ status: 200, description: 'Employee report generated', type: EmployeeReportDto })
  async getEmployeeReport(
    @Param('employeeId') employeeId: string,
    @Query(new ValidationPipe({ transform: true })) filters: ReportFilterDto,
  ): Promise<EmployeeReportDto> {
    return this.reportService.getEmployeeReport(employeeId, filters);
  }

  @Get('visitor-history/:visitorId')
  @Roles(role_enum.MD, role_enum.EA, role_enum.PA, role_enum.HOD, role_enum.ADMIN)
  @ApiOperation({ summary: 'Get visitor history report' })
  @ApiResponse({ status: 200, description: 'Visitor history report generated', type: VisitorHistoryDto })
  async getVisitorHistory(
    @Param('visitorId') visitorId: string,
    @Query(new ValidationPipe({ transform: true })) filters: ReportFilterDto,
  ): Promise<VisitorHistoryDto> {
    return this.reportService.getVisitorHistory(visitorId, filters);
  }

  @Get('export')
  @Roles(role_enum.MD, role_enum.EA, role_enum.PA, role_enum.HOD, role_enum.ADMIN)
  @ApiOperation({ summary: 'Export report data' })
  @ApiQuery({ name: 'type', description: 'Export type (daily|monthly|employee|visitor-history)', required: true })
  @ApiQuery({ name: 'dateFrom', description: 'Start date for export', required: false })
  @ApiQuery({ name: 'dateTo', description: 'End date for export', required: false })
  @ApiQuery({ name: 'employeeId', description: 'Employee ID for employee export', required: false })
  @ApiQuery({ name: 'visitorId', description: 'Visitor ID for visitor history export', required: false })
  @ApiResponse({ status: 200, description: 'Export data prepared' })
  async exportData(
    @Query('type') type: string,
    @Query(new ValidationPipe({ transform: true })) filters: ReportFilterDto,
  ): Promise<any> {
    return this.reportService.exportData(type, filters);
  }
}