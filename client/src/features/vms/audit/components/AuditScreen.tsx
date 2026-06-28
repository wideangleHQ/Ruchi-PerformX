'use client';

import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { AuditFilter, AuditLog } from '../types/audit.types';
import { AuditFilters } from './AuditFilters';
import { AuditTable } from './AuditTable';
import { AuditTimeline } from './AuditTimeline';
import { AuditDetailsDialog } from './AuditDetailsDialog';

export function AuditScreen() {
  const [filters, setFilters] = useState<AuditFilter>({ page: 1, limit: 50 });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, error } = useAuditLogs(filters);

  const handleFilterChange = (newFilters: Partial<AuditFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const summary = data?.summary || {
    todayActivities: 0,
    successfulActions: 0,
    failedActions: 0,
    checkIns: 0,
    checkOuts: 0,
    permissionSlipsPrinted: 0
  };

  const summaryCards = [
    { label: "Today's Activities", value: summary.todayActivities, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "Successful Actions", value: summary.successfulActions, color: "text-green-700", bg: "bg-green-50" },
    { label: "Failed Actions", value: summary.failedActions, color: "text-red-700", bg: "bg-red-50" },
    { label: "Check-Ins", value: summary.checkIns, color: "text-indigo-700", bg: "bg-indigo-50" },
    { label: "Check-Outs", value: summary.checkOuts, color: "text-orange-700", bg: "bg-orange-50" },
    { label: "Slips Printed", value: summary.permissionSlipsPrinted, color: "text-purple-700", bg: "bg-purple-50" }
  ];

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Audit Logs</h2>
        <p className="text-sm text-gray-500 mt-1">Traceability and compliance monitoring</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card, i) => (
          <div key={i} className={`rounded-xl border p-4 flex flex-col items-center text-center shadow-sm ${card.bg}`}>
            <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 mt-1 uppercase tracking-wide">{card.label}</span>
          </div>
        ))}
      </div>

      <AuditFilters onFilterChange={handleFilterChange} />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg">
                Failed to load audit logs.
              </div>
            ) : (
              <AuditTable 
                logs={data?.data || []} 
                onViewDetails={setSelectedLog}
              />
            )}
          </div>
        </div>

        <div className="xl:col-span-1">
          {isLoading ? (
            <div className="bg-white border rounded-xl p-6 h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300" />
            </div>
          ) : (
            <AuditTimeline 
              logs={(data?.data || []).slice(0, 10)} 
              onViewDetails={setSelectedLog}
            />
          )}
        </div>
      </div>

      <AuditDetailsDialog 
        log={selectedLog} 
        onClose={() => setSelectedLog(null)} 
      />
    </div>
  );
}
