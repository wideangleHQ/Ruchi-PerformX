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
import * as ExcelJS from 'exceljs';

@Injectable()
export class DashboardServiceImpl implements DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly dashboardVisitorSelect = {
    id: true,
    purpose: true,
    status: true,
    checkInTime: true,
    checkOutTime: true,
    updatedAt: true,
    visitor: {
      select: {
        fullName: true,
        companyName: true,
      },
    },
    hostEmployee: {
      select: {
        full_name: true,
      },
    },
  } as const;

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummaryDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todaysVisitors, statusGroups] = await Promise.all([
      this.prisma.visit.count({
        where: { checkInTime: { gte: todayStart, lte: todayEnd }, deletedAt: null }
      }),
      this.prisma.visit.groupBy({
        by: ['status'],
        where: {
          status: {
            in: [
              VisitStatus.CHECKED_IN,
              VisitStatus.SCHEDULED,
              VisitStatus.CHECKED_OUT,
              VisitStatus.CANCELLED,
            ],
          },
          deletedAt: null,
        },
        _count: { id: true },
      }),
    ]);
    const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count.id]));

    return plainToInstance(DashboardSummaryDto, {
      todaysVisitors,
      visitorsInside: statusCounts.get(VisitStatus.CHECKED_IN) ?? 0,
      pendingRequests: statusCounts.get(VisitStatus.SCHEDULED) ?? 0,
      completedVisits: statusCounts.get(VisitStatus.CHECKED_OUT) ?? 0,
      cancelledVisits: statusCounts.get(VisitStatus.CANCELLED) ?? 0,
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
      createdAt: { gte: todayStart, lte: todayEnd },
      deletedAt: null,
    };

    const visits = await this.prisma.visit.findMany({
      where,
      select: this.dashboardVisitorSelect,
      skip: (page - 1) * limit,
      take: limit + 1,
      orderBy: { checkInTime: 'desc' },
    });

    const pageItems = visits.slice(0, limit);
    const data = pageItems.map((visit) => this.mapDashboardVisit(visit));
    const hasNextPage = visits.length > limit;
    const totalItems = (page - 1) * limit + data.length + (hasNextPage ? 1 : 0);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: hasNextPage ? page + 1 : page,
        hasNextPage,
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
        select: {
          id: true,
          purpose: true,
          checkInTime: true,
          checkOutTime: true,
          updatedAt: true,
          status: true,
          visitor: { select: { fullName: true, companyName: true } },
          hostEmployee: { select: { full_name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { checkInTime: 'desc' },
      }),
      this.prisma.visit.count({ where }),
    ]);

    const data = visits.map((visit) => this.mapDashboardVisit(visit));

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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const visits = await this.prisma.visit.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        deletedAt: null,
      },
      select: this.dashboardVisitorSelect,
      take: 20,
      orderBy: { checkInTime: 'desc' },
    });

    return visits.map((visit) => this.mapDashboardVisit(visit));
  }

  private mapDashboardVisit(visit: {
    id: string;
    purpose: string;
    status: string;
    checkInTime: Date | null;
    checkOutTime: Date | null;
    updatedAt: Date;
    visitor: {
      fullName: string;
      companyName: string | null;
    };
    hostEmployee: {
      full_name: string;
    } | null;
  }): RecentVisitorDto {
    return plainToInstance(RecentVisitorDto, {
      id: visit.id,
      purpose: visit.purpose,
      checkedInAt: visit.checkInTime,
      checkedOutAt: visit.checkOutTime,
      status: visit.status,
      updatedAt: visit.updatedAt,
      visitor: {
        fullName: visit.visitor.fullName,
        companyName: visit.visitor.companyName,
      },
      hostEmployee: visit.hostEmployee
        ? { fullName: visit.hostEmployee.full_name }
        : null,
    });
  }

  async getStatistics(user: AuthenticatedUser): Promise<StatisticsResponseDto> {
    const now = new Date();

    const dailyRanges = Array.from({ length: 7 }, (_, index) => {
      const i = 6 - index;
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: start.toISOString().split('T')[0]! };
    });

    const monthlyRanges = Array.from({ length: 6 }, (_, index) => {
      const i = 5 - index;
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      };
    });

    const weeklyRanges = Array.from({ length: 4 }, (_, index) => {
      const i = 3 - index;
      const end = new Date(now);
      end.setDate(now.getDate() - (i * 7));
      end.setHours(23, 59, 59, 999);

      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: `Week of ${start.toISOString().split('T')[0]!}` };
    });

    const [dailyCounts, monthlyCounts, weeklyCounts] = await Promise.all([
      Promise.all(
        dailyRanges.map(({ start, end }) =>
          this.prisma.visit.count({
            where: { createdAt: { gte: start, lte: end }, deletedAt: null },
          }),
        ),
      ),
      Promise.all(
        monthlyRanges.map(({ start, end }) =>
          this.prisma.visit.count({
            where: { createdAt: { gte: start, lte: end }, deletedAt: null },
          }),
        ),
      ),
      Promise.all(
        weeklyRanges.map(({ start, end }) =>
          this.prisma.visit.count({
            where: { createdAt: { gte: start, lte: end }, deletedAt: null },
          }),
        ),
      ),
    ]);

    const daily: VisitorStatisticsDto[] = dailyRanges.map((range, index) => ({
      date: range.label,
      count: dailyCounts[index] ?? 0,
    }));
    const monthly: VisitorStatisticsDto[] = monthlyRanges.map((range, index) => ({
      date: range.label,
      count: monthlyCounts[index] ?? 0,
    }));
    const weekly: VisitorStatisticsDto[] = weeklyRanges.map((range, index) => ({
      date: range.label,
      count: weeklyCounts[index] ?? 0,
    }));

    return plainToInstance(StatisticsResponseDto, {
      daily,
      weekly,
      monthly,
    });
  }

  async exportTodaysVisitors(user: AuthenticatedUser): Promise<Buffer> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch today's visits to get the visitors who checked in today
    const visits = await this.prisma.visit.findMany({
      where: {
        checkInTime: { gte: todayStart, lte: todayEnd },
        deletedAt: null,
      },
      include: {
        visitor: true,
      },
      orderBy: { checkInTime: 'desc' },
    });

    // Map to distinct visitors to preserve original behavior (in case of multiple visits by same person today, though unlikely)
    const visitors = Array.from(
      new Map(visits.map(v => [v.visitorId, v.visitor])).values()
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Today\'s Visitors');

    // Define columns
    worksheet.columns = [
      { header: 'Full Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Mobile Number', key: 'mobileNumber', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Face Consent', key: 'faceRecognitionConsent', width: 15 },
      { header: 'Notes', key: 'notes', width: 35 },
      { header: 'Company Name', key: 'companyName', width: 25 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Registered At', key: 'createdAt', width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    visitors.forEach((visitor) => {
      worksheet.addRow({
        fullName: visitor.fullName,
        email: visitor.email || 'N/A',
        mobileNumber: visitor.mobileNumber || 'N/A',
        status: visitor.status,
        faceRecognitionConsent: visitor.faceRecognitionConsent ? 'Yes' : 'No',
        notes: visitor.notes || 'N/A',
        companyName: visitor.companyName || 'N/A',
        address: visitor.address || 'N/A',
        createdAt: visitor.createdAt.toLocaleString(),
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
