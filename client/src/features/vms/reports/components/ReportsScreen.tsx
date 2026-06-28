'use client';

import { useState } from 'react';
import { useReports } from '../hooks/useReports';
import { ReportFilter } from '../types/report.types';
import { ReportFilters } from './ReportFilters';
import { ReportSummaryCards } from './ReportSummaryCards';
import { EmployeeReportChart } from './EmployeeReportChart';
import { VisitorTrendChart } from './VisitorTrendChart';
import { ReportTable } from './ReportTable';
import { ExportDialog } from './ExportDialog';

export function ReportsScreen() {
  const [filters, setFilters] = useState<ReportFilter>({ page: 1, limit: 10 });
  const { data, isLoading, error } = useReports(filters);

  const handleFilterChange = (newFilters: Partial<ReportFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">VMS Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Analytics and historical visitor data</p>
        </div>
        <ExportDialog currentFilters={filters} />
      </div>

      <ReportSummaryCards summary={data?.summary} />

      <ReportFilters onFilterChange={handleFilterChange} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VisitorTrendChart dailyTrend={data?.charts?.dailyTrend} />
        <EmployeeReportChart data={data?.charts?.employeeWise} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Detailed Records</h3>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg">
            Failed to load report data.
          </div>
        ) : (
          <ReportTable rows={data?.rows || []} />
        )}
      </div>
    </div>
  );
}
