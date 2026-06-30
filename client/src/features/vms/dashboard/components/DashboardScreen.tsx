'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import { useExportTodayVisitors } from '../hooks/useExportTodayVisitors';
import { StatisticsCard } from './StatisticsCard';
import { TodayVisitorsTable } from './TodayVisitorsTable';
import { Users, UserPlus, ClipboardList, CalendarDays, Activity, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardScreen() {
  const { summary, isLoading, error, refetch } = useDashboardSummary();
  const { mutate: exportVisitors, isPending: isExporting } = useExportTodayVisitors();

  const handleExport = () => {
    exportVisitors();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-red-600 font-poppins">
        <AlertCircle className="h-10 w-10" />
        <p>Failed to load dashboard data.</p>
        <button 
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = summary?.summary;
  const recent = summary?.recent || [];

  return (
    <div className="flex flex-col gap-8">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">Dashboard</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 font-poppins"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-poppins"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Downloading...' : 'Download Excel'}
          </Button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 font-poppins">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction href="/vms/reception/visits" icon={UserPlus} label="Quick Visitor Entry" />
          <QuickAction href="/vms/reception/visitors" icon={Users} label="Visitors" />
          <QuickAction href="/vms/reception/appointments" icon={CalendarDays} label="Appointments" />
          {/* <QuickAction href="/vms/reception/requests" icon={ClipboardList} label="Visitor Requests" /> */}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 font-poppins">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatisticsCard 
            title="Today's Visitors" 
            count={data?.todaysVisitors || 0} 
            icon={Users} 
            subtitle="Total checked-in today" 
          />
          <StatisticsCard 
            title="Visitors Inside" 
            count={data?.visitorsInside || 0} 
            icon={Activity} 
            subtitle="Currently on premises" 
          />
          {/* <StatisticsCard 
            title="Pending Requests" 
            count={data?.pendingRequests || 0} 
            icon={ClipboardList} 
            subtitle="Awaiting approval" 
          /> */}
          <StatisticsCard 
            title="Completed Visits" 
            count={data?.completedVisits || 0} 
            icon={CalendarDays} 
            subtitle="Successfully completed" 
          />
        </div>
      </section>

      <section>
        <TodayVisitorsTable visitors={recent} />
      </section>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md hover:border-green-200 transition-all group font-poppins">
      <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
        <Icon className="h-5 w-5 text-green-600" />
      </div>
      <span className="font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
    </Link>
  );
}
