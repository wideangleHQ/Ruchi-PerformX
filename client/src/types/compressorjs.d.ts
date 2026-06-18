declare module 'compressorjs' {
  export interface CompressorOptions {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    convertSize?: number;
    success?: (result: Blob) => void;
    error?: (error: unknown) => void;
  }

  export default class Compressor {
    constructor(file: Blob, options: CompressorOptions);
  }
}
