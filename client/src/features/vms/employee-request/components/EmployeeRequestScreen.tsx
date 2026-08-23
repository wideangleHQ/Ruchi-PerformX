'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeRequestSchema, EmployeeRequestFormValues } from '../schemas/employee-request.schema';
import { useCreateEmployeeRequest } from '../hooks/useCreateEmployeeRequest';
import { EmployeeInfoCard } from './EmployeeInfoCard';
import { VisitorRequestForm } from './VisitorRequestForm';
import { EmployeeInfo } from '../types/employee-request.types';

export function EmployeeRequestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mutateAsync, isPending } = useCreateEmployeeRequest();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The request is raised under the caller's own PerformX session, so the card
  // shows who that is. The server reads the same token to set the host.
  const employee: EmployeeInfo | null = user && {
    employeeId: user.username,
    fullName: user.fullName,
    department: user.departmentName ?? 'No department',
    role: user.role,
  };

  const form = useForm<EmployeeRequestFormValues>({
    resolver: zodResolver(employeeRequestSchema),
    defaultValues: {
      visitorName: '',
      mobileNumber: '',
      company: '',
      address: '',
      purpose: '',
      preferredDate: '',
      preferredTime: '',
      remarks: ''
    }
  });

  const onSubmit = async (values: EmployeeRequestFormValues) => {
    setSubmitError(null);
    try {
      const result = await mutateAsync(values);
      sessionStorage.setItem('lastVisitorRequest', JSON.stringify(result));
      router.push('/vms/employee/success');
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })
        .response?.data?.message;
      setSubmitError(
        (Array.isArray(message) ? message[0] : message) ??
          'Could not submit the request. Check your connection and try again.',
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full font-poppins bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-gray-100 my-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Visitor Request</h1>
        <p className="text-gray-500 mt-1">Submit a request to authorize a visitor to enter the premises.</p>
      </div>

      {employee ? <EmployeeInfoCard employee={employee} /> : null}

      {submitError ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <div className="bg-gray-50 p-6 md:p-8 rounded-xl border">
        <h3 className="text-sm font-semibold text-gray-900 mb-6 uppercase tracking-wider">Visitor Details</h3>
        <VisitorRequestForm form={form} onSubmit={onSubmit} isPending={isPending} />
      </div>
    </div>
  );
}
