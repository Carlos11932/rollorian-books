// BarcodeDetector type declarations (not in standard lib yet)

interface BarcodeDetectorOptions {
  formats: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorClass {
  new (options?: BarcodeDetectorOptions): {
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var BarcodeDetector: BarcodeDetectorClass | undefined;
}

export {};
