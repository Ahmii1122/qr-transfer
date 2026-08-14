import QRCode from "qrcode";
import { assertPayloadFits } from "@/lib/qr-payload";

/** On-screen QR size. Kept modest so the code stays fully visible. */
export const QR_DISPLAY_PX = 280;

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "L",
  margin: 2,
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
