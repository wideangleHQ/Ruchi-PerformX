export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  departmentId?: string;
  visitorName?: string;
  company?: string;
  status?: string;
  purpose?: string;
  page?: number;
  limit?: number;
}

export interface ReportSummary {
  todayVisitors: number;
  weekVisitors: number;
  monthVisitors: number;
  currentlyInside: number;
  completedVisits: number;
  cancelledVisits: number;
}

export interface ReportRow {
  id: string;
  date: string;
  visitorName: string;
  company?: string;
  employeeName: string;
  department?: string;
  purpose: string;
  peopleCount: number;
  checkIn?: string;
  checkOut?: string;
  duration?: string;
  status: string;
}

export interface ReportData {
  summary: ReportSummary;
  rows: ReportRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  charts: {
    employeeWise: { name: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    departmentWise: { department: string; count: number }[];
  };
}

export interface ExportReportRequest {
  format: 'EXCEL' | 'CSV' | 'PDF';
  filters: ReportFilter;
}
