import { useState } from 'react';
import { PassResponse } from '../types/pass.types';
import { useReprintPermissionSlip } from '../hooks/useReprintPermissionSlip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ReprintPermissionSlipDialogProps {
  slip: PassResponse | null;
  onClose: () => void;
}

export function ReprintPermissionSlipDialog({ slip, onClose }: ReprintPermissionSlipDialogProps) {
  const [reason, setReason] = useState('');
  const { mutateAsync: reprintSlip, isPending } = useReprintPermissionSlip();

  if (!slip) return null;

  const handleReprint = async () => {
    try {
      await reprintSlip({ passNumber: slip.visitId, payload: { reason: reason || undefined } });
      // Call print dialog logic subsequently
      window.print();
      onClose();
    } catch (error) {
      console.error('Failed to register reprint request', error);
    }
  };

  return (
    <Dialog open={!!slip} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] font-poppins">
        <DialogHeader>
          <DialogTitle>Reprint Permission Slip</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          <div className="bg-orange-50 p-4 rounded-md border border-orange-200">
            <h4 className="font-semibold text-orange-800 text-sm mb-2">Print History</h4>
            <ul className="text-xs text-orange-700 space-y-1">
              <li><strong>Previous Prints:</strong> {slip.printCopies} time(s)</li>
              <li><strong>Last Printed By:</strong> {slip.printedBy || 'Unknown User'}</li>
              <li><strong>Last Printed On:</strong> {slip.printedAt ? new Date(slip.printedAt).toLocaleString() : 'N/A'}</li>
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-gray-700">
              You are about to reprint slip <strong className="text-black">{slip.passNumber}</strong> for visitor <strong className="text-black">{slip.visitor.fullName}</strong>.
            </p>
            
            <div className="space-y-1 pt-2">
              <label className="font-medium text-gray-700">Reason for Reprint (Optional)</label>
              <input 
                type="text" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Printer Jam, Lost Slip"
                className="w-full h-10 border rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleReprint}
            disabled={isPending}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isPending ? 'Processing...' : 'Confirm & Print'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
