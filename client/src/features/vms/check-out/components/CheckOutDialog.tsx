import { VisitInsideResponse } from '../types/check-out.types';
import { useCheckOut } from '../hooks/useCheckOut';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VisitDurationCard } from './VisitDurationCard';
import { useEffect, useState } from 'react';

interface CheckOutDialogProps {
  visit: VisitInsideResponse | null;
  onClose: () => void;
}

export function CheckOutDialog({ visit, onClose }: CheckOutDialogProps) {
  const { mutateAsync: checkOut, isPending } = useCheckOut();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (visit) {
      const interval = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [visit]);

  if (!visit) return null;

  const handleCheckOut = async () => {
    try {
      await checkOut(visit.id);
      onClose();
    } catch (error) {
      console.error('Check-out failed', error);
    }
  };

  return (
    <Dialog open={!!visit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] font-poppins">
        <DialogHeader>
          <DialogTitle>Confirm Visitor Check-Out</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="bg-gray-50 border rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Visitor</p>
              <p className="font-semibold text-gray-900">{visit.visitor.fullName}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Company</p>
              <p className="font-semibold text-gray-900">{visit.visitor.company || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Meeting With</p>
              <p className="font-semibold text-gray-900">{visit.employee.full_name}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Department</p>
              <p className="font-semibold text-gray-900">{visit.employee.department || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 mb-1">Purpose</p>
              <p className="font-semibold text-gray-900">{visit.purpose}</p>
            </div>
          </div>

          <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div>
              <p className="text-xs text-orange-700 font-semibold uppercase mb-1">Time In</p>
              <p className="text-lg font-bold text-orange-900">
                {new Date(visit.checkInTime).toLocaleTimeString([], { timeStyle: 'short' })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-orange-700 font-semibold uppercase mb-1">Duration</p>
              <VisitDurationCard checkInTime={visit.checkInTime} />
            </div>
            <div className="text-right">
              <p className="text-xs text-orange-700 font-semibold uppercase mb-1">Time Out</p>
              <p className="text-lg font-bold text-orange-900">
                {currentTime.toLocaleTimeString([], { timeStyle: 'short' })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCheckOut} 
            disabled={isPending}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isPending ? 'Processing...' : 'Complete Check-Out'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
