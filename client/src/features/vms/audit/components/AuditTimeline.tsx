import { AuditLog } from '../types/audit.types';
import { AuditStatusBadge } from './AuditStatusBadge';

interface AuditTimelineProps {
  logs: AuditLog[];
  onViewDetails: (log: AuditLog) => void;
}

export function AuditTimeline({ logs, onViewDetails }: AuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white border rounded-xl font-poppins shadow-sm">
        No recent activities to display.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl p-6 font-poppins shadow-sm max-h-[600px] overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
      
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
        {logs.map((log) => (
          <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white bg-green-100 text-green-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ml-0 md:ml-auto md:mr-auto">
              <div className="w-2 h-2 rounded-full bg-green-600"></div>
            </div>
            
            <div 
              className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer ml-4 md:ml-0"
              onClick={() => onViewDetails(log)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 text-xs truncate mr-2">{log.action}</span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString([], { timeStyle: 'short' })}
                </span>
              </div>
              <div className="text-[11px] text-gray-600 space-y-0.5 mb-2">
                <p>User: <span className="font-medium text-gray-800">{log.performedBy}</span></p>
                {log.visitor && <p>Visitor: <span className="font-medium text-gray-800">{log.visitor}</span></p>}
              </div>
              <AuditStatusBadge status={log.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
