import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  className?: string;
}

export const CompanyLogo = ({ className }: CompanyLogoProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", className)}>
      <div className="h-16 w-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
        <span className="text-white font-bold text-2xl">PX</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-black">PerformX ERP</h1>
      <p className="text-sm text-gray-500 font-medium">Visitor Management System</p>
      <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold">Ruchi Industries Ltd.</p>
    </div>
  );
};
