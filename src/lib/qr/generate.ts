import QRCode from "qrcode";
import { assertPayloadFits } from "@/lib/qr-payload";

/** High-res bitmap so modules stay sharp when shown large on screen. */
export const QR_DISPLAY_PX = 720;

/** Inline CSS — Tailwind arbitrary `min()` with commas is dropped, which shrank the QR. */
export const QR_BOX_STYLE = {
  width: "min(720px, 92vw, calc(100dvh - 13rem))",
  height: "min(720px, 92vw, calc(100dvh - 13rem))",
  imageRendering: "pixelated",
} as const;

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "L",
  margin: 4,
  width: QR_DISPLAY_PX,
};

export function qrRenderWidth(_payloadBytes?: number): number {
  return QR_DISPLAY_PX;
}

export async function payloadToDataUrl(payload: Uint8Array): Promise<string> {
  assertPayloadFits(payload, "QR");
  return QRCode.toDataURL([{ data: payload, mode: "byte" }], QR_OPTIONS);
}

export async function payloadToCanvas(
  canvas: HTMLCanvasElement,
  payload: Uint8Array
): Promise<void> {
  assertPayloadFits(payload, "QR");
  await QRCode.toCanvas(canvas, [{ data: payload, mode: "byte" }], {
    ...QR_OPTIONS,
    width: QR_DISPLAY_PX,
  });
}
