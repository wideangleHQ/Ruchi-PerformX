import { formatDistanceToNow } from 'date-fns';
import { AuditLog } from '@/api/admin';

interface AuditLogsTableProps {
  logs: AuditLog[];
  isLoading?: boolean;
}

export function AuditLogsTable({ logs, isLoading }: AuditLogsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-600">Loading audit logs...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600">No audit logs found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              User
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Action
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Timestamp
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr
              key={log.id}
              className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="px-6 py-4 text-sm text-gray-900">{log.userId}</td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                  {log.action}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {formatDistanceToNow(new Date(log.timestamp), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                <code className="rounded bg-gray-100 px-2 py-1 text-xs">
                  {JSON.stringify(log.details).substring(0, 50)}...
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
