import { ReportData } from '../types/report.types';

export function EmployeeReportChart({ data }: { data?: ReportData['charts']['employeeWise'] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg border">
        No employee data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="h-64 p-4 font-poppins bg-white rounded-lg border shadow-sm flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Employee-wise Visitors</h3>
      <div className="flex-1 flex items-end gap-2 overflow-x-auto pb-2">
        {data.map((item, index) => {
          const height = `${(item.count / maxCount) * 100}%`;
          return (
            <div key={index} className="flex flex-col items-center gap-2 group flex-1 min-w-[40px]">
              <div 
                className="w-full bg-green-500 rounded-t-sm transition-all group-hover:bg-green-600 relative flex justify-center"
                style={{ height }}
              >
                <span className="absolute -top-6 text-xs text-gray-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.count}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 truncate w-full text-center" title={item.name}>
                {item.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
