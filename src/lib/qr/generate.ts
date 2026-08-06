import QRCode from "qrcode";

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "L",
  margin: 1,
  width: 320,
};

export async function payloadToDataUrl(payload: Uint8Array): Promise<string> {
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
