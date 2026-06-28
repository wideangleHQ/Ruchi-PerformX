import { ReportSummary } from '../types/report.types';

interface ReportSummaryCardsProps {
  summary?: ReportSummary;
}

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  if (!summary) return null;

  const cards = [
    { label: "Today's Visitors", value: summary.todayVisitors, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "Visitors This Week", value: summary.weekVisitors, color: "text-purple-700", bg: "bg-purple-50" },
    { label: "Visitors This Month", value: summary.monthVisitors, color: "text-indigo-700", bg: "bg-indigo-50" },
    { label: "Currently Inside", value: summary.currentlyInside, color: "text-orange-700", bg: "bg-orange-50" },
    { label: "Completed Visits", value: summary.completedVisits, color: "text-green-700", bg: "bg-green-50" },
    { label: "Cancelled Visits", value: summary.cancelledVisits, color: "text-red-700", bg: "bg-red-50" }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-poppins">
      {cards.map((card, i) => (
        <div key={i} className={`rounded-xl border p-4 flex flex-col items-center text-center shadow-sm ${card.bg}`}>
          <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
          <span className="text-xs font-medium text-gray-600 mt-1 uppercase tracking-wide">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
