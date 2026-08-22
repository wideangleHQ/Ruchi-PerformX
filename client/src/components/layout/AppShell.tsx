'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AssistantPanel } from '../assistant/AssistantPanel';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f4f7f4] font-sans text-slate-900">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
      {/* Every screen inside the shell, so the panel is reachable without
          leaving what the user was doing. */}
      <AssistantPanel />
    </div>
  );
}
