import { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCamera } from '../hooks/useCamera';
import { useCapture } from '../hooks/useCapture';
import { CameraPreview } from './CameraPreview';
import { CapturedImagePreview } from './CapturedImagePreview';
import { CameraToolbar } from './CameraToolbar';
import { PermissionDenied } from './PermissionDenied';

interface CameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
}

export function CameraDialog({ open, onOpenChange, onConfirm }: CameraDialogProps) {
  const { stream, error, startCamera, stopCamera } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { capturedImage, capturedFile, isProcessing, capture, retake } = useCapture(videoRef);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      retake();
    }
  }, [open, startCamera, stopCamera, retake]);

  const handleConfirm = () => {
    if (capturedFile) {
      onConfirm(capturedFile);
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      stopCamera();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl font-poppins">
        <DialogHeader>
          <DialogTitle>Capture Visitor Photo</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {error ? (
            <PermissionDenied error={error} onRetry={startCamera} />
          ) : (
            <div className="flex flex-col gap-2">
              {capturedImage ? (
                <CapturedImagePreview imageSrc={capturedImage} />
              ) : (
                <CameraPreview stream={stream} videoRef={videoRef} />
              )}
            </div>
          )}
        </div>

        {(!error || capturedImage) && (
          <CameraToolbar
            hasCaptured={!!capturedImage}
            isProcessing={isProcessing}
            onCapture={capture}
            onRetake={retake}
            onConfirm={handleConfirm}
            onCancel={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
