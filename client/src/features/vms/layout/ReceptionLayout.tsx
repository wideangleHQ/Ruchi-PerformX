import { ReactNode } from 'react';
import { ReceptionSidebar } from '../shared/components/ReceptionSidebar';
import { ReceptionHeader } from '../shared/components/ReceptionHeader';

interface ReceptionLayoutProps {
  children: ReactNode;
}

export function ReceptionLayout({ children }: ReceptionLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-gray-50 font-poppins text-gray-900">
      <div className="sticky top-0 h-screen shrink-0">
        <ReceptionSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ReceptionHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
