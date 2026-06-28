import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { AuditLog } from '../types/audit.types';
import { AuditStatusBadge } from './AuditStatusBadge';

interface AuditTableProps {
  logs: AuditLog[];
  onViewDetails: (log: AuditLog) => void;
}

export function AuditTable({ logs, onViewDetails }: AuditTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ref Number</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell>{log.module}</TableCell>
                  <TableCell className="font-medium text-gray-900">{log.action}</TableCell>
                  <TableCell>{log.performedBy}</TableCell>
                  <TableCell>{log.visitor || '--'}</TableCell>
                  <TableCell>{log.employee || '--'}</TableCell>
                  <TableCell>
                    <AuditStatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-500 truncate max-w-[100px]" title={log.referenceNumber}>
                    {log.referenceNumber}
                  </TableCell>
                  <TableCell className="text-right">
                    <button 
                      onClick={() => onViewDetails(log)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
