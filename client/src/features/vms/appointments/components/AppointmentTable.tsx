import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { AppointmentResponse } from '../types/appointment.types';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';

interface AppointmentTableProps {
  appointments: AppointmentResponse[];
  onView: (appointment: AppointmentResponse) => void;
}

export function AppointmentTable({ appointments, onView }: AppointmentTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Visitor ID</TableHead>
              <TableHead>Host Employee</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Appointment Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No appointments found
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((app) => {
                const scheduledDate = app.scheduledAt ? new Date(app.scheduledAt) : null;
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <AppointmentStatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 truncate max-w-[120px]" title={app.visitorId}>
                      {app.visitorId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="truncate max-w-[120px]" title={app.hostEmployeeId}>
                      {app.hostEmployeeId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="truncate max-w-[150px]">{app.purpose}</TableCell>
                    <TableCell>
                      {scheduledDate ? scheduledDate.toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {scheduledDate ? scheduledDate.toLocaleTimeString([], { timeStyle: 'short' }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <button 
                        onClick={() => onView(app)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Manage
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
