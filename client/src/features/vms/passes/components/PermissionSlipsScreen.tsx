'use client';

import { useState } from 'react';
import { usePermissionSlips } from '../hooks/usePermissionSlips';
import { PermissionSlipFilters } from './PermissionSlipFilters';
import { PermissionSlipTable } from './PermissionSlipTable';
import { PrintPermissionSlipDialog } from './PrintPermissionSlipDialog';
import { ReprintPermissionSlipDialog } from './ReprintPermissionSlipDialog';
import { SearchPassFilter, PassResponse } from '../types/pass.types';

export function PermissionSlipsScreen() {
  const [filters, setFilters] = useState<SearchPassFilter>({ page: 1, limit: 20 });
  const [previewSlip, setPreviewSlip] = useState<PassResponse | null>(null);
  const [printSlip, setPrintSlip] = useState<PassResponse | null>(null);
  const [reprintSlip, setReprintSlip] = useState<PassResponse | null>(null);

  const { data, isLoading, error } = usePermissionSlips(filters);

  const handleFilterChange = (newFilters: Partial<SearchPassFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Permission Slips</h2>
        <p className="text-sm text-gray-500 mt-1">Manage and print active visitor permission slips</p>
      </div>

      <PermissionSlipFilters onFilterChange={handleFilterChange} />

      <div className="bg-white rounded-xl shadow-sm border p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg">
            Failed to load permission slips.
          </div>
        ) : (
          <PermissionSlipTable 
            slips={data?.data || []} 
            onPreview={setPreviewSlip}
            onPrint={setPrintSlip}
            onReprint={setReprintSlip}
          />
        )}
      </div>

      <PrintPermissionSlipDialog 
        slip={previewSlip || printSlip} 
        onClose={() => {
          setPreviewSlip(null);
          setPrintSlip(null);
        }} 
      />

      <ReprintPermissionSlipDialog 
        slip={reprintSlip} 
        onClose={() => setReprintSlip(null)} 
      />
    </div>
  );
}
