declare module "jsqr" {
  export interface QRCode {
    binaryData: Uint8ClampedArray;
    data: string;
    chunks: Array<{ type: string; text: string; bytes: number[] }>;
    location: {
      topLeftCorner: { x: number; y: number };
      topRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
    };
  }

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" }
  ): QRCode | null;
}
