import { LucideIcon } from 'lucide-react';
import { SummaryCard } from './SummaryCard';

export interface StatisticsCardProps {
  title: string;
  count: number | string;
  icon: LucideIcon;
  subtitle?: string;
}

export function StatisticsCard({ title, count, icon, subtitle }: StatisticsCardProps) {
  return (
    <SummaryCard
      title={title}
      value={count}
      icon={icon}
      description={subtitle}
    />
  );
}
