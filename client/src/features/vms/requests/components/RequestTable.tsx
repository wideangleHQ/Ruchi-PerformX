import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { VisitorRequestResponse } from '../types/request.types';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestTableProps {
  requests: VisitorRequestResponse[];
  onView: (request: VisitorRequestResponse) => void;
}

export function RequestTable({ requests, onView }: RequestTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Visitor Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Preferred Schedule</TableHead>
              <TableHead>Requested On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No requests found matching the filters
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <RequestStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{req.visitorName}</TableCell>
                  <TableCell>{req.mobileNumber}</TableCell>
                  <TableCell className="truncate max-w-[120px]" title={req.hostEmployeeId}>
                    {req.hostEmployeeId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="truncate max-w-[150px]">{req.purpose}</TableCell>
                  <TableCell>
                    {new Date(req.expectedArrival).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <button 
                      onClick={() => onView(req)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Review
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
