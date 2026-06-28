import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { PassResponse } from '../types/pass.types';
import { PermissionSlipStatusBadge } from './PermissionSlipStatusBadge';

interface PermissionSlipTableProps {
  slips: PassResponse[];
  onPreview: (slip: PassResponse) => void;
  onPrint: (slip: PassResponse) => void;
  onReprint: (slip: PassResponse) => void;
}

export function PermissionSlipTable({ slips, onPreview, onPrint, onReprint }: PermissionSlipTableProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slip No</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Time In</TableHead>
              <TableHead>Time Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Printed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No permission slips found
                </TableCell>
              </TableRow>
            ) : (
              slips.map((slip) => (
                <TableRow key={slip.passNumber}>
                  <TableCell className="font-semibold text-gray-900">{slip.passNumber}</TableCell>
                  <TableCell className="font-medium text-gray-900">{slip.visitor.fullName}</TableCell>
                  <TableCell>{slip.employee.full_name}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{slip.purpose || 'N/A'}</TableCell>
                  <TableCell>
                    {slip.checkInTime ? new Date(slip.checkInTime).toLocaleTimeString([], { timeStyle: 'short' }) : '--:--'}
                  </TableCell>
                  <TableCell>
                    {slip.checkOutTime ? new Date(slip.checkOutTime).toLocaleTimeString([], { timeStyle: 'short' }) : '--:--'}
                  </TableCell>
                  <TableCell>
                    <PermissionSlipStatusBadge status={slip.status} />
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {slip.printCopies && slip.printCopies > 0 ? `${slip.printCopies} time(s)` : 'No'}
                  </TableCell>
                  <TableCell className="text-right space-x-3">
                    <button 
                      onClick={() => onPreview(slip)}
                      className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                      Preview
                    </button>
                    {!slip.printCopies || slip.printCopies === 0 ? (
                      <button 
                        onClick={() => onPrint(slip)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Print
                      </button>
                    ) : (
                      <button 
                        onClick={() => onReprint(slip)}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                      >
                        Reprint
                      </button>
                    )}
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
