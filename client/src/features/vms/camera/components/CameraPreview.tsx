import { useEffect } from 'react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function CameraPreview({ stream, videoRef }: CameraPreviewProps) {
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-sm flex items-center justify-center">
      {!stream ? (
        <div className="text-gray-400 text-sm font-poppins animate-pulse">Initializing Camera...</div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100" 
        />
      )}
    </div>
  );
}
