import { ReactNode } from 'react';
import { ReceptionLayout } from '@/features/vms/layout/ReceptionLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <ReceptionLayout>{children}</ReceptionLayout>;
}
