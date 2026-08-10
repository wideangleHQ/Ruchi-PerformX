'use client';

import { useState, useCallback } from 'react';
import { VisitorSearch } from './VisitorSearch';
import { VisitorTable } from './VisitorTable';
import { VisitorFormDialog } from './VisitorFormDialog';
import { useVisitors } from '../hooks/useVisitors';

export function VisitorsScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const { data, isLoading, isFetching, error } = useVisitors({
    page,
    limit,
    search: search || undefined,
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const totalPages = data?.meta?.totalPages || 0;
  const totalItems = data?.meta?.totalItems || 0;

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
        <VisitorSearch onSearch={handleSearch} />
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Failed to load visitors.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <VisitorTable visitors={data?.data || []} />
            
            {totalPages > 0 && (
              <div className="flex items-center justify-center gap-6 border-t pt-4">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1 || isFetching}
                  className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={page === totalPages || isFetching}
                  className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
