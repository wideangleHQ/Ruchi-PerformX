import { ImageValidationOptions } from '../types/camera.types';

export const validateImage = (file: Blob, options: ImageValidationOptions): { valid: boolean; error?: string } => {
  if (!options.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid image type. Please capture a JPEG image.' };
  }

  const maxSizeBytes = options.maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `Image exceeds maximum allowed size of ${options.maxSizeMB}MB.` };
  }

  return { valid: true };
};
