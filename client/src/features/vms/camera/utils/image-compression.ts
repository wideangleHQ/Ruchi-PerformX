export const compressImage = async (dataUrl: string, maxFileSizeKB: number = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      let width = img.width;
      let height = img.height;
      
      if (width > 1280) {
        height = Math.round((height * 1280) / width);
        width = 1280;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      const checkSize = (base64: string) => {
        const sizeInBytes = Math.ceil((base64.length - 'data:image/jpeg;base64,'.length) * 0.75);
        return sizeInBytes / 1024;
      };

      while (checkSize(compressedDataUrl) > maxFileSizeKB && quality > 0.3) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = dataUrl;
  });
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};
