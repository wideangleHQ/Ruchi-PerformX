import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, X, Check } from 'lucide-react';

interface CameraToolbarProps {
  hasCaptured: boolean;
  isProcessing: boolean;
  onCapture: () => void;
  onRetake: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CameraToolbar({ 
  hasCaptured, 
  isProcessing, 
  onCapture, 
  onRetake, 
  onConfirm, 
  onCancel 
}: CameraToolbarProps) {
  return (
    <div className="flex items-center justify-between pt-4 border-t mt-4 w-full gap-4 font-poppins">
      {!hasCaptured ? (
        <>
          <Button variant="outline" onClick={onCancel} className="min-w-[100px]">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={onCapture} 
            disabled={isProcessing}
            className="bg-gray-900 hover:bg-gray-800 text-white min-w-[120px]"
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={onRetake} disabled={isProcessing} className="min-w-[100px]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retake
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirm
          </Button>
        </>
      )}
    </div>
  );
}
