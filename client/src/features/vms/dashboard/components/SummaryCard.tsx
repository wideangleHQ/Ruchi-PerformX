import { LucideIcon } from 'lucide-react';

export interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: string;
}

export function SummaryCard({ title, value, icon: Icon, description, trend }: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500 font-poppins">{title}</h3>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <div className="text-2xl font-bold text-gray-900 font-poppins">{value}</div>
        {trend && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-gray-500 font-poppins">{description}</p>
      )}
    </div>
  );
}
