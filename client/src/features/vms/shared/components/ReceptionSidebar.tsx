'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAccessStore } from '../store/access.store';
import { NavItem } from './NavItem';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  ClipboardList, 
  CalendarDays, 
  Badge, 
  FileBarChart, 
  ShieldCheck, 
  Settings, 
  LogOut 
} from 'lucide-react';

export function ReceptionSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const resetAccess = useAccessStore((state) => state.reset);

  const navigation = [
    { label: 'Dashboard', href: '/vms/reception/dashboard', icon: LayoutDashboard },
    { label: 'Check-Out', href: '/vms/reception/check-out', icon: LogOut },
    { label: 'Visitors', href: '/vms/reception/visitors', icon: Users },
    { label: 'Visits', href: '/vms/reception/visits', icon: ClipboardList },
    { label: 'Visitor Requests', href: '/vms/reception/requests', icon: CalendarDays, hidden: true },
    { label: 'Appointments', href: '/vms/reception/appointments', icon: CalendarDays },
    { label: 'Passes', href: '/vms/reception/passes', icon: Badge },
    { label: 'Reports', href: '/vms/reception/reports', icon: FileBarChart, hidden: true },
    { label: 'Audit', href: '/vms/reception/audit', icon: ShieldCheck, hidden: true },
    { label: 'Settings', href: '/vms/reception/settings', icon: Settings, hidden: true },
  ].filter(item => !item.hidden);

  const handleLogout = () => {
    localStorage.removeItem('vmsAccessToken');
    localStorage.removeItem('vmsAccessType');
    queryClient.clear();
    resetAccess();
    router.push('/vms');
  };

  return (
    <aside className="flex h-full w-[280px] flex-col border-r bg-white">
      <div className="flex h-16 shrink-0 items-center border-b px-6">
        <span className="text-xl font-semibold tracking-tight text-black font-poppins">
          PerformX ERP
        </span>
      </div>
      
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4 scrollbar-hide">
        {navigation.map((item) => (
          <NavItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false)}
          />
        ))}
      </div>

      <div className="border-t p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <LogOut className="h-5 w-5 flex-shrink-0 text-gray-500" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
