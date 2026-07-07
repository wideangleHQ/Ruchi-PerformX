import { RecentVisitor } from '../types/dashboard.types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface TodayVisitorsTableProps {
  visitors: RecentVisitor[];
}

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  });
};

export function TodayVisitorsTable({ visitors }: TodayVisitorsTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="px-6 py-4 border-b">
        <h3 className="font-semibold text-lg text-gray-900">Today's Visitors</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Whom To Meet</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Check-In Time</TableHead>
              <TableHead>Check-Out Time</TableHead>
              <TableHead>Current Status</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No visitors today
                </TableCell>
              </TableRow>
            ) : (
              visitors.map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-medium">{visitor.visitor.fullName}</TableCell>
                  <TableCell>{visitor.visitor.companyName?.trim() || '-'}</TableCell>
                  <TableCell>{visitor.hostEmployee?.fullName || 'Not Assigned'}</TableCell>
                  <TableCell>{visitor.purpose || '-'}</TableCell>
                  <TableCell>{formatTime(visitor.checkedInAt)}</TableCell>
                  <TableCell>{visitor.checkedOutAt ? formatTime(visitor.checkedOutAt) : 'Inside'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      visitor.status === 'CHECKED_IN'
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {visitor.status}
                    </span>
                  </TableCell>
                  <TableCell>{formatDateTime(visitor.updatedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
