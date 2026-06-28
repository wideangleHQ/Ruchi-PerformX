'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeRequestSchema, EmployeeRequestFormValues } from '../schemas/employee-request.schema';
import { useCreateEmployeeRequest } from '../hooks/useCreateEmployeeRequest';
import { EmployeeInfoCard } from './EmployeeInfoCard';
import { VisitorRequestForm } from './VisitorRequestForm';
import { EmployeeInfo } from '../types/employee-request.types';

export function EmployeeRequestScreen() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateEmployeeRequest();

  // Simulated employee info since we are skipping the access code entry flow
  const employee: EmployeeInfo = {
    employeeId: 'EMP-001',
    fullName: 'Jane Doe',
    department: 'Engineering',
    designation: 'Senior Developer',
    location: 'Building A, Floor 3'
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
    try {
      const result = await mutateAsync(values);
      sessionStorage.setItem('lastVisitorRequest', JSON.stringify(result));
      router.push('/vms/employee/success');
    } catch (e) {
      console.error('Failed to create request', e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full font-poppins bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-gray-100 my-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Visitor Request</h1>
        <p className="text-gray-500 mt-1">Submit a request to authorize a visitor to enter the premises.</p>
      </div>

      <EmployeeInfoCard employee={employee} />
      
      <div className="bg-gray-50 p-6 md:p-8 rounded-xl border">
        <h3 className="text-sm font-semibold text-gray-900 mb-6 uppercase tracking-wider">Visitor Details</h3>
        <VisitorRequestForm form={form} onSubmit={onSubmit} isPending={isPending} />
      </div>
    </div>
  );
}
