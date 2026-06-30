'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createVisitSchema, CreateVisitFormValues } from '../schemas/create-visit.schema';
import { useCreateVisit } from '../hooks/useCreateVisit';
import { useCheckIn } from '../hooks/useCheckIn';
import { EmployeeSelector } from './EmployeeSelector';
import { PurposeField } from './PurposeField';
import { VisitSummary } from './VisitSummary';
import { CheckInCard } from './CheckInCard';
import { useVisitors } from '../../visitors/hooks/useVisitors';

export function QuickEntryCard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [createdVisitId, setCreatedVisitId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: visitorsData, isLoading: isLoadingVisitors } = useVisitors({ 
    page: 1, 
    limit: 10, 
    search: searchTerm || undefined 
  });

  const { mutateAsync: createVisit, isPending: isCreating } = useCreateVisit();
  const { mutateAsync: checkIn, isPending: isCheckingIn } = useCheckIn();

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateVisitFormValues>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: {
      visitorId: '', 
      hostEmployeeId: '',
      purpose: '',
      peopleCount: 1,
    }
  });

  const watchAll = watch();
  const selectedVisitor = visitorsData?.data?.find(v => v.id === watchAll.visitorId);

  const onNext = async (data: CreateVisitFormValues) => {
    try {
      const visit = await createVisit(data);
      setCreatedVisitId(visit.id);
      setStep(2);
    } catch (error) {
      console.error('Failed to create visit', error);
    }
  };

  const onCheckIn = async () => {
    if (!createdVisitId) return;
    try {
      await checkIn({ visitId: createdVisitId });
      alert('Check-in successful!');
      window.location.reload();
    } catch (error) {
      console.error('Failed to check in', error);
    }
  };

  return (
    <div className="max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 font-poppins">
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Create Visit</h2>
          
          <form id="visit-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Search Existing Visitor *</label>
              <input
                type="text"
                placeholder="Search by name or mobile..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={step === 2}
              />
              
              {searchTerm && !watchAll.visitorId && (
                <div className="border rounded-md max-h-40 overflow-y-auto bg-gray-50 p-2 shadow-sm">
                  {isLoadingVisitors ? (
                    <div className="text-xs text-gray-500 p-2">Searching...</div>
                  ) : visitorsData?.data?.length ? (
                    visitorsData.data.map(v => (
                      <div 
                        key={v.id} 
                        className="p-2 text-sm hover:bg-gray-200 cursor-pointer rounded-md border-b last:border-b-0 border-gray-200"
                        onClick={() => {
                          setValue('visitorId', v.id, { shouldValidate: true });
                          setSearchTerm('');
                        }}
                      >
                        <div className="font-medium text-gray-900">{v.fullName}</div>
                        <div className="text-xs text-gray-500">{v.mobileNumber || v.email}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500 p-2">No visitors found. Please register them first.</div>
                  )}
                </div>
              )}
              
              {watchAll.visitorId && (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <div>
                    <div className="text-sm font-medium text-green-900">{selectedVisitor?.fullName || 'Visitor Selected'}</div>
                    <div className="text-xs text-green-700">{selectedVisitor?.mobileNumber || ''}</div>
                  </div>
                  {step === 1 && (
                    <button 
                      type="button" 
                      onClick={() => setValue('visitorId', '')} 
                      className="text-xs text-red-600 font-medium hover:underline"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
              {errors.visitorId && <p className="text-xs text-red-500">{errors.visitorId.message}</p>}
            </div>

            <Controller
              name="hostEmployeeId"
              control={control}
              render={({ field }) => (
                <EmployeeSelector 
                  value={field.value} 
                  onChange={field.onChange} 
                  error={errors.hostEmployeeId?.message} 
                />
              )}
            />

            <Controller
              name="purpose"
              control={control}
              render={({ field }) => (
                <PurposeField 
                  value={field.value} 
                  onChange={field.onChange} 
                  error={errors.purpose?.message} 
                />
              )}
            />

            <Controller
              name="peopleCount"
              control={control}
              render={({ field }) => (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">People Entering *</label>
                  <div className="flex items-center space-x-4 mt-2">
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.max(1, field.value - 1))}
                      className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-2xl font-semibold text-gray-700 transition-colors disabled:opacity-50"
                      disabled={field.value <= 1}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={field.value}
                      onChange={(e) => field.onChange(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="w-20 h-12 text-center text-xl font-bold rounded-lg border border-input focus:ring-2 focus:ring-ring focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.min(50, field.value + 1))}
                      className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-2xl font-semibold text-gray-700 transition-colors disabled:opacity-50"
                      disabled={field.value >= 50}
                    >
                      +
                    </button>
                  </div>
                  {errors.peopleCount && <p className="text-xs text-red-500 mt-1">{errors.peopleCount.message}</p>}
                </div>
              )}
            />
          </form>
        </div>

        {step === 1 && (
          <button 
            type="submit" 
            form="visit-form"
            disabled={isCreating}
            className="w-full bg-green-600 text-white rounded-xl shadow-sm py-3 font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Creating Visit...' : 'Review & Check-In'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <VisitSummary 
          visitorName={selectedVisitor?.fullName} 
          hostName={watchAll.hostEmployeeId ? 'Selected Host (ID: ' + watchAll.hostEmployeeId.slice(0, 8) + '...)' : undefined}
          purpose={watchAll.purpose}
          peopleCount={watchAll.peopleCount}
        />

        {step === 2 && (
          <CheckInCard 
            onCheckIn={onCheckIn} 
            isPending={isCheckingIn} 
            visitor={selectedVisitor}
          />
        )}
      </div>
    </div>
  );
}
