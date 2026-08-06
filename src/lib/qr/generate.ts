import QRCode from "qrcode";
import { assertPayloadFits } from "@/lib/qr-payload";

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "L",
  margin: 2,
  width: 480,
};

export async function payloadToDataUrl(payload: Uint8Array): Promise<string> {
  assertPayloadFits(payload, "QR");
  return QRCode.toDataURL([{ data: payload, mode: "byte" }], QR_OPTIONS);
}

export async function payloadToCanvas(
  canvas: HTMLCanvasElement,
  payload: Uint8Array
): Promise<void> {
  await QRCode.toCanvas(
    canvas,
    [{ data: payload, mode: "byte" }],
    { ...QR_OPTIONS, width: canvas.width || 320 }
  );
}
