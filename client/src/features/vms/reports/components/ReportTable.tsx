import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ReportRow } from '../types/report.types';

export function ReportTable({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{row.visitorName}</TableCell>
                  <TableCell>{row.company || '--'}</TableCell>
                  <TableCell>{row.employeeName}</TableCell>
                  <TableCell>{row.department || '--'}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{row.purpose}</TableCell>
                  <TableCell>{row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { timeStyle: 'short' }) : '--:--'}</TableCell>
                  <TableCell>{row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { timeStyle: 'short' }) : '--:--'}</TableCell>
                  <TableCell>{row.duration || '--'}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{row.status}</span>
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
