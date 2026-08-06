import { QR_MAGIC } from "@/lib/qr-payload/constants";
import { parsePayload, type ParsedFrame } from "@/lib/qr-payload/decode";

interface JsQrResult {
  binaryData?: Uint8ClampedArray | Uint8Array;
  data?: string;
  chunks?: Array<{ type?: string; bytes?: number[]; text?: string }>;
}

function latin1ToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function bytesFromChunks(chunks: JsQrResult["chunks"]): Uint8Array | null {
  if (!chunks?.length) return null;

  const bytes: number[] = [];
  for (const chunk of chunks) {
    if (chunk.bytes?.length) {
      bytes.push(...chunk.bytes);
    }
  }

  return bytes.length > 0 ? new Uint8Array(bytes) : null;
}

function hasMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x46 && bytes[1] === 0x51;
}

/** Try multiple jsQR output formats — binaryData alone often fails for byte-mode QRs. */
export function extractPayloadBytes(result: JsQrResult): Uint8Array | null {
  const candidates: Uint8Array[] = [];

  if (result.binaryData?.length) {
    candidates.push(new Uint8Array(result.binaryData));
  }

  const chunkBytes = bytesFromChunks(result.chunks);
  if (chunkBytes) candidates.push(chunkBytes);

  if (result.data) {
    candidates.push(latin1ToBytes(result.data));
  }

  for (const candidate of candidates) {
    if (hasMagic(candidate)) return candidate;
  }

  return candidates[0] ?? null;
}

export function parseQrResult(result: JsQrResult): ParsedFrame | null {
  const bytes = extractPayloadBytes(result);
  if (!bytes) return null;
  return parsePayload(bytes);
}

export function isFountainPayload(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  const magic = (bytes[0] << 8) | bytes[1];
  return magic === QR_MAGIC;
}
