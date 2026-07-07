export interface DashboardSummary {
  todaysVisitors: number;
  visitorsInside: number;
  pendingRequests: number;
  completedVisits: number;
  cancelledVisits: number;
}

export interface RecentVisitor {
  id: string;
  purpose: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  status: string;
  updatedAt: string;
  visitor: {
    fullName: string;
    companyName?: string | null;
  };
  hostEmployee?: {
    fullName: string;
  } | null;
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
