import QRCode from "qrcode";
import { assertPayloadFits } from "@/lib/qr-payload";

/** Render denser payloads larger so each module stays camera-readable. */
export function qrRenderWidth(payloadBytes: number): number {
  if (payloadBytes > 2000) return 880;
  if (payloadBytes > 1000) return 720;
  return 512;
}

function qrOptions(payloadBytes: number): QRCode.QRCodeToDataURLOptions {
  return {
    errorCorrectionLevel: "L",
    margin: 4,
    width: qrRenderWidth(payloadBytes),
  };
}

export async function payloadToDataUrl(payload: Uint8Array): Promise<string> {
  assertPayloadFits(payload, "QR");
  return QRCode.toDataURL([{ data: payload, mode: "byte" }], qrOptions(payload.length));
}

export async function payloadToCanvas(
  canvas: HTMLCanvasElement,
  payload: Uint8Array
): Promise<void> {
  await QRCode.toCanvas(
    canvas,
    [{ data: payload, mode: "byte" }],
    { ...qrOptions(payload.length), width: canvas.width || qrRenderWidth(payload.length) }
  );
}
