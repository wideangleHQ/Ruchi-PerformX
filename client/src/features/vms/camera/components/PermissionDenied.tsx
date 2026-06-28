import { CameraError } from '../types/camera.types';
import { AlertCircle, CameraOff, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PermissionDenied({ error, onRetry }: { error: CameraError, onRetry: () => void }) {
  let title = 'Camera Unavailable';
  let message = 'Unable to access the camera.';
  let Icon = CameraOff;

  switch (error) {
    case 'PERMISSION_DENIED':
      title = 'Permission Denied';
      message = 'Please allow camera access in your browser settings and try again.';
      break;
    case 'NOT_FOUND':
      title = 'Camera Not Found';
      message = 'No camera device was detected on your system.';
      Icon = MonitorOff;
      break;
    case 'IN_USE':
      title = 'Camera In Use';
      message = 'The camera is currently being used by another application.';
      Icon = AlertCircle;
      break;
    case 'UNSUPPORTED':
      title = 'Browser Unsupported';
      message = 'Your browser does not support camera access.';
      Icon = AlertCircle;
      break;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-xl border border-gray-200 font-poppins">
      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{message}</p>
      <Button onClick={onRetry} variant="outline" className="font-medium">
        Try Again
      </Button>
    </div>
  );
}
