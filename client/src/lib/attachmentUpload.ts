import Compressor from 'compressorjs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function safeBaseName(name: string) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function extFor(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function compressImage(file: File) {
  return new Promise<File>((resolve, reject) => {
    new Compressor(file, {
      quality: 0.76,
      maxWidth: 1920,
      maxHeight: 1920,
      convertSize: 1024 * 1024,
      success(result: Blob) {
        const type = result.type || file.type;
        const fileName = `${safeBaseName(file.name)}.${extFor(type)}`;
        resolve(new File([result], fileName, { type, lastModified: Date.now() }));
      },
      error(error: unknown) {
        reject(error);
      },
    });
  });
}

export async function prepareAttachmentFiles(files: File[]) {
  const prepared: File[] = [];

  for (const file of files) {
    if (IMAGE_TYPES.has(file.type)) {
      prepared.push(await compressImage(file));
      continue;
    }

    const fileName = `${safeBaseName(file.name)}${file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''}`;
    prepared.push(fileName === file.name ? file : new File([file], fileName, { type: file.type, lastModified: Date.now() }));
  }

  return prepared;
}