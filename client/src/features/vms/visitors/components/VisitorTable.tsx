import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Visitor } from '../types/visitor.types';
import { User } from 'lucide-react';
import { VisitorDetailsDialog } from './VisitorDetailsDialog';

interface VisitorTableProps {
  visitors: Visitor[];
}

export function VisitorTable({ visitors }: VisitorTableProps) {
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);

  return (
    <>
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden font-poppins">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No visitors found
                  </TableCell>
                </TableRow>
              ) : (
                visitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell>
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100 flex items-center justify-center">
                        {visitor.profileImage ? (
                          <img src={visitor.profileImage} alt={visitor.fullName} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">{visitor.fullName}</TableCell>
                    <TableCell>{visitor.mobileNumber || 'N/A'}</TableCell>
                    <TableCell>{visitor.companyName || 'N/A'}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={visitor.address}>
                      {visitor.address || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {visitor.lastVisit ? new Date(visitor.lastVisit).toLocaleDateString() : 'New'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        visitor.status.toLowerCase() === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {visitor.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button 
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                        onClick={() => setSelectedVisitorId(visitor.id)}
                      >
                        View
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <VisitorDetailsDialog 
        visitorId={selectedVisitorId} 
        onClose={() => setSelectedVisitorId(null)} 
      />
    </>
  );
}
