import {
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from '../services/dashboard.service.interface';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { RecentVisitorDto } from '../dto/recent-visitor.dto';
import { StatisticsResponseDto } from '../dto/visitor-statistics.dto';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';

@ApiTags('VMS - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vms/dashboard')
export class DashboardController {
  constructor(
    @Inject('DashboardService')
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get complete dashboard data' })
  async getDashboard(@Req() req: any) {
    const [summary, recent, statistics] = await Promise.all([
      this.dashboardService.getSummary(req.user),
      this.dashboardService.getRecentVisitors(req.user),
      this.dashboardService.getStatistics(req.user),
    ]);
    return { success: true, data: { summary, recent, statistics } };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary metrics' })
  @ApiResponse({ status: 200, type: DashboardSummaryDto })
  async getSummary(@Req() req: any): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary(req.user);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today\'s visitors' })
  async getTodaysVisitors(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    return this.dashboardService.getTodaysVisitors({ page: +page || 1, limit: +limit || 20 }, req.user);
  }

  @Get('inside')
  @ApiOperation({ summary: 'Get visitors currently inside' })
  async getInsideVisitors(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    return this.dashboardService.getInsideVisitors({ page: +page || 1, limit: +limit || 20 }, req.user);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent visitors' })
  @ApiResponse({ status: 200, type: [RecentVisitorDto] })
  async getRecentVisitors(@Req() req: any): Promise<RecentVisitorDto[]> {
    return this.dashboardService.getRecentVisitors(req.user);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get visitor statistics' })
  @ApiResponse({ status: 200, type: StatisticsResponseDto })
  async getStatistics(@Req() req: any): Promise<StatisticsResponseDto> {
    return this.dashboardService.getStatistics(req.user);
  }
}
