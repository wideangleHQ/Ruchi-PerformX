import { PassResponse } from '../types/pass.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PermissionSlipDocument } from './PermissionSlipDocument';
import { PrintPortal } from './PrintPortal';
import { Printer } from 'lucide-react';

interface PrintPermissionSlipDialogProps {
  slip: PassResponse | null;
  onClose: () => void;
}

export function PrintPermissionSlipDialog({ slip, onClose }: PrintPermissionSlipDialogProps) {
  if (!slip) return null;

  const handlePrint = () => {
    // Future: Connect to specific printer drivers
    window.print();
    onClose();
  };

  return (
    <>
      <Dialog open={!!slip} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="screen-only max-w-4xl font-poppins max-h-[95vh] overflow-hidden flex flex-col bg-gray-100">
          <DialogHeader className="bg-white p-4 pb-0 flex-shrink-0">
              <DialogTitle className="flex justify-between items-center pr-8">
                <span>Print Permission Slip</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700 text-white flex gap-2">
                    <Printer className="h-4 w-4" />
                    Print Document
                  </Button>
                </div>
              </DialogTitle>
              <div className="flex gap-4 mt-4 pb-4 border-b text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Printer: </span>
                  <select className="border rounded px-2 py-1 bg-white">
                    <option>A4 Office Printer</option>
                    <option>80mm Thermal Printer</option>
                    <option>Export to PDF</option>
                  </select>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Copies: </span>
                  <input type="number" defaultValue={1} min={1} max={5} className="border rounded px-2 py-1 w-16 bg-white" />
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-8 flex justify-center">
              <div className="w-full max-w-2xl bg-white shadow-xl">
                <PermissionSlipDocument slip={slip} />
              </div>
            </div>
        </DialogContent>
      </Dialog>

      <PrintPortal>
        <PermissionSlipDocument slip={slip} />
      </PrintPortal>
    </>
  );
}
