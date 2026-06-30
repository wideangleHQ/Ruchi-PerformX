import {
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
  Req,
  Res,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
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

  @Get('today/export')
  @ApiOperation({ summary: 'Export today\'s visitors to Excel' })
  @ApiResponse({ 
    status: 200,
    description: 'Excel file with today\'s visitors',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {}
    }
  })
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportTodaysVisitors(@Req() req: any, @Res() res: Response): Promise<void> {
    const buffer = await this.dashboardService.exportTodaysVisitors(req.user);
    
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `Todays-Visitors-${dateStr}.xlsx`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  }
}
