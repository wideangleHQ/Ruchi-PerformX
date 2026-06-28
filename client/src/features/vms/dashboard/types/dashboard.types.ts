export interface DashboardSummary {
  todaysVisitors: number;
  visitorsInside: number;
  pendingRequests: number;
  completedVisits: number;
  cancelledVisits: number;
}

export interface RecentVisitor {
  id: string;
  fullName: string;
  mobileNumber?: string;
  purpose: string;
  checkInTime?: string;
  status: string;
}

export interface VisitorStatistics {
  date: string;
  count: number;
}

export interface StatisticsResponse {
  daily: VisitorStatistics[];
  weekly: VisitorStatistics[];
  monthly: VisitorStatistics[];
}

export interface DashboardData {
  summary: DashboardSummary;
  recent: RecentVisitor[];
  statistics: StatisticsResponse;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
