export interface CameraState {
  stream: MediaStream | null;
  error: CameraError | null;
  isReady: boolean;
  isLoading: boolean;
}

export type CameraError = 
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'IN_USE'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export interface ImageValidationOptions {
  maxSizeMB: number;
  allowedTypes: string[];
}
