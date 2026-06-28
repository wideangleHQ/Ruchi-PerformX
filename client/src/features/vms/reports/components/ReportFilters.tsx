import { useState, useCallback, useEffect } from 'react';
import { ReportFilter } from '../types/report.types';
import { DateRangePicker } from './DateRangePicker';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface ReportFiltersProps {
  onFilterChange: (filters: Partial<ReportFilter>) => void;
}

export function ReportFilters({ onFilterChange }: ReportFiltersProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const triggerUpdate = useCallback(() => {
    onFilterChange({
      visitorName: search || undefined,
      status: status || undefined,
    });
  }, [search, status, onFilterChange]);

  useEffect(() => {
    const handler = setTimeout(triggerUpdate, 500);
    return () => clearTimeout(handler);
  }, [search, triggerUpdate]);

  const handleDateChange = (from?: string, to?: string) => {
    onFilterChange({ dateFrom: from, dateTo: to });
  };

  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-4 font-poppins bg-white p-4 rounded-xl border shadow-sm items-center">
      <div className="relative w-full sm:w-64 flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search Visitor, Company..."
          className="pl-10 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select 
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          onFilterChange({ status: e.target.value || undefined });
        }}
      >
        <option value="">All Statuses</option>
        <option value="COMPLETED">Completed</option>
        <option value="INSIDE">Inside</option>
        <option value="CANCELLED">Cancelled</option>
        <option value="EXPIRED">Expired</option>
        <option value="NO_SHOW">No Show</option>
      </select>

      <div className="flex-1 min-w-[300px]">
        <DateRangePicker onDateChange={handleDateChange} />
      </div>
    </div>
  );
}
