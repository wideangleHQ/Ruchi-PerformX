interface CapturedImagePreviewProps {
  imageSrc: string;
}

export function CapturedImagePreview({ imageSrc }: CapturedImagePreviewProps) {
  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src={imageSrc} 
        alt="Captured preview" 
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
