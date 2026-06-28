import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IReportService } from './report.service.interface';
import { DailyReportDto, DailyStatsDto, HourlyBreakdownDto } from '../dto/daily-report.dto';
import { MonthlyReportDto, MonthlyStatsDto, DailyTotalDto } from '../dto/monthly-report.dto';
import { EmployeeReportDto, EmployeeStatsDto, EmployeeVisitDto } from '../dto/employee-report.dto';
import { VisitorHistoryDto, VisitorInfoDto, VisitTimelineDto } from '../dto/visitor-history.dto';
import { ReportFilterDto } from '../dto/report-filter.dto';

@Injectable()
export class ReportService implements IReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyReport(date: string, filters?: Partial<ReportFilterDto>): Promise<DailyReportDto> {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      deletedAt: null,
    };

    if (filters?.departmentId) {
      whereClause.hostEmployee = { department_id: filters.departmentId };
    }

    if (filters?.employeeId) {
      whereClause.hostEmployeeId = filters.employeeId;
    }

    const visits = await this.prisma.visit.findMany({
      where: whereClause,
      include: {
        visitor: { select: { fullName: true } },
        hostEmployee: { 
          select: { 
            full_name: true,
            departments: { select: { name: true } }
          } 
        },
      },
    });

    const stats: DailyStatsDto = {
      totalVisitors: visits.length,
      checkedIn: visits.filter(v => v.status === 'CHECKED_IN').length,
      checkedOut: visits.filter(v => v.status === 'CHECKED_OUT').length,
      pending: visits.filter(v => v.status === 'SCHEDULED').length,
      cancelled: visits.filter(v => v.status === 'CANCELLED').length,
      noShow: visits.filter(v => v.status === 'NO_SHOW').length,
    };

    const hourlyBreakdown: HourlyBreakdownDto[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: visits.filter(v => v.checkInTime && new Date(v.checkInTime).getHours() === hour).length,
    }));

    const peakHour = hourlyBreakdown.reduce((max, current) => 
      current.count > max.count ? current : max
    );
    stats.peakHour = `${peakHour.hour}:00`;

    const departmentStats: Record<string, number> = {};
    visits.forEach(visit => {
      const deptName = visit.hostEmployee?.departments?.name || 'Unknown';
      departmentStats[deptName] = (departmentStats[deptName] || 0) + 1;
    });

    const topDept = Object.entries(departmentStats).reduce((max, current) => 
      current[1] > (max?.[1] || 0) ? current : max
    );
    stats.topDepartment = topDept?.[0];

    return {
      date,
      stats,
      hourlyBreakdown,
      departmentStats,
    };
  }

  async getMonthlyReport(month: string, filters?: Partial<ReportFilterDto>): Promise<MonthlyReportDto> {
    const [year, monthNum] = month.split('-').map(Number);
    if (!year || !monthNum) {
      throw new Error('Invalid month format. Expected YYYY-MM');
    }
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    };

    if (filters?.departmentId) {
      whereClause.hostEmployee = { department_id: filters.departmentId };
    }

    const visits = await this.prisma.visit.findMany({
      where: whereClause,
      include: {
        visitor: { select: { fullName: true } },
        hostEmployee: { 
          select: { 
            full_name: true,
            departments: { select: { name: true } }
          } 
        },
      },
    });

    const stats: MonthlyStatsDto = {
      totalVisitors: visits.length,
      completedVisits: visits.filter(v => v.status === 'CHECKED_OUT').length,
      cancelledVisits: visits.filter(v => v.status === 'CANCELLED').length,
      averageDailyVisitors: Math.round(visits.length / endDate.getDate()),
    };

    const dailyTotals: DailyTotalDto[] = [];
    const dailyGroups: Record<string, any[]> = {};

    visits.forEach(visit => {
      const day = visit.createdAt.toISOString().split('T')[0];
      if (day) {
        if (!dailyGroups[day]) dailyGroups[day] = [];
        dailyGroups[day].push(visit);
      }
    });

    Object.entries(dailyGroups).forEach(([day, dayVisits]) => {
      dailyTotals.push({
        date: day,
        totalVisitors: dayVisits.length,
        completedVisits: dayVisits.filter(v => v.status === 'CHECKED_OUT').length,
      });
    });

    const peakDay = dailyTotals.reduce((max, current) => 
      current.totalVisitors > (max?.totalVisitors || 0) ? current : max
    );
    stats.peakDay = peakDay?.date;
    stats.peakCount = peakDay?.totalVisitors;

    const hostStats: Record<string, number> = {};
    const departmentStats: Record<string, number> = {};

    visits.forEach(visit => {
      const hostName = visit.hostEmployee?.full_name || 'Unknown';
      const deptName = visit.hostEmployee?.departments?.name || 'Unknown';
      
      hostStats[hostName] = (hostStats[hostName] || 0) + 1;
      departmentStats[deptName] = (departmentStats[deptName] || 0) + 1;
    });

    const topHost = Object.entries(hostStats).reduce((max, current) => 
      current[1] > (max?.[1] || 0) ? current : max
    );
    stats.topHost = topHost?.[0];

    const topDept = Object.entries(departmentStats).reduce((max, current) => 
      current[1] > (max?.[1] || 0) ? current : max
    );
    stats.topDepartment = topDept?.[0];

    const weeklyComparison: Record<string, number> = {};
    const weeksInMonth = Math.ceil(endDate.getDate() / 7);
    
    for (let week = 1; week <= weeksInMonth; week++) {
      const weekStart = new Date(year, monthNum - 1, (week - 1) * 7 + 1);
      const weekEnd = new Date(year, monthNum - 1, Math.min(week * 7, endDate.getDate()));
      
      const weekVisits = visits.filter(v => 
        v.createdAt >= weekStart && v.createdAt <= weekEnd
      );
      weeklyComparison[`Week ${week}`] = weekVisits.length;
    }

    return {
      month,
      stats,
      dailyTotals: dailyTotals.sort((a, b) => a.date.localeCompare(b.date)),
      weeklyComparison,
      departmentStats,
      hostStats,
    };
  }

  async getEmployeeReport(employeeId: string, filters?: Partial<ReportFilterDto>): Promise<EmployeeReportDto> {
    const employee = await this.prisma.users.findUnique({
      where: { id: employeeId },
      include: {
        departments: { select: { name: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const whereClause: any = {
      hostEmployeeId: employeeId,
      deletedAt: null,
    };

    if (filters?.dateFrom || filters?.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) whereClause.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) whereClause.createdAt.lte = new Date(filters.dateTo);
    }

    const visits = await this.prisma.visit.findMany({
      where: whereClause,
      include: {
        visitor: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const employeeStats: EmployeeStatsDto = {
      employeeId,
      employeeName: employee.full_name,
      departmentName: employee.departments?.name || 'Unknown',
      totalVisits: visits.length,
      completedVisits: visits.filter(v => v.status === 'CHECKED_OUT').length,
      pendingVisits: visits.filter(v => ['SCHEDULED', 'CHECKED_IN'].includes(v.status)).length,
      cancelledVisits: visits.filter(v => v.status === 'CANCELLED').length,
    };

    const completedVisits = visits.filter(v => v.checkInTime && v.checkOutTime);
    if (completedVisits.length > 0) {
      const totalDuration = completedVisits.reduce((sum, visit) => {
        const duration = (new Date(visit.checkOutTime!).getTime() - new Date(visit.checkInTime!).getTime()) / (1000 * 60);
        return sum + duration;
      }, 0);
      employeeStats.avgVisitDuration = Math.round(totalDuration / completedVisits.length);
    }

    const recentVisits: EmployeeVisitDto[] = visits.slice(0, 20).map(visit => {
      const duration = visit.checkInTime && visit.checkOutTime 
        ? Math.round((new Date(visit.checkOutTime).getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))
        : undefined;

      const visitDto: EmployeeVisitDto = {
        visitId: visit.id,
        visitorName: visit.visitor?.fullName || 'Unknown',
        purpose: visit.purpose,
        status: visit.status,
      };

      if (visit.checkInTime) visitDto.checkInTime = visit.checkInTime;
      if (visit.checkOutTime) visitDto.checkOutTime = visit.checkOutTime;
      if (duration) visitDto.duration = duration;

      return visitDto;
    });

    const monthlyTrends: Record<string, number> = {};
    const purposeBreakdown: Record<string, number> = {};
    const visitorCounts: Record<string, number> = {};

    visits.forEach(visit => {
      const month = visit.createdAt.toISOString().slice(0, 7);
      monthlyTrends[month] = (monthlyTrends[month] || 0) + 1;
      
      purposeBreakdown[visit.purpose] = (purposeBreakdown[visit.purpose] || 0) + 1;
      
      const visitorName = visit.visitor?.fullName || 'Unknown';
      visitorCounts[visitorName] = (visitorCounts[visitorName] || 0) + 1;
    });

    const topVisitor = Object.entries(visitorCounts).reduce((max, current) => 
      current[1] > (max?.[1] || 0) ? current : max
    );
    employeeStats.topVisitor = topVisitor?.[0];

    const topPurpose = Object.entries(purposeBreakdown).reduce((max, current) => 
      current[1] > (max?.[1] || 0) ? current : max
    );
    employeeStats.topPurpose = topPurpose?.[0];

    return {
      employee: employeeStats,
      recentVisits,
      monthlyTrends,
      purposeBreakdown,
    };
  }

  async getVisitorHistory(visitorId: string, filters?: Partial<ReportFilterDto>): Promise<VisitorHistoryDto> {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
    });

    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    const whereClause: any = {
      visitorId,
      deletedAt: null,
    };

    if (filters?.dateFrom || filters?.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) whereClause.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) whereClause.createdAt.lte = new Date(filters.dateTo);
    }

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [visits, totalVisits] = await Promise.all([
      this.prisma.visit.findMany({
        where: whereClause,
        include: {
          hostEmployee: { 
            select: { 
              full_name: true,
              departments: { select: { name: true } }
            } 
          },
        },
        orderBy: { createdAt: filters?.sortOrder === 'asc' ? 'asc' : 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.visit.count({ where: whereClause }),
    ]);

    const allVisits = await this.prisma.visit.findMany({
      where: { visitorId, deletedAt: null },
      select: { createdAt: true, purpose: true, hostEmployee: { select: { departments: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    const visitorInfo: VisitorInfoDto = {
      visitorId,
      fullName: visitor.fullName,
      totalVisits: allVisits.length,
      firstVisit: allVisits[0]?.createdAt || new Date(),
      lastVisit: allVisits[allVisits.length - 1]?.createdAt || new Date(),
    };

    if (visitor.email) visitorInfo.email = visitor.email;
    if (visitor.mobileNumber) visitorInfo.mobileNumber = visitor.mobileNumber;

    const visitTimeline: VisitTimelineDto[] = visits.map(visit => {
      const duration = visit.checkInTime && visit.checkOutTime 
        ? Math.round((new Date(visit.checkOutTime).getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))
        : undefined;

      const timelineDto: VisitTimelineDto = {
        visitId: visit.id,
        visitDate: visit.createdAt,
        hostEmployeeName: visit.hostEmployee?.full_name || 'Unknown',
        departmentName: visit.hostEmployee?.departments?.name || 'Unknown',
        purpose: visit.purpose,
        status: visit.status,
      };

      if (visit.scheduledAt) timelineDto.scheduledAt = visit.scheduledAt;
      if (visit.checkInTime) timelineDto.checkInTime = visit.checkInTime;
      if (visit.checkOutTime) timelineDto.checkOutTime = visit.checkOutTime;
      if (duration) timelineDto.duration = duration;
      if (visit.visitCode) timelineDto.visitCode = visit.visitCode;

      return timelineDto;
    });

    const departmentStats: Record<string, number> = {};
    const purposeStats: Record<string, number> = {};
    const monthlyPattern: Record<string, number> = {};

    allVisits.forEach(visit => {
      const deptName = visit.hostEmployee?.departments?.name || 'Unknown';
      departmentStats[deptName] = (departmentStats[deptName] || 0) + 1;
      
      purposeStats[visit.purpose] = (purposeStats[visit.purpose] || 0) + 1;
      
      const month = visit.createdAt.toISOString().slice(0, 7);
      monthlyPattern[month] = (monthlyPattern[month] || 0) + 1;
    });

    const frequentDept = Object.entries(departmentStats).reduce((max, current) => 
      current[1] > (max?.[1] || 0) ? current : max
    );
    visitorInfo.frequentDepartment = frequentDept?.[0];

    return {
      visitor: visitorInfo,
      visits: visitTimeline,
      departmentStats,
      purposeStats,
      monthlyPattern,
      pagination: {
        page,
        limit,
        total: totalVisits,
        totalPages: Math.ceil(totalVisits / limit),
      },
    };
  }

  async exportData(type: string, filters?: Partial<ReportFilterDto>): Promise<any> {
    switch (type) {
      case 'daily':
        if (!filters?.dateFrom) throw new Error('Date required for daily export');
        return this.getDailyReport(filters.dateFrom, filters);
      
      case 'monthly':
        if (!filters?.dateFrom) throw new Error('Month required for monthly export');
        return this.getMonthlyReport(filters.dateFrom.slice(0, 7), filters);
      
      case 'employee':
        if (!filters?.employeeId) throw new Error('Employee ID required for employee export');
        return this.getEmployeeReport(filters.employeeId, filters);
      
      case 'visitor-history':
        if (!filters?.visitorId) throw new Error('Visitor ID required for visitor history export');
        return this.getVisitorHistory(filters.visitorId, filters);
      
      default:
        throw new Error('Invalid export type');
    }
  }
}