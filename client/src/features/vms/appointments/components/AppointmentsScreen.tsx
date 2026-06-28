'use client';

import { useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import { AppointmentFilters } from './AppointmentFilters';
import { AppointmentTable } from './AppointmentTable';
import { AppointmentDialog } from './AppointmentDialog';
import { AppointmentCalendar } from './AppointmentCalendar';
import { SearchAppointmentFilter, AppointmentResponse } from '../types/appointment.types';

export function AppointmentsScreen() {
  const [filters, setFilters] = useState<SearchAppointmentFilter>({ page: 1, limit: 20 });
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentResponse | null>(null);

  const { data, isLoading, error } = useAppointments(filters);

  const handleFilterChange = (newFilters: Partial<SearchAppointmentFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleDateSelect = (date: string) => {
    setFilters(prev => ({ ...prev, dateFrom: date, dateTo: date, page: 1 }));
  };

  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Appointments</h2>
          <p className="text-sm text-gray-500 mt-1">Manage scheduled visits and appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <AppointmentDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <AppointmentCalendar onDateSelect={handleDateSelect} />
        </div>
        
        <div className="lg:col-span-3 flex flex-col gap-4">
          <AppointmentFilters onFilterChange={handleFilterChange} />

          <div className="bg-white rounded-xl shadow-sm border">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg m-4">
                Failed to load appointments. Please try again.
              </div>
            ) : (
              <AppointmentTable 
                appointments={data?.data || []} 
                onView={setSelectedAppointment}
              />
            )}
          </div>
        </div>
      </div>

      {/* Note: Update/View dialog could be triggered from selectedAppointment state if needed */}
    </div>
  );
}
