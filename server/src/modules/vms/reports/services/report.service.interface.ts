import { DailyReportDto } from '../dto/daily-report.dto';
import { MonthlyReportDto } from '../dto/monthly-report.dto';
import { EmployeeReportDto } from '../dto/employee-report.dto';
import { VisitorHistoryDto } from '../dto/visitor-history.dto';
import { ReportFilterDto } from '../dto/report-filter.dto';

export interface IReportService {
  getDailyReport(date: string, filters?: Partial<ReportFilterDto>): Promise<DailyReportDto>;
  getMonthlyReport(month: string, filters?: Partial<ReportFilterDto>): Promise<MonthlyReportDto>;
  getEmployeeReport(employeeId: string, filters?: Partial<ReportFilterDto>): Promise<EmployeeReportDto>;
  getVisitorHistory(visitorId: string, filters?: Partial<ReportFilterDto>): Promise<VisitorHistoryDto>;
  exportData(type: string, filters?: Partial<ReportFilterDto>): Promise<any>;
}