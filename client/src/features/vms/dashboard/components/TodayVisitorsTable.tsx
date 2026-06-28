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
              <TableHead>Check In Time</TableHead>
              <TableHead>Current Status</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No recent visitors
                </TableCell>
              </TableRow>
            ) : (
              visitors.map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-medium">{visitor.fullName}</TableCell>
                  <TableCell>{visitor.mobileNumber || 'N/A'}</TableCell>
                  <TableCell>{visitor.purpose}</TableCell>
                  <TableCell>
                    {visitor.checkInTime 
                      ? new Date(visitor.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      visitor.status.toLowerCase() === 'inside' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {visitor.status}
                    </span>
                  </TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
