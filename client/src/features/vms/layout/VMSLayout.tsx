import { ReactNode } from "react";

interface VMSLayoutProps {
  children: ReactNode;
}

export const VMSLayout = ({ children }: VMSLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans w-full">
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
