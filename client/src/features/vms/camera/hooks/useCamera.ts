import { useState, useCallback, useRef } from 'react';
import { CameraState, CameraError } from '../types/camera.types';

export const useCamera = () => {
  const [state, setState] = useState<CameraState>({
    stream: null,
    error: null,
    isReady: false,
    isLoading: false,
  });

  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setState((prev) => ({ ...prev, stream: null, isReady: false }));
  }, []);

  const startCamera = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'UNSUPPORTED' }));
      return;
    }

    try {
      stopCamera();
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = newStream;
      setState({
        stream: newStream,
        error: null,
        isReady: true,
        isLoading: false,
      });
    } catch (err: any) {
      let cameraError: CameraError = 'UNKNOWN';
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        cameraError = 'PERMISSION_DENIED';
      } else if (err.name === 'NotFoundError') {
        cameraError = 'NOT_FOUND';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        cameraError = 'IN_USE';
      }
      setState((prev) => ({ ...prev, isLoading: false, error: cameraError }));
    }
  }, [stopCamera]);

  return {
    ...state,
    startCamera,
    stopCamera,
  };
};
