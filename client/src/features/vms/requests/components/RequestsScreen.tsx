'use client';

import { useState } from 'react';
import { useVisitorRequests } from '../hooks/useVisitorRequests';
import { RequestFilters } from './RequestFilters';
import { RequestTable } from './RequestTable';
import { RequestDetailsDialog } from './RequestDetailsDialog';
import { VisitorRequestFilter, VisitorRequestResponse } from '../types/request.types';

export function RequestsScreen() {
  const [filters, setFilters] = useState<VisitorRequestFilter>({ page: 1, limit: 20 });
  const [selectedRequest, setSelectedRequest] = useState<VisitorRequestResponse | null>(null);

  const { data, isLoading, error } = useVisitorRequests(filters);

  const handleFilterChange = (newFilters: Partial<VisitorRequestFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Visitor Requests</h2>
        <p className="text-sm text-gray-500 mt-1">Review and manage pre-registration requests</p>
      </div>

      <RequestFilters onFilterChange={handleFilterChange} />

      <div className="bg-white rounded-xl shadow-sm border p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg">
            A system error occurred. Please try again later.
          </div>
        ) : (
          <RequestTable 
            requests={data?.data || []} 
            onView={setSelectedRequest}
          />
        )}
      </div>

      <RequestDetailsDialog 
        request={selectedRequest} 
        onClose={() => setSelectedRequest(null)} 
      />
    </div>
  );
}
