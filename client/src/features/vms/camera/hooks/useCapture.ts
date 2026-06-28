import { useState, useCallback, RefObject } from 'react';
import { compressImage } from '../utils/image-compression';

export const useCapture = (videoRef: RefObject<HTMLVideoElement | null>) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const capture = useCallback(async () => {
    if (!videoRef.current) return;
    
    setIsProcessing(true);
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const rawDataUrl = canvas.toDataURL('image/jpeg', 1.0);
        
        const compressedDataUrl = await compressImage(rawDataUrl, 500);
        setCapturedImage(compressedDataUrl);
        
        // Convert to File immediately
        const res = await fetch(compressedDataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        setCapturedFile(file);
      }
    } catch (error) {
      console.error('Failed to capture image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [videoRef]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setCapturedFile(null);
  }, []);

  return {
    capturedImage,
    capturedFile,
    isProcessing,
    capture,
    retake,
  };
};
