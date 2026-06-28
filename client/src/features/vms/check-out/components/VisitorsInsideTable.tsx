import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { VisitInsideResponse } from '../types/check-out.types';
import { VisitStatusBadge } from './VisitStatusBadge';
import { VisitDurationCard } from './VisitDurationCard';

interface VisitorsInsideTableProps {
  visits: VisitInsideResponse[];
  onCheckOut: (visit: VisitInsideResponse) => void;
}

export function VisitorsInsideTable({ visits, onCheckOut }: VisitorsInsideTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Check In Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Slip No</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  No visitors currently inside
                </TableCell>
              </TableRow>
            ) : (
              visits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell className="font-medium text-gray-900">{visit.visitor.fullName}</TableCell>
                  <TableCell>{visit.visitor.company || 'N/A'}</TableCell>
                  <TableCell>{visit.employee.full_name}</TableCell>
                  <TableCell>{visit.employee.department || 'N/A'}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{visit.purpose}</TableCell>
                  <TableCell>
                    {new Date(visit.checkInTime).toLocaleTimeString([], { timeStyle: 'short' })}
                  </TableCell>
                  <TableCell>
                    <VisitDurationCard checkInTime={visit.checkInTime} />
                  </TableCell>
                  <TableCell className="font-semibold">{visit.passNumber || '--'}</TableCell>
                  <TableCell>
                    <VisitStatusBadge status={visit.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <button 
                      onClick={() => onCheckOut(visit)}
                      className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                    >
                      Check Out
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
