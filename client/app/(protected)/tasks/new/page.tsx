'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft } from 'lucide-react';

export default function NewTaskPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskType = searchParams.get('taskType') || 'OFFICIAL';

  useEffect(() => {
    if (!isLoading && user?.role === 'EMPLOYEE' && taskType !== 'EMPLOYEE_SHARED') {
      router.replace('/tasks');
    }
  }, [user, isLoading, router, taskType]);

  if (isLoading || (user?.role === 'EMPLOYEE' && taskType !== 'EMPLOYEE_SHARED')) return null;

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/tasks"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Tasks
        </Link>

        <h1 className="text-3xl font-bold text-gray-900">Create New Task</h1>
        <p className="mt-2 text-gray-600">Fill in the details below to create a new task</p>
      </div>

      <div className="max-w-2xl">
        <TaskForm onSuccess={() => {}} taskType={taskType} />
      </div>
    </div>
  );
}
