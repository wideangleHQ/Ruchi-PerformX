'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PageContainer } from '@/features/vms/shared/components/PageContainer';
import { VisitorRequestResponse } from '@/features/vms/employee-request/types/employee-request.types';
import { Loader2 } from 'lucide-react';

const RequestSuccessCard = dynamic(
  () => import('@/features/vms/employee-request/components/RequestSuccessCard').then(mod => mod.RequestSuccessCard),
  { 
    ssr: false,
    loading: () => <Loader2 className="w-8 h-8 animate-spin text-green-600" />
  }
);

export default function SuccessPage() {
  const router = useRouter();
  const [request, setRequest] = useState<VisitorRequestResponse | null>(null);
  
  useEffect(() => {
    const data = sessionStorage.getItem('lastVisitorRequest');
    if (data) {
      setRequest(JSON.parse(data));
    } else {
      router.push('/vms/employee/request');
    }
  }, [router]);

  const handleReset = () => {
    sessionStorage.removeItem('lastVisitorRequest');
    router.push('/vms/employee/request');
  };

  return (
    <PageContainer>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        {request && <RequestSuccessCard request={request} onReset={handleReset} />}
      </div>
    </PageContainer>
  );
}
