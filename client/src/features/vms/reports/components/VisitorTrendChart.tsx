import { ReportData } from '../types/report.types';

interface VisitorTrendChartProps {
  dailyTrend?: ReportData['charts']['dailyTrend'];
}

export function VisitorTrendChart({ dailyTrend }: VisitorTrendChartProps) {
  if (!dailyTrend || dailyTrend.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg border">
        No trend data available
      </div>
    );
  }

  const maxCount = Math.max(...dailyTrend.map(d => d.count), 1);

  return (
    <div className="h-64 p-4 font-poppins bg-white rounded-lg border shadow-sm flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Visitor Trend</h3>
      <div className="flex-1 flex items-end gap-1 overflow-x-auto pb-2">
        {dailyTrend.map((item, index) => {
          const height = `${(item.count / maxCount) * 100}%`;
          return (
            <div key={index} className="flex flex-col items-center gap-1 group flex-1 min-w-[20px]">
              <div 
                className="w-full bg-blue-500 rounded-t-sm transition-all group-hover:bg-blue-600 relative flex justify-center"
                style={{ height }}
              >
                <span className="absolute -top-6 text-[10px] text-gray-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1 shadow rounded z-10 border">
                  {item.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
