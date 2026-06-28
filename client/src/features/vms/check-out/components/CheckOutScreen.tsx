'use client';

import { useState } from 'react';
import { useVisitorsInside } from '../hooks/useVisitorsInside';
import { VisitorsInsideTable } from './VisitorsInsideTable';
import { CheckOutDialog } from './CheckOutDialog';
import { VisitInsideResponse } from '../types/check-out.types';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function CheckOutScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<VisitInsideResponse | null>(null);

  const { data: visits, isLoading, error } = useVisitorsInside();

  const filteredVisits = visits?.filter(visit => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      visit.visitor.fullName.toLowerCase().includes(term) ||
      (visit.visitor.company && visit.visitor.company.toLowerCase().includes(term)) ||
      visit.employee.full_name.toLowerCase().includes(term) ||
      (visit.passNumber && visit.passNumber.toLowerCase().includes(term))
    );
  }) || [];

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visitor Check-Out</h2>
          <p className="text-sm text-gray-500 mt-1">Manage active visitors currently on premises</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search by visitor, company or slip no..."
          className="pl-10 h-10 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg">
            Failed to load active visitors.
          </div>
        ) : (
          <VisitorsInsideTable 
            visits={filteredVisits} 
            onCheckOut={setSelectedVisit}
          />
        )}
      </div>

      <CheckOutDialog 
        visit={selectedVisit} 
        onClose={() => setSelectedVisit(null)} 
      />
    </div>
  );
}
