import { useState, useRef, useEffect, useMemo } from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { ChevronDown, Search, Check } from 'lucide-react';

interface EmployeeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function EmployeeSelector({ value, onChange, error }: EmployeeSelectorProps) {
  const { data: employees = [], isLoading, isError } = useEmployees();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else if (!isOpen) {
      setSearch(''); // clear search when closed to reset list next time
    }
  }, [isOpen]);

  const filteredEmployees = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return employees;
    return employees.filter((emp: any) => 
      emp.fullName?.toLowerCase().includes(term) ||
      emp.employeeCode?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term)
    );
  }, [employees, search]);

  const selectedEmployee = useMemo(() => {
    return employees.find(emp => emp.id === value);
  }, [employees, value]);

  const handleSelect = (empId: string) => {
    onChange(empId);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2 font-poppins relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-gray-700">Select Employee (Host) *</label>
      
      <div 
        className={`flex min-h-[40px] w-full items-center justify-between rounded-md border ${error ? 'border-red-500' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isLoading || isError ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onClick={() => {
          if (!isLoading && !isError) setIsOpen(!isOpen);
        }}
      >
        <div className="truncate flex-1">
          {isLoading ? 'Loading hosts...' : isError ? 'Error loading hosts' : 
            selectedEmployee ? (
              <span className="text-gray-900">{selectedEmployee.fullName} {selectedEmployee.department ? `(${selectedEmployee.department})` : ''}</span>
            ) : (
              <span className="text-gray-500">Select Host Employee...</span>
            )
          }
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg outline-none animate-in fade-in zoom-in-95">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredEmployees.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                No employee found.
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 hover:text-gray-900 ${value === emp.id ? 'bg-gray-50 font-medium' : ''}`}
                  onClick={() => handleSelect(emp.id)}
                >
                  <div className="flex flex-col flex-1">
                    <span className="text-gray-900">{emp.fullName}</span>
                    <span className="text-xs text-gray-500">
                      {emp.department ? `${emp.department}` : 'No Dept'} 
                      {emp.employeeCode ? ` • ${emp.employeeCode}` : ''}
                    </span>
                  </div>
                  {value === emp.id && (
                    <Check className="h-4 w-4 text-green-600 ml-2 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
