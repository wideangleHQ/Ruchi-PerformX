import { useState, useCallback, useEffect } from 'react';
import { AuditFilter, AuditStatus, AuditAction } from '../types/audit.types';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface AuditFiltersProps {
  onFilterChange: (filters: Partial<AuditFilter>) => void;
}

export function AuditFilters({ onFilterChange }: AuditFiltersProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const triggerUpdate = useCallback(() => {
    onFilterChange({
      user: search || undefined,
      status: status || undefined,
      action: action || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [search, status, action, dateFrom, dateTo, onFilterChange]);

  useEffect(() => {
    const handler = setTimeout(triggerUpdate, 500);
    return () => clearTimeout(handler);
  }, [search, triggerUpdate]);

  const handleDateBlur = () => {
    triggerUpdate();
  };

  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-4 font-poppins bg-white p-4 rounded-xl border shadow-sm items-center">
      <div className="relative w-full sm:w-64 flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search User, Visitor..."
          className="pl-10 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select 
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        value={action}
        onChange={(e) => {
          setAction(e.target.value);
          triggerUpdate();
        }}
      >
        <option value="">All Actions</option>
        {Object.values(AuditAction).map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select 
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          triggerUpdate();
        }}
      >
        <option value="">All Statuses</option>
        {Object.values(AuditStatus).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <div className="flex gap-2 items-center">
        <Input
          type="date"
          className="h-9 text-sm w-[140px]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={handleDateBlur}
        />
        <span className="text-gray-500 text-sm">to</span>
        <Input
          type="date"
          className="h-9 text-sm w-[140px]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={handleDateBlur}
        />
      </div>
    </div>
  );
}
