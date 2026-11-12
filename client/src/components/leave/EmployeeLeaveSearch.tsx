'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { LeaveSearchEmployee } from '@/api/leave';
import { useSearchLeaveEmployees } from '@/hooks/useLeave';

interface Props {
  onSelectEmployee: (employee: LeaveSearchEmployee) => void;
  selectedEmployeeId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
}

export function EmployeeLeaveSearch({
  onSelectEmployee,
  selectedEmployeeId,
  placeholder = 'Search by employee name, personnel number, username or ID...',
  autoFocus = false,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search term by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: results = [], isLoading, isFetching } = useSearchLeaveEmployees(
    debouncedTerm,
    debouncedTerm.length > 0,
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (emp: LeaveSearchEmployee) => {
    onSelectEmployee(emp);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (searchTerm.trim().length > 0 || results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm transition placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setDebouncedTerm('');
              setIsOpen(false);
            }}
            className="absolute right-3 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            Clear
          </button>
        )}
        {isFetching && !searchTerm && (
          <div className="absolute right-3 text-xs text-slate-400">
            Searching...
          </div>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && debouncedTerm.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              Searching employee records...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No employees found</p>
              <p className="mt-1 text-xs text-slate-500">
                No matching record for &ldquo;{debouncedTerm}&rdquo;
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((emp) => {
                const isSelected = emp.id === selectedEmployeeId;
                return (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(emp)}
                      className={`flex w-full items-center gap-3 rounded-lg p-4 text-left transition ${
                        isSelected
                          ? 'bg-green-50 text-green-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-xs font-bold text-green-800">
                        {getInitials(emp.full_name)}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {emp.full_name}
                          </span>
                          <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {emp.role}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                          {emp.personnel_number && (
                            <span className="font-mono">
                              Personnel No: <strong className="text-slate-700">{emp.personnel_number}</strong>
                            </span>
                          )}
                          <span className="text-slate-500">
                            {emp.department_name}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

