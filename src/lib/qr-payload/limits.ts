import { MAX_QR_PAYLOAD_BYTES, SESSION_ID_BYTES } from "./constants";

const FRAME_OVERHEAD = 4 + SESSION_ID_BYTES;

/** Fixed symbol frame size: seed + degree + blockCount + dataLen (no indices — derived from seed). */
export const SYMBOL_FRAME_OVERHEAD = FRAME_OVERHEAD + 4 + 2 + 4 + 2;

export function maxSymbolDataBytes(): number {
  return MAX_QR_PAYLOAD_BYTES - SYMBOL_FRAME_OVERHEAD;
}

export function symbolPayloadSize(dataBytes: number): number {
  return SYMBOL_FRAME_OVERHEAD + dataBytes;
}

export function headerPayloadSize(fileNameLength: number): number {
  return FRAME_OVERHEAD + 2 + fileNameLength + 4 + 4 + 2 + 32;
}

export function assertPayloadFits(payload: Uint8Array, label: string): void {
  if (payload.length > MAX_QR_PAYLOAD_BYTES) {
    throw new Error(
      `${label} payload is ${payload.length} bytes (max ${MAX_QR_PAYLOAD_BYTES}). Reduce block size or shorten the file name.`
    );
  }
}
