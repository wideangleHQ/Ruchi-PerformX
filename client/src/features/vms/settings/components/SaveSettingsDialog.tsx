import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SettingsFormValues } from '../schemas/settings.schema';

interface SaveSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  values?: SettingsFormValues;
}

export function SaveSettingsDialog({ open, onOpenChange, onConfirm, isPending, values }: SaveSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] font-poppins">
        <DialogHeader>
          <DialogTitle>Confirm Settings Changes</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-500 mb-4">
            You are about to save changes to the enterprise VMS configuration. 
            Are you sure you want to apply these updates globally?
          </p>
          <div className="bg-gray-50 rounded p-4 text-xs font-mono overflow-auto max-h-[150px] border">
            {values && (
              <pre>{JSON.stringify({ 
                companyName: values.companyName,
                receptionName: values.receptionName,
                timeZone: values.defaultTimeZone,
                autoCheckOut: values.autoCheckOutAfterBusinessHours
              }, null, 2)}</pre>
            )}
            <p className="text-gray-400 mt-2 italic">+ other configurations</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white">
            {isPending ? 'Saving...' : 'Confirm & Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
