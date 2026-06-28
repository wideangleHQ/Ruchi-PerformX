import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DashboardService, DashboardSearchParams } from './dashboard.service.interface';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { RecentVisitorDto } from '../dto/recent-visitor.dto';
import { StatisticsResponseDto, VisitorStatisticsDto } from '../dto/visitor-statistics.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { plainToInstance } from 'class-transformer';
import { VisitStatus } from '../../common/enums/visit-status.enum';

@Injectable()
export class DashboardServiceImpl implements DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummaryDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todaysVisitors, visitorsInside, pendingRequests, completedVisits, cancelledVisits] = await Promise.all([
      this.prisma.visit.count({
        where: { checkInTime: { gte: todayStart, lte: todayEnd }, deletedAt: null }
      }),
      this.prisma.visit.count({
        where: { status: VisitStatus.CHECKED_IN, deletedAt: null }
      }),
      this.prisma.visit.count({
        where: { status: VisitStatus.SCHEDULED, deletedAt: null }
      }),
      this.prisma.visit.count({
        where: { status: VisitStatus.CHECKED_OUT, deletedAt: null }
      }),
      this.prisma.visit.count({
        where: { status: VisitStatus.CANCELLED, deletedAt: null }
      }),
    ]);

    return plainToInstance(DashboardSummaryDto, {
      todaysVisitors,
      visitorsInside,
      pendingRequests,
      completedVisits,
      cancelledVisits,
    });
  }

  async getTodaysVisitors(params: DashboardSearchParams, user: AuthenticatedUser): Promise<PaginatedResponse<RecentVisitorDto>> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const where = {
      checkInTime: { gte: todayStart, lte: todayEnd },
      deletedAt: null,
    };

    const [visits, totalItems] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: { visitor: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { checkInTime: 'desc' },
      }),
      this.prisma.visit.count({ where }),
    ]);

    const data = visits.map(v => plainToInstance(RecentVisitorDto, {
      id: v.id,
      fullName: v.visitor.fullName,
      mobileNumber: v.visitor.mobileNumber,
      purpose: v.purpose,
      checkInTime: v.checkInTime,
      status: v.status,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1,
      }
    };
  }

  async getInsideVisitors(params: DashboardSearchParams, user: AuthenticatedUser): Promise<PaginatedResponse<RecentVisitorDto>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const where = {
      status: VisitStatus.CHECKED_IN,
      deletedAt: null,
    };

    const [visits, totalItems] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: { visitor: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { checkInTime: 'desc' },
      }),
      this.prisma.visit.count({ where }),
    ]);

    const data = visits.map(v => plainToInstance(RecentVisitorDto, {
      id: v.id,
      fullName: v.visitor.fullName,
      mobileNumber: v.visitor.mobileNumber,
      purpose: v.purpose,
      checkInTime: v.checkInTime,
      status: v.status,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1,
      }
    };
  }

  async getRecentVisitors(user: AuthenticatedUser): Promise<RecentVisitorDto[]> {
    const visits = await this.prisma.visit.findMany({
      where: { deletedAt: null },
      include: { visitor: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return visits.map(v => plainToInstance(RecentVisitorDto, {
      id: v.id,
      fullName: v.visitor.fullName,
      mobileNumber: v.visitor.mobileNumber,
      purpose: v.purpose,
      checkInTime: v.checkInTime,
      status: v.status,
    }));
  }

  async getStatistics(user: AuthenticatedUser): Promise<StatisticsResponseDto> {
    const daily: VisitorStatisticsDto[] = [];
    const weekly: VisitorStatisticsDto[] = [];
    const monthly: VisitorStatisticsDto[] = [];
    
    const now = new Date();
    
    // Daily (last 7 days)
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      
      const count = await this.prisma.visit.count({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null }
      });
      daily.push({ date: start.toISOString().split('T')[0]!, count });
    }
    
    // Monthly (last 6 months)
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const count = await this.prisma.visit.count({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null }
      });
      const monthLabel = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      monthly.push({ date: monthLabel, count });
    }
    
    // Weekly (last 4 weeks)
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(now.getDate() - (i * 7));
      end.setHours(23, 59, 59, 999);
      
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      
      const count = await this.prisma.visit.count({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null }
      });
      const weekLabel = `Week of ${start.toISOString().split('T')[0]!}`;
      weekly.push({ date: weekLabel, count });
    }
    
    return plainToInstance(StatisticsResponseDto, {
      daily,
      weekly,
      monthly,
    });
  }
}
