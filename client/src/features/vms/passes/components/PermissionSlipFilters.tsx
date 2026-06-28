import { useState, useEffect, useCallback } from 'react';
import { PassStatus, SearchPassFilter } from '../types/pass.types';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PermissionSlipFiltersProps {
  onFilterChange: (filters: Partial<SearchPassFilter>) => void;
}

export function PermissionSlipFilters({ onFilterChange }: PermissionSlipFiltersProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const triggerUpdate = useCallback(() => {
    onFilterChange({
      search: search || undefined,
      status: status === '' ? undefined : status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [search, status, dateFrom, dateTo, onFilterChange]);

  useEffect(() => {
    const handler = setTimeout(() => {
      triggerUpdate();
    }, 500);
    return () => clearTimeout(handler);
  }, [search, triggerUpdate]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value);
    triggerUpdate();
  };

  const handleDateChange = () => {
    triggerUpdate();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 font-poppins bg-white p-4 rounded-xl border shadow-sm">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search visitor, employee or slip no..."
          className="pl-10 h-10 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <select 
        className="w-full sm:w-48 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        value={status}
        onChange={handleStatusChange}
      >
        <option value="">All Statuses</option>
        <option value={PassStatus.GENERATED}>Generated</option>
        <option value={PassStatus.PRINTED}>Printed</option>
        <option value={PassStatus.CHECKED_OUT}>Checked Out</option>
        <option value={PassStatus.CANCELLED}>Cancelled</option>
        <option value={PassStatus.EXPIRED}>Expired</option>
      </select>
      
      <div className="flex gap-2 w-full sm:w-auto items-center">
        <Input
          type="date"
          className="h-10"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={handleDateChange}
        />
        <span className="text-gray-500">-</span>
        <Input
          type="date"
          className="h-10"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={handleDateChange}
        />
      </div>
    </div>
  );
}
