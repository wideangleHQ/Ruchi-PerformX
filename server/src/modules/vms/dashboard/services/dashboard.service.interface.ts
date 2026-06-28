import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { RecentVisitorDto } from '../dto/recent-visitor.dto';
import { StatisticsResponseDto } from '../dto/visitor-statistics.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';

export interface DashboardSearchParams {
  page?: number;
  limit?: number;
}

export interface DashboardService {
  getSummary(user: AuthenticatedUser): Promise<DashboardSummaryDto>;
  getTodaysVisitors(params: DashboardSearchParams, user: AuthenticatedUser): Promise<PaginatedResponse<RecentVisitorDto>>;
  getInsideVisitors(params: DashboardSearchParams, user: AuthenticatedUser): Promise<PaginatedResponse<RecentVisitorDto>>;
  getRecentVisitors(user: AuthenticatedUser): Promise<RecentVisitorDto[]>;
  getStatistics(user: AuthenticatedUser): Promise<StatisticsResponseDto>;
}
