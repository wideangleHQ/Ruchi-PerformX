'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar />

      <div className="ml-64 min-h-screen p-margin-mobile md:p-margin-desktop">
        <Header />
        <main>{children}</main>
      </div>
    </div>
  );
}
