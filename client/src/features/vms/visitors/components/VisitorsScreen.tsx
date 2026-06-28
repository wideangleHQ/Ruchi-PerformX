'use client';

import { useState } from 'react';
import { VisitorSearch } from './VisitorSearch';
import { VisitorTable } from './VisitorTable';
import { VisitorFormDialog } from './VisitorFormDialog';
import { useVisitors } from '../hooks/useVisitors';

export function VisitorsScreen() {
  const [search, setSearch] = useState('');
  
  const { data, isLoading, error } = useVisitors({
    page: 1,
    limit: 20,
    search: search || undefined,
  });

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visitors</h2>
          <p className="text-sm text-gray-500">Manage and register visitors</p>
        </div>
        <div className="flex items-center gap-3">
          <VisitorFormDialog />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col gap-4">
        <VisitorSearch onSearch={setSearch} />
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Failed to load visitors.
          </div>
        ) : (
          <VisitorTable visitors={data?.data || []} />
        )}
      </div>
    </div>
  );
}
